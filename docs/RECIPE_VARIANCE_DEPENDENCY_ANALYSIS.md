# Recipe Variance Analysis - Dependency Analysis & Blocker Status

**Date:** October 12, 2025  
**Status:** ⚠️ BLOCKED - Cannot proceed until Issue #21 is complete

---

## Executive Summary

Dave's recipe variance analysis request (halibut example) requires **4 GitHub issues** to be completed:

1. **Phase 0:** Issue #21 - Square Sales Data Synchronization ⚠️ **BLOCKER (OPEN)**
2. **Phase 1:** NEW Issue #1 - Recipe Foundation & On-Demand Analysis (depends on #21)
3. **Phase 2:** NEW Issue #2 - Nightly Automated Analysis (depends on #21 + #1)
4. **Phase 3:** NEW Issue #3 - Critical Variance Alerts (depends on #21 + #1 + #2)

**Critical Finding:** Issue #21 is currently **OPEN on GitHub** despite being marked as complete in some documentation. This was corrected on 2025-10-12.

---

## The Blocker: Issue #21 - Square Sales Data Synchronization

### Current Status
- **GitHub Issue:** https://github.com/akisma/CostFX/issues/21
- **State:** OPEN (Ready in project board, but NOT implemented)
- **Priority:** P0 - Critical
- **Estimate:** 4 days
- **Labels:** enhancement, POS integration, v1 MVP

### What's Missing

**Database:**
- `sales_transactions` table does not exist yet
- Need Tier 2 unified format for POS-agnostic sales data

**Models:**
- `SalesTransaction` Sequelize model not created

**Services:**
- `SquareSalesSyncService` - not implemented
- `POSDataTransformer.squareOrderToSalesTransactions()` - not implemented

**Jobs:**
- Scheduled sales sync job - not implemented
- Historical backfill (30 days) - not implemented

**Tables Exist But Empty:**
- `square_orders` table exists (schema only, no data sync)
- `square_order_items` table exists (schema only, no data sync)

### Why This Blocks Recipe Variance

Dave's halibut example calculation:
```
variance_per_plate = $1.875 (actual $5.625 - theoretical $3.75)
sales_count = 100 plates (from Square sales data)
revenue_loss = $1.875 × 100 = $187.50
```

**Cannot calculate `revenue_loss` without `sales_count`!**

The `sales_count` comes from querying:
```sql
SELECT COUNT(*) 
FROM sales_transactions st
JOIN recipe_menu_item_links rmil ON rmil.square_menu_item_id = st.source_pos_item_id
WHERE rmil.recipe_id = 123
  AND st.transaction_date BETWEEN '2025-10-01' AND '2025-10-07'
  AND st.source_pos_provider = 'square';
```

This query **cannot run** because:
1. `sales_transactions` table doesn't exist
2. No sales data synced from Square
3. No transformation pipeline from `square_orders` → `sales_transactions`

---

## What Issue #21 Delivers

### 1. Database Schema

```sql
CREATE TABLE sales_transactions (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER REFERENCES restaurants(id),
  inventory_item_id INTEGER REFERENCES inventory_items(id),
  
  -- Transaction details
  transaction_date TIMESTAMPTZ NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  
  -- POS source tracking
  source_pos_provider VARCHAR(50) NOT NULL,  -- 'square', 'toast'
  source_pos_order_id VARCHAR(255) NOT NULL,
  source_pos_line_item_id VARCHAR(255),
  source_pos_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_pos_line_item UNIQUE (source_pos_provider, source_pos_line_item_id)
);

CREATE INDEX idx_sales_trans_restaurant ON sales_transactions(restaurant_id);
CREATE INDEX idx_sales_trans_item ON sales_transactions(inventory_item_id);
CREATE INDEX idx_sales_trans_date ON sales_transactions(transaction_date DESC);
CREATE INDEX idx_sales_trans_pos_source ON sales_transactions(source_pos_provider, source_pos_order_id);
```

### 2. Two-Tier Architecture

**Tier 1 (Raw POS Data):**
- `square_orders` - Complete Square API responses (JSONB)
- `square_order_items` - Denormalized line items for performance

**Tier 2 (Unified Analytics):**
- `sales_transactions` - POS-agnostic format for theoretical usage calculations
- Links to `inventory_items` (unified table), NOT `square_menu_items` (raw table)

### 3. Data Flow Pipeline

```
Square Orders API
    ↓
SquareSalesSyncService.syncOrders()
    ↓
Stores in square_orders + square_order_items (Tier 1)
    ↓
POSDataTransformer.squareOrderToSalesTransactions()
    ↓
Maps catalog_object_id → inventory_item_id (via source tracking)
    ↓
Creates sales_transactions records (Tier 2)
    ↓
Recipe variance queries sales_transactions for sales_count
```

### 4. Integration Points

**After Issue #21 completes, recipe variance can:**
- Query `sales_transactions` for sales counts by menu item
- Link recipes to menu items via `recipe_menu_item_links`
- Calculate revenue impact: `variance × sales_count`
- Support nightly batch analysis across all recipes
- Work identically when Toast integration is added (same unified format)

---

## Corrected Timeline

### Original (Incorrect) Timeline
- ~~Week 1-2: Recipe variance work (10 days)~~
- **Problem:** Assumed sales data was available

### Corrected Timeline
- **Week 1 (4 days):** Complete Issue #21 - Sales data sync ⚠️ **MUST DO FIRST**
- **Week 2 (5 days):** Recipe foundation (Issue #1) - DEPENDS ON #21
- **Week 3 (3 days):** Nightly automation (Issue #2) - DEPENDS ON #21 + #1
- **Week 3-4 (2 days):** Alerts (Issue #3) - DEPENDS ON #21 + #1 + #2
- **Total:** 14 days (not 10 days)

---

## Action Items

### Immediate (Before Any Recipe Work)

1. **Prioritize Issue #21** as the critical path blocker
2. **Assign Issue #21** to a developer (4-day estimate)
3. **Complete Issue #21 acceptance criteria:**
   - [ ] `sales_transactions` table created and populated
   - [ ] `SalesTransaction` model with associations
   - [ ] `SquareSalesSyncService` syncing orders from Square API
   - [ ] `POSDataTransformer` transforming orders to unified format
   - [ ] Scheduled sync job running (daily at minimum)
   - [ ] Historical backfill (last 30 days) completed
   - [ ] Validation: Sales counts match Square dashboard

### After Issue #21 Complete

4. **Begin Issue #1** - Recipe foundation (depends on sales data)
5. **Update GitHub issues** with actual completion dates
6. **Validate data flow** - Recipe → Menu Item → Sales → Revenue Impact calculation

---

## Documentation Corrections Made

**Files Updated (2025-10-12):**
1. `/docs/RECIPE_VARIANCE_ANALYSIS_PLAN.md`
   - Added "Phase 0: Complete Sales Data Foundation" section
   - Marked Issue #21 as BLOCKER
   - Updated timeline from 10 days to 14 days

2. `/docs/MVP_IMPLEMENTATION_PLAN.md`
   - Changed Issue #21 from ✅ to ⚠️ (OPEN / IN PROGRESS)

3. `/.github/ISSUE_TEMPLATE/issue-recipe-variance-ondemand.md`
   - Added Issue #21 as hard dependency
   - Updated dependencies section with BLOCKER warning

4. `/.github/ISSUE_TEMPLATE/issue-recipe-variance-nightly.md`
   - Added Issue #21 as hard dependency
   - Clarified cannot run without sales data

5. `/.github/ISSUE_TEMPLATE/issue-recipe-variance-alerts.md`
   - Added Issue #21 as hard dependency

---

## Why This Matters

**Business Impact:**
- Dave's request cannot be fulfilled without sales data
- Revenue impact calculations are the core value proposition
- Without `sales_count`, can only show per-plate variance (not total impact)

**Technical Impact:**
- Recipe variance queries would fail (missing `sales_transactions` table)
- Nightly automation would have no sales data to analyze
- Alerts would never trigger (zero sales count = zero revenue impact)

**Risk Mitigation:**
- Correcting documentation prevents starting blocked work
- Clear dependency chain ensures proper sequencing
- 4-day Issue #21 estimate is realistic and tested (per GitHub issue)

---

## Success Criteria

**Issue #21 is complete when:**
1. ✅ Can run: `SELECT COUNT(*) FROM sales_transactions WHERE restaurant_id = 1 AND transaction_date >= NOW() - INTERVAL '7 days'`
2. ✅ Sales count matches Square dashboard for same period (validation)
3. ✅ Can link menu item → inventory item via `source_pos_item_id`
4. ✅ Scheduled job successfully syncs yesterday's sales
5. ✅ Historical backfill loaded last 30 days

**Then and only then can recipe variance work begin!**

---

**Prepared by:** GitHub Copilot (Lead Engineer)  
**Reviewed by:** Awaiting supervisor approval  
**Next Action:** Prioritize Issue #21 for immediate development
