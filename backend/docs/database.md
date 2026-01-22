# Database

## What it is

The template uses PostgreSQL as the primary database with a resilient connection system that allows the application to run even when the database is not configured. The database module provides connection pooling, query helpers, transaction support, and an optional database mode that gracefully degrades when PostgreSQL is unavailable.

## Where it lives (code map)

- **`backend/src/config/database.js`** - Connection pooling, query helpers, transaction support, connection string parsing
- **`backend/src/database/migrate.js`** - Migration system and schema definitions
- **`backend/src/database/seed.js`** - Seed data for development/testing
- **`backend/src/server.js`** - Database initialization on server startup

## How it works

### Connection Strategy

The database module supports two configuration methods:

1. **Connection String** (Priority 1):
   ```bash
   DB_CONNECTION_STRING=postgresql://user:password@host:port/database?sslmode=require
   ```

2. **Individual Parameters** (Priority 2):
   ```bash
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=pronghorn
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_SSL=true
   ```

### Connection Pooling

The template uses `pg` (node-postgres) with connection pooling:

- **Default pool size**: 2-20 connections
- **Idle timeout**: 30 seconds
- **Connection timeout**: 5 seconds
- **Configurable via environment variables**

### Optional Database Mode

The application is designed to run without a database:

- If database is not configured, the app starts successfully
- Database-dependent features are disabled gracefully
- Logs indicate when database is unavailable
- No errors thrown during startup

### Migration System

Migrations are defined in `backend/src/database/migrate.js` and tracked in a `migrations` table:

- Each migration has a unique name
- Migrations run in order
- Already-executed migrations are skipped
- Migrations are idempotent (use `IF NOT EXISTS`)

## How to use it

### Basic Query

```javascript
const { query } = require('./config/database');

// Simple query
const result = await query('SELECT * FROM users WHERE email = $1', ['user@example.com']);
console.log(result.rows);

// Insert
const insertResult = await query(
  'INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING *',
  ['user@example.com', 'John Doe']
);
console.log(insertResult.rows[0]);
```

### Transaction

```javascript
const { transaction } = require('./config/database');

await transaction(async (client) => {
  await client.query('INSERT INTO users (email) VALUES ($1)', ['user1@example.com']);
  await client.query('INSERT INTO users (email) VALUES ($2)', ['user2@example.com']);
  // If any query fails, entire transaction rolls back
});
```

### Get Client for Manual Transactions

```javascript
const { getClient } = require('./config/database');

const client = await getClient();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO users ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### Check Database Status

```javascript
const { isDbConfigured, isDbConnected, testConnection } = require('./config/database');

// Check if database is configured (not necessarily connected)
if (isDbConfigured()) {
  console.log('Database is configured');
}

// Test actual connection
const connected = await testConnection();
if (connected) {
  console.log('Database is connected');
}
```

### Run Migrations

```bash
# Run all pending migrations
node backend/src/database/migrate.js

# Or programmatically
const { runMigrations } = require('./database/migrate');
await runMigrations();
```

### Seed Database

```bash
# Seed with default test users
node backend/src/database/seed.js

# Reset all seed user passwords
node backend/src/database/seed.js --reset-passwords

# Clear all non-superadmin users (dev only)
node backend/src/database/seed.js --clear-users
```

## Configuration

### Environment Variables

```bash
# Connection String (takes precedence)
DB_CONNECTION_STRING=postgresql://user:password@host:port/database?sslmode=require

# OR Individual Parameters
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pronghorn
DB_USER=postgres
DB_PASSWORD=your_secure_password_here
DB_SSL=true  # or false

# Connection Pool Settings (optional)
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000      # milliseconds
DB_POOL_CONNECTION_TIMEOUT=5000  # milliseconds
```

### Connection String Format

```
postgresql://[user[:password]@][host][:port][/database][?param1=value1&...]
```

**SSL Modes**:
- `sslmode=require` - Require SSL (default for `DB_SSL=true`)
- `sslmode=verify-ca` - Verify CA certificate
- `sslmode=verify-full` - Verify CA and hostname

### Database Schema

The migration system creates the following tables:

- **`users`** - User accounts with authentication info
- **`session`** - Express session storage (if using PostgreSQL sessions)
- **`refresh_tokens`** - Refresh token tracking (optional)
- **`conversations`** - LLM conversation history
- **`messages`** - LLM message history
- **`websocket_connections`** - WebSocket connection tracking
- **`migrations`** - Migration tracking
- **`password_reset_requests`** - Password reset audit
- **`user_audit_log`** - User action audit trail

See `backend/src/database/migrate.js` for complete schema definitions.

## Extending / modifying

### Adding a New Migration

Edit `backend/src/database/migrate.js`:

```javascript
const migrations = [
  // ... existing migrations
  {
    name: 'add_custom_field',
    up: `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS custom_field VARCHAR(255);
      
      CREATE INDEX IF NOT EXISTS idx_users_custom_field 
      ON users(custom_field);
    `
  }
];
```

Run migrations:
```bash
node backend/src/database/migrate.js
```

### Custom Query Helpers

Add to `backend/src/config/database.js`:

```javascript
/**
 * Get users by role
 * @param {string} role - Role name
 * @returns {Promise<Array>} Users
 */
const getUsersByRole = async (role) => {
  const result = await query(
    'SELECT * FROM users WHERE role = $1',
    [role]
  );
  return result.rows;
};

module.exports = {
  // ... existing exports
  getUsersByRole
};
```

### Custom Seed Data

Edit `backend/src/database/seed.js`:

```javascript
const seedData = {
  users: [
    // ... existing users
    {
      email: 'custom@example.com',
      password: 'CustomPass123!',
      display_name: 'Custom User',
      role: 'user'
    }
  ],
  // Add new seed data types
  customTable: [
    { field1: 'value1', field2: 'value2' }
  ]
};
```

## Troubleshooting

### "Database not configured" errors

- **Check environment variables**: Ensure `DB_CONNECTION_STRING` or `DB_HOST`/`DB_PASSWORD` are set
- **Check placeholder values**: Remove any `your_` placeholders from `.env`
- **Check connection string format**: Must start with `postgresql://`
- **Check password**: Empty passwords are not valid

### Connection timeout errors

- **Check PostgreSQL is running**: `pg_isready` or `psql -h localhost`
- **Check network**: Firewall rules, VPN, etc.
- **Check credentials**: Username, password, database name
- **Check port**: Default is 5432, may be different
- **Check SSL**: If `DB_SSL=true`, ensure SSL is configured on PostgreSQL

### Pool exhaustion errors

- **Increase pool size**: Set `DB_POOL_MAX` to a higher value
- **Check for connection leaks**: Ensure all clients are released
- **Check idle timeout**: Reduce `DB_POOL_IDLE_TIMEOUT` to release idle connections faster
- **Check long-running queries**: Optimize slow queries

### Migration errors

- **Check PostgreSQL version**: Some features require specific versions
- **Check permissions**: User must have CREATE TABLE, CREATE INDEX permissions
- **Check existing schema**: Migrations use `IF NOT EXISTS` but conflicts can occur
- **Check migration order**: Migrations run in array order

### SSL connection errors

- **Check SSL mode**: Use `sslmode=require` for basic SSL
- **Check certificates**: For `verify-ca` or `verify-full`, ensure certificates are valid
- **Check PostgreSQL SSL config**: Ensure `ssl = on` in `postgresql.conf`
- **Check connection string**: SSL params in connection string override `DB_SSL`

## Security considerations

1. **Connection String Security**:
   - Never commit connection strings with passwords to version control
   - Use environment variables or secret management
   - Rotate database passwords regularly

2. **SQL Injection Prevention**:
   - Always use parameterized queries (`$1`, `$2`, etc.)
   - Never concatenate user input into SQL strings
   - Use the `query()` helper which automatically parameterizes

3. **Connection Pooling**:
   - Limit pool size to prevent resource exhaustion
   - Monitor pool statistics via `getPoolStats()`
   - Set appropriate timeouts

4. **SSL/TLS**:
   - Always use SSL in production (`DB_SSL=true` or `sslmode=require`)
   - Use `verify-full` for maximum security (requires CA certificates)

5. **Database Permissions**:
   - Use least-privilege principle for database user
   - Separate read/write users if needed
   - Regularly audit database access

## Related docs

- [Authentication](./authentication.md) - User table usage
- [User Management](./user-management.md) - User CRUD operations
- [WebSockets](./websockets.md) - WebSocket connection tracking
- [Migrations](../src/database/migrate.js) - Complete migration definitions
