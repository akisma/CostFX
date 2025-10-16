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
import POSConnection from './POSConnection.js';
import SquareLocation from './SquareLocation.js';
// Square POS Models (Issue #18)
import SquareCategory from './SquareCategory.js';
import SquareMenuItem from './SquareMenuItem.js';
import SquareInventoryCount from './SquareInventoryCount.js';
import SquareOrder from './SquareOrder.js';
import SquareOrderItem from './SquareOrderItem.js';
// Sales Data Models (Issue #21)
import SalesTransaction from './SalesTransaction.js';
// CSV Upload Models (Issue #47)
import CsvUpload from './CsvUpload.js';
import CsvUploadBatch from './CsvUploadBatch.js';

// Collect all models
const models = {
  Restaurant,
  Supplier,
  IngredientCategory,
  InventoryItem,
  InventoryPeriod,
  InventoryTransaction,
  PeriodInventorySnapshot,
  TheoreticalUsageAnalysis,
  POSConnection,
  SquareLocation,
  // Square POS Models
  SquareCategory,
  SquareMenuItem,
  SquareInventoryCount,
  SquareOrder,
  SquareOrderItem,
  // Sales Data Models
  SalesTransaction,
  // CSV Upload Models
  CsvUpload,
  CsvUploadBatch
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
  TheoreticalUsageAnalysis,
  POSConnection,
  SquareLocation,
  SquareCategory,
  SquareMenuItem,
  SquareInventoryCount,
  SquareOrder,
  SquareOrderItem,
  SalesTransaction,
  CsvUpload,
  CsvUploadBatch
};

export default models;
