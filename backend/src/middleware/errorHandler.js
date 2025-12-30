/**
 * @fileoverview Error Handling Middleware
 * @description Centralized error handling with structured error responses
 * and appropriate HTTP status codes.
 * @module middleware/errorHandler
 */

const logger = require('../utils/logger');

/**
 * Custom API Error class
 * @extends Error
 */
class ApiError extends Error {
  /**
   * Create an API error
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {string} [code] - Error code
   * @param {Object} [details] - Additional error details
   */
  constructor(statusCode, message, code = 'ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Create a 400 Bad Request error
   * @param {string} message - Error message
   * @param {Object} [details] - Validation details
   * @returns {ApiError}
   */
  static badRequest(message = 'Bad request', details = null) {
    return new ApiError(400, message, 'BAD_REQUEST', details);
  }
  
  /**
   * Create a 401 Unauthorized error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }
  
  /**
   * Create a 403 Forbidden error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message, 'FORBIDDEN');
  }
  
  /**
   * Create a 404 Not Found error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, 'NOT_FOUND');
  }
  
  /**
   * Create a 409 Conflict error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static conflict(message = 'Resource conflict') {
    return new ApiError(409, message, 'CONFLICT');
  }
  
  /**
   * Create a 422 Unprocessable Entity error
   * @param {string} message - Error message
   * @param {Object} [details] - Validation details
   * @returns {ApiError}
   */
  static unprocessable(message = 'Unprocessable entity', details = null) {
    return new ApiError(422, message, 'UNPROCESSABLE_ENTITY', details);
  }
  
  /**
   * Create a 429 Too Many Requests error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message, 'TOO_MANY_REQUESTS');
  }
  
  /**
   * Create a 500 Internal Server Error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static internal(message = 'Internal server error') {
    return new ApiError(500, message, 'INTERNAL_ERROR');
  }
  
  /**
   * Create a 503 Service Unavailable error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static serviceUnavailable(message = 'Service unavailable') {
    return new ApiError(503, message, 'SERVICE_UNAVAILABLE');
  }
}

/**
 * Not found handler for undefined routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.details || null;
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  } else if (err.code === '23505') {
    // PostgreSQL unique violation
    statusCode = 409;
    message = 'Resource already exists';
    code = 'DUPLICATE_ENTRY';
  } else if (err.code === '23503') {
    // PostgreSQL foreign key violation
    statusCode = 400;
    message = 'Invalid reference';
    code = 'INVALID_REFERENCE';
  }
  
  // Log error
  if (statusCode >= 500) {
    logger.error('Server error', {
      requestId: req.requestId,
      statusCode,
      code,
      message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method
    });
  } else {
    logger.warn('Client error', {
      requestId: req.requestId,
      statusCode,
      code,
      message,
      url: req.originalUrl,
      method: req.method
    });
  }
  
  // Build response
  const response = {
    success: false,
    error: message,
    code
  };
  
  // Include details in non-production environments or for client errors
  if (details || (process.env.NODE_ENV !== 'production' && statusCode >= 500)) {
    response.details = details || (process.env.NODE_ENV !== 'production' ? err.stack : undefined);
  }
  
  // Include request ID for tracking
  if (req.requestId) {
    response.requestId = req.requestId;
  }
  
  res.status(statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  ApiError,
  notFoundHandler,
  errorHandler,
  asyncHandler
};
