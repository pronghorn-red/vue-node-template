/**
 * @fileoverview Database Configuration
 * @description PostgreSQL database connection configuration with connection pooling,
 * connection string support, and optional database connectivity.
 * 
 * Features:
 * - Supports DB_CONNECTION_STRING (takes precedence over individual params)
 * - Supports individual connection parameters (DB_HOST, DB_PORT, etc.)
 * - Optional database - app will run without DB if not configured
 * - Connection pooling optimized for high traffic
 * - Automatic reconnection on connection loss
 * 
 * @module config/database
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

/**
 * Database configuration defaults
 */
const DB_DEFAULTS = {
  host: 'localhost',
  port: 5432,
  database: 'pronghorn',
  user: 'postgres',
  password: '',
  ssl: false,
  pool: {
    min: 2,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
  }
};

/**
 * Parse a PostgreSQL connection string into config object
 * @param {string} connectionString - PostgreSQL connection string
 * @returns {Object} Parsed configuration object
 */
const parseConnectionString = (connectionString) => {
  try {
    let finalConnectionString = connectionString;
    
    // If DB_SSL=true and connection string doesn't have sslmode, add it
    if (process.env.DB_SSL === 'true' && !connectionString.includes('sslmode=')) {
      finalConnectionString = connectionString.includes('?') 
        ? `${connectionString}&sslmode=require`
        : `${connectionString}?sslmode=require`;
      logger.info('📦 Added sslmode=require to connection string (DB_SSL=true)');
    }
    
    const url = new URL(finalConnectionString);
    
    // Extract SSL mode from query params
    const sslMode = url.searchParams.get('sslmode') || url.searchParams.get('ssl');
    let ssl = false;
    if (sslMode === 'require' || sslMode === 'verify-ca' || sslMode === 'verify-full') {
      ssl = { rejectUnauthorized: sslMode !== 'require' };
    } else if (sslMode === 'true' || sslMode === '1') {
      ssl = true;
    }
    
    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || 5432,
      database: url.pathname.slice(1), // Remove leading slash
      user: url.username,
      password: decodeURIComponent(url.password),
      ssl
    };
  } catch (error) {
    logger.error('Failed to parse database connection string', { error: error.message });
    return null;
  }
};

/**
 * Check if database configuration is provided
 * @returns {boolean} True if database is configured
 */
const isDatabaseConfigured = () => {
  const connectionString = process.env.DB_CONNECTION_STRING;
  const host = process.env.DB_HOST;
  const password = process.env.DB_PASSWORD;
  
  // Check if connection string is provided and not a placeholder
  if (connectionString && 
      connectionString.trim() !== '' && 
      !connectionString.includes('your_') &&
      connectionString.startsWith('postgres')) {
    return true;
  }
  
  // Check if individual params are provided with a real password
  if (host && password && 
      password.trim() !== '' && 
      !password.includes('your_') &&
      password !== 'your_secure_password_here') {
    return true;
  }
  
  return false;
};

/**
 * Build database configuration from environment variables
 * @returns {Object|null} Database configuration or null if not configured
 */
const buildConfig = () => {
  // Check if database is configured
  if (!isDatabaseConfigured()) {
    logger.warn('⚠️  Database not configured - running without database connection');
    logger.info('   To enable database, set DB_CONNECTION_STRING or DB_HOST/DB_PASSWORD in .env');
    return null;
  }
  
  // Priority 1: Connection string
  const connectionString = process.env.DB_CONNECTION_STRING;
  if (connectionString && connectionString.trim() !== '' && connectionString.startsWith('postgres')) {
    const parsed = parseConnectionString(connectionString);
    if (parsed) {
      logger.info('📦 Using database connection string');
      return {
        ...parsed,
        max: parseInt(process.env.DB_POOL_MAX, 10) || DB_DEFAULTS.pool.max,
        min: parseInt(process.env.DB_POOL_MIN, 10) || DB_DEFAULTS.pool.min,
        idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || DB_DEFAULTS.pool.idleTimeoutMillis,
        connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT, 10) || DB_DEFAULTS.pool.connectionTimeoutMillis,
        application_name: process.env.APP_NAME || 'TEMPLATE'
      };
    }
  }
  
  // Priority 2: Individual parameters
  const sslEnv = process.env.DB_SSL;
  let ssl = false;
  if (sslEnv === 'true' || sslEnv === '1' || sslEnv === 'require') {
    ssl = { rejectUnauthorized: false };
  }
  
  logger.info('📦 Using individual database connection parameters');
  
  return {
    host: process.env.DB_HOST || DB_DEFAULTS.host,
    port: parseInt(process.env.DB_PORT, 10) || DB_DEFAULTS.port,
    database: process.env.DB_NAME || DB_DEFAULTS.database,
    user: process.env.DB_USER || DB_DEFAULTS.user,
    password: process.env.DB_PASSWORD || DB_DEFAULTS.password,
    ssl,
    max: parseInt(process.env.DB_POOL_MAX, 10) || DB_DEFAULTS.pool.max,
    min: parseInt(process.env.DB_POOL_MIN, 10) || DB_DEFAULTS.pool.min,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || DB_DEFAULTS.pool.idleTimeoutMillis,
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT, 10) || DB_DEFAULTS.pool.connectionTimeoutMillis,
    application_name: process.env.APP_NAME || 'TEMPLATE'
  };
};

/**
 * Database pool instance (null if not configured)
 * @type {Pool|null}
 */
let pool = null;

/**
 * Database connection status
 * @type {boolean}
 */
let isConnected = false;

/**
 * Initialize the database connection pool
 * @returns {Pool|null} The database pool or null if not configured
 */
const initializePool = () => {
  const config = buildConfig();
  
  if (!config) {
    return null;
  }
  
  pool = new Pool(config);
  
  // Handle pool errors
  pool.on('error', (err) => {
    logger.error('Unexpected database pool error', { error: err.message });
    isConnected = false;
  });
  
  // Handle new client connections
  pool.on('connect', () => {
    logger.debug('New database client connected');
  });
  
  // Handle client removal
  pool.on('remove', () => {
    logger.debug('Database client removed from pool');
  });
  
  return pool;
};

/**
 * Get the database pool instance
 * @returns {Pool|null} The database pool or null if not configured
 */
const getPool = () => {
  if (!pool) {
    pool = initializePool();
  }
  return pool;
};

/**
 * Test the database connection
 * @returns {Promise<boolean>} True if connection successful
 */
const testConnection = async () => {
  const currentPool = getPool();
  
  if (!currentPool) {
    logger.info('📭 Database not configured - skipping connection test');
    return false;
  }
  
  try {
    const client = await currentPool.connect();
    const result = await client.query('SELECT NOW() as now, version() as version');
    client.release();
    
    isConnected = true;
    logger.info('✅ Database connection successful', {
      timestamp: result.rows[0].now,
      version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1]
    });
    
    return true;
  } catch (error) {
    isConnected = false;
    logger.error('❌ Database connection failed', { 
      error: error.message,
      code: error.code,
      hint: error.hint || 'Check your database credentials and ensure PostgreSQL is running'
    });
    return false;
  }
};

/**
 * Check database connectivity (alias for testConnection)
 * @async
 * @returns {Promise<boolean>} Connection status
 */
const checkConnection = testConnection;

/**
 * Execute a query on the database
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 * @throws {Error} If database is not configured or query fails
 */
const query = async (text, params = []) => {
  const currentPool = getPool();
  
  if (!currentPool) {
    throw new Error('Database not configured. Set DB_CONNECTION_STRING or DB_HOST/DB_PASSWORD in .env');
  }
  
  const start = Date.now();
  try {
    const result = await currentPool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Database query executed', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount
    });
    
    return result;
  } catch (error) {
    logger.error('Database query failed', {
      query: text.substring(0, 100),
      error: error.message
    });
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Database client
 * @throws {Error} If database is not configured
 */
const getClient = async () => {
  const currentPool = getPool();
  
  if (!currentPool) {
    throw new Error('Database not configured. Set DB_CONNECTION_STRING or DB_HOST/DB_PASSWORD in .env');
  }
  
  const client = await currentPool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);
  
  // Track query execution time
  client.query = async (...args) => {
    const start = Date.now();
    try {
      const result = await originalQuery(...args);
      const duration = Date.now() - start;
      logger.debug('Transaction query', { duration: `${duration}ms` });
      return result;
    } catch (error) {
      logger.error('Transaction query error', { error: error.message });
      throw error;
    }
  };
  
  // Ensure client is released back to pool
  client.release = () => {
    logger.debug('Releasing client back to pool');
    return originalRelease();
  };
  
  return client;
};

/**
 * Execute a transaction with automatic rollback on error
 * @async
 * @param {Function} callback - Transaction callback function
 * @returns {Promise<*>} Transaction result
 * @throws {Error} Transaction error
 */
const transaction = async (callback) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Close the database pool
 * @returns {Promise<void>}
 */
const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    isConnected = false;
    logger.info('Database pool closed');
  }
};

/**
 * Check if database is connected
 * @returns {boolean} Connection status
 */
const isDbConnected = () => isConnected;

/**
 * Check if database is configured (not necessarily connected)
 * @returns {boolean} Configuration status
 */
const isDbConfigured = () => isDatabaseConfigured();

/**
 * Get pool statistics
 * @returns {Object|null} Pool statistics or null if not configured
 */
const getPoolStats = () => {
  if (!pool) return null;
  
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
};

module.exports = {
  pool: getPool(), // For backward compatibility
  getPool,
  testConnection,
  checkConnection,
  query,
  getClient,
  transaction,
  closePool,
  isDbConnected,
  isDbConfigured,
  getPoolStats,
  initializePool
};
