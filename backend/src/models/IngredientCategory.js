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

  // Instance methods for Dave's hierarchical category system
  
  async getParentCategory() {
    // Get immediate parent category using ltree operators
    if (!this.path || this.path === 'root') return null;
    
    const parentPath = this.path.split('.').slice(0, -1).join('.');
    if (!parentPath) return null;
    
    return await IngredientCategory.findOne({
      where: {
        path: parentPath,
        isActive: true
      }
    });
  }

  async getChildCategories() {
    // Get immediate child categories using ltree operators
    return await IngredientCategory.findAll({
      where: sequelize.literal(`path ~ '${this.path}.*{1}'`), // Immediate children only
      order: [['name', 'ASC']]
    });
  }

  async getAllDescendants() {
    // Get all descendant categories using ltree operators
    return await IngredientCategory.findAll({
      where: sequelize.literal(`path <@ '${this.path}'`), // All descendants
      order: [['path', 'ASC']]
    });
  }

  async getAncestors() {
    // Get all ancestor categories using ltree operators
    return await IngredientCategory.findAll({
      where: sequelize.literal(`'${this.path}' <@ path`), // All ancestors
      order: [['path', 'ASC']]
    });
  }

  getBreadcrumbs() {
    // Generate breadcrumb array from path for Dave's drilling interface
    if (!this.path) return [];
    
    const pathParts = this.path.split('.');
    const breadcrumbs = [];
    
    for (let i = 0; i < pathParts.length; i++) {
      const currentPath = pathParts.slice(0, i + 1).join('.');
      breadcrumbs.push({
        path: currentPath,
        name: pathParts[i].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      });
    }
    
    return breadcrumbs;
  }

  getDepth() {
    // Get the depth level of this category in the hierarchy
    if (!this.path) return 0;
    return this.path.split('.').length;
  }

  isDescendantOf(ancestorPath) {
    // Check if this category is a descendant of another category
    if (!this.path || !ancestorPath) return false;
    return this.path.startsWith(`${ancestorPath}.`);
  }

  // Static methods for Dave's category management queries
  
  static async findByPath(path) {
    return await this.findOne({
      where: {
        path,
        isActive: true
      }
    });
  }

  static async findRootCategories() {
    // Find top-level categories (no dots in path)
    return await this.findAll({
      where: sequelize.literal(`path !~ '.*\\..*'`), // No dots = root level
      order: [['name', 'ASC']]
    });
  }

  static async findCategoriesAtDepth(depth) {
    // Find all categories at a specific depth level
    return await this.findAll({
      where: sequelize.literal(`nlevel(path) = ${depth}`),
      order: [['path', 'ASC']]
    });
  }

  static async findCategoriesByPrefix(pathPrefix) {
    // Find all categories under a specific path prefix for Dave's drilling
    return await this.findAll({
      where: sequelize.literal(`path <@ '${pathPrefix}'`),
      order: [['path', 'ASC']]
    });
  }

  static async getCategoryTree(rootPath = null) {
    // Build hierarchical category tree structure for frontend components
    const whereClause = rootPath 
      ? sequelize.literal(`path <@ '${rootPath}'`)
      : { isActive: true };

    const categories = await this.findAll({
      where: whereClause,
      order: [['path', 'ASC']]
    });

    // Build tree structure
    const tree = [];
    const categoryMap = new Map();

    for (const category of categories) {
      const item = {
        id: category.id,
        name: category.name,
        path: category.path,
        description: category.description,
        depth: category.getDepth(),
        children: []
      };

      categoryMap.set(category.path, item);

      if (category.getDepth() === 1 || (rootPath && category.path === rootPath)) {
        tree.push(item);
      } else {
        const pathParts = category.path.split('.');
        const parentPath = pathParts.slice(0, -1).join('.');
        const parent = categoryMap.get(parentPath);
        
        if (parent) {
          parent.children.push(item);
        }
      }
    }

    return tree;
  }

  static async getCategoryStats(categoryPath = null) {
    // Get statistics for Dave's category analysis
    const { InventoryItem } = sequelize.models;
    
    const whereClause = categoryPath 
      ? sequelize.literal(`path <@ '${categoryPath}'`)
      : { isActive: true };

    const stats = await this.findAll({
      where: whereClause,
      include: [{
        model: InventoryItem,
        as: 'inventoryItems',
        where: { isActive: true },
        required: false,
        attributes: []
      }],
      attributes: [
        'id',
        'name', 
        'path',
        [sequelize.fn('COUNT', sequelize.col('inventoryItems.id')), 'itemCount'],
        [sequelize.fn('AVG', sequelize.col('inventoryItems.unit_cost')), 'avgUnitCost'],
        [sequelize.fn('SUM', 
          sequelize.literal('CASE WHEN inventoryItems.high_value_flag = true THEN 1 ELSE 0 END')
        ), 'highValueItemCount']
      ],
      group: ['IngredientCategory.id', 'IngredientCategory.name', 'IngredientCategory.path'],
      order: [['path', 'ASC']]
    });

    return stats.map(stat => ({
      ...stat.toJSON(),
      avgUnitCost: parseFloat(stat.dataValues.avgUnitCost || 0),
      itemCount: parseInt(stat.dataValues.itemCount || 0),
      highValueItemCount: parseInt(stat.dataValues.highValueItemCount || 0)
    }));
  }

  static async searchCategories(searchTerm) {
    // Search categories by name or description for Dave's category selection
    return await this.findAll({
      where: {
        [sequelize.Op.or]: [
          { name: { [sequelize.Op.iLike]: `%${searchTerm}%` } },
          { description: { [sequelize.Op.iLike]: `%${searchTerm}%` } },
          { path: { [sequelize.Op.iLike]: `%${searchTerm}%` } }
        ],
        isActive: true
      },
      order: [['name', 'ASC']]
    });
  }

  toJSON() {
    const values = { ...this.get() };
    // Add computed properties for frontend
    values.breadcrumbs = this.getBreadcrumbs();
    values.depth = this.getDepth();
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
