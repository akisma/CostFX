# Dave's Variance System - Database Schema Requirements

## Current Schema Gaps Analysis

### ❌ Missing Critical Tables for Dave's Requirements

```sql
-- MISSING: Hierarchical Categories (Currently only single enum)
CREATE TABLE ingredient_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_category_id INTEGER REFERENCES ingredient_categories(id),
  level INTEGER NOT NULL, -- 1=Primary (produce), 2=Secondary (leafy_greens), 3=Tertiary (romaine)
  category_path VARCHAR(255), -- 'produce/leafy_greens/romaine'
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MISSING: Period-based Inventory Management
CREATE TABLE inventory_periods (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  period_name VARCHAR(100), -- 'Week 38 2025', 'September 2025'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'open', -- open, closed, locked
  created_by INTEGER, -- User who created period
  closed_date TIMESTAMP,
  locked_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MISSING: Beginning/Ending Inventory Snapshots
CREATE TABLE period_inventory_snapshots (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES inventory_periods(id),
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  snapshot_type VARCHAR(20) NOT NULL, -- 'beginning', 'ending'
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_value DECIMAL(10,2) NOT NULL,
  variance_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(period_id, inventory_item_id, snapshot_type)
);

-- MISSING: Theoretical vs Actual Usage Analysis
CREATE TABLE theoretical_usage_analysis (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES inventory_periods(id),
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  theoretical_quantity DECIMAL(10,2) NOT NULL, -- From recipes × sales
  actual_quantity DECIMAL(10,2) NOT NULL, -- From inventory movement
  variance_quantity DECIMAL(10,2) NOT NULL, -- actual - theoretical
  variance_percentage DECIMAL(5,2), -- (variance / theoretical) × 100
  variance_dollar_value DECIMAL(10,2) NOT NULL, -- variance_qty × unit_cost
  explanation TEXT,
  investigation_status VARCHAR(50) DEFAULT 'pending', -- pending, investigating, resolved
  assigned_to INTEGER, -- User investigating
  resolved_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MISSING: Variance Investigation Workflow
CREATE TABLE variance_investigations (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES inventory_periods(id),
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  variance_type VARCHAR(50) NOT NULL, -- 'high_dollar', 'high_quantity', 'unexplained'
  variance_amount DECIMAL(10,2) NOT NULL,
  priority VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  assigned_to INTEGER,
  status VARCHAR(50) DEFAULT 'open', -- open, investigating, resolved, closed
  resolution_notes TEXT,
  prevention_actions TEXT,
  resolved_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ❌ Current InventoryItem Schema Insufficient

**Current limitations:**
```sql
-- CURRENT: Single-level category enum (insufficient)
category ENUM('produce', 'meat', 'dairy', 'dry_goods', 'beverages', 'other')

-- NEEDED: Hierarchical category references
primary_category_id INTEGER REFERENCES ingredient_categories(id),
secondary_category_id INTEGER REFERENCES ingredient_categories(id),
tertiary_category_id INTEGER REFERENCES ingredient_categories(id),
variance_threshold_quantity DECIMAL(10,2), -- Custom thresholds per item
variance_threshold_dollar DECIMAL(10,2),
high_value_flag BOOLEAN DEFAULT false -- Dave's "saffron vs romaine" logic
```

### ❌ Current InventoryTransaction Schema Missing Fields

**Current limitations:**
```sql
-- CURRENT: Limited transaction types
transactionType ENUM('purchase', 'usage', 'waste', 'adjustment', 'transfer')

-- NEEDED: Additional fields for Dave's requirements
period_id INTEGER REFERENCES inventory_periods(id), -- Link transactions to periods
variance_reason VARCHAR(255), -- Why variance occurred
approved_by INTEGER, -- Who approved the transaction
reference_type VARCHAR(50), -- 'invoice', 'recipe', 'manual', 'transfer'
reference_id INTEGER -- Link to invoice, recipe, etc.
```

## Required API Endpoints (Missing)

```javascript
// Period Management
POST /api/v1/inventory/periods                    // Create new period
PUT  /api/v1/inventory/periods/:id/close          // Close period
GET  /api/v1/inventory/periods/:id/snapshot       // Get period snapshot

// Variance Analysis (Dave's Core Requirements)
POST /api/v1/inventory/variance/period-analysis   // Generate Dave's report
GET  /api/v1/inventory/variance/categories        // Hierarchical breakdown
POST /api/v1/inventory/variance/theoretical-usage // Calculate expected usage
GET  /api/v1/inventory/variance/high-value-alerts // Saffron vs romaine logic

// Investigation Workflow
POST /api/v1/inventory/variance/investigate       // Start investigation
PUT  /api/v1/inventory/variance/:id/resolve       // Mark resolved
```

## Key Data Relationships Missing

```
Period → Beginning Snapshot
Period → Ending Snapshot  
Period → All Transactions (purchases, transfers, waste)
Period → Theoretical Usage (from recipes × sales)
Period → Variance Analysis (theoretical vs actual)
Period → Investigation Workflow

Category Hierarchy:
Primary (produce) → Secondary (leafy_greens) → Tertiary (romaine)
```

## Dave's Specific Requirements Not Addressed

1. **"Date range (From X date inventory - Y date inventory)"** ❌
   - Missing period boundary management
   - No beginning/ending inventory snapshots

2. **"Have one field for quantity usage and another run by dollar value"** ❌  
   - Current schema doesn't separate these metrics
   - No dual-metric variance analysis structure

3. **"I don't care if we are off 20 pounds of romaine... But 4oz of saffron is like $600"** ❌
   - No high-value item flagging system
   - No custom variance thresholds per item

4. **"Break each subsection down further meat: chicken: beef: fish etc"** ❌
   - Current single-level enum insufficient
   - Need unlimited hierarchical drilling

5. **"Theoretical usage"** ❌
   - No recipe-based usage calculation system
   - No sales × recipes = expected consumption logic

## Immediate Actions Required

1. **Create missing database tables** for periods, snapshots, categories
2. **Enhance InventoryItem model** with hierarchical categories  
3. **Add period management** to InventoryTransaction model
4. **Build variance calculation engine** for theoretical vs actual
5. **Implement investigation workflow** for high-value variances
6. **Create hierarchical category seed data** (produce/meat/grocery structure)
