import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class IngredientCategory extends Model {
  static associate(models) {
    // Define associations
    IngredientCategory.hasMany(models.InventoryItem, {
      foreignKey: 'categoryId',
      as: 'inventoryItems'
    });
  }

  // NOTE: All instance methods have been moved to CategoryManagementService:
  // - getParentCategory, getChildCategories, getAllDescendants, getAncestors
  // - getBreadcrumbs, getDepth, isDescendantOf

  // NOTE: All static methods have been moved to CategoryManagementService:
  // - findByPath, findRootCategories, getCategoryTree, getCategoryStats
  // - searchCategories, findCategoriesAtDepth, findCategoriesByPrefix

  toJSON() {
    const values = { ...this.get() };
    // NOTE: breadcrumbs and depth now computed by CategoryManagementService
    // Removed to avoid calling non-existent methods
    return values;
  }
}

IngredientCategory.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 100]
    }
  },
  path: {
    type: DataTypes.TEXT, // ltree type will be handled by PostgreSQL
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true,
      // Basic ltree format validation
      is: /^[a-z0-9_]+(\.[a-z0-9_]+)*$/i
    },
    comment: 'Hierarchical path using PostgreSQL ltree (e.g., produce.leafy_greens.romaine)'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  sequelize,
  modelName: 'IngredientCategory',
  tableName: 'ingredient_categories',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      // GiST index for ltree operations (defined in migration)
      fields: ['path'],
      name: 'idx_ingredient_categories_path'
    },
    {
      // B-tree index for path ancestors queries  
      fields: ['path'],
      name: 'idx_ingredient_categories_path_ancestors'
    },
    {
      fields: ['name']
    },
    {
      fields: ['is_active']
    },
    {
      // Composite index for active category searches
      fields: ['is_active', 'name']
    }
  ]
});

export default IngredientCategory;
