/**
 * @fileoverview WebSocket Module Index
 * @description Exports WebSocket server initialization and handlers.
 * 
 * Usage in server.js:
 *   const { initializeWebSocket } = require('./websocket');
 *   initializeWebSocket(server);
 * 
 * @module websocket
 */

const socketController = require('./socketController');
const llmHandler = require('./llmHandler');

/**
 * Initialize WebSocket server with all handlers
 * @param {Object} server - HTTP server instance
 * @returns {WebSocket.Server} WebSocket server instance
 */
const initializeWebSocket = (server) => {
  // Register domain handlers
  socketController.registerHandler('llm', llmHandler);
  
  // Future handlers can be registered here:
  // socketController.registerHandler('tool', toolHandler);
  // socketController.registerHandler('notifications', notificationHandler);
  
  // Initialize the WebSocket server
  return socketController.initialize(server);
};

/**
 * Graceful shutdown
 */
const shutdownWebSocket = async () => {
  await socketController.shutdown();
};

module.exports = {
  // Main initialization
  initializeWebSocket,
  shutdownWebSocket,
  
  // Re-export socketController methods for direct access
  getConnections: socketController.getConnections,
  getStats: socketController.getStats,
  blockConnection: socketController.blockConnection,
  unblockConnection: socketController.unblockConnection,
  broadcast: socketController.broadcast,
  
  // Re-export for advanced usage
  socketController,
  llmHandler,
};