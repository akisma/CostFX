import express from 'express';
import { uploadInventoryCsv, uploadSalesCsv } from '../../controllers/csvUploadController.js';
import { transformInventoryUpload } from '../../controllers/csvTransformController.js';
import { singleCsvUpload } from '../../middleware/csvUploadMiddleware.js';

const router = express.Router();

router.post('/inventory/upload', singleCsvUpload, uploadInventoryCsv);
router.post('/sales/upload', singleCsvUpload, uploadSalesCsv);
router.post('/inventory/:uploadId/transform', transformInventoryUpload);

export default router;
