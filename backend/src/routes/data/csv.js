import express from 'express';
import { uploadInventoryCsv, uploadSalesCsv } from '../../controllers/csvUploadController.js';
import { singleCsvUpload } from '../../middleware/csvUploadMiddleware.js';

const router = express.Router();

router.post('/inventory/upload', singleCsvUpload, uploadInventoryCsv);
router.post('/sales/upload', singleCsvUpload, uploadSalesCsv);

export default router;
