# CostFX R365 Integration - Gherkin Requirements Document

**Project:** CostFX Restaurant Analytics Platform  
**Integration Partner:** Restaurant365  
**Version:** 1.0  
**Last Updated:** 2025-01-01  

---

## Table of Contents

1. [Phase 1: Foundation & Authentication](#phase-1-foundation--authentication)
2. [Phase 2: Data Models & Storage](#phase-2-data-models--storage)
3. [Phase 3: Basic Data Synchronization](#phase-3-basic-data-synchronization)
4. [Phase 4: Core Analytics - Theoretical vs Actual](#phase-4-core-analytics---theoretical-vs-actual)
5. [Phase 5: Seasonal Pricing & Cost Optimization](#phase-5-seasonal-pricing--cost-optimization)
6. [Phase 6: Waste Reduction & Expiration Management](#phase-6-waste-reduction--expiration-management)
7. [Phase 7: Labor Planning & Prep Time Analysis](#phase-7-labor-planning--prep-time-analysis)
8. [Phase 8: Demand Forecasting & Order Optimization](#phase-8-demand-forecasting--order-optimization)
9. [Phase 9: Real-time Dashboard & Alerting](#phase-9-real-time-dashboard--alerting)
10. [Phase 10: Production Deployment & Monitoring](#phase-10-production-deployment--monitoring)

---

# Phase 1: Foundation & Authentication

## Epic 1.1: R365 API Authentication Setup

### Feature: Restaurant365 API Credentials Management
```gherkin
Feature: R365 API Credentials Management
  As a CostFX system administrator
  I want to securely store and manage Restaurant365 API credentials
  So that the system can authenticate with R365 on behalf of multiple restaurant clients

  Background:
    Given the CostFX system is deployed on AWS
    And environment variables are configured
    And AWS Secrets Manager is available

  Scenario: Store new R365 client credentials
    Given I am an authenticated system administrator
    When I submit new R365 credentials with:
      | field              | value                    |
      | client_subdomain   | demo-restaurant          |
      | api_username       | costfx_integration       |
      | api_password       | secure_password_123      |
      | client_name        | Demo Restaurant Group    |
    Then the credentials should be encrypted using AES-256
    And the credentials should be stored in AWS Secrets Manager
    And the credentials should be tagged with client_id
    And I should receive a confirmation message
    And the credentials should be retrievable by client_id

  Scenario: Retrieve existing R365 credentials
    Given R365 credentials exist for client "restaurant-abc"
    When the system needs to authenticate with R365
    Then the credentials should be fetched from AWS Secrets Manager
    And the credentials should be decrypted
    And the credentials should be returned to the authentication service

  Scenario: Handle missing credentials
    Given no R365 credentials exist for client "new-client"
    When the system attempts to authenticate with R365
    Then the system should return error "R365_CREDENTIALS_NOT_FOUND"
    And the error should include client_id "new-client"
    And the system should log the missing credentials event
```

### Feature: JWT Token Authentication
```gherkin
Feature: JWT Token Authentication with Restaurant365
  As the CostFX integration service
  I want to obtain and cache JWT tokens from Restaurant365
  So that I can make authenticated API requests efficiently

  Background:
    Given valid R365 credentials are stored
    And the R365 API is accessible at "https://[client].restaurant365.com/APIv1"

  Scenario: Successfully obtain JWT token
    Given I have valid R365 credentials for client "demo-restaurant"
    When I request a JWT token from R365
    Then I should send a POST request to "/Authenticate/JWT"
    And the request should include:
      | field      | value                |
      | UserName   | costfx_integration   |
      | Password   | secure_password_123  |
    And I should receive a JWT token
    And the token should be valid for at least 55 minutes
    And the token should be cached with key "r365_token:demo-restaurant"
    And the cache TTL should be 55 minutes

  Scenario: Use cached JWT token
    Given a valid JWT token is cached for client "demo-restaurant"
    And the token was cached 10 minutes ago
    When I need to make an authenticated R365 API request
    Then I should retrieve the token from cache
    And I should not make a new authentication request
    And the cached token should be used for the API request

  Scenario: Refresh expired JWT token
    Given a JWT token was cached for client "demo-restaurant"
    And the token has expired
    When I need to make an authenticated R365 API request
    Then I should detect the token is expired
    And I should request a new JWT token from R365
    And the new token should replace the cached token
    And the new token should be used for the API request

  Scenario: Handle authentication failure
    Given I have invalid R365 credentials for client "demo-restaurant"
    When I request a JWT token from R365
    Then I should receive a 401 Unauthorized response
    And I should return error "R365_AUTH_FAILED"
    And I should log the authentication failure
    And I should not cache any token
    And I should notify the system administrator

  Scenario: Handle network errors during authentication
    Given valid R365 credentials exist for client "demo-restaurant"
    And the R365 API is temporarily unavailable
    When I request a JWT token from R365
    Then I should receive a connection error
    And I should retry the request up to 3 times
    And I should wait 5 seconds between retries
    And if all retries fail, I should return error "R365_CONNECTION_ERROR"
    And I should log the connectivity issue
```

### Feature: Authentication Middleware
```gherkin
Feature: Express Authentication Middleware
  As an API developer
  I want middleware to automatically handle R365 authentication
  So that all API requests are properly authenticated

  Background:
    Given the Express server is running
    And authentication middleware is registered

  Scenario: Make authenticated request to R365
    Given I have a valid JWT token cached for client "demo-restaurant"
    When I make a request to "/api/r365/inventory"
    Then the middleware should retrieve the cached token
    And the middleware should add header "Authorization: Bearer [token]"
    And the request should be forwarded to the handler

  Scenario: Token refresh during request
    Given the JWT token for client "demo-restaurant" has expired
    When I make a request to "/api/r365/inventory"
    Then the middleware should detect the expired token
    And the middleware should request a new token
    And the middleware should cache the new token
    And the request should proceed with the new token

  Scenario: Handle authentication errors in middleware
    Given authentication fails for client "demo-restaurant"
    When I make a request to "/api/r365/inventory"
    Then the middleware should return 401 status code
    And the response should include error "R365_AUTH_ERROR"
    And the response should include message "Unable to authenticate with Restaurant365"
    And the request should not proceed to the handler
```

---

# Phase 2: Data Models & Storage

## Epic 2.1: PostgreSQL Schema Design

### Feature: Location Data Model
```gherkin
Feature: Restaurant Location Data Model
  As a data architect
  I want to store restaurant location information from R365
  So that I can associate all data with specific restaurant locations

  Background:
    Given PostgreSQL database is running
    And Sequelize ORM is configured

  Scenario: Create location record
    Given I have R365 location data:
      | field              | value                |
      | r365_location_id   | LOC-001              |
      | name               | Downtown Location    |
      | address            | 123 Main St          |
      | city               | New York             |
      | state              | NY                   |
      | timezone           | America/New_York     |
      | is_active          | true                 |
    When I save the location to the database
    Then a new record should be created in "r365_locations" table
    And the record should have primary key "LOC-001"
    And the record should include timestamp "created_at"
    And the record should include timestamp "updated_at"

  Scenario: Update existing location
    Given a location exists with r365_location_id "LOC-001"
    When I update the location with:
      | field     | value                    |
      | name      | Downtown Location (Main) |
      | is_active | true                     |
    Then the existing record should be updated
    And the "updated_at" timestamp should be refreshed
    And the "created_at" timestamp should remain unchanged

  Scenario: Query locations by status
    Given multiple locations exist in the database
    And location "LOC-001" has is_active = true
    And location "LOC-002" has is_active = false
    When I query for active locations
    Then I should receive only location "LOC-001"
    And the result should not include location "LOC-002"
```

### Feature: Inventory Item Data Model
```gherkin
Feature: Inventory Item Data Model
  As a data architect
  I want to store inventory item information from R365
  So that I can track ingredients and their costs over time

  Background:
    Given the database schema is migrated
    And locations exist in the database

  Scenario: Create inventory item record
    Given location "LOC-001" exists
    When I create an inventory item with:
      | field               | value              |
      | r365_item_id        | ITEM-12345         |
      | location_id         | LOC-001            |
      | item_name           | Chicken Breast     |
      | category            | Protein            |
      | unit_of_measure     | pound              |
      | current_cost        | 4.50               |
      | average_cost        | 4.35               |
      | on_hand_quantity    | 25.5               |
      | par_level           | 50.0               |
      | lead_time_days      | 2                  |
      | shelf_life_days     | 7                  |
    Then a new record should be created in "r365_inventory_items" table
    And the record should be associated with location "LOC-001"
    And the record should have composite primary key (r365_item_id, location_id)
    And numeric fields should be stored as DECIMAL with appropriate precision

  Scenario: Track cost changes over time
    Given inventory item "ITEM-12345" exists at location "LOC-001"
    And the current_cost is 4.50
    When I update the item with:
      | field          | value |
      | current_cost   | 4.75  |
      | average_cost   | 4.40  |
    Then the record should be updated
    And the last_updated timestamp should be set to now
    And I should be able to query historical cost changes

  Scenario: Calculate inventory value
    Given inventory item "ITEM-12345" exists with:
      | field            | value |
      | current_cost     | 4.50  |
      | on_hand_quantity | 25.5  |
    When I calculate the inventory value
    Then the value should be 114.75 (25.5 * 4.50)
    And the calculation should use current_cost
    And the result should be rounded to 2 decimal places
```

### Feature: Sales Transaction Data Model
```gherkin
Feature: Sales Transaction Data Model
  As a data architect
  I want to store sales transaction data from R365
  So that I can analyze theoretical vs actual usage

  Background:
    Given the database schema is migrated
    And locations exist in the database

  Scenario: Create sales detail record
    Given location "LOC-001" exists
    When I create a sales detail record with:
      | field             | value                    |
      | transaction_id    | TXN-2024-001             |
      | location_id       | LOC-001                  |
      | menu_item_id      | MENU-BURGER-01           |
      | quantity_sold     | 3                        |
      | gross_sales       | 45.00                    |
      | cost_of_goods     | 13.50                    |
      | transaction_date  | 2024-01-15T18:30:00Z     |
      | day_part          | dinner                   |
    Then a new record should be created in "r365_sales_details" table
    And the record should be indexed by transaction_date
    And the record should be associated with location "LOC-001"

  Scenario: Query sales by date range
    Given multiple sales records exist for location "LOC-001"
    And sales exist between 2024-01-01 and 2024-01-31
    When I query sales for date range "2024-01-15" to "2024-01-20"
    Then I should receive only sales within that date range
    And the results should be ordered by transaction_date DESC
    And the query should use the transaction_date index

  Scenario: Aggregate sales by menu item
    Given multiple sales records exist for location "LOC-001"
    And menu item "MENU-BURGER-01" was sold 15 times
    And menu item "MENU-SALAD-01" was sold 8 times
    When I aggregate sales by menu_item_id for January 2024
    Then I should receive grouped results:
      | menu_item_id    | total_quantity | total_sales | total_cogs |
      | MENU-BURGER-01  | 15             | 225.00      | 67.50      |
      | MENU-SALAD-01   | 8              | 96.00       | 32.00      |
```

### Feature: Recipe Data Models
```gherkin
Feature: Recipe and Recipe Ingredient Data Models
  As a data architect
  I want to store recipe information from R365
  So that I can calculate theoretical ingredient usage

  Background:
    Given the database schema is migrated

  Scenario: Create recipe record
    Given I have recipe data from R365
    When I create a recipe with:
      | field                | value                |
      | recipe_id            | RECIPE-001           |
      | menu_item_name       | Classic Burger       |
      | total_recipe_cost    | 4.50                 |
      | prep_time_minutes    | 15                   |
      | portions_yield       | 1                    |
      | last_costed          | 2024-01-15T10:00:00Z |
    Then a new record should be created in "r365_recipes" table
    And the record should have primary key "RECIPE-001"

  Scenario: Create recipe ingredients
    Given recipe "RECIPE-001" exists
    And inventory items exist in the database
    When I create recipe ingredients:
      | recipe_id   | item_id       | quantity_required | unit_of_measure | ingredient_cost | prep_method |
      | RECIPE-001  | ITEM-BEEF-001 | 0.25              | pound           | 1.50            | ground      |
      | RECIPE-001  | ITEM-BUN-001  | 1.00              | each            | 0.35            | toasted     |
      | RECIPE-001  | ITEM-LETTUCE  | 0.05              | pound           | 0.15            | shredded    |
    Then 3 records should be created in "r365_recipe_ingredients" table
    And each record should reference the recipe
    And each record should reference an inventory item
    And the sum of ingredient_costs should equal total_recipe_cost

  Scenario: Calculate theoretical consumption from sales
    Given recipe "RECIPE-001" has ingredients:
      | item_id       | quantity_required |
      | ITEM-BEEF-001 | 0.25              |
      | ITEM-BUN-001  | 1.00              |
    And 10 units of menu item using "RECIPE-001" were sold
    When I calculate theoretical consumption
    Then theoretical usage should be:
      | item_id       | theoretical_quantity |
      | ITEM-BEEF-001 | 2.5                  |
      | ITEM-BUN-001  | 10.0                 |
```

---

# Phase 3: Basic Data Synchronization

## Epic 3.1: OData Service Implementation

### Feature: OData Connection Setup
```gherkin
Feature: OData Connection to Restaurant365
  As an integration developer
  I want to connect to R365's OData endpoints
  So that I can retrieve near real-time data

  Background:
    Given R365 OData endpoint is "https://odata.restaurant365.net/api/v2/views"
    And I have valid authentication credentials

  Scenario: Establish OData connection
    Given authentication is configured
    When I initialize the OData service
    Then the service should configure the base URL
    And the service should attach authentication headers
    And the service should set timeout to 30 seconds

  Scenario: Query inventory data via OData
    Given the OData service is initialized
    And location "LOC-001" exists in R365
    When I query inventory for location "LOC-001"
    Then the request should be sent to "/InventoryDetail"
    And the query should include filter "locationId eq 'LOC-001'"
    And the query should select fields: itemId, onHandQuantity, averageCost, parLevel
    And I should receive an array of inventory items

  Scenario: Handle OData query with pagination
    Given the OData service is initialized
    And location "LOC-001" has 500 inventory items
    When I query inventory for location "LOC-001"
    Then the request should include "$top=10000"
    And I should receive all 500 items in one response
    And if more than 10000 items exist, I should handle pagination

  Scenario: Query sales data with date filters
    Given the OData service is initialized
    When I query sales detail for location "LOC-001" from "2024-01-01" to "2024-01-31"
    Then the request should be sent to "/SalesDetail"
    And the filter should include "locationId eq 'LOC-001'"
    And the filter should include "orderDate ge 2024-01-01T00:00:00Z"
    And the filter should include "orderDate le 2024-01-31T23:59:59Z"
    And I should receive sales records within the date range

  Scenario: Handle OData errors
    Given the OData service is initialized
    And the R365 OData endpoint is temporarily unavailable
    When I query inventory for location "LOC-001"
    Then I should receive a connection error
    And the error should be logged with timestamp
    And the error should include request details
    And the system should return error "ODATA_CONNECTION_FAILED"
```

### Feature: Inventory Data Synchronization
```gherkin
Feature: Synchronize Inventory Data from Restaurant365
  As the CostFX system
  I want to synchronize inventory data from R365
  So that I have current inventory information for analysis

  Background:
    Given the OData service is configured
    And the database is ready
    And location "LOC-001" exists in CostFX

  Scenario: Initial inventory sync for new location
    Given location "LOC-001" has no inventory data in CostFX
    And R365 has 50 inventory items for location "LOC-001"
    When I trigger inventory sync for location "LOC-001"
    Then the system should query R365 for all inventory items
    And the system should create 50 new records in the database
    And each record should include:
      | field            | source        |
      | r365_item_id     | R365 itemId   |
      | item_name        | R365 itemName |
      | current_cost     | R365 averageCost |
      | on_hand_quantity | R365 onHandQuantity |
      | par_level        | R365 parLevel |
    And the last_updated timestamp should be set to now
    And the sync should complete within 30 seconds

  Scenario: Incremental inventory sync
    Given location "LOC-001" has existing inventory data
    And the last sync was 1 hour ago
    And 5 items have changed in R365 since last sync
    When I trigger inventory sync for location "LOC-001"
    Then the system should query R365 for all inventory items
    And the system should update 5 existing records
    And the system should not create new records for unchanged items
    And the last_updated timestamp should be updated for changed items only

  Scenario: Handle inventory sync errors
    Given location "LOC-001" exists
    And R365 API returns an error for inventory query
    When I trigger inventory sync for location "LOC-001"
    Then the system should catch the error
    And the system should log the error with context
    And the system should not modify existing inventory data
    And the system should return error "INVENTORY_SYNC_FAILED"
    And the system should schedule a retry in 5 minutes

  Scenario: Sync completion notification
    Given inventory sync is in progress for location "LOC-001"
    When the sync completes successfully
    Then the system should log sync completion
    And the log should include:
      | field              | example              |
      | location_id        | LOC-001              |
      | items_synced       | 50                   |
      | items_created      | 0                    |
      | items_updated      | 5                    |
      | sync_duration_ms   | 2345                 |
      | timestamp          | 2024-01-15T10:30:00Z |
```

### Feature: Sales Data Synchronization
```gherkin
Feature: Synchronize Sales Data from Restaurant365
  As the CostFX system
  I want to synchronize sales transaction data from R365
  So that I can calculate theoretical vs actual usage

  Background:
    Given the OData service is configured
    And location "LOC-001" exists

  Scenario: Sync sales data for date range
    Given today is "2024-01-15"
    And I need sales data for the last 7 days
    When I trigger sales sync for location "LOC-001"
    Then the system should query R365 sales from "2024-01-08" to "2024-01-15"
    And the system should retrieve sales detail records
    And the system should insert new records into the database
    And duplicate records should be ignored based on transaction_id

  Scenario: Daily automated sales sync
    Given today is "2024-01-15"
    And the last sales sync was "2024-01-14"
    When the daily sync job runs at 02:00 AM
    Then the system should sync sales for "2024-01-14"
    And the system should not sync future dates
    And the system should update sync status to "completed"

  Scenario: Handle missing sales data
    Given location "LOC-001" exists
    And R365 has no sales data for "2024-01-15"
    When I trigger sales sync for location "LOC-001"
    Then the system should receive an empty result set
    And the system should not create any records
    And the system should log "No sales data found for date range"
    And the sync status should be "completed_no_data"

  Scenario: Sync sales data with large volume
    Given location "LOC-001" has 5000 transactions for "2024-01-14"
    When I trigger sales sync for location "LOC-001"
    Then the system should retrieve all 5000 transactions
    And the system should insert records in batches of 500
    And the system should commit each batch separately
    And if any batch fails, previous batches should remain committed
    And the system should log progress after each batch
```

---

# Phase 4: Core Analytics - Theoretical vs Actual

## Epic 4.1: Theoretical Usage Calculation

### Feature: Calculate Theoretical Ingredient Consumption
```gherkin
Feature: Calculate Theoretical Ingredient Consumption from Sales
  As a restaurant analyst
  I want to calculate how much of each ingredient should have been used
  So that I can compare against actual inventory movements

  Background:
    Given location "LOC-001" exists
    And recipes are synced from R365
    And sales data is available

  Scenario: Calculate theoretical usage for single menu item
    Given menu item "Classic Burger" uses recipe "RECIPE-001"
    And recipe "RECIPE-001" requires:
      | item_id       | quantity_required | unit |
      | ITEM-BEEF-001 | 0.25              | lb   |
      | ITEM-BUN-001  | 1.00              | each |
      | ITEM-CHEESE   | 0.10              | lb   |
    And 10 "Classic Burger" items were sold on "2024-01-15"
    When I calculate theoretical consumption for "2024-01-15"
    Then the theoretical usage should be:
      | item_id       | theoretical_quantity | unit |
      | ITEM-BEEF-001 | 2.50                 | lb   |
      | ITEM-BUN-001  | 10.00                | each |
      | ITEM-CHEESE   | 1.00                 | lb   |

  Scenario: Calculate theoretical usage for multiple menu items
    Given the following sales occurred on "2024-01-15":
      | menu_item       | recipe_id  | quantity_sold |
      | Classic Burger  | RECIPE-001 | 10            |
      | Chicken Sandwich| RECIPE-002 | 8             |
      | Garden Salad    | RECIPE-003 | 5             |
    And recipe "RECIPE-002" requires 0.33 lb of ITEM-CHICKEN-001
    And recipe "RECIPE-003" requires 0.25 lb of ITEM-LETTUCE
    When I calculate theoretical consumption for all items on "2024-01-15"
    Then the aggregated theoretical usage should include:
      | item_id          | theoretical_quantity |
      | ITEM-BEEF-001    | 2.50                 |
      | ITEM-CHICKEN-001 | 2.64                 |
      | ITEM-LETTUCE     | 1.25                 |

  Scenario: Handle recipe with no sales
    Given recipe "RECIPE-004" exists for "Premium Steak"
    And no "Premium Steak" items were sold on "2024-01-15"
    When I calculate theoretical consumption for "2024-01-15"
    Then recipe "RECIPE-004" ingredients should not appear in results
    And theoretical usage should be 0 for all ingredients in RECIPE-004

  Scenario: Calculate theoretical usage for date range
    Given sales data exists from "2024-01-01" to "2024-01-31"
    When I calculate theoretical consumption from "2024-01-15" to "2024-01-20"
    Then the system should aggregate sales across all 6 days
    And theoretical usage should sum quantities for each ingredient
    And the result should include date range in metadata
```

### Feature: Retrieve Actual Inventory Movements
```gherkin
Feature: Retrieve Actual Inventory Movements from R365
  As a restaurant analyst
  I want to retrieve actual inventory movements
  So that I can compare against theoretical usage

  Background:
    Given location "LOC-001" exists
    And inventory data is synced

  Scenario: Query actual inventory usage for date range
    Given I have beginning inventory counts for "2024-01-15"
    And I have ending inventory counts for "2024-01-15"
    And I have purchase receipts for "2024-01-15"
    When I calculate actual usage for "2024-01-15"
    Then actual usage should equal:
      """
      Beginning Inventory + Purchases - Ending Inventory = Actual Usage
      """
    And the calculation should be performed for each item_id
    And negative usage values should be flagged as anomalies

  Scenario: Retrieve inventory transactions from R365
    Given the date range is "2024-01-15" to "2024-01-15"
    When I query R365 for inventory transactions
    Then the system should retrieve:
      | transaction_type | description                |
      | RECEIPT          | Items received from vendor |
      | SALE             | Items depleted by POS      |
      | ADJUSTMENT       | Manual count adjustments   |
      | TRANSFER         | Items moved to other loc   |
      | WASTE            | Items marked as waste      |
    And transactions should be ordered by timestamp
    And each transaction should include item_id and quantity

  Scenario: Calculate net inventory movement
    Given the following transactions for ITEM-BEEF-001 on "2024-01-15":
      | type       | quantity | direction |
      | RECEIPT    | 50.0     | positive  |
      | SALE       | 45.0     | negative  |
      | WASTE      | 2.0      | negative  |
      | ADJUSTMENT | -1.0     | negative  |
    When I calculate net inventory movement
    Then the net movement should be 2.0 lb
    And the calculation should be: 50.0 - 45.0 - 2.0 - 1.0 = 2.0
    And actual usage should be 48.0 lb (45.0 + 2.0 + 1.0)
```

### Feature: Variance Calculation and Reporting
```gherkin
Feature: Calculate and Report Inventory Variance
  As a restaurant manager
  I want to see the difference between theoretical and actual usage
  So that I can identify waste, theft, or portioning issues

  Background:
    Given location "LOC-001" exists
    And theoretical usage has been calculated
    And actual usage has been calculated

  Scenario: Calculate variance for single item
    Given item "ITEM-BEEF-001" has:
      | metric            | value |
      | theoretical_usage | 45.0  |
      | actual_usage      | 48.5  |
      | unit_cost         | 4.50  |
    When I calculate variance
    Then the variance should be:
      | metric             | value  | calculation          |
      | variance_quantity  | 3.5    | 48.5 - 45.0          |
      | variance_percentage| 7.78%  | (3.5 / 45.0) * 100   |
      | variance_cost      | $15.75 | 3.5 * 4.50           |
      | variance_type      | over   | actual > theoretical |

  Scenario: Calculate variance for all items in date range
    Given the date range is "2024-01-15" to "2024-01-15"
    And multiple items have theoretical and actual usage
    When I generate variance report
    Then the report should include all items with usage
    And each item should show:
      | field               | type    |
      | item_id             | string  |
      | item_name           | string  |
      | theoretical_usage   | decimal |
      | actual_usage        | decimal |
      | variance_quantity   | decimal |
      | variance_percentage | decimal |
      | variance_cost       | decimal |
      | unit_cost           | decimal |
    And items should be sorted by variance_cost DESC
    And the report should include total variance cost

  Scenario: Identify high-variance items
    Given variance has been calculated for all items
    When I filter for items with variance > 10%
    Then I should receive only items exceeding the threshold
    And the results should be sorted by variance_percentage DESC
    And each result should include variance_type ("over" or "under")

  Scenario: Generate variance summary
    Given variance has been calculated for location "LOC-001"
    And the date range is "2024-01-15" to "2024-01-15"
    When I generate variance summary
    Then the summary should include:
      | metric                    | type    |
      | total_variance_cost       | decimal |
      | total_theoretical_cost    | decimal |
      | variance_percentage       | decimal |
      | items_over_usage          | integer |
      | items_under_usage         | integer |
      | high_variance_items_count | integer |
    And high_variance_items should be items with variance > 10%
```

---

# Phase 5: Seasonal Pricing & Cost Optimization

## Epic 5.1: Historical Price Analysis

### Feature: Store Historical Purchase Prices
```gherkin
Feature: Store Historical Purchase Prices
  As the CostFX system
  I want to store historical purchase prices for all items
  So that I can analyze seasonal pricing trends

  Background:
    Given the database includes "r365_purchase_details" table
    And purchase data is being synced from R365

  Scenario: Store purchase order details
    Given a purchase order was received in R365
    When I sync purchase order "PO-2024-001" with details:
      | field             | value              |
      | po_id             | PO-2024-001        |
      | item_id           | ITEM-BEEF-001      |
      | location_id       | LOC-001            |
      | vendor_name       | Sysco              |
      | order_date        | 2024-01-10         |
      | received_date     | 2024-01-12         |
      | quantity_ordered  | 50.0               |
      | quantity_received | 50.0               |
      | unit_cost         | 4.50               |
      | extended_cost     | 225.00             |
    Then a new record should be created in "r365_purchase_details"
    And the record should be associated with item "ITEM-BEEF-001"
    And the record should be associated with location "LOC-001"
    And the unit_cost should be stored as 4.50

  Scenario: Track price changes over time
    Given item "ITEM-BEEF-001" has historical purchases:
      | received_date | unit_cost |
      | 2023-06-15    | 4.25      |
      | 2023-09-20    | 4.60      |
      | 2023-12-10    | 4.85      |
      | 2024-01-12    | 4.50      |
    When I query price history for "ITEM-BEEF-001"
    Then I should receive all 4 purchase records
    And the records should be ordered by received_date ASC
    And I should be able to calculate average price per quarter

  Scenario: Associate multiple items in single purchase order
    Given purchase order "PO-2024-002" contains 10 different items
    When I sync the purchase order
    Then 10 records should be created in "r365_purchase_details"
    And all records should reference po_id "PO-2024-002"
    And each record should have a unique item_id
```

### Feature: Seasonal Price Trend Analysis
```gherkin
Feature: Analyze Seasonal Pricing Trends
  As a restaurant manager
  I want to analyze historical pricing trends by season
  So that I can predict future costs and optimize purchasing timing

  Background:
    Given location "LOC-001" exists
    And 2 years of purchase history exists for item "ITEM-TOMATO"

  Scenario: Calculate monthly average prices
    Given item "ITEM-TOMATO" has purchase data from 2022-01 to 2024-01
    When I calculate monthly average prices
    Then the system should group purchases by year and month
    And for each month, calculate:
      | metric              | calculation                      |
      | average_unit_cost   | SUM(unit_cost) / COUNT(*)        |
      | min_unit_cost       | MIN(unit_cost)                   |
      | max_unit_cost       | MAX(unit_cost)                   |
      | total_quantity      | SUM(quantity_received)           |
      | price_volatility    | STDDEV(unit_cost)                |
    And results should be ordered by year-month ASC

  Scenario: Identify seasonal patterns
    Given monthly averages have been calculated for "ITEM-TOMATO"
    And the following pattern exists:
      | month | avg_cost | season |
      | Jan   | 3.50     | Winter |
      | Feb   | 3.40     | Winter |
      | Mar   | 3.20     | Spring |
      | Apr   | 2.80     | Spring |
      | May   | 2.50     | Spring |
      | Jun   | 2.40     | Summer |
      | Jul   | 2.30     | Summer |
      | Aug   | 2.50     | Summer |
      | Sep   | 2.90     | Fall   |
      | Oct   | 3.10     | Fall   |
      | Nov   | 3.30     | Winter |
      | Dec   | 3.45     | Winter |
    When I analyze seasonal patterns
    Then the system should identify:
      | metric          | value  |
      | lowest_season   | Summer |
      | highest_season  | Winter |
      | peak_month      | Jan    |
      | lowest_month    | Jul    |
      | seasonal_range  | 1.20   |
    And the system should calculate percent difference between seasons

  Scenario: Generate price predictions
    Given historical data exists for "ITEM-TOMATO"
    And current date is "2024-01-15"
    When I request price predictions for next 6 months
    Then the system should predict prices for:
      | month | predicted_price | confidence_interval |
      | Feb   | 3.42            | 3.30 - 3.55         |
      | Mar   | 3.18            | 3.05 - 3.32         |
      | Apr   | 2.78            | 2.65 - 2.92         |
      | May   | 2.48            | 2.35 - 2.62         |
      | Jun   | 2.38            | 2.25 - 2.52         |
      | Jul   | 2.28            | 2.15 - 2.42         |
    And predictions should be based on 2-year historical average
    And confidence intervals should be ±5% by default

  Scenario: Identify cost-saving opportunities
    Given price predictions exist for "ITEM-TOMATO"
    And current price is $3.50
    When I analyze cost-saving opportunities
    Then the system should recommend:
      """
      Best purchasing window: June-August
      Potential savings: 32% ($1.20/unit)
      Recommendation: Consider bulk purchasing in July for 23% savings
      """
    And recommendations should include:
      | field                | value     |
      | optimal_month        | July      |
      | predicted_price      | 2.28      |
      | current_price        | 3.50      |
      | savings_per_unit     | 1.22      |
      | savings_percentage   | 34.9%     |
```

### Feature: Multi-Item Cost Optimization
```gherkin
Feature: Optimize Purchasing Across Multiple Items
  As a purchasing manager
  I want to see cost optimization recommendations for all items
  So that I can plan bulk purchases during optimal pricing periods

  Background:
    Given location "LOC-001" exists
    And seasonal analysis is complete for all items

  Scenario: Generate purchasing calendar
    Given the current date is "2024-01-15"
    And seasonal pricing data exists for 50 inventory items
    When I generate an optimal purchasing calendar for the next 12 months
    Then the calendar should show for each month:
      | field                     | type  |
      | month                     | date  |
      | items_to_buy              | array |
      | total_potential_savings   | decimal |
      | total_projected_spend     | decimal |
    And items should be grouped by optimal purchasing month
    And savings should be calculated against current prices

  Scenario: Prioritize high-impact opportunities
    Given cost optimization analysis is complete
    When I request top 10 cost-saving opportunities
    Then results should be sorted by:
      1. Absolute dollar savings potential
      2. Usage volume
      3. Storage feasibility
    And each opportunity should include:
      | field                    | example              |
      | item_name                | Tomatoes             |
      | current_price            | 3.50                 |
      | optimal_price            | 2.28                 |
      | savings_per_unit         | 1.22                 |
      | monthly_usage            | 200 units            |
      | total_monthly_savings    | 244.00               |
      | optimal_purchase_month   | July                 |
      | shelf_life_feasibility   | requires_freezing    |

  Scenario: Compare vendor pricing trends
    Given item "ITEM-BEEF-001" is purchased from multiple vendors
    And vendor "Sysco" historical average is $4.50
    And vendor "US Foods" historical average is $4.35
    And vendor "Performance Food" historical average is $4.60
    When I analyze vendor pricing
    Then the system should rank vendors by:
      | metric              | sysco | us_foods | performance |
      | average_price       | 4.50  | 4.35     | 4.60        |
      | price_stability     | high  | medium   | low         |
      | rank                | 2     | 1        | 3           |
    And the system should recommend "US Foods" as preferred vendor
```

---

# Phase 6: Waste Reduction & Expiration Management

## Epic 6.1: Ingredient Expiration Tracking

### Feature: Track Item Expiration Dates
```gherkin
Feature: Track Ingredient Expiration Dates
  As a kitchen manager
  I want to track when ingredients will expire
  So that I can use them before they spoil

  Background:
    Given location "LOC-001" exists
    And inventory items have shelf_life_days configured

  Scenario: Calculate expiration date from receipt
    Given item "ITEM-MILK" has shelf_life_days = 7
    And the item was received on "2024-01-15"
    When I calculate the expiration date
    Then the expiration date should be "2024-01-22"
    And the calculation should be: received_date + shelf_life_days

  Scenario: Track multiple lots with different expiration dates
    Given item "ITEM-CHICKEN" was received:
      | lot_id | received_date | shelf_life_days | quantity |
      | LOT-A  | 2024-01-10    | 3               | 20.0     |
      | LOT-B  | 2024-01-12    | 3               | 15.0     |
      | LOT-C  | 2024-01-14    | 3               | 10.0     |
    When I query expiring items for "2024-01-15"
    Then the system should show:
      | lot_id | expiration_date | days_until_expiration | quantity |
      | LOT-A  | 2024-01-13      | -2 (expired)          | 20.0     |
      | LOT-B  | 2024-01-15      | 0                     | 15.0     |
      | LOT-C  | 2024-01-17      | 2                     | 10.0     |
    And LOT-A should be flagged as "expired"
    And LOT-B should be flagged as "expires_today"

  Scenario: Generate expiration alerts
    Given today is "2024-01-15"
    And I want alerts for items expiring within 3 days
    When I generate expiration alerts for location "LOC-001"
    Then I should receive alerts for items expiring between:
      | start_date | end_date   |
      | 2024-01-15 | 2024-01-18 |
    And each alert should include:
      | field                  | type    |
      | item_id                | string  |
      | item_name              | string  |
      | quantity_on_hand       | decimal |
      | days_until_expiration  | integer |
      | expiration_date        | date    |
      | urgency                | enum    |
      | potential_waste_cost   | decimal |
    And urgency should be "critical" if days_until_expiration <= 1

  Scenario: Prioritize expiring items by cost impact
    Given multiple items are expiring soon
    When I generate the expiration alert report
    Then items should be sorted by potential_waste_cost DESC
    And potential_waste_cost should equal quantity_on_hand * current_cost
    And the report should show total potential waste cost
```

### Feature: Recipe Suggestions for Expiring Ingredients
```gherkin
Feature: Suggest Recipes Using Expiring Ingredients
  As a chef
  I want recipe suggestions for ingredients that are expiring soon
  So that I can use them instead of wasting them

  Background:
    Given location "LOC-001" exists
    And recipes are synced from R365
    And expiration alerts exist

  Scenario: Find recipes using specific expiring ingredient
    Given item "ITEM-CHICKEN" is expiring in 1 day
    And the following recipes use "ITEM-CHICKEN":
      | recipe_id  | recipe_name        | chicken_quantity | prep_time | popularity |
      | REC-001    | Chicken Stir Fry   | 0.25 lb          | 20 min    | high       |
      | REC-002    | Chicken Soup       | 0.33 lb          | 45 min    | medium     |
      | REC-003    | Grilled Chicken    | 0.50 lb          | 15 min    | high       |
      | REC-004    | Chicken Curry      | 0.40 lb          | 35 min    | low        |
    When I request recipe suggestions for expiring "ITEM-CHICKEN"
    Then I should receive recipes sorted by:
      1. Quantity used (to maximize usage)
      2. Popularity (to ensure sales)
      3. Prep time (faster is better)
    And the top suggestion should be "Grilled Chicken"
    And each suggestion should show how much ingredient it will use

  Scenario: Find recipes using multiple expiring ingredients
    Given the following items are expiring:
      | item_id       | item_name  | quantity | days_until_expiration |
      | ITEM-CHICKEN  | Chicken    | 10.0 lb  | 1                     |
      | ITEM-PEPPER   | Bell Pepper| 5.0 lb   | 2                     |
      | ITEM-ONION    | Onion      | 3.0 lb   | 1                     |
    When I request recipes using any combination of these items
    Then I should receive recipes ranked by:
      | criteria                      | weight |
      | number_of_expiring_ingredients| 40%    |
      | total_quantity_used           | 30%    |
      | recipe_popularity             | 20%    |
      | prep_time_efficiency          | 10%    |
    And "Chicken Stir Fry" should rank highly if it uses chicken, pepper, and onion

  Scenario: Calculate waste reduction potential
    Given item "ITEM-CHICKEN" has:
      | field                | value |
      | quantity_on_hand     | 10.0  |
      | days_until_expiration| 1     |
      | current_cost         | 4.50  |
    And recipe "Grilled Chicken" uses 0.50 lb per serving
    And the recipe has 85% historical sell-through rate
    When I calculate waste reduction potential
    Then the recommendation should show:
      | field                      | value  |
      | recipe_name                | Grilled Chicken |
      | max_servings_possible      | 20     |
      | expected_servings_sold     | 17     |
      | chicken_to_be_used         | 8.5 lb |
      | chicken_waste_prevented    | 8.5 lb |
      | cost_waste_prevented       | $38.25 |
      | remaining_at_risk          | 1.5 lb |
```

### Feature: Full Ingredient Utilization Analysis
```gherkin
Feature: Analyze Full Ingredient Utilization
  As a sustainability manager
  I want to see how well we're using all parts of ingredients
  So that I can reduce waste and improve profitability

  Background:
    Given location "LOC-001" exists
    And recipe data is available

  Scenario: Identify underutilized ingredient components
    Given item "ITEM-WHOLE-CHICKEN" can be broken down into:
      | component      | typical_yield | used_in_recipes |
      | breast_meat    | 35%           | yes             |
      | thigh_meat     | 25%           | yes             |
      | wing_meat      | 15%           | no              |
      | bones          | 20%           | no              |
      | organs         | 5%            | no              |
    And the restaurant only uses breast and thigh meat
    When I analyze ingredient utilization
    Then the system should report:
      | component      | utilized | waste_percentage |
      | breast_meat    | yes      | 0%               |
      | thigh_meat     | yes      | 0%               |
      | wing_meat      | no       | 15%              |
      | bones          | no       | 20%              |
      | organs         | no       | 5%               |
    And total utilization should be 60%
    And waste opportunity should be 40%

  Scenario: Suggest recipes for unused components
    Given "wing_meat" from "ITEM-WHOLE-CHICKEN" is not utilized
    And 15% of the ingredient cost is wasted
    When I request utilization improvement suggestions
    Then the system should recommend:
      """
      Add recipes using chicken wings:
      - Buffalo Wings (uses 100% of wing meat)
      - Wing Appetizer Platter
      
      Potential waste reduction: 15%
      Potential cost savings: $X.XX per chicken
      """
    And each suggestion should include:
      | field                | type    |
      | component_name       | string  |
      | current_utilization  | decimal |
      | suggested_recipes    | array   |
      | waste_reduction      | decimal |
      | cost_savings         | decimal |

  Scenario: Track utilization improvements over time
    Given ingredient utilization was analyzed on "2024-01-01"
    And utilization was 60% for "ITEM-WHOLE-CHICKEN"
    And new recipes using wings were added
    When I analyze utilization on "2024-02-01"
    Then the system should show:
      | metric                 | january | february | change  |
      | utilization_percentage | 60%     | 75%      | +15%    |
      | waste_percentage       | 40%     | 25%      | -15%    |
      | monthly_waste_cost     | $500    | $312     | -$188   |
    And the improvement should be attributed to new wing recipes
```

---

# Phase 7: Labor Planning & Prep Time Analysis

## Epic 7.1: Recipe Prep Time Tracking

### Feature: Track Recipe Preparation Time
```gherkin
Feature: Track Recipe Preparation Time
  As a kitchen manager
  I want to track how long each recipe takes to prepare
  So that I can plan labor requirements accurately

  Background:
    Given recipes are synced from R365
    And recipes include prep_time_minutes

  Scenario: Store prep time for recipes
    Given recipe "Classic Burger" exists
    When I update the recipe with prep_time_minutes = 15
    Then the prep time should be stored as 15 minutes
    And the prep time should be associated with the recipe

  Scenario: Calculate total prep time for multiple servings
    Given recipe "Chicken Soup" has:
      | field              | value |
      | prep_time_minutes  | 45    |
      | portions_yield     | 8     |
    And I need to prepare 32 servings
    When I calculate total prep time
    Then batches_needed should be 4 (32 / 8)
    And total_prep_time should be 180 minutes (45 * 4)
    And prep_time_per_serving should be 5.625 minutes (180 / 32)

  Scenario: Account for parallel preparation
    Given multiple recipes are being prepared simultaneously
    And recipe "Item A" takes 30 minutes
    And recipe "Item B" takes 45 minutes
    And both can be prepared in parallel
    When I calculate kitchen labor time
    Then the actual time should be 45 minutes (max of the two)
    And not 75 minutes (sum of the two)

  Scenario: Calculate prep time by skill level
    Given recipe "Advanced Dish" has base prep_time = 60 minutes
    And prep time varies by skill level:
      | skill_level | time_multiplier |
      | novice      | 1.5x            |
      | intermediate| 1.0x            |
      | expert      | 0.75x           |
    When a novice prepares the recipe
    Then prep_time should be 90 minutes (60 * 1.5)
    When an expert prepares the recipe
    Then prep_time should be 45 minutes (60 * 0.75)
```

### Feature: Forecast Labor Requirements
```gherkin
Feature: Forecast Labor Requirements Based on Menu Sales
  As a restaurant manager
  I want to forecast labor needs based on expected sales
  So that I can schedule the right number of prep cooks

  Background:
    Given location "LOC-001" exists
    And sales forecasts are available
    And recipe prep times are configured

  Scenario: Calculate labor requirements for single day
    Given the forecast for "2024-01-20" is:
      | menu_item       | recipe_id | projected_quantity | prep_time_per_batch | batch_yield |
      | Classic Burger  | REC-001   | 50                 | 15 min              | 1           |
      | Chicken Soup    | REC-002   | 32                 | 45 min              | 8           |
      | Garden Salad    | REC-003   | 20                 | 10 min              | 1           |
    When I calculate labor requirements for "2024-01-20"
    Then the total prep time should be:
      | recipe      | calculation          | time    |
      | REC-001     | 50 * 15 min          | 750 min |
      | REC-002     | (32/8) * 45 min      | 180 min |
      | REC-003     | 20 * 10 min          | 200 min |
      | TOTAL       |                      | 1130 min|
    And total prep hours should be 18.83 hours (1130 / 60)

  Scenario: Convert prep hours to labor schedule
    Given total prep hours needed is 18.83 hours
    And average prep cook shift is 8 hours
    And prep efficiency factor is 85% (0.85)
    When I calculate staffing needs
    Then adjusted hours needed should be 22.15 hours (18.83 / 0.85)
    And prep cooks needed should be 3 (ceil(22.15 / 8))
    And the system should recommend:
      """
      Schedule 3 prep cooks for 8-hour shifts
      Total scheduled hours: 24 hours
      Buffer time: 1.85 hours
      """

  Scenario: Calculate labor cost
    Given prep hours needed is 18.83 hours
    And average prep cook hourly rate is $18.00
    When I calculate labor cost
    Then total labor cost should be $339.00 (18.83 * 18.00)
    And labor cost per menu item can be calculated
    And the system should show labor cost as % of food cost

  Scenario: Optimize prep schedule across week
    Given sales forecasts exist for Monday through Sunday
    And Monday requires 20 prep hours
    And Tuesday requires 15 prep hours
    And Sunday requires 35 prep hours
    When I optimize the weekly prep schedule
    Then the system should suggest:
      - Pre-prep shelf-stable items on Monday for Tuesday
      - Increase staffing on Sunday (high volume day)
      - Batch prepare items with longer shelf life
    And recommendations should minimize total labor hours
    And recommendations should respect food safety guidelines
```

### Feature: Pre-Production Schedule Optimization
```gherkin
Feature: Optimize Pre-Production Schedule
  As a kitchen manager
  I want an optimized schedule for pre-production tasks
  So that everything is ready when needed without waste

  Background:
    Given location "LOC-001" exists
    And upcoming orders/catering events are known
    And recipe prep times and shelf lives are configured

  Scenario: Generate prep schedule for catering order
    Given a catering order for "2024-01-25 at 18:00" includes:
      | menu_item      | quantity | prep_time | shelf_life_hours |
      | Chicken Skewers| 100      | 60 min    | 24               |
      | Greek Salad    | 50       | 30 min    | 4                |
      | Tzatziki Sauce | 1 batch  | 15 min    | 48               |
    When I generate the prep schedule
    Then the schedule should show:
      | item           | prep_start_time    | reason                      |
      | Tzatziki Sauce | 2024-01-24 12:00   | 48hr shelf life, can prep early|
      | Chicken Skewers| 2024-01-25 11:00   | 24hr shelf life, 5hr before event|
      | Greek Salad    | 2024-01-25 14:00   | 4hr shelf life, must be fresh|
    And items should be ordered by latest safe start time
    And the schedule should account for concurrent prep capacity

  Scenario: Handle conflicting prep requirements
    Given multiple orders exist for the same day
    And total prep time exceeds available labor hours
    When I generate the prep schedule
    Then the system should identify conflicts
    And the system should recommend:
      - Which items can be prepped earlier
      - Which items require additional staff
      - Which items can be outsourced/purchased pre-made
    And the system should prioritize by:
      1. Order deadline/commitment
      2. Food safety requirements
      3. Profitability

  Scenario: Track prep completion status
    Given a prep schedule exists for "2024-01-25"
    And schedule includes 10 prep tasks
    When prep cooks mark tasks complete
    Then the system should track:
      | task_id | status      | completion_time | assigned_to |
      | TASK-01 | completed   | 10:45          | Cook A      |
      | TASK-02 | in_progress | -              | Cook B      |
      | TASK-03 | not_started | -              | -           |
    And the system should show overall completion: 1/10 (10%)
    And the system should alert if tasks are behind schedule
```

---

# Phase 8: Demand Forecasting & Order Optimization

## Epic 8.1: Sales Forecasting

### Feature: Historical Sales Pattern Analysis
```gherkin
Feature: Analyze Historical Sales Patterns
  As a restaurant analyst
  I want to analyze historical sales patterns
  So that I can predict future demand accurately

  Background:
    Given location "LOC-001" exists
    And 2 years of sales history is available

  Scenario: Calculate average daily sales by day of week
    Given sales data exists for the past 12 months
    When I analyze sales by day of week
    Then the system should calculate average sales for:
      | day_of_week | avg_transactions | avg_revenue | trend    |
      | Monday      | 85               | $1,250      | stable   |
      | Tuesday     | 92               | $1,380      | growing  |
      | Wednesday   | 88               | $1,300      | stable   |
      | Thursday    | 105              | $1,575      | growing  |
      | Friday      | 145              | $2,180      | stable   |
      | Saturday    | 165              | $2,475      | growing  |
      | Sunday      | 120              | $1,800      | declining|

  Scenario: Identify seasonal trends
    Given monthly sales data for past 2 years
    When I analyze seasonal patterns
    Then the system should identify:
      | season | avg_monthly_revenue | vs_annual_avg | pattern        |
      | Winter | $35,000             | -12%          | low_season     |
      | Spring | $42,000             | +5%           | growth_season  |
      | Summer | $38,000             | -5%           | moderate       |
      | Fall   | $45,000             | +12%          | peak_season    |

  Scenario: Detect holiday/event impact
    Given sales data includes holidays
    And location is near a stadium
    When I analyze event impact on sales
    Then the system should identify uplift for:
      | event_type        | avg_uplift | example_date  |
      | Game Day          | +85%       | Every Saturday|
      | Valentine's Day   | +45%       | Feb 14        |
      | Mother's Day      | +120%      | 2nd Sun in May|
      | New Year's Eve    | +200%      | Dec 31        |
    And the system should flag these dates in forecasts

  Scenario: Calculate menu item popularity trends
    Given sales data for all menu items
    When I analyze item-level trends for past 90 days
    Then for each item, calculate:
      | metric                | description                        |
      | total_quantity_sold   | Sum of units sold                  |
      | avg_daily_sales       | Total / days in period             |
      | trend_direction       | increasing/stable/decreasing       |
      | popularity_rank       | Rank by quantity sold              |
      | revenue_contribution  | % of total revenue                 |
    And identify items with declining popularity for menu engineering
```

### Feature: Generate Demand Forecasts
```gherkin
Feature: Generate Demand Forecasts
  As a purchasing manager
  I want accurate demand forecasts for menu items
  So that I can order the right quantities

  Background:
    Given historical sales data is analyzed
    And forecasting models are configured

  Scenario: Generate 7-day forecast for single menu item
    Given today is "2024-01-15" (Monday)
    And historical data shows "Classic Burger" averages:
      | day_of_week | avg_sales |
      | Monday      | 45        |
      | Tuesday     | 52        |
      | Wednesday   | 48        |
      | Thursday    | 60        |
      | Friday      | 95        |
      | Saturday    | 110       |
      | Sunday      | 75        |
    When I generate a 7-day forecast
    Then the forecast should be:
      | date       | day      | forecasted_quantity | confidence |
      | 2024-01-15 | Monday   | 45                  | high       |
      | 2024-01-16 | Tuesday  | 52                  | high       |
      | 2024-01-17 | Wednesday| 48                  | high       |
      | 2024-01-18 | Thursday | 60                  | high       |
      | 2024-01-19 | Friday   | 95                  | high       |
      | 2024-01-20 | Saturday | 110                 | high       |
      | 2024-01-21 | Sunday   | 75                  | high       |

  Scenario: Adjust forecast for known events
    Given base forecast exists for "2024-01-20" (Saturday)
    And base forecast is 110 burgers
    And there is a stadium game on "2024-01-20"
    And game days show +85% uplift
    When I adjust the forecast for the event
    Then adjusted_forecast should be 204 burgers (110 * 1.85)
    And the system should note: "Adjusted for Stadium Game Day"
    And confidence should remain "high"

  Scenario: Incorporate weather data
    Given base forecast exists for upcoming week
    And weather forecast shows:
      | date       | condition    | temp_f | impact_factor |
      | 2024-01-16 | Rainy        | 45     | -15%          |
      | 2024-01-17 | Snow         | 28     | -30%          |
      | 2024-01-18 | Sunny        | 55     | +5%           |
    When I incorporate weather adjustments
    Then forecasts should be adjusted accordingly
    And confidence should be marked "medium" for severe weather days

  Scenario: Generate ingredient-level forecast
    Given menu item forecasts exist for next 7 days
    And recipe data maps menu items to ingredients
    When I generate ingredient demand forecast
    Then for each ingredient, calculate:
      | metric                    | example                           |
      | total_forecasted_usage    | 45 lbs (sum across all recipes)   |
      | daily_breakdown           | [5, 7, 6, 8, 12, 14, 10]          |
      | safety_stock_recommended  | 10 lbs (20% buffer)               |
    And the forecast should account for all menu items using that ingredient
```

### Feature: Calculate Optimal Order Quantities
```gherkin
Feature: Calculate Optimal Order Quantities
  As a purchasing manager
  I want the system to calculate optimal order quantities
  So that I minimize waste while avoiding stockouts

  Background:
    Given demand forecasts exist
    And current inventory levels are known
    And supplier lead times are configured

  Scenario: Calculate basic order quantity
    Given item "ITEM-BEEF-001" has:
      | field                    | value  |
      | current_inventory        | 15 lbs |
      | forecasted_usage_7_days  | 45 lbs |
      | safety_stock_level       | 10 lbs |
      | supplier_lead_time_days  | 2      |
    When I calculate optimal order quantity
    Then the calculation should be:
      """
      Order Quantity = Forecasted Usage + Safety Stock - Current Inventory
      Order Quantity = 45 + 10 - 15 = 40 lbs
      """
    And the order should be placed by day 0 (today)
    And the order will arrive by day 2
    And stock will last until day 7

  Scenario: Account for items in transit
    Given item "ITEM-CHICKEN" has:
      | field                   | value  |
      | current_inventory       | 20 lbs |
      | items_in_transit        | 30 lbs |
      | forecasted_usage_7_days | 60 lbs |
      | safety_stock_level      | 10 lbs |
    When I calculate optimal order quantity
    Then the calculation should be:
      """
      Available = Current + In Transit = 20 + 30 = 50 lbs
      Order Quantity = (60 + 10) - 50 = 20 lbs
      """
    And the system should note existing PO in transit

  Scenario: Handle minimum order quantities
    Given item "ITEM-SPECIALTY" has:
      | field                   | value  |
      | calculated_need         | 5 lbs  |
      | supplier_minimum_order  | 10 lbs |
    When I calculate optimal order quantity
    Then order_quantity should be 10 lbs (supplier minimum)
    And the system should flag: "Ordering minimum quantity, 5 lbs excess"
    And excess should be tracked as "overstocked"

  Scenario: Optimize order timing for multiple items from same vendor
    Given vendor "Sysco" supplies 20 different items
    And 15 items need reordering in the next 3 days
    And 5 items need reordering in 5-7 days
    And minimum order for free delivery is $500
    When I optimize multi-item order
    Then the system should recommend:
      """
      Consolidate all 20 items into single order
      Current total: $450
      Recommendation: Add 5-7 day items early to reach $500 minimum
      Benefit: Free delivery ($50 savings)
      Trade-off: 2-4 days extra inventory holding cost
      Net savings: $35
      """

  Scenario: Generate complete purchase order recommendation
    Given optimal quantities are calculated for all items
    And items are grouped by vendor
    When I generate purchase recommendations
    Then for each vendor, provide:
      | field                    | type    |
      | vendor_name              | string  |
      | order_priority           | enum    |
      | recommended_order_date   | date    |
      | total_order_value        | decimal |
      | items                    | array   |
    And each item should include:
      | field                | type    |
      | item_name            | string  |
      | recommended_quantity | decimal |
      | unit_of_measure      | string  |
      | estimated_cost       | decimal |
      | urgency              | enum    |
      | reason               | string  |
```

### Feature: Low Stock Alerts and Reorder Points
```gherkin
Feature: Generate Low Stock Alerts
  As a kitchen manager
  I want automatic alerts when items reach reorder points
  So that I never run out of critical ingredients

  Background:
    Given location "LOC-001" exists
    And inventory levels are monitored

  Scenario: Detect item below reorder point
    Given item "ITEM-FLOUR" has:
      | field              | value  |
      | current_quantity   | 15 lbs |
      | reorder_point      | 20 lbs |
      | par_level          | 50 lbs |
    When the system checks inventory levels
    Then an alert should be generated:
      | field          | value                                |
      | alert_type     | low_stock                            |
      | severity       | warning                              |
      | item_id        | ITEM-FLOUR                           |
      | current_qty    | 15 lbs                               |
      | reorder_point  | 20 lbs                               |
      | message        | "Flour is below reorder point"       |
      | action         | "Order 35 lbs to reach par level"   |

  Scenario: Critical stock alert
    Given item "ITEM-SALT" has:
      | field              | value  |
      | current_quantity   | 0.5 lb |
      | reorder_point      | 5 lbs  |
      | daily_usage        | 2 lbs  |
      | lead_time_days     | 2      |
    When the system checks inventory levels
    Then an alert should be generated:
      | field          | value                                        |
      | alert_type     | critical_stock                               |
      | severity       | critical                                     |
      | stockout_risk  | "Will run out in 0.25 days (6 hours)"        |
      | action         | "URGENT: Order immediately"                  |
    And the alert should be sent to manager immediately
    And the alert should suggest expedited delivery

  Scenario: Planned menu alert
    Given a special menu is planned for "2024-01-30"
    And the menu requires 50 lbs of "ITEM-LOBSTER"
    And current inventory is 5 lbs
    And lead time is 3 days
    And today is "2024-01-25"
    When the system checks against planned menus
    Then an alert should be generated:
      | field              | value                                    |
      | alert_type         | planned_menu_shortage                    |
      | event_date         | 2024-01-30                               |
      | days_until_event   | 5                                        |
      | required_quantity  | 50 lbs                                   |
      | current_quantity   | 5 lbs                                    |
      | shortage           | 45 lbs                                   |
      | latest_order_date  | 2024-01-27 (3 days before event)         |
      | urgency            | "Order within 2 days"                    |

  Scenario: Consolidated daily alert report
    Given multiple items need reordering
    And it's 8:00 AM on a business day
    When the system generates the daily alert report
    Then the report should group alerts by:
      | group      | items                                    |
      | Critical   | Items at 0 or stockout risk within 24h   |
      | Urgent     | Items below reorder point                |
      | Upcoming   | Items that will need reordering in 3 days|
    And each group should be sorted by:
      1. Stockout risk (days until zero)
      2. Item importance (A/B/C classification)
      3. Order value
    And the report should include action buttons to:
      - Generate purchase orders
      - Adjust forecasts
      - Mark as acknowledged
```

---

# Phase 9: Real-time Dashboard & Alerting

## Epic 9.1: WebSocket Real-time Updates

### Feature: WebSocket Connection Management
```gherkin
Feature: WebSocket Connection for Real-time Updates
  As a restaurant manager
  I want real-time updates on my dashboard
  So that I always have current information

  Background:
    Given the WebSocket server is running on /ws/dashboard
    And authentication is required for connections

  Scenario: Establish WebSocket connection
    Given I am an authenticated user
    And I have a valid JWT token
    When I connect to wss://api.costfx.com/ws/dashboard?token=[JWT]&locationId=LOC-001
    Then the connection should be established
    And the server should send initial dashboard data
    And the connection should be added to location "LOC-001" subscriber list

  Scenario: Receive initial dashboard data
    Given I have established a WebSocket connection for location "LOC-001"
    When the connection is established
    Then I should receive a message with type "initial_data"
    And the message should include:
      | field              | type   |
      | current_inventory  | object |
      | active_alerts      | array  |
      | today_sales        | object |
      | variance_summary   | object |
      | expiring_items     | array  |
    And the timestamp should be current

  Scenario: Receive live inventory updates
    Given I am connected via WebSocket for location "LOC-001"
    And inventory data is synced every 5 minutes
    When new inventory data is available
    Then I should receive a message with type "live_update"
    And the message should include:
      | field              | example                |
      | timestamp          | 2024-01-15T10:35:00Z   |
      | update_type        | inventory              |
      | changed_items      | [array of changes]     |
    And I should not receive full inventory data if nothing changed

  Scenario: Receive critical alerts immediately
    Given I am connected via WebSocket
    And I am subscribed to "critical_alert" events
    When item "ITEM-CHICKEN" drops below critical level
    Then I should receive alert within 5 seconds
    And the alert should have type "critical_alert"
    And the alert should include:
      | field       | value                          |
      | severity    | critical                       |
      | item_name   | Chicken Breast                 |
      | current_qty | 2.5 lbs                        |
      | action      | Order immediately              |
    And a notification sound should play in the browser

  Scenario: Handle connection loss and reconnection
    Given I am connected via WebSocket
    And the connection is lost
    When the client detects disconnection
    Then the client should attempt to reconnect
    And reconnection attempts should use exponential backoff:
      | attempt | delay    |
      | 1       | 1 second |
      | 2       | 2 seconds|
      | 3       | 4 seconds|
      | 4       | 8 seconds|
      | 5+      | 30 seconds|
    And after reconnection, the client should request missed updates
    And the server should send updates that occurred during disconnection

  Scenario: Subscribe to specific alert types
    Given I am connected via WebSocket
    When I send a message:
      ```json
      {
        "type": "subscribe_alerts",
        "alertTypes": ["expiration", "low_stock", "variance"]
      }
      ```
    Then my subscription preferences should be stored
    And I should only receive alerts matching my subscriptions
    And I should not receive "price_change" alerts (not subscribed)
```

### Feature: Real-time Dashboard Metrics
```gherkin
Feature: Display Real-time Dashboard Metrics
  As a restaurant manager
  I want to see key metrics updated in real-time
  So that I can make informed decisions quickly

  Background:
    Given I am viewing the CostFX dashboard
    And location "LOC-001" is selected

  Scenario: Display current inventory value
    Given inventory data is current
    When I view the dashboard
    Then I should see "Current Inventory Value" widget
    And it should display:
      | metric              | format    | example    |
      | total_value         | currency  | $12,450.00 |
      | items_count         | number    | 127        |
      | low_stock_items     | number    | 8          |
      | last_updated        | timestamp | 2 min ago  |
    And the widget should update every 5 minutes via WebSocket

  Scenario: Display today's variance
    Given theoretical vs actual analysis has run
    When I view the variance summary widget
    Then I should see:
      | metric                | format      | example   |
      | total_variance_cost   | currency    | -$145.50  |
      | variance_percentage   | percentage  | -3.2%     |
      | trend                 | icon        | ↑ improving|
      | top_problem_item      | text        | Beef       |
    And negative values should be styled red
    And positive trends should be styled green

  Scenario: Display expiring items countdown
    Given items are expiring soon
    When I view the expiring items widget
    Then I should see a list of items:
      | item_name     | expires_in | quantity | value    | urgency   |
      | Chicken       | 6 hours    | 10 lbs   | $45.00   | critical  |
      | Lettuce       | 1 day      | 5 lbs    | $7.50    | warning   |
      | Tomatoes      | 2 days     | 8 lbs    | $12.00   | info      |
    And critical items should blink or pulse
    And I should be able to click for recipe suggestions

  Scenario: Display cost-saving opportunities
    Given seasonal pricing analysis is complete
    When I view the opportunities widget
    Then I should see top 3 cost-saving opportunities:
      | item      | current_price | optimal_price | savings | action           |
      | Tomatoes  | $3.50/lb      | $2.28/lb      | $1.22   | Buy in July      |
      | Lettuce   | $2.80/lb      | $2.10/lb      | $0.70   | Switch vendor    |
      | Chicken   | $4.50/lb      | $4.20/lb      | $0.30   | Negotiate price  |
    And each opportunity should show potential monthly savings
    And I should be able to drill down for details
```

### Feature: Interactive Alert Management
```gherkin
Feature: Manage Alerts from Dashboard
  As a restaurant manager
  I want to manage alerts from the dashboard
  So that I can take action and track resolution

  Background:
    Given I am on the CostFX dashboard
    And alerts are being generated

  Scenario: View all active alerts
    Given multiple alerts exist
    When I click the "Alerts" tab
    Then I should see alerts grouped by severity:
      | severity | count | color  |
      | critical | 3     | red    |
      | warning  | 7     | yellow |
      | info     | 12    | blue   |
    And each alert should display:
      | field       | example                        |
      | title       | "Chicken below critical level" |
      | description | "Current: 2.5 lbs, Need: 10 lbs"|
      | timestamp   | "5 minutes ago"                |
      | actions     | [View, Acknowledge, Create PO] |

  Scenario: Acknowledge an alert
    Given a critical alert exists for "ITEM-CHICKEN"
    When I click "Acknowledge" on the alert
    Then I should see a confirmation dialog:
      """
      Acknowledge this alert?
      This will move it to the acknowledged list but will not resolve the underlying issue.
      """
    And when I confirm
    Then the alert should be marked as acknowledged
    And the alert should move to "Acknowledged" section
    And the alert should remain visible for audit trail
    And the acknowledgment should be logged with my user_id and timestamp

  Scenario: Create purchase order from alert
    Given a low stock alert exists for "ITEM-FLOUR"
    And the alert recommends ordering 35 lbs
    When I click "Create PO" on the alert
    Then I should see a pre-filled purchase order form:
      | field         | value                  |
      | vendor        | [preferred vendor]     |
      | item          | ITEM-FLOUR             |
      | quantity      | 35 lbs                 |
      | unit_cost     | $0.45/lb (last price)  |
      | total_cost    | $15.75                 |
    And I can edit the form before submitting
    When I submit the PO
    Then the PO should be sent to R365
    And the alert should be marked as "Action Taken"
    And the alert should reference the PO number

  Scenario: Filter and search alerts
    Given 50 alerts exist
    When I use the filter controls
    Then I should be able to filter by:
      | filter_type | options                                |
      | severity    | critical, warning, info                |
      | category    | low_stock, expiration, variance, cost  |
      | status      | active, acknowledged, resolved         |
      | date_range  | today, this_week, this_month           |
    And I should be able to search by item name
    And filters should be combinable
    And filter state should persist across page reloads
```

---

# Phase 10: Production Deployment & Monitoring

## Epic 10.1: Deployment Pipeline

### Feature: Automated Deployment Process
```gherkin
Feature: Deploy CostFX to Production
  As a DevOps engineer
  I want an automated deployment pipeline
  So that releases are consistent and reliable

  Background:
    Given the CostFX application is developed
    And AWS infrastructure is provisioned

  Scenario: Run pre-deployment checks
    Given a new release is ready
    When the deployment process starts
    Then the system should verify:
      | check                        | status |
      | All tests passing            | ✓      |
      | Database migrations ready    | ✓      |
      | Environment variables set    | ✓      |
      | R365 credentials valid       | ✓      |
      | AWS resources healthy        | ✓      |
      | Backup completed             | ✓      |
    And if any check fails, deployment should abort
    And the team should be notified of the failure

  Scenario: Deploy database migrations
    Given database schema changes exist
    When deployment executes migration step
    Then migrations should run in transaction
    And migration order should be:
      1. Create new tables/columns
      2. Migrate data
      3. Drop old tables/columns (if safe)
    And if migration fails, it should rollback
    And database state should remain consistent

  Scenario: Deploy application with zero downtime
    Given the new version is ready
    When deployment executes
    Then the deployment should:
      1. Deploy new version to standby instances
      2. Run health checks on new instances
      3. If healthy, switch traffic to new instances
      4. Monitor for errors for 5 minutes
      5. If stable, terminate old instances
      6. If errors, rollback to old instances
    And users should experience no downtime
    And the deployment should complete in < 15 minutes

  Scenario: Rollback deployment
    Given a deployment has completed
    And critical errors are detected
    When rollback is triggered
    Then the system should:
      1. Switch traffic back to previous version
      2. Verify previous version is healthy
      3. Alert the team
      4. Create incident report
    And rollback should complete in < 5 minutes
    And user impact should be minimized
```

### Feature: Production Monitoring
```gherkin
Feature: Monitor Production System Health
  As an operations engineer
  I want comprehensive monitoring of the production system
  So that I can detect and resolve issues quickly

  Background:
    Given CostFX is deployed to production
    And CloudWatch monitoring is configured

  Scenario: Monitor R365 API health
    Given the R365 health check runs every 5 minutes
    When the health check executes
    Then it should test:
      | check                     | threshold      |
      | Authentication success    | 100%           |
      | API response time         | < 2000ms       |
      | API availability          | > 99.5%        |
      | Token refresh success     | 100%           |
    And metrics should be sent to CloudWatch
    And if any threshold is breached, an alarm should trigger

  Scenario: Monitor database performance
    Given database monitoring is active
    When the system runs queries
    Then CloudWatch should track:
      | metric                    | alert_threshold |
      | Query response time       | > 1000ms        |
      | Connection pool usage     | > 80%           |
      | Deadlock count            | > 0             |
      | Failed transactions       | > 1%            |
      | Database CPU              | > 80%           |
      | Storage remaining         | < 20%           |
    And slow queries should be logged
    And the team should be alerted if thresholds breach

  Scenario: Monitor data synchronization lag
    Given inventory sync should occur every 5 minutes
    When monitoring checks sync status
    Then it should verify:
      | check                        | expected        |
      | Last sync timestamp          | < 10 minutes ago|
      | Sync success rate            | > 99%           |
      | Records synced per batch     | > 0             |
      | Sync duration                | < 30 seconds    |
    And if sync lag exceeds 30 minutes
    Then a critical alert should be sent
    And automatic retry should be attempted

  Scenario: Track user activity metrics
    Given users are accessing the dashboard
    When analytics tracking is enabled
    Then the system should track:
      | metric                    | aggregation    |
      | Active users              | real-time      |
      | Page load time            | p95, p99       |
      | API endpoint latency      | average, max   |
      | Error rate                | percentage     |
      | Feature usage             | count          |
    And metrics should be visualized in CloudWatch dashboards
    And performance trends should be analyzed weekly
```

### Feature: Error Handling and Logging
```gherkin
Feature: Handle Errors and Log Events
  As a system administrator
  I want comprehensive error handling and logging
  So that I can troubleshoot issues effectively

  Background:
    Given the application is running
    And logging is configured

  Scenario: Log R365 API errors
    Given an R365 API request fails
    When the error occurs
    Then the system should log:
      | field               | example                      |
      | timestamp           | 2024-01-15T10:30:45.123Z     |
      | log_level           | ERROR                        |
      | error_type          | R365_API_ERROR               |
      | endpoint            | /api/v2/views/InventoryDetail|
      | http_status         | 500                          |
      | error_message       | Internal Server Error        |
      | request_id          | req-12345                    |
      | location_id         | LOC-001                      |
      | user_id             | user-789                     |
      | stack_trace         | [full stack trace]           |
    And the log should be sent to CloudWatch Logs
    And if error rate exceeds threshold, alert should trigger

  Scenario: Handle authentication failures gracefully
    Given R365 authentication fails
    When the system attempts to make an API request
    Then the system should:
      1. Log the authentication failure
      2. Attempt to re-authenticate up to 3 times
      3. If all attempts fail, return error to user
      4. Display user-friendly error message
      5. Alert system administrators
    And users should not see sensitive error details
    And the system should continue functioning for cached data

  Scenario: Log successful operations
    Given inventory sync completes successfully
    When the sync finishes
    Then the system should log:
      | field                 | example              |
      | timestamp             | 2024-01-15T10:30:00Z |
      | log_level             | INFO                 |
      | operation             | inventory_sync       |
      | location_id           | LOC-001              |
      | items_synced          | 127                  |
      | duration_ms           | 2340                 |
      | status                | success              |
    And performance metrics should be extracted from logs
    And logs should be retained for 90 days

  Scenario: Aggregate and analyze error patterns
    Given errors are being logged
    When error analysis runs daily
    Then the system should identify:
      | pattern                  | action                        |
      | Repeated errors          | Create incident               |
      | Error rate spike         | Alert immediately             |
      | New error types          | Notify development team       |
      | Timeout patterns         | Investigate performance       |
    And a daily error report should be generated
    And trends should be visualized in dashboard
```

### Feature: Backup and Disaster Recovery
```gherkin
Feature: Backup and Disaster Recovery
  As a system administrator
  I want automated backups and recovery procedures
  So that data is never lost

  Background:
    Given CostFX is running in production
    And AWS RDS automatic backups are enabled

  Scenario: Automated daily backups
    Given it is 2:00 AM UTC
    When the automated backup job runs
    Then the system should:
      1. Create RDS automated snapshot
      2. Export critical tables to S3
      3. Verify backup integrity
      4. Retain backups for 30 days
      5. Log backup completion
    And if backup fails, retry once
    And if retry fails, alert administrators immediately

  Scenario: Restore from backup
    Given a backup exists from "2024-01-14"
    And data corruption is detected on "2024-01-15"
    When restore procedure is initiated
    Then the system should:
      1. Stop write operations
      2. Create snapshot of current state
      3. Restore database from backup
      4. Verify data integrity
      5. Resume operations
    And downtime should be < 30 minutes
    And users should be notified of maintenance
    And all steps should be documented in incident report

  Scenario: Test disaster recovery procedure
    Given it is the quarterly DR test date
    When DR test is executed
    Then the team should:
      1. Simulate production failure
      2. Execute recovery procedure
      3. Verify all systems operational
      4. Measure recovery time
      5. Document lessons learned
    And recovery should complete within RTO of 4 hours
    And RPO should be < 1 hour of data loss
    And test results should be recorded for compliance
```

---

## Implementation Priority Summary

### Sprint 1 (Weeks 1-2): Foundation
- Authentication and credentials management
- Basic database models
- Initial R365 connectivity

### Sprint 2 (Weeks 3-4): Data Synchronization
- OData service implementation
- Inventory sync
- Sales data sync
- Recipe sync

### Sprint 3 (Weeks 5-6): Core Analytics
- Theoretical vs actual calculation
- Variance reporting
- Basic reporting API

### Sprint 4 (Weeks 7-8): Cost Optimization
- Historical price tracking
- Seasonal analysis
- Cost-saving recommendations

### Sprint 5 (Weeks 9-10): Waste Reduction
- Expiration tracking
- Recipe suggestions
- Utilization analysis

### Sprint 6 (Weeks 11-12): Labor Planning
- Prep time tracking
- Labor forecasting
- Schedule optimization

### Sprint 7 (Weeks 13-14): Forecasting
- Demand forecasting
- Order optimization
- Low stock alerts

### Sprint 8 (Weeks 15-16): Real-time Features
- WebSocket implementation
- Live dashboard
- Alert management

### Sprint 9 (Weeks 17-18): Production Polish
- Performance optimization
- Error handling enhancement
- Documentation completion

### Sprint 10 (Weeks 19-20): Deployment
- Production deployment
- Monitoring setup
- User training

---

## Definition of Done

For each feature to be considered complete:

1. ✅ All scenarios pass automated tests
2. ✅ Code reviewed and approved
3. ✅ Documentation updated
4. ✅ Performance benchmarks met
5. ✅ Security review completed
6. ✅ Deployed to staging environment
7. ✅ User acceptance testing passed
8. ✅ Monitoring and alerts configured
9. ✅ Rollback procedure tested
10. ✅ Production deployment completed