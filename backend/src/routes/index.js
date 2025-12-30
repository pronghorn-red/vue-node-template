/**
 * @fileoverview Routes Index
 * @description Central router configuration that mounts all API routes.
 * @module routes/index
 */

const express = require('express');
const authRoutes = require('./auth');
const healthRoutes = require('./health');
const llmRoutes = require('./llm');
const usersRoutes = require('./users');

const router = express.Router();

/**
 * @swagger
 * /:
 *   get:
 *     summary: API root endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API information
 */
router.get('/', (req, res) => {
  res.json({
    name: process.env.APP_NAME || 'Pronghorn API',
    version: process.env.APP_VERSION || '2.0.0',
    documentation: '/api-docs',
    health: '/api/v1/health'
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/llm', llmRoutes);
router.use('/users', usersRoutes);

module.exports = router;
