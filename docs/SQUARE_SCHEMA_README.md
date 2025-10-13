# Square Database Schema Migrations

## ⚠️ CRITICAL: ES Modules Pattern

**ALL migrations in this project MUST use ES module syntax:**

```javascript
/* eslint-disable camelcase */

export const up = async (pgm) => {
  // Migration code
};

export const down = async (pgm) => {
  // Rollback code
};
```

**❌ DO NOT USE:**  
`exports.up` or `module.exports` - These will cause "exports is not defined in ES module scope" errors!

---

## Square Schema Migrations (Issue #18)

### Migration Order (Dependencies Matter!)

1. `1759800000000_add-pos-source-tracking-to-inventory-items.js`
   - Adds POS source tracking to existing `inventory_items` table
   - No dependencies

2. `1759800000001_create-square-categories.js`
   - Creates `square_categories` table
   - No dependencies on other Square tables

3. `1759800000002_create-square-menu-items.js`
   - Creates `square_menu_items` table
   - Depends on: `square_categories`, `square_locations`

4. `1759800000003_create-square-inventory-counts.js`
   - Creates `square_inventory_counts` table
   - Depends on: `square_menu_items`

5. `1759800000004_create-square-orders.js`
   - Creates `square_orders` table
   - Depends on: `square_locations`

6. `1759800000005_create-square-order-items.js`
   - Creates `square_order_items` table
   - Depends on: `square_orders`, `square_menu_items`

---

## Two-Tier Architecture

### Tier 1: Square-Specific Raw Data (5 tables)
- `square_categories` - Square Catalog categories
- `square_menu_items` - Square Catalog items
- `square_inventory_counts` - Square inventory snapshots
- `square_orders` - Square orders
- `square_order_items` - Square order line items (denormalized)

### Tier 2: Unified Analytics Layer
- `inventory_items` - Enhanced with `source_pos_provider`, `source_pos_item_id`, `source_pos_data`
- `sales_transactions` - Created in Issue #21 (future)

### Transformation
- `POSDataTransformer` service (Issue #20) transforms Tier 1 → Tier 2
- Agents query ONLY Tier 2 tables (POS-agnostic)

---

## Verification

```bash
# Check Square tables exist
docker-compose exec -T db psql -U postgres -d restaurant_ai -c "\dt square_*"

# Check inventory_items has POS source columns
docker-compose exec -T db psql -U postgres -d restaurant_ai -c "\d inventory_items"

# Run migrations
npm run migrate:up

# Rollback (if needed)
npm run migrate:down
```

---

## See Also
- `docs/SQUARE_DATABASE_SCHEMA.md` - Complete schema documentation
- `docs/TECHNICAL_DOCUMENTATION.md` - Migration patterns
- GitHub Issue #18 - Square-Focused Database Schema
