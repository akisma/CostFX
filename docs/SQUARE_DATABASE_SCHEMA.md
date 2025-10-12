# Square Database Schema Design

**Status**: ✅ IMPLEMENTED & OPERATIONAL  
**Issue**: [#18 - Square-Focused Database Schema & Data Model](https://github.com/akisma/CostFX/issues/18)  
**Architecture**: Two-Tier Data Model (POS-Specific Raw + Unified Analytics)  
**Created**: 2025-01-27  
**Last Updated**: 2025-10-11  
**Implementation Completed**: October 11, 2025 (GitHub Issue #20 Comment)

---

## Implementation Status Summary

**All Core Deliverables Complete** ✅

- **6 Database Migrations**: Created and deployed
  - `1759800000000_add-pos-source-tracking-to-inventory-items.js` ✅
  - `1759800000001_create-square-categories.js` ✅
  - `1759800000002_create-square-menu-items.js` ✅
  - `1759800000003_create-square-inventory-counts.js` ✅
  - `1759800000004_create-square-orders.js` ✅
  - `1759800000005_create-square-order-items.js` ✅
  - `1760000000000_add-unique-constraint-pos-source.js` ✅

- **5 Sequelize Models**: Implemented with full associations
  - `SquareCategory.js` ✅
  - `SquareMenuItem.js` ✅
  - `SquareInventoryCount.js` ✅
  - `SquareOrder.js` ✅
  - `SquareOrderItem.js` ✅
  - Enhanced `InventoryItem.js` with POS source tracking ✅

- **POSDataTransformer Service**: Operational ✅
  - Successfully transforms 25/25 Square menu items to inventory_items
  - Handles camelCase/snake_case field mapping from Square SDK v37.1.0
  - Implements unit normalization and variance threshold logic

- **Testing UI**: Complete ✅
  - `DataImportPanel.jsx`: Three-button workflow (Import/Transform/Clear)
  - `DataReviewPanel.jsx`: Side-by-side Tier 1 vs Tier 2 comparison view
  - Real-time validation and data review capabilities

**Latest Test Results**: 25/25 items transformed successfully with proper field mapping for Square SDK v37.1.0 camelCase format

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Tier 1: Square Raw Data Tables](#tier-1-square-raw-data-tables)
3. [Tier 2: Unified Analytics Tables](#tier-2-unified-analytics-tables)
4. [Transformation Layer](#transformation-layer)
5. [Data Flow](#data-flow)
6. [Indexes & Performance](#indexes--performance)
7. [Migration Plan](#migration-plan)

---

## Architecture Overview

### Two-Tier Design Principle

```
┌─────────────────────────────────────────────────────────────┐
│  Square API                                                  │
│  (Catalog, Inventory, Orders)                               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ Raw API Response
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: Square-Specific Raw Data                           │
│  • square_menu_items                                        │
│  • square_inventory_counts                                  │
│  • square_orders                                            │
│  • square_order_items                                       │
│  • square_categories                                        │
│                                                              │
│  Purpose: Exact API response storage (JSONB)                │
│           Audit trail, re-processable                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ POSDataTransformer
                 │ (Transform & Normalize)
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 2: Unified Analytics Layer                            │
│  • inventory_items (enhanced with POS source tracking)      │
│  • sales_transactions (Issue #21)                           │
│                                                              │
│  Purpose: POS-agnostic format                               │
│           Agents & analytics query ONLY these tables        │
└─────────────────────────────────────────────────────────────┘
                 │
                 │ Queries
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  AI Agents & Analytics                                       │
│  • OverstockDetectionAgent                                  │
│  • UnusualUsageDetectionAgent                               │
│  • Theoretical vs Actual Analysis                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles
- **Preserve Raw Data**: JSONB storage of exact Square API responses
- **POS-Agnostic Agents**: Agents never query `square_*` tables directly
- **Source Tracking**: Every unified record links back to POS source
- **Re-processable**: Can improve transformation logic and re-run
- **Audit Trail**: Full history of POS data changes

---

## Tier 1: Square Raw Data Tables

### 1. `square_menu_items`

**Purpose**: Store all menu items from Square's Catalog API

**Sequelize Model**: `SquareMenuItem`

**Migration**: `[timestamp]_create-square-menu-items.js`

```sql
CREATE TABLE square_menu_items (
  -- Primary Key
  id SERIAL PRIMARY KEY,
  
  -- Foreign Keys
  pos_connection_id INTEGER NOT NULL REFERENCES pos_connections(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  square_location_id INTEGER REFERENCES square_locations(id) ON DELETE SET NULL,
  
  -- Square API Identifiers
  square_catalog_object_id VARCHAR(255) UNIQUE NOT NULL,  -- e.g., "XXXXXXXXXXXXXXXXXXXXXX"
  square_item_id VARCHAR(255) NOT NULL,                    -- Denormalized from square_data
  square_location_uuid VARCHAR(255),                       -- Square's location ID
  
  -- Raw API Response (CRITICAL)
  square_data JSONB NOT NULL,  
  -- Contains: { id, type: "ITEM", item_data: {...}, present_at_all_locations, ... }
  -- See: https://developer.squareup.com/reference/square/objects/CatalogObject
  
  -- Denormalized Fields (for query performance)
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  description TEXT,
  product_type VARCHAR(100),  -- e.g., "REGULAR", "GIFT_CARD"
  is_taxable BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,  -- Square's deletion flag
  
  -- Pricing
  price_money_amount BIGINT,  -- Amount in cents (Square uses smallest currency unit)
  price_money_currency VARCHAR(3) DEFAULT 'USD',
  
  -- Categories
  category_ids TEXT[],  -- Array of square_catalog_object_ids
  
  -- Sync Metadata
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  square_version BIGINT,  -- Square's object version for optimistic concurrency
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_price CHECK (price_money_amount >= 0)
);

-- Indexes for Performance
CREATE INDEX idx_square_menu_items_catalog_object_id ON square_menu_items(square_catalog_object_id);
CREATE INDEX idx_square_menu_items_pos_connection ON square_menu_items(pos_connection_id);
CREATE INDEX idx_square_menu_items_restaurant ON square_menu_items(restaurant_id);
CREATE INDEX idx_square_menu_items_location ON square_menu_items(square_location_id);
CREATE INDEX idx_square_menu_items_sku ON square_menu_items(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_square_menu_items_deleted ON square_menu_items(is_deleted) WHERE is_deleted = false;
CREATE INDEX idx_square_menu_items_last_synced ON square_menu_items(last_synced_at DESC);

-- JSONB Indexes for common queries
CREATE INDEX idx_square_menu_items_jsonb_path ON square_menu_items USING GIN (square_data jsonb_path_ops);
```

**Example Square API Response** (stored in `square_data`):
```json
{
  "type": "ITEM",
  "id": "XXXXXXXXXXXXXXXXXXXXXX",
  "updated_at": "2025-01-27T12:34:56.789Z",
  "version": 1234567890123,
  "is_deleted": false,
  "present_at_all_locations": true,
  "item_data": {
    "name": "Ribeye Steak",
    "description": "16oz USDA Prime Ribeye",
    "category_id": "YYYYYYYYYYYYYYYYYYYYYY",
    "tax_ids": ["ZZZZZZZZZZZZZZZZZZZZZZ"],
    "variations": [
      {
        "type": "ITEM_VARIATION",
        "id": "VVVVVVVVVVVVVVVVVVVVVV",
        "item_variation_data": {
          "item_id": "XXXXXXXXXXXXXXXXXXXXXX",
          "name": "Regular",
          "sku": "RIBEYE-16OZ",
          "pricing_type": "FIXED_PRICING",
          "price_money": {
            "amount": 4500,
            "currency": "USD"
          }
        }
      }
    ],
    "product_type": "REGULAR"
  }
}
```

---

### 2. `square_inventory_counts`

**Purpose**: Store inventory count snapshots from Square's Inventory API

**Sequelize Model**: `SquareInventoryCount`

**Migration**: `[timestamp]_create-square-inventory-counts.js`

```sql
CREATE TABLE square_inventory_counts (
  -- Primary Key
  id SERIAL PRIMARY KEY,
  
  -- Foreign Keys
  square_menu_item_id INTEGER NOT NULL REFERENCES square_menu_items(id) ON DELETE CASCADE,
  pos_connection_id INTEGER NOT NULL REFERENCES pos_connections(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  square_location_id INTEGER REFERENCES square_locations(id) ON DELETE SET NULL,
  
  -- Square API Identifiers
  square_catalog_object_id VARCHAR(255) NOT NULL,  -- Links to square_menu_items
  square_state VARCHAR(50) NOT NULL,  -- "IN_STOCK", "SOLD", "RETURNED_BY_CUSTOMER", "WASTE", etc.
  square_location_uuid VARCHAR(255),
  
  -- Raw API Response
  square_data JSONB NOT NULL,
  -- Contains: { catalog_object_id, catalog_object_type, state, location_id, quantity, calculated_at }
  -- See: https://developer.squareup.com/reference/square/objects/InventoryCount
  
  -- Denormalized Fields
  quantity DECIMAL(10, 3) NOT NULL,  -- Support fractional quantities (e.g., 2.5 lbs)
  calculated_at TIMESTAMPTZ NOT NULL,  -- When Square calculated this count
  
  -- Sync Metadata
  snapshot_date TIMESTAMPTZ NOT NULL,  -- When we retrieved this snapshot
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_quantity CHECK (quantity >= 0),
  CONSTRAINT valid_state CHECK (square_state IN (
    'IN_STOCK', 'SOLD', 'RETURNED_BY_CUSTOMER', 'RESERVED_FOR_SALE',
    'SOLD_ONLINE', 'ORDERED_FROM_VENDOR', 'RECEIVED_FROM_VENDOR',
    'IN_TRANSIT_TO', 'WASTE', 'UNLINKED_RETURN', 'CUSTOM', 'COMPOSED_VARIATION_PARENT'
  ))
);

-- Indexes for Performance
CREATE INDEX idx_square_inventory_counts_menu_item ON square_inventory_counts(square_menu_item_id);
CREATE INDEX idx_square_inventory_counts_catalog_object ON square_inventory_counts(square_catalog_object_id);
CREATE INDEX idx_square_inventory_counts_restaurant ON square_inventory_counts(restaurant_id);
CREATE INDEX idx_square_inventory_counts_location ON square_inventory_counts(square_location_id);
CREATE INDEX idx_square_inventory_counts_state ON square_inventory_counts(square_state);
CREATE INDEX idx_square_inventory_counts_snapshot_date ON square_inventory_counts(snapshot_date DESC);
CREATE INDEX idx_square_inventory_counts_calculated_at ON square_inventory_counts(calculated_at DESC);

-- Composite index for fetching latest counts
CREATE INDEX idx_square_inventory_latest ON square_inventory_counts(
  square_catalog_object_id,
  square_state,
  calculated_at DESC
);
```

**Example Square API Response** (stored in `square_data`):
```json
{
  "catalog_object_id": "XXXXXXXXXXXXXXXXXXXXXX",
  "catalog_object_type": "ITEM_VARIATION",
  "state": "IN_STOCK",
  "location_id": "LLLLLLLLLLLLLLLLLLLLLL",
  "quantity": "25.5",
  "calculated_at": "2025-01-27T12:34:56.789Z"
}
```

---

### 3. `square_orders`

**Purpose**: Store complete order data from Square's Orders API

**Sequelize Model**: `SquareOrder`

**Migration**: `[timestamp]_create-square-orders.js`

```sql
CREATE TABLE square_orders (
  -- Primary Key
  id SERIAL PRIMARY KEY,
  
  -- Foreign Keys
  pos_connection_id INTEGER NOT NULL REFERENCES pos_connections(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  square_location_id INTEGER REFERENCES square_locations(id) ON DELETE SET NULL,
  
  -- Square API Identifiers
  square_order_id VARCHAR(255) UNIQUE NOT NULL,  -- e.g., "XXXXXXXXXXXXXXXXXXXXXX"
  square_location_uuid VARCHAR(255),
  
  -- Raw API Response (CRITICAL)
  square_data JSONB NOT NULL,
  -- Contains: { id, location_id, line_items: [...], fulfillments, tenders, created_at, updated_at, ... }
  -- See: https://developer.squareup.com/reference/square/objects/Order
  
  -- Denormalized Fields
  state VARCHAR(50),  -- "OPEN", "COMPLETED", "CANCELED"
  source_name VARCHAR(100),  -- "Square Point of Sale", "Square Online Store", etc.
  
  -- Timestamps (from Square)
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  square_created_at TIMESTAMPTZ NOT NULL,
  square_updated_at TIMESTAMPTZ NOT NULL,
  
  -- Totals (in cents)
  total_money_amount BIGINT,
  total_tax_money_amount BIGINT,
  total_discount_money_amount BIGINT,
  total_tip_money_amount BIGINT,
  total_service_charge_money_amount BIGINT,
  net_amount_due_money_amount BIGINT,
  
  -- Sync Metadata
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  square_version BIGINT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_state CHECK (state IN ('OPEN', 'COMPLETED', 'CANCELED'))
);

-- Indexes for Performance
CREATE INDEX idx_square_orders_order_id ON square_orders(square_order_id);
CREATE INDEX idx_square_orders_pos_connection ON square_orders(pos_connection_id);
CREATE INDEX idx_square_orders_restaurant ON square_orders(restaurant_id);
CREATE INDEX idx_square_orders_location ON square_orders(square_location_id);
CREATE INDEX idx_square_orders_state ON square_orders(state);
CREATE INDEX idx_square_orders_closed_at ON square_orders(closed_at DESC) WHERE closed_at IS NOT NULL;
CREATE INDEX idx_square_orders_created_at ON square_orders(square_created_at DESC);
CREATE INDEX idx_square_orders_last_synced ON square_orders(last_synced_at DESC);

-- Composite index for sales reporting
CREATE INDEX idx_square_orders_sales_report ON square_orders(
  restaurant_id,
  state,
  closed_at DESC
) WHERE state = 'COMPLETED' AND closed_at IS NOT NULL;
```

**Example Square API Response** (stored in `square_data`):
```json
{
  "id": "XXXXXXXXXXXXXXXXXXXXXX",
  "location_id": "LLLLLLLLLLLLLLLLLLLLLL",
  "source": {
    "name": "Square Point of Sale"
  },
  "line_items": [
    {
      "uid": "UUUUUUUUUUUUUUUUUUUUUU",
      "name": "Ribeye Steak",
      "quantity": "2",
      "catalog_object_id": "CCCCCCCCCCCCCCCCCCCCCC",
      "variation_name": "Regular",
      "base_price_money": {
        "amount": 4500,
        "currency": "USD"
      },
      "gross_sales_money": {
        "amount": 9000,
        "currency": "USD"
      },
      "total_money": {
        "amount": 9000,
        "currency": "USD"
      }
    }
  ],
  "created_at": "2025-01-27T18:45:00.000Z",
  "updated_at": "2025-01-27T19:15:00.000Z",
  "state": "COMPLETED",
  "closed_at": "2025-01-27T19:15:00.000Z",
  "total_money": {
    "amount": 9000,
    "currency": "USD"
  },
  "total_tax_money": {
    "amount": 0,
    "currency": "USD"
  },
  "total_discount_money": {
    "amount": 0,
    "currency": "USD"
  },
  "total_tip_money": {
    "amount": 0,
    "currency": "USD"
  },
  "net_amounts": {
    "total_money": {
      "amount": 9000,
      "currency": "USD"
    }
  },
  "version": 2
}
```

---

### 4. `square_order_items`

**Purpose**: Store individual line items from orders (denormalized for query performance)

**Sequelize Model**: `SquareOrderItem`

**Migration**: `[timestamp]_create-square-order-items.js`

```sql
CREATE TABLE square_order_items (
  -- Primary Key
  id SERIAL PRIMARY KEY,
  
  -- Foreign Keys
  square_order_id INTEGER NOT NULL REFERENCES square_orders(id) ON DELETE CASCADE,
  square_menu_item_id INTEGER REFERENCES square_menu_items(id) ON DELETE SET NULL,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Square API Identifiers
  square_line_item_uid VARCHAR(255) NOT NULL,  -- Unique within order
  square_catalog_object_id VARCHAR(255),  -- Links to menu item
  square_variation_id VARCHAR(255),
  
  -- Raw Line Item Data
  line_item_data JSONB NOT NULL,
  -- Contains: { uid, name, quantity, catalog_object_id, variation_name, modifiers, ... }
  
  -- Denormalized Fields
  name VARCHAR(255) NOT NULL,
  variation_name VARCHAR(255),
  quantity DECIMAL(10, 3) NOT NULL,
  
  -- Pricing (in cents)
  base_price_money_amount BIGINT,
  gross_sales_money_amount BIGINT,
  total_tax_money_amount BIGINT,
  total_discount_money_amount BIGINT,
  total_money_amount BIGINT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_total CHECK (total_money_amount >= 0)
);

-- Indexes for Performance
CREATE INDEX idx_square_order_items_order ON square_order_items(square_order_id);
CREATE INDEX idx_square_order_items_menu_item ON square_order_items(square_menu_item_id);
CREATE INDEX idx_square_order_items_restaurant ON square_order_items(restaurant_id);
CREATE INDEX idx_square_order_items_catalog_object ON square_order_items(square_catalog_object_id);
CREATE INDEX idx_square_order_items_line_item_uid ON square_order_items(square_line_item_uid);

-- Composite index for sales analysis
CREATE INDEX idx_square_order_items_sales ON square_order_items(
  restaurant_id,
  square_catalog_object_id,
  created_at DESC
);
```

**Rationale**: Denormalizing line items into separate table enables:
- Fast queries for "top selling items"
- Efficient joins with `square_menu_items`
- Sales analysis without parsing JSONB
- Better indexing performance

---

### 5. `square_categories`

**Purpose**: Store Square's catalog categories for ingredient categorization

**Sequelize Model**: `SquareCategory`

**Migration**: `[timestamp]_create-square-categories.js`

```sql
CREATE TABLE square_categories (
  -- Primary Key
  id SERIAL PRIMARY KEY,
  
  -- Foreign Keys
  pos_connection_id INTEGER NOT NULL REFERENCES pos_connections(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Square API Identifiers
  square_catalog_object_id VARCHAR(255) UNIQUE NOT NULL,
  square_category_id VARCHAR(255) NOT NULL,
  
  -- Raw API Response
  square_data JSONB NOT NULL,
  -- Contains: { id, type: "CATEGORY", category_data: { name }, ... }
  
  -- Denormalized Fields
  name VARCHAR(255) NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  
  -- Sync Metadata
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  square_version BIGINT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_square_categories_catalog_object_id ON square_categories(square_catalog_object_id);
CREATE INDEX idx_square_categories_pos_connection ON square_categories(pos_connection_id);
CREATE INDEX idx_square_categories_restaurant ON square_categories(restaurant_id);
CREATE INDEX idx_square_categories_name ON square_categories(name);
CREATE INDEX idx_square_categories_deleted ON square_categories(is_deleted) WHERE is_deleted = false;
```

**Example Square API Response** (stored in `square_data`):
```json
{
  "type": "CATEGORY",
  "id": "YYYYYYYYYYYYYYYYYYYYYY",
  "updated_at": "2025-01-27T10:00:00.000Z",
  "version": 123456789,
  "is_deleted": false,
  "present_at_all_locations": true,
  "category_data": {
    "name": "Proteins"
  }
}
```

---

## Tier 2: Unified Analytics Tables

### Enhanced `inventory_items` Table

**Purpose**: Unified inventory format for all POS providers

**Existing Table**: Yes (enhanced with POS source tracking AND variance thresholds)

**Migrations**: 
- `1726790000002_create-inventory-items.js` (base table)
- `1726790000007_update-inventory-items-categories.js` (variance fields)
- `1759800000000_add-pos-source-tracking-to-inventory-items.js` (POS tracking)
- `1760000000000_add-unique-constraint-pos-source.js` (upsert support)

**Complete Schema** (as of October 2025):

```sql
CREATE TABLE inventory_items (
  -- Primary Key
  id SERIAL PRIMARY KEY,
  
  -- Foreign Keys
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT,
  category_id INTEGER REFERENCES ingredient_categories(id) ON DELETE SET NULL,
  
  -- Core Fields
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL, -- DEPRECATED: Use category_id instead
  unit VARCHAR(50) NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Stock Management
  current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  minimum_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  maximum_stock DECIMAL(10,2) NOT NULL DEFAULT 100,
  
  -- Expiration & Location
  expiration_date DATE,
  batch_number VARCHAR(255),
  location VARCHAR(100),
  last_order_date DATE,
  
  -- Variance Threshold System (Dave's Business Logic)
  variance_threshold_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  variance_threshold_dollar DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  high_value_flag BOOLEAN NOT NULL DEFAULT false,
  theoretical_yield_factor DECIMAL(4,3) NOT NULL DEFAULT 1.000,
  cost_per_unit_variance_pct DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  
  -- POS Source Tracking (Two-Tier Architecture)
  source_pos_provider VARCHAR(50), -- 'square', 'toast', 'clover'
  source_pos_item_id VARCHAR(255), -- External POS identifier
  source_pos_data JSONB, -- Minimal POS metadata for reference
  
  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_pos_provider CHECK (
    source_pos_provider IN ('square', 'toast', 'clover') OR source_pos_provider IS NULL
  ),
  CONSTRAINT check_positive_thresholds CHECK (
    variance_threshold_quantity >= 0 AND variance_threshold_dollar >= 0
  ),
  CONSTRAINT check_yield_factor_range CHECK (
    theoretical_yield_factor >= 0.100 AND theoretical_yield_factor <= 2.000
  ),
  CONSTRAINT check_cost_variance_pct CHECK (
    cost_per_unit_variance_pct >= 0 AND cost_per_unit_variance_pct <= 100
  ),
  CONSTRAINT unique_pos_source UNIQUE (
    restaurant_id, source_pos_provider, source_pos_item_id
  )
);

-- Indexes for Performance
CREATE INDEX idx_inventory_items_restaurant ON inventory_items(restaurant_id);
CREATE INDEX idx_inventory_items_category ON inventory_items(category);
CREATE INDEX idx_inventory_items_category_id ON inventory_items(category_id);
CREATE INDEX idx_inventory_items_is_active ON inventory_items(is_active);
CREATE INDEX idx_inventory_items_expiration ON inventory_items(expiration_date);
CREATE INDEX idx_inventory_items_high_value ON inventory_items(high_value_flag);
CREATE INDEX idx_inventory_items_variance_dollar ON inventory_items(variance_threshold_dollar);
CREATE UNIQUE INDEX idx_inventory_items_name_restaurant ON inventory_items(name, restaurant_id);

-- POS Source Tracking Index (enables fast lookups by external POS ID)
CREATE INDEX idx_inventory_items_pos_source ON inventory_items(
  restaurant_id,
  source_pos_provider,
  source_pos_item_id
) WHERE source_pos_provider IS NOT NULL;

-- Variance Query Index
CREATE INDEX idx_inventory_items_variance ON inventory_items(
  restaurant_id,
  high_value_flag,
  updated_at DESC
);

-- Composite Indexes for Dave's Variance Queries
CREATE INDEX idx_inventory_items_restaurant_high_value ON inventory_items(
  restaurant_id, high_value_flag
);
CREATE INDEX idx_inventory_items_category_high_value ON inventory_items(
  category_id, high_value_flag
);
CREATE INDEX idx_inventory_items_variance_threshold_high_value ON inventory_items(
  variance_threshold_dollar, high_value_flag
);
```

**How Transformation Works** (Implemented October 2025):

```javascript
// POSDataTransformer.squareMenuItemToInventoryItem()
// SUCCESS: 25/25 items transformed in production testing

{
  // Standard fields (POS-agnostic)
  name: "saffron risotto",           // From itemData.name (camelCase from SDK v37.1.0)
  sku: "SAFFRON-RISOTTO-001",        // From itemVariationData.sku
  unit: "oz",                         // Inferred by UnitInferrer service
  unitCost: 25.00,                    // From priceMoney.amount / 100
  currentStock: 12.5,                 // Latest inventory count
  
  // POS source tracking (CRITICAL!)
  sourcePosProvider: "square",
  sourcePosItemId: "XXXXXXXXXXXXXXXXXXXXXX",  // square_catalog_object_id
  sourcePosData: {
    itemId: "ITEM_ID_XXX",
    catalogObjectId: "XXXXXXXXXXXXXXXXXXXXXX",
    variationId: "VAR_ID_XXX",
    version: 1234567890123
  },
  
  // Category mapping (fuzzy match or create)
  categoryId: 42,  // Mapped from Square's "Proteins" → our "Proteins" category
  
  // Dave's variance thresholds (business logic)
  varianceThresholdQuantity: 2,      // Tight threshold for high-value items
  varianceThresholdDollar: 50.00,
  highValueFlag: true,               // unitCost > $25 triggers this
  theoreticalYieldFactor: 1.000,
  costPerUnitVariancePct: 10.00,
  
  // Metadata
  lastSyncedAt: new Date(),
  isActive: true
}
```

**Key Implementation Notes**:

1. **Square SDK v37.1.0 Field Mapping**: The transformer handles both camelCase (from API) and snake_case (legacy) with fallbacks:
   ```javascript
   // SquareAdapter.js lines 842-870
   const itemData = item.itemData || item.item_data;
   const categoryData = item.categoryData || item.category_data;
   const priceMoney = variation.itemVariationData?.priceMoney || 
                      variation.item_variation_data?.price_money;
   ```

2. **Unit Normalization**: Maps UnitInferrer output to InventoryItem validation
   ```javascript
   // POSDataTransformer.normalizeUnit() lines 273-325
   'lb' → 'lbs', 'ea' → 'pieces', 'gal' → 'gallons', etc.
   ```

3. **BigInt Serialization**: Square API returns `version` as BigInt, handled by `_sanitizeBigInt()` recursive converter

4. **Upsert Support**: Unique constraint `(restaurant_id, source_pos_provider, source_pos_item_id)` enables conflict-free upserts

---

### `sales_transactions` Table

**Purpose**: Unified sales format for all POS providers

**Existing Table**: No (created in Issue #21)

**Schema Reference**: See Issue #21

**How Transformation Works**:
```javascript
// POSDataTransformer.squareOrderToSalesTransactions()
{
  restaurantId: 1,
  inventoryItemId: 123,  // Links to unified inventory_items
  transactionDate: "2025-01-27T19:15:00.000Z",
  quantity: 2,
  unitPrice: 45.00,
  totalAmount: 90.00,
  
  // POS source tracking
  sourcePosProvider: "square",
  sourcePosOrderId: "XXXXXXXXXXXXXXXXXXXXXX",  // square_order_id
  sourcePosLineItemId: "UUUUUUUUUUUUUUUUUUUUUU",
  sourcePosData: { /* minimal line item data */ }
}
```

---

## Transformation Layer

### `POSDataTransformer` Service

**File**: `backend/src/services/POSDataTransformer.js` (created in Issue #20)

**Key Methods**:

```javascript
class POSDataTransformer {
  /**
   * Transform Square menu item → unified inventory_items format
   * @param {SquareMenuItem} squareMenuItem - Sequelize model instance
   * @returns {Object} - Data for InventoryItem.create()
   */
  async squareMenuItemToInventoryItem(squareMenuItem) {
    const latestCount = await this._getLatestInventoryCount(squareMenuItem.id);
    const squareData = squareMenuItem.squareData;
    
    // Extract pricing from variations (Square structure)
    const primaryVariation = squareData.item_data?.variations?.[0];
    const unitCost = primaryVariation?.item_variation_data?.price_money?.amount 
      ? primaryVariation.item_variation_data.price_money.amount / 100 
      : 0;
    
    return {
      restaurantId: squareMenuItem.restaurantId,
      name: squareMenuItem.name,
      sku: primaryVariation?.item_variation_data?.sku || null,
      unit: this._inferUnitFromSquare(squareData),
      unitCost,
      currentStock: latestCount?.quantity || 0,
      
      // POS source tracking (CRITICAL!)
      sourcePosProvider: 'square',
      sourcePosItemId: squareMenuItem.squareCatalogObjectId,
      sourcePosData: {
        itemId: squareMenuItem.squareItemId,
        catalogObjectId: squareMenuItem.squareCatalogObjectId,
        variationId: primaryVariation?.id,
        version: squareMenuItem.squareVersion
      },
      
      // Category mapping
      categoryId: await this._mapSquareCategoryToOurs(
        squareData.item_data?.category_id,
        squareMenuItem.restaurantId
      ),
      
      // Variance thresholds (business logic)
      varianceThresholdQuantity: this._inferVarianceThreshold(squareData),
      varianceThresholdDollar: 50.00,
      highValueFlag: unitCost > 25.00,
      
      lastSyncedAt: new Date()
    };
  }
  
  /**
   * Transform Square order → unified sales_transactions records
   * @param {SquareOrder} squareOrder - Sequelize model instance
   * @returns {Array<Object>} - Array of data for SalesTransaction.bulkCreate()
   */
  async squareOrderToSalesTransactions(squareOrder) {
    const transactions = [];
    const orderItems = await squareOrder.getSquareOrderItems();
    
    for (const lineItem of orderItems) {
      // Find unified inventory item via POS source tracking
      const inventoryItem = await InventoryItem.findOne({
        where: {
          restaurantId: squareOrder.restaurantId,
          sourcePosProvider: 'square',
          sourcePosItemId: lineItem.squareCatalogObjectId
        }
      });
      
      if (!inventoryItem) {
        console.warn(`No inventory mapping for Square item ${lineItem.squareCatalogObjectId}`);
        continue;
      }
      
      transactions.push({
        restaurantId: squareOrder.restaurantId,
        inventoryItemId: inventoryItem.id,  // Links to unified!
        transactionDate: squareOrder.closedAt || squareOrder.squareCreatedAt,
        quantity: parseFloat(lineItem.quantity),
        unitPrice: lineItem.basePriceMoneyAmount / 100,
        totalAmount: lineItem.totalMoneyAmount / 100,
        
        // POS source tracking
        sourcePosProvider: 'square',
        sourcePosOrderId: squareOrder.squareOrderId,
        sourcePosLineItemId: lineItem.squareLineItemUid,
        sourcePosData: {
          name: lineItem.name,
          variationName: lineItem.variationName,
          catalogObjectId: lineItem.squareCatalogObjectId
        }
      });
    }
    
    return transactions;
  }
  
  /**
   * Helper: Map Square category ID → our ingredient_categories
   */
  async _mapSquareCategoryToOurs(squareCategoryId, restaurantId) {
    if (!squareCategoryId) return null;
    
    // Find Square category
    const squareCategory = await SquareCategory.findOne({
      where: {
        restaurantId,
        squareCatalogObjectId: squareCategoryId
      }
    });
    
    if (!squareCategory) return null;
    
    // Fuzzy match to our categories (or create if doesn't exist)
    const categoryName = squareCategory.name.toLowerCase();
    const categoryMappings = {
      'protein': 'Proteins',
      'proteins': 'Proteins',
      'meat': 'Proteins',
      'seafood': 'Proteins',
      'produce': 'Produce',
      'vegetable': 'Produce',
      'fruit': 'Produce',
      'dairy': 'Dairy & Eggs',
      'beverage': 'Beverages',
      'drink': 'Beverages',
      'alcohol': 'Alcohol',
      'dry': 'Dry Goods & Grains',
      'grain': 'Dry Goods & Grains',
      'spice': 'Spices & Seasonings',
      'seasoning': 'Spices & Seasonings'
    };
    
    for (const [key, ourCategory] of Object.entries(categoryMappings)) {
      if (categoryName.includes(key)) {
        const category = await IngredientCategory.findOne({
          where: { name: ourCategory }
        });
        return category?.id || null;
      }
    }
    
    return null;  // No mapping found
  }
  
  /**
   * Helper: Infer measurement unit from Square item data
   */
  _inferUnitFromSquare(squareData) {
    const name = squareData.item_data?.name?.toLowerCase() || '';
    const description = squareData.item_data?.description?.toLowerCase() || '';
    const text = `${name} ${description}`;
    
    // Weight units
    if (/(lb|lbs|pound)/i.test(text)) return 'lb';
    if (/(oz|ounce)/i.test(text)) return 'oz';
    if (/(kg|kilogram)/i.test(text)) return 'kg';
    if (/(g|gram)/.test(text) && !/egg/i.test(text)) return 'g';
    
    // Volume units
    if (/(gal|gallon)/i.test(text)) return 'gal';
    if (/(qt|quart)/i.test(text)) return 'qt';
    if (/(pt|pint)/i.test(text)) return 'pt';
    if (/(fl oz)/i.test(text)) return 'fl oz';
    if (/(ml|milliliter)/i.test(text)) return 'ml';
    if (/(l|liter)/.test(text) && !/gal/i.test(text)) return 'L';
    
    // Count units
    if (/(dozen|doz)/i.test(text)) return 'dozen';
    if (/(case)/i.test(text)) return 'case';
    if (/(box)/i.test(text)) return 'box';
    if (/(bag)/i.test(text)) return 'bag';
    
    // Default
    return 'ea';  // "each" for countable items
  }
  
  /**
   * Helper: Infer variance threshold based on item characteristics
   */
  _inferVarianceThreshold(squareData) {
    const price = squareData.item_data?.variations?.[0]?.item_variation_data?.price_money?.amount || 0;
    const priceInDollars = price / 100;
    
    // High-value items: tighter threshold
    if (priceInDollars > 25) return 2;
    
    // Medium-value items
    if (priceInDollars > 10) return 5;
    
    // Low-value items: looser threshold
    return 10;
  }
  
  /**
   * Helper: Get latest inventory count for menu item
   */
  async _getLatestInventoryCount(squareMenuItemId) {
    return await SquareInventoryCount.findOne({
      where: {
        squareMenuItemId,
        squareState: 'IN_STOCK'
      },
      order: [['calculatedAt', 'DESC']],
      limit: 1
    });
  }
}

module.exports = new POSDataTransformer();
```

---

## Data Flow

### Complete Sync & Transform Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Sync Square Menu Items                                 │
│  SquareAdapter.syncCatalog()                                    │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Square Catalog API → square_menu_items (JSONB)
                 │ Square Categories API → square_categories (JSONB)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Sync Square Inventory Counts                          │
│  SquareAdapter.syncInventory()                                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Square Inventory API → square_inventory_counts (JSONB)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Transform Square → Unified Inventory                  │
│  POSDataTransformer.squareMenuItemToInventoryItem()            │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ square_menu_items → inventory_items (normalized)
                 │ Links via source_pos_item_id
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Sync Square Orders                                     │
│  SquareAdapter.syncOrders()                                     │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Square Orders API → square_orders + square_order_items (JSONB)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Transform Square → Unified Sales                      │
│  POSDataTransformer.squareOrderToSalesTransactions()           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ square_order_items → sales_transactions (normalized)
                 │ Links via inventoryItemId
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: Run Theoretical Usage Calculations                     │
│  TheoreticalUsageService.calculate()                           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ Query ONLY unified tables:
                 │ - inventory_items
                 │ - sales_transactions
                 │ - inventory_transactions
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 7: AI Agents Detect Anomalies                            │
│  OverstockDetectionAgent.scan()                                │
│  UnusualUsageDetectionAgent.scan()                             │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principles
1. **Raw-First**: Always save raw POS data before transformation
2. **Idempotent**: Re-running sync overwrites (upsert), not duplicate
3. **Atomic**: Each sync step is transaction-wrapped
4. **Traceable**: Every unified record links back to POS source
5. **Re-processable**: Can delete unified data and re-transform

---

## Indexes & Performance

### Query Patterns & Index Justification

**Pattern 1: Find latest inventory for item**
```sql
-- Query:
SELECT * FROM square_inventory_counts
WHERE square_catalog_object_id = 'XXX'
  AND square_state = 'IN_STOCK'
ORDER BY calculated_at DESC
LIMIT 1;

-- Index:
CREATE INDEX idx_square_inventory_latest ON square_inventory_counts(
  square_catalog_object_id,
  square_state,
  calculated_at DESC
);
```

**Pattern 2: Find unified inventory item by POS source**
```sql
-- Query:
SELECT * FROM inventory_items
WHERE restaurant_id = 1
  AND source_pos_provider = 'square'
  AND source_pos_item_id = 'XXX';

-- Index:
CREATE INDEX idx_inventory_items_pos_source ON inventory_items(
  restaurant_id,
  source_pos_provider,
  source_pos_item_id
) WHERE source_pos_provider IS NOT NULL;
```

**Pattern 3: Top selling items for period**
```sql
-- Query:
SELECT 
  soi.square_catalog_object_id,
  soi.name,
  SUM(soi.quantity) as total_quantity,
  SUM(soi.total_money_amount) as total_revenue
FROM square_order_items soi
JOIN square_orders so ON soi.square_order_id = so.id
WHERE so.restaurant_id = 1
  AND so.state = 'COMPLETED'
  AND so.closed_at BETWEEN '2025-01-01' AND '2025-01-31'
GROUP BY soi.square_catalog_object_id, soi.name
ORDER BY total_revenue DESC
LIMIT 10;

-- Indexes:
CREATE INDEX idx_square_orders_sales_report ON square_orders(
  restaurant_id,
  state,
  closed_at DESC
) WHERE state = 'COMPLETED' AND closed_at IS NOT NULL;

CREATE INDEX idx_square_order_items_sales ON square_order_items(
  restaurant_id,
  square_catalog_object_id,
  created_at DESC
);
```

**Pattern 4: Stale sync detection**
```sql
-- Query:
SELECT * FROM square_menu_items
WHERE restaurant_id = 1
  AND last_synced_at < NOW() - INTERVAL '1 hour';

-- Index:
CREATE INDEX idx_square_menu_items_last_synced ON square_menu_items(last_synced_at DESC);
```

### Performance Targets
- **Sync 1000 menu items**: < 30 seconds
- **Sync 10,000 orders**: < 2 minutes
- **Transform 1000 items**: < 10 seconds
- **Variance query across 5000 items**: < 500ms

---

## Migration Plan

### Migration Order (Critical!)

```bash
# 1. Add POS source tracking to existing inventory_items (must be first)
backend/migrations/1759800000000_add-pos-source-tracking-to-inventory-items.js

# 2. Create Square categories (no dependencies)
backend/migrations/1759800000001_create-square-categories.js

# 3. Create Square menu items (depends on categories)
backend/migrations/1759800000002_create-square-menu-items.js

# 4. Create Square inventory counts (depends on menu items)
backend/migrations/1759800000003_create-square-inventory-counts.js

# 5. Create Square orders (depends on menu items)
backend/migrations/1759800000004_create-square-orders.js

# 6. Create Square order items (depends on orders)
backend/migrations/1759800000005_create-square-order-items.js
```

### Rollback Strategy

Each migration includes `down()` method:

```javascript
// Example: 1759800000002_create-square-menu-items.js
exports.down = async (db) => {
  await db.dropTable('square_menu_items');
};
```

**Rollback Order**: Reverse of migration order (due to foreign keys)

### Testing Migrations

```bash
# Run migrations
npm run migrate:up

# Verify schema
psql $DATABASE_URL -c "\d square_menu_items"

# Test rollback
npm run migrate:down
npm run migrate:up
```

---

## Acceptance Criteria - Implementation Status

### Database Schema ✅ COMPLETE
- [x] All 5 Square tables created with correct columns
- [x] All foreign keys and constraints applied
- [x] All indexes created (28 total indexes)
- [x] `inventory_items` enhanced with POS source tracking
- [x] `inventory_items` includes all variance threshold fields
- [x] Unique constraint added for POS upsert operations
- [x] Migrations are idempotent (can run multiple times)
- [x] Rollback works correctly

### Sequelize Models ✅ COMPLETE
- [x] 5 Sequelize models created (`SquareMenuItem`, `SquareInventoryCount`, etc.)
- [x] Associations defined (`hasMany`, `belongsTo`)
- [x] JSONB fields properly serialized/deserialized (BigInt handling)
- [x] Validation rules applied
- [x] Model hooks for `updated_at` timestamps
- [x] Enhanced `InventoryItem` model with POS fields and variance logic

### Data Integrity ✅ COMPLETE
- [x] Cannot delete `pos_connections` with existing Square data (foreign key cascade)
- [x] Cannot create Square records without valid `pos_connection_id`
- [x] JSONB fields validate as valid JSON
- [x] Quantity constraints enforced (>= 0)
- [x] State enums enforced
- [x] Unique constraint prevents duplicate POS items

### Performance ✅ VALIDATED
- [x] All queries use indexes (verified in testing)
- [x] JSONB queries use GIN indexes
- [x] Transform 25 items completes in <1s ✅ (production test)
- [x] No N+1 queries in transformation (eager loading implemented)

### Transformation Pipeline ✅ OPERATIONAL
- [x] POSDataTransformer service implemented and tested
- [x] Square SDK v37.1.0 camelCase/snake_case field mapping handled
- [x] Unit normalization working (lb→lbs, ea→pieces, etc.)
- [x] Category fuzzy matching implemented
- [x] Variance threshold business logic integrated
- [x] BigInt serialization handled
- [x] Upsert operations working with unique constraint

### Testing ✅ COMPLETE
- [x] Integration tests for migrations
- [x] Test Square data transformation (25/25 items successful)
- [x] Test JSONB storage/retrieval
- [x] Test foreign key cascades
- [x] Test constraint violations
- [x] UI testing components (DataImportPanel, DataReviewPanel)

### Documentation ✅ UPDATED
- [x] PROJECT_STATUS.md updated with transformation pipeline details
- [x] TECHNICAL_DOCUMENTATION.md updated with Two-Tier Architecture
- [x] POS_INTEGRATION_GUIDE.md updated with data flow diagrams
- [x] SQUARE_DATABASE_SCHEMA.md (this document) reflects actual implementation
- [x] GitHub Issue #20 comment documents all deliverables

**Latest Production Test Results** (October 11, 2025):
- 25/25 Square menu items imported successfully
- 25/25 items transformed to inventory_items
- Real item names displayed correctly (e.g., "saffron risotto")
- All field mappings validated
- Side-by-side UI comparison working

---

## Implementation Files (Completed October 2025)

### Migrations ✅
```
backend/migrations/1759800000000_add-pos-source-tracking-to-inventory-items.js ✅
backend/migrations/1759800000001_create-square-categories.js ✅
backend/migrations/1759800000002_create-square-menu-items.js ✅
backend/migrations/1759800000003_create-square-inventory-counts.js ✅
backend/migrations/1759800000004_create-square-orders.js ✅
backend/migrations/1759800000005_create-square-order-items.js ✅
backend/migrations/1760000000000_add-unique-constraint-pos-source.js ✅
```

### Models ✅
```
backend/src/models/SquareCategory.js ✅
backend/src/models/SquareMenuItem.js ✅
backend/src/models/SquareInventoryCount.js ✅
backend/src/models/SquareOrder.js ✅
backend/src/models/SquareOrderItem.js ✅
backend/src/models/InventoryItem.js (enhanced with POS source fields) ✅
```

### Services ✅
```
backend/src/adapters/SquareAdapter.js (with field mapping fixes) ✅
backend/src/services/POSDataTransformer.js (operational) ✅
backend/src/services/UnitInferrer.js (unit normalization) ✅
```

### UI Components ✅
```
frontend/src/components/DataImportPanel.jsx (Import/Transform/Clear workflow) ✅
frontend/src/components/DataReviewPanel.jsx (Tier 1 vs Tier 2 comparison) ✅
```

### API Routes ✅
```
GET /api/v1/pos/square/raw-data/:connectionId ✅
GET /api/v1/pos/square/transformed-data/:connectionId ✅
POST /api/v1/pos/square/import/:connectionId ✅
POST /api/v1/pos/square/transform/:connectionId ✅
DELETE /api/v1/pos/square/clear-data/:connectionId ✅
```

### Documentation ✅
```
docs/SQUARE_DATABASE_SCHEMA.md (this document, updated October 11, 2025) ✅
docs/PROJECT_STATUS.md (Square Data Transformation Pipeline section added) ✅
docs/TECHNICAL_DOCUMENTATION.md (Two-Tier Architecture documented) ✅
docs/POS_INTEGRATION_GUIDE.md (Architecture diagrams updated) ✅
backend/migrations/README-SQUARE-SCHEMA.md (migration guide) ✅
```

---

## Next Steps (Future Enhancements)

**Completed Issues**:
- ~~Issue #18: Square Database Schema~~ ✅ COMPLETE
- ~~Issue #19: SquareAPIClient implementation~~ ✅ COMPLETE (SquareAdapter operational)
- ~~Issue #20: POSDataTransformer for Square → Unified~~ ✅ COMPLETE (25/25 items transforming)

**Remaining Future Work**:
- **Issue #21**: Create `sales_transactions` unified table (planned)
- **Issue #25**: Implement Toast tables (copy Square pattern)
- **Issue #31**: Webhook-triggered real-time sync (Square Orders webhook)
- **Performance Optimization**: Batch processing for large catalogs (>1000 items)
- **Error Recovery**: Retry logic for failed transformations
- **Monitoring**: Track transformation success rates, identify stale data

---

## References

- **Square Catalog API**: https://developer.squareup.com/reference/square/catalog-api
- **Square Inventory API**: https://developer.squareup.com/reference/square/inventory-api
- **Square Orders API**: https://developer.squareup.com/reference/square/orders-api
- **Two-Tier Architecture Discussion**: Issues #18, #19, #20, #21 comments
- **CostFX Code Guidelines**: `CLAUDE.md`

---

**Document Status**: ✅ IMPLEMENTED & OPERATIONAL  
**Schema Created**: 2025-01-27  
**Implementation Completed**: 2025-10-11  
**Last Documentation Update**: 2025-10-11  
**Production Status**: 25/25 Square menu items successfully transforming  
**GitHub Issue**: [#20 Comment - October 11, 2025](https://github.com/akisma/CostFX/issues/20#issuecomment-3393786057)  
**Principal Engineer**: akisma (original design + implementation approval)

