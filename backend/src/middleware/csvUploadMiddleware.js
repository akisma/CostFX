import path from 'path';
import multer from 'multer';
import settings from '../config/settings.js';
import { BadRequestError } from './errorHandler.js';

const storage = multer.memoryStorage();

function buildFileFilter() {
  const csvSettings = settings.uploads?.csv || {};
  const allowedMimeTypes = csvSettings.allowedMimeTypes || [];
  const allowedExtensions = csvSettings.allowedExtensions || [];

  return (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();

    if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
      return cb(new BadRequestError(`Unsupported file extension ${extension}`));
    }

    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
      return cb(new BadRequestError(`Unsupported MIME type ${file.mimetype}`));
    }

    cb(null, true);
  };
}

const upload = multer({
  storage,
  limits: {
    fileSize: settings.uploads?.csv?.maxFileSizeBytes || 10 * 1024 * 1024
  },
  fileFilter: buildFileFilter()
});

export const singleCsvUpload = upload.single('file');

export default upload;
