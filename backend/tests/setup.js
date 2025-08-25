import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load test environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../../');
dotenv.config({ path: join(rootDir, '.env.test') });

// Fallback to regular .env if .env.test doesn't exist
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: join(rootDir, '.env') });
}

// Override for test database
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/restaurant_ai_test';