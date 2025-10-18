import express from 'express';
import { uploadInventoryCsv, uploadSalesCsv } from '../../controllers/csvUploadController.js';
import { transformInventoryUpload, transformSalesUpload } from '../../controllers/csvTransformController.js';
import { singleCsvUpload } from '../../middleware/csvUploadMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/data/csv/inventory/upload:
 *   post:
 *     tags: [CSV Imports]
 *     summary: Upload a staged inventory CSV file
 *     description: Validates an inventory CSV upload and persists the parsed batches for later transformation.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file to validate and persist.
 *               restaurantId:
 *                 type: integer
 *                 description: Optional restaurant override when acting on behalf of another account.
 *     responses:
 *       '201':
 *         description: Upload validated and ready for transformation.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadId:
 *                   type: integer
 *                   example: 123
 *                 filename:
 *                   type: string
 *                   example: inventory_upload.csv
 *                 status:
 *                   type: string
 *                   example: validated
 *                 rowsTotal:
 *                   type: integer
 *                   example: 250
 *                 rowsValid:
 *                   type: integer
 *                   example: 240
 *                 rowsInvalid:
 *                   type: integer
 *                   example: 10
 *                 validationErrors:
 *                   type: array
 *                   description: Row level validation issues.
 *                   items:
 *                     type: object
 *                 metadata:
 *                   type: object
 *                   additionalProperties: true
 *                 readyForTransform:
 *                   type: boolean
 *                   example: true
 *       '400':
 *         description: Invalid request or CSV payload.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Unexpected server error.
 */
router.post('/inventory/upload', singleCsvUpload, uploadInventoryCsv);

/**
 * @swagger
 * /api/v1/data/csv/sales/upload:
 *   post:
 *     tags: [CSV Imports]
 *     summary: Upload a staged sales CSV file
 *     description: Validates a sales CSV upload and persists the parsed batches for later transformation.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file to validate and persist.
 *               restaurantId:
 *                 type: integer
 *                 description: Optional restaurant override when acting on behalf of another account.
 *     responses:
 *       '201':
 *         description: Upload validated and ready for transformation.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadId:
 *                   type: integer
 *                   example: 456
 *                 filename:
 *                   type: string
 *                   example: sales_upload.csv
 *                 status:
 *                   type: string
 *                   example: validated
 *                 rowsTotal:
 *                   type: integer
 *                   example: 180
 *                 rowsValid:
 *                   type: integer
 *                   example: 172
 *                 rowsInvalid:
 *                   type: integer
 *                   example: 8
 *                 validationErrors:
 *                   type: array
 *                   description: Row level validation issues.
 *                   items:
 *                     type: object
 *                 metadata:
 *                   type: object
 *                   additionalProperties: true
 *                 readyForTransform:
 *                   type: boolean
 *                   example: true
 *       '400':
 *         description: Invalid request or CSV payload.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Unexpected server error.
 */
router.post('/sales/upload', singleCsvUpload, uploadSalesCsv);

/**
 * @swagger
 * /api/v1/data/csv/inventory/{uploadId}/transform:
 *   post:
 *     tags: [CSV Imports]
 *     summary: Transform a validated inventory CSV upload
 *     description: Executes the inventory transformation workflow for a previously validated upload.
 *     parameters:
 *       - in: path
 *         name: uploadId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identifier of the CSV upload to transform.
 *       - in: query
 *         name: dryRun
 *         required: false
 *         schema:
 *           type: boolean
 *         description: When true, performs a validation-only pass without persisting writes.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               restaurantId:
 *                 type: integer
 *                 description: Optional restaurant override when acting on behalf of another account.
 *               dryRun:
 *                 type: boolean
 *                 description: Overrides the dry run flag when not supplied as a query parameter.
 *     responses:
 *       '200':
 *         description: Transformation completed or flagged for review.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transformId:
 *                   type: integer
 *                   example: 789
 *                 uploadId:
 *                   type: integer
 *                   example: 123
 *                 restaurantId:
 *                   type: integer
 *                   example: 42
 *                 status:
 *                   type: string
 *                   example: completed
 *                 dryRun:
 *                   type: boolean
 *                   example: false
 *                 errorRate:
 *                   type: number
 *                   format: float
 *                   example: 0.02
 *                 summary:
 *                   type: object
 *                   additionalProperties: true
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       '400':
 *         description: Upload is not ready for transformation or input was invalid.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Upload not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Unexpected server error.
 */
router.post('/inventory/:uploadId/transform', transformInventoryUpload);

/**
 * @swagger
 * /api/v1/data/csv/sales/{uploadId}/transform:
 *   post:
 *     tags: [CSV Imports]
 *     summary: Transform a validated sales CSV upload
 *     description: Executes the sales transformation workflow for a previously validated upload.
 *     parameters:
 *       - in: path
 *         name: uploadId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Identifier of the CSV upload to transform.
 *       - in: query
 *         name: dryRun
 *         required: false
 *         schema:
 *           type: boolean
 *         description: When true, performs a validation-only pass without persisting writes.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               restaurantId:
 *                 type: integer
 *                 description: Optional restaurant override when acting on behalf of another account.
 *               dryRun:
 *                 type: boolean
 *                 description: Overrides the dry run flag when not supplied as a query parameter.
 *     responses:
 *       '200':
 *         description: Transformation completed or flagged for review.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 transformId:
 *                   type: integer
 *                   example: 790
 *                 uploadId:
 *                   type: integer
 *                   example: 456
 *                 restaurantId:
 *                   type: integer
 *                   example: 42
 *                 status:
 *                   type: string
 *                   example: completed
 *                 dryRun:
 *                   type: boolean
 *                   example: true
 *                 errorRate:
 *                   type: number
 *                   format: float
 *                   example: 0.05
 *                 summary:
 *                   type: object
 *                   additionalProperties: true
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       '400':
 *         description: Upload is not ready for transformation or input was invalid.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '404':
 *         description: Upload not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Unexpected server error.
 */
router.post('/sales/:uploadId/transform', transformSalesUpload);

export default router;
