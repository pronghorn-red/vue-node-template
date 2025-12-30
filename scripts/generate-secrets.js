#!/usr/bin/env node

/**
 * @fileoverview Secrets Generator Script
 * @description Generates cryptographically secure secrets for the Pronghorn application
 * and optionally updates the .env file with the generated values.
 * 
 * Usage:
 *   node scripts/generate-secrets.js          # Display secrets only
 *   node scripts/generate-secrets.js --write  # Write secrets to .env file
 *   node scripts/generate-secrets.js --help   # Show help
 * 
 * @module scripts/generate-secrets
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const SECRETS_CONFIG = [
  {
    name: 'SESSION_SECRET',
    description: 'Express session secret',
    length: 64
  },
  {
    name: 'JWT_SECRET',
    description: 'JWT signing secret',
    length: 64
  },
  {
    name: 'JWT_REFRESH_SECRET',
    description: 'JWT refresh token secret',
    length: 64
  }
];

/**
 * Generate a cryptographically secure random string
 * @param {number} length - Length of the string in bytes (output will be hex, so 2x chars)
 * @returns {string} Random hex string
 */
const generateSecret = (length = 64) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate all secrets
 * @returns {Object} Object containing all generated secrets
 */
const generateAllSecrets = () => {
  const secrets = {};
  for (const config of SECRETS_CONFIG) {
    secrets[config.name] = generateSecret(config.length);
  }
  return secrets;
};

/**
 * Read the current .env file
 * @param {string} envPath - Path to .env file
 * @returns {string} Content of .env file or empty string
 */
const readEnvFile = (envPath) => {
  try {
    return fs.readFileSync(envPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('⚠️  No .env file found. Creating new one from .env.example...');
      const examplePath = path.join(path.dirname(envPath), '.env.example');
      try {
        return fs.readFileSync(examplePath, 'utf8');
      } catch {
        console.log('⚠️  No .env.example found. Creating minimal .env file...');
        return '';
      }
    }
    throw error;
  }
};

/**
 * Update or add a secret in the .env content
 * @param {string} content - Current .env content
 * @param {string} key - Secret key name
 * @param {string} value - Secret value
 * @returns {string} Updated .env content
 */
const updateEnvSecret = (content, key, value) => {
  // Pattern to match the key with optional value (including empty or commented)
  const patterns = [
    new RegExp(`^${key}=.*$`, 'm'),           // KEY=value
    new RegExp(`^# ${key}=.*$`, 'm'),         // # KEY=value (commented)
    new RegExp(`^${key}=$`, 'm')              // KEY= (empty)
  ];
  
  const newLine = `${key}=${value}`;
  
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      return content.replace(pattern, newLine);
    }
  }
  
  // Key not found, append to the end
  return content + `\n${newLine}`;
};

/**
 * Write secrets to .env file
 * @param {string} envPath - Path to .env file
 * @param {Object} secrets - Object containing secrets to write
 */
const writeSecretsToEnv = (envPath, secrets) => {
  let content = readEnvFile(envPath);
  
  for (const [key, value] of Object.entries(secrets)) {
    content = updateEnvSecret(content, key, value);
  }
  
  fs.writeFileSync(envPath, content, 'utf8');
  console.log(`\n✅ Secrets written to ${envPath}`);
};

/**
 * Display generated secrets
 * @param {Object} secrets - Object containing secrets
 */
const displaySecrets = (secrets) => {
  console.log('\n🔐 Generated Secrets:\n');
  console.log('─'.repeat(80));
  
  for (const config of SECRETS_CONFIG) {
    const value = secrets[config.name];
    console.log(`\n📌 ${config.name}`);
    console.log(`   Description: ${config.description}`);
    console.log(`   Value: ${value}`);
  }
  
  console.log('\n' + '─'.repeat(80));
};

/**
 * Display help message
 */
const displayHelp = () => {
  console.log(`
🦌 Pronghorn Secrets Generator

Usage:
  node scripts/generate-secrets.js [options]

Options:
  --write, -w    Write generated secrets to .env file
  --help, -h     Display this help message
  --force, -f    Overwrite existing secrets (use with --write)

Examples:
  node scripts/generate-secrets.js              # Display secrets only
  node scripts/generate-secrets.js --write      # Write to .env
  node scripts/generate-secrets.js -w -f        # Force overwrite existing

Notes:
  - Secrets are generated using Node.js crypto.randomBytes()
  - Each secret is 128 characters (64 bytes in hex)
  - Without --force, existing non-empty secrets are preserved
`);
};

/**
 * Check if a secret already has a value in .env
 * @param {string} content - .env file content
 * @param {string} key - Secret key name
 * @returns {boolean} True if secret has a non-empty, non-placeholder value
 */
const hasExistingSecret = (content, key) => {
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) return false;
  
  const value = match[1].trim();
  // Check if it's empty or a placeholder
  const placeholders = [
    '',
    'your_super_secret_session_key_change_in_production',
    'your_jwt_secret_key_change_in_production',
    'your_jwt_refresh_secret_key_change_in_production'
  ];
  
  return !placeholders.includes(value);
};

/**
 * Main function
 */
const main = () => {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const showHelp = args.includes('--help') || args.includes('-h');
  const writeToFile = args.includes('--write') || args.includes('-w');
  const forceOverwrite = args.includes('--force') || args.includes('-f');
  
  if (showHelp) {
    displayHelp();
    process.exit(0);
  }
  
  console.log('\n🦌 Pronghorn Secrets Generator v3.0.0\n');
  
  // Generate secrets
  const secrets = generateAllSecrets();
  
  if (writeToFile) {
    const envPath = path.resolve(__dirname, '../.env');
    const content = readEnvFile(envPath);
    
    // Filter secrets based on force flag
    const secretsToWrite = {};
    for (const [key, value] of Object.entries(secrets)) {
      if (forceOverwrite || !hasExistingSecret(content, key)) {
        secretsToWrite[key] = value;
      } else {
        console.log(`⏭️  Skipping ${key} (already has value, use --force to overwrite)`);
      }
    }
    
    if (Object.keys(secretsToWrite).length > 0) {
      writeSecretsToEnv(envPath, secretsToWrite);
      displaySecrets(secretsToWrite);
    } else {
      console.log('\n✅ All secrets already configured. Use --force to regenerate.');
    }
  } else {
    displaySecrets(secrets);
    console.log('\n💡 Run with --write flag to save these secrets to .env file');
    console.log('   Example: node scripts/generate-secrets.js --write\n');
  }
};

// Run main function
main();
