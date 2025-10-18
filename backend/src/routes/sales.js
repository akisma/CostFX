import express from 'express';

const router = express.Router();

/**
 * @swagger
 * /api/v1/sales:
 *   get:
 *     tags:
 *       - Sales
 *     summary: Get sales data
 *     description: Retrieve sales data with filtering and aggregation options
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Restaurant ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for sales data (ISO 8601 format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for sales data (ISO 8601 format)
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *         description: Group sales data by time period
 *       - in: query
 *         name: includeItems
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include individual item sales breakdown
 *     responses:
 *       200:
 *         description: Successfully retrieved sales data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Sales endpoint
 *             example:
 *               message: Sales endpoint
 *               data:
 *                 totalSales: 15420.50
 *                 transactionCount: 342
 *                 averageTicket: 45.09
 *                 topItems:
 *                   - name: Margherita Pizza
 *                     quantity: 85
 *                     revenue: 1275.00
 *       400:
 *         description: Missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', (req, res) => {
  res.json({ message: 'Sales endpoint' });
});

/**
 * @swagger
 * /api/v1/sales:
 *   post:
 *     tags:
 *       - Sales
 *     summary: Record a sale
 *     description: Record a new sales transaction with items and amounts
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - items
 *               - totalAmount
 *             properties:
 *               restaurantId:
 *                 type: integer
 *                 example: 1
 *               transactionId:
 *                 type: string
 *                 example: TXN-2024-001234
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId:
 *                       type: integer
 *                       example: 5
 *                     quantity:
 *                       type: integer
 *                       example: 2
 *                     unitPrice:
 *                       type: number
 *                       format: float
 *                       example: 15.00
 *                     subtotal:
 *                       type: number
 *                       format: float
 *                       example: 30.00
 *               subtotal:
 *                 type: number
 *                 format: float
 *                 example: 30.00
 *               tax:
 *                 type: number
 *                 format: float
 *                 example: 2.70
 *               tip:
 *                 type: number
 *                 format: float
 *                 example: 5.00
 *               totalAmount:
 *                 type: number
 *                 format: float
 *                 example: 37.70
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, credit_card, debit_card, mobile_payment]
 *                 example: credit_card
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T18:30:00Z"
 *     responses:
 *       201:
 *         description: Sale recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Record sale
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', (req, res) => {
  res.json({ message: 'Record sale' });
});

export default router;