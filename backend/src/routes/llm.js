/**
 * @fileoverview LLM Routes
 * @description API routes for LLM interactions including chat completions,
 * streaming via SSE, embeddings, and model/provider information.
 * @module routes/llm
 */

const express = require('express');
const router = express.Router();
const llmController = require('../controllers/llmController');
const { authenticateJWT, optionalAuth } = require('../middleware/auth');
const llmService = require('../services/llmService');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * @swagger
 * tags:
 *   name: LLM
 *   description: Large Language Model API endpoints
 */

/**
 * @swagger
 * /llm/providers:
 *   get:
 *     summary: Get available LLM providers
 *     tags: [LLM]
 *     responses:
 *       200:
 *         description: List of available providers and their status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     providers:
 *                       type: object
 *                     available:
 *                       type: array
 *                       items:
 *                         type: string
 *                     default:
 *                       type: string
 */
router.get('/providers', llmController.getProviders);

/**
 * @swagger
 * /llm/models:
 *   get:
 *     summary: Get available LLM models
 *     tags: [LLM]
 *     parameters:
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *         description: Filter models by provider
 *     responses:
 *       200:
 *         description: List of available models
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     models:
 *                       type: array
 *                     count:
 *                       type: integer
 */
router.get('/models', llmController.getModels);

/**
 * @swagger
 * /llm/models/{modelId}:
 *   get:
 *     summary: Get model configuration by ID
 *     tags: [LLM]
 *     parameters:
 *       - in: path
 *         name: modelId
 *         required: true
 *         schema:
 *           type: string
 *         description: Model ID
 *     responses:
 *       200:
 *         description: Model configuration
 *       404:
 *         description: Model not found
 */
router.get('/models/:modelId', llmController.getModelConfig);

/**
 * @swagger
 * /llm/chat/stream:
 *   post:
 *     summary: Stream chat completion via Server-Sent Events (SSE)
 *     tags: [LLM]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               provider:
 *                 type: string
 *               model:
 *                 type: string
 *               systemPrompt:
 *                 type: string
 *               temperature:
 *                 type: number
 *               maxTokens:
 *                 type: integer
 *     responses:
 *       200:
 *         description: SSE stream of chat completion
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: |
 *                 SSE events:
 *                 - connected: Initial connection established
 *                 - start: Stream starting with model info
 *                 - content: Content chunk
 *                 - done: Stream complete with finish reason
 *                 - end: Connection closing
 *                 - error: Error occurred
 */
router.post('/chat/stream', optionalAuth, llmController.handleStreamChat);

/**
 * @swagger
 * /llm/embeddings:
 *   post:
 *     summary: Generate text embeddings
 *     tags: [LLM]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - input
 *             properties:
 *               model:
 *                 type: string
 *                 default: text-embedding-3-large
 *               input:
 *                 oneOf:
 *                   - type: string
 *                   - type: array
 *                     items:
 *                       type: string
 *     responses:
 *       200:
 *         description: Embeddings response
 *       400:
 *         description: Bad request
 */
router.post('/embeddings', authenticateJWT, llmController.generateEmbeddings);

module.exports = router;
