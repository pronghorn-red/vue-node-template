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
    for (const migration of migrations) {
      if (!executedNames.has(migration.name)) {
        logger.info(`Running migration: ${migration.name}`);
        
        await query(migration.up);
        await query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
        
        logger.info(`Migration completed: ${migration.name}`);
      } else {
        logger.debug(`Migration already executed: ${migration.name}`);
      }
    }
    
    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    throw error;
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

module.exports = { runMigrations };
