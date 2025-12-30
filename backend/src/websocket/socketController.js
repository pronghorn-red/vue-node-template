/**
 * @fileoverview WebSocket Controller
 * @description Central WebSocket connection manager with authentication,
 * message routing, connection tracking, and domain-based handler delegation.
 * 
 * Supports:
 * - JWT authentication (same as REST API)
 * - Database connection tracking (optional)
 * - Domain-based message routing (llm:*, tool:*, etc.)
 * - Parallel request handling with task isolation
 * - Rate limiting and connection blocking
 * 
 * @module websocket/socketController
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const { verifyToken } = require('../middleware/auth');
const { isDbConfigured, query } = require('../config/database');
const logger = require('../utils/logger');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  path: process.env.WS_PATH || '/ws',
  heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000,
  messageSizeLimit: parseInt(process.env.WS_MESSAGE_SIZE_LIMIT) || 1024 * 1024,
};

// Message type permissions
// - requireAuth: must be authenticated (default: false)
// - requireClaim: must have specific claim (e.g., 'isAdmin')
// - If not listed, message is allowed for anyone
const MESSAGE_PERMISSIONS = {
  // Auth operations
  'auth:refresh': { requireAuth: true },
  
  // Tool operations - require auth
  'tool:execute': { requireAuth: true },
  'tool:cancel': { requireAuth: true },
  
  // Admin operations - require admin claim
  'admin:connections': { requireAuth: true, requireClaim: 'isAdmin' },
  'admin:block_connection': { requireAuth: true, requireClaim: 'isAdmin' },
  'admin:unblock_connection': { requireAuth: true, requireClaim: 'isAdmin' },
  'admin:broadcast': { requireAuth: true, requireClaim: 'isSuperAdmin' },
};

// ============================================================================
// STATE
// ============================================================================

/**
 * Active connections map (in-memory tracking)
 * @type {Map<string, ConnectionState>}
 */
const connections = new Map();

/**
 * Domain handlers registry
 * @type {Map<string, Function>}
 */
const domainHandlers = new Map();

/**
 * WebSocket server instance
 * @type {WebSocket.Server|null}
 */
let wss = null;

/**
 * Heartbeat interval reference
 * @type {NodeJS.Timer|null}
 */
let heartbeatInterval = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique connection ID
 * @returns {string}
 */
const generateConnectionId = () => {
  return `conn_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
};

/**
 * Generate a unique task ID (for server-generated IDs)
 * @returns {string}
 */
const generateTaskId = () => {
  return `task_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
};

/**
 * Send a JSON message to a WebSocket client
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} message - Message object
 */
const sendMessage = (ws, message) => {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      logger.error('Failed to send WebSocket message', { error: error.message });
    }
  }
};

/**
 * Extract claims from decoded JWT token
 * @param {Object} decoded - Decoded JWT payload
 * @returns {Object} Claims object
 */
const extractClaims = (decoded) => {
  if (!decoded) {
    return {
      validated: false,
      claims: null,
    };
  }

  return {
    validated: true,
    claims: {
      id: decoded.id,
      email: decoded.email,
      displayName: decoded.display_name || decoded.displayName,
      isAdmin: decoded.isAdmin || decoded.role === 'admin',
      isSuperAdmin: decoded.isSuperAdmin || decoded.role === 'superadmin',
      isSubscriber: decoded.isSubscriber || false,
      accountStatus: decoded.accountStatus || 'active',
      projects: decoded.projects || [],
      domain: decoded.email?.split('@')[1] || null,
      // Extensible - add more claims as needed
    },
  };
};

/**
 * Check if a message type is allowed for a connection
 * @param {string} messageType - Message type (e.g., 'llm:start')
 * @param {Object} connection - Connection state
 * @returns {{ allowed: boolean, reason?: string }}
 */
const checkPermission = (messageType, connection) => {
  const permissions = MESSAGE_PERMISSIONS[messageType] || {};
  
  // Check auth requirement
  if (permissions.requireAuth && !connection.isAuthenticated) {
    return { allowed: false, reason: 'Authentication required' };
  }
  
  // Check claim requirement
  if (permissions.requireClaim) {
    const hasClaim = connection.claims?.[permissions.requireClaim];
    if (!hasClaim) {
      return { allowed: false, reason: `Requires ${permissions.requireClaim} permission` };
    }
  }
  
  return { allowed: true };
};

/**
 * Get client IP address from request
 * @param {Object} req - HTTP request
 * @returns {string}
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         'unknown';
};

// ============================================================================
// DATABASE OPERATIONS (OPTIONAL)
// ============================================================================

/**
 * Record connection in database
 * @param {Object} connection - Connection state
 * @param {Object} req - HTTP request
 */
const dbRecordConnection = async (connection, req) => {
  if (!isDbConfigured()) return;
  
  try {
    await query(`
      INSERT INTO websocket_connections 
        (connection_id, user_id, ip_address, user_agent, connected_at, is_authenticated, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (connection_id) DO UPDATE SET
        connected_at = EXCLUDED.connected_at,
        disconnected_at = NULL,
        is_authenticated = EXCLUDED.is_authenticated
    `, [
      connection.connectionId,
      connection.user?.id || null,
      connection.ipAddress,
      connection.userAgent,
      connection.connectedAt,
      connection.isAuthenticated,
      JSON.stringify(connection.metadata || {}),
    ]);
  } catch (error) {
    logger.debug('Failed to record connection in database', { error: error.message });
  }
};

/**
 * Update connection in database
 * @param {string} connectionId - Connection ID
 * @param {Object} updates - Fields to update
 */
const dbUpdateConnection = async (connectionId, updates) => {
  if (!isDbConfigured()) return;
  
  try {
    const setClauses = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.userId !== undefined) {
      setClauses.push(`user_id = $${paramIndex++}`);
      values.push(updates.userId);
    }
    if (updates.isAuthenticated !== undefined) {
      setClauses.push(`is_authenticated = $${paramIndex++}`);
      values.push(updates.isAuthenticated);
    }
    if (updates.messageCount !== undefined) {
      setClauses.push(`message_count = $${paramIndex++}`);
      values.push(updates.messageCount);
    }
    if (updates.lastActivityAt !== undefined) {
      setClauses.push(`last_activity_at = $${paramIndex++}`);
      values.push(updates.lastActivityAt);
    }
    if (updates.disconnectedAt !== undefined) {
      setClauses.push(`disconnected_at = $${paramIndex++}`);
      values.push(updates.disconnectedAt);
    }
    if (updates.isBlocked !== undefined) {
      setClauses.push(`is_blocked = $${paramIndex++}`);
      values.push(updates.isBlocked);
    }
    if (updates.blockedReason !== undefined) {
      setClauses.push(`blocked_reason = $${paramIndex++}`);
      values.push(updates.blockedReason);
    }
    
    if (setClauses.length > 0) {
      values.push(connectionId);
      await query(
        `UPDATE websocket_connections SET ${setClauses.join(', ')} WHERE connection_id = $${paramIndex}`,
        values
      );
    }
  } catch (error) {
    logger.debug('Failed to update connection in database', { error: error.message });
  }
};

/**
 * Check if a connection is blocked in database
 * @param {string} connectionId - Connection ID
 * @param {string} ipAddress - Client IP address
 * @returns {Promise<{ blocked: boolean, reason?: string }>}
 */
const dbCheckBlocked = async (connectionId, ipAddress) => {
  if (!isDbConfigured()) return { blocked: false };
  
  try {
    // Check by connection ID or IP address
    const result = await query(`
      SELECT is_blocked, blocked_reason 
      FROM websocket_connections 
      WHERE (connection_id = $1 OR ip_address = $2) AND is_blocked = TRUE
      LIMIT 1
    `, [connectionId, ipAddress]);
    
    if (result.rows.length > 0) {
      return { blocked: true, reason: result.rows[0].blocked_reason };
    }
  } catch (error) {
    logger.debug('Failed to check blocked status', { error: error.message });
  }
  
  return { blocked: false };
};

// ============================================================================
// CONNECTION HANDLERS
// ============================================================================

/**
 * Handle new WebSocket connection
 * @param {WebSocket} ws - WebSocket instance
 * @param {Object} req - HTTP request
 */
const handleConnection = async (ws, req) => {
  const connectionId = generateConnectionId();
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  // Check if blocked
  const blockStatus = await dbCheckBlocked(connectionId, ipAddress);
  if (blockStatus.blocked) {
    sendMessage(ws, {
      type: 'connection:blocked',
      reason: blockStatus.reason || 'Connection blocked',
    });
    ws.close(4003, 'Blocked');
    return;
  }
  
  // Extract token from URL if provided
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  
  // Validate token if provided
  let user = null;
  let claims = null;
  let isAuthenticated = false;
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      const extracted = extractClaims(decoded);
      if (extracted.validated) {
        user = { id: decoded.id, email: decoded.email };
        claims = extracted.claims;
        isAuthenticated = true;
      }
    }
  }
  
  // Create connection state
  const connection = {
    connectionId,
    ws,
    user,
    claims,
    isAuthenticated,
    isBlocked: false,
    connectedAt: new Date(),
    lastActivityAt: new Date(),
    messageCount: 0,
    ipAddress,
    userAgent,
    activeTasks: new Map(),
    metadata: {},
  };
  
  // Store connection
  connections.set(connectionId, connection);
  ws.connectionId = connectionId;
  
  // Record in database
  await dbRecordConnection(connection, req);
  
  logger.info('WebSocket connected', {
    connectionId,
    userId: user?.id || 'anonymous',
    ip: ipAddress,
    authenticated: isAuthenticated,
  });
  
  // Send welcome message
  const llmHandler = domainHandlers.get('llm');
  sendMessage(ws, {
    type: 'connection:welcome',
    connectionId,
    authenticated: isAuthenticated,
    user: isAuthenticated ? {
      id: user.id,
      email: user.email,
      displayName: claims?.displayName,
    } : null,
    availableProviders: llmHandler?.getProviders?.() || [],
    serverTime: new Date().toISOString(),
  });
  
  // Set up event handlers
  ws.on('message', (data) => handleMessage(connectionId, data));
  ws.on('close', (code, reason) => handleDisconnect(connectionId, code, reason));
  ws.on('error', (error) => handleError(connectionId, error));
  
  // Heartbeat
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
};

/**
 * Handle incoming WebSocket message
 * @param {string} connectionId - Connection ID
 * @param {Buffer|string} data - Raw message data
 */
const handleMessage = async (connectionId, data) => {
  const connection = connections.get(connectionId);
  if (!connection) return;
  
  const { ws } = connection;
  
  // Check if blocked
  if (connection.isBlocked) {
    sendMessage(ws, {
      type: 'connection:blocked',
      reason: 'Connection blocked',
    });
    return;
  }
  
  // Update activity
  connection.lastActivityAt = new Date();
  connection.messageCount++;
  
  // Parse message
  let message;
  try {
    const messageStr = data.toString();
    
    // Check message size
    if (messageStr.length > CONFIG.messageSizeLimit) {
      sendMessage(ws, {
        type: 'error',
        code: 'MESSAGE_TOO_LARGE',
        error: `Message exceeds size limit of ${CONFIG.messageSizeLimit} bytes`,
      });
      return;
    }
    
    message = JSON.parse(messageStr);
  } catch (error) {
    sendMessage(ws, {
      type: 'error',
      code: 'INVALID_MESSAGE',
      error: 'Invalid JSON message',
    });
    return;
  }
  
  // Validate message structure
  if (!message.type || typeof message.type !== 'string') {
    sendMessage(ws, {
      type: 'error',
      code: 'INVALID_MESSAGE',
      error: 'Message must have a "type" field',
    });
    return;
  }
  
  // Check permissions
  const permission = checkPermission(message.type, connection);
  if (!permission.allowed) {
    sendMessage(ws, {
      type: 'error',
      code: 'FORBIDDEN',
      error: permission.reason,
      messageType: message.type,
    });
    return;
  }
  
  // Update database periodically (every 10 messages)
  if (connection.messageCount % 10 === 0) {
    dbUpdateConnection(connectionId, {
      messageCount: connection.messageCount,
      lastActivityAt: connection.lastActivityAt,
    });
  }
  
  // Route message by domain
  await routeMessage(connection, message);
};

/**
 * Route message to appropriate handler based on domain
 * @param {Object} connection - Connection state
 * @param {Object} message - Parsed message
 */
const routeMessage = async (connection, message) => {
  const { ws } = connection;
  const [domain, action] = message.type.split(':');
  
  // Handle built-in message types
  switch (message.type) {
    case 'ping':
      sendMessage(ws, { type: 'pong' });
      return;
      
    case 'auth:login':
      await handleAuthLogin(connection, message);
      return;
      
    case 'auth:logout':
      await handleAuthLogout(connection);
      return;
  }
  
  // Check for domain handler
  const handler = domainHandlers.get(domain);
  if (!handler) {
    sendMessage(ws, {
      type: 'error',
      code: 'UNKNOWN_DOMAIN',
      error: `Unknown message domain: ${domain}`,
      supportedDomains: Array.from(domainHandlers.keys()),
    });
    return;
  }
  
  // Delegate to domain handler
  try {
    await handler.handleMessage(connection, message, action);
  } catch (error) {
    logger.error('Handler error', {
      connectionId: connection.connectionId,
      messageType: message.type,
      error: error.message,
    });
    
    sendMessage(ws, {
      type: `${domain}:error`,
      taskId: message.taskId,
      code: 'HANDLER_ERROR',
      error: error.message,
    });
  }
};

/**
 * Handle auth:login message
 * @param {Object} connection - Connection state
 * @param {Object} message - Login message
 */
const handleAuthLogin = async (connection, message) => {
  const { ws } = connection;
  const { token } = message;
  
  if (!token) {
    sendMessage(ws, {
      type: 'auth:error',
      code: 'MISSING_TOKEN',
      error: 'Token is required',
    });
    return;
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    sendMessage(ws, {
      type: 'auth:error',
      code: 'INVALID_TOKEN',
      error: 'Invalid or expired token',
    });
    return;
  }
  
  const extracted = extractClaims(decoded);
  
  // Update connection state
  connection.user = { id: decoded.id, email: decoded.email };
  connection.claims = extracted.claims;
  connection.isAuthenticated = true;
  
  // Update database
  await dbUpdateConnection(connection.connectionId, {
    userId: decoded.id,
    isAuthenticated: true,
  });
  
  logger.info('WebSocket authenticated', {
    connectionId: connection.connectionId,
    userId: decoded.id,
  });
  
  sendMessage(ws, {
    type: 'auth:success',
    user: {
      id: connection.user.id,
      email: connection.user.email,
      displayName: connection.claims?.displayName,
    },
    claims: connection.claims,
  });
};

/**
 * Handle auth:logout message
 * @param {Object} connection - Connection state
 */
const handleAuthLogout = async (connection) => {
  const { ws } = connection;
  
  connection.user = null;
  connection.claims = null;
  connection.isAuthenticated = false;
  
  await dbUpdateConnection(connection.connectionId, {
    userId: null,
    isAuthenticated: false,
  });
  
  sendMessage(ws, {
    type: 'auth:logout',
    success: true,
  });
};

/**
 * Handle WebSocket disconnection
 * @param {string} connectionId - Connection ID
 * @param {number} code - Close code
 * @param {string} reason - Close reason
 */
const handleDisconnect = async (connectionId, code, reason) => {
  const connection = connections.get(connectionId);
  if (!connection) return;
  
  // Abort all active tasks
  connection.activeTasks.forEach((task, taskId) => {
    if (task.abortController) {
      task.abortController.abort();
    }
    logger.debug('Aborted orphaned task', { connectionId, taskId });
  });
  
  // Update database
  await dbUpdateConnection(connectionId, {
    disconnectedAt: new Date(),
    messageCount: connection.messageCount,
  });
  
  // Remove from memory
  connections.delete(connectionId);
  
  logger.info('WebSocket disconnected', {
    connectionId,
    userId: connection.user?.id || 'anonymous',
    code,
    reason: reason?.toString() || 'No reason',
    messageCount: connection.messageCount,
    duration: Date.now() - connection.connectedAt.getTime(),
  });
};

/**
 * Handle WebSocket error
 * @param {string} connectionId - Connection ID
 * @param {Error} error - Error object
 */
const handleError = (connectionId, error) => {
  logger.error('WebSocket error', {
    connectionId,
    error: error.message,
  });
};

// ============================================================================
// ADMIN OPERATIONS
// ============================================================================

/**
 * Block a connection
 * @param {string} connectionId - Connection ID to block
 * @param {string} reason - Block reason
 * @returns {boolean} Success
 */
const blockConnection = async (connectionId, reason = 'Blocked by administrator') => {
  const connection = connections.get(connectionId);
  
  if (connection) {
    connection.isBlocked = true;
    sendMessage(connection.ws, {
      type: 'connection:blocked',
      reason,
    });
    connection.ws.close(4003, 'Blocked');
  }
  
  await dbUpdateConnection(connectionId, {
    isBlocked: true,
    blockedReason: reason,
  });
  
  return true;
};

/**
 * Unblock a connection
 * @param {string} connectionId - Connection ID to unblock
 * @returns {boolean} Success
 */
const unblockConnection = async (connectionId) => {
  await dbUpdateConnection(connectionId, {
    isBlocked: false,
    blockedReason: null,
  });
  return true;
};

/**
 * Get connection statistics
 * @returns {Object} Statistics
 */
const getStats = () => {
  const stats = {
    totalConnections: connections.size,
    authenticatedConnections: 0,
    anonymousConnections: 0,
    activeTasksCount: 0,
    connectionsByDomain: {},
  };
  
  connections.forEach((conn) => {
    if (conn.isAuthenticated) {
      stats.authenticatedConnections++;
    } else {
      stats.anonymousConnections++;
    }
    stats.activeTasksCount += conn.activeTasks.size;
    
    const domain = conn.claims?.domain || 'unknown';
    stats.connectionsByDomain[domain] = (stats.connectionsByDomain[domain] || 0) + 1;
  });
  
  return stats;
};

/**
 * Get list of active connections (for admin)
 * @returns {Array} Connection list
 */
const getConnections = () => {
  return Array.from(connections.values()).map((conn) => ({
    connectionId: conn.connectionId,
    userId: conn.user?.id || null,
    email: conn.user?.email || null,
    isAuthenticated: conn.isAuthenticated,
    ipAddress: conn.ipAddress,
    connectedAt: conn.connectedAt,
    lastActivityAt: conn.lastActivityAt,
    messageCount: conn.messageCount,
    activeTasksCount: conn.activeTasks.size,
  }));
};

/**
 * Broadcast message to all connections
 * @param {Object} message - Message to broadcast
 * @param {Function} [filter] - Optional filter function
 */
const broadcast = (message, filter = null) => {
  connections.forEach((connection) => {
    if (filter && !filter(connection)) return;
    sendMessage(connection.ws, message);
  });
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Register a domain handler
 * @param {string} domain - Domain name (e.g., 'llm', 'tool')
 * @param {Object} handler - Handler object with handleMessage function
 */
const registerHandler = (domain, handler) => {
  if (typeof handler.handleMessage !== 'function') {
    throw new Error(`Handler for domain '${domain}' must have a handleMessage function`);
  }
  domainHandlers.set(domain, handler);
  logger.info(`Registered WebSocket handler for domain: ${domain}`);
};

/**
 * Initialize WebSocket server
 * @param {Object} server - HTTP server instance
 * @returns {WebSocket.Server} WebSocket server instance
 */
const initialize = (server) => {
  wss = new WebSocket.Server({
    server,
    path: CONFIG.path,
    maxPayload: CONFIG.messageSizeLimit,
  });
  
  wss.on('connection', handleConnection);
  
  wss.on('error', (error) => {
    logger.error('WebSocket server error', { error: error.message });
  });
  
  // Heartbeat interval
  heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        const connectionId = ws.connectionId;
        logger.debug('Terminating inactive WebSocket', { connectionId });
        handleDisconnect(connectionId, 1001, 'Heartbeat timeout');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, CONFIG.heartbeatInterval);
  
  wss.on('close', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });
  
  logger.info(`✅ WebSocket server initialized`, {
    path: CONFIG.path,
    heartbeatInterval: CONFIG.heartbeatInterval,
  });
  
  return wss;
};

/**
 * Graceful shutdown
 */
const shutdown = async () => {
  logger.info('Shutting down WebSocket server...');
  
  // Notify all clients
  broadcast({
    type: 'connection:shutdown',
    message: 'Server is shutting down',
  });
  
  // Close all connections
  for (const [connectionId, connection] of connections) {
    connection.activeTasks.forEach((task) => {
      if (task.abortController) {
        task.abortController.abort();
      }
    });
    connection.ws.close(1001, 'Server shutdown');
    await dbUpdateConnection(connectionId, {
      disconnectedAt: new Date(),
    });
  }
  
  connections.clear();
  
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  if (wss) {
    wss.close();
  }
  
  logger.info('WebSocket server shut down complete');
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Initialization
  initialize,
  shutdown,
  registerHandler,
  
  // Connection management
  getConnection: (connectionId) => connections.get(connectionId),
  getConnections,
  getStats,
  blockConnection,
  unblockConnection,
  broadcast,
  
  // Utilities
  sendMessage,
  generateTaskId,
  
  // Configuration
  CONFIG,
  MESSAGE_PERMISSIONS,
};