# Phase 8 Implementation Plan – Dave V1 Enablement

**Date:** 2025-09-03  
**Owner:** Engineering (Primary executor: AI Assistant)  
**Status:** Draft (awaiting Principal decisions – see Decision Points)

---
## 1. Objective
Deliver Dave's V1 operational capabilities (recipe voice/OCR ingestion, invoice OCR + price intelligence, waste logging with prep waste factors, manual overrides + learning, basic cost optimization & substitution) leveraging the existing production-grade multi-agent platform (Cost, Inventory, Forecast). Lay a clean, testable foundation for Smart Recipe Generation in a later phase.

---
## 2. Guiding Principles
- Follow CLAUDE.md workflow: Research → Plan → Implement with checkpoints
- Strict hook compliance: ZERO lint/test/build failures merged
- Parallelize independent tracks; small, reviewable increments
- Feature-flag new surfaces until stable (SSM preferred)
- Keep scope lean: defer heavy ML / real supplier APIs / advanced generation

---
## 3. Major Tracks (Parallel Work Streams)
| # | Track | Purpose | Output (Initial Completion Definition) |
|---|-------|---------|-----------------------------------------|
| 1 | Schema & Data Layer | Support new features | Migrations + models + seeds committed & tested |
| 2 | Recipe Agent | Voice/OCR recipes, scaling, allergens, inventory match | Active endpoints behind flag |
| 3 | Invoice Agent | OCR invoices, price trend storage | Scan + price trend endpoints + supplier auto-create |
| 4 | Waste Logging | Voice waste + prep waste factor integration | Waste endpoints + cost integration |
| 5 | Manual Overrides & Learning v1 | Chef control + pattern capture | Override endpoints + query-time overrides |
| 6 | Cost Optimization & Substitution (Foundation) | Basic substitution suggestions + price monitoring | Suggest-substitutions + price-monitoring endpoints |
| 7 | Frontend Mobile/Voice/OCR UI | Usable kitchen interfaces | Recipe + invoice + waste capture UI |
| 8 | Infra & Observability | Feature flags, metrics, logging | Flags in place + structured logs + /metrics |
| 9 | Testing Expansion | Coverage & reliability | Unit + integration + FE tests for new scope |
|10 | Security & Compliance | Safe handling of media + inputs | Upload validation + size limits + sanitization |

---
## 4. Data Model Extensions (Phase 8 Scope)
**New Tables (Sequelize migrations):**
1. `recipes` (id, restaurant_id FK, name, serving_size, prep_time, cook_time, metadata JSONB, created_at)
2. `recipe_ingredients` (id, recipe_id FK, ingredient_id NULLABLE (unmatched), name_text, quantity, unit, waste_factor, notes)
3. `waste_logs` (id, restaurant_id, ingredient_id NULLABLE, quantity, unit, reason, source ENUM('voice','manual'), cost_impact, created_at)
4. `prep_waste_factors` (id, ingredient_category, cut_type, min_pct, max_pct, yield_pct, notes, updated_at)
5. `invoice_documents` (id, restaurant_id, supplier_id NULLABLE, original_filename, ocr_text TEXT, parsed_json JSONB, confidence NUMERIC, status ENUM('parsed','pending_review','approved','rejected'), created_at)
6. `supplier_price_history` (id, supplier_id, ingredient_name, unit_price, unit, observed_at, source ENUM('invoice','manual'))
7. `manual_overrides` (id, entity_type, entity_id, field, old_value JSONB, new_value JSONB, reason, user_id, created_at)
8. `ingredient_substitutions` (id, original_ingredient, substitute_ingredient, substitution_ratio, quality_impact_score, flavor_score, cost_savings_pct, approval_required BOOLEAN, notes, updated_at)
9. `supplier_pricing_realtime` (OPTIONAL / DEFERRED – stub migration only if time)

**Indexes (initial):**
- `recipes(restaurant_id)`
- `recipe_ingredients(recipe_id)`
- `waste_logs(restaurant_id, created_at)`
- `manual_overrides(entity_type, entity_id)`
- `supplier_price_history(supplier_id, ingredient_name, observed_at)`
- GIN on `invoice_documents(parsed_json)` if needed later (defer until query proven)

**Deferred (Phase 9+):** recipe versioning, forecast override influence table, vector store integration.

---
## 5. Backend Implementation Outline
### 5.1 Recipe Agent (backend/src/agents/RecipeAgent.js)
Responsibilities:
- Voice transcript to structured recipe (stub speech adapter first)
- OCR image text -> parsed ingredients/instructions (stub adapter)
- Scaling natural language parser ("for 50", "use 5 lbs chicken")
- Allergen detection (static allergen map: gluten, dairy, nuts, shellfish, soy, egg, sesame)
- Ingredient matching (fuzzy match to inventory items by name + unit normalization)

Endpoints (initial):
- POST `/api/v1/recipes/voice-input`
- POST `/api/v1/recipes/scan-ocr`
- POST `/api/v1/recipes/:id/scale-flexible`
- GET  `/api/v1/recipes/:id/allergens`
- POST `/api/v1/recipes/match-to-inventory`

### 5.2 Invoice Agent (backend/src/agents/InvoiceAgent.js)
- OCR pipeline stub -> line item extraction
- Supplier auto-create logic (match name, else create minimal record)
- Price history insertion & basic trend (avg, pct change last 7/30 days)

Endpoints:
- POST `/api/v1/invoices/scan`
- PUT  `/api/v1/invoices/:id/review`
- POST `/api/v1/suppliers/create-from-invoice`
- GET  `/api/v1/pricing/trends/:ingredient`

### 5.3 Waste Logging
Endpoints:
- POST `/api/v1/waste/voice-log` (parse: ingredient + quantity + reason)
- POST `/api/v1/waste/prep-factors` (CRUD create/update factors) – minimal update
- GET  `/api/v1/waste/cost-impact?restaurantId=...&range=7d`

### 5.4 Manual Overrides & Learning v1
Endpoints:
- POST `/api/v1/overrides/log` (store override)
- POST `/api/v1/overrides/apply` (persist new value + log)
Integration:
- AgentManager checks in-memory override cache (warm from DB on boot; TTL refresh)
- Learning v1: frequency tally – if > threshold, surface suggestion metadata in responses.

### 5.5 Cost Optimization & Substitution (Foundation)
Endpoints:
- POST `/api/v1/recipes/:id/suggest-substitutions` (query ingredient_substitutions + recent price deltas)
- GET  `/api/v1/recipes/:id/price-monitoring` (aggregate price history + margin impact)

Algorithm (phase 1): rule-based scoring = cost_savings_pct * quality_impact_score * flavor_score.

### 5.6 Shared Utilities
- parsers/voiceParser.js (stub returning canned transcript if dev flag) 
- parsers/ocrParser.js
- services/scalingService.js
- services/allergenService.js
- services/substitutionService.js
- services/overrideService.js
- services/priceTrendService.js

### 5.7 Feature Flags
Util: `src/config/featureFlags.js` – sources SSM (production) or ENV fallback.
Flags:
- RECIPE_AGENT_ENABLED
- INVOICE_AGENT_ENABLED
- WASTE_LOGGING_ENABLED
- COST_SUBSTITUTION_ENABLED
- OVERRIDES_ENABLED

Middleware: reject endpoint if flag false (404 to avoid early discovery).

---
## 6. Frontend Implementation Outline
New Slices:
- recipeCaptureSlice
- invoiceProcessingSlice
- wasteSlice
- overridesSlice (lightweight – track pending + applied)

Components (proposed directory: `frontend/src/components/ops/`):
- VoiceRecipeCapture.jsx
- OCRRecipeUpload.jsx
- InvoiceScanPanel.jsx
- WasteQuickLog.jsx
- RecipeScalingPanel.jsx
- SubstitutionSuggestions.jsx
- PriceMonitoringCard.jsx

Hooks:
- useVoiceRecorder (MediaRecorder abstraction)
- useImageCapture (file input + camera fallback)

Routing: Add new Ops tab or integrate into existing dashboard (decision pending UX). Feature-flag conditional rendering.

---
## 7. Testing Strategy
| Layer | Focus | Tools |
|-------|-------|-------|
| Unit | Scaling math, allergen, substitution scoring, trend calc | Jest | 
| Integration | New endpoints with mock adapters | Jest + Supertest |
| Frontend Unit | Component render & state transitions | Vitest + RTL |
| Frontend Integration | Voice/OCR flows (mock adapters) | Vitest |
| Data | Migrations apply & rollback smoke test | Jest script |
| Performance (Light) | Substitution endpoint latency under fixture load | Jest timing |

Test Cases (Representative):
- Scaling: "for 50" vs base servings; "use 5 lbs chicken" partial scale
- Allergen detection for mixed recipe with nut/dairy
- Invoice scan low confidence triggers review status
- Override applied appears in subsequent agent response
- Substitution: cost savings threshold filtering
- Waste logging: cost impact aggregated matches expected formula

---
## 8. Security & Compliance Checklist (Phase 8 Scope)
| Item | Action |
|------|--------|
| File upload validation | MIME + size cap (config) |
| EXIF stripping | Use sharp / exif removal on images |
| Rate limiting | Basic in-memory limiter for OCR/voice routes |
| Input sanitization | Central validate + escape user-provided text |
| Auth coverage | Reuse existing JWT middleware on all new routes |
| Logging hygiene | No raw OCR text in INFO logs (only doc id + confidence) |
| Secrets | No API keys hardcoded; stub services behind interfaces |

---
## 9. Observability
- Structured log fields: `feature`, `agent`, `latency_ms`, `flag_state`
- Add `/metrics` (JSON) minimal: counts per endpoint, avg latency (in-memory accumulator) – future Prometheus adapter placeholder
- Error classification counters (validation_error, external_service_error, override_applied)

---
## 10. Performance Expectations (Phase 1 Targets)
| Operation | Target |
|-----------|--------|
| Recipe voice parse (stub) | < 300ms server-side |
| OCR parse (stub) | < 500ms |
| Substitution suggestion | < 250ms for ≤ 20 ingredients |
| Price monitoring | < 400ms for 30-day history |

---
## 11. Weekly Timeline (6 Weeks)
Week 1: Migrations + models + feature flags + RecipeAgent scaffold + scaling/allergen service tests
Week 2: InvoiceAgent scaffold + invoice endpoints + price history + frontend capture components
Week 3: Finish RecipeAgent matching + allergen endpoint + waste logging backend + initial frontend recipe UI
Week 4: Overrides system + integration with agents + waste UI + substitution service core
Week 5: Substitution + price monitoring endpoints + frontend substitution + invoice trend chart + perf pass
Week 6: Hardening (security, tests coverage bump, /metrics, docs update, readiness review)

Stretch (if ahead): start Smart Recipe Generation base tables (compatibility + templates)—flagged off.

---
## 12. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema sprawl | Slows delivery | Freeze after Week 1; change control note |
| External service delay | Blocks voice/OCR | Stub abstraction complete before integration |
| Performance regressions | User latency | Add lightweight perf tests Week 5 |
| Override complexity creep | Schedule slip | Limit to frequency-based suggestions v1 |
| Test flakiness (media) | CI instability | Deterministic mocks – no real media in unit tests |
| Data quality (ingredient match) | Incorrect costing | Implement confidence score + manual fallback |
| Security gaps in uploads | Attack surface | Early validation middleware (Week 1) |
| Forecast side effects | Wrong projections | Shadow mode integration first (flag) |

---
## 13. Decision Points (Need Principal Input)
1. Add recipe versioning now? (Recommend DEFER)  
2. Unify substitution tables vs dual (Recommend UNIFY)  
3. Adopt TypeScript incrementally for new backend modules? (Recommend DEFER until Phase 9)  
4. Implement `/metrics` JSON now? (Recommend YES minimal)  
5. Source flags via SSM vs env? (Recommend SSM for runtime toggles)  

Provide guidance; will incorporate before migrations locked.

---
## 14. Immediate Next Actions (Post-Approval)
1. Implement migrations + models (recipes, recipe_ingredients, waste_logs, invoice_documents, supplier_price_history, manual_overrides, ingredient_substitutions, prep_waste_factors)
2. Feature flag utility + env mapping
3. Stub services (voiceParser, ocrParser) with deterministic outputs
4. Scaling + allergen service unit tests
5. RecipeAgent scaffold + route stubs (flag gated, integration tests pending)

---
## 15. Quality Gates for Each Merge
- Lint: `npm run lint` (0 errors)
- Tests: Added/updated tests all passing
- Build: Frontend & backend production builds succeed
- Docs: Endpoint list updated if new public route
- Security: New inputs validated + authenticated

---
## 16. Completion Definition (Phase 8 Done)
- All planned endpoints functional & documented
- Feature flags toggled on in staging, off by default in prod
- Test coverage ≥ baseline + delta for new logic (no uncovered critical paths)
- No open P1/P2 bugs in new features
- Performance targets met or exceptions documented
- Deployment pipeline updated for new migrations

---
## 17. Future (Out-of-Scope This Phase)
- Smart Recipe Generation AI engine (full)  
- Real supplier API connectors  
- Advanced ML-driven override learning  
- Vector similarity ingredient search  
- Real-time websocket updates  
- Full recipe versioning & audit trails  

---
## 18. Tracking Template (Add to TODO.md After Approval)
```
### Phase 8: Dave V1 Enablement
- [ ] Week1: Migrations & Flags
- [ ] RecipeAgent Scaffold
- [ ] InvoiceAgent Scaffold
- [ ] Waste Logging Backend
- [ ] Overrides System v1
- [ ] Substitution Endpoints
- [ ] Frontend Capture UI
- [ ] Price Monitoring UI
- [ ] Security & Upload Validation
- [ ] /metrics Endpoint
- [ ] Final Hardening & Docs
```

---
## 19. Notes for Executor (Myself)
- Keep patches tight; avoid unrelated formatting
- After each major file creation (>3 files) pause & checkpoint
- Ask for Principal decision before locking schema or implementing advanced caching
- Re-read CLAUDE.md if context drift detected

---
**Prepared for Principal review. Awaiting decisions on Section 13 before executing migrations.**
