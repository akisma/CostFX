# Dave's Variance System - Final Implementation Plan
## Clean Architecture with PostgreSQL Optimization

**Key Principle**: Database handles data structure and relationships, application layer handles all business logic.

## Phase 1A: Core Hierarchical Category System

### 1. Hierarchical Categories (PostgreSQL ltree approach)

```sql
-- Enable ltree extension for optimal hierarchical queries
CREATE EXTENSION IF NOT EXISTS ltree;

-- Hierarchical category system using PostgreSQL ltree
CREATE TABLE ingredient_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  path ltree NOT NULL UNIQUE, -- 'produce.leafy_greens.romaine'
  level INTEGER NOT NULL CHECK (level >= 1 AND level <= 5),
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  variance_threshold_multiplier DECIMAL(3,2) DEFAULT 1.0, -- Category-specific alert thresholds
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optimized indexes for hierarchical queries
CREATE INDEX idx_categories_path_gist ON ingredient_categories USING GIST (path);
CREATE INDEX idx_categories_path_btree ON ingredient_categories USING BTREE (path);
CREATE INDEX idx_categories_level ON ingredient_categories (level);

-- Seed hierarchical data
INSERT INTO ingredient_categories (name, path, level) VALUES
-- Level 1: Primary categories
('Produce', 'produce', 1),
('Meat', 'meat', 1),
('Grocery', 'grocery', 1),
('Dairy', 'dairy', 1),
-- Level 2: Secondary categories  
('Leafy Greens', 'produce.leafy_greens', 2),
('Root Vegetables', 'produce.root_vegetables', 2),
('Fruits', 'produce.fruits', 2),
('Chicken', 'meat.chicken', 2),
('Beef', 'meat.beef', 2),
('Fish', 'meat.fish', 2),
('Spices', 'grocery.spices', 2),
-- Level 3: Tertiary categories
('Romaine', 'produce.leafy_greens.romaine', 3),
('Spinach', 'produce.leafy_greens.spinach', 3),
('Chicken Breast', 'meat.chicken.breast', 3),
('Chicken Thigh', 'meat.chicken.thigh', 3),
('Ribeye', 'meat.beef.ribeye', 3),
('Strip Steak', 'meat.beef.strip', 3),
('Premium Spices', 'grocery.spices.premium', 3); -- For saffron, etc.
```

### 2. Enhanced InventoryItem Model

```sql
-- Update inventory_items to use hierarchical categories
ALTER TABLE inventory_items 
  DROP COLUMN IF EXISTS category,
  ADD COLUMN category_id INTEGER REFERENCES ingredient_categories(id),
  ADD COLUMN variance_threshold_quantity DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN variance_threshold_dollar DECIMAL(10,2) DEFAULT 50.00,
  ADD COLUMN high_value_flag BOOLEAN DEFAULT false,
  ADD COLUMN theoretical_yield_factor DECIMAL(4,3) DEFAULT 1.000; -- Recipe yield efficiency

-- Indexes for performance
CREATE INDEX idx_inventory_category ON inventory_items (category_id);
CREATE INDEX idx_inventory_high_value ON inventory_items (high_value_flag);
CREATE INDEX idx_inventory_variance_thresholds ON inventory_items (variance_threshold_dollar);
```

### 3. Period-Based Inventory Management

```sql
-- Inventory periods for Dave's "From X date to Y date" analysis
CREATE TABLE inventory_periods (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  period_name VARCHAR(100) NOT NULL, -- 'Week 38 2025', 'Sept 1-15, 2025'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed', 'locked')),
  beginning_inventory_locked BOOLEAN DEFAULT false,
  ending_inventory_locked BOOLEAN DEFAULT false,
  created_by INTEGER, -- User who created the period
  closed_by INTEGER,   -- User who closed the period
  closed_at TIMESTAMP,
  locked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_period_dates CHECK (period_end >= period_start),
  CONSTRAINT unique_restaurant_period UNIQUE (restaurant_id, period_start, period_end)
);

-- Indexes for period queries
CREATE INDEX idx_periods_restaurant_dates ON inventory_periods (restaurant_id, period_start, period_end);
CREATE INDEX idx_periods_status ON inventory_periods (status);
```

### 4. Period Inventory Snapshots (Dave's Beginning/Ending Inventory)

```sql
CREATE TABLE period_inventory_snapshots (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES inventory_periods(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  snapshot_type VARCHAR(20) NOT NULL CHECK (snapshot_type IN ('beginning', 'ending')),
  
  -- Quantity and cost tracking
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_value DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  
  -- Metadata
  counted_by INTEGER, -- User who performed physical count
  counted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  variance_notes TEXT,
  adjustment_reason VARCHAR(255),
  verified BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one snapshot per item per type per period
  CONSTRAINT unique_period_item_snapshot UNIQUE (period_id, inventory_item_id, snapshot_type)
);

-- Indexes for snapshot queries  
CREATE INDEX idx_snapshots_period ON period_inventory_snapshots (period_id);
CREATE INDEX idx_snapshots_item ON period_inventory_snapshots (inventory_item_id);
CREATE INDEX idx_snapshots_type ON period_inventory_snapshots (snapshot_type);
CREATE INDEX idx_snapshots_verification ON period_inventory_snapshots (verified);
```

## Phase 1B: Enhanced Transaction Tracking

### 5. Enhanced InventoryTransaction Model

```sql
-- Add period linkage and variance tracking to existing transactions
ALTER TABLE inventory_transactions
  ADD COLUMN period_id INTEGER REFERENCES inventory_periods(id),
  ADD COLUMN variance_reason VARCHAR(255),
  ADD COLUMN variance_category VARCHAR(50), -- 'waste', 'theft', 'measurement_error', 'spoilage'
  ADD COLUMN approved_by INTEGER,
  ADD COLUMN reference_type VARCHAR(50), -- 'invoice', 'recipe', 'manual', 'transfer', 'count'
  ADD COLUMN reference_id INTEGER,
  ADD COLUMN is_variance_adjustment BOOLEAN DEFAULT false;

-- Ensure transaction type includes transfers
ALTER TABLE inventory_transactions 
  DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check,
  ADD CONSTRAINT inventory_transactions_transaction_type_check 
    CHECK (transaction_type IN ('purchase', 'usage', 'waste', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out'));

-- Additional indexes for variance analysis
CREATE INDEX idx_transactions_period ON inventory_transactions (period_id);
CREATE INDEX idx_transactions_variance ON inventory_transactions (is_variance_adjustment);
CREATE INDEX idx_transactions_reference ON inventory_transactions (reference_type, reference_id);
```

## Phase 1C: Theoretical vs Actual Usage System

### 6. Theoretical Usage Analysis

```sql
-- Theoretical vs actual usage tracking (Dave's core requirement)
CREATE TABLE theoretical_usage_analysis (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES inventory_periods(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  
  -- Usage calculations
  theoretical_quantity DECIMAL(10,2) NOT NULL, -- From recipes × sales
  actual_quantity DECIMAL(10,2) NOT NULL,      -- From inventory movement
  
  -- Variance metrics (Dave's dual requirements)
  variance_quantity DECIMAL(10,2) NOT NULL, -- Calculated in application layer
  variance_percentage DECIMAL(8,4), -- Calculated in application layer  
  variance_dollar_value DECIMAL(10,2) NOT NULL, -- Calculated in application layer
  
  -- Priority determined by business logic in InventoryVarianceAgent
  priority VARCHAR(20), -- 'critical', 'high', 'medium', 'low' - set by application
  
  -- Investigation tracking
  explanation TEXT,
  investigation_status VARCHAR(50) DEFAULT 'pending' CHECK (investigation_status IN ('pending', 'investigating', 'resolved', 'accepted')),
  assigned_to INTEGER,
  investigated_by INTEGER,
  resolved_at TIMESTAMP,
  
  -- Metadata
  calculation_method VARCHAR(50) DEFAULT 'recipe_based', -- 'recipe_based', 'historical_average', 'manual'
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one analysis per item per period
  CONSTRAINT unique_period_item_analysis UNIQUE (period_id, inventory_item_id)
);

-- Indexes for variance analysis queries
CREATE INDEX idx_theoretical_period ON theoretical_usage_analysis (period_id);
CREATE INDEX idx_theoretical_item ON theoretical_usage_analysis (inventory_item_id);
CREATE INDEX idx_theoretical_priority ON theoretical_usage_analysis (priority);
CREATE INDEX idx_theoretical_dollar_variance ON theoretical_usage_analysis (variance_dollar_value);
CREATE INDEX idx_theoretical_investigation ON theoretical_usage_analysis (investigation_status);
```

### 7. Variance Investigation Workflow

```sql
-- Workflow tracking for variance investigations
CREATE TABLE variance_investigations (
  id SERIAL PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES inventory_periods(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  theoretical_usage_id INTEGER REFERENCES theoretical_usage_analysis(id) ON DELETE CASCADE,
  
  -- Investigation details
  variance_type VARCHAR(50) NOT NULL, -- 'high_dollar', 'high_quantity', 'unexplained', 'pattern'
  variance_amount DECIMAL(10,2) NOT NULL,
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  -- Workflow status
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'pending_approval', 'resolved', 'closed')),
  assigned_to INTEGER,
  assigned_at TIMESTAMP,
  
  -- Resolution tracking
  root_cause VARCHAR(255),
  resolution_notes TEXT,
  prevention_actions TEXT,
  process_changes TEXT,
  resolved_by INTEGER,
  approved_by INTEGER,
  resolved_at TIMESTAMP,
  
  -- Recurrence tracking
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(100), -- 'weekly', 'monthly', 'seasonal'
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for investigation workflow
CREATE INDEX idx_investigations_period ON variance_investigations (period_id);
CREATE INDEX idx_investigations_status ON variance_investigations (status);
CREATE INDEX idx_investigations_priority ON variance_investigations (priority);
CREATE INDEX idx_investigations_assigned ON variance_investigations (assigned_to);
CREATE INDEX idx_investigations_recurring ON variance_investigations (is_recurring);
```

## Hierarchical Query Examples (PostgreSQL ltree)

```sql
-- Get all subcategories under 'meat'
SELECT * FROM ingredient_categories 
WHERE path <@ 'meat';

-- Get all items in produce category and subcategories
SELECT ii.name, ic.path 
FROM inventory_items ii
JOIN ingredient_categories ic ON ii.category_id = ic.id
WHERE ic.path <@ 'produce';

-- Dave's category breakdown query
SELECT 
  ic.path,
  ic.name,
  COUNT(ii.id) as item_count,
  SUM(CASE WHEN ii.high_value_flag THEN 1 ELSE 0 END) as high_value_items
FROM ingredient_categories ic
LEFT JOIN inventory_items ii ON ii.category_id = ic.id
WHERE ic.path ~ 'meat.*{1,2}' -- Max 2 levels under meat
GROUP BY ic.path, ic.name
ORDER BY ic.path;
```

## Business Logic Architecture (Clean Separation)

### Database Responsibilities
- ✅ Data storage and relationships
- ✅ Referential integrity via foreign keys
- ✅ Data validation via constraints  
- ✅ Query optimization via indexes
- ❌ NO business logic or calculations

### Application Layer Responsibilities (InventoryVarianceAgent)
- ✅ Dave's variance priority logic ("saffron vs romaine")
- ✅ Theoretical vs actual calculations
- ✅ Investigation workflow decisions
- ✅ Dynamic threshold adjustments
- ✅ All business rule modifications

```javascript
// Example: Dave's business logic in InventoryVarianceAgent.js
class InventoryVarianceAgent extends BaseAgent {
  
  calculateVariancePriority(varianceDollarValue, item) {
    // Dave's logic: "I don't care if we are off 20 pounds of romaine, 
    // but 4oz of saffron is like $600"
    const absVariance = Math.abs(varianceDollarValue);
    const threshold = item.varianceThresholdDollar || 50;
    
    if (absVariance >= threshold * 2) return 'critical';
    if (absVariance >= threshold) return 'high';
    if (absVariance >= threshold * 0.5) return 'medium';
    return 'low';
  }
  
  async analyzeTheoreticalVsActual(restaurantId, startDate, endDate) {
    // 1. Get data from database (no logic there)
    const theoreticalUsage = await this.calculateTheoreticalUsage(restaurantId, startDate, endDate);
    const actualUsage = await this.calculateActualUsage(restaurantId, startDate, endDate);
    
    // 2. Apply business logic here
    const analyses = theoreticalUsage.map(item => {
      const actual = actualUsage.find(a => a.inventoryItemId === item.inventoryItemId);
      const varianceQuantity = actual.quantity - item.quantity;
      const varianceDollarValue = varianceQuantity * item.unitCost;
      const priority = this.calculateVariancePriority(varianceDollarValue, item);
      
      return {
        inventoryItemId: item.inventoryItemId,
        theoreticalQuantity: item.quantity,
        actualQuantity: actual.quantity,
        varianceQuantity,
        varianceDollarValue,
        priority,
        requiresInvestigation: ['critical', 'high'].includes(priority)
      };
    });
    
    // 3. Save results to database (data only)
    await this.saveVarianceAnalysis(analyses);
    return analyses;
  }
}
```

## Performance Considerations

1. **Indexes optimized for Dave's queries** (category hierarchy, variance analysis)
2. **Business logic in application layer** (InventoryVarianceAgent) not database
3. **Proper constraints** for data integrity only
4. **ltree indexes** for fast hierarchical queries
5. **Partitioning consideration** for large transaction volumes

## Data Integrity Rules

1. **Foreign key constraints** maintain referential integrity
2. **Check constraints** ensure valid data ranges and statuses
3. **Unique constraints** prevent duplicate periods/snapshots
4. **Application-calculated fields** for business logic consistency
5. **Triggers for audit trails** (timestamps, user tracking only)
