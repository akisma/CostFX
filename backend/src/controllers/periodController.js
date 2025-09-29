import { InventoryPeriod, PeriodInventorySnapshot, InventoryItem } from '../models/index.js';
import { Op } from 'sequelize';
import logger from '../utils/logger.js';
import { body, validationResult } from 'express-validator'; 

/**
 * Period Management Controller
 * 
 * Handles Dave's inventory period lifecycle:
 * - Creating periods with overlap validation
 * - Managing period status transitions (draft → active → closed → locked)
 * - Snapshot creation and management
 * - Audit trails and validation
 */
class PeriodController {
  
  /**
   * Create a new inventory period
   * POST /api/v1/periods
   */
  async createPeriod(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: errors.array()
        });
      }

      const { restaurantId, periodName, periodType, periodStart, periodEnd, description } = req.body;
      
      // Check for overlapping periods
      const overlappingPeriods = await InventoryPeriod.findOverlappingPeriods({
        restaurantId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd)
      });
      
      if (overlappingPeriods.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Period overlaps with existing periods',
          conflicts: overlappingPeriods.map(p => ({
            id: p.id,
            name: p.periodName,
            start: p.periodStart,
            end: p.periodEnd,
            status: p.status
          }))
        });
      }
      
      // Create the period
      const period = await InventoryPeriod.create({
        restaurantId,
        periodName,
        periodType,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        description,
        status: 'draft',
        createdBy: req.user?.id || null
      });
      
      logger.info(`Period created: ${period.periodName} (ID: ${period.id}) for restaurant ${restaurantId}`);
      
      res.status(201).json({
        success: true,
        data: {
          period: await period.toJSON(),
          message: 'Period created successfully in draft status'
        }
      });
      
    } catch (error) {
      logger.error('Error creating period:', error);
      next(error);
    }
  }
  
  /**
   * Get period details with snapshots
   * GET /api/v1/periods/:id
   */
  async getPeriod(req, res, next) {
    try {
      const { id } = req.params;
      
      const period = await InventoryPeriod.findByPk(id, {
        include: [
          {
            model: PeriodInventorySnapshot,
            as: 'snapshots',
            include: [
              {
                model: InventoryItem,
                as: 'inventoryItem',
                attributes: ['id', 'name', 'category', 'unit', 'unitCost']
              }
            ]
          }
        ]
      });
      
      if (!period) {
        return res.status(404).json({
          success: false,
          error: 'Period not found'
        });
      }
      
      // Calculate snapshot completeness
      const snapshotSummary = await period.getSnapshotCompleteness();
      
      res.json({
        success: true,
        data: {
          period: period.toJSON(),
          snapshotSummary,
          canTransition: await period.canTransitionTo('active'),
          availableActions: await this.getAvailableActions(period)
        }
      });
      
    } catch (error) {
      logger.error('Error fetching period:', error);
      next(error);
    }
  }
  
  /**
   * List periods with filtering and pagination
   * GET /api/v1/periods
   */
  async listPeriods(req, res, next) {
    try {
      const { restaurantId, status, periodType, page = 1, limit = 20 } = req.query;
      
      const whereClause = {};
      if (restaurantId) whereClause.restaurantId = restaurantId;
      if (status) whereClause.status = status;
      if (periodType) whereClause.periodType = periodType;
      
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      const { rows: periods, count: total } = await InventoryPeriod.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset,
        order: [['periodStart', 'DESC']],
        include: [
          {
            model: PeriodInventorySnapshot,
            as: 'snapshots',
            attributes: ['id', 'snapshotType'],
            required: false
          }
        ]
      });
      
      // Add snapshot completeness for each period
      const periodsWithSummary = await Promise.all(
        periods.map(async (period) => {
          const snapshotSummary = await period.getSnapshotCompleteness();
          return {
            ...period.toJSON(),
            snapshotSummary
          };
        })
      );
      
      res.json({
        success: true,
        data: {
          periods: periodsWithSummary,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });
      
    } catch (error) {
      logger.error('Error listing periods:', error);
      next(error);
    }
  }
  
  /**
   * Activate a period (draft → active)
   * PUT /api/v1/periods/:id/activate
   */
  async activatePeriod(req, res, next) {
    try {
      const { id } = req.params;
      
      const period = await InventoryPeriod.findByPk(id);
      if (!period) {
        return res.status(404).json({
          success: false,
          error: 'Period not found'
        });
      }
      
      // Validate transition
      if (!await period.canTransitionTo('active')) {
        return res.status(400).json({
          success: false,
          error: 'Period cannot be activated',
          reason: period.status === 'active' ? 'Period is already active' :
                 period.status === 'closed' ? 'Period is already closed' :
                 period.status === 'locked' ? 'Period is locked' :
                 'Invalid status for activation'
        });
      }
      
      // Check for overlapping active periods
      const overlappingActive = await InventoryPeriod.findOne({
        where: {
          restaurantId: period.restaurantId,
          status: 'active',
          id: { [Op.ne]: period.id },
          [Op.or]: [
            {
              periodStart: {
                [Op.between]: [period.periodStart, period.periodEnd]
              }
            },
            {
              periodEnd: {
                [Op.between]: [period.periodStart, period.periodEnd]
              }
            },
            {
              [Op.and]: [
                { periodStart: { [Op.lte]: period.periodStart } },
                { periodEnd: { [Op.gte]: period.periodEnd } }
              ]
            }
          ]
        }
      });
      
      if (overlappingActive) {
        return res.status(409).json({
          success: false,
          error: 'Cannot activate period - overlaps with active period',
          conflict: {
            id: overlappingActive.id,
            name: overlappingActive.periodName,
            start: overlappingActive.periodStart,
            end: overlappingActive.periodEnd
          }
        });
      }
      
      // Activate the period
      await period.update({
        status: 'active',
        activatedAt: new Date(),
        activatedBy: req.user?.id || null
      });
      
      logger.info(`Period activated: ${period.periodName} (ID: ${period.id})`);
      
      res.json({
        success: true,
        data: {
          period: period.toJSON(),
          message: 'Period activated successfully'
        }
      });
      
    } catch (error) {
      logger.error('Error activating period:', error);
      next(error);
    }
  }
  
  /**
   * Close a period (active → closed)
   * PUT /api/v1/periods/:id/close
   */
  async closePeriod(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      
      const period = await InventoryPeriod.findByPk(id);
      if (!period) {
        return res.status(404).json({
          success: false,
          error: 'Period not found'
        });
      }
      
      // Validate transition
      if (!await period.canTransitionTo('closed')) {
        return res.status(400).json({
          success: false,
          error: 'Period cannot be closed',
          reason: period.status === 'draft' ? 'Period must be activated first' :
                 period.status === 'closed' ? 'Period is already closed' :
                 period.status === 'locked' ? 'Period is locked' :
                 'Invalid status for closing'
        });
      }
      
      // Check snapshot completeness
      const completeness = await period.getSnapshotCompleteness();
      if (!completeness.hasBeginningSnapshot || !completeness.hasEndingSnapshot) {
        return res.status(400).json({
          success: false,
          error: 'Cannot close period - missing required snapshots',
          missing: {
            beginning: !completeness.hasBeginningSnapshot,
            ending: !completeness.hasEndingSnapshot
          }
        });
      }
      
      // Close the period
      await period.update({
        status: 'closed',
        closedAt: new Date(),
        closedBy: req.user?.id || null,
        closingNotes: notes
      });
      
      logger.info(`Period closed: ${period.periodName} (ID: ${period.id})`);
      
      res.json({
        success: true,
        data: {
          period: period.toJSON(),
          message: 'Period closed successfully'
        }
      });
      
    } catch (error) {
      logger.error('Error closing period:', error);
      next(error);
    }
  }
  
  /**
   * Create snapshots for a period
   * POST /api/v1/periods/:id/snapshots
   */
  async createSnapshots(req, res, next) {
    try {
      const { id } = req.params;
      const { snapshotType, items } = req.body;
      
      // Validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: errors.array()
        });
      }
      
      const period = await InventoryPeriod.findByPk(id);
      if (!period) {
        return res.status(404).json({
          success: false,
          error: 'Period not found'
        });
      }
      
      // Check if period allows snapshots
      if (period.status === 'locked') {
        return res.status(400).json({
          success: false,
          error: 'Cannot create snapshots - period is locked'
        });
      }
      
      // Check for existing snapshots of this type
      const existingSnapshots = await PeriodInventorySnapshot.findAll({
        where: {
          periodId: id,
          snapshotType
        }
      });
      
      if (existingSnapshots.length > 0) {
        return res.status(409).json({
          success: false,
          error: `${snapshotType} snapshots already exist for this period`,
          existingCount: existingSnapshots.length
        });
      }
      
      // Create snapshots
      const createdSnapshots = [];
      for (const item of items) {
        const snapshot = await PeriodInventorySnapshot.create({
          periodId: id,
          inventoryItemId: item.inventoryItemId,
          snapshotType,
          quantity: item.quantity,
          unitCost: item.unitCost,
          notes: item.notes,
          createdBy: req.user?.id || null
        });
        createdSnapshots.push(snapshot);
      }
      
      // Update period snapshot completion status
      const completeness = await period.getSnapshotCompleteness();
      await period.update({
        beginningSnapshotComplete: completeness.hasBeginningSnapshot,
        endingSnapshotComplete: completeness.hasEndingSnapshot
      });
      
      logger.info(`Created ${createdSnapshots.length} ${snapshotType} snapshots for period ${period.periodName}`);
      
      res.status(201).json({
        success: true,
        data: {
          snapshots: createdSnapshots.map(s => s.toJSON()),
          snapshotSummary: await period.getSnapshotCompleteness(),
          message: `${snapshotType} snapshots created successfully`
        }
      });
      
    } catch (error) {
      logger.error('Error creating snapshots:', error);
      next(error);
    }
  }
  
  /**
   * Get snapshot summary for a period
   * GET /api/v1/periods/:id/snapshots
   */
  async getSnapshots(req, res, next) {
    try {
      const { id } = req.params;
      const { type } = req.query;
      
      const period = await InventoryPeriod.findByPk(id);
      if (!period) {
        return res.status(404).json({
          success: false,
          error: 'Period not found'
        });
      }
      
      const whereClause = { periodId: id };
      if (type) whereClause.snapshotType = type;
      
      const snapshots = await PeriodInventorySnapshot.findAll({
        where: whereClause,
        include: [
          {
            model: InventoryItem,
            as: 'inventoryItem',
            attributes: ['id', 'name', 'category', 'unit', 'unitCost', 'highValueFlag']
          }
        ],
        order: [['snapshotType', 'ASC'], ['createdAt', 'ASC']]
      });
      
      const completeness = await period.getSnapshotCompleteness();
      
      res.json({
        success: true,
        data: {
          snapshots: snapshots.map(s => s.toJSON()),
          snapshotSummary: completeness,
          period: {
            id: period.id,
            name: period.periodName,
            status: period.status,
            start: period.periodStart,
            end: period.periodEnd
          }
        }
      });
      
    } catch (error) {
      logger.error('Error fetching snapshots:', error);
      next(error);
    }
  }
  
  /**
   * Delete a period (only if draft status)
   * DELETE /api/v1/periods/:id
   */
  async deletePeriod(req, res, next) {
    try {
      const { id } = req.params;
      
      const period = await InventoryPeriod.findByPk(id);
      if (!period) {
        return res.status(404).json({
          success: false,
          error: 'Period not found'
        });
      }
      
      // Only allow deletion of draft periods
      if (period.status !== 'draft') {
        return res.status(400).json({
          success: false,
          error: 'Only draft periods can be deleted',
          currentStatus: period.status
        });
      }
      
      // Delete associated snapshots first
      await PeriodInventorySnapshot.destroy({
        where: { periodId: id }
      });
      
      // Delete the period
      await period.destroy();
      
      logger.info(`Period deleted: ${period.periodName} (ID: ${period.id})`);
      
      res.json({
        success: true,
        message: 'Period deleted successfully'
      });
      
    } catch (error) {
      logger.error('Error deleting period:', error);
      next(error);
    }
  }
  
  /**
   * Helper method to get available actions for a period
   */
  async getAvailableActions(period) {
    const actions = [];
    
    switch (period.status) {
      case 'draft':
        actions.push('activate', 'edit', 'delete');
        break;
      case 'active':
        const completeness = await period.getSnapshotCompleteness();
        if (completeness.hasBeginningSnapshot && completeness.hasEndingSnapshot) {
          actions.push('close');
        }
        actions.push('create_snapshots');
        break;
      case 'closed':
        actions.push('lock', 'analyze_variance');
        break;
      case 'locked':
        actions.push('view_analysis');
        break;
    }
    
    return actions;
  }
}

export default new PeriodController();
