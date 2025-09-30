import sequelize from '../config/database.js';

// Import all models
import Restaurant from './Restaurant.js';
import Supplier from './Supplier.js';
import IngredientCategory from './IngredientCategory.js';
import InventoryItem from './InventoryItem.js';
import InventoryPeriod from './InventoryPeriod.js';
import InventoryTransaction from './InventoryTransaction.js';
import PeriodInventorySnapshot from './PeriodInventorySnapshot.js';
import TheoreticalUsageAnalysis from './TheoreticalUsageAnalysis.js';

// Collect all models
const models = {
  Restaurant,
  Supplier,
  IngredientCategory,
  InventoryItem,
  InventoryPeriod,
  InventoryTransaction,
  PeriodInventorySnapshot,
  TheoreticalUsageAnalysis
};

// Initialize associations
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// Add models to sequelize instance for easy access
Object.keys(models).forEach(modelName => {
  sequelize.models[modelName] = models[modelName];
});

export {
  sequelize,
  Restaurant,
  Supplier,
  IngredientCategory,
  InventoryItem,
  InventoryPeriod,
  InventoryTransaction,
  PeriodInventorySnapshot,
  TheoreticalUsageAnalysis
};

export default models;
