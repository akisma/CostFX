#!/usr/bin/env node

/**
 * Test Database Setup Script
 * 
 * This script ensures the test database is properly created and initialized.
 * It can be run independently or as part of the test setup process.
 */

import { Client } from 'pg';
import logger from '../src/utils/logger.js';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  database: 'postgres' // Connect to default database first
};

const TEST_DB_NAME = 'restaurant_ai_test';

async function createTestDatabase() {
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    logger.info('Connected to PostgreSQL server');

    // Check if test database exists
    const checkDbQuery = `
      SELECT 1 FROM pg_database WHERE datname = $1
    `;
    
    const result = await client.query(checkDbQuery, [TEST_DB_NAME]);
    
    if (result.rows.length === 0) {
      // Create test database
      logger.info(`Creating test database: ${TEST_DB_NAME}`);
      await client.query(`CREATE DATABASE ${TEST_DB_NAME}`);
      logger.info('✅ Test database created successfully');
    } else {
      logger.info('✅ Test database already exists');
    }
    
  } catch (error) {
    logger.error('❌ Error setting up test database:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

async function initializeTestSchema() {
  const testClient = new Client({
    ...DB_CONFIG,
    database: TEST_DB_NAME
  });

  try {
    await testClient.connect();
    logger.info('Connected to test database');

    // Import and initialize Sequelize for test database
    const { default: sequelize } = await import('../src/config/database.js');
    
    // Force sync to create tables (only for test database)
    if (process.env.NODE_ENV === 'test') {
      await sequelize.sync({ force: true });
      logger.info('✅ Test database schema synchronized');
    }
    
  } catch (error) {
    logger.error('❌ Error initializing test schema:', error.message);
    throw error;
  } finally {
    await testClient.end();
  }
}

async function setupTestDatabase() {
  try {
    logger.info('🔧 Setting up test database...');
    
    // Ensure we're in test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = `postgresql://${DB_CONFIG.user}:${DB_CONFIG.password}@${DB_CONFIG.host}:${DB_CONFIG.port}/${TEST_DB_NAME}`;
    
    await createTestDatabase();
    await initializeTestSchema();
    
    logger.info('✅ Test database setup completed successfully');
    return true;
    
  } catch (error) {
    logger.error('❌ Failed to setup test database:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestDatabase();
}

export { setupTestDatabase, createTestDatabase, initializeTestSchema };
