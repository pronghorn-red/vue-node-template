/**
 * @fileoverview Database Migration Script
 * @description Creates the required database tables for the Pronghorn application.
 * @module database/migrate
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { pool, query, closePool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Database schema migrations
 */
const migrations = [
  {
    name: 'create_users_table',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        display_name VARCHAR(100) NOT NULL,
        oauth_provider VARCHAR(50) DEFAULT 'local',
        oauth_id VARCHAR(255),
        email_verified BOOLEAN DEFAULT false,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login TIMESTAMP WITH TIME ZONE,
        CONSTRAINT unique_oauth UNIQUE (oauth_provider, oauth_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);
    `
  },
  {
    name: 'create_sessions_table',
    up: `
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" VARCHAR NOT NULL COLLATE "default",
        "sess" JSON NOT NULL,
        "expire" TIMESTAMP(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `
  },
  {
    name: 'create_refresh_tokens_table',
    up: `
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        revoked_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT unique_token_hash UNIQUE (token_hash)
      );
      
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
    `
  },
  {
    name: 'create_conversations_table',
    up: `
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255),
        provider VARCHAR(50) NOT NULL,
        model VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
    `
  },
  {
    name: 'create_messages_table',
    up: `
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        tokens_used INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    `
  },
  {
    name: 'create_migrations_table',
    up: `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  {
    name: 'create_websocket_connections_table',
    up: `
      -- WebSocket Connections Tracking Table
      -- Tracks all WebSocket connections for monitoring, analytics, and admin control
      
      CREATE TABLE IF NOT EXISTS websocket_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        connection_id VARCHAR(64) UNIQUE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        ip_address INET,
        user_agent TEXT,
        connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        disconnected_at TIMESTAMPTZ,
        last_activity_at TIMESTAMPTZ DEFAULT NOW(),
        message_count INTEGER NOT NULL DEFAULT 0,
        is_authenticated BOOLEAN NOT NULL DEFAULT FALSE,
        is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
        blocked_reason TEXT,
        blocked_at TIMESTAMPTZ,
        blocked_by UUID REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      
      -- Indexes for common queries
      CREATE INDEX IF NOT EXISTS idx_ws_connections_user_id 
        ON websocket_connections(user_id);
      
      CREATE INDEX IF NOT EXISTS idx_ws_connections_active 
        ON websocket_connections(disconnected_at) 
        WHERE disconnected_at IS NULL;
      
      CREATE INDEX IF NOT EXISTS idx_ws_connections_blocked 
        ON websocket_connections(is_blocked) 
        WHERE is_blocked = TRUE;
      
      CREATE INDEX IF NOT EXISTS idx_ws_connections_ip 
        ON websocket_connections(ip_address);
      
      CREATE INDEX IF NOT EXISTS idx_ws_connections_connected_at 
        ON websocket_connections(connected_at);
    `
  },
  {
    name: 'create_websocket_triggers',
    up: `
      -- Auto-update updated_at timestamp
      CREATE OR REPLACE FUNCTION update_ws_connection_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS ws_connection_updated_at ON websocket_connections;
      CREATE TRIGGER ws_connection_updated_at
        BEFORE UPDATE ON websocket_connections
        FOR EACH ROW
        EXECUTE FUNCTION update_ws_connection_timestamp();
      
      -- Auto-set blocked_at when is_blocked changes to true
      CREATE OR REPLACE FUNCTION set_ws_connection_blocked_at()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.is_blocked = TRUE AND (OLD.is_blocked IS NULL OR OLD.is_blocked = FALSE) THEN
          NEW.blocked_at = NOW();
        ELSIF NEW.is_blocked = FALSE THEN
          NEW.blocked_at = NULL;
          NEW.blocked_reason = NULL;
          NEW.blocked_by = NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS ws_connection_blocked_at ON websocket_connections;
      CREATE TRIGGER ws_connection_blocked_at
        BEFORE UPDATE ON websocket_connections
        FOR EACH ROW
        EXECUTE FUNCTION set_ws_connection_blocked_at();
    `
  },
  {
    name: 'create_websocket_views',
    up: `
      -- View for currently active connections
      CREATE OR REPLACE VIEW active_websocket_connections AS
      SELECT 
        wc.id,
        wc.connection_id,
        wc.user_id,
        u.email AS user_email,
        u.display_name AS user_display_name,
        wc.ip_address,
        wc.connected_at,
        wc.last_activity_at,
        wc.message_count,
        wc.is_authenticated,
        wc.is_blocked,
        EXTRACT(EPOCH FROM (NOW() - wc.connected_at)) AS connection_duration_seconds
      FROM websocket_connections wc
      LEFT JOIN users u ON wc.user_id = u.id
      WHERE wc.disconnected_at IS NULL;
      
      -- View for connection statistics
      CREATE OR REPLACE VIEW websocket_connection_stats AS
      SELECT 
        COUNT(*) FILTER (WHERE disconnected_at IS NULL) AS active_connections,
        COUNT(*) FILTER (WHERE disconnected_at IS NULL AND is_authenticated) AS authenticated_connections,
        COUNT(*) FILTER (WHERE disconnected_at IS NULL AND NOT is_authenticated) AS anonymous_connections,
        COUNT(*) FILTER (WHERE is_blocked) AS blocked_connections,
        COUNT(*) AS total_connections_all_time,
        COALESCE(AVG(message_count), 0) AS avg_messages_per_connection,
        COALESCE(MAX(message_count), 0) AS max_messages_per_connection,
        COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(disconnected_at, NOW()) - connected_at))), 0) AS avg_connection_duration_seconds
      FROM websocket_connections;
    `
  },
  {
    name: 'create_websocket_cleanup_function',
    up: `
      -- Function to clean up old disconnected connections (for maintenance)
      CREATE OR REPLACE FUNCTION cleanup_old_websocket_connections(days_to_keep INTEGER DEFAULT 30)
      RETURNS INTEGER AS $$
      DECLARE
        deleted_count INTEGER;
      BEGIN
        DELETE FROM websocket_connections
        WHERE disconnected_at IS NOT NULL 
          AND disconnected_at < NOW() - (days_to_keep || ' days')::INTERVAL;
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
      END;
      $$ LANGUAGE plpgsql;
      
      -- Usage: SELECT cleanup_old_websocket_connections(30);
    `
  }
];

/**
 * Run database migrations
 * @async
 */
const runMigrations = async () => {
  logger.info('Starting database migrations...');
  
  try {
    // Ensure migrations table exists
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Get executed migrations
    const executed = await query('SELECT name FROM migrations');
    const executedNames = new Set(executed.rows.map(r => r.name));
    
    // Run pending migrations
    let migrationsRun = 0;
    for (const migration of migrations) {
      if (!executedNames.has(migration.name)) {
        logger.info(`Running migration: ${migration.name}`);
        
        await query(migration.up);
        await query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
        
        logger.info(`Migration completed: ${migration.name}`);
        migrationsRun++;
      } else {
        logger.debug(`Migration already executed: ${migration.name}`);
      }
    }
    
    if (migrationsRun === 0) {
      logger.info('No new migrations to run - database is up to date');
    } else {
      logger.info(`All migrations completed successfully (${migrationsRun} new migrations)`);
    }
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    throw error;
  }
};

/**
 * Get migration status
 * @async
 * @returns {Object} Migration status
 */
const getMigrationStatus = async () => {
  try {
    const executed = await query('SELECT name, executed_at FROM migrations ORDER BY executed_at');
    const executedNames = new Set(executed.rows.map(r => r.name));
    
    const status = {
      executed: executed.rows,
      pending: migrations.filter(m => !executedNames.has(m.name)).map(m => m.name),
      total: migrations.length,
      executedCount: executed.rows.length,
      pendingCount: migrations.filter(m => !executedNames.has(m.name)).length
    };
    
    return status;
  } catch (error) {
    // If migrations table doesn't exist, all migrations are pending
    return {
      executed: [],
      pending: migrations.map(m => m.name),
      total: migrations.length,
      executedCount: 0,
      pendingCount: migrations.length
    };
  }
};

// Run if executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration script finished');
      return closePool();
    })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { runMigrations, getMigrationStatus, migrations };