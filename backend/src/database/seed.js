/**
 * @fileoverview Database Seed Script
 * @description Seeds the database with initial data for development and testing.
 * 
 * Creates:
 * - superadmin user (full system access)
 * - admin user (user management access)
 * - regular user (standard access)
 * 
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
      email: 'superadmin@example.com',
      password: 'SuperAdmin123!',
      display_name: 'Super Admin',
      role: 'superadmin',
      language_preference: 'en',
      additional_roles: ['system_config'],
      avatar_url: null
    },
    {
      email: 'admin@example.com',
      password: 'Admin123!',
      display_name: 'Admin User',
      role: 'admin',
      language_preference: 'en',
      additional_roles: ['moderator'],
      avatar_url: null
    },
    {
      email: 'user@example.com',
      password: 'User123!',
      display_name: 'Test User',
      role: 'user',
      language_preference: 'en',
      additional_roles: [],
      avatar_url: null
    },
    {
      email: 'user.fr@example.com',
      password: 'User123!',
      display_name: 'Utilisateur Test',
      role: 'user',
      language_preference: 'fr',
      additional_roles: ['beta_tester'],
      avatar_url: null
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
          `INSERT INTO users (
            email, 
            password_hash, 
            display_name, 
            role, 
            language_preference, 
            additional_roles,
            avatar_url,
            oauth_provider, 
            email_verified, 
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'local', true, NOW())`,
          [
            user.email, 
            passwordHash, 
            user.display_name, 
            user.role, 
            user.language_preference,
            JSON.stringify(user.additional_roles),
            user.avatar_url
          ]
        );
        
        logger.info(`Created user: ${user.email} (${user.role})`);
      } else {
        // Update existing user's role and additional_roles if needed
        await query(
          `UPDATE users 
           SET role = $1, 
               additional_roles = $2,
               language_preference = $3
           WHERE email = $4`,
          [
            user.role,
            JSON.stringify(user.additional_roles),
            user.language_preference,
            user.email
          ]
        );
        logger.debug(`User already exists, updated role: ${user.email} (${user.role})`);
      }
    }
    
    // Log summary
    const userCounts = await query(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role 
      ORDER BY 
        CASE role 
          WHEN 'superadmin' THEN 1 
          WHEN 'admin' THEN 2 
          WHEN 'user' THEN 3 
        END
    `);
    
    logger.info('Database seeding completed successfully');
    logger.info('User counts by role:');
    userCounts.rows.forEach(row => {
      logger.info(`  ${row.role}: ${row.count}`);
    });
    
  } catch (error) {
    logger.error('Seeding failed', { error: error.message });
    throw error;
  }
};

/**
 * Reset all user passwords to defaults (development only!)
 * @async
 */
const resetPasswords = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot reset passwords in production!');
  }
  
  logger.warn('Resetting all seed user passwords...');
  
  for (const user of seedData.users) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [passwordHash, user.email]
    );
    logger.info(`Reset password for: ${user.email}`);
  }
};

/**
 * Clear all users except superadmin (development only!)
 * @async
 */
const clearUsers = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot clear users in production!');
  }
  
  logger.warn('Clearing all non-superadmin users...');
  
  const result = await query(
    "DELETE FROM users WHERE role != 'superadmin' RETURNING email"
  );
  
  logger.info(`Deleted ${result.rowCount} users`);
};

// Run if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  let action = runSeeds;
  
  if (args.includes('--reset-passwords')) {
    action = resetPasswords;
  } else if (args.includes('--clear-users')) {
    action = clearUsers;
  }
  
  action()
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

module.exports = { runSeeds, resetPasswords, clearUsers, seedData };