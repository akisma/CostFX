## Issue 47 – Backend Phase 1 Progress (CSV Upload)
- Added multer/csv-parse dependencies via npm workspace install; noted upstream advisory on Multer 1.x for future upgrade.
- Extended backend settings with configurable CSV upload limits (max size, mime types, extensions) driven by env overrides.
- Created migrations for `csv_uploads` and `csv_upload_batches` tables to persist validation results in 1000-row batches.
- Implemented Sequelize models `CsvUpload` and `CsvUploadBatch` with associations and helper methods.
- Built CSV upload middleware, controller, and routes under `/api/v1/data/csv` for inventory/sales upload endpoints.
- Implemented parser + service layer (header normalization, validation rules, batch persistence, Restaurant365-aligned aliases) with summary responses and structured error reporting.
- Added Vitest coverage for `CsvUploadService` (valid upload path + header failure) using mocked models.
- Updated API router metadata and refreshed task TODO memory to track remaining phases.
