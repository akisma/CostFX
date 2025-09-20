#!/usr/bin/env node

/**
 * Migration Runner Script
 * 
 * This script runs database migrations from within the ECS container
 * where it has network access to the RDS instance in private subnets.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendDir = join(__dirname, '..');

console.log('🔄 Starting database migrations...');
console.log(`📁 Backend directory: ${backendDir}`);

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

console.log(`🔗 Database URL: ${process.env.DATABASE_URL.substring(0, 20)}...`);

// Run migrations
const migrationProcess = spawn('npm', ['run', 'migrate:up'], {
  cwd: backendDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'production'
  }
});

migrationProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Database migrations completed successfully!');
    process.exit(0);
  } else {
    console.error(`❌ Migration process exited with code ${code}`);
    process.exit(code);
  }
});

migrationProcess.on('error', (error) => {
  console.error('❌ Failed to start migration process:', error);
  process.exit(1);
});
