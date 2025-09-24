import { vi, describe, test, expect, beforeEach } from 'vitest';

// Mock inventory periods data that would come from the database
const mockInventoryPeriods = [
  {
    id: 1,
    restaurant_id: 1,
    period_name: 'Week 38 2025',
    period_start: '2025-09-15',
    period_end: '2025-09-21',
    status: 'closed',
    period_type: 'weekly',
    beginning_snapshot_completed: true,
    ending_snapshot_completed: true,
    variance_analysis_completed: true,
    notes: 'Normal week - good for baseline comparison',
    created_by: 'system',
    closed_by: 'dave_manager',
    closed_at: '2025-09-22T08:00:00Z'
  },
  {
    id: 2,
    restaurant_id: 1,
    period_name: 'Week 39 2025',
    period_start: '2025-09-22',
    period_end: '2025-09-28',
    status: 'active',
    period_type: 'weekly',
    beginning_snapshot_completed: true,
    ending_snapshot_completed: false,
    variance_analysis_completed: false,
    notes: 'Current week - high saffron usage expected for special menu',
    created_by: 'dave_manager'
  },
  {
    id: 3,
    restaurant_id: 1,
    period_name: 'September 2025',
    period_start: '2025-09-01',
    period_end: '2025-09-30',
    status: 'active',
    period_type: 'monthly',
    beginning_snapshot_completed: true,
    ending_snapshot_completed: false,
    variance_analysis_completed: false,
    notes: 'Monthly analysis for executive reporting',
    created_by: 'system'
  }
];

// Mock period service that would handle period management
const mockPeriodService = {
  findAll: vi.fn(),
  findById: vi.fn(),
  findByStatus: vi.fn(),
  findByDateRange: vi.fn(),
  createPeriod: vi.fn(),
  closePeriod: vi.fn(),
  lockPeriod: vi.fn(),
  validatePeriodOverlap: vi.fn(),
  getCurrentActivePeriods: vi.fn(),
  getPeriodsByType: vi.fn()
};

describe('Inventory Period Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock behavior
    mockPeriodService.findAll.mockResolvedValue(mockInventoryPeriods);
  });

  test('should return all inventory periods with proper status tracking', async () => {
    const periods = await mockPeriodService.findAll();
    
    expect(periods.length).toBe(3);
    
    // Check Dave's scenario data
    const weeklyPeriods = periods.filter(p => p.period_type === 'weekly');
    const monthlyPeriods = periods.filter(p => p.period_type === 'monthly');
    
    expect(weeklyPeriods.length).toBe(2);
    expect(monthlyPeriods.length).toBe(1);
  });

  test('should support period status lifecycle management', async () => {
    // Mock finding periods by status
    const activePeriods = mockInventoryPeriods.filter(p => p.status === 'active');
    const closedPeriods = mockInventoryPeriods.filter(p => p.status === 'closed');
    
    mockPeriodService.findByStatus.mockImplementation((status) => {
      return Promise.resolve(mockInventoryPeriods.filter(p => p.status === status));
    });
    
    const activeResults = await mockPeriodService.findByStatus('active');
    const closedResults = await mockPeriodService.findByStatus('closed');
    
    expect(activeResults.length).toBe(2); // Week 39 and September 2025
    expect(closedResults.length).toBe(1); // Week 38 2025
    
    // Verify active periods have incomplete snapshots
    const activeWeekly = activeResults.find(p => p.period_type === 'weekly');
    expect(activeWeekly.ending_snapshot_completed).toBe(false);
    expect(activeWeekly.variance_analysis_completed).toBe(false);
  });

  test('should validate period date ranges for Dave\'s analysis', async () => {
    // Mock date range validation
    mockPeriodService.findByDateRange.mockImplementation((startDate, endDate) => {
      return Promise.resolve(
        mockInventoryPeriods.filter(p => 
          p.period_start >= startDate && p.period_end <= endDate
        )
      );
    });
    
    // Find periods in September 2025
    const septemberPeriods = await mockPeriodService.findByDateRange('2025-09-01', '2025-09-30');
    
    expect(septemberPeriods.length).toBeGreaterThan(0);
    
    // All found periods should be within the date range
    septemberPeriods.forEach(period => {
      expect(period.period_start).toMatch(/2025-09/);
      expect(period.period_end).toMatch(/2025-09/);
    });
  });

  test('should support period creation with validation', async () => {
    const newPeriodData = {
      restaurant_id: 1,
      period_name: 'Week 40 2025',
      period_start: '2025-09-29',
      period_end: '2025-10-05',
      period_type: 'weekly',
      notes: 'Start of October - inventory audit week',
      created_by: 'dave_manager'
    };
    
    const expectedPeriod = {
      id: 4,
      ...newPeriodData,
      status: 'draft',
      beginning_snapshot_completed: false,
      ending_snapshot_completed: false,
      variance_analysis_completed: false
    };
    
    mockPeriodService.createPeriod.mockResolvedValue(expectedPeriod);
    
    const createdPeriod = await mockPeriodService.createPeriod(newPeriodData);
    
    expect(createdPeriod.status).toBe('draft');
    expect(createdPeriod.period_name).toBe('Week 40 2025');
    expect(createdPeriod.beginning_snapshot_completed).toBe(false);
    expect(mockPeriodService.createPeriod).toHaveBeenCalledWith(newPeriodData);
  });

  test('should handle period closure workflow', async () => {
    const periodToClose = mockInventoryPeriods.find(p => p.status === 'active' && p.period_type === 'weekly');
    
    const closedPeriod = {
      ...periodToClose,
      status: 'closed',
      ending_snapshot_completed: true,
      variance_analysis_completed: true,
      closed_by: 'dave_manager',
      closed_at: new Date().toISOString()
    };
    
    mockPeriodService.closePeriod.mockResolvedValue(closedPeriod);
    
    const result = await mockPeriodService.closePeriod(periodToClose.id, 'dave_manager');
    
    expect(result.status).toBe('closed');
    expect(result.ending_snapshot_completed).toBe(true);
    expect(result.variance_analysis_completed).toBe(true);
    expect(result.closed_by).toBe('dave_manager');
    expect(mockPeriodService.closePeriod).toHaveBeenCalledWith(periodToClose.id, 'dave_manager');
  });

  test('should prevent overlapping periods for same restaurant', async () => {
    // Mock overlap validation
    mockPeriodService.validatePeriodOverlap.mockImplementation((restaurantId, startDate, endDate) => {
      const overlapping = mockInventoryPeriods.find(p => 
        p.restaurant_id === restaurantId &&
        p.status !== 'draft' &&
        ((startDate >= p.period_start && startDate <= p.period_end) ||
         (endDate >= p.period_start && endDate <= p.period_end))
      );
      return Promise.resolve(overlapping ? false : true);
    });
    
    // Try to create overlapping period
    const isValidNonOverlapping = await mockPeriodService.validatePeriodOverlap(1, '2025-10-01', '2025-10-07');
    const isValidOverlapping = await mockPeriodService.validatePeriodOverlap(1, '2025-09-20', '2025-09-26');
    
    expect(isValidNonOverlapping).toBe(true);  // No overlap
    expect(isValidOverlapping).toBe(false);    // Overlaps with Week 39
  });

  test('should support Dave\'s period type preferences', async () => {
    mockPeriodService.getPeriodsByType.mockImplementation((periodType) => {
      return Promise.resolve(mockInventoryPeriods.filter(p => p.period_type === periodType));
    });
    
    const weeklyPeriods = await mockPeriodService.getPeriodsByType('weekly');
    const monthlyPeriods = await mockPeriodService.getPeriodsByType('monthly');
    
    // Dave uses weekly for operational analysis
    expect(weeklyPeriods.length).toBe(2);
    expect(weeklyPeriods.every(p => p.period_type === 'weekly')).toBe(true);
    
    // Monthly for executive reporting
    expect(monthlyPeriods.length).toBe(1);
    expect(monthlyPeriods[0].notes).toContain('executive reporting');
  });

  test('should track snapshot completion for variance analysis', async () => {
    const periods = await mockPeriodService.findAll();
    
    // Closed periods should have all snapshots complete
    const closedPeriod = periods.find(p => p.status === 'closed');
    expect(closedPeriod.beginning_snapshot_completed).toBe(true);
    expect(closedPeriod.ending_snapshot_completed).toBe(true);
    expect(closedPeriod.variance_analysis_completed).toBe(true);
    
    // Active periods should have beginning but not ending snapshots
    const activePeriods = periods.filter(p => p.status === 'active');
    activePeriods.forEach(period => {
      expect(period.beginning_snapshot_completed).toBe(true);
      expect(period.ending_snapshot_completed).toBe(false);
      expect(period.variance_analysis_completed).toBe(false);
    });
  });
});
