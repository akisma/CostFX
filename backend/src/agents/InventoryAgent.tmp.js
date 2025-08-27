import BaseAgent from './BaseAgent.js';
import { calculateReorderPoint, calculateEconomicOrderQuantity } from '../utils/helpers.js';
import { Op } from 'sequelize';

/**
 * InventoryAgent - Specialized agent for restaurant inventory management
 * 
 * Capabilities:
 * - Real-time inventory tracking and monitoring
 * - Automated reorder predictions and alerts
 * - Expiration date monitoring and waste prevention
 * - Waste reduction algorithms and optimization
 * - Inventory cost analysis and reporting
 */
class InventoryAgent extends BaseAgent {
  constructor() {
    super('InventoryAgent', [
      'track_inventory_levels',
      'predict_reorder_needs', 
      'monitor_expiration_dates',
      'analyze_waste_patterns',
      'optimize_stock_levels'
    ]);
    
    // Inventory management configuration
    this.config = {
      defaultSafetyStockDays: 3, // 3 days of safety stock
      expirationWarningDays: 5, // Warn 5 days before expiration
      highWasteThreshold: 0.15, // 15% waste is considered high
      lowStockMultiplier: 1.2, // Reorder when stock is 20% above minimum
      overstockMultiplier: 0.9 // Flag overstock when 90% of max stock
    };
  }

  /**
   * Process different types of inventory-related requests
   */
  async process(request) {
    const startTime = Date.now();
    this.metrics.requests++;

    try {
      let result;
      
      switch (request.type) {
        case 'track_levels':
          result = await this.trackInventoryLevels(request.data);
          break;
        case 'predict_reorder':
          result = await this.predictReorderNeeds(request.data);
          break;
        case 'monitor_expiration':
          result = await this.monitorExpirationDates(request.data);
          break;
        case 'analyze_waste':
          result = await this.analyzeWastePatterns(request.data);
          break;
        case 'optimize_stock':
          result = await this.optimizeStockLevels(request.data);
          break;
        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }

      this.updateMetrics(startTime, true);
      return result;
    } catch (error) {
      this.updateMetrics(startTime, false);
      throw error;
    }
  }

  /**
   * Track current inventory levels and identify stock issues
   */
  async trackInventoryLevels(data) {
    const { restaurantId } = data;
    // TODO: Use includeInactive parameter when implementing full filtering
    
    // Get current inventory from database models
    const inventoryItems = await this.getCurrentInventory(restaurantId);

    const analysis = inventoryItems.map(item => {
      let status = 'healthy';
      const alerts = [];

      // Check stock levels
      if (item.currentStock <= 0) {
        status = 'out_of_stock';
        alerts.push('Out of stock - immediate reorder required');
      } else if (item.currentStock <= item.minimumStock) {
        status = 'low_stock';
        alerts.push('Low stock - reorder recommended');
      } else if (item.currentStock >= item.maximumStock * this.config.overstockMultiplier) {
        status = 'overstock';
        alerts.push('Overstock detected - review usage patterns');
      }

      // Check expiration
      const daysUntilExpiration = this.getDaysUntilExpiration(item.expirationDate);
      if (daysUntilExpiration !== null && daysUntilExpiration <= this.config.expirationWarningDays) {
        alerts.push(`Expires in ${daysUntilExpiration} days`);
        if (status === 'healthy') status = 'expiring_soon';
      }

      return {
        ...item,
        status,
        alerts,
        daysUntilExpiration,
        stockPercentage: Math.round((item.currentStock / item.maximumStock) * 100),
        totalValue: Number((item.currentStock * item.unitCost).toFixed(2))
      };
    });

    // Calculate summary metrics
    const totalItems = analysis.length;
    const totalValue = analysis.reduce((sum, item) => sum + item.totalValue, 0);
    const statusCounts = analysis.reduce((counts, item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
      return counts;
    }, {});

    return {
      inventoryItems: analysis,
      summary: {
        totalItems,
        totalValue: Number(totalValue.toFixed(2)),
        healthyItems: statusCounts.healthy || 0,
        lowStockItems: statusCounts.low_stock || 0,
        outOfStockItems: statusCounts.out_of_stock || 0,
        overstockItems: statusCounts.overstock || 0,
        expiringItems: statusCounts.expiring_soon || 0,
        averageStockLevel: Math.round(
          analysis.reduce((sum, item) => sum + item.stockPercentage, 0) / totalItems
        )
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Predict reorder needs based on usage patterns and lead times
   */
  async predictReorderNeeds(data) {
    const { restaurantId, forecastDays = 7 } = data;
    
    // Get inventory items with usage data
    const inventoryItems = await this.getInventoryItemsWithUsage(restaurantId);

    const reorderRecommendations = inventoryItems.map(item => {
      // Calculate reorder point using helper function
      const reorderPoint = calculateReorderPoint(
        item.dailyUsage,
        item.leadTimeDays,
        item.dailyUsage * this.config.defaultSafetyStockDays
      );

      // Calculate Economic Order Quantity
      const annualDemand = item.dailyUsage * 365;
      const orderCost = 25; // Estimated order processing cost
      const holdingCostRate = 0.20; // 20% of item value per year
      const holdingCost = item.unitCost * holdingCostRate;
      
      const eoq = calculateEconomicOrderQuantity(annualDemand, orderCost, holdingCost);

      // Determine if reorder is needed
      const needsReorder = item.currentStock <= reorderPoint;
      const daysUntilReorder = needsReorder ? 0 : Math.ceil((item.currentStock - reorderPoint) / item.dailyUsage);
      
      let priority = 'low';
      if (item.currentStock <= item.minimumStock) {
        priority = 'high';
      } else if (item.currentStock <= reorderPoint) {
        priority = 'medium';
      }

      const orderQuantity = Math.max(eoq, reorderPoint - item.currentStock + (item.dailyUsage * forecastDays));

      return {
        inventoryItemId: item.id,
        itemName: item.name,
        currentStock: item.currentStock,
        reorderPoint: Number(reorderPoint.toFixed(2)),
        recommendedOrderQuantity: Number(orderQuantity.toFixed(2)),
        estimatedCost: Number((orderQuantity * item.unitCost).toFixed(2)),
        priority,
        needsReorder,
        daysUntilReorder,
        supplier: {
          id: item.supplierId,
          name: item.supplierName,
          leadTimeDays: item.leadTimeDays
        },
        reasoning: needsReorder 
          ? `Current stock (${item.currentStock}) is below reorder point (${reorderPoint.toFixed(1)})`
          : `Stock adequate for ${daysUntilReorder} more days`
      };
    });

    // Sort by priority and urgency
    const sortedRecommendations = reorderRecommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.daysUntilReorder - b.daysUntilReorder;
    });

    const summary = {
      totalItems: reorderRecommendations.length,
      itemsNeedingReorder: reorderRecommendations.filter(item => item.needsReorder).length,
      highPriorityItems: reorderRecommendations.filter(item => item.priority === 'high').length,
      totalEstimatedCost: Number(
        reorderRecommendations
          .filter(item => item.needsReorder)
          .reduce((sum, item) => sum + item.estimatedCost, 0)
          .toFixed(2)
      )
    };

    return {
      recommendations: sortedRecommendations,
      summary,
      forecastPeriod: `${forecastDays} days`,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Monitor items approaching expiration dates
   */
  async monitorExpirationDates(data) {
    const { restaurantId, warningDays = this.config.expirationWarningDays } = data;
    
    // Get items with expiration dates
    const inventoryItems = await this.getExpiringItems(restaurantId);

    // TODO: Use today variable when implementing date-based filtering
    const expirationAlerts = inventoryItems
      .map(item => {
        const daysUntilExpiration = this.getDaysUntilExpiration(item.expirationDate);
        
        if (daysUntilExpiration === null) return null;

        let severity = 'info';
        let action = 'Monitor usage';
        
        if (daysUntilExpiration <= 0) {
          severity = 'critical';
          action = 'Remove from inventory immediately';
        } else if (daysUntilExpiration <= 1) {
          severity = 'critical';
          action = 'Use today or discard';
        } else if (daysUntilExpiration <= 2) {
          severity = 'warning';
          action = 'Prioritize in menu planning';
        } else if (daysUntilExpiration <= warningDays) {
          severity = 'warning';
          action = 'Plan usage within next few days';
        } else {
          return null; // Not approaching expiration
        }

        const potentialWasteValue = item.currentStock * item.unitCost;

        return {
          inventoryItemId: item.id,
          itemName: item.name,
          category: item.category,
          currentStock: item.currentStock,
          unit: item.unit,
          expirationDate: item.expirationDate,
          daysUntilExpiration,
          severity,
          action,
          batchNumber: item.batchNumber,
          potentialWasteValue: Number(potentialWasteValue.toFixed(2))
        };
      })
      .filter(alert => alert !== null)
      .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);

    const summary = {
      totalAlertsGenerated: expirationAlerts.length,
      criticalItems: expirationAlerts.filter(alert => alert.severity === 'critical').length,
      warningItems: expirationAlerts.filter(alert => alert.severity === 'warning').length,
      totalPotentialWasteValue: Number(
        expirationAlerts.reduce((sum, alert) => sum + alert.potentialWasteValue, 0).toFixed(2)
      )
    };

    return {
      alerts: expirationAlerts,
      summary,
      warningThreshold: `${warningDays} days`,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Analyze waste patterns to identify optimization opportunities
   */
  async analyzeWastePatterns(data) {
    const { restaurantId, timeframeDays = 30 } = data;
    
    // Get waste transaction data
    const wasteTransactions = await this.getWasteData(restaurantId, timeframeDays);

    // Analyze waste by item
    const wasteByItem = wasteTransactions.reduce((acc, transaction) => {
      const key = transaction.itemName;
      if (!acc[key]) {
        acc[key] = {
          itemName: transaction.itemName,
          category: transaction.category,
          totalWaste: 0,
          totalQuantity: 0,
          occurrences: 0,
          reasons: {}
        };
      }
      
      acc[key].totalWaste += transaction.wasteQuantity;
      acc[key].totalQuantity += transaction.totalQuantity;
      acc[key].occurrences += 1;
      
      if (!acc[key].reasons[transaction.reason]) {
        acc[key].reasons[transaction.reason] = 0;
      }
      acc[key].reasons[transaction.reason] += transaction.wasteQuantity;
      
      return acc;
    }, {});

    // Convert to array and calculate waste percentages
    const wasteAnalysis = Object.values(wasteByItem).map(item => {
      const wastePercentage = (item.totalWaste / item.totalQuantity) * 100;
      const primaryReason = Object.entries(item.reasons)
        .sort(([,a], [,b]) => b - a)[0][0];
      
      let severity = 'low';
      if (wastePercentage > this.config.highWasteThreshold * 100) {
        severity = 'high';
      } else if (wastePercentage > (this.config.highWasteThreshold * 100) / 2) {
        severity = 'medium';
      }

      return {
        ...item,
        wastePercentage: Number(wastePercentage.toFixed(1)),
        primaryReason,
        severity
      };
    }).sort((a, b) => b.wastePercentage - a.wastePercentage);

    // Generate recommendations
    const recommendations = this.generateWasteRecommendations(wasteAnalysis);

    const summary = {
      totalTransactions: wasteTransactions.length,
      totalWasteItems: wasteAnalysis.reduce((sum, item) => sum + item.totalWaste, 0),
      averageWastePercentage: Number(
        (wasteAnalysis.reduce((sum, item) => sum + item.wastePercentage, 0) / wasteAnalysis.length).toFixed(1)
      ),
      highWasteItems: wasteAnalysis.filter(item => item.severity === 'high').length
    };

    return {
      wasteAnalysis,
      recommendations,
      summary,
      timeframe: `${timeframeDays} days`,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Optimize stock levels using EOQ and demand forecasting
   */
  async optimizeStockLevels(data) {
    const { restaurantId, optimizationGoal = 'balanced' } = data;
    
    // Get current inventory with usage patterns
    const inventoryItems = await this.getInventoryItemsWithUsage(restaurantId);

    const optimizations = inventoryItems.map(item => {
      // Calculate Economic Order Quantity
      const annualDemand = item.dailyUsage * 365;
      const holdingCost = item.unitCost * item.holdingCostRate;
      const eoq = calculateEconomicOrderQuantity(annualDemand, item.orderCost, holdingCost);

      // Calculate optimal reorder point with seasonal adjustment
      const safetyStock = item.dailyUsage * this.config.defaultSafetyStockDays * (1 + item.seasonalVariation);
      const optimalReorderPoint = calculateReorderPoint(item.dailyUsage, item.leadTimeDays, safetyStock);

      // Determine optimal min/max stock levels based on goal
      let optimalMinStock, optimalMaxStock;
      
      switch (optimizationGoal) {
        case 'cost_reduction':
          optimalMinStock = optimalReorderPoint;
          optimalMaxStock = optimalReorderPoint + (eoq * 0.8);
          break;
        case 'service_level':
          optimalMinStock = optimalReorderPoint * 1.2;
          optimalMaxStock = optimalReorderPoint + (eoq * 1.5);
          break;
        default: // balanced
          optimalMinStock = optimalReorderPoint;
          optimalMaxStock = optimalReorderPoint + eoq;
      }

      // Calculate potential cost savings
      const currentHoldingCost = ((item.minimumStock + item.maximumStock) / 2) * holdingCost;
      const optimizedHoldingCost = ((optimalMinStock + optimalMaxStock) / 2) * holdingCost;
      const annualSavings = (currentHoldingCost - optimizedHoldingCost) * 365;

      const changeType = annualSavings > 0 ? 'reduction' : 'increase';
      const impactDescription = changeType === 'reduction' 
        ? `Reduce holding costs by $${Math.abs(annualSavings).toFixed(0)}/year`
        : `Increase service level (cost increase: $${Math.abs(annualSavings).toFixed(0)}/year)`;

      return {
        inventoryItemId: item.id,
        itemName: item.name,
        current: {
          minStock: item.minimumStock,
          maxStock: item.maximumStock
        },
        optimized: {
          minStock: Number(optimalMinStock.toFixed(1)),
          maxStock: Number(optimalMaxStock.toFixed(1)),
          reorderPoint: Number(optimalReorderPoint.toFixed(1)),
          economicOrderQuantity: Number(eoq.toFixed(1))
        },
        impact: {
          type: changeType,
          annualSavings: Number(annualSavings.toFixed(2)),
          description: impactDescription
        },
        recommendations: this.generateStockRecommendations(item, optimalMinStock, optimalMaxStock, optimalReorderPoint)
      };
    });

    const summary = {
      totalItems: optimizations.length,
      totalAnnualSavings: Number(
        optimizations.reduce((sum, opt) => sum + (opt.impact.annualSavings > 0 ? opt.impact.annualSavings : 0), 0).toFixed(2)
      ),
      itemsWithReductions: optimizations.filter(opt => opt.impact.type === 'reduction').length,
      optimizationGoal
    };

    return {
      optimizations,
      summary,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Helper method to calculate days until expiration
   */
  getDaysUntilExpiration(expirationDate) {
    if (!expirationDate) return null;
    
    const now = new Date();
    const expiration = new Date(expirationDate);
    const diffTime = expiration - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }

  /**
   * Generate specific recommendations for waste reduction
   */
  generateWasteRecommendations(wasteAnalysis) {
    const recommendations = [];
    
    wasteAnalysis.forEach(item => {
      if (item.severity === 'high') {
        if (item.primaryReason === 'spoilage' || item.primaryReason === 'expiration') {
          recommendations.push({
            type: 'inventory-management',
            priority: 'high',
            item: item.itemName,
            suggestion: `Reduce order quantities for ${item.itemName} - ${item.wastePercentage}% waste rate`,
            estimatedSavings: `Reduce waste by 50% could save ~$${(item.totalWaste * 2.5 * 0.5).toFixed(0)}/month`
          });
        }
        
        if (item.category === 'produce') {
          recommendations.push({
            type: 'storage-optimization',
            priority: 'medium',
            item: item.itemName,
            suggestion: `Improve storage conditions for ${item.itemName} to extend shelf life`,
            estimatedSavings: 'Reduce spoilage by 30%'
          });
        }
      }
    });

    return recommendations;
  }

  /**
   * Generate specific recommendations for stock level optimization
   */
  generateStockRecommendations(item, optimalMin, optimalMax) {
    // TODO: Use reorderPoint parameter when implementing advanced reorder logic
    const recommendations = [];
    
    if (optimalMin < item.minimumStock) {
      recommendations.push('Reduce minimum stock level to lower holding costs');
    } else if (optimalMin > item.minimumStock) {
      recommendations.push('Increase minimum stock level to improve service level');
    }
    
    if (Math.abs(optimalMax - item.maximumStock) > item.maximumStock * 0.1) {
      recommendations.push('Adjust maximum stock level based on Economic Order Quantity');
    }
    
    if (item.seasonalVariation > 0.2) {
      recommendations.push('Consider seasonal stock adjustments for this item');
    }
    
    return recommendations;
  }

  // Helper methods for database access

  async getCurrentInventory(restaurantId, itemId = null) {
    // Import models dynamically to avoid circular dependencies
    const { InventoryItem, Supplier } = await import('../models/index.js');
    
    const whereClause = { restaurantId };
    if (itemId) whereClause.id = itemId;
    
    const items = await InventoryItem.findAll({
      where: whereClause,
      include: [{ model: Supplier, as: 'supplier' }],
      order: [['name', 'ASC']]
    });
    
    return items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      minimumStock: item.minimumStock,
      maximumStock: item.maximumStock,
      unit: item.unit,
      unitCost: item.unitCost,
      expirationDate: item.expirationDate,
      supplierId: item.supplierId,
      supplierName: item.supplier?.name || 'Unknown',
      leadTimeDays: item.supplier?.averageLeadTimeDays || 2,
      lastOrderDate: item.lastOrderDate
    }));
  }

  async getInventoryItemsWithUsage(restaurantId) {
    const items = await this.getCurrentInventory(restaurantId);
    
    // For now, simulate usage data - in production, calculate from transactions
    return items.map(item => ({
      ...item,
      dailyUsage: this.estimateDailyUsage(item),
      seasonalVariation: this.estimateSeasonalVariation(item.category),
      holdingCostRate: 0.20, // 20% holding cost rate
      orderCost: 25 // Default order cost
    }));
  }

  async getExpiringItems(restaurantId) {
    const { InventoryItem } = await import('../models/index.js');
    
    const items = await InventoryItem.findAll({
      where: {
        restaurantId,
        expirationDate: {
          [Op.not]: null
        }
      },
      order: [['expirationDate', 'ASC']]
    });
    
    return items.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      unit: item.unit,
      unitCost: item.unitCost,
      expirationDate: item.expirationDate,
      batchNumber: item.batchNumber || `BATCH-${item.id}`
    }));
  }

  async getWasteData(restaurantId, days) {
    const { InventoryTransaction, InventoryItem } = await import('../models/index.js');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const wasteTransactions = await InventoryTransaction.findAll({
      where: {
        restaurantId,
        transactionType: 'waste',
        transactionDate: {
          [Op.gte]: startDate
        }
      },
      include: [{ 
        model: InventoryItem, 
        as: 'inventoryItem',
        attributes: ['name', 'category']
      }],
      order: [['transactionDate', 'DESC']]
    });
    
    return wasteTransactions.map(transaction => ({
      itemName: transaction.inventoryItem.name,
      category: transaction.inventoryItem.category,
      wasteQuantity: Math.abs(transaction.quantity), // Waste is negative, make positive
      totalQuantity: transaction.quantity + 100, // Simulate total quantity
      reason: transaction.notes || 'expired',
      date: transaction.transactionDate
    }));
  }

  estimateDailyUsage(item) {
    // Simulate daily usage based on category and current stock
    const usageRates = {
      produce: 0.15,    // 15% of stock per day
      meat: 0.12,       // 12% of stock per day
      dairy: 0.10,      // 10% of stock per day
      dry_goods: 0.05,  // 5% of stock per day
      beverages: 0.08   // 8% of stock per day
    };
    
    const rate = usageRates[item.category] || 0.10;
    return Math.max(1, Math.round(item.maximumStock * rate));
  }

  estimateSeasonalVariation(category) {
    // Simulate seasonal variation by category
    const variations = {
      produce: 0.25,    // 25% seasonal variation
      meat: 0.15,       // 15% seasonal variation
      dairy: 0.10,      // 10% seasonal variation
      dry_goods: 0.05,  // 5% seasonal variation
      beverages: 0.20   // 20% seasonal variation
    };
    
    return variations[category] || 0.15;
  }
}

export default InventoryAgent;
