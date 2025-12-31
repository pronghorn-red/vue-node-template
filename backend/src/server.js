/**
 * @fileoverview Main Server Entry Point
 * @description Initializes and configures the Express server with all middleware,
 * routes, WebSocket support, and production static file serving.
 * Designed to be resilient - will start even if some services are unavailable.
 * @module server
 */

const path = require("path");
const crypto = require("crypto");

// Load environment variables from root .env
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const express = require("express");
const http = require("http");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const history = require("connect-history-api-fallback");
const swaggerUi = require("swagger-ui-express");

// Internal modules
const {
  testConnection,
  closePool,
  isDbConfigured,
  getPool,
} = require("./config/database");
const swaggerSpec = require("./config/swagger");
const routes = require("./routes");
const { requestLogger, errorLogger } = require("./middleware/logging");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { initializeClients } = require("./services/llmService");
const { initializeWebSocket, shutdownWebSocket } = require("./websocket");

const logger = require("./utils/logger");

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Configuration with defaults
const APP_NAME = process.env.APP_NAME || "TEMPLATE";
const APP_VERSION = process.env.APP_VERSION || "0.0.1";
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "localhost";
const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";
const API_BASE_PATH = process.env.API_BASE_PATH || "/api/v1";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Generate secrets dynamically if not provided
const SESSION_SECRET =
  process.env.SESSION_SECRET && !process.env.SESSION_SECRET.includes("your_")
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString("hex");

const JWT_SECRET =
  process.env.JWT_SECRET && !process.env.JWT_SECRET.includes("your_")
    ? process.env.JWT_SECRET
    : crypto.randomBytes(32).toString("hex");

// Export generated secrets for other modules
process.env.SESSION_SECRET = SESSION_SECRET;
process.env.JWT_SECRET = JWT_SECRET;

if (
  !process.env.JWT_REFRESH_SECRET ||
  process.env.JWT_REFRESH_SECRET.includes("your_")
) {
  process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString("hex");
}

logger.info(`🦌 Starting ${APP_NAME} v${APP_VERSION}`);
logger.info(`   Environment: ${NODE_ENV}`);

// Log if secrets were auto-generated
if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.includes("your_")
) {
  logger.warn(
    "⚠️  SESSION_SECRET not configured - using auto-generated secret (not persistent across restarts)"
  );
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes("your_")) {
  logger.warn(
    "⚠️  JWT_SECRET not configured - using auto-generated secret (not persistent across restarts)"
  );
}

/**
 * Configure security middleware
 */
app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-eval'"], // Vue needs unsafe-eval for template compilation
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com",
            ], // Allow inline styles for Vue + Google Fonts
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"], // Google Fonts
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
  })
);
/**
 * Configure CORS
 */
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  })
);

/**
 * Configure compression for responses
 */
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6,
    threshold: 1024,
  })
);

/**
 * Configure rate limiting
 */
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  message: {
    success: false,
    error: "Too many requests, please try again later",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(API_BASE_PATH, limiter);

/**
 * Configure body parsing
 */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

/**
 * Configure session - use memory store if database not available
 */
const configureSession = () => {
  const sessionConfig = {
    name: process.env.SESSION_NAME || "pronghorn.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction || process.env.COOKIE_SECURE === "true",
      httpOnly: true,
      maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 24 * 60 * 60 * 1000,
      sameSite: process.env.COOKIE_SAME_SITE || "lax",
    },
  };

  // Try to use PostgreSQL session store if database is configured
  if (isDbConfigured()) {
    try {
      const pgSession = require("connect-pg-simple")(session);
      const pool = getPool();

      if (pool) {
        sessionConfig.store = new pgSession({
          pool,
          tableName: "session",
          createTableIfMissing: true,
        });
        logger.info("✅ Using PostgreSQL session store");
      }
    } catch (error) {
      logger.warn(
        "⚠️  Failed to configure PostgreSQL session store, using memory store",
        {
          error: error.message,
        }
      );
    }
  } else {
    logger.warn(
      "⚠️  Database not configured - using memory session store (sessions will not persist across restarts)"
    );
  }

  return session(sessionConfig);
};

app.use(configureSession());

/**
 * Initialize Passport (only if auth is configured)
 */
const initializePassport = () => {
  try {
    const passport = require("./config/passport");
    app.use(passport.initialize());
    app.use(passport.session());
    logger.info("✅ Passport authentication initialized");
    return true;
  } catch (error) {
    logger.warn(
      "⚠️  Passport initialization failed - authentication may be limited",
      {
        error: error.message,
      }
    );
    return false;
  }
};

initializePassport();

/**
 * Request logging middleware
 */
app.use(requestLogger);

/**
 * Trust proxy for production deployments behind reverse proxy
 */
if (isProduction) {
  app.set("trust proxy", 1);
}

/**
 * Swagger API documentation
 */
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: `${APP_NAME} API Documentation`,
  })
);

// Serve swagger spec as JSON
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

/**
 * Mount API routes
 */
app.use(API_BASE_PATH, routes);

/**
 * Serve static files in production
 */
if (isProduction) {
  try {
    const distPath = path.join(__dirname, "../../frontend/dist");

    // SPA history fallback (must be before static middleware)
    app.use(
      history({
        index: "/index.html",
        disableDotRule: false,
        verbose: false,
        rewrites: [
          { from: /^\/api\/.*$/, to: (context) => context.parsedUrl.path },
          { from: /^\/api-docs.*$/, to: (context) => context.parsedUrl.path },
          { from: /^\/ws.*$/, to: (context) => context.parsedUrl.path },
        ],
      })
    );

    // Serve static files with caching and compression
    app.use(
      express.static(distPath, {
        maxAge: "1d",
        etag: true,
        lastModified: true,
        index: false,
      })
    );

    // Fallback to index.html for SPA routes
    app.get(/.*/, (req, res, next) => {
      // Skip API routes
      if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
        return next();
      }
      res.sendFile(path.join(distPath, "index.html"));
    });

    logger.info(
      "📦 Production mode: Serving static files from frontend/dist with compression"
    );
  } catch (error) {
    logger.error("Error in PROD", error);
  }
}

/**
 * Error handling middleware
 */
app.use(errorLogger);
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Initialize services and start server
 */
const startServer = async () => {
  try {
    logger.info("🔧 Initializing services...");

    // Check database connection (optional)
    if (isDbConfigured()) {
      const dbConnected = await testConnection();
      if (!dbConnected) {
        logger.warn(
          "⚠️  Database connection failed - database features will be unavailable"
        );
      }
    } else {
      logger.info("📭 Database not configured - running without database");
    }

    // Initialize LLM clients
    initializeClients();

    // Initialize WebSocket server
    initializeWebSocket(server);

    // Start HTTP server
    server.listen(PORT, HOST, () => {
      logger.info(`✅ Server started`, {
        app: APP_NAME,
        version: APP_VERSION,
        port: PORT,
        host: HOST,
        environment: NODE_ENV,
        apiPath: API_BASE_PATH,
        swagger: "/api-docs",
      });

      console.log(`
╔═══════════════════════════════════════════════════════════════
║                    🦌 ${APP_NAME.padEnd(15)} v${APP_VERSION.padEnd(12)}       
╠═══════════════════════════════════════════════════════════════
║  Environment: ${NODE_ENV.padEnd(46)}
║  API:         http://${HOST}:${PORT}${API_BASE_PATH.padEnd(28)}
║  Swagger:     http://${HOST}:${PORT}/api-docs${" ".repeat(26)}
║  Health:      http://${HOST}:${PORT}${API_BASE_PATH}/health${" ".repeat(20)}
║  WebSocket:   ws://${HOST}:${PORT}/ws${" ".repeat(30)}
╚═══════════════════════════════════════════════════════════════
      `);
    });
  } catch (error) {
    logger.error("Failed to start server", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info("HTTP server closed");

    // Shutdown WebSocket server (NEW)
    await shutdownWebSocket();

    // Close database pool if configured
    if (isDbConfigured()) {
      await closePool();
    }

    logger.info("Graceful shutdown completed");
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    logger.error("Forced shutdown due to timeout");
    process.exit(1);
  }, 30000);
};

// Only handle SIGINT for manual Ctrl+C
// Let nodemon handle SIGTERM for restarts in development
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// In production, also handle SIGTERM for proper shutdown
if (isProduction) {
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection", { reason: reason?.message || reason });
});
// Start the server
startServer();

module.exports = { app, server };
