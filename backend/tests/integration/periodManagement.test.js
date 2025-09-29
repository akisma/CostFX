import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import Restaurant from '../../src/models/Restaurant.js';
import InventoryItem from '../../src/models/InventoryItem.js';
import InventoryPeriod from '../../src/models/InventoryPeriod.js';
import PeriodInventorySnapshot from '../../src/models/PeriodInventorySnapshot.js';
import sequelize from '../../src/config/database.js';

/**
 * Period Management API Integration Tests
 * 
 * Tests Dave's period lifecycle management:
 * - Creating periods with validation
 * - Period status transitions
 * - Snapshot management
 * - Error handling and edge cases
 */
describe('Period Management API', () => {
  let testRestaurant;
  let testItems;

  beforeAll(async () => {
    // Ensure database connection
    await sequelize.authenticate();
  });

  beforeEach(async () => {
    // Clean up test data
    await PeriodInventorySnapshot.destroy({ where: {}, force: true });
    await InventoryPeriod.destroy({ where: {}, force: true });
    await InventoryItem.destroy({ where: {}, force: true });
    await Restaurant.destroy({ where: {}, force: true });

    // Create test restaurant
    testRestaurant = await Restaurant.create({
      name: 'Test Restaurant',
      address: '123 Test St',
      phone: '555-0123',
      email: 'test@restaurant.com'
    });

    // Create test inventory items
    testItems = await Promise.all([
      InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Saffron',
        category: 'Spices',
        unit: 'oz',
        unitCost: 150.00,
        currentStock: 2.0,
        highValueFlag: true
      }),
      InventoryItem.create({
        restaurantId: testRestaurant.id,
        name: 'Romaine Lettuce',
        category: 'Produce',
        unit: 'lbs',
        unitCost: 2.50,
        currentStock: 50.0,
        highValueFlag: false
      })
    ]);
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/v1/periods', () => {
    test('should create a new period successfully', async () => {
      const periodData = {
        restaurantId: testRestaurant.id,
        periodName: 'Weekly Period - Week 1',
        periodType: 'weekly',
        periodStart: '2025-09-23T00:00:00Z',
        periodEnd: '2025-09-29T23:59:59Z',
        description: 'Test period for integration testing'
      };

      const response = await request(app)
        .post('/api/v1/periods')
        .send(periodData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period.periodName).toBe(periodData.periodName);
      expect(response.body.data.period.status).toBe('draft');
      expect(response.body.data.period.restaurantId).toBe(testRestaurant.id);
    });

    test('should reject period with invalid data', async () => {
      const invalidData = {
        restaurantId: 'invalid',  // Should be integer
        periodName: '',           // Should not be empty
        periodType: 'invalid',    // Should be weekly/monthly/custom
        periodStart: '2025-09-30T00:00:00Z',
        periodEnd: '2025-09-23T23:59:59Z'  // End before start
      };

      const response = await request(app)
        .post('/api/v1/periods')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
      expect(response.body.details).toBeInstanceOf(Array);
    });

    test('should reject overlapping periods', async () => {
      // Create first period
      await InventoryPeriod.create({
        restaurantId: testRestaurant.id,
        periodName: 'Existing Period',
        periodType: 'weekly',
        periodStart: new Date('2025-09-23T00:00:00Z'),
        periodEnd: new Date('2025-09-29T23:59:59Z'),
        status: 'draft'
      });

      // Try to create overlapping period
      const overlappingData = {
        restaurantId: testRestaurant.id,
        periodName: 'Overlapping Period',
        periodType: 'weekly',
        periodStart: '2025-09-25T00:00:00Z',  // Overlaps with existing
        periodEnd: '2025-10-01T23:59:59Z'
      };

      const response = await request(app)
        .post('/api/v1/periods')
        .send(overlappingData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('overlaps');
      expect(response.body.conflicts).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/periods', () => {
    test('should list periods with pagination', async () => {
      // Create test periods
      const periods = await Promise.all([
        InventoryPeriod.create({
          restaurantId: testRestaurant.id,
          periodName: 'Period 1',
          periodType: 'weekly',
          periodStart: new Date('2025-09-01T00:00:00Z'),
          periodEnd: new Date('2025-09-07T23:59:59Z'),
          status: 'closed'
        }),
        InventoryPeriod.create({
          restaurantId: testRestaurant.id,
          periodName: 'Period 2',
          periodType: 'weekly',
          periodStart: new Date('2025-09-08T00:00:00Z'),
          periodEnd: new Date('2025-09-14T23:59:59Z'),
          status: 'active'
        })
      ]);

      const response = await request(app)
        .get('/api/v1/periods')
        .query({ restaurantId: testRestaurant.id })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.periods).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(2);
      
      // Should be ordered by periodStart DESC
      expect(new Date(response.body.data.periods[0].periodStart))
        .toBeGreaterThan(new Date(response.body.data.periods[1].periodStart));
    });

    test('should filter periods by status', async () => {
      // Create periods with different statuses
      await Promise.all([
        InventoryPeriod.create({
          restaurantId: testRestaurant.id,
          periodName: 'Draft Period',
          periodType: 'weekly',
          periodStart: new Date('2025-09-01T00:00:00Z'),
          periodEnd: new Date('2025-09-07T23:59:59Z'),
          status: 'draft'
        }),
        InventoryPeriod.create({
          restaurantId: testRestaurant.id,
          periodName: 'Active Period',
          periodType: 'weekly',
          periodStart: new Date('2025-09-08T00:00:00Z'),
          periodEnd: new Date('2025-09-14T23:59:59Z'),
          status: 'active'
        })
      ]);

      const response = await request(app)
        .get('/api/v1/periods')
        .query({ restaurantId: testRestaurant.id, status: 'draft' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.periods).toHaveLength(1);
      expect(response.body.data.periods[0].status).toBe('draft');
    });
  });

  describe('PUT /api/v1/periods/:id/activate', () => {
    test('should activate a draft period', async () => {
      const draftPeriod = await InventoryPeriod.create({
        restaurantId: testRestaurant.id,
        periodName: 'Draft Period',
        periodType: 'weekly',
        periodStart: new Date('2025-09-23T00:00:00Z'),
        periodEnd: new Date('2025-09-29T23:59:59Z'),
        status: 'draft'
      });

      const response = await request(app)
        .put(`/api/v1/periods/${draftPeriod.id}/activate`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period.status).toBe('active');
      expect(response.body.data.period.activatedAt).toBeTruthy();

      // Verify in database
      const updatedPeriod = await InventoryPeriod.findByPk(draftPeriod.id);
      expect(updatedPeriod.status).toBe('active');
    });

    test('should reject activation of non-draft period', async () => {
      const activePeriod = await InventoryPeriod.create({
        restaurantId: testRestaurant.id,
        periodName: 'Active Period',
        periodType: 'weekly',
        periodStart: new Date('2025-09-23T00:00:00Z'),
        periodEnd: new Date('2025-09-29T23:59:59Z'),
        status: 'active'
      });

      const response = await request(app)
        .put(`/api/v1/periods/${activePeriod.id}/activate`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('cannot be activated');
    });
  });

  describe('POST /api/v1/periods/:id/snapshots', () => {
    test('should create beginning snapshots', async () => {
      const period = await InventoryPeriod.create({
        restaurantId: testRestaurant.id,
        periodName: 'Test Period',
        periodType: 'weekly',
        periodStart: new Date('2025-09-23T00:00:00Z'),
        periodEnd: new Date('2025-09-29T23:59:59Z'),
        status: 'active'
      });

      const snapshotData = {
        snapshotType: 'beginning',
        items: [
          {
            inventoryItemId: testItems[0].id,
            quantity: 2.0,
            unitCost: 150.00,
            notes: 'Saffron beginning inventory'
          },
          {
            inventoryItemId: testItems[1].id,
            quantity: 50.0,
            unitCost: 2.50
          }
        ]
      };

      const response = await request(app)
        .post(`/api/v1/periods/${period.id}/snapshots`)
        .send(snapshotData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.snapshots).toHaveLength(2);
      expect(response.body.data.snapshotSummary.hasBeginningSnapshot).toBe(true);
      expect(response.body.data.snapshotSummary.hasEndingSnapshot).toBe(false);

      // Verify in database
      const snapshots = await PeriodInventorySnapshot.findAll({
        where: { periodId: period.id, snapshotType: 'beginning' }
      });
      expect(snapshots).toHaveLength(2);
    });

    test('should reject duplicate snapshot type', async () => {
      const period = await InventoryPeriod.create({
        restaurantId: testRestaurant.id,
        periodName: 'Test Period',
        periodType: 'weekly',
        periodStart: new Date('2025-09-23T00:00:00Z'),
        periodEnd: new Date('2025-09-29T23:59:59Z'),
        status: 'active'
      });

      // Create first snapshot
      await PeriodInventorySnapshot.create({
        periodId: period.id,
        inventoryItemId: testItems[0].id,
        snapshotType: 'beginning',
        quantity: 2.0,
        unitCost: 150.00
      });

      // Try to create duplicate
      const snapshotData = {
        snapshotType: 'beginning',
        items: [
          {
            inventoryItemId: testItems[1].id,
            quantity: 50.0,
            unitCost: 2.50
          }
        ]
      };

      const response = await request(app)
        .post(`/api/v1/periods/${period.id}/snapshots`)
        .send(snapshotData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exist');
    });
  });

  describe('PUT /api/v1/periods/:id/close', () => {
    test('should close period with complete snapshots', async () => {
      const period = await InventoryPeriod.create({
        restaurantId: testRestaurant.id,
        periodName: 'Test Period',
        periodType: 'weekly',
        periodStart: new Date('2025-09-23T00:00:00Z'),
        periodEnd: new Date('2025-09-29T23:59:59Z'),
        status: 'active'
      });

      // Create both beginning and ending snapshots
      await Promise.all([
        PeriodInventorySnapshot.create({
          periodId: period.id,
          inventoryItemId: testItems[0].id,
          snapshotType: 'beginning',
          quantity: 2.0,
          unitCost: 150.00
        }),
        PeriodInventorySnapshot.create({
          periodId: period.id,
          inventoryItemId: testItems[0].id,
          snapshotType: 'ending',
          quantity: 1.5,
          unitCost: 150.00
        })
      ]);

      const response = await request(app)
        .put(`/api/v1/periods/${period.id}/close`)
        .send({ notes: 'Period completed successfully' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period.status).toBe('closed');
      expect(response.body.data.period.closedAt).toBeTruthy();

      // Verify in database
      const updatedPeriod = await InventoryPeriod.findByPk(period.id);
      expect(updatedPeriod.status).toBe('closed');
      expect(updatedPeriod.closingNotes).toBe('Period completed successfully');
    });

    test('should reject closing period without complete snapshots', async () => {
      const period = await InventoryPeriod.create({
        restaurantId: testRestaurant.id,
        periodName: 'Test Period',
        periodType: 'weekly',
        periodStart: new Date('2025-09-23T00:00:00Z'),
        periodEnd: new Date('2025-09-29T23:59:59Z'),
        status: 'active'
      });

      // Only create beginning snapshot
      await PeriodInventorySnapshot.create({
        periodId: period.id,
        inventoryItemId: testItems[0].id,
        snapshotType: 'beginning',
        quantity: 2.0,
        unitCost: 150.00
      });

      const response = await request(app)
        .put(`/api/v1/periods/${period.id}/close`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('missing required snapshots');
      expect(response.body.missing.ending).toBe(true);
    });
  });

  describe('DELETE /api/v1/periods/:id', () => {
    test('should delete draft period', async () => {
      const draftPeriod = await InventoryPeriod.create({
        restaurantId: testRestaurant.id,
        periodName: 'Draft Period',
        periodType: 'weekly',
        periodStart: new Date('2025-09-23T00:00:00Z'),
        periodEnd: new Date('2025-09-29T23:59:59Z'),
        status: 'draft'
      });

      const response = await request(app)
        .delete(`/api/v1/periods/${draftPeriod.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deletedPeriod = await InventoryPeriod.findByPk(draftPeriod.id);
      expect(deletedPeriod).toBeNull();
    });

    test('should reject deletion of non-draft period', async () => {
      const activePeriod = await InventoryPeriod.create({
        restaurantId: testRestaurant.id,
        periodName: 'Active Period',
        periodType: 'weekly',
        periodStart: new Date('2025-09-23T00:00:00Z'),
        periodEnd: new Date('2025-09-29T23:59:59Z'),
        status: 'active'
      });

      const response = await request(app)
        .delete(`/api/v1/periods/${activePeriod.id}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Only draft periods can be deleted');
    });
  });
});
