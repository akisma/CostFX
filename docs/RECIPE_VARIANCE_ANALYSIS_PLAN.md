# Recipe Variance Analysis System - Implementation Plan

**Created**: October 12, 2025  
**Status**: Planning Phase  
**Priority**: P0 - Critical (Dave's Core Business Value Request)

---

## Executive Summary

### Dave's Business Problem

**Scenario**: "If I write a recipe using 6oz halibut at $10/lb from Vendor A, but my chef orders halibut at $15/lb from Vendor B, how much revenue am I losing per plate based on sales volume?"

**Core Value**: Track revenue loss when chefs order wrong products (wrong vendor, wrong grade, wrong specification) versus the recipe as written.

**Business Impact**:
- Price variance: $15/lb - $10/lb = **$5/lb difference**
- Per plate cost: 6oz × ($5/lb ÷ 16oz/lb) = **$1.875 extra cost per plate**
- If sold 100 plates: **$187.50 revenue loss**
- Annual impact: **Potentially thousands in lost profit** per recipe

---

## Current System Analysis

### ✅ **What We Have**

1. **Supplier Management** (`suppliers` table)
   - Basic vendor tracking (name, contact, pricing, lead times)
   - Supplier model with reliability scoring

2. **Square Sales Integration** (7 tables)
   - `square_orders` - Order data with timestamps
   - `square_order_items` - Line items with quantities
   - `square_menu_items` - Menu catalog with prices
   - Full sales volume tracking per menu item

3. **Variance Analysis Foundation**
   - `theoretical_usage_analysis` table - Variance tracking structure
   - `VarianceAnalysisService` - Business logic for variance calculations
   - `UsageCalculationService` - Actual vs theoretical comparisons
   - Period-based analysis support

4. **Inventory System**
   - `inventory_items` table with vendor linking (supplier_id)
   - `ingredient_categories` hierarchical structure with ltree
   - Transaction tracking and stock management

### ❌ **What We're Missing**

1. **NO Recipe System**
   - No `recipes` table
   - No `recipe_ingredients` junction table
   - No recipe-to-menu-item linking
   - No vendor specifications per recipe

2. **NO Recipe Cost Calculation**
   - No theoretical recipe cost tracking
   - No actual recipe cost comparison
   - No revenue impact calculation

3. **NO Recipe-Vendor Specification**
   - Can't specify "this recipe requires Vendor A's halibut at $10/lb"
   - Can't compare against actual purchases from Vendor B
   - No vendor substitution tracking

4. **NO Scheduled Analysis**
   - No nightly cron jobs
   - No automated variance detection
   - No dashboard summary generation

---

## System Architecture Design

### **Phase 1: Recipe Foundation** (Issue #1 - On-Demand Analysis)

#### Database Schema

```sql
-- Core recipes table
CREATE TABLE recipes (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'appetizer', 'entree', 'dessert', etc.
  serving_size DECIMAL(8,2) NOT NULL DEFAULT 1.00,
  serving_unit VARCHAR(50) NOT NULL DEFAULT 'plate',
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  target_food_cost_percent DECIMAL(5,2), -- Target food cost %
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recipe ingredients with vendor specifications
CREATE TABLE recipe_ingredients (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  
  -- Specified vendor (Dave's "I wrote the recipe using...")
  specified_supplier_id INTEGER REFERENCES suppliers(id),
  specified_price_per_unit DECIMAL(10,4), -- Price per unit as written in recipe
  specified_unit VARCHAR(50) NOT NULL, -- 'lb', 'oz', 'each', etc.
  
  -- Recipe quantities
  quantity DECIMAL(10,4) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  
  -- Cost factors
  waste_factor DECIMAL(5,4) DEFAULT 1.0500, -- 5% waste default
  is_critical BOOLEAN DEFAULT false, -- Critical to recipe quality
  substitution_allowed BOOLEAN DEFAULT false,
  
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link recipes to Square menu items
CREATE TABLE recipe_menu_item_links (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  square_menu_item_id INTEGER NOT NULL REFERENCES square_menu_items(id) ON DELETE CASCADE,
  
  -- Portion multiplier (e.g., "half portion" = 0.5)
  portion_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  
  -- Active status
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from_date DATE,
  effective_to_date DATE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(recipe_id, square_menu_item_id, effective_from_date)
);

-- Historical cost tracking
CREATE TABLE recipe_cost_snapshots (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  
  -- Costs
  theoretical_cost DECIMAL(10,2) NOT NULL, -- Cost using specified vendors
  actual_cost DECIMAL(10,2) NOT NULL, -- Cost from actual purchases
  variance_amount DECIMAL(10,2) NOT NULL, -- actual - theoretical
  variance_percent DECIMAL(8,4),
  
  -- Sales data
  sales_count INTEGER NOT NULL DEFAULT 0, -- Plates sold
  total_revenue DECIMAL(12,2), -- Total revenue from sales
  revenue_impact DECIMAL(12,2), -- variance × sales_count
  
  -- Metadata
  calculation_method VARCHAR(50) NOT NULL DEFAULT 'vendor_price_comparison',
  confidence_score DECIMAL(3,2),
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(recipe_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_recipes_restaurant ON recipes(restaurant_id);
CREATE INDEX idx_recipes_active ON recipes(is_active);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_item ON recipe_ingredients(inventory_item_id);
CREATE INDEX idx_recipe_ingredients_supplier ON recipe_ingredients(specified_supplier_id);
CREATE INDEX idx_recipe_links_recipe ON recipe_menu_item_links(recipe_id);
CREATE INDEX idx_recipe_links_menu_item ON recipe_menu_item_links(square_menu_item_id);
CREATE INDEX idx_recipe_snapshots_recipe_date ON recipe_cost_snapshots(recipe_id, snapshot_date DESC);
```

#### Service Layer Architecture

```javascript
/**
 * RecipeCostingService - Calculate theoretical recipe costs
 */
class RecipeCostingService {
  /**
   * Calculate theoretical cost using specified vendors
   * Dave's example: 6oz halibut @ $10/lb = $3.75
   */
  async calculateTheoreticalCost(recipeId) {
    const recipe = await Recipe.findByPk(recipeId, {
      include: [{
        model: RecipeIngredient,
        include: [InventoryItem, Supplier]
      }]
    });
    
    let totalCost = 0;
    for (const ingredient of recipe.recipeIngredients) {
      const unitCost = ingredient.specifiedPricePerUnit;
      const quantity = ingredient.quantity;
      const wasteFactor = ingredient.wasteFactor || 1.05;
      
      const ingredientCost = unitCost * quantity * wasteFactor;
      totalCost += ingredientCost;
    }
    
    return {
      recipeId,
      theoreticalCost: totalCost,
      costPerServing: totalCost / recipe.servingSize,
      ingredients: recipe.recipeIngredients.map(i => ({
        name: i.inventoryItem.name,
        specifiedVendor: i.supplier?.name,
        specifiedPrice: i.specifiedPricePerUnit,
        quantity: i.quantity,
        unit: i.unit,
        cost: i.specifiedPricePerUnit * i.quantity * i.wasteFactor
      }))
    };
  }
  
  /**
   * Calculate actual cost from recent purchases
   * Looks at inventory_items.current_price or recent transactions
   */
  async calculateActualCost(recipeId, asOfDate = new Date()) {
    const recipe = await Recipe.findByPk(recipeId, {
      include: [RecipeIngredient]
    });
    
    let totalCost = 0;
    const actualPrices = [];
    
    for (const ingredient of recipe.recipeIngredients) {
      // Get actual purchase price from inventory system
      const actualPrice = await this._getActualPurchasePrice(
        ingredient.inventoryItemId,
        asOfDate
      );
      
      const ingredientCost = actualPrice * ingredient.quantity * ingredient.wasteFactor;
      totalCost += ingredientCost;
      
      actualPrices.push({
        inventoryItemId: ingredient.inventoryItemId,
        actualPrice,
        specifiedPrice: ingredient.specifiedPricePerUnit,
        variance: actualPrice - ingredient.specifiedPricePerUnit
      });
    }
    
    return {
      recipeId,
      actualCost: totalCost,
      costPerServing: totalCost / recipe.servingSize,
      priceComparison: actualPrices
    };
  }
  
  async _getActualPurchasePrice(inventoryItemId, asOfDate) {
    // Implementation: Check recent inventory_transactions for purchase price
    // Fallback to inventory_items.unit_cost_latest
    const item = await InventoryItem.findByPk(inventoryItemId);
    return item.unitCostLatest || 0;
  }
}

/**
 * RecipeVarianceAnalysisService - Compare theoretical vs actual
 */
class RecipeVarianceAnalysisService {
  /**
   * Dave's core calculation: "How much am I losing?"
   */
  async analyzeRecipeVariance(recipeId, analysisDate = new Date()) {
    const theoretical = await recipeCostingService.calculateTheoreticalCost(recipeId);
    const actual = await recipeCostingService.calculateActualCost(recipeId, analysisDate);
    
    const varianceAmount = actual.actualCost - theoretical.theoreticalCost;
    const variancePercent = (varianceAmount / theoretical.theoreticalCost) * 100;
    
    return {
      recipeId,
      analysisDate,
      theoretical: theoretical.theoreticalCost,
      actual: actual.actualCost,
      variance: {
        amount: varianceAmount,
        percent: variancePercent,
        direction: varianceAmount > 0 ? 'over' : 'under'
      },
      ingredientBreakdown: actual.priceComparison,
      isSignificant: Math.abs(varianceAmount) > 1.00 // $1+ variance
    };
  }
  
  /**
   * Calculate revenue impact based on sales volume
   * Dave: "Show me based off of sales how much I would lose"
   */
  async calculateRevenueImpact(recipeId, startDate, endDate) {
    const variance = await this.analyzeRecipeVariance(recipeId, endDate);
    const salesCount = await this._getSalesCount(recipeId, startDate, endDate);
    
    const revenueImpact = variance.variance.amount * salesCount;
    
    return {
      recipeId,
      period: { startDate, endDate },
      variance: variance.variance.amount,
      salesCount,
      revenueImpact,
      impactPerPlate: variance.variance.amount,
      summary: `$${Math.abs(revenueImpact).toFixed(2)} ${revenueImpact > 0 ? 'loss' : 'gain'} on ${salesCount} plates sold`
    };
  }
  
  async _getSalesCount(recipeId, startDate, endDate) {
    // Get square_menu_item_id from recipe_menu_item_links
    // Count square_order_items in date range
    const link = await RecipeMenuItemLink.findOne({ where: { recipeId } });
    if (!link) return 0;
    
    const orderItems = await SquareOrderItem.count({
      where: {
        squareMenuItemId: link.squareMenuItemId,
        createdAt: { [Op.between]: [startDate, endDate] }
      }
    });
    
    return orderItems;
  }
}

/**
 * RecipeAIAnalysisService - AI-powered insights
 */
class RecipeAIAnalysisService extends BaseAgent {
  async analyzeVariancePattern(recipeId, historicalDays = 30) {
    const snapshots = await RecipeCostSnapshot.findAll({
      where: {
        recipeId,
        snapshotDate: {
          [Op.gte]: subDays(new Date(), historicalDays)
        }
      },
      order: [['snapshotDate', 'ASC']]
    });
    
    const analysis = await this.callAI({
      prompt: `Analyze this recipe cost variance pattern:
      
      Recipe: ${snapshots[0].recipe.name}
      Period: Last ${historicalDays} days
      Data: ${JSON.stringify(snapshots, null, 2)}
      
      Identify:
      1. Root cause of variance (vendor substitution, price fluctuation, portion drift)
      2. Pattern: Consistent, increasing, or sporadic?
      3. Revenue impact severity
      4. Recommended actions
      
      Format as structured JSON.`
    });
    
    return {
      recipeId,
      period: { days: historicalDays },
      insights: analysis.insights,
      rootCauses: analysis.rootCauses,
      recommendations: analysis.recommendations,
      severity: analysis.severity // 'critical', 'high', 'medium', 'low'
    };
  }
}
```

---

### **Phase 2: Nightly Automation** (Issue #2 - Scheduled Analysis)

#### Scheduled Job Architecture

```javascript
/**
 * ScheduledVarianceAnalysisService - Orchestrate midnight runs
 * 
 * Cron job: 0 0 * * * (Daily at midnight)
 */
class ScheduledVarianceAnalysisService {
  async runDailyAnalysis(restaurantId) {
    const today = new Date();
    const yesterday = subDays(today, 1);
    
    console.log(`Starting daily recipe variance analysis for restaurant ${restaurantId}`);
    
    // Step 1: Get all active recipes
    const recipes = await Recipe.findAll({
      where: { restaurantId, isActive: true }
    });
    
    // Step 2: Analyze each recipe
    const results = [];
    for (const recipe of recipes) {
      try {
        // Calculate variance
        const variance = await recipeVarianceAnalysisService.analyzeRecipeVariance(
          recipe.id,
          yesterday
        );
        
        // Get sales count
        const impact = await recipeVarianceAnalysisService.calculateRevenueImpact(
          recipe.id,
          yesterday,
          yesterday
        );
        
        // Save snapshot
        await RecipeCostSnapshot.create({
          recipeId: recipe.id,
          snapshotDate: yesterday,
          theoreticalCost: variance.theoretical,
          actualCost: variance.actual,
          varianceAmount: variance.variance.amount,
          variancePercent: variance.variance.percent,
          salesCount: impact.salesCount,
          revenueImpact: impact.revenueImpact
        });
        
        results.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          variance: variance.variance.amount,
          impact: impact.revenueImpact,
          severity: this._calculateSeverity(variance, impact)
        });
        
      } catch (error) {
        console.error(`Error analyzing recipe ${recipe.id}:`, error);
        results.push({
          recipeId: recipe.id,
          error: error.message
        });
      }
    }
    
    // Step 3: Generate AI summary
    const aiAnalysis = await recipeAIAnalysisService.generateDailySummary(results);
    
    // Step 4: Store dashboard data
    await this._storeDashboardSummary(restaurantId, yesterday, {
      results,
      aiAnalysis,
      totalRevenueImpact: results.reduce((sum, r) => sum + (r.impact || 0), 0)
    });
    
    return {
      restaurantId,
      date: yesterday,
      recipesAnalyzed: recipes.length,
      totalImpact: results.reduce((sum, r) => sum + (r.impact || 0), 0),
      criticalCount: results.filter(r => r.severity === 'critical').length
    };
  }
  
  _calculateSeverity(variance, impact) {
    const absImpact = Math.abs(impact.revenueImpact);
    if (absImpact > 100) return 'critical';
    if (absImpact > 50) return 'high';
    if (absImpact > 20) return 'medium';
    return 'low';
  }
  
  async _storeDashboardSummary(restaurantId, date, data) {
    // Store in Redis or database for fast dashboard retrieval
    await redis.set(
      `dashboard:recipe_variance:${restaurantId}:${format(date, 'yyyy-MM-dd')}`,
      JSON.stringify(data),
      'EX',
      86400 * 7 // 7 days TTL
    );
  }
}

// Cron job registration
import cron from 'node-cron';

// Run daily at midnight
cron.schedule('0 0 * * *', async () => {
  const restaurants = await Restaurant.findAll({ where: { isActive: true } });
  
  for (const restaurant of restaurants) {
    await scheduledVarianceAnalysisService.runDailyAnalysis(restaurant.id);
  }
});
```

---

### **Phase 3: Alert System** (Issue #3 - Email/SMS Notifications)

```javascript
/**
 * RecipeAlertService - Critical variance notifications
 */
class RecipeAlertService {
  async checkAndSendAlerts(analysisResults, restaurantId) {
    const criticalVariances = analysisResults.filter(r => 
      r.severity === 'critical' || r.severity === 'high'
    );
    
    if (criticalVariances.length === 0) return;
    
    // Get restaurant notification settings
    const restaurant = await Restaurant.findByPk(restaurantId, {
      include: [{ model: User, as: 'managers' }]
    });
    
    // Generate alert message
    const alertMessage = this._formatAlertMessage(criticalVariances, restaurant);
    
    // Send email
    if (restaurant.notificationSettings.email) {
      await this.sendEmailAlert(restaurant.managers, alertMessage);
    }
    
    // Send SMS (optional)
    if (restaurant.notificationSettings.sms) {
      await this.sendSMSAlert(restaurant.managers, alertMessage);
    }
  }
  
  _formatAlertMessage(variances, restaurant) {
    const totalImpact = variances.reduce((sum, v) => sum + Math.abs(v.impact), 0);
    
    return `
    🚨 Recipe Cost Variance Alert - ${restaurant.name}
    
    Date: ${format(new Date(), 'MMMM d, yyyy')}
    
    ${variances.length} recipes with significant cost variances:
    
    ${variances.map(v => `
    • ${v.recipeName}: $${Math.abs(v.variance).toFixed(2)} variance
      Revenue impact: $${Math.abs(v.impact).toFixed(2)} (${v.salesCount} plates sold)
    `).join('')}
    
    Total revenue impact: $${totalImpact.toFixed(2)}
    
    Action required: Review vendor orders and recipe specifications.
    
    View full report: ${config.get('app.frontendUrl')}/dashboard/recipe-variance
    `;
  }
}
```

---

## Implementation Roadmap

### ⚠️ CRITICAL PREREQUISITE: Issue #21 Must Be Completed First

**BLOCKER:** The recipe variance analysis system requires sales data from Square. **Issue #21 (Square Sales Data Synchronization) is currently OPEN** and must be completed before any recipe variance work can begin.

**Issue #21 Deliverables Needed:**
- `sales_transactions` table (Tier 2 unified format)
- `SalesTransaction` Sequelize model
- `SquareSalesSyncService` to fetch orders from Square API
- `POSDataTransformer` methods to transform `square_orders` → `sales_transactions`
- Scheduled sync job for daily/hourly sales updates
- Link `sales_transactions.inventory_item_id` to unified `inventory_items` table

**Estimated Time:** 4 days (per Issue #21)

**Why This Blocks Recipe Variance:**
- Revenue impact calculation requires: `variance_per_plate × sales_count = revenue_loss`
- Cannot get `sales_count` without querying `sales_transactions` table
- Cannot link recipes to sales without `recipe_menu_item_links` → `square_menu_items` → `sales_transactions` data flow

**Current Status:** Issue #21 is in "Ready" state on GitHub but not implemented yet.

---

### **Phase 0: Complete Sales Data Foundation** (4 days) - Issue #21

**Must be completed before starting Phase 1!**

See full details: https://github.com/akisma/CostFX/issues/21

**Key Deliverables:**
1. Database: Create `sales_transactions` table with proper indexes
2. Model: `SalesTransaction` with associations to `inventory_items`
3. Sync Service: `SquareSalesSyncService` to fetch orders from Square API
4. Transform Service: Update `POSDataTransformer` with sales transformation methods
5. Scheduled Job: Daily/hourly sync to keep sales data current
6. Historical Backfill: Import last 30 days of sales for immediate analysis

**Acceptance Criteria:**
- ✅ `sales_transactions` table populated with Square data
- ✅ Can query sales count by menu item and date range
- ✅ Automated sync job running successfully
- ✅ Sales counts match Square dashboard (validation)

---

### **Phase 1 (Issue #1): On-Demand Recipe Variance Analysis** (P0 - 5 days)

**Depends on:** Phase 0 (Issue #21) must be complete

**Deliverables**:
- ✅ Database migrations (4 tables)
- ✅ Sequelize models (Recipe, RecipeIngredient, RecipeMenuItemLink, RecipeCostSnapshot)
- ✅ Service layer (RecipeCostingService, RecipeVarianceAnalysisService)
- ✅ API endpoints (CRUD recipes, analyze variance, calculate impact)
- ✅ Basic recipe UI (create recipe, view variance)
- ✅ Integration tests

**Acceptance Criteria**:
- Dave can create a recipe specifying vendor and price
- System calculates theoretical cost using specified vendors
- System compares against actual purchase prices
- System shows revenue impact based on sales volume
- Reports accurate per-plate variance (e.g., $1.875 in halibut example)

---

### **Phase 2 (Issue #2): Nightly Automated Analysis** (P0 - 3 days)

**Depends on:** Phase 0 (Issue #21) + Phase 1 (Issue #1) must be complete

**Deliverables**:
- ✅ ScheduledVarianceAnalysisService
- ✅ Cron job setup (midnight runs)
- ✅ Dashboard summary generation
- ✅ Redis caching for fast dashboard loads
- ✅ RecipeAIAnalysisService (AI-powered insights)
- ✅ Dashboard UI components (variance summary, charts)

**Acceptance Criteria**:
- Analysis runs automatically at midnight
- Dashboard shows yesterday's variance summary on sign-in
- AI provides insights and recommendations
- Historical trend analysis available
- Performance: Dashboard loads in <2 seconds

---

### **Phase 3 (Issue #3): Critical Variance Alerts** (P1 - 2 days)

**Depends on:** Phase 0 (Issue #21) + Phase 1 (Issue #1) + Phase 2 (Issue #2) must be complete

**Deliverables**:
- ✅ RecipeAlertService
- ✅ Email notification system
- ✅ SMS notification system (Twilio integration)
- ✅ Alert configuration UI
- ✅ Threshold management

**Acceptance Criteria**:
- Alerts sent for variances >$50 revenue impact
- Email and SMS options configurable
- Alert contains actionable information

---

## Total Timeline

**Total Estimated Time:** 14 days (across 4 phases)

**Critical Path:**
1. **Phase 0 (4 days):** Complete Issue #21 - Sales data foundation ⚠️ **BLOCKER - Must do first**
2. **Phase 1 (5 days):** Recipe foundation & on-demand analysis (NEW Issue #1)
3. **Phase 2 (3 days):** Nightly automation (NEW Issue #2)
4. **Phase 3 (2 days):** Alert system (NEW Issue #3)

**Work Sequence:**
- Week 1: Focus on Issue #21 (sales sync) - blocking all other work
- Week 2: Recipe foundation (Issue #1) - can start after Issue #21 complete
- Week 3: Nightly automation (Issue #2) + Alerts (Issue #3 can run parallel at end)

**Cannot proceed with recipe variance work until Issue #21 is complete!**
- Managers can acknowledge/dismiss alerts
- Alert history tracked

---

## Testing Strategy

### Unit Tests
- RecipeCostingService calculations
- Variance percentage logic
- Revenue impact multiplier
- AI prompt generation

### Integration Tests
- Full variance analysis flow
- Sales data integration from Square
- Scheduled job execution
- Alert delivery

### End-to-End Tests
- Create recipe → analyze variance → view dashboard
- Nightly job → dashboard update → alert delivery
- Historical trend analysis

---

## Security & Compliance

- Recipe data restricted by restaurant_id
- Vendor pricing considered sensitive
- API endpoints require authentication
- Audit trail for recipe modifications
- Alert settings require manager role

---

## Performance Considerations

- Scheduled analysis runs during low-traffic hours (midnight)
- Dashboard summaries cached in Redis (7-day TTL)
- Batch processing for multiple recipes
- Indexed queries on recipe_id, snapshot_date
- Async processing for AI analysis

---

## Future Enhancements

1. **Predictive Variance Forecasting**: Predict future variances based on market trends
2. **Automatic Vendor Recommendations**: AI suggests better vendor alternatives
3. **Contract Compliance Tracking**: Alert when orders deviate from vendor contracts
4. **Mobile App Notifications**: Push notifications for critical variances
5. **Multi-location Analysis**: Compare variance across restaurant locations

---

## Questions for Principal Engineer

1. **Priority**: Confirm P0 priority for Issue #1 (on-demand analysis)
2. **Timeline**: Is 10-day total timeline (5+3+2 days) acceptable?
3. **AI Budget**: OpenAI API cost implications for nightly analysis?
4. **Alert Frequency**: Daily alerts sufficient, or real-time needed?
5. **Historical Data**: How many months of snapshot history to retain?
6. **Vendor Contracts**: Should we add contract pricing tracking?

---

**Next Steps**: Create 3 GitHub issues using feature template with Gherkin scenarios.
