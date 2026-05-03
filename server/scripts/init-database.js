#!/usr/bin/env node

/**
 * Database initialization script
 * Initializes the database schema for ESP32 NFC Cloud Access Control System
 * Supports both SQLite (local deployment) and PostgreSQL (cloud deployment)
 */

const fs = require('fs');
const path = require('path');

// Determine database type from environment variable
const DB_TYPE = process.env.DB_TYPE || 'sqlite';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/access_control.db');
const PG_CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://access_user:password@localhost:5432/access_control';

console.log('===========================================');
console.log('Database Initialization Script');
console.log('ESP32 NFC Cloud Access Control System');
console.log('===========================================');
console.log('');
console.log(`Database Type: ${DB_TYPE.toUpperCase()}`);
console.log('');

/**
 * Initialize SQLite database
 */
async function initSQLite() {
  console.log('Initializing SQLite database...');
  console.log(`Database path: ${DB_PATH}`);
  
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`✓ Created data directory: ${dataDir}`);
    }
    
    // Read SQL schema file
    const schemaPath = path.join(__dirname, '../database/schema.sqlite.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Import sqlite3 dynamically
    const sqlite3 = require('sqlite3').verbose();
    
    // Create database connection
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('✗ Failed to connect to database:', err.message);
        process.exit(1);
      }
      console.log('✓ Connected to SQLite database');
    });
    
    // Execute schema
    return new Promise((resolve, reject) => {
      db.exec(schema, (err) => {
        if (err) {
          console.error('✗ Failed to execute schema:', err.message);
          db.close();
          reject(err);
          return;
        }
        
        console.log('✓ Database schema created successfully');
        console.log('✓ Tables created: cards, devices, access_logs, admins');
        console.log('✓ Indexes created for query optimization');
        console.log('✓ Default admin account inserted (username: admin, password: admin123)');
        console.log('✓ Sample data inserted for testing');
        
        db.close((err) => {
          if (err) {
            console.error('✗ Error closing database:', err.message);
            reject(err);
          } else {
            console.log('✓ Database connection closed');
            resolve();
          }
        });
      });
    });
  } catch (error) {
    console.error('✗ Error during SQLite initialization:', error.message);
    throw error;
  }
}

/**
 * Initialize PostgreSQL database
 */
async function initPostgreSQL() {
  console.log('Initializing PostgreSQL database...');
  console.log(`Connection string: ${PG_CONNECTION_STRING.replace(/:[^:@]+@/, ':****@')}`);
  
  try {
    // Read SQL schema file
    const schemaPath = path.join(__dirname, '../database/schema.postgresql.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Import pg dynamically
    const { Client } = require('pg');
    
    // Create database connection
    const client = new Client({
      connectionString: PG_CONNECTION_STRING,
    });
    
    await client.connect();
    console.log('✓ Connected to PostgreSQL database');
    
    // Execute schema
    await client.query(schema);
    
    console.log('✓ Database schema created successfully');
    console.log('✓ Tables created: cards, devices, access_logs, admins');
    console.log('✓ Indexes created for query optimization');
    console.log('✓ Triggers created for automatic timestamp updates');
    console.log('✓ Views created for simplified queries');
    console.log('✓ Default admin account inserted (username: admin, password: admin123)');
    console.log('✓ Sample data inserted for testing');
    
    await client.end();
    console.log('✓ Database connection closed');
  } catch (error) {
    console.error('✗ Error during PostgreSQL initialization:', error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    if (DB_TYPE.toLowerCase() === 'postgresql' || DB_TYPE.toLowerCase() === 'postgres') {
      await initPostgreSQL();
    } else if (DB_TYPE.toLowerCase() === 'sqlite') {
      await initSQLite();
    } else {
      console.error(`✗ Unsupported database type: ${DB_TYPE}`);
      console.error('  Supported types: sqlite, postgresql');
      process.exit(1);
    }
    
    console.log('');
    console.log('===========================================');
    console.log('Database initialization completed successfully!');
    console.log('===========================================');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Start the server: npm start');
    console.log('  2. Access the admin panel: http://localhost:3000');
    console.log('  3. Login with username: admin, password: admin123');
    console.log('  4. Change the default admin password immediately!');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('===========================================');
    console.error('Database initialization failed!');
    console.error('===========================================');
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  1. Check database connection settings');
    console.error('  2. Ensure database server is running');
    console.error('  3. Verify database user permissions');
    console.error('  4. Check the error message above for details');
    console.error('');
    process.exit(1);
  }
}

// Run the script
main();
