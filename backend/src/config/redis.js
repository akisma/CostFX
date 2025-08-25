import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from 'redis';
import logger from '../utils/logger.js';

// Load .env from the root directory (parent of backend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../../');
dotenv.config({ path: join(rootDir, '.env') });

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  logger.info('✅ Redis connection established');
});

redis.on('ready', () => {
  logger.info('📡 Redis client ready');
});

export async function connectRedis() {
  try {
    await redis.connect();
  } catch (error) {
    logger.error('❌ Unable to connect to Redis:', error);
    throw error;
  }
}

export { redis };
export default redis;