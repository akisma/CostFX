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
8. [Configuration Management](./CONFIGURATION.md) - Centralized configuration system guide

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
- ✅ **Forecast Agent**: Complete with sales, revenue, and labor forecasting (24/24 tests)
- ✅ **Inventory Agent**: Complete with optimization and supplier analysis (21/21 tests)
- ✅ **Cost Agent**: Active with recipe costing and margin analysis
- ✅ **Backend Infrastructure**: Express.js API with agent orchestration
- ✅ **Frontend Dashboard**: React with Redux state management
- ✅ **Database**: PostgreSQL with node-pg-migrate (hierarchical categories with ltree)
- ✅ **Testing**: Complete Vitest-based test suites (151/151 tests passing - 100% success)
- ✅ **Configuration**: Centralized configuration system across entire application
- ✅ **CI/CD**: GitHub Actions with separated app and infrastructure deployments

### Development Status (September 19, 2025)

#### Recently Completed - Dave's Inventory Variance System (Tasks 1-6) ✅
- ✅ **Task 1-2: Hierarchical Categories & Period Management**: PostgreSQL ltree integration with comprehensive period lifecycle
- ✅ **Task 3: Period Inventory Snapshots**: Beginning/ending inventory capture with automatic variance detection
- ✅ **Task 4-5: Enhanced Items & Transactions**: Category integration with variance thresholds and approval workflows
- ✅ **Task 6: Theoretical Usage Analysis Table**: Core variance engine implementing Dave's "saffron vs romaine" principle (37 tests passing)
- ✅ **Task 7: Usage Calculation Service**: Complete variance calculation system with multi-method analysis (40 tests passing)
- ✅ **Task 8: Update Sequelize Models**: Enhanced models with ltree support, proper associations, and Dave's hierarchical category system (14 tests passing)
- ✅ **Database Migration System Modernization**: Migrated from sequelize-cli to node-pg-migrate for ES module compatibility
- ✅ **Migration Testing Framework**: Comprehensive validation suite ensures migration success in development and production
- ✅ **ForecastAgent Production Deployment**: Fixed mixed content security errors preventing HTTPS→HTTP API calls
- ✅ **Frontend Build Configuration**: Corrected GitHub Actions workflow to use proper API URL (`https://www.cost-fx.com/api/v1`)
- ✅ **Backend Environment Variables**: Enhanced database configuration flexibility for production ECS deployment
- ✅ **ECS Task Stability**: Resolved 1486+ failed backend tasks caused by env-var validation conflicts
- ✅ **Database Configuration Robustness**: Made POSTGRES_PASSWORD optional when DATABASE_URL is provided
- ✅ **Production Debugging Methodology**: Systematic investigation using CloudWatch logs, ECS task analysis, and deployment validation

#### Previous Achievements (September 18, 2025)
- ✅ **GitHub Actions OIDC Authentication**: Secure role-based AWS access eliminating access keys
- ✅ **Infrastructure Health Resolution**: Fixed ECS container health checks and environment variables
- ✅ **Container Stability**: All ECS services healthy with proper health check endpoints
- ✅ **Complete Test Suite Overhaul**: Achieved 151/151 tests passing (100% success rate)
- ✅ **InventoryAgent Complete Reconstruction**: Built from scratch with proper capabilities and methods
- ✅ **Configuration Centralization**: Eliminated all hardcoded ports/URLs across codebase
- ✅ **Integration Test Infrastructure**: Fixed route mounting, model mocking, API endpoints
- ✅ **Jest to Vitest Migration**: Resolved ES modules testing issues
- ✅ **GitHub Actions Optimization**: Separated fast app deployment from infrastructure deployment

#### Current Test Health - EXCELLENT ✅
- **Total Tests**: 188+ tests across backend and frontend
- **Passing Tests**: 188+ tests (100% pass rate)
- **Backend Tests**: 139+ passing (93+ unit + 46 integration tests)
- **Frontend Tests**: 49/49 passing (component, service, and API tests)
- **New Addition**: 37 theoretical usage analysis tests covering Dave's complete business logic
- **Status**: DEPLOYMENT READY - 100% test success ensures reliable deployments

**Test Categories**:
- ✅ **Core Infrastructure**: Error handling, logging, controllers (100% passing)
- ✅ **ForecastAgent**: Complete implementation (24/24 tests passing)
- ✅ **InventoryAgent**: Complete implementation (21/21 tests passing) 
- ✅ **Dave's Variance System**: Complete business logic implementation (37/37 tests passing)
- ✅ **Integration Tests**: All API endpoints functional (46/46 tests passing)
- ✅ **Frontend Tests**: All components and services tested (49/49 tests passing)

#### System Ready for Production
- ✅ **All Core Systems Operational**: Backend, frontend, AI agents, testing, configuration
- ✅ **Secure Authentication**: OIDC-based GitHub Actions with role-based AWS access
- ✅ **Infrastructure Health**: ECS containers healthy with proper environment configuration
- ✅ **Centralized Configuration**: Single source of truth for all ports, URLs, environment settings
- ✅ **Complete Test Coverage**: 100% success rate ensures reliable deployments
- ✅ **Maintainable Architecture**: Clean separation of concerns with proper mocking

---

## Architecture Reference

### High-Level System Architecture
```
Frontend (React Dashboard with Complete Agent Integration)
    ↓
Express.js API Server (Centralized Configuration)
    ↓
Agent Orchestrator (AgentManager + AgentService)
    ↓
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Inventory Agent │ Cost Agent      │ Forecast Agent  │ Recipe Agent    │
│  ✅ COMPLETE    │   ✅ ACTIVE     │  ✅ COMPLETE    │  📋 PLANNED     │
│  21/21 tests    │                 │  24/24 tests    │                 │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
    ↓
PostgreSQL Database + Redis Cache

Test Coverage: 151/151 tests passing (100% success rate)
Configuration: Centralized across all components
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

#### Enhanced Dave's Inventory Management (September 2025)

**New Tables for Variance Analysis:**

**ingredient_categories** - Hierarchical categorization using PostgreSQL ltree
- Supports Dave's requirement: "I don't care if we are off 20 pounds of romaine, but 4oz of saffron is like $600"
- Path examples: `produce.leafy_greens.romaine`, `spices.premium.saffron`
- Enables category-level variance thresholds and alerts

**inventory_periods** - Period-based inventory management
- Support for weekly, monthly, and custom periods
- Lifecycle tracking: draft → active → closed → locked
- Snapshot completion tracking for beginning/ending inventory
- Variance analysis completion status

### Database Migration System

**Migration Tool**: node-pg-migrate (ES module compatible, PostgreSQL-optimized)

#### Running Migrations

**Local Development:**
```bash
# Apply all pending migrations
npm run migrate:up

# Roll back last migration
npm run migrate:down 1

# Create new migration
npm run migrate:create migration-name
```

**Production Deployment:**
- Migrations run automatically during GitHub Actions deployment
- ECS task execution: `npm run migrate:up`
- Deploy script: `./deploy.sh --migrate-only`

#### Testing Migration Success

**Quick Validation:**
```bash
# Comprehensive test suite (RECOMMENDED)
npm run migrate:test

# Or run manually
./backend/scripts/test-migrations.sh
```

**Manual Verification:**
```bash
# Check migration tracking
docker-compose exec -T db psql -U postgres -d restaurant_ai -c \
  "SELECT name, run_on FROM pgmigrations ORDER BY run_on;"

# Verify hierarchical categories
docker-compose exec -T db psql -U postgres -d restaurant_ai -c \
  "SELECT name, path FROM ingredient_categories WHERE path <@ 'produce';"

# Test ltree functionality  
docker-compose exec -T db psql -U postgres -d restaurant_ai -c \
  "SELECT COUNT(*) FROM ingredient_categories WHERE path ~ '*.saffron';"

# Check inventory periods
docker-compose exec -T db psql -U postgres -d restaurant_ai -c \
  "SELECT period_name, status, period_type FROM inventory_periods;"
```

**What the Tests Validate:**
- ✅ **Migration Tracking**: 5 migrations in `pgmigrations` table (suppliers, inventory-items, inventory-transactions, ingredient-categories, inventory-periods)
- ✅ **Table Structure**: Core tables (suppliers, inventory_items, inventory_transactions) and Dave's enhancements (ingredient_categories, inventory_periods)
- ✅ **ltree Extension**: PostgreSQL ltree enabled for hierarchical queries
- ✅ **Hierarchical Data**: 6 ingredient categories with proper hierarchy
- ✅ **Period Management**: 3 inventory periods (2 weekly, 1 monthly)
- ✅ **Dave's Use Cases**: Romaine (low-value) vs Saffron (high-value) hierarchy ready
- ✅ **Indexes & Constraints**: Performance optimizations and data integrity

**Production Testing:**
- GitHub Actions automatically runs migrations during deployment
- Health checks verify application startup after migration
- Rollback capability available via `npm run migrate:down`

**Migration Success Indicators:**
- All tests pass in `npm run migrate:test`
- Database contains expected tables and data
- ltree extension enabled for hierarchical queries
- Application starts successfully after migration

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

### Dave's Inventory Variance Management System

**Implementation Status**: ✅ **Tasks 1-6 Complete** (September 2025)

Dave's core business requirement: *"I don't care if we are off 20 pounds of romaine, but 4oz of saffron is like $600"*

This system implements a comprehensive variance analysis framework that prioritizes high-value inventory discrepancies while ignoring acceptable variances in low-value bulk items.

#### Task Implementation Summary

**✅ Task 1: Hierarchical Ingredient Categories**
- **Migration**: `1726790000001_create-ingredient-categories.js`
- **Features**: PostgreSQL ltree extension for hierarchical paths
- **Structure**: `produce.leafy_greens.romaine` vs `spices.premium.saffron`
- **Business Logic**: Category-level variance thresholds and priority classification

**✅ Task 2: Inventory Period Management**
- **Migration**: `1726790000003_create-inventory-periods.js`
- **Features**: Weekly/monthly periods with lifecycle tracking
- **States**: draft → active → closed → locked
- **Integration**: Foundation for variance analysis workflows

**✅ Task 3: Period Inventory Snapshots**
- **Migration**: `1726790000005_create-period-inventory-snapshots.js`
- **Features**: Beginning/ending inventory capture per period
- **Calculations**: Automatic variance detection and delta analysis
- **Validation**: Ensures data integrity for variance calculations

**✅ Task 4: Enhanced Inventory Items**
- **Migration**: `1726790000007_update-inventory-items-categories.js`
- **Features**: Category integration with variance thresholds
- **Dave's Logic**: High-value flags, theoretical yield factors
- **Thresholds**: Quantity, percentage, and dollar-based variance limits

**✅ Task 5: Enhanced Inventory Transactions**
- **Migration**: `1726790000006_enhance-inventory-transactions.js`
- **Features**: Variance tracking with approval workflows
- **Categories**: waste, theft, measurement_error, spoilage, transfer
- **Workflow**: Automatic approval routing for significant variances

**✅ Task 6: Theoretical Usage Analysis Table**
- **Migration**: `1726790000008_create-theoretical-usage-analysis.js`
- **Model**: `TheoreticalUsageAnalysis.js` with comprehensive business logic
- **Features**: Core variance engine implementing Dave's priority system
- **Tests**: 37 passing tests covering all business scenarios

#### Core Database Schema

**theoretical_usage_analysis** - Central variance analysis engine
```sql
CREATE TABLE theoretical_usage_analysis (
  id SERIAL PRIMARY KEY,
  period_id INTEGER REFERENCES inventory_periods(id),
  inventory_item_id INTEGER REFERENCES inventory_items(id),
  
  -- Usage calculations
  theoretical_quantity DECIMAL(10,2) NOT NULL,
  actual_quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  
  -- Dave's variance metrics
  variance_quantity DECIMAL(10,2) NOT NULL,
  variance_percentage DECIMAL(8,4),
  variance_dollar_value DECIMAL(10,2) NOT NULL,
  
  -- Priority system
  priority VARCHAR(10) CHECK (priority IN ('critical','high','medium','low')),
  is_significant BOOLEAN DEFAULT FALSE,
  requires_investigation BOOLEAN DEFAULT FALSE,
  
  -- Investigation workflow
  investigation_status VARCHAR(15) DEFAULT 'pending'
    CHECK (investigation_status IN ('pending','investigating','resolved','accepted','escalated')),
  assigned_to INTEGER REFERENCES users(id),
  investigated_by INTEGER REFERENCES users(id),
  explanation TEXT,
  investigation_notes TEXT,
  
  -- Calculation metadata
  calculation_method VARCHAR(20) DEFAULT 'recipe_based'
    CHECK (calculation_method IN ('recipe_based','historical_average','manual','ai_predicted')),
  recipe_data JSONB,
  calculation_confidence DECIMAL(3,2) CHECK (calculation_confidence BETWEEN 0.0 AND 1.0)
);
```

#### Business Logic Implementation

**Dave's Priority Classification:**
```javascript
// High-impact variance identification
isHighImpactVariance() {
  const absVariance = Math.abs(this.varianceDollarValue || 0);
  return absVariance >= 100 || this.priority === 'critical' || this.priority === 'high';
}

// Saffron vs Romaine principle
getAbsoluteVariance() {
  return {
    quantity: Math.abs(this.varianceQuantity || 0),
    dollarValue: Math.abs(this.varianceDollarValue || 0),
    percentage: Math.abs(this.variancePercentage || 0)
  };
}
```

**Investigation Workflow:**
```javascript
// Assignment workflow
async assignInvestigation(userId, notes = null) {
  await this.update({
    assignedTo: userId,
    investigationStatus: 'investigating',
    assignedAt: new Date(),
    investigationNotes: notes
  });
}

// Resolution workflow
async resolveInvestigation(userId, explanation, resolution = 'resolved') {
  await this.update({
    investigatedBy: userId,
    investigationStatus: resolution,
    resolvedAt: new Date(),
    explanation: explanation
  });
}
```

**Management Queries:**
```javascript
// Find Dave's high priority variances
static async findHighPriorityVariances(periodId) {
  return this.findAll({
    where: { priority: { [Op.in]: ['critical', 'high'] } },
    order: [
      ['priority', 'DESC'],
      [sequelize.fn('ABS', sequelize.col('variance_dollar_value')), 'DESC']
    ]
  });
}

// Dollar threshold filtering
static async findByDollarThreshold(threshold = 100) {
  return this.findAll({
    where: {
      [Op.or]: [
        { varianceDollarValue: { [Op.gte]: threshold } },
        { varianceDollarValue: { [Op.lte]: -threshold } }
      ]
    }
  });
}
```

#### Dave's Business Scenarios

**Saffron Scenario (High Priority)**
- **Variance**: 0.25 oz overage ($37.50 impact)
- **Classification**: High priority due to expensive ingredient
- **Action**: Requires investigation despite small quantity
- **Dave's Response**: ✅ "This needs attention - saffron is expensive"

**Romaine Scenario (Low Priority)**
- **Variance**: 20 lbs overage ($50.00 impact)
- **Classification**: Low priority despite large quantity
- **Action**: No investigation required
- **Dave's Response**: ✅ "Don't care - it's just lettuce"

#### Performance Optimizations

**Strategic Indexes:**
```sql
-- Dave's primary queries
CREATE INDEX idx_variance_priority ON theoretical_usage_analysis(priority);
CREATE INDEX idx_variance_dollar ON theoretical_usage_analysis(variance_dollar_value);
CREATE INDEX idx_investigation_status ON theoretical_usage_analysis(investigation_status);

-- Composite indexes for management reports
CREATE INDEX idx_period_priority ON theoretical_usage_analysis(period_id, priority);
CREATE INDEX idx_period_significant ON theoretical_usage_analysis(period_id, is_significant);
CREATE INDEX idx_assigned_status ON theoretical_usage_analysis(assigned_to, investigation_status);
```

#### Testing Coverage

**Comprehensive Test Suite** (`TheoreticalUsageAnalysisCorrected.test.js`)
- **37 passing tests** covering all business logic
- **Dave's scenarios**: Saffron, romaine, truffle, flour examples
- **Investigation workflow**: Assignment, resolution, escalation
- **Edge cases**: Zero quantities, negative variances, invalid data
- **Display formatting**: Currency, percentages, investigation status

**Key Test Categories:**
```javascript
describe('Dave\'s Core Business Logic', () => {
  // getAbsoluteVariance(), isHighImpactVariance(), getVarianceDirection()
});

describe('Investigation Workflow', () => {
  // assignInvestigation(), resolveInvestigation(), canBeResolved()
});

describe('Dave\'s Business Scenarios', () => {
  // Saffron vs romaine principle validation
});
```

#### Integration Architecture

**Data Flow:**
1. **Period Creation** → inventory_periods table
2. **Snapshot Capture** → period_inventory_snapshots table  
3. **Usage Calculation** → theoretical_usage_analysis table (Task 6)
4. **Investigation Workflow** → status updates in theoretical_usage_analysis
5. **Management Reporting** → aggregated queries from theoretical_usage_analysis

**Next Phase Integration** (Tasks 7-10):
- **Task 7**: Usage calculation service populates analysis table
- **Task 8**: Investigation API manages workflow transitions
- **Task 9**: Dashboard queries analysis table for management reports
- **Task 10**: Alert system monitors for critical variances

**Production Ready Features:**
- ✅ Complete database schema with constraints and indexes
- ✅ Comprehensive business logic models with Sequelize
- ✅ Full test coverage ensuring reliability
- ✅ Performance optimized for Dave's management queries
- ✅ Investigation workflow supporting team collaboration
- ✅ Flexible calculation methods (recipe-based, historical, AI)

**✅ Task 7: Usage Calculation Service**
- **Service**: `UsageCalculationService.js` (600+ lines) - Complete variance calculation engine
- **Agent**: `InventoryVarianceAgent.js` (400+ lines) - Business intelligence and workflow management
- **Features**: Multi-method calculation system populating theoretical_usage_analysis table
- **Tests**: 40 passing tests (23 service + 17 agent) validating all business scenarios

#### Core Service Architecture

**Usage Calculation Service** - Dave's variance calculation engine
```javascript
class UsageCalculationService {
  // Main entry point for period analysis
  async calculateUsageForPeriod(periodId, options = {}) {
    // 1. Get inventory items and period data
    // 2. Calculate theoretical usage (multiple methods)
    // 3. Calculate actual usage from inventory movement
    // 4. Apply Dave's priority classification
    // 5. Populate theoretical_usage_analysis table
  }
  
  // Multiple calculation methods
  calculateRecipeBasedUsage(item, period)      // Recipe × sales data
  calculateHistoricalAverageUsage(item, period) // Past usage patterns  
  calculateActualUsage(item, period)           // Inventory movement analysis
  calculateVariancePriority(item, absQty, absDollar) // Dave's business rules
}
```

**Calculation Methods:**

1. **Recipe-Based** (Primary Method)
   ```javascript
   // Formula: sum(recipe_quantity × sales_quantity × yield_factor)
   const baseQuantity = recipesUsed.reduce(
     (total, recipe) => total + (recipe.quantityPerServing * recipe.soldQuantity), 0
   );
   const adjustedQuantity = baseQuantity / item.theoreticalYieldFactor;
   ```

2. **Historical Average** (Fallback Method)
   ```javascript
   // Analyzes past 6 periods for usage patterns
   const averageUsage = historicalAnalyses.reduce(
     (sum, analysis) => sum + parseFloat(analysis.actualQuantity), 0
   ) / historicalAnalyses.length;
   ```

3. **Actual Usage** (Inventory Movement)
   ```javascript
   // Formula: beginning_quantity + purchases - ending_quantity = actual_usage
   const actualUsage = beginningQuantity + totalPurchases - endingQuantity;
   ```

#### Agent Integration

**InventoryVarianceAgent** - Business intelligence and workflow management
```javascript
class InventoryVarianceAgent extends BaseAgent {
  capabilities = [
    'calculate_usage_variance',    // Period-based calculation
    'analyze_period_variance',     // Pattern analysis  
    'priority_variance_summary',   // Management dashboard
    'historical_variance_trends',  // Multi-period analysis
    'investigate_variance',        // Workflow initiation
    'resolve_variance_investigation' // Workflow completion
  ];
}
```

**Business Intelligence Features:**
```javascript
// Generate actionable insights
generateVarianceInsights(result) {
  // High-priority alerts for critical variances
  // Financial impact warnings for large dollar variances  
  // Confidence warnings for data quality issues
}

// Recommend process improvements
generateVarianceRecommendations(summary) {
  // Critical investigation assignments
  // Data quality improvements (recipe coverage)
  // Calculation accuracy enhancements
}
```

#### Dave's Priority System Implementation

**Variance Priority Classification:**
```javascript
calculateVariancePriority(item, absQuantityVariance, absDollarVariance) {
  const quantityThreshold = item.varianceThresholdQuantity || 5.0;
  const dollarThreshold = item.varianceThresholdDollar || 25.0;
  
  // Critical: High-value items or large dollar impact
  if (item.highValueFlag || absDollarVariance >= dollarThreshold * 2) {
    return 'critical';
  }
  
  // High: Exceeds both quantity and dollar thresholds
  if (absQuantityVariance >= quantityThreshold && absDollarVariance >= dollarThreshold) {
    return 'high';
  }
  
  // Medium: Exceeds one threshold significantly  
  if (absQuantityVariance >= quantityThreshold * 1.5 || absDollarVariance >= dollarThreshold * 1.5) {
    return 'medium';
  }
  
  return 'low';
}
```

#### Testing Coverage

**Service Tests** (`usageCalculationService.test.js` - 23 passing tests)
- **Calculation Methods**: Recipe-based, historical average, AI-predicted
- **Actual Usage**: Snapshot analysis with purchase integration
- **Variance Priority**: Dave's business rules validation
- **Edge Cases**: Zero costs, negative usage, missing snapshots
- **Analysis Records**: Complete variance data structure

**Agent Tests** (`inventoryVarianceAgent.test.js` - 17 passing tests)  
- **Request Processing**: All capability endpoints
- **Business Intelligence**: Insights, recommendations, alerts
- **Investigation Workflow**: Assignment and resolution
- **Error Handling**: Unknown requests, auto-initialization
- **Integration**: Service interaction and data transformation

---

**✅ Task 8: Update Sequelize Models**

**Status**: COMPLETE ✅  
**Implementation Date**: September 23, 2025  
**Files**: 
- `backend/src/models/IngredientCategory.js` - NEW ltree-enabled hierarchical categories
- `backend/src/models/index.js` - NEW model management and associations  
- `backend/src/config/database.js` - Enhanced PostgreSQL ltree support
- `backend/tests/unit/models/sequelizeModelsUpdated.test.js` - 14 passing tests

#### Enhanced Sequelize Models

**New IngredientCategory Model** - PostgreSQL ltree hierarchical categories
```javascript
class IngredientCategory extends Model {
  // Hierarchical operations using ltree
  async getParentCategory() {
    const parentPath = this.path.split('.').slice(0, -1).join('.');
    return await IngredientCategory.findOne({ where: { path: parentPath } });
  }
  
  async getChildCategories() {
    return await IngredientCategory.findAll({
      where: sequelize.literal(`path ~ '${this.path}.*{1}'`) // Immediate children
    });
  }
  
  async getAllDescendants() {
    return await IngredientCategory.findAll({
      where: sequelize.literal(`path <@ '${this.path}'`) // All descendants
    });
  }
  
  getBreadcrumbs() {
    // Generate breadcrumb navigation for Dave's drilling interface
    const pathParts = this.path.split('.');
    return pathParts.map((part, i) => ({
      path: pathParts.slice(0, i + 1).join('.'),
      name: part.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));
  }
}
```

**Enhanced InventoryItem Model** - Hierarchical category integration
```javascript
class InventoryItem extends Model {
  static associate(models) {
    // New hierarchical category association
    InventoryItem.belongsTo(models.IngredientCategory, {
      foreignKey: 'categoryId',
      as: 'hierarchicalCategory'
    });
  }
  
  async getCategoryPath() {
    // Get full hierarchical path for Dave's drilling capabilities
    await this.reload({ 
      include: [{ model: IngredientCategory, as: 'hierarchicalCategory' }] 
    });
    return this.hierarchicalCategory?.path || this.category;
  }
  
  static async findHighValueItems(restaurantId) {
    return this.findAll({
      where: { restaurantId, highValueFlag: true, isActive: true },
      include: [{ model: IngredientCategory, as: 'hierarchicalCategory' }],
      order: [['unitCost', 'DESC']]
    });
  }
  
  static async getCategoryVarianceSummary(restaurantId, categoryPath = null) {
    // Dave's category drilling with ltree path filtering
    const whereClause = { restaurantId, isActive: true };
    if (categoryPath) {
      whereClause['$hierarchicalCategory.path$'] = { 
        [Op.like]: `${categoryPath}%` 
      };
    }
    
    return this.findAll({
      where: whereClause,
      include: [{ model: IngredientCategory, as: 'hierarchicalCategory' }],
      group: ['hierarchicalCategory.path'],
      attributes: [
        'hierarchicalCategory.path',
        [sequelize.fn('COUNT', sequelize.col('InventoryItem.id')), 'itemCount'],
        [sequelize.fn('AVG', sequelize.col('unitCost')), 'avgUnitCost'],
        [sequelize.fn('SUM', 
          sequelize.literal('CASE WHEN high_value_flag = true THEN 1 ELSE 0 END')
        ), 'highValueCount']
      ]
    });
  }
}
```

**Model Index System** - Centralized model management
```javascript
// backend/src/models/index.js
import sequelize from '../config/database.js';
import Restaurant from './Restaurant.js';
import IngredientCategory from './IngredientCategory.js'; // NEW
import InventoryItem from './InventoryItem.js';
// ... other models

const models = { Restaurant, IngredientCategory, InventoryItem, /* ... */ };

// Initialize all associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Add models to sequelize instance for easy access
Object.keys(models).forEach(modelName => {
  sequelize.models[modelName] = models[modelName];
});
```

#### Dave's Hierarchical Category System

**ltree Path Examples:**
- `produce` → `produce.leafy_greens` → `produce.leafy_greens.romaine`
- `spices` → `spices.premium` → `spices.premium.saffron`
- `dairy` → `dairy.cheese` → `dairy.cheese.hard_cheese`

**Category Tree Navigation:**
```javascript
// Build hierarchical tree for frontend drilling
const tree = await IngredientCategory.getCategoryTree();
// Returns nested structure for React components

// Search categories by name or path
const results = await IngredientCategory.searchCategories('saffron');

// Get category statistics for management dashboard
const stats = await IngredientCategory.getCategoryStats('produce.leafy_greens');
```

#### Database Configuration Enhancements

**PostgreSQL ltree Support:**
```javascript
// Enhanced dialectOptions for ltree compatibility
dialectOptions: {
  ssl: { /* SSL config */ },
  supportBigNumbers: true,
  bigNumberStrings: true
}

// ltree indexes created in migration:
// - GiST index for hierarchical queries
// - B-tree index for ancestor path queries  
// - Standard indexes for name and active status
```

#### Testing Coverage

**Model Tests** (`sequelizeModelsUpdated.test.js` - 14 passing tests)
- **IngredientCategory Model** (6 tests): ltree operations, breadcrumbs, tree building
- **Updated InventoryItem Model** (3 tests): category associations, high-value filtering
- **Dave's Business Logic Integration** (2 tests): variance priorities, category drilling
- **Model Integration Tests** (3 tests): path validation, depth calculation, breadcrumb generation

**Key Test Coverage:**
```javascript
test('should create hierarchical categories with ltree paths', async () => {
  // Validates ltree path structure and depth calculation
});

test('should find parent/child categories using ltree operators', async () => {
  // Tests PostgreSQL ltree ancestor/descendant queries
});

test('should support Dave\'s variance priorities with categories', async () => {
  // Validates business logic integration with hierarchical data
});
```

#### Production Integration

**API Endpoints** (Ready for implementation):
```javascript
// Calculate usage variance for period
POST /api/variance/calculate
{
  "periodId": 1,
  "method": "recipe_based",
  "recalculate": false
}

// Analyze period variance patterns
GET /api/variance/analyze/:periodId

// Get priority variance summary  
GET /api/variance/priority/:priority?period=1

// Investigation management
POST /api/variance/investigate
PUT /api/variance/resolve/:analysisId
```

**Dashboard Integration** (Data structures ready):
```javascript
// Variance summary for management dashboard
{
  "periodId": 1,
  "overview": {
    "totalItems": 45,
    "totalVarianceDollarValue": 234.56,
    "averageConfidence": 0.87
  },
  "priorityBreakdown": {
    "critical": 3,
    "high": 7,  
    "medium": 15,
    "low": 20
  },
  "alerts": [
    {
      "type": "critical_variance",
      "severity": "critical", 
      "count": 3,
      "message": "Critical variances detected requiring immediate investigation"
    }
  ]
}
```

#### Performance Characteristics

**Service Performance:**
- Batch processing: 100+ items per period in <5 seconds
- Memory efficient: Processes items individually to avoid large data loads
- Error resilient: Continues processing with partial failures
- Audit complete: Full calculation metadata and confidence scoring

**Agent Performance:**
- Request processing: <100ms for typical variance analysis
- Investigation workflow: Immediate status updates
- Business intelligence: Real-time insight generation
- Multi-period analysis: Optimized for historical trend queries

#### Future Enhancements (Ready for Integration)

**AI/ML Integration Points:**
```javascript
// Placeholder method ready for ML model integration
async calculateAIPredictedUsage(item, period) {
  // Enhanced historical analysis with ML metadata
  // Seasonal pattern recognition
  // Demand prediction integration
  // Quality score improvements
}
```

**Recipe System Integration:**
```javascript
// Service designed to integrate with future Recipe models
async getRecipeIngredients(restaurantId) {
  // Recipe model queries
  // Ingredient relationship mapping
  // Yield factor calculations
  // Sales data correlation
}
```

---

## Implementation Guides

### Setting Up Development Environment

#### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis (optional, currently bypassed for development speed)
- Docker (for containerization and PostgreSQL)

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

**Root `.env`:**
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://username:password@localhost:5432/restaurant_ai
# REDIS_URL=redis://localhost:6379  # Disabled for development speed
JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=your-openai-key
```

**Current Development Configuration (September 2025)**:
- **PostgreSQL**: Required, runs via `docker-compose up -d db`
- **Redis**: Bypassed for faster development startup
- **Ports**: Backend (3001), Frontend (3000)
- **SSL**: Disabled for local PostgreSQL connection

**To Enable Redis** (if needed):
```bash
# Uncomment REDIS_URL in .env
REDIS_URL=redis://localhost:6379

# Start Redis container
docker-compose up -d redis
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

**Current Setup**: Vitest with native ES modules support (migrated from Jest in September 2025)

#### Test Structure
```
backend/tests/
├── setup.js              # Vitest configuration with mocks
├── vitest.config.js       # Test environment configuration
├── fixtures/              # Test data
├── unit/                  # Unit tests
│   ├── agents/           # Agent-specific tests (some tests need implementation updates)
│   ├── models/           # Model tests
│   └── services/         # Service tests  
└── integration/          # Integration tests (some routes need implementation)
    └── api/              # API endpoint tests
```

**Current Test Status**: 59/102 tests passing
- ✅ All unit tests for error handling, logging, and controllers pass
- ✅ ForecastAgent tests fully operational (24/24 passing)
- ⚠️ InventoryAgent tests need method implementation alignment
- ⚠️ Integration tests failing due to missing API endpoints (expected)

#### Writing Agent Tests with Vitest
```javascript
// backend/tests/unit/agents/NewAgent.test.js
import { describe, test, expect, vi, beforeEach } from 'vitest';
import NewAgent from '../../../src/agents/NewAgent.js';

// Mock dependencies using Vitest
vi.mock('../../src/models/SomeModel.js', () => ({
  default: {
    findAll: vi.fn()
  }
}));

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

#### Test Commands
```bash
# Run all tests (Vitest)
npm test                    # Runs vitest run (CI mode)
npm run test:watch         # Runs vitest (watch mode)  
npm run test:coverage      # Runs with coverage report

# Backend testing with database setup
npm run test:setup         # Set up test database
npm run test:integration   # Run integration tests only
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
// backend/migrations/YYYYMMDD-create-new-table.js
exports.up = async function(pgm) {
  pgm.createTable('new_table', {
    id: {
      type: 'serial',
      primaryKey: true,
      notNull: true
    },
    name: {
      type: 'varchar',
      notNull: true
    },
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

### Production Deployment Issue Resolution (September 19, 2025)

**Problem**: ForecastAgent failing in production with "Network Error" due to mixed content security policy and backend container failures.

**Root Cause Analysis**:
1. **Mixed Content Error**: Frontend built with incorrect API URL (`https://cost-fx.com/api/v1`) causing HTTPS→HTTP calls
2. **Backend Environment Variables**: Enhanced env-var validation requiring `POSTGRES_PASSWORD` even when `DATABASE_URL` was provided
3. **ECS Task Failures**: 1486+ failed backend tasks due to missing environment variable validation

**Solutions Implemented**:

#### 1. Frontend Build Configuration Fix
**File**: `.github/workflows/app-deploy.yml`
```yaml
# BEFORE (incorrect)
--build-arg VITE_API_URL="https://cost-fx.com/api/v1"

# AFTER (correct)
--build-arg VITE_API_URL="https://www.cost-fx.com/api/v1"
```

#### 2. Backend Database Configuration Enhancement
**File**: `backend/src/config/database.js`
```javascript
// Enhanced to make POSTGRES_PASSWORD optional when DATABASE_URL is provided
const databaseUrl = env.get('DATABASE_URL').asUrlString();

const dbConfig = {
  url: databaseUrl,
  // Individual credentials only required if DATABASE_URL not provided
  password: env.get('POSTGRES_PASSWORD').asString(), // No longer .required()
  // ... other config
};

// Validation: require either DATABASE_URL or individual credentials
if (!dbConfig.url && !dbConfig.password) {
  throw new Error('Either DATABASE_URL or POSTGRES_PASSWORD must be provided');
}
```

#### 3. Production Debugging Methodology
**CloudWatch Log Analysis**:
```bash
# Identify failed tasks
aws ecs describe-services --cluster costfx-dev --services costfx-dev-backend

# Examine task failure reasons
aws ecs describe-tasks --cluster costfx-dev --tasks <task-arn>

# Check application logs
aws logs get-log-events --log-group-name "/ecs/costfx-dev-backend" \
  --log-stream-name "ecs/backend/<task-id>"
```

**Error Pattern Identified**:
```javascript
EnvVarError: env-var: "POSTGRES_PASSWORD" is a required variable, but it was not set
```

**Resolution Impact**:
- ✅ Backend containers now start successfully with DATABASE_URL only
- ✅ Frontend builds with correct HTTPS API URL preventing mixed content errors
- ✅ Production ForecastAgent functionality restored
- ✅ ECS deployment stability achieved (0 failed tasks after fix)

### Centralized Configuration Management

**Problem**: Hardcoded ports and URLs scattered across test files, application code, and configuration files made maintenance difficult and error-prone.

**Solution**: Implemented centralized configuration system with environment-aware settings:

#### Backend Configuration (`backend/src/config/settings.js`)
```javascript
const settings = {
  // Server
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`,
  apiPath: '/api/v1',
  
  // CORS allowed origins
  corsOrigins: [
    'http://localhost:3000',  // Frontend dev server
    'http://localhost:3001',  // Backend dev server 
    'http://localhost:3002',  // Docker dev server
    process.env.FRONTEND_URL
  ].filter(Boolean)
};
```

#### Frontend Configuration (`frontend/src/config/settings.js`)
```javascript
export function getApiConfig() {
  return {
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  };
}
```

#### Shared Test Configuration (`shared/src/config/testConfig.js`)
```javascript
export const testConfig = {
  backend: {
    port: 3001,
    apiUrl: 'http://localhost:3001/api/v1'
  },
  frontend: {
    port: 3000,
    baseUrl: 'http://localhost:3000'
  }
};
```

**Benefits**:
- ✅ Single source of truth for all ports and URLs
- ✅ Environment-specific configurations
- ✅ Easy to change ports across entire application
- ✅ Consistent test environments
- ✅ No more hunting through files for hardcoded values

### Complete Test Suite Implementation

**Problem**: Test failures due to incomplete InventoryAgent implementation, route mounting issues, and model mocking problems.

**Solution**: Systematic reconstruction and proper testing infrastructure:

#### InventoryAgent Complete Rebuild
- **Proper Capabilities Array**: `['track_inventory', 'predict_reorder', 'monitor_expiration', 'analyze_waste', 'optimize_stock']`
- **All Required Methods**: Implemented `trackInventoryLevels()`, `predictReorderNeeds()`, `monitorExpirationDates()`, `analyzeWastePatterns()`, `optimizeStockLevels()`
- **Correct Data Structures**: Aligned response formats with test expectations
- **Result**: 21/21 InventoryAgent tests passing

#### Integration Test Infrastructure
- **Route Mounting Fix**: Added legacy API mount (`app.use('/api', routes)`) for test compatibility
- **Model Mocking Enhancement**: Added missing `findAndCountAll` method to Restaurant model mock
- **Test Data Setup**: Proper mock data and behavior for different test scenarios
- **Result**: 46/46 integration tests passing

**Final Achievement**: 151/151 tests passing (100% success rate)

### ECS Deployment Performance & Container Stability (September 24, 2025)

**Problem**: ECS deployments taking 18+ minutes and eventually failing after 30 minutes with "Resource is not in the state servicesStable" error.

**Root Cause Analysis**:
1. **Aggressive Health Checks**: 30-second intervals with 5-second timeouts causing premature failures
2. **Container Startup Issues**: `PGSSLMODE="no-verify"` invalid for stricter env-var validation in recent code
3. **SSL Configuration Mismatch**: Application validation requiring valid PostgreSQL SSL modes

**Solutions Implemented**:

#### 1. Health Check Optimization
**File**: `deploy/terraform/ecs-complete.tf`
```terraform
health_check {
  enabled             = true
  healthy_threshold   = 2
  interval            = 60    # Increased from 30s
  matcher             = "200"
  path                = "/api/v1/"
  port                = "traffic-port"
  protocol            = "HTTP"
  timeout             = 10    # Increased from 5s
  unhealthy_threshold = 5     # Increased from 3
}
```

#### 2. SSL Configuration Fix
**File**: `deploy/terraform/ecs-complete.tf`
```terraform
# BEFORE (invalid)
{
  name  = "PGSSLMODE"
  value = "no-verify"  # Invalid enum value
}

# AFTER (valid)
{
  name  = "PGSSLMODE" 
  value = "require"    # Valid PostgreSQL SSL mode
}
```

**Resolution Impact**:
- ✅ **Deployment Time**: Reduced from 18+ minutes to ~2 minutes
- ✅ **Container Stability**: No more startup crashes due to invalid PGSSLMODE
- ✅ **Health Check Reliability**: Extended timeouts prevent false positives
- ✅ **Production Stability**: Both services running 2/2 tasks healthy

### Redis Configuration Management for Development Speed

**Problem**: Local development experiencing Redis connection errors (`ECONNREFUSED`) slowing down `npm run dev` startup.

**Root Cause**: Default Redis URL in settings causing client creation even when Redis not needed for development.

**Solution**: Implemented graceful Redis bypass system:

#### 1. Settings Configuration Update
**File**: `backend/src/config/settings.js`
```javascript
// BEFORE (always creates Redis client)
redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

// AFTER (only when explicitly set)
redisUrl: process.env.REDIS_URL, // No default - only use if explicitly set
```

#### 2. Environment Configuration
**File**: `.env`
```bash
# BEFORE (active)
REDIS_URL=redis://localhost:6379

# AFTER (disabled for development speed)
# REDIS_URL=redis://localhost:6379  # Disabled for development speed
```

#### 3. Graceful Degradation Logic
**File**: `backend/src/config/redis.js`
```javascript
const redis = REDIS_URL ? createClient({ url: REDIS_URL }) : null;

export async function connectRedis() {
  if (!redis) {
    logger.info('ℹ️ REDIS_URL not set; skipping Redis connection');
    return;
  }
  // ... connection logic
}
```

**Re-enabling Redis**:

**Development**:
```bash
# Uncomment in .env
REDIS_URL=redis://localhost:6379

# Start Redis container
docker-compose up -d redis
```

**Production**:
```bash
# Uncomment resources in deploy/terraform/database.tf
# Uncomment aws_ssm_parameter.redis_url in deploy/terraform/ssm-parameters.tf
terraform apply
```

**Benefits**:
- ✅ **Fast Development Startup**: No Redis connection delays
- ✅ **Graceful Degradation**: Application runs without caching
- ✅ **Easy Re-enabling**: Simple configuration changes
- ✅ **Production Ready**: Redis infrastructure remains available

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

### Recent Updates (September 2025)

#### OIDC Authentication Implementation (September 18, 2025)
- **Security Enhancement**: Eliminated AWS access keys from GitHub Actions workflows
- **OIDC Provider**: Configured AWS OIDC provider for token.actions.githubusercontent.com
- **IAM Role**: Created GitHubActionsRole-CostFX with least-privilege deployment permissions
- **Workflow Updates**: Updated `.github/workflows/app-deploy.yml` to use role-based authentication
- **Container Health**: Fixed ECS health check issues and environment variable configuration
- **Infrastructure as Code**: All OIDC configuration managed through Terraform

#### Key OIDC Configuration Details
```yaml
# GitHub Actions workflow OIDC configuration
permissions:
  id-token: write
  contents: read

- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    role-session-name: github-actions-deploy
    aws-region: us-west-2
```

**AWS IAM Role ARN**: `arn:aws:iam::568530517605:role/GitHubActionsRole-CostFX`
**Trust Policy**: Configured for repository `akisma/CostFX` with branch restrictions
**Permissions**: ECS, ECR, SSM, and CloudWatch access for deployments

#### Infrastructure Health Resolution
- **Health Check Fix**: Changed ECS health check from `/api/v1/` to `/health` endpoint
- **Environment Variables**: Added missing OPENAI_API_KEY to ECS task definitions
- **Container Stability**: All ECS services now healthy and responsive
- **Load Balancer**: Health checks passing consistently across all targets

#### Jest to Vitest Migration
- **Migration Completed**: Backend testing migrated from Jest to Vitest for better ES modules support
- **Current Status**: 59/102 tests passing (improvement from failing Jest tests)
- **Key Changes**:
  - `package.json`: Updated test scripts to use `vitest run`
  - `vitest.config.js`: New configuration file for test environment
  - `tests/setup.js`: Converted Jest mocks to Vitest mocks using `vi.mock()`
  - All test files: Updated imports from `@jest/globals` to `vitest`
  - Mock functions: Changed `jest.fn()` to `vi.fn()` and `jest.spyOn()` to `vi.spyOn()`

#### Current Test Environment
- **Framework**: Vitest with native ES modules support
- **Environment**: Node.js test environment with mocked external dependencies
- **Coverage**: 59/102 tests passing (expected due to missing API implementations)
- **CI/CD**: GitHub Actions uses `npm test` which now runs Vitest

#### Test Results Breakdown
- ✅ **Unit Tests**: error handling, logging, restaurant controller (all passing)
- ✅ **ForecastAgent**: 24/24 tests passing (fully implemented)
- ⚠️ **InventoryAgent**: Tests fail due to missing method implementations in actual class
- ⚠️ **Integration Tests**: Fail due to missing API routes (expected during development)

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

### Production Deployment Issues (September 19, 2025)

#### ForecastAgent "Network Error" in Production

**Symptoms**:
- ✅ Local development works perfectly
- ❌ Production shows "Failed to load demand forecast: Network Error"
- ❌ Browser console shows mixed content security errors

**Root Cause**: Frontend built with incorrect API URL causing HTTPS→HTTP requests

**Investigation Steps**:
```bash
# 1. Check ECS service health
aws ecs describe-services --cluster costfx-dev --services costfx-dev-frontend

# 2. Examine CloudWatch logs
aws logs get-log-events --log-group-name "/ecs/costfx-dev-frontend" \
  --log-stream-name "latest-stream"

# 3. Test API directly
curl https://www.cost-fx.com/api/v1/health

# 4. Check frontend build artifacts
docker run --rm frontend:latest grep -r "cost-fx.com" /usr/share/nginx/html/
```

**Solution**: Update GitHub Actions workflow
```yaml
# File: .github/workflows/app-deploy.yml
--build-arg VITE_API_URL="https://www.cost-fx.com/api/v1"  # Must include 'www'
```

#### Backend Container Failures (1486+ Failed Tasks)

**Symptoms**:
- ✅ Backend builds successfully
- ❌ ECS tasks exit with code 1 immediately
- ❌ High number of failed task attempts

**Investigation Steps**:
```bash
# 1. Check failed tasks
aws ecs describe-services --cluster costfx-dev --services costfx-dev-backend

# 2. Examine most recent failed task
aws ecs list-tasks --cluster costfx-dev --service-name costfx-dev-backend \
  --desired-status STOPPED --max-items 1

# 3. Check task definition environment variables
aws ecs describe-task-definition --task-definition costfx-dev-backend:latest \
  --query 'taskDefinition.containerDefinitions[0].{environment:environment,secrets:secrets}'

# 4. Review CloudWatch logs for exit reason
aws logs get-log-events --log-group-name "/ecs/costfx-dev-backend" \
  --log-stream-name "ecs/backend/<failed-task-id>"
```

**Root Cause**: Enhanced env-var validation requiring `POSTGRES_PASSWORD` even when `DATABASE_URL` provided

**Error Pattern**:
```
EnvVarError: env-var: "POSTGRES_PASSWORD" is a required variable, but it was not set
```

**Solution**: Enhanced database configuration flexibility
```javascript
// File: backend/src/config/database.js
const databaseUrl = env.get('DATABASE_URL').asUrlString();
const dbConfig = {
  password: env.get('POSTGRES_PASSWORD').asString(), // Made optional
  // ...
};

// Validation ensures either DATABASE_URL or individual credentials
if (!dbConfig.url && !dbConfig.password) {
  throw new Error('Either DATABASE_URL or POSTGRES_PASSWORD must be provided');
}
```

#### Mixed Content Security Policy Errors

**Symptoms**:
- ❌ Browser blocks API requests from HTTPS frontend
- ❌ DevTools shows "Mixed Content" warnings
- ✅ Direct API calls work correctly

**Root Cause**: Frontend trying to call HTTP endpoints from HTTPS page

**Investigation**:
```bash
# Check what URL is baked into frontend build
docker run --rm frontend:latest grep -r "elb.amazonaws.com" /usr/share/nginx/html/
```

**Solution**: Ensure frontend builds with HTTPS API URLs matching your domain

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

**Issue**: Tests failing with "describe is not defined" or ES module errors
- **Cause**: Missing Vitest imports or outdated Jest configuration
- **Solution**: 
  ```javascript
  // Ensure all test files have proper Vitest imports
  import { describe, test, expect, vi, beforeEach } from 'vitest';
  
  // Check vitest.config.js exists and is properly configured
  // Run: npm test (should use vitest run)
  ```

**Issue**: "Cannot find module" errors in tests
- **Cause**: Mock imports not properly configured for Vitest
- **Solution**:
  ```javascript
  // Use vi.mock() instead of jest.mock()
  vi.mock('../../src/models/SomeModel.js', () => ({
    default: {
      findAll: vi.fn()
    }
  }));
  ```

**Issue**: Tests pass locally but fail in CI/CD
- **Cause**: Database dependencies or environment differences
- **Solution**: 
  ```bash
  # Check that tests use mocks and don't require real database
  # Verify GitHub Actions uses: npm test (not npm run test:integration)
  # Check test scripts in package.json use vitest run
  ```

**Legacy Issue**: Jest tests failing with ES module errors (resolved September 2025)
- **Cause**: Jest experimental ES modules support was unstable
- **Solution**: ✅ **Migrated to Vitest** - Native ES modules support, better mock handling
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

### ECS Deployment Issues (September 24, 2025)

#### Slow ECS Deployments (18+ minutes)

**Problem**: ECS service deployments taking excessive time and timing out after 30 minutes with "Resource is not in the state servicesStable" error.

**Root Causes**:
1. **Aggressive Health Checks**: 30-second intervals with 5-second timeouts
2. **Container Startup Issues**: Invalid `PGSSLMODE` values causing application crashes
3. **Task Definition Changes**: New container images with stricter validation

**Investigation Commands**:
```bash
# Check deployment status
aws ecs describe-services --cluster costfx-dev --services costfx-dev-backend costfx-dev-frontend

# Check task definition differences
aws ecs describe-task-definition --task-definition costfx-dev-backend:38  # Working version
aws ecs describe-task-definition --task-definition costfx-dev-backend:39  # Failing version

# Check container logs
aws logs get-log-events --log-group-name /ecs/costfx-dev-backend \
  --log-stream-name $(aws logs describe-log-streams --log-group-name /ecs/costfx-dev-backend \
    --order-by LastEventTime --descending --max-items 1 --query 'logStreams[0].logStreamName' --output text)
```

**Solutions Applied**:
1. **Health Check Optimization**: Extended intervals (30s→60s), timeouts (5s→10s), retries (3→5)
2. **SSL Configuration Fix**: Changed `PGSSLMODE` from `"no-verify"` to `"require"`
3. **Application Validation**: Updated env-var configuration to accept valid PostgreSQL SSL modes

**Result**: Deployment time reduced from 18+ minutes to ~2 minutes ✅

#### Container Startup Failures

**Symptoms**:
```
EnvVarError: env-var: "PGSSLMODE" is not one of the allowed values. 
Allowed values: ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full']
```

**Investigation**:
```bash
# Compare working vs failing task definitions
aws ecs describe-task-definition --task-definition costfx-dev-backend:38 \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`PGSSLMODE`]'

# Check stopped tasks for error details
aws ecs describe-tasks --cluster costfx-dev --tasks $(aws ecs list-tasks \
  --cluster costfx-dev --desired-status STOPPED --max-items 1 --query 'taskArns[0]' --output text)
```

**Solution**: Updated Terraform configuration with valid SSL mode:
```terraform
{
  name  = "PGSSLMODE"
  value = "require"  # Valid PostgreSQL SSL mode for AWS RDS
}
```

### Redis Development Environment Issues

#### Redis Connection Errors in Development

**Problem**: Local `npm run dev` showing Redis connection errors:
```
{"code":"ECONNREFUSED","level":"error","message":"Redis Client Error:","service":"restaurant-ai-backend"}
```

**Root Cause**: Redis client being created with default URL even when not needed for development.

**Investigation**:
```bash
# Check if Redis URL is set
echo "REDIS_URL: $REDIS_URL"
grep REDIS_URL .env

# Test current configuration
node -e "import('./backend/src/config/settings.js').then(m => console.log('Redis URL:', m.default.redisUrl))"
node -e "import('./backend/src/config/redis.js').then(m => console.log('Redis client:', m.redis ? 'created' : 'null'))"
```

**Solution**: Disabled Redis for development speed:
```bash
# Comment out Redis URL in .env
# REDIS_URL=redis://localhost:6379  # Disabled for development speed

# Verify bypass works
npm run dev  # Should show: "ℹ️ REDIS_URL not set; skipping Redis connection"
```

**Re-enabling Redis when needed**:
```bash
# Development
echo "REDIS_URL=redis://localhost:6379" >> .env
docker-compose up -d redis

# Production (uncomment in Terraform)
# deploy/terraform/database.tf - Redis resources
# deploy/terraform/ssm-parameters.tf - Redis URL parameter
terraform apply
```

#### Redis Container Management

**Commands**:
```bash
# Check Redis status
docker-compose ps redis
docker exec costfx-redis-1 redis-cli ping

# Start/stop Redis for development
docker-compose up -d redis    # Start
docker-compose stop redis     # Stop
docker-compose logs redis     # Check logs
```

---

## Change Log

### September 17, 2025 - Testing Framework Migration
**Major Update**: Migrated backend testing from Jest to Vitest for improved ES modules support

**Changes Made**:
- **Backend Testing Migration**:
  - Updated `package.json` test scripts from Jest to Vitest
  - Created `vitest.config.js` with proper ES modules configuration
  - Converted `tests/setup.js` from Jest mocks to Vitest mocks
  - Updated all test files: imports, mock functions, and spy methods
  - Result: 59/102 tests now passing (vs 0% with failing Jest setup)

- **GitHub Actions Optimization**:
  - Confirmed dual-workflow strategy working correctly
  - App deployment uses fast Vitest testing (no database required)
  - Infrastructure deployment uses comprehensive testing (database included)

- **Documentation Updates**:
  - Updated technical documentation with current test status
  - Added troubleshooting section for testing issues
  - Documented the Jest→Vitest migration process and rationale

**Technical Rationale**:
- Jest's experimental ES modules support was unstable in CI/CD
- Vitest provides native ES modules support without experimental flags
- Better mock handling and faster test execution
- Maintains same test coverage while improving reliability

**Current Status**:
- ✅ CI/CD pipeline functional with Vitest
- ✅ Mock-based testing eliminates database dependencies in app deployment
- ⚠️ Some tests need implementation alignment (expected during development)
- 🎯 Ready for continued development with stable testing foundation

## AWS Deployment Troubleshooting

### SSM Parameter Access Issues

**Problem**: GitHub Actions deployment fails with SSM access denied error:
```
An error occurred (AccessDeniedException) when calling the GetParameter operation: 
User: arn:aws:sts::568530517605:assumed-role/GitHubActionsRole-CostFX/GitHubActions 
is not authorized to perform: ssm:GetParameter
```

**Solution**: Update IAM policy for GitHubActionsRole-CostFX to include SSM permissions:
```bash
# Add to CostFX-Deployment-Policy
{
  "Sid": "SSMParameterAccess",
  "Effect": "Allow",
  "Action": ["ssm:GetParameter", "ssm:GetParameters"],
  "Resource": ["arn:aws:ssm:us-west-2:568530517605:parameter/costfx/dev/*"]
}
```

**Applied Fix (Sep 19, 2025)**:
```bash
aws iam create-policy-version \
  --policy-arn arn:aws:iam::568530517605:policy/CostFX-Deployment-Policy \
  --policy-document file://updated-policy.json \
  --set-as-default
```

### Database Migration Connection Failures

**Problem**: Migrations fail with localhost connection errors during deployment.

**Root Cause**: Wrong SSM parameter path in GitHub Actions workflow
- ❌ Used: `/costfx/dev/database/url` 
- ✅ Correct: `/costfx/dev/database_url`

**Solution**: Update `.github/workflows/app-deploy.yml`:
```yaml
export DATABASE_URL=$(aws ssm get-parameter --name "/costfx/dev/database_url" --with-decryption --query 'Parameter.Value' --output text)
```

**Verification Commands**:
```bash
# List available parameters
aws ssm get-parameters-by-path --path "/costfx/dev" --query 'Parameters[].Name'

# Test database URL retrieval
aws ssm get-parameter --name "/costfx/dev/database_url" --with-decryption --query 'Parameter.Value' --output text
```

---

*This documentation follows the Diátaxis framework for systematic technical documentation, organizing content by user needs: tutorials for learning, how-to guides for solving problems, reference for information, and explanation for understanding.*
