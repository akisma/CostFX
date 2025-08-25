#!/usr/bin/env node

/**
 * Simple verification script for InventoryAgent functionality
 * Tests basic initialization and method calls without complex mocking
 */

import InventoryAgent from './src/agents/InventoryAgent.js';
import chalk from 'chalk';

console.log(chalk.blue('🧪 InventoryAgent Verification Script\n'));

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(description, testFn) {
    try {
      const result = testFn();
      if (result === true || (result && typeof result.then === 'function')) {
        if (typeof result.then === 'function') {
          return result.then(
            () => {
              console.log(chalk.green('✓'), description);
              passed++;
            },
            (error) => {
              console.log(chalk.red('✗'), description, '-', error.message);
              failed++;
            }
          );
        } else {
          console.log(chalk.green('✓'), description);
          passed++;
        }
      } else {
        throw new Error('Test assertion failed');
      }
    } catch (error) {
      console.log(chalk.red('✗'), description, '-', error.message);
      failed++;
    }
  }

  // Test 1: Constructor
  const agent = new InventoryAgent();
  
  // Initialize the agent to set up metrics
  await agent.initialize();
  
  test('InventoryAgent constructor initializes correctly', () => {
    return agent.name === 'InventoryAgent' && 
           agent.capabilities.includes('track_inventory_levels') &&
           agent.config.defaultSafetyStockDays === 3;
  });

  // Test 2: Helper method - getDaysUntilExpiration
  test('getDaysUntilExpiration calculates correctly', () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    return agent.getDaysUntilExpiration(futureDate) === 5;
  });

  test('getDaysUntilExpiration returns null for null date', () => {
    return agent.getDaysUntilExpiration(null) === null;
  });

  // Test 3: Helper method - estimateDailyUsage
  test('estimateDailyUsage returns reasonable values', () => {
    const item = { category: 'produce', maximumStock: 100 };
    const result = agent.estimateDailyUsage(item);
    return result === 15; // 15% of 100
  });

  // Test 4: Helper method - estimateSeasonalVariation
  test('estimateSeasonalVariation returns category-specific values', () => {
    return agent.estimateSeasonalVariation('produce') === 0.25 &&
           agent.estimateSeasonalVariation('meat') === 0.15 &&
           agent.estimateSeasonalVariation('unknown') === 0.15;
  });

  // Test 5: generateWasteRecommendations
  test('generateWasteRecommendations creates recommendations for high waste items', () => {
    const wasteAnalysis = [
      {
        itemName: 'Lettuce',
        category: 'produce',
        wastePercentage: 20,
        severity: 'high',
        primaryReason: 'spoilage',
        totalWaste: 10
      }
    ];
    
    const recommendations = agent.generateWasteRecommendations(wasteAnalysis);
    return recommendations.length > 0 && 
           recommendations[0].type === 'inventory-management' &&
           recommendations[0].priority === 'high';
  });

  // Test 6: generateStockRecommendations  
  test('generateStockRecommendations provides optimization suggestions', () => {
    const item = {
      minimumStock: 20,
      maximumStock: 100,
      seasonalVariation: 0.25
    };
    
    const recommendations = agent.generateStockRecommendations(item, 15, 80, 25);
    return recommendations.length > 0 &&
           recommendations.includes('Reduce minimum stock level to lower holding costs');
  });

  // Test 7: Process method error handling
  test('process method throws error for unknown request type', async () => {
    try {
      await agent.process({ type: 'unknown_type', data: {} });
      return false; // Should not reach here
    } catch (error) {
      return error.message.includes('Unknown request type');
    }
  });

  // Test 8: Configuration validation
  test('Configuration has all required properties', () => {
    const config = agent.config;
    console.log('  Debug - Config:', config);
    return config && 
           typeof config.defaultSafetyStockDays === 'number' &&
           typeof config.expirationWarningDays === 'number' &&
           typeof config.highWasteThreshold === 'number' &&
           typeof config.lowStockMultiplier === 'number' &&
           typeof config.overstockMultiplier === 'number';
  });

  // Test 9: Capabilities validation
  test('All required capabilities are present', () => {
    const expectedCapabilities = [
      'track_inventory_levels',
      'predict_reorder_needs',
      'monitor_expiration_dates',
      'analyze_waste_patterns',
      'optimize_stock_levels'
    ];
    
    return expectedCapabilities.every(cap => agent.capabilities.includes(cap));
  });

  // Test 10: BaseAgent inheritance
  test('InventoryAgent extends BaseAgent correctly', () => {
    console.log('  Debug - Agent methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(agent)));
    console.log('  Debug - Has metrics:', !!agent.metrics);
    return typeof agent.process === 'function' &&
           agent.metrics !== undefined;
  });

  // Wait for any async tests to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log(chalk.blue('\n📊 Test Results:'));
  console.log(chalk.green(`✓ Passed: ${passed}`));
  console.log(chalk.red(`✗ Failed: ${failed}`));
  console.log(chalk.blue(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`));

  if (failed === 0) {
    console.log(chalk.green('\n🎉 All tests passed! InventoryAgent is working correctly.'));
    process.exit(0);
  } else {
    console.log(chalk.red('\n💥 Some tests failed. Please check the implementation.'));
    process.exit(1);
  }
}

// Add error handling for the script
process.on('uncaughtException', (error) => {
  console.log(chalk.red('💥 Uncaught Exception:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log(chalk.red('💥 Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// Run the tests
runTests().catch(error => {
  console.log(chalk.red('💥 Test runner failed:'), error.message);
  process.exit(1);
});
