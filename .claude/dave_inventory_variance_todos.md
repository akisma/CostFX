# Dave's Inventory Variance Management - Implementation TODO List

This is a comprehensive implementation plan for enhancing the CostFX Restaurant AI system with Dave's inventory variance management requirements. The key business requirement: **"I don't care if we are off 20 pounds of romaine, but 4oz of saffron is like $600"** - dual-metric variance analysis prioritizing high-value items.

## Project Overview

- **System**: CostFX Restaurant AI (Node.js/Express + React + PostgreSQL)
- **Current Status**: 151/151 tests passing (100% coverage)
- **Enhancement**: Add InventoryVarianceAgent with hierarchical categories and period-based analysis
- **Architecture**: Clean separation - PostgreSQL for data structure, application layer for business logic

---

## Phase 1: Database Schema Implementation

### ✅ 1. Create Hierarchical Category System
**Status**: COMPLETED ✅  
**Description**: Install PostgreSQL ltree extension and create hierarchical ingredient_categories table with ltree paths. Include seed data for produce → leafy_greens → romaine hierarchy structure.
**Files**: 
- ✅ `backend/src/migrations/20250824000004-create-ingredient-categories.js`
- ✅ `backend/tests/integration/ingredientCategories.test.js`
**Implementation Notes**: 
- PostgreSQL ltree extension enabled for efficient hierarchical queries
- GIST indexes created for optimal performance on path operations
- Seed data includes Dave's test scenarios (romaine vs saffron)
- 6 new tests added with proper mocking (108/108 tests passing)
- Clean separation: ltree for storage, business logic in application layer

### ✅ 2. Build Period Management Tables
**Status**: COMPLETED ✅  
**Description**: Create inventory_periods table for Dave's date range analysis with period_start, period_end, and status fields. Include proper constraints and indexes.
**Files**: 
- ✅ `backend/migrations/1726790000003_create-inventory-periods.js` (already existed)
- ✅ `backend/src/models/InventoryPeriod.js` (created with full business logic)
**Implementation Notes**: 
- Migration already existed with comprehensive schema including ENUM types, constraints, and indexes
- Created full Sequelize model with Dave's business logic methods (status transitions, overlap validation, period lifecycle)
- All 8 integration tests passing (116/116 total tests passing)
- Clean separation: PostgreSQL schema + application-layer business logic

### ✅ 3. Implement Period Snapshot System
**Status**: COMPLETED ✅  
**Description**: Create period_inventory_snapshots table for beginning/ending inventory tracking per period. Include quantity, unit_cost, and snapshot_type fields.
**Files**: 
- ✅ `backend/migrations/1726790000005_create-period-inventory-snapshots.js` (already existed)
- ✅ `backend/src/models/PeriodInventorySnapshot.js` (created with full business logic)
- ✅ `backend/tests/integration/periodInventorySnapshots.test.js` (9 comprehensive tests)
**Implementation Notes**: 
- Migration already existed with comprehensive schema including ENUM types, unique constraints, and performance indexes
- Created full Sequelize model with Dave's variance calculation methods, verification workflow, and bulk operations
- All 9 integration tests passing (125/125 total tests passing)
- Supports Dave's core workflow: beginning counts → ending counts → variance analysis → verification

### ☐ 4. Enhance InventoryItem Model
**Status**: Not Started  
**Description**: Update existing inventory_items table to reference hierarchical categories and add variance threshold fields. Create migration to preserve existing data.
**Files**: `backend/migrations/`, `backend/models/InventoryItem.js`

### ☐ 5. Extend InventoryTransaction Model
**Status**: Not Started  
**Description**: Add period_id, variance_reason, and reference tracking fields to existing inventory_transactions table. Ensure backward compatibility.
**Files**: `backend/migrations/`, `backend/models/InventoryTransaction.js`

### ☐ 6. Build Theoretical Usage Analysis Table
**Status**: Not Started  
**Description**: Create theoretical_usage_analysis table for storing variance calculations and investigation status. Include all variance metrics as data fields (no generated columns).
**Files**: `backend/migrations/`

### ☐ 7. Implement Investigation Workflow Table
**Status**: Not Started  
**Description**: Create variance_investigations table for tracking investigation workflow, assignments, and resolution status.
**Files**: `backend/migrations/`

---

## Phase 2: Data Models & Business Logic

### ☐ 8. Update Sequelize Models
**Status**: Not Started  
**Description**: Update Sequelize models to match new database schema including ltree support, period relationships, and hierarchical category associations.
**Files**: `backend/models/`

### ☐ 9. Build InventoryVarianceAgent
**Status**: Not Started  
**Description**: Create InventoryVarianceAgent class with methods for Dave's business logic: calculateVariancePriority, analyzeTheoreticalVsActual, and flagHighValueVariances.
**Files**: `backend/src/agents/InventoryVarianceAgent.js`

### ☐ 10. Create Theoretical Usage Calculator
**Status**: Not Started  
**Description**: Implement theoretical usage calculation logic based on recipe requirements × sales data for specified date ranges.
**Files**: `backend/src/agents/InventoryVarianceAgent.js`

### ☐ 11. Create Actual Usage Calculator
**Status**: Not Started  
**Description**: Build actual usage calculation from inventory transaction analysis between period snapshots.
**Files**: `backend/src/agents/InventoryVarianceAgent.js`

### ☐ 12. Build Period Management Logic
**Status**: Not Started  
**Description**: Implement period management methods: createPeriod, closePeriod, createSnapshots, and lockPeriod with proper validation.
**Files**: `backend/src/agents/InventoryVarianceAgent.js`

### ☐ 13. Implement Category Hierarchy Queries
**Status**: Not Started  
**Description**: Create hierarchical category query methods using PostgreSQL ltree operators for Dave's category drilling requirements.
**Files**: `backend/src/agents/InventoryVarianceAgent.js`

---

## Phase 3: API Development

### ☐ 14. Create Period Management APIs
**Status**: Not Started  
**Description**: Build API endpoints for period management: POST /periods, PUT /periods/:id/close, GET /periods/:id/snapshot
**Files**: `backend/src/routes/periods.js`, `backend/src/controllers/periodController.js`

### ☐ 15. Build Variance Analysis APIs
**Status**: Not Started  
**Description**: Implement variance analysis API endpoints: POST /variance/period-analysis, GET /variance/categories with hierarchical breakdown support.
**Files**: `backend/src/routes/variance.js`, `backend/src/controllers/varianceController.js`

### ☐ 16. Implement Investigation APIs
**Status**: Not Started  
**Description**: Create investigation workflow API endpoints: POST /variance/investigate, PUT /variance/:id/resolve with status tracking.
**Files**: `backend/src/routes/investigations.js`, `backend/src/controllers/investigationController.js`

---

## Phase 4: Frontend Components

### ☐ 17. Create Period Selection Component
**Status**: Not Started  
**Description**: Build React component for period selection with date range picker and preset options (This Week, Last Week, This Month, Custom Range).
**Files**: `frontend/src/components/variance/PeriodSelector.jsx`

### ☐ 18. Build Category Drilling Interface
**Status**: Not Started  
**Description**: Implement hierarchical category drilling component with breadcrumb navigation and ltree-based category breakdown.
**Files**: `frontend/src/components/variance/CategoryDrilldown.jsx`

### ☐ 19. Develop Variance Analysis Table
**Status**: Not Started  
**Description**: Create dual-metric variance table component sortable by quantity or dollar value with Dave's prioritization logic.
**Files**: `frontend/src/components/variance/VarianceTable.jsx`

### ☐ 20. Create Investigation Workflow UI
**Status**: Not Started  
**Description**: Build investigation workflow components for assigning, tracking, and resolving high-value variances.
**Files**: `frontend/src/components/variance/InvestigationWorkflow.jsx`

### ☐ 21. Build Variance Dashboard Interface
**Status**: Not Started  
**Description**: Implement variance dashboard with executive summary cards, priority alerts, and category breakdown views.
**Files**: `frontend/src/components/variance/VarianceDashboard.jsx`

---

## Phase 5: Testing & Quality Assurance

### ☐ 22. Test Variance Agent Logic
**Status**: Not Started  
**Description**: Create comprehensive unit tests for InventoryVarianceAgent business logic including Dave's priority calculations and threshold logic.
**Files**: `backend/tests/unit/agents/InventoryVarianceAgent.test.js`

### ☐ 23. Test Period Management
**Status**: Not Started  
**Description**: Build integration tests for period management workflow including snapshot creation and period closing procedures.
**Files**: `backend/tests/integration/periodManagement.test.js`

### ☐ 24. Test Variance Analysis APIs
**Status**: Not Started  
**Description**: Implement API integration tests for all variance analysis endpoints with realistic data scenarios.
**Files**: `backend/tests/integration/varianceAPI.test.js`

### ☐ 25. Test Frontend Components
**Status**: Not Started  
**Description**: Create frontend component tests for hierarchical drilling, variance tables, and investigation workflow.
**Files**: `frontend/tests/components/variance/`

---

## Phase 6: Data & Performance Optimization

### ☐ 26. Create Sample Data Generator
**Status**: Not Started  
**Description**: Generate realistic sample data including hierarchical categories, multiple restaurants, varied periods, and diverse variance scenarios.
**Files**: `backend/scripts/generate-variance-sample-data.js`

### ☐ 27. Generate Dave's Test Scenarios
**Status**: Not Started  
**Description**: Build test data sets covering Dave's specific scenarios: high-value items (saffron), low-value items (romaine), and mixed variance patterns.
**Files**: `backend/scripts/dave-test-scenarios.js`

### ☐ 28. Optimize Database Performance
**Status**: Not Started  
**Description**: Create database indexing optimization for hierarchical queries, period analysis, and variance sorting performance.
**Files**: `backend/migrations/`, database indexes

### ☐ 29. Optimize Hierarchical Queries
**Status**: Not Started  
**Description**: Implement query optimization for ltree category queries and large-scale variance analysis operations.
**Files**: `backend/src/agents/InventoryVarianceAgent.js`

---

## Phase 7: Documentation & Deployment

### ☐ 30. Update Technical Documentation
**Status**: Not Started  
**Description**: Update technical specification document with final implementation details, API documentation, and deployment requirements.
**Files**: `.claude/restaurant_ai_tech_spec.md`, API documentation

---

## Key Business Requirements Reference

### Dave's Core Requirement
> "I don't care if we are off 20 pounds of romaine, but 4oz of saffron is like $600"

### Implementation Priorities
1. **Dual-Metric Analysis**: Quantity variance vs Dollar value variance
2. **Hierarchical Categories**: Produce → Leafy Greens → Romaine (ltree)
3. **Period-Based Analysis**: Beginning inventory → Usage → Ending inventory
4. **Theoretical vs Actual**: Recipe requirements vs actual consumption
5. **Investigation Workflow**: Track high-value variance resolution

### Architecture Principles
- **Clean Architecture**: Business logic in application layer (InventoryVarianceAgent)
- **Data Structure**: PostgreSQL ltree for hierarchical categories
- **Performance**: Optimized queries for large-scale variance analysis
- **Testing**: Maintain 100% test coverage throughout implementation

---

## Progress Tracking

Use the following commands to track progress:
```bash
# Mark item as in-progress
manage_todo_list --mark-progress <item_id>

# Mark item as completed  
manage_todo_list --mark-complete <item_id>

# Add new items as requirements evolve
manage_todo_list --add-item "New requirement description"
```

---

*Last Updated: September 23, 2025*
*System Status: 125/125 tests passing (100% coverage maintained)*
*Current Phase: Database Schema Implementation - Tasks 1-3 Complete*
*Next: Task 4 - Enhance InventoryItem Model*
