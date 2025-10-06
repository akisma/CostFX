/**
 * Square API Response Fixtures
 * 
 * Real Square API responses from official documentation
 * Used for testing without hitting the actual Square API
 * 
 * References:
 * - Catalog API: https://developer.squareup.com/reference/square/catalog-api
 * - Inventory API: https://developer.squareup.com/reference/square/inventory-api
 * - Orders API: https://developer.squareup.com/reference/square/orders-api
 */

/**
 * Catalog API - List Catalog Response
 * Source: https://developer.squareup.com/reference/square/catalog-api/list-catalog
 */
export const catalogListResponse = {
  objects: [
    {
      type: 'CATEGORY',
      id: 'BJNQCF2FJ6S6VVRSXC2TCMCH',
      updated_at: '2016-11-16T22:25:24.878Z',
      version: 1479335124878,
      is_deleted: false,
      present_at_all_locations: true,
      category_data: {
        name: 'Beverages'
      }
    },
    {
      type: 'CATEGORY',
      id: 'CATEGORY_FOOD_ID',
      updated_at: '2016-11-16T22:25:24.878Z',
      version: 1479335124878,
      is_deleted: false,
      present_at_all_locations: true,
      category_data: {
        name: 'Food'
      }
    },
    {
      type: 'ITEM',
      id: 'W62UWFY35CWMYGVWK6TWJDNI',
      updated_at: '2016-11-16T22:25:24.878Z',
      version: 1479335124878,
      is_deleted: false,
      present_at_all_locations: true,
      item_data: {
        name: 'Coffee',
        description: 'Premium roasted coffee',
        category_id: 'BJNQCF2FJ6S6VVRSXC2TCMCH',
        variations: [
          {
            type: 'ITEM_VARIATION',
            id: '2TZFAOHWGG7PAK2QEXWYPZSP',
            updated_at: '2016-11-16T22:25:24.878Z',
            version: 1479335124878,
            is_deleted: false,
            present_at_all_locations: true,
            item_variation_data: {
              item_id: 'W62UWFY35CWMYGVWK6TWJDNI',
              name: 'Regular',
              ordinal: 1,
              pricing_type: 'FIXED_PRICING',
              price_money: {
                amount: 250,
                currency: 'USD'
              }
            }
          }
        ]
      }
    },
    {
      type: 'ITEM',
      id: 'ITEM_BURGER_ID',
      updated_at: '2016-11-17T10:30:15.123Z',
      version: 1479380415123,
      is_deleted: false,
      present_at_all_locations: true,
      item_data: {
        name: 'Classic Burger',
        description: 'Angus beef burger with lettuce, tomato, onion',
        category_id: 'CATEGORY_FOOD_ID',
        variations: [
          {
            type: 'ITEM_VARIATION',
            id: 'VARIATION_BURGER_REGULAR',
            updated_at: '2016-11-17T10:30:15.123Z',
            version: 1479380415123,
            is_deleted: false,
            present_at_all_locations: true,
            item_variation_data: {
              item_id: 'ITEM_BURGER_ID',
              name: 'Regular',
              ordinal: 1,
              pricing_type: 'FIXED_PRICING',
              price_money: {
                amount: 995,
                currency: 'USD'
              },
              track_inventory: true
            }
          }
        ]
      }
    }
  ],
  cursor: 'NEXT_PAGE_CURSOR_TOKEN'
};

/**
 * Catalog API - Deleted objects (for incremental sync)
 */
export const catalogListDeletedResponse = {
  objects: [
    {
      type: 'ITEM',
      id: 'DELETED_ITEM_ID',
      updated_at: '2016-11-18T14:20:00.000Z',
      version: 1479482400000,
      is_deleted: true
    }
  ]
};

/**
 * Inventory API - Batch Retrieve Counts Response
 * Source: https://developer.squareup.com/reference/square/inventory-api/batch-retrieve-inventory-counts
 */
export const inventoryCountsResponse = {
  counts: [
    {
      catalog_object_id: '2TZFAOHWGG7PAK2QEXWYPZSP', // Coffee variation ID
      catalog_object_type: 'ITEM_VARIATION',
      state: 'IN_STOCK',
      location_id: 'L72T9RBYVQG4J',
      quantity: '100',
      calculated_at: '2023-10-05T12:00:00Z'
    },
    {
      catalog_object_id: 'VARIATION_BURGER_REGULAR',
      catalog_object_type: 'ITEM_VARIATION',
      state: 'IN_STOCK',
      location_id: 'L72T9RBYVQG4J',
      quantity: '50',
      calculated_at: '2023-10-05T12:00:00Z'
    },
    {
      catalog_object_id: 'VARIATION_BURGER_REGULAR',
      catalog_object_type: 'ITEM_VARIATION',
      state: 'WASTE',
      location_id: 'L72T9RBYVQG4J',
      quantity: '2',
      calculated_at: '2023-10-05T12:00:00Z'
    }
  ],
  cursor: 'NEXT_INVENTORY_CURSOR'
};

/**
 * Inventory API - Empty response (no inventory tracked)
 */
export const inventoryCountsEmptyResponse = {
  counts: []
};

/**
 * Locations API - List Locations Response
 * Source: https://developer.squareup.com/reference/square/locations-api/list-locations
 */
export const locationsListResponse = {
  locations: [
    {
      id: 'LOCATION_1',
      name: 'Main Location',
      address: {
        address_line_1: '123 Main St',
        locality: 'San Francisco',
        administrative_district_level_1: 'CA',
        postal_code: '94102',
        country: 'US'
      },
      timezone: 'America/Los_Angeles',
      capabilities: ['CREDIT_CARD_PROCESSING', 'AUTOMATIC_TRANSFERS'],
      status: 'ACTIVE',
      created_at: '2023-01-01T00:00:00.000Z',
      merchant_id: 'MERCHANT_123',
      country: 'US',
      language_code: 'en-US',
      currency: 'USD',
      business_name: 'Test Restaurant'
    }
  ]
};

/**
 * Merchant API - Retrieve Merchant Response
 * Source: https://developer.squareup.com/reference/square/merchants-api/retrieve-merchant
 */
export const merchantRetrieveResponse = {
  merchant: {
    id: 'MERCHANT_123',
    businessName: 'Test Restaurant',
    country: 'US',
    languageCode: 'en-US',
    currency: 'USD',
    status: 'ACTIVE',
    mainLocationId: 'LOCATION_1',
    createdAt: '2023-01-01T00:00:00.000Z'
  }
};

/**
 * Orders API - Search Orders Response
 * Source: https://developer.squareup.com/reference/square/orders-api/search-orders
 */
export const ordersSearchResponse = {
  orders: [
    {
      id: 'ORDER123456',
      location_id: 'L72T9RBYVQG4J',
      reference_id: 'order-ref-1',
      source: {
        name: 'Square Point of Sale'
      },
      line_items: [
        {
          uid: 'LINE_ITEM_UID_1',
          name: 'Coffee',
          quantity: '2',
          catalog_object_id: '2TZFAOHWGG7PAK2QEXWYPZSP',
          variation_name: 'Regular',
          base_price_money: {
            amount: 250,
            currency: 'USD'
          },
          gross_sales_money: {
            amount: 500,
            currency: 'USD'
          },
          total_tax_money: {
            amount: 40,
            currency: 'USD'
          },
          total_discount_money: {
            amount: 0,
            currency: 'USD'
          },
          total_money: {
            amount: 540,
            currency: 'USD'
          }
        }
      ],
      fulfillments: [
        {
          uid: 'FULFILLMENT_UID_1',
          type: 'PICKUP',
          state: 'COMPLETED',
          pickup_details: {
            recipient: {
              display_name: 'John Doe'
            },
            placed_at: '2023-10-05T10:30:00Z',
            pickup_at: '2023-10-05T11:00:00Z'
          }
        }
      ],
      created_at: '2023-10-05T10:30:00Z',
      updated_at: '2023-10-05T11:05:00Z',
      state: 'COMPLETED',
      total_money: {
        amount: 540,
        currency: 'USD'
      },
      total_tax_money: {
        amount: 40,
        currency: 'USD'
      },
      total_discount_money: {
        amount: 0,
        currency: 'USD'
      },
      tenders: [
        {
          id: 'TENDER_ID_1',
          location_id: 'L72T9RBYVQG4J',
          transaction_id: 'TRANSACTION_ID_1',
          created_at: '2023-10-05T11:00:00Z',
          amount_money: {
            amount: 540,
            currency: 'USD'
          },
          type: 'CARD',
          card_details: {
            status: 'CAPTURED'
          }
        }
      ]
    }
  ],
  cursor: 'NEXT_ORDERS_CURSOR'
};

/**
 * Error Response - Rate Limit (429)
 */
export const rateLimitErrorResponse = {
  errors: [
    {
      category: 'RATE_LIMIT_ERROR',
      code: 'RATE_LIMITED',
      detail: 'You have exceeded the rate limit for this API.'
    }
  ]
};

/**
 * Error Response - Authentication (401)
 */
export const authErrorResponse = {
  errors: [
    {
      category: 'AUTHENTICATION_ERROR',
      code: 'UNAUTHORIZED',
      detail: 'The access token is invalid or has expired.'
    }
  ]
};

/**
 * Error Response - Server Error (500)
 */
export const serverErrorResponse = {
  errors: [
    {
      category: 'API_ERROR',
      code: 'INTERNAL_SERVER_ERROR',
      detail: 'An internal server error occurred.'
    }
  ]
};

/**
 * Mock Square SDK Client
 * Used in tests to simulate Square API without network calls
 */
export class MockSquareClient {
  constructor({ accessToken, environment }) {
    this.accessToken = accessToken;
    this.environment = environment;
    
    // Mock API clients
    this.catalogApi = {
      listCatalog: async ({ cursor } = {}) => {
        if (cursor === 'NEXT_PAGE_CURSOR_TOKEN') {
          return { result: { objects: [] } }; // No more pages
        }
        return { result: catalogListResponse };
      },
      
      searchCatalogObjects: async ({ objectTypes, includeDeletedObjects }) => {
        if (includeDeletedObjects) {
          return { result: catalogListDeletedResponse };
        }
        return { result: catalogListResponse };
      }
    };
    
    this.inventoryApi = {
      batchRetrieveInventoryCounts: async ({ catalogObjectIds, locationIds, cursor } = {}) => {
        if (cursor === 'NEXT_INVENTORY_CURSOR') {
          return { result: { counts: [] } }; // No more pages
        }
        
        if (!catalogObjectIds || catalogObjectIds.length === 0) {
          return { result: inventoryCountsEmptyResponse };
        }
        
        return { result: inventoryCountsResponse };
      }
    };
    
    this.locationsApi = {
      listLocations: async () => {
        return { result: locationsListResponse };
      }
    };
    
    this.merchantsApi = {
      retrieveMerchant: async (merchantId) => {
        return { result: merchantRetrieveResponse };
      }
    };
    
    this.ordersApi = {
      searchOrders: async ({ locationIds, query, cursor } = {}) => {
        if (cursor === 'NEXT_ORDERS_CURSOR') {
          return { result: { orders: [] } }; // No more pages
        }
        return { result: ordersSearchResponse };
      }
    };
  }
}

export default {
  catalogListResponse,
  catalogListDeletedResponse,
  inventoryCountsResponse,
  inventoryCountsEmptyResponse,
  locationsListResponse,
  merchantRetrieveResponse,
  ordersSearchResponse,
  rateLimitErrorResponse,
  authErrorResponse,
  serverErrorResponse,
  MockSquareClient
};
