# Issue 47 CSV Upload – TODOs

## Backend Phase 1 – Upload Infrastructure
- [x] Extend settings for CSV upload limits (max size, mime types)
- [x] Create Sequelize models for CSV uploads (metadata + staged data)
- [x] Add `/api/v1/data/csv` router with upload endpoints and multer middleware
- [x] Implement CSVParserService with validation + tests

## Backend Phase 2 – Transformation Pipeline
- [ ] Implement CSVInventoryTransformer with helper reuse and tests
- [ ] Implement CSVSalesTransformer with fuzzy matching + tests
- [ ] Build transform controllers/routes (dry-run, error thresholds) + integration tests

## Frontend CSV UI
- [ ] New `/data-import/csv` route + module separate from Square components
- [ ] CSVUploadPanel with react-dropzone + validation feedback
- [ ] CSVFormatGuide with Restaurant365-style samples
- [ ] CSVTransformPanel + CSVDataReviewPanel reusing shared components/hooks
- [ ] Manual mapping interface for ambiguous matches
- [ ] Frontend service methods + Vitest component/service tests

## Documentation & Process
- [ ] Update Swagger docs for new API endpoints
- [ ] Append CSV architecture section to docs/TECHNICAL_DOCUMENTATION.md
- [ ] Update docs/PROJECT_STATUS.md after major milestones
- [ ] Keep GitHub issue comments and knowledge graph memories in sync

## Validation & QA
- [ ] End-to-end backend integration tests (upload → transform → DB)
- [ ] Frontend flow tests
- [ ] Final `npm run lint && npm run build && npm run test` plus dev server check
