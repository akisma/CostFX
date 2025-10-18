import swaggerJSDoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'CostFX API',
            version: '1.0.0',
            description: 'Multi-POS restaurant cost analysis platform with Square and Toast integration',
            contact: {
                name: 'CostFX Support',
                email: 'support@costfx.com'
            }
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Development server'
            },
            {
                url: 'https://api.costfx.com',
                description: 'Production server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT authorization token (currently not implemented - all endpoints open in development)'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        error: {
                            type: 'string',
                            example: 'Error message'
                        },
                        message: {
                            type: 'string',
                            example: 'Detailed error description'
                        }
                    }
                },
                Restaurant: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'integer',
                            example: 1
                        },
                        name: {
                            type: 'string',
                            example: 'Demo Restaurant'
                        },
                        address: {
                            type: 'string',
                            example: '123 Main St'
                        },
                        city: {
                            type: 'string',
                            example: 'San Francisco'
                        },
                        state: {
                            type: 'string',
                            example: 'CA'
                        },
                        zipCode: {
                            type: 'string',
                            example: '94102'
                        },
                        phone: {
                            type: 'string',
                            example: '555-1234'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'demo@restaurant.com'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                }
            }
        },
        tags: [
            {
                name: 'Health',
                description: 'Health check endpoints'
            },
            {
                name: 'Restaurants',
                description: 'Restaurant management endpoints'
            },
            {
                name: 'Ingredients',
                description: 'Ingredient catalog management endpoints'
            },
            {
                name: 'Recipes',
                description: 'Recipe management endpoints'
            },
            {
                name: 'Inventory',
                description: 'Inventory tracking and optimization endpoints'
            },
            {
                name: 'Sales',
                description: 'Sales data management endpoints'
            },
            {
                name: 'Periods',
                description: 'Inventory period management endpoints'
            },
            {
                name: 'Variance',
                description: 'Variance analysis endpoints'
            },
            {
                name: 'Agents',
                description: 'AI agent endpoints for cost, forecast, and inventory analysis'
            },
            {
                name: 'Square OAuth',
                description: 'Square POS OAuth 2.0 authentication endpoints'
            },
            {
                name: 'POS Sync',
                description: 'POS data synchronization endpoints'
            },
            {
                name: 'CSV Imports',
                description: 'CSV upload validation and transformation workflows'
            }
        ]
    },
    apis: ['./src/routes/**/*.js', './src/models/**/*.js', './src/app.js'] // Paths to files with OpenAPI annotations
};

export default swaggerJSDoc(options);
