// models/UnitOfMeasure.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UnitOfMeasure = sequelize.define('UnitOfMeasure', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    abbreviation: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    unitType: {
      type: DataTypes.ENUM('weight', 'volume', 'count', 'length'),
      allowNull: false
    },
    baseUnit: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'The base unit for conversion (e.g., oz for weight, ml for volume)'
    },
    conversionFactor: {
      type: DataTypes.DECIMAL(15, 6),
      allowNull: true,
      comment: 'Factor to convert to base unit'
    }
  }, {
    tableName: 'units_of_measure',
    timestamps: true
  });

  return UnitOfMeasure;
};

// models/Vendor.js
module.exports = (sequelize) => {
  const Vendor = sequelize.define('Vendor', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    vendorCode: {
      type: DataTypes.STRING(50),
      unique: true
    },
    contactName: {
      type: DataTypes.STRING(100)
    },
    email: {
      type: DataTypes.STRING(100)
    },
    phone: {
      type: DataTypes.STRING(20)
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'vendors',
    timestamps: true
  });

  return Vendor;
};

// models/IngredientCategory.js
module.exports = (sequelize) => {
  const IngredientCategory = sequelize.define('IngredientCategory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    parentCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'ingredient_categories',
        key: 'id'
      }
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'ingredient_categories',
    timestamps: true
  });

  return IngredientCategory;
};

// models/Ingredient.js
module.exports = (sequelize) => {
  const Ingredient = sequelize.define('Ingredient', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    itemCode: {
      type: DataTypes.STRING(50),
      unique: true
    },
    categoryId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'ingredient_categories',
        key: 'id'
      }
    },
    defaultVendorId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'vendors',
        key: 'id'
      }
    },
    purchaseUnitId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'units_of_measure',
        key: 'id'
      },
      comment: 'Unit in which ingredient is purchased'
    },
    inventoryUnitId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'units_of_measure',
        key: 'id'
      },
      comment: 'Unit in which ingredient is tracked in inventory'
    },
    recipeUnitId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'units_of_measure',
        key: 'id'
      },
      comment: 'Default unit for recipe usage'
    },
    currentCost: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      defaultValue: 0
    },
    currentCostUnit: {
      type: DataTypes.INTEGER,
      references: {
        model: 'units_of_measure',
        key: 'id'
      },
      comment: 'Unit of measure for current cost'
    },
    packSize: {
      type: DataTypes.DECIMAL(10, 3),
      comment: 'Size of purchase pack'
    },
    yieldPercent: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 100.00,
      comment: 'Usable yield after prep/trimming'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isPrepItem: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this is a prepared/sub-recipe item'
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'ingredients',
    timestamps: true,
    indexes: [
      { fields: ['categoryId'] },
      { fields: ['itemCode'] },
      { fields: ['isPrepItem'] }
    ]
  });

  return Ingredient;
};

// models/IngredientCostHistory.js
module.exports = (sequelize) => {
  const IngredientCostHistory = sequelize.define('IngredientCostHistory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    ingredientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'ingredients',
        key: 'id'
      }
    },
    cost: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false
    },
    costUnitId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'units_of_measure',
        key: 'id'
      }
    },
    vendorId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'vendors',
        key: 'id'
      }
    },
    effectiveDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    invoiceNumber: {
      type: DataTypes.STRING(50)
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'ingredient_cost_history',
    timestamps: true,
    indexes: [
      { fields: ['ingredientId', 'effectiveDate'] },
      { fields: ['effectiveDate'] }
    ]
  });

  return IngredientCostHistory;
};

// models/RecipeCategory.js
module.exports = (sequelize) => {
  const RecipeCategory = sequelize.define('RecipeCategory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    parentCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'recipe_categories',
        key: 'id'
      }
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'recipe_categories',
    timestamps: true
  });

  return RecipeCategory;
};

// models/Recipe.js
module.exports = (sequelize) => {
  const Recipe = sequelize.define('Recipe', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    recipeCode: {
      type: DataTypes.STRING(50),
      unique: true
    },
    categoryId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'recipe_categories',
        key: 'id'
      }
    },
    description: {
      type: DataTypes.TEXT
    },
    yieldAmount: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
      comment: 'Total yield of recipe'
    },
    yieldUnitId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'units_of_measure',
        key: 'id'
      }
    },
    portionSize: {
      type: DataTypes.DECIMAL(10, 3),
      comment: 'Size of one portion'
    },
    portionUnitId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'units_of_measure',
        key: 'id'
      }
    },
    numberOfPortions: {
      type: DataTypes.INTEGER,
      comment: 'Number of portions recipe yields'
    },
    prepTime: {
      type: DataTypes.INTEGER,
      comment: 'Prep time in minutes'
    },
    cookTime: {
      type: DataTypes.INTEGER,
      comment: 'Cook time in minutes'
    },
    totalCost: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      comment: 'Total cost of recipe - calculated'
    },
    costPerPortion: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      comment: 'Cost per portion - calculated'
    },
    targetCostPercent: {
      type: DataTypes.DECIMAL(5, 2),
      comment: 'Target food cost percentage'
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isPrepRecipe: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether this is a prep/sub-recipe'
    },
    lastCostedAt: {
      type: DataTypes.DATE
    },
    imageUrl: {
      type: DataTypes.STRING(500)
    },
    notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'recipes',
    timestamps: true,
    indexes: [
      { fields: ['categoryId'] },
      { fields: ['recipeCode'] },
      { fields: ['isPrepRecipe'] }
    ]
  });

  return Recipe;
};

// models/RecipeIngredient.js
module.exports = (sequelize) => {
  const RecipeIngredient = sequelize.define('RecipeIngredient', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    recipeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'recipes',
        key: 'id'
      }
    },
    ingredientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'ingredients',
        key: 'id'
      }
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false
    },
    unitId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'units_of_measure',
        key: 'id'
      }
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    prepNote: {
      type: DataTypes.STRING(200),
      comment: 'Prep instructions (e.g., "diced", "julienned")'
    },
    isOptional: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    costAtTimeOfEntry: {
      type: DataTypes.DECIMAL(10, 4),
      comment: 'Snapshot of ingredient cost when added'
    },
    extendedCost: {
      type: DataTypes.DECIMAL(10, 4),
      comment: 'Total cost for this ingredient line (calculated)'
    }
  }, {
    tableName: 'recipe_ingredients',
    timestamps: true,
    indexes: [
      { fields: ['recipeId'] },
      { fields: ['ingredientId'] }
    ]
  });

  return RecipeIngredient;
};

// models/RecipeStep.js
module.exports = (sequelize) => {
  const RecipeStep = sequelize.define('RecipeStep', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    recipeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'recipes',
        key: 'id'
      }
    },
    stepNumber: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    instruction: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    imageUrl: {
      type: DataTypes.STRING(500)
    }
  }, {
    tableName: 'recipe_steps',
    timestamps: true,
    indexes: [
      { fields: ['recipeId', 'stepNumber'] }
    ]
  });

  return RecipeStep;
};

// models/MenuCategory.js
module.exports = (sequelize) => {
  const MenuCategory = sequelize.define('MenuCategory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'menu_categories',
    timestamps: true
  });

  return MenuCategory;
};

// models/MenuItem.js
module.exports = (sequelize) => {
  const MenuItem = sequelize.define('MenuItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    menuCode: {
      type: DataTypes.STRING(50),
      unique: true
    },
    categoryId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'menu_categories',
        key: 'id'
      }
    },
    description: {
      type: DataTypes.TEXT
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    totalCost: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      comment: 'Total cost from all recipe components'
    },
    foodCostPercent: {
      type: DataTypes.DECIMAL(5, 2),
      comment: 'Food cost as percentage of price (calculated)'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    imageUrl: {
      type: DataTypes.STRING(500)
    }
  }, {
    tableName: 'menu_items',
    timestamps: true,
    indexes: [
      { fields: ['categoryId'] },
      { fields: ['menuCode'] }
    ]
  });

  return MenuItem;
};

// models/MenuItemRecipe.js
module.exports = (sequelize) => {
  const MenuItemRecipe = sequelize.define('MenuItemRecipe', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    menuItemId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'menu_items',
        key: 'id'
      }
    },
    recipeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'recipes',
        key: 'id'
      }
    },
    portionMultiplier: {
      type: DataTypes.DECIMAL(10, 3),
      defaultValue: 1.0,
      comment: 'Multiplier for recipe portions (e.g., 0.5 for half portion)'
    }
  }, {
    tableName: 'menu_item_recipes',
    timestamps: true,
    indexes: [
      { fields: ['menuItemId'] },
      { fields: ['recipeId'] }
    ]
  });

  return MenuItemRecipe;
};

// Setup Associations (associations.js)
module.exports = (models) => {
  const {
    UnitOfMeasure,
    Vendor,
    IngredientCategory,
    Ingredient,
    IngredientCostHistory,
    RecipeCategory,
    Recipe,
    RecipeIngredient,
    RecipeStep,
    MenuCategory,
    MenuItem,
    MenuItemRecipe
  } = models;

  // Ingredient Category self-reference
  IngredientCategory.hasMany(IngredientCategory, {
    as: 'subcategories',
    foreignKey: 'parentCategoryId'
  });
  IngredientCategory.belongsTo(IngredientCategory, {
    as: 'parent',
    foreignKey: 'parentCategoryId'
  });

  // Ingredient relationships
  Ingredient.belongsTo(IngredientCategory, { foreignKey: 'categoryId' });
  Ingredient.belongsTo(Vendor, { as: 'defaultVendor', foreignKey: 'defaultVendorId' });
  Ingredient.belongsTo(UnitOfMeasure, { as: 'purchaseUnit', foreignKey: 'purchaseUnitId' });
  Ingredient.belongsTo(UnitOfMeasure, { as: 'inventoryUnit', foreignKey: 'inventoryUnitId' });
  Ingredient.belongsTo(UnitOfMeasure, { as: 'recipeUnit', foreignKey: 'recipeUnitId' });
  Ingredient.belongsTo(UnitOfMeasure, { as: 'currentCostUnit', foreignKey: 'currentCostUnit' });

  // Ingredient Cost History
  IngredientCostHistory.belongsTo(Ingredient, { foreignKey: 'ingredientId' });
  IngredientCostHistory.belongsTo(UnitOfMeasure, { as: 'costUnit', foreignKey: 'costUnitId' });
  IngredientCostHistory.belongsTo(Vendor, { foreignKey: 'vendorId' });
  Ingredient.hasMany(IngredientCostHistory, { foreignKey: 'ingredientId' });

  // Recipe Category self-reference
  RecipeCategory.hasMany(RecipeCategory, {
    as: 'subcategories',
    foreignKey: 'parentCategoryId'
  });
  RecipeCategory.belongsTo(RecipeCategory, {
    as: 'parent',
    foreignKey: 'parentCategoryId'
  });

  // Recipe relationships
  Recipe.belongsTo(RecipeCategory, { foreignKey: 'categoryId' });
  Recipe.belongsTo(UnitOfMeasure, { as: 'yieldUnit', foreignKey: 'yieldUnitId' });
  Recipe.belongsTo(UnitOfMeasure, { as: 'portionUnit', foreignKey: 'portionUnitId' });

  // Recipe Ingredients (many-to-many with extra data)
  Recipe.hasMany(RecipeIngredient, { foreignKey: 'recipeId', as: 'ingredients' });
  RecipeIngredient.belongsTo(Recipe, { foreignKey: 'recipeId' });
  RecipeIngredient.belongsTo(Ingredient, { foreignKey: 'ingredientId' });
  RecipeIngredient.belongsTo(UnitOfMeasure, { as: 'unit', foreignKey: 'unitId' });
  Ingredient.hasMany(RecipeIngredient, { foreignKey: 'ingredientId' });

  // Recipe Steps
  Recipe.hasMany(RecipeStep, { foreignKey: 'recipeId', as: 'steps' });
  RecipeStep.belongsTo(Recipe, { foreignKey: 'recipeId' });

  // Menu Item relationships
  MenuItem.belongsTo(MenuCategory, { foreignKey: 'categoryId' });
  MenuCategory.hasMany(MenuItem, { foreignKey: 'categoryId' });

  // Menu Item Recipes (many-to-many)
  MenuItem.hasMany(MenuItemRecipe, { foreignKey: 'menuItemId', as: 'recipes' });
  MenuItemRecipe.belongsTo(MenuItem, { foreignKey: 'menuItemId' });
  MenuItemRecipe.belongsTo(Recipe, { foreignKey: 'recipeId' });
  Recipe.hasMany(MenuItemRecipe, { foreignKey: 'recipeId' });
};