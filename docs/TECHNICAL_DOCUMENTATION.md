# CostFX Technical Documentation

*Complete technical reference for the Restaurant Operations AI System*

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Reference](#architecture-reference)
3. [Implementation Guides](#implementation-guides)
4. [Technical Solutions](#technical-solutions)
5. [Development Environment](#development-environment)
6. [Deployment Guide](#deployment-guide)
7. [Troubleshooting](#troubleshooting)

---

## System Overview

### Project Description
CostFX is a multi-agent AI system that automates restaurant operations to reduce human error while maintaining manual override capabilities. The system emphasizes natural language interfaces for recipe management, automated invoice processing, intelligent ordering recommendations, and waste tracking.

### Architecture Components
- **Backend**: Node.js/Express with PostgreSQL
- **Frontend**: React/Vite with Redux Toolkit  
- **AI Agents**: Multi-agent system with specialized capabilities
- **Infrastructure**: AWS ECS with Terraform
- **Containerization**: Docker with separate frontend/backend containers

### Current Implementation Status
- ✅ **Forecast Agent**: Complete with sales, revenue, and labor forecasting
- ✅ **Inventory Agent**: Active with optimization and supplier analysis
- ✅ **Cost Agent**: Active with recipe costing and margin analysis
- ✅ **Backend Infrastructure**: Express.js API with agent orchestration
- ✅ **Frontend Dashboard**: React with Redux state management
- ✅ **Database**: PostgreSQL with Sequelize ORM
- ✅ **Testing**: Comprehensive test suites with 100% pass rates

---

## Architecture Reference

### High-Level System Architecture
```
Frontend (React Dashboard with Forecast Intelligence)
    ↓
Express.js API Server
    ↓
Agent Orchestrator (AgentManager + AgentService)
    ↓
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Inventory Agent │ Cost Agent      │ Forecast Agent  │ Recipe Agent    │
│   ✅ ACTIVE     │   ✅ ACTIVE     │  ✅ COMPLETE    │  📋 PLANNED     │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
    ↓
PostgreSQL Database + Redis Cache
```

### AI Agent System

#### BaseAgent Class
**Location**: `backend/src/agents/BaseAgent.js`

Foundation class that all specialized agents inherit from:

```javascript
class BaseAgent {
  constructor(name, capabilities = []) {
    this.name = name;
    this.capabilities = capabilities;
    this.status = 'active';
    this.metrics = {
      requests: 0,
      successRate: 100,
      avgResponseTime: 0
    };
  }

  async process(request) {
    // Abstract method - must be implemented by subclasses
    throw new Error('process method must be implemented by subclass');
  }
}
```

#### Implemented Agents

**CostAgent** (`backend/src/agents/CostAgent.js`)
- Recipe cost calculation and analysis
- Profit margin optimization
- Cost trend monitoring
- Supplier price comparison

**InventoryAgent** (`backend/src/agents/InventoryAgent.js`)
- Inventory level optimization
- Supplier analysis and recommendations
- Stock level alerts
- Purchase order suggestions

**ForecastAgent** (`backend/src/agents/ForecastAgent.js`)
- Demand forecasting with time series analysis
- Seasonal trend analysis
- Revenue prediction with multiple scenarios
- Labor optimization and scheduling

### Database Schema

#### Core Models
- **Restaurant**: Main restaurant entity
- **InventoryItem**: Menu items and ingredients
- **InventoryTransaction**: Stock movements and transactions
- **Supplier**: Vendor information and relationships

#### Key Relationships
- Restaurant → InventoryItems (1:many)
- InventoryItem → InventoryTransactions (1:many)
- Supplier → InventoryItems (many:many)

### API Structure

#### Agent Endpoints
- `GET /api/v1/agents/status` - Agent system status
- `POST /api/v1/agents/cost/analyze` - Cost analysis
- `POST /api/v1/agents/inventory/optimize` - Inventory optimization
- `POST /api/v1/agents/forecast/demand` - Demand forecasting
- `POST /api/v1/agents/forecast/revenue` - Revenue prediction

#### Resource Endpoints
- `/api/v1/restaurants` - Restaurant management
- `/api/v1/inventory` - Inventory operations
- `/api/v1/ingredients` - Ingredient catalog
- `/api/v1/recipes` - Recipe management

---

## Implementation Guides

### Setting Up Development Environment

#### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for caching)
- Docker (for containerization)

#### Quick Start
```bash
# Clone and install dependencies
git clone <repository>
cd CostFX
npm install

# Set up workspace (installs all dependencies)
npm run setup:workspace

# Start development environment
npm run dev
```

#### Environment Configuration
Create `.env` files in both `backend/` and `frontend/` directories:

**Backend `.env`:**
```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/costfx_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_NODE_ENV=development
```

### Adding New AI Agents

#### Step 1: Create Agent Class
```javascript
// backend/src/agents/NewAgent.js
import BaseAgent from './BaseAgent.js';

export default class NewAgent extends BaseAgent {
  constructor() {
    super('NewAgent', ['capability1', 'capability2']);
  }

  async process(request) {
    // Implementation logic
    return {
      success: true,
      data: result,
      metadata: {
        processingTime: Date.now() - startTime,
        confidence: 0.95
      }
    };
  }
}
```

#### Step 2: Register in AgentManager
```javascript
// backend/src/agents/AgentManager.js
import NewAgent from './NewAgent.js';

export default class AgentManager {
  constructor() {
    this.agents = new Map([
      ['cost', new CostAgent()],
      ['inventory', new InventoryAgent()],
      ['forecast', new ForecastAgent()],
      ['new', new NewAgent()] // Add here
    ]);
  }
}
```

#### Step 3: Add Service Methods
```javascript
// backend/src/agents/AgentService.js
export default class AgentService {
  static async processNewRequest(data) {
    return await this.processAgentRequest('new', 'process', data);
  }
}
```

#### Step 4: Create API Routes
```javascript
// backend/src/routes/agents.js
router.post('/new/process', async (req, res, next) => {
  try {
    const result = await AgentService.processNewRequest(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

### Testing Implementation

#### Test Structure
```
backend/tests/
├── setup.js              # Test configuration
├── fixtures/              # Test data
├── unit/                  # Unit tests
│   ├── agents/           # Agent-specific tests
│   ├── models/           # Model tests
│   └── services/         # Service tests
└── integration/          # Integration tests
    └── api/              # API endpoint tests
```

#### Writing Agent Tests
```javascript
// backend/tests/unit/agents/NewAgent.test.js
import NewAgent from '../../../src/agents/NewAgent.js';

describe('NewAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new NewAgent();
  });

  test('should process request successfully', async () => {
    const testData = { /* test data */ };
    const result = await agent.process(testData);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.metadata.confidence).toBeGreaterThan(0);
  });
});
```

### Database Migrations

#### Creating Migrations
```bash
# Create new migration
npx sequelize-cli migration:generate --name create-new-table

# Run migrations
npm run migrate

# Rollback migration
npm run migrate:rollback
```

#### Migration Template
```javascript
// backend/src/migrations/YYYYMMDD-create-new-table.js
export const up = async (queryInterface, Sequelize) => {
  await queryInterface.createTable('NewTable', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false
    },
    createdAt: {
      allowNull: false,
      type: Sequelize.DATE
    },
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE
    }
  });
};

export const down = async (queryInterface, Sequelize) => {
  await queryInterface.dropTable('NewTable');
};
```

---

## Technical Solutions

### ES Modules + Jest Configuration

**Problem**: Jest doesn't natively support ES modules, causing failures with modern JavaScript imports.

**Solution**: Configure Jest with Babel transformation:

```javascript
// backend/jest.config.js
export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
```

### Docker Multi-Stage Builds

**Problem**: Large Docker images with unnecessary development dependencies.

**Solution**: Multi-stage builds for optimized production containers:

```dockerfile
# Dockerfile.backend
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS development
RUN npm ci
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]

FROM base AS production
RUN npm ci --only=production && npm cache clean --force
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Database Connection Pooling

**Problem**: Database connection limits in production.

**Solution**: Configured connection pooling:

```javascript
// backend/src/config/database.js
const config = {
  development: {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  production: {
    dialect: 'postgres',
    host: process.env.DB_HOST,
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000
    }
  }
};
```

### Error Handling Patterns

**Centralized Error Handler**:
```javascript
// backend/src/middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
  const { statusCode = 500, message } = err;
  
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
```

---

## Development Environment

### NPM Workspace Configuration

The project uses NPM workspaces for managing the monorepo structure:

```json
// package.json (root)
{
  "name": "costfx",
  "workspaces": [
    "backend",
    "frontend", 
    "shared"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace=backend\" \"npm run dev --workspace=frontend\"",
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "lint": "npm run lint --workspaces"
  }
}
```

### Development Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start both backend and frontend development servers |
| `npm run build` | Build both applications for production |
| `npm run test` | Run all test suites |
| `npm run lint` | Run ESLint across all workspaces |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed database with test data |

### Hot Reload Configuration

**Backend** (using nodemon):
```json
// backend/nodemon.json
{
  "watch": ["src"],
  "ext": "js,json",
  "ignore": ["tests/**/*"],
  "exec": "node src/index.js"
}
```

**Frontend** (using Vite):
```javascript
// frontend/vite.config.js
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
```

---

## Deployment Guide

### Deployment Strategy Overview

CostFX uses a **two-workflow deployment strategy** that separates application deployments from infrastructure changes:

1. **App Deployment** (`.github/workflows/app-deploy.yml`): Fast ECS-only updates for frontend/backend code changes
2. **Infrastructure Deployment** (`.github/workflows/infrastructure-deploy.yml`): Manual Terraform deployments for infrastructure changes

This separation provides:
- ⚡ **Fast app deployments** (~3-5 minutes vs ~15-20 minutes)
- 💰 **Cost optimization** by avoiding unnecessary Terraform runs
- 🔒 **Infrastructure stability** with controlled manual deployments
- 🎯 **Focused workflows** with clear separation of concerns

### Application Deployment Workflow

**Triggers**: Automatically runs on push to `main`/`develop` when these paths change:
- `frontend/**`
- `backend/**` 
- `shared/**`
- `.env*` files
- `package.json`
- `deploy/docker/**`

**Process**:
1. **Smart Detection**: Only builds/deploys changed components (frontend or backend)
2. **Application Tests**: Runs Jest (backend) and Vitest (frontend) tests with PostgreSQL/Redis services
3. **Linting Checks**: ESLint validation (warnings allowed, errors block deployment)
4. **Docker Testing**: Tests container builds for changed components
5. **ECR Push**: Builds and pushes new container images with git SHA tags (only if tests pass)
6. **ECS Deployment**: Uses `aws-actions/amazon-ecs-deploy-task-definition` for fast updates
7. **Health Checks**: Validates deployment success with endpoint testing

**Test Requirements**:
- ✅ **Application tests MUST pass** - Jest (backend) and Vitest (frontend) with full database setup
- ⚠️ **Linting warnings allowed** - ESLint runs but warnings don't block deployment
- 🐳 **Docker builds must succeed** - Container builds tested before push

**Example Usage**:
```bash
# Automatic deployment when you push code changes
git add frontend/src/components/NewComponent.jsx
git commit -m "Add new dashboard component"
git push origin main  # Triggers app-deploy.yml automatically
```

### Infrastructure Deployment Workflow

**Triggers**: Manual only via GitHub Actions `workflow_dispatch`

**Use Cases**:
- Infrastructure changes (VPC, security groups, load balancers)
- Database schema migrations requiring downtime
- New AWS services or major configuration changes
- SSL certificate updates
- Terraform state management

**Process**:
1. **Manual Trigger**: Navigate to GitHub Actions → "CostFX Infrastructure Deploy" → "Run workflow"
2. **Environment Selection**: Choose dev/prod environment
3. **Application Tests**: Full test suite validation (Jest + Vitest with databases)
4. **Docker Testing**: Complete container build validation
5. **Full Terraform Run**: Plan and apply infrastructure changes
6. **Container Updates**: Optionally updates containers with latest images
7. **Complete Health Check**: Full system validation

**Test Requirements**:
- ✅ **All tests must pass** - Complete backend and frontend test suites
- ⚠️ **Linting warnings allowed** - Full codebase linting with warnings permitted
- 🐳 **All Docker builds validated** - Both frontend and backend containers tested

**Example Usage**:
```bash
# For infrastructure changes, use manual deployment
# 1. Make infrastructure changes in deploy/terraform/
# 2. Go to GitHub Actions → "CostFX Infrastructure Deploy (Manual)"
# 3. Click "Run workflow" → Select environment → Run
```

### Local Development Commands

```bash
# Run all tests (same as GitHub Actions)
npm test                    # Runs both backend and frontend tests
npm run test:backend       # Backend Jest tests with PostgreSQL
npm run test:frontend      # Frontend Vitest tests

# Run linting 
npm run lint               # Lint both backend and frontend
npm run lint:backend       # ESLint backend code
npm run lint:frontend      # ESLint frontend code

# Test containers locally (same as GitHub Actions)
docker build -f deploy/docker/Dockerfile.backend --target test .
docker build -f deploy/docker/Dockerfile.frontend --target test .

# Build production containers
docker build -f deploy/docker/Dockerfile.backend --target production .
docker build -f deploy/docker/Dockerfile.frontend --target production .

# Manual infrastructure deployment (emergency)
./deploy/scripts/deploy.sh
```

### Test Environment Requirements

**Backend Tests** (Jest):
- PostgreSQL database (uses `costfx_test` database)
- Redis instance for caching tests
- Environment variables: `NODE_ENV=test`, `DATABASE_URL`, `REDIS_URL`
- JWT and OpenAI test keys for agent testing

**Frontend Tests** (Vitest):
- Unit tests for React components
- Redux store testing
- API integration mocking
- UI component rendering validation

**Deployment Rules**:
- 🚫 **Tests failing = No deployment** - All tests must pass green
- ⚠️ **Linting warnings = Deployment continues** - Warnings logged but don't block
- 🔴 **Linting errors = No deployment** - Hard errors block deployment
- 🐳 **Docker build failure = No deployment** - Container builds must succeed

### AWS ECS Infrastructure

The application deploys to AWS using ECS Fargate with the following components:

#### Infrastructure Components
- **ECS Cluster**: `costfx-dev` with Fargate tasks for frontend and backend
- **ECS Services**: `costfx-dev-backend` and `costfx-dev-frontend`
- **Load Balancer**: ALB with `/api/*` → backend, `/*` → frontend routing
- **Databases**: RDS PostgreSQL and ElastiCache Redis (managed)
- **Container Registry**: ECR repositories `costfx-dev-backend` and `costfx-dev-frontend`
- **Networking**: VPC with public/private subnets and NAT gateways
- **Security**: Security groups and IAM roles with least privilege

#### Environment Variables

**Backend Production Environment**:
- `NODE_ENV=production`
- `PORT=5000`
- `DATABASE_URL` (from SSM Parameter Store)
- `REDIS_URL` (from SSM Parameter Store)
- `JWT_SECRET` (from SSM Parameter Store)
- `OPENAI_API_KEY` (from SSM Parameter Store)

**SSM Parameter Configuration**:
The application uses AWS Systems Manager (SSM) Parameter Store for secure configuration management:

```bash
# Current SSM Parameters (stored securely)
/costfx/dev/backend_api_url      # Backend API URL for frontend
/costfx/dev/database_url         # PostgreSQL connection string
/costfx/dev/jwt_secret          # JWT signing secret
/costfx/dev/openai_api_key      # OpenAI API key for AI agents
/costfx/dev/ssl_certificate_arn # SSL certificate ARN for HTTPS
```

**GitHub Actions Integration**:
The new app deployment workflow automatically updates SSM parameters and uses intelligent path filtering:

```yaml
# App deployment only triggers on relevant changes
on:
  push:
    paths:
      - 'frontend/**'      # Frontend code changes
      - 'backend/**'       # Backend code changes  
      - 'shared/**'        # Shared utilities
      - '.env*'            # Environment files
      - 'deploy/docker/**' # Docker configurations

# Smart component detection and building
- name: Check for app changes
  uses: dorny/paths-filter@v2
  id: changes
  with:
    filters: |
      backend:
        - 'backend/**'
        - 'shared/**'
        - 'deploy/docker/Dockerfile.backend'
      frontend:
        - 'frontend/**'
        - 'shared/**'
        - 'deploy/docker/Dockerfile.frontend'
```

**Infrastructure Deployment**:
Infrastructure changes use the manual workflow with Terraform:

```yaml
# Update application secrets in GitHub Actions
- name: Update application secrets
  run: |
    aws ssm put-parameter \
      --name '/costfx/${{ needs.setup.outputs.environment }}/jwt_secret' \
      --value '${{ secrets.JWT_SECRET }}' \
      --type SecureString \
      --overwrite \
      --region ${{ env.AWS_REGION }}
```

**Frontend Production Environment**:
- `VITE_API_URL=/api/v1` (relative path for ALB routing)
- `VITE_NODE_ENV=production`

**Production URLs**:
- **Frontend**: https://cost-fx.com/
- **Backend API**: https://cost-fx.com/api/v1/
- **Load Balancer**: costfx-dev-alb-1499165776.us-west-2.elb.amazonaws.com

### Monitoring and Observability

#### CloudWatch Monitoring
- **ALB Metrics**: Response time, error rates, target health
- **ECS Metrics**: CPU/memory utilization, task count
- **RDS Metrics**: Database connections, CPU utilization
- **Custom Metrics**: Agent performance, API response times

#### Alerts Configuration
```terraform
# Example CloudWatch alarm
resource "aws_cloudwatch_metric_alarm" "high_response_time" {
  alarm_name          = "costfx-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "This metric monitors ALB response time"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

#### Security Features
- **WAF Protection**: AWS WAF with OWASP Top 10 rules
- **SSL/TLS**: ACM certificate with automated renewal
- **VPC Security**: Private subnets for database and backend
- **IAM Roles**: Least privilege access for all services

---

## Troubleshooting

### Common Issues and Solutions

#### Development Environment

**Issue**: `npm run dev` fails to start
- **Cause**: Port conflicts or missing dependencies
- **Solution**: 
  ```bash
  # Check for port conflicts
  lsof -i :3000 -i :5000
  
  # Reinstall dependencies
  npm run clean && npm install
  ```

**Issue**: Database connection errors
- **Cause**: PostgreSQL not running or incorrect credentials
- **Solution**:
  ```bash
  # Start PostgreSQL (macOS)
  brew services start postgresql
  
  # Check connection
  psql -h localhost -U username -d costfx_dev
  ```

#### Testing Issues

**Issue**: Jest tests failing with ES module errors
- **Cause**: Incorrect Jest configuration for ES modules
- **Solution**: Ensure `jest.config.js` includes Babel transformation (see Technical Solutions)

**Issue**: Database tests failing
- **Cause**: Test database not properly reset between tests
- **Solution**: Use proper test setup:
  ```javascript
  // tests/setup.js
  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });
  ```

#### Production Deployment

**Issue**: ECS tasks failing to start
- **Cause**: Environment variables not properly configured
- **Solution**: Check SSM Parameter Store values and ECS task definition

**Issue**: Database connection timeouts
- **Cause**: Security group configuration or connection pool limits
- **Solution**: 
  - Verify security group allows PostgreSQL traffic (port 5432)
  - Check RDS connection limits and adjust pool configuration

**Issue**: Frontend not loading
- **Cause**: ALB routing configuration or CORS issues
- **Solution**: 
  - Verify ALB listener rules for path-based routing
  - Check CORS configuration in backend

#### Performance Issues

**Issue**: Slow API responses
- **Cause**: Database queries not optimized or missing indexes
- **Solution**:
  ```sql
  -- Add indexes for common queries
  CREATE INDEX idx_inventory_items_restaurant_id ON inventory_items(restaurant_id);
  CREATE INDEX idx_transactions_item_id ON inventory_transactions(inventory_item_id);
  ```

**Issue**: High memory usage
- **Cause**: Memory leaks in agent processing
- **Solution**: 
  - Profile memory usage with Node.js built-in profiler
  - Implement proper cleanup in agent methods
  - Use Redis for caching to reduce memory pressure

### Debugging Tools

#### Backend Debugging
```javascript
// Enable debug logging
DEBUG=costfx:* npm run dev

// Use Node.js inspector
node --inspect src/index.js
```

#### Database Debugging
```sql
-- Enable query logging in PostgreSQL
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- Monitor slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

#### Container Debugging
```bash
# Check container logs
docker logs <container-id>

# Access running container
docker exec -it <container-id> /bin/sh

# Check ECS task logs
aws logs tail /costfx/backend --follow
```

---

*This documentation follows the Diátaxis framework for systematic technical documentation, organizing content by user needs: tutorials for learning, how-to guides for solving problems, reference for information, and explanation for understanding.*
