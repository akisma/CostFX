/**
 * POSDataTransformer - Provider-Agnostic POS Data Transformation Service
 * 
 * Transforms raw POS data (Tier 1: square_* tables) into unified inventory format
 * (Tier 2: inventory_items). Orchestrates three helper services for intelligent mapping:
 * - CategoryMapper: Fuzzy string matching for categories
 * - UnitInferrer: Pattern matching for measurement units
 * - VarianceCalculator: Multi-factor threshold calculation
 * 
 * Features:
 * - Provider-agnostic design (supports Square, Toast, Clover)
 * - Resilient error handling (5% error threshold)
 * - Comprehensive logging for troubleshooting
 * - POS source tracking for bi-directional sync
 * - Upsert logic (create or update existing items)
 * 
 * @module services/POSDataTransformer
 */

import logger from '../utils/logger.js';
import CategoryMapper from './helpers/CategoryMapper.js';
import UnitInferrer from './helpers/UnitInferrer.js';
import VarianceCalculator from './helpers/VarianceCalculator.js';
import InventoryItem from '../models/InventoryItem.js';
import SquareMenuItem from '../models/SquareMenuItem.js';
import SalesTransaction from '../models/SalesTransaction.js';

/**
 * Error threshold before failing entire transformation
 * Example: 5 errors out of 100 items = 5% acceptable
 */
const ERROR_THRESHOLD_PCT = 5.0;

/**
 * Default parLevel for items without explicit inventory levels
 * Used for variance threshold calculation
 */
const DEFAULT_PAR_LEVEL = 10.0;

/**
 * POSDataTransformer class - Transforms POS data to inventory format
 */
const DEFAULT_CATEGORY_MAPPER_OPTIONS = {
    enableFallback: false
};

class POSDataTransformer {
    constructor(options = {}) {
        const {
            categoryMapper,
            categoryMapperOptions,
            unitInferrer,
            varianceCalculator,
            errorThresholdPct
        } = options;

        const resolvedCategoryMapperOptions = {
            ...DEFAULT_CATEGORY_MAPPER_OPTIONS,
            ...(categoryMapperOptions || {})
        };

        this.categoryMapper = categoryMapper || new CategoryMapper(resolvedCategoryMapperOptions);
        this.unitInferrer = unitInferrer || new UnitInferrer();
        this.varianceCalculator = varianceCalculator || new VarianceCalculator();
        this.errorThreshold = typeof errorThresholdPct === 'number'
            ? errorThresholdPct
            : ERROR_THRESHOLD_PCT;
    }
    
    /**
     * Transform Square menu item to inventory item format
     * @param {Object} squareMenuItem - SquareMenuItem instance or plain object
     * @param {number} restaurantId - Target restaurant ID
     * @param {Object} options - Optional configuration
     * @param {boolean} options.dryRun - If true, return data without saving to DB
     * @param {boolean} options.skipExisting - If true, skip items that already exist
     * @returns {Promise<Object>} Transformation result
     * @returns {Object|null} result.inventoryItem - Created/updated InventoryItem or transformed data
     * @returns {Object} result.metadata - Transformation metadata
     */
    async squareMenuItemToInventoryItem(squareMenuItem, restaurantId, options = {}) {
        const { dryRun = false, skipExisting = false } = options;
        const startTime = Date.now();
        
        try {
            // Extract primary variation data
            const primaryVariation = typeof squareMenuItem.getPrimaryVariation === 'function'
                ? squareMenuItem.getPrimaryVariation()
                : this.extractPrimaryVariation(squareMenuItem);
            
            if (!primaryVariation) {
                // Debug logging to see what data we have
                logger.error('POSDataTransformer: No primary variation found', {
                    squareItemId: squareMenuItem.id,
                    itemName: squareMenuItem.name,
                    hasGetPrimaryVariation: typeof squareMenuItem.getPrimaryVariation === 'function',
                    hasSquareData: !!squareMenuItem.squareData,
                    squareDataKeys: squareMenuItem.squareData ? Object.keys(squareMenuItem.squareData) : [],
                    hasItemData: !!squareMenuItem.squareData?.item_data,
                    itemDataKeys: squareMenuItem.squareData?.item_data ? Object.keys(squareMenuItem.squareData.item_data) : [],
                    hasVariations: !!squareMenuItem.squareData?.item_data?.variations,
                    variationsLength: squareMenuItem.squareData?.item_data?.variations?.length || 0
                });
                throw new Error('No primary variation found for menu item');
            }
            
            // Check if item already exists (POS source tracking)
            if (skipExisting) {
                const existing = await InventoryItem.findOne({
                    where: {
                        restaurantId,
                        sourcePosProvider: 'square',
                        sourcePosItemId: squareMenuItem.id
                    }
                });
                
                if (existing) {
                    logger.debug('POSDataTransformer: Skipping existing item', {
                        squareItemId: squareMenuItem.id,
                        inventoryItemId: existing.id
                    });
                    
                    return {
                        inventoryItem: null,
                        metadata: {
                            skipped: true,
                            reason: 'Item already exists',
                            duration: Date.now() - startTime
                        }
                    };
                }
            }
            
            // Step 1: Map category
            let categoryMapping = this.categoryMapper.mapSquareCategory(
                squareMenuItem.category_name || squareMenuItem.categoryName
            );
            
            if (!categoryMapping) {
                logger.warn('POSDataTransformer: Unmapped category - queuing for confirmation', {
                    squareItemId: squareMenuItem.id,
                    itemName: squareMenuItem.name,
                    categoryName: squareMenuItem.category_name || squareMenuItem.categoryName
                });
                
                // TODO: Queue for user confirmation (Issue #37 - AI-powered mapping)
                // For now, use fallback category
                categoryMapping = {
                    category: 'dry_goods',
                    confidence: 0.3,
                    matchType: 'fallback'
                };
            }
            
            // Step 2: Infer unit
            const unitInference = this.unitInferrer.inferUnit(
                squareMenuItem.name,
                {
                    variationName: primaryVariation.name,
                    category: categoryMapping.category
                }
            );
            
            // Step 2.5: Normalize unit to match InventoryItem validation
            const normalizedUnit = this.normalizeUnit(unitInference.unit);
            
            // Step 3: Extract cost data
            const unitCost = this.extractUnitCost(primaryVariation);
            
            // Step 4: Calculate variance thresholds
            const parLevel = DEFAULT_PAR_LEVEL; // TODO: Get from inventory levels or configuration
            const varianceThresholds = this.varianceCalculator.calculate({
                unitCost,
                unit: normalizedUnit,
                category: categoryMapping.category,
                parLevel
            });
            
            // Step 5: Build inventory item data
            const inventoryItemData = {
                restaurantId,
                supplierId: 1, // TODO: Default supplier, should be configurable
                name: squareMenuItem.name,
                description: squareMenuItem.description || null,
                category: categoryMapping.category,
                unit: normalizedUnit,
                unitCost,
                currentStock: 0, // Will be updated from inventory counts
                minimumStock: parLevel * 0.3, // 30% of par as minimum
                maximumStock: parLevel * 1.5, // 150% of par as maximum
                isActive: true,
                
                // Variance threshold system (from migration 1726790000007)
                categoryId: categoryMapping.categoryId || null,
                varianceThresholdQuantity: varianceThresholds.quantityThreshold || 0,
                varianceThresholdDollar: varianceThresholds.dollarThreshold || 50.00,
                highValueFlag: varianceThresholds.isHighValue || false,
                theoreticalYieldFactor: 1.000, // Default, can be refined later
                costPerUnitVariancePct: 10.00, // Default 10% threshold
                
                // POS source tracking (added in migration 1759800000000)
                sourcePosProvider: 'square',
                sourcePosItemId: squareMenuItem.id.toString(),
                sourcePosData: JSON.stringify({
                    square_id: squareMenuItem.squareItemId || squareMenuItem.id,
                    catalog_object_id: squareMenuItem.squareCatalogObjectId || squareMenuItem.id,
                    variation_id: primaryVariation.id,
                    category_id: squareMenuItem.squareCategoryId,
                    last_synced: new Date().toISOString()
                })
            };
            
            // Dry run: return data without saving
            if (dryRun) {
                logger.info('POSDataTransformer: Dry run - data prepared', {
                    squareItemId: squareMenuItem.id,
                    inventoryItemData: {
                        name: inventoryItemData.name,
                        category: inventoryItemData.category,
                        unit: inventoryItemData.unit,
                        unitCost: inventoryItemData.unitCost
                    },
                    categoryMapping,
                    unitInference,
                    varianceThresholds: {
                        quantity: varianceThresholds.varianceThresholdQuantity,
                        dollar: varianceThresholds.varianceThresholdDollar,
                        highValue: varianceThresholds.highValueFlag
                    }
                });
                
                return {
                    inventoryItem: inventoryItemData,
                    metadata: {
                        dryRun: true,
                        categoryMapping,
                        unitInference,
                        varianceThresholds,
                        duration: Date.now() - startTime
                    }
                };
            }
            
            // Step 6: Upsert to database
            const [inventoryItem, created] = await InventoryItem.upsert(inventoryItemData, {
                fields: Object.keys(inventoryItemData), // Only upsert fields we're actually setting
                conflictFields: ['restaurant_id', 'source_pos_provider', 'source_pos_item_id'],
                returning: true
            });
            
            logger.info('POSDataTransformer: Item transformed successfully', {
                squareItemId: squareMenuItem.id,
                inventoryItemId: inventoryItem.id,
                created,
                categoryMapping: {
                    from: squareMenuItem.category_name || squareMenuItem.categoryName,
                    to: categoryMapping.category,
                    confidence: categoryMapping.confidence
                },
                unitInference: {
                    unit: unitInference.unit,
                    matchType: unitInference.matchType
                },
                varianceThresholds: {
                    quantity: varianceThresholds.varianceThresholdQuantity,
                    dollar: varianceThresholds.varianceThresholdDollar,
                    highValue: varianceThresholds.highValueFlag
                },
                duration: Date.now() - startTime
            });
            
            return {
                inventoryItem,
                metadata: {
                    created,
                    categoryMapping,
                    unitInference,
                    varianceThresholds,
                    duration: Date.now() - startTime
                }
            };
            
        } catch (error) {
            logger.error('POSDataTransformer: Transformation failed', {
                squareItemId: squareMenuItem.id,
                itemName: squareMenuItem.name,
                error: error.message,
                stack: error.stack
            });
            
            throw error;
        }
    }
    
    /**
     * Normalize unit from UnitInferrer to InventoryItem validation schema
     * @param {string} unit - Unit from UnitInferrer (e.g., 'lb', 'ea', 'gal')
     * @returns {string} Normalized unit matching InventoryItem.unit validation
     * @private
     */
    normalizeUnit(unit) {
        const unitMap = {
            // Weight
            'lb': 'lbs',
            'lbs': 'lbs',
            'oz': 'oz',
            'kg': 'kg',
            'g': 'g',
            
            // Volume
            'gal': 'gallons',
            'gallon': 'gallons',
            'gallons': 'gallons',
            'L': 'liters',
            'liter': 'liters',
            'liters': 'liters',
            'cup': 'cups',
            'cups': 'cups',
            
            // Count
            'ea': 'pieces',
            'each': 'pieces',
            'pc': 'pieces',
            'piece': 'pieces',
            'pieces': 'pieces',
            'count': 'pieces',
            
            // Container
            'box': 'boxes',
            'boxes': 'boxes',
            'case': 'cases',
            'cases': 'cases',
            
            // Other units not in InventoryItem validation - default to pieces
            'qt': 'liters',
            'pt': 'liters',
            'fl oz': 'oz',
            'mL': 'liters',
            'ml': 'liters',
            'bag': 'pieces',
            'can': 'pieces',
            'jar': 'pieces',
            'bottle': 'pieces',
            'container': 'pieces',
            'bulk': 'pieces'
        };
        
        return unitMap[unit] || 'pieces'; // Default to pieces if unknown
    }
    
    /**
     * Transform multiple Square menu items in batch
     * @param {Array<Object>} squareMenuItems - Array of SquareMenuItem instances
     * @param {number} restaurantId - Target restaurant ID
     * @param {Object} options - Optional configuration
     * @returns {Promise<Object>} Batch transformation result
     */
    async transformBatch(squareMenuItems, restaurantId, options = {}) {
        const startTime = Date.now();
        const results = {
            success: [],
            errors: [],
            skipped: []
        };
        
        logger.info('POSDataTransformer: Starting batch transformation', {
            restaurantId,
            itemCount: squareMenuItems.length
        });
        
        for (const squareMenuItem of squareMenuItems) {
            try {
                const result = await this.squareMenuItemToInventoryItem(
                    squareMenuItem,
                    restaurantId,
                    options
                );
                
                if (result.metadata.skipped) {
                    results.skipped.push({
                        squareItemId: squareMenuItem.id,
                        reason: result.metadata.reason
                    });
                } else {
                    results.success.push({
                        squareItemId: squareMenuItem.id,
                        inventoryItemId: result.inventoryItem?.id,
                        created: result.metadata.created,
                        duration: result.metadata.duration
                    });
                }
                
            } catch (error) {
                results.errors.push({
                    squareItemId: squareMenuItem.id,
                    itemName: squareMenuItem.name,
                    error: error.message
                });
            }
        }
        
        // Check error threshold
        const errorRate = (results.errors.length / squareMenuItems.length) * 100;
        const totalDuration = Date.now() - startTime;
        
        logger.info('POSDataTransformer: Batch transformation complete', {
            restaurantId,
            totalItems: squareMenuItems.length,
            successCount: results.success.length,
            errorCount: results.errors.length,
            skippedCount: results.skipped.length,
            errorRate: errorRate.toFixed(2) + '%',
            duration: totalDuration
        });
        
        if (errorRate > this.errorThreshold) {
            // Log first few errors for debugging
            logger.error('POSDataTransformer: High error rate detected', {
                restaurantId,
                errorRate: errorRate.toFixed(2) + '%',
                threshold: this.errorThreshold + '%',
                sampleErrors: results.errors.slice(0, 5) // First 5 errors
            });
            
            const error = new Error(
                `Transformation error rate (${errorRate.toFixed(2)}%) exceeds threshold (${this.errorThreshold}%)`
            );
            error.results = results;
            throw error;
        }
        
        return {
            ...results,
            summary: {
                totalItems: squareMenuItems.length,
                successCount: results.success.length,
                errorCount: results.errors.length,
                skippedCount: results.skipped.length,
                errorRate,
                duration: totalDuration
            }
        };
    }
    
    /**
     * Extract primary variation from Square menu item
     * @param {Object} squareMenuItem - Square menu item data
     * @returns {Object|null} Primary variation data
     * @private
     */
    extractPrimaryVariation(squareMenuItem) {
        // Try different paths where variations might be stored
        // Note: _sanitizeBigInt converts snake_case to camelCase
        let variations = squareMenuItem.variations 
            || squareMenuItem.itemVariations
            || squareMenuItem.squareData?.item_data?.variations  // snake_case
            || squareMenuItem.squareData?.itemData?.variations   // camelCase (after sanitization)
            || squareMenuItem.variationIds; // Last resort - just IDs
            
        if (!variations || variations.length === 0) return null;
        
        // Find variation with lowest ordinal (primary)
        const sorted = [...variations].sort((a, b) => 
            (a.ordinal || 0) - (b.ordinal || 0)
        );
        
        return sorted[0];
    }
    
    /**
     * Extract unit cost from variation data
     * @param {Object} variation - Variation data
     * @returns {number} Unit cost in dollars
     * @private
     */
    extractUnitCost(variation) {
        // Square stores prices in cents
        const priceMoney = variation.price_money || variation.priceMoney;
        if (!priceMoney || !priceMoney.amount) return 0.0;
        
        return priceMoney.amount / 100.0;
    }

    /**
     * Transform Square order line items to sales_transactions (Tier 2)
     * 
     * Maps square_order_items → sales_transactions for recipe variance analysis.
     * Skips line items that cannot be mapped to inventory_items (modifiers, ad-hoc items).
     * 
     * @param {Object} order - SquareOrder instance with SquareOrderItems included
     * @param {Object} options - Transform options
     * @param {boolean} options.dryRun - If true, don't save to database (default: false)
     * @returns {Promise<Object>} { created, skipped, errors }
     */
    async squareOrderToSalesTransactions(order, options = {}) {
        const { dryRun = false } = options;
        
        const results = {
            created: 0,
            skipped: 0,
            errors: []
        };

        // Validate order has line items
        if (!order.SquareOrderItems || order.SquareOrderItems.length === 0) {
            logger.debug('POSDataTransformer: Order has no line items', {
                orderId: order.squareOrderId
            });
            return results;
        }

        for (const lineItem of order.SquareOrderItems) {
            try {
                // Skip if no catalog object ID (modifiers, ad-hoc items, custom charges)
                if (!lineItem.squareCatalogObjectId) {
                    results.skipped++;
                    logger.debug('POSDataTransformer: Skipping line item without catalog ID', {
                        orderId: order.squareOrderId,
                        lineItemName: lineItem.name,
                        reason: 'No catalog_object_id (likely modifier or ad-hoc item)'
                    });
                    continue;
                }

                // Map Square catalog ID → inventory_item_id
                const inventoryItem = await InventoryItem.findOne({
                    where: {
                        restaurantId: order.restaurantId,
                        sourcePosProvider: 'square',
                        sourcePosItemId: lineItem.squareCatalogObjectId
                    }
                });

                if (!inventoryItem) {
                    // Cannot map to inventory - skip gracefully
                    results.skipped++;
                    logger.debug('POSDataTransformer: Cannot map line item to inventory', {
                        orderId: order.squareOrderId,
                        catalogObjectId: lineItem.squareCatalogObjectId,
                        lineItemName: lineItem.name,
                        reason: 'No matching inventory_item found (item may need to be synced first)'
                    });
                    continue;
                }

                // Build sales transaction
                const transaction = {
                    restaurantId: order.restaurantId,
                    inventoryItemId: inventoryItem.id,
                    transactionDate: order.closedAt || order.createdAt,
                    quantity: lineItem.quantity.toString(),  // Keep as string for decimal precision
                    unitPrice: lineItem.basePriceMoneyAmount / 100.0,  // Convert cents → dollars
                    totalAmount: lineItem.totalMoneyAmount / 100.0,
                    sourcePosProvider: 'square',
                    sourcePosOrderId: order.squareOrderId,
                    sourcePosLineItemId: `square-${lineItem.squareLineItemUid}`,
                    sourcePosData: {
                        variationId: lineItem.squareVariationId,
                        variationName: lineItem.variationName,
                        tax: lineItem.totalTaxMoneyAmount / 100.0,
                        discount: lineItem.totalDiscountMoneyAmount / 100.0,
                        grossSales: lineItem.grossSalesMoneyAmount / 100.0
                    }
                };

                if (!dryRun) {
                    await SalesTransaction.upsert(transaction, {
                        conflictFields: ['sourcePosProvider', 'sourcePosLineItemId']
                    });
                }

                results.created++;
                
                logger.debug('POSDataTransformer: Created sales transaction', {
                    orderId: order.squareOrderId,
                    lineItemUid: lineItem.squareLineItemUid,
                    inventoryItemId: inventoryItem.id,
                    quantity: transaction.quantity,
                    totalAmount: transaction.totalAmount,
                    dryRun
                });

            } catch (error) {
                results.errors.push({
                    orderId: order.squareOrderId,
                    lineItemId: lineItem.squareLineItemUid,
                    lineItemUid: lineItem.squareLineItemUid,
                    error: error.message
                });

                logger.error('POSDataTransformer: Failed to transform line item', {
                    orderId: order.squareOrderId,
                    lineItemUid: lineItem.squareLineItemUid,
                    error: error.message,
                    stack: error.stack
                });
            }
        }

        logger.info('POSDataTransformer: Order transformation complete', {
            orderId: order.squareOrderId,
            totalLineItems: order.SquareOrderItems.length,
            created: results.created,
            skipped: results.skipped,
            errors: results.errors.length,
            mappingRate: order.SquareOrderItems.length > 0
                ? ((results.created / order.SquareOrderItems.length) * 100).toFixed(1) + '%'
                : '0%'
        });

        return results;
    }
}

export default POSDataTransformer;
