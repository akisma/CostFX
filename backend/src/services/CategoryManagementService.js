/**
 * CategoryManagementService - Dave's Hierarchical Category Business Logic
 * 
 * Handles all category hierarchy and ltree operation business logic that was previously
 * embedded in the IngredientCategory model. This service maintains clean separation
 * between data persistence (models) and business logic (services).
 * 
 * Key Responsibilities:
 * - Navigate category hierarchies using PostgreSQL ltree
 * - Generate breadcrumbs and UI formatting
 * - Build category trees for frontend components
 * - Calculate category statistics and metrics
 * - Search and query category structures
 * 
 * Architecture Note:
 * This service follows the established pattern from VarianceAnalysisService and
 * InvestigationWorkflowService. It receives model instances or data objects and
 * performs business logic operations without modifying the database directly.
 * 
 * Author: Architecture Refactoring - Issue #32 - Oct 2025
 */

import sequelize from '../config/database.js';
const { Op } = sequelize.Sequelize;

class CategoryManagementService {

  /**
   * Get the immediate parent category of a given category
   * 
   * @param {Object} category - IngredientCategory instance with path property
   * @param {Object} models - Database models object for querying
   * @returns {Promise<Object|null>} Parent category or null if at root
   */
  async getParentCategory(category, models) {
    // Root categories have no parent
    if (!category.path || category.path === 'root') {
      return null;
    }
    
    // Extract parent path by removing last segment
    const parentPath = category.path.split('.').slice(0, -1).join('.');
    if (!parentPath) {
      return null;
    }
    
    return await models.IngredientCategory.findOne({
      where: {
        path: parentPath,
        isActive: true
      }
    });
  }

  /**
   * Get immediate child categories (one level down)
   * 
   * @param {Object} category - IngredientCategory instance with path property
   * @param {Object} models - Database models object for querying
   * @returns {Promise<Array>} Array of child categories
   */
  async getChildCategories(category, models) {
    // Use ltree pattern matching: path ~ 'parent.*{1}' finds immediate children
    return await models.IngredientCategory.findAll({
      where: sequelize.literal(`path ~ '${category.path}.*{1}'`),
      order: [['name', 'ASC']]
    });
  }

  /**
   * Get all descendant categories (recursive - all levels below)
   * 
   * @param {Object} category - IngredientCategory instance with path property
   * @param {Object} models - Database models object for querying
   * @returns {Promise<Array>} Array of all descendant categories
   */
  async getAllDescendants(category, models) {
    // Use ltree operator <@ for "is descendant of"
    return await models.IngredientCategory.findAll({
      where: sequelize.literal(`path <@ '${category.path}'`),
      order: [['path', 'ASC']]
    });
  }

  /**
   * Get all ancestor categories (from root to this category)
   * 
   * @param {Object} category - IngredientCategory instance with path property
   * @param {Object} models - Database models object for querying
   * @returns {Promise<Array>} Array of ancestor categories ordered by depth
   */
  async getAncestors(category, models) {
    // Use ltree operator <@ reversed: 'child.path' <@ ancestor.path
    return await models.IngredientCategory.findAll({
      where: sequelize.literal(`'${category.path}' <@ path`),
      order: [['path', 'ASC']]
    });
  }

  /**
   * Generate breadcrumb navigation from category path
   * Dave uses this for his drilling interface to show the hierarchy trail
   * 
   * @param {Object} category - IngredientCategory instance with path property
   * @returns {Array} Array of breadcrumb objects with path and display name
   */
  getBreadcrumbs(category) {
    if (!category.path) {
      return [];
    }
    
    const pathParts = category.path.split('.');
    const breadcrumbs = [];
    
    for (let i = 0; i < pathParts.length; i++) {
      const currentPath = pathParts.slice(0, i + 1).join('.');
      // Convert snake_case to Title Case for display
      const displayName = pathParts[i]
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      
      breadcrumbs.push({
        path: currentPath,
        name: displayName
      });
    }
    
    return breadcrumbs;
  }

  /**
   * Calculate the depth level of a category in the hierarchy
   * Root categories are depth 1, their children are depth 2, etc.
   * 
   * @param {Object} category - IngredientCategory instance with path property
   * @returns {number} Depth level (0 if no path)
   */
  getDepth(category) {
    if (!category.path) {
      return 0;
    }
    return category.path.split('.').length;
  }

  /**
   * Check if a category is a descendant of another category
   * 
   * @param {Object} category - IngredientCategory instance to check
   * @param {string} ancestorPath - Path of potential ancestor category
   * @returns {boolean} True if category is descendant of ancestorPath
   */
  isDescendantOf(category, ancestorPath) {
    if (!category.path || !ancestorPath) {
      return false;
    }
    return category.path.startsWith(`${ancestorPath}.`);
  }

  /**
   * Find a category by its exact path
   * 
   * @param {string} path - Category path to search for
   * @param {Object} models - Database models object for querying
   * @returns {Promise<Object|null>} Category or null if not found
   */
  async findByPath(path, models) {
    return await models.IngredientCategory.findOne({
      where: {
        path,
        isActive: true
      }
    });
  }

  /**
   * Find all root-level categories (top of hierarchy)
   * 
   * @param {Object} models - Database models object for querying
   * @returns {Promise<Array>} Array of root categories
   */
  async findRootCategories(models) {
    // Root categories have no dots in their path (single segment)
    return await models.IngredientCategory.findAll({
      where: sequelize.literal(`path !~ '.*\\..*'`),
      order: [['name', 'ASC']]
    });
  }

  /**
   * Find all categories at a specific depth level
   * 
   * @param {number} depth - Depth level to query (1 = root, 2 = children of root, etc.)
   * @param {Object} models - Database models object for querying
   * @returns {Promise<Array>} Array of categories at specified depth
   */
  async findCategoriesAtDepth(depth, models) {
    // Use ltree nlevel() function to count path segments
    return await models.IngredientCategory.findAll({
      where: sequelize.literal(`nlevel(path) = ${depth}`),
      order: [['path', 'ASC']]
    });
  }

  /**
   * Find all categories under a specific path prefix
   * Dave uses this for drilling down into category hierarchies
   * 
   * @param {string} pathPrefix - Path prefix to search under
   * @param {Object} models - Database models object for querying
   * @returns {Promise<Array>} Array of categories under the prefix
   */
  async findCategoriesByPrefix(pathPrefix, models) {
    return await models.IngredientCategory.findAll({
      where: sequelize.literal(`path <@ '${pathPrefix}'`),
      order: [['path', 'ASC']]
    });
  }

  /**
   * Build hierarchical category tree structure for frontend components
   * Dave's React components use this to render collapsible category trees
   * 
   * @param {string|null} rootPath - Optional root path to build tree from (null = entire tree)
   * @param {Object} models - Database models object for querying
   * @returns {Promise<Array>} Nested tree structure with children arrays
   */
  async getCategoryTree(rootPath, models) {
    // Query categories based on root path or get all active
    const whereClause = rootPath 
      ? sequelize.literal(`path <@ '${rootPath}'`)
      : { isActive: true };

    const categories = await models.IngredientCategory.findAll({
      where: whereClause,
      order: [['path', 'ASC']]
    });

    // Build tree structure with children arrays
    const tree = [];
    const categoryMap = new Map();

    for (const category of categories) {
      const item = {
        id: category.id,
        name: category.name,
        path: category.path,
        description: category.description,
        depth: this.getDepth(category),
        children: []
      };

      categoryMap.set(category.path, item);

      // Add to tree root or parent's children
      const depth = this.getDepth(category);
      if (depth === 1 || (rootPath && category.path === rootPath)) {
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

  /**
   * Get category statistics including item counts and variance summaries
   * Dave uses this for high-level category performance analysis
   * 
   * @param {Object} category - IngredientCategory instance
   * @param {Object} models - Database models object for querying
   * @returns {Promise<Object>} Statistics object with counts and aggregations
   */
  async getCategoryStats(category, models) {
    // Get all descendants to include in statistics
    const descendants = await this.getAllDescendants(category, models);
    const categoryIds = [category.id, ...descendants.map(d => d.id)];

    // Count items in this category and descendants
    const itemCount = await models.InventoryItem.count({
      where: {
        categoryId: { [Op.in]: categoryIds },
        isActive: true
      }
    });

    // Get variance statistics if TheoreticalUsageAnalysis exists
    let varianceStats = null;
    if (models.TheoreticalUsageAnalysis) {
      const variances = await models.TheoreticalUsageAnalysis.findAll({
        include: [{
          model: models.InventoryItem,
          as: 'inventoryItem',
          where: {
            categoryId: { [Op.in]: categoryIds }
          }
        }],
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('TheoreticalUsageAnalysis.id')), 'totalVariances'],
          [sequelize.fn('SUM', sequelize.fn('ABS', sequelize.col('variance_dollar_value'))), 'totalDollarVariance'],
          [sequelize.fn('AVG', sequelize.fn('ABS', sequelize.col('variance_dollar_value'))), 'avgDollarVariance']
        ],
        raw: true
      });

      varianceStats = variances[0] || {};
    }

    return {
      categoryId: category.id,
      categoryName: category.name,
      categoryPath: category.path,
      depth: this.getDepth(category),
      itemCount,
      descendantCount: descendants.length,
      varianceStats
    };
  }

  /**
   * Search categories by name or description
   * Dave uses this for quick category lookups in the UI
   * 
   * @param {string} searchTerm - Term to search for
   * @param {Object} models - Database models object for querying
   * @param {number} limit - Maximum results to return (default 20)
   * @returns {Promise<Array>} Array of matching categories
   */
  async searchCategories(searchTerm, models, limit = 20) {
    if (!searchTerm || searchTerm.trim() === '') {
      return [];
    }

    const term = searchTerm.trim().toLowerCase();

    return await models.IngredientCategory.findAll({
      where: {
        [Op.or]: [
          sequelize.where(
            sequelize.fn('LOWER', sequelize.col('name')),
            { [Op.like]: `%${term}%` }
          ),
          sequelize.where(
            sequelize.fn('LOWER', sequelize.col('description')),
            { [Op.like]: `%${term}%` }
          )
        ],
        isActive: true
      },
      order: [
        [sequelize.literal(`CASE WHEN LOWER(name) LIKE '${term}%' THEN 0 ELSE 1 END`), 'ASC'],
        ['name', 'ASC']
      ],
      limit
    });
  }
}

export default new CategoryManagementService();
