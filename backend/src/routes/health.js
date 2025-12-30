/**
 * @fileoverview Health Check Routes
 * @description Provides health check endpoints for monitoring application status,
 * database connectivity, and system metrics.
 * @module routes/health
 */

const express = require('express');
const { checkConnection, getPoolStats } = require('../config/database');
const { getAvailableProviders } = require('../services/llmService');
const { getStats: getWsStats } = require('../websocket/llmHandler');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', asyncHandler(async (req, res) => {
  const startTime = process.hrtime();
  
  // Check database connection
  const dbConnected = await checkConnection();
  
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const responseTime = (seconds * 1000 + nanoseconds / 1000000).toFixed(2);
  
  const status = dbConnected ? 'healthy' : 'degraded';
  const statusCode = dbConnected ? 200 : 503;
  
  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '2.0.0',
    uptime: Math.floor(process.uptime()),
    responseTime: `${responseTime}ms`,
    database: {
      connected: dbConnected,
      poolStats: getPoolStats()
    }
  });
}));

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check with all service statuses
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health information
 */
router.get('/detailed', asyncHandler(async (req, res) => {
  const startTime = process.hrtime();
  
  // Check database
  const dbConnected = await checkConnection();
  
  // Get LLM providers
  const llmProviders = getAvailableProviders();
  
  // Get WebSocket stats
  let wsStats = { totalConnections: 0 };
  try {
    wsStats = getWsStats();
  } catch (e) {
    // WebSocket might not be initialized yet
  }
  
  // Memory usage
  const memoryUsage = process.memoryUsage();
  
  const [seconds, nanoseconds] = process.hrtime(startTime);
  const responseTime = (seconds * 1000 + nanoseconds / 1000000).toFixed(2);
  
  const allHealthy = dbConnected;
  const status = allHealthy ? 'healthy' : 'degraded';
  
  res.status(allHealthy ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    responseTime: `${responseTime}ms`,
    services: {
      database: {
        status: dbConnected ? 'healthy' : 'unhealthy',
        poolStats: getPoolStats()
      },
      llm: {
        status: llmProviders.length > 0 ? 'healthy' : 'degraded',
        availableProviders: llmProviders
      },
      websocket: {
        status: 'healthy',
        connections: wsStats.totalConnections
      }
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
      },
      cpuUsage: process.cpuUsage()
    }
  });
}));

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe for Kubernetes
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', asyncHandler(async (req, res) => {
  const dbConnected = await checkConnection();
  
  if (dbConnected) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false, reason: 'Database not connected' });
  }
}));

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe for Kubernetes
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/live', (req, res) => {
  res.status(200).json({ alive: true });
});

module.exports = router;
