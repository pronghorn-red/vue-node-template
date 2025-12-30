/**
 * @fileoverview Database Seed Script
 * @description Seeds the database with initial data for development and testing.
 * @module database/seed
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const bcrypt = require('bcryptjs');
const { query, closePool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Seed data
 */
const seedData = {
  users: [
    {
      email: 'admin@example.com',
      password: 'Admin123!',
      display_name: 'Admin User',
      role: 'admin'
    },
    {
      email: 'user@example.com',
      password: 'User123!',
      display_name: 'Test User',
      role: 'user'
    }
  ]
};

/**
 * Run database seeding
 * @async
 */
const runSeeds = async () => {
  logger.info('Starting database seeding...');
  
  try {
    // Seed users
    for (const user of seedData.users) {
      const existing = await query('SELECT id FROM users WHERE email = $1', [user.email]);
      
      if (existing.rows.length === 0) {
        const passwordHash = await bcrypt.hash(user.password, 12);
        
        await query(
          `INSERT INTO users (email, password_hash, display_name, role, oauth_provider, email_verified, created_at)
           VALUES ($1, $2, $3, $4, 'local', true, NOW())`,
          [user.email, passwordHash, user.display_name, user.role]
        );
        
        logger.info(`Created user: ${user.email}`);
      } else {
        logger.debug(`User already exists: ${user.email}`);
      }
    }
    
    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Seeding failed', { error: error.message });
    throw error;
  }
};

// Run if executed directly
if (require.main === module) {
  runSeeds()
    .then(() => {
      logger.info('Seed script finished');
      return closePool();
    })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed script failed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { runSeeds };
