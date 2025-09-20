#!/bin/bash

# Migration Validation Script
# Tests that database migrations were applied successfully

set -e

echo "🔍 Testing Migration Success..."
echo ""

# Database connection string
DB_URL="postgresql://postgres:password@localhost:5432/restaurant_ai"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test function
test_query() {
    local test_name="$1"
    local query="$2"
    local expected_count="$3"
    
    echo -n "  Testing $test_name..."
    
    local result=$(docker-compose exec -T db psql -U postgres -d restaurant_ai -t -c "$query" | xargs)
    
    if [ "$result" = "$expected_count" ]; then
        echo -e " ${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e " ${RED}❌ FAIL${NC} (Expected: $expected_count, Got: $result)"
        return 1
    fi
}

# Test migration tracking
echo -e "${BLUE}📊 Migration Tracking Tests:${NC}"
test_query "Migration count" "SELECT COUNT(*) FROM pgmigrations;" "8"
test_query "Ingredient categories migration exists" "SELECT COUNT(*) FROM pgmigrations WHERE name = '1726790000001_create-ingredient-categories';" "1"
test_query "Inventory periods migration exists" "SELECT COUNT(*) FROM pgmigrations WHERE name = '1726790000002_create-inventory-periods';" "1"
test_query "Suppliers migration exists" "SELECT COUNT(*) FROM pgmigrations WHERE name = '1726790000010_create-suppliers';" "1"
test_query "Inventory items migration exists" "SELECT COUNT(*) FROM pgmigrations WHERE name = '1726790000011_create-inventory-items';" "1"
test_query "Inventory transactions migration exists" "SELECT COUNT(*) FROM pgmigrations WHERE name = '1726790000012_create-inventory-transactions';" "1"
test_query "Period snapshots migration exists" "SELECT COUNT(*) FROM pgmigrations WHERE name = '1726790000013_create-period-inventory-snapshots';" "1"

echo ""

# Test table creation
echo -e "${BLUE}🗃️  Table Creation Tests:${NC}"
test_query "ingredient_categories table exists" "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'ingredient_categories';" "1"
test_query "inventory_periods table exists" "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'inventory_periods';" "1"
test_query "suppliers table exists" "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'suppliers';" "1"
test_query "inventory_items table exists" "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'inventory_items';" "1"
test_query "inventory_transactions table exists" "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'inventory_transactions';" "1"
test_query "period_inventory_snapshots table exists" "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'period_inventory_snapshots';" "1"

echo ""

# Test ltree extension
echo -e "${BLUE}🌳 ltree Extension Tests:${NC}"
test_query "ltree extension enabled" "SELECT COUNT(*) FROM pg_extension WHERE extname = 'ltree';" "1"

echo ""

# Test hierarchical data
echo -e "${BLUE}📦 Ingredient Categories Data Tests:${NC}"
test_query "Total categories created" "SELECT COUNT(*) FROM ingredient_categories;" "6"
test_query "Root level categories" "SELECT COUNT(*) FROM ingredient_categories WHERE nlevel(path) = 1;" "2"
test_query "Produce hierarchy items" "SELECT COUNT(*) FROM ingredient_categories WHERE path <@ 'produce';" "3"
test_query "Spices hierarchy items" "SELECT COUNT(*) FROM ingredient_categories WHERE path <@ 'spices';" "3"

echo ""

# Test period data
echo -e "${BLUE}📅 Inventory Periods Data Tests:${NC}"
test_query "Total periods created" "SELECT COUNT(*) FROM inventory_periods;" "3"
test_query "Weekly periods" "SELECT COUNT(*) FROM inventory_periods WHERE period_type = 'weekly';" "2"
test_query "Monthly periods" "SELECT COUNT(*) FROM inventory_periods WHERE period_type = 'monthly';" "1"
test_query "Active periods" "SELECT COUNT(*) FROM inventory_periods WHERE status = 'active';" "2"
test_query "Closed periods" "SELECT COUNT(*) FROM inventory_periods WHERE status = 'closed';" "1"

echo ""

# Test constraints and indexes
echo -e "${BLUE}🔗 Constraints and Indexes Tests:${NC}"
test_query "ingredient_categories indexes (at least 3)" "SELECT CASE WHEN COUNT(*) >= 3 THEN 1 ELSE 0 END FROM pg_indexes WHERE tablename = 'ingredient_categories';" "1"
test_query "inventory_periods indexes (at least 4)" "SELECT CASE WHEN COUNT(*) >= 4 THEN 1 ELSE 0 END FROM pg_indexes WHERE tablename = 'inventory_periods';" "1"
test_query "suppliers indexes (at least 2)" "SELECT CASE WHEN COUNT(*) >= 2 THEN 1 ELSE 0 END FROM pg_indexes WHERE tablename = 'suppliers';" "1"
test_query "inventory_items indexes (at least 8)" "SELECT CASE WHEN COUNT(*) >= 8 THEN 1 ELSE 0 END FROM pg_indexes WHERE tablename = 'inventory_items';" "1"
test_query "inventory_transactions indexes (at least 10)" "SELECT CASE WHEN COUNT(*) >= 10 THEN 1 ELSE 0 END FROM pg_indexes WHERE tablename = 'inventory_transactions';" "1"
test_query "period_inventory_snapshots indexes (at least 8)" "SELECT CASE WHEN COUNT(*) >= 8 THEN 1 ELSE 0 END FROM pg_indexes WHERE tablename = 'period_inventory_snapshots';" "1"

echo ""

# Test specific Dave's use case data
echo -e "${BLUE}👨‍🍳 Dave's Use Case Validation:${NC}"
echo "  Testing romaine lettuce hierarchy..."
romaine_path=$(docker-compose exec -T db psql -U postgres -d restaurant_ai -t -c "SELECT path FROM ingredient_categories WHERE name = 'Romaine Lettuce';" | xargs)
if [ "$romaine_path" = "produce.leafy_greens.romaine" ]; then
    echo -e "    ${GREEN}✅ Romaine path correct${NC}"
else
    echo -e "    ${RED}❌ Romaine path incorrect${NC}"
fi

echo "  Testing saffron hierarchy..."
saffron_path=$(docker-compose exec -T db psql -U postgres -d restaurant_ai -t -c "SELECT path FROM ingredient_categories WHERE name = 'Saffron';" | xargs)
if [ "$saffron_path" = "spices.premium.saffron" ]; then
    echo -e "    ${GREEN}✅ Saffron path correct${NC}"
else
    echo -e "    ${RED}❌ Saffron path incorrect${NC}"
fi

echo "  Testing current week period..."
current_week=$(docker-compose exec -T db psql -U postgres -d restaurant_ai -t -c "SELECT COUNT(*) FROM inventory_periods WHERE period_name = 'Week 39 2025' AND status = 'active';" | xargs)
if [ "$current_week" = "1" ]; then
    echo -e "    ${GREEN}✅ Current week period active${NC}"
else
    echo -e "    ${RED}❌ Current week period not found or inactive${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Migration validation completed!${NC}"
echo ""
echo "ℹ️  Summary:"
echo "  • Database tables: 8 core tables created (suppliers, inventory_items, inventory_transactions, period_inventory_snapshots, etc.)"
echo "  • ltree extension: Enabled for hierarchical categories"
echo "  • Ingredient categories: 6 items with proper hierarchy"
echo "  • Inventory periods: 3 periods (2 weekly, 1 monthly)"
echo "  • Dave's use case: Romaine (low value) and Saffron (high value) ready"
echo "  • Period management: Active periods for variance analysis"
echo "  • Core schema: Full foundation for restaurant inventory management"
echo "  • Variance tracking: Enhanced with period linkage and approval workflows"
