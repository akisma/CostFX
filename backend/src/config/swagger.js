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
                }
            }
        },
        tags: [
            {
                name: 'Health',
                description: 'Health check endpoints'
            },
            {
                name: 'Square OAuth',
                description: 'Square POS OAuth 2.0 authentication endpoints'
            },
            {
                name: 'Restaurants',
                description: 'Restaurant management endpoints'
            },
            {
                name: 'Inventory',
                description: 'Inventory management endpoints'
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
