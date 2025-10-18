/**
 * Square POS Integration Routes (Main Router)
 * 
 * Aggregates all Square-specific routes following RESTful resource hierarchy.
 * 
 * Base Path: /api/v1/pos/square
 * 
 * Sub-Routes:
 * - /connections - OAuth connection management
 * - /inventory   - Inventory sync/transform
 * - /sales       - Sales sync/transform
 * 
 * Architecture:
 * - Follows REST best practices with resource-based routing
 * - Nested routers for logical grouping
 * - Provider-specific (Square) isolation for future multi-provider support
 * 
 * Related Issues:
 * - Issue #16: Square OAuth Authentication Service
 * - Issue #20: Square Inventory Synchronization
 * - Issue #21: Square Sales Data Synchronization
 * - Issue #46: UI for Square Sales Import & Transformation
 * 
 * Created: 2025-10-13 (REST API Restructure)
 */

import express from 'express';
import connectionsRouter from './connections.js';
import inventoryRouter from './inventory.js';
import salesRouter from './sales.js';

const router = express.Router();

// Mount sub-routers
router.use('/connections', connectionsRouter);
router.use('/inventory', inventoryRouter);
router.use('/sales', salesRouter);

export default router;
