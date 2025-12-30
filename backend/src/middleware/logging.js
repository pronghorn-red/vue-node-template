/**
 * @fileoverview HTTP Request Logging Middleware
 * @description Provides request/response logging with timing information
 * and structured output for monitoring and debugging.
 * @module middleware/logging
 */

const logger = require('../utils/logger');
const { logAccess } = require('../utils/logger');

/**
 * Request logging middleware
 * Logs incoming requests and outgoing responses with timing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Generate unique request ID
  req.requestId = req.headers['x-request-id'] || 
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')
  });
  
  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Log access for all requests
    logAccess(req, res, duration);
    
    // Log response details
    const logLevel = res.statusCode >= 500 ? 'error' : 
                     res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0
    });
  });
  
  // Capture response close (client disconnected)
  res.on('close', () => {
    if (!res.writableEnded) {
      const duration = Date.now() - startTime;
      logger.warn('Request aborted by client', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`
      });
    }
  });
  
  next();
};

/**
 * Error logging middleware
 * Logs errors with full stack traces and request context
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorLogger = (err, req, res, next) => {
  logger.error('Request error', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: err.stack,
    userId: req.user?.id
  });
  
  next(err);
};

/**
 * Skip logging for specific paths (e.g., health checks, static files)
 * @param {Array<string|RegExp>} paths - Paths to skip
 * @returns {Function} Middleware function
 */
const skipPaths = (paths = []) => {
  return (req, res, next) => {
    const shouldSkip = paths.some(path => {
      if (path instanceof RegExp) {
        return path.test(req.path);
      }
      return req.path === path || req.path.startsWith(path);
    });
    
    if (shouldSkip) {
      return next();
    }
    
    return requestLogger(req, res, next);
  };
};

module.exports = {
  requestLogger,
  errorLogger,
  skipPaths
};
