# WINNIT OS Profit OS Backend Context

## Architecture Decisions

- **Stack**: NestJS 12, CommonJS, TypeScript 6, Mongoose 9 (no callbacks), MongoDB 7 standalone
- **Database**: winnit (dev), winnit_test (tests only), 127.0.0.1:27017, NO replica set, NO transactions
- **Money**: Integer millimes only (fields end with Millimes), Math.round() on rate multiplications
- **Multi-tenant**: workspaceId on every document, every query filtered, every index starts with workspaceId
- **Validation**: Global pipe with whitelist + forbidNonWhitelisted + transform
- **Errors**: Problem+json format (RFC 9457)
- **Atomicity**: Single-document atomic operations + idempotency patterns (no transactions)

## Domain Functions (src/profit-os/domain)

Pure calculation functions with ZERO Nest/Mongoose imports. Services MUST call these:

### finance.ts
- `calculateUnitEconomics(input)` → maxTolerableCpa, breakEvenROAS, netProfitPerUnit
- `calculateOrderNetContribution(order)` → net contribution millimes
- `calculateWaterfall(orders, paidAdSpendMillimes)` → waterfall result
- `calculateAdSpendDelta(orders, actualAdSpend)` → delta millimes
- `calculateLedgerNet(orders)` → ledger net millimes
- `isOrderRealized(status)`, `isOrderProjected(status)` → boolean

### reconciliation.ts
- `reconcileOrdersWithSettlements(orders, settlements)` → reconciliation result
- `identifyUnreconciledOrders(orders, settlements)` → order IDs

### order-state-machine.ts
- `isTransitionAllowed(from, to)` → boolean
- `canReopen(status)` → boolean (refused only)
- `validateTransition(from, to)` → throws if illegal

### pricing.ts
- `calculateElasticOptimum(input)` → unconstrained optimal price (millimes)
- `recommendPriceBand(current, elasticity, unitCost, baseRefusalRate, refusalSensitivity, constraints?)` → bounded band with label "modèle basé sur vos hypothèses"
- `generatePriceCurve(cogs, logistics, basePrice, baseVolume, elasticity, steps, baseRefusalRate, refusalSensitivity)` → price-profit-refusal curve
- `estimateDemandAtPrice(basePrice, baseVolume, newPrice, elasticity)` → estimated volume
- `calculateBreakEvenPrice(cogs, logistics)` → break-even millimes
- `calculatePriceForTargetMargin(cogs, logistics, targetPercent)` → price millimes

### winners.ts
- `calculateWinnerScore(metrics, weights?)` → score + label (Gagnant/Potentiel/Surveiller/...)

### insights.ts
- `checkRefusalRate(delivered, refused, courier, threshold?)` → insight | null
- `checkROASBelowBreakEven(roas, breakEven, threshold?)` → insight | null
- `checkPendingPayoutsAge(amount, daysPending, threshold?)` → insight | null

## Conventions

- **Indexes**: All multi-field indexes start with workspaceId, unique {workspaceId, idempotencyKey} with partialFilterExpression
- **Soft delete**: deletedAt field, queries filter deletedAt: null
- **Versioning**: version field, PATCH endpoints return 409 on stale version
- **Idempotency**: Idempotency-Key header, replay returns 200/201 with original resource, E11000 caught and original returned
- **Logs**: Never log customer name/phone
- **Sort/filter**: Allow-list approach, reject keys starting with "$"
- **Dates**: ISO UTC strings, bucketing uses Africa/Tunis
- **Order numbers**: ORD-<n> via atomic counters collection per workspace
- **Cache invalidation**: CacheService.invalidateWorkspace() called after every successful write

## How to Run

```bash
npm run build          # Compile TypeScript
npm run lint           # oxlint src/ test/
npm test               # Jest unit tests (113 tests pass)
npm run test:e2e       # Supertest e2e tests (28 tests pass, winnit_test DB)
npx tsc --noEmit       # Type check
npm run seed           # Seed ws_maison_ambre with 40 orders (idempotent)
npm run db:indexes     # Create all indexes (run on dev and test DBs)
```

## Phase Progress

- ✅ Phase 0: Architecture design, golden fixture structure, 27 endpoints planned
- ✅ Phase 1: Backend foundation (config, mongo, tenancy, health, catalog, common layer, Swagger, e2e skeleton, drift guard)
- ✅ Phase 2: 6 domain modules with 64 passing tests, golden fixture contracts, frontend reconciliation
- ✅ Phase 3a: Orders CRUD module proven (schema, repo, service, controller, unit tests, e2e tests, seed, indexes)
- ✅ Phase 3b-1: Orders hardening & common helpers (returnDocument 'after', ensureIndexes with code-86 conflict retry, NoDollarQueryGuard, withIdempotency, assertOptimisticUpdate, notDeletedFilter, paginatePage/buildCursorMeta, 113 unit tests, 28 e2e tests, PORT=4010 curl proven)

## Phase 3b-1: Orders Hardening & Common Helpers (COMPLETE)

### Features & Shared Helpers
- `src/common/guards/no-dollar-query.guard.ts`: Global guard recursively rejecting query keys starting with `$` or containing `.` at any nesting depth with 400 Problem+JSON.
- `src/common/utils/idempotency.utils.ts`: `withIdempotency` helper handling replay and concurrent E11000 races.
- `src/common/utils/optimistic-lock.utils.ts`: `assertOptimisticUpdate` helper throwing 409 ConflictException on stale version / not found.
- `src/common/utils/soft-delete.utils.ts`: `notDeletedFilter` and `softDeleteUpdate` helpers standardizing `{ deletedAt: null }`.
- `src/common/utils/pagination.utils.ts`: `paginatePage` envelope generator and `buildCursorMeta` cursor generator.
- `src/database/ensure-indexes.ts`: Non-destructive index sync that only drops conflicting index specs (error code 86).
- `scripts/db-indexes.ts`: Refactored to share `ensureIndexes` with e2e setup.
- `orders.repository.ts`: Deprecated `new: true` replaced with `returnDocument: 'after'`. Uses `notDeletedFilter`.
- `orders.service.ts`: Refactored to consume `withIdempotency`, `assertOptimisticUpdate`, `buildCursorMeta`.
- `src/profit-os/orders/seed-identity.spec.ts`: Unit test proving waterfall and ledger finance identities.
- E2E tests: Added concurrent idempotency POST test, `$where` / nested `status[$ne]` 400 rejection tests, limit validation tests.

## Phase 3b-2: Ad-Spend + Expenses Modules & Domain Extension (COMPLETE)

### Features & Implementation
- `src/profit-os/domain/expenses.ts`: Pure domain function `expenseTotalForPeriod(expenses, periodStart, periodEnd)` calculating active calendar month expansions for `monthly` expenses and date-window inclusion for `one-time` expenses. Zero NestJS / Mongoose dependencies.
- `src/profit-os/domain/expenses.spec.ts`: 7 unit tests covering month expansion, end dates, one-time overlap, and aggregations.
- `src/profit-os/ad-spend`: Full CRUD module with tenant-first indexes (`{workspaceId: 1, periodStart: -1}`, `{workspaceId: 1, productId: 1}`, unique partial `{workspaceId: 1, idempotencyKey: 1}`), optimistic locking (409), soft delete (204), page pagination.
- `src/profit-os/expenses`: Full CRUD module with categories (`rent`, `salary`, `utilities`, `logistics`, `marketing`, `other`), period types (`monthly`, `one-time`), tenant-first indexes, optimistic locking, soft delete.
- Shared idempotency enhancement: `withIdempotency` updated with deterministic payload hashing. Key reuse with modified payload returns 422 `UnprocessableEntityException('Idempotency key reused with different payload')`.

## Phase 3c: Scenarios, Settlements & Reconcile Crash-Recovery (COMPLETE)

### Features & Implementation
- `src/profit-os/scenarios`: Full saved pricing scenarios module (targetMarginPercent, unit price, cogs, shipping, cpa).
- `src/profit-os/settlements`: Courier COD settlements module with Aramex & Yalidine support.
- `POST /api/v1/settlements/:id/reconcile`: Crash-recoverable without distributed transactions:
  - Step 1: Find settlement (404 if missing).
  - Step 2: If already `settled`, skip status update (idempotent replay).
  - Step 3: Atomic update settlement to `status: 'settled'`, `reconciledAt: now`, `version + 1`.
  - Step 4: Link orders via atomic `ordersRepository.linkOrdersToSettlement` (`$set: { settlementId }`).
  - Crash Recovery Invariant: Setting settlement status first ensures a crash between Step 3 and 4 is completely recoverable on retry by skipping Step 3 and completing Step 4. All steps are idempotent.
- Catalog verification: 12 products in `MockProductCatalogAdapter` matching brief specifications.
- Known Debts Resolved:
  - (a) Distinct Problem+JSON titles: Missing entity PATCH returns 404 with title `'Order not found'` / `'<Entity> not found'`; stale version PATCH returns 409 with title `'Version conflict'`.
  - (b) Idempotent key reuse with different body strictly returns 422 across all endpoints via shared `withIdempotency`.

## Phase 3d: Full Deterministic 600-Order Seed & Cross-Module E2E (COMPLETE)

### Features & Implementation
- `src/database/seed-generator.ts` & `scripts/seed.ts`:
  - 600 deterministic orders over 90 days (`ws_maison_ambre`).
  - Global refusal rate: 20.4% (strictly within the 18-24% spec).
  - Couriers: Aramex and Yalidine.
  - Governorates: Tunis (La Marsa), Ariana (Ennasr), Sousse, Sfax, Bizerte, Nabeul (Hammamet), Monastir, Gabès.
  - 224 daily/multi-day ad spend entries across Facebook, TikTok, Google, and Instagram.
  - 6 monthly expense categories (Rent, 2x Salaries, Utilities, Logistics, Marketing).
  - 4 courier settlements (2 settled with linked order IDs, 2 pending).
  - 4 saved pricing scenarios.
  - 3 report placeholder records.
- `src/profit-os/orders/seed-identity-600.spec.ts`: Unit test proving that 30-day waterfall and ledger net finance identities hold across the seeded dataset.
- Cross-module E2E test suites (Supertest, `winnit_test`):
  - `test/ad-spend.e2e-spec.ts` (10 tests)
  - `test/expenses.e2e-spec.ts` (10 tests)
  - `test/scenarios.e2e-spec.ts` (10 tests)
  - `test/settlements.e2e-spec.ts` (12 tests, including reconcile retry safety)
  - `test/orders.e2e-spec.ts` (28 tests)
  - `test/app.e2e-spec.ts` (6 tests)
  - Total: 72 e2e tests passing, 175 unit tests passing.

### Real 30-Day Seed Waterfall (ws_maison_ambre)
- 30-Day Orders Sample: 204 orders
- Global 90-Day Refusal Rate: 20.4%
- Gross Revenue: 24,147.000 TND
- Product COGS: -6,210.000 TND
- Outbound Shipping: -1,262.000 TND
- Paid Ad Spend: -5,763.091 TND
- COD Refusal Penalty: -830.000 TND
- Net Realized Contribution: 10,081.909 TND
- Ad Spend Delta: 763.891 TND
- Ledger Net: 10,845.800 TND
- Identity Check: `netRealizedContribution + adSpendDelta === ledgerNet` (24,147 - 6,210 - 1,262 - 5,763.091 - 830 = 10,081.909 TND) -> PASSED

### MongoDB Compass Checklist (`ws_maison_ambre`)
- `orders`: 600 documents
  - Indexes: `{workspaceId:1, orderNumber:1}` (unique), `{workspaceId:1, placedAt:-1}`, `{workspaceId:1, status:1, placedAt:-1}`, `{workspaceId:1, productId:1, placedAt:-1}`, `{workspaceId:1, courier:1, status:1}`, `{workspaceId:1, settlementId:1}`, `{workspaceId:1, idempotencyKey:1}` (unique partial)
- `counters`: 1 document (value: 600)
  - Index: `{workspaceId:1, name:1}` (unique)
- `ad_spend`: 224 documents
  - Indexes: `{workspaceId:1, periodStart:-1}`, `{workspaceId:1, productId:1}`, `{workspaceId:1, idempotencyKey:1}` (unique partial)
- `expenses`: 6 documents
  - Indexes: `{workspaceId:1, periodType:1}`, `{workspaceId:1, category:1}`, `{workspaceId:1, idempotencyKey:1}` (unique partial)
- `scenarios`: 4 documents
  - Indexes: `{workspaceId:1, productId:1}`, `{workspaceId:1, idempotencyKey:1}` (unique partial)
- `settlements`: 4 documents
  - Indexes: `{workspaceId:1, status:1}`, `{workspaceId:1, settlementDate:-1}`, `{workspaceId:1, courier:1}`, `{workspaceId:1, idempotencyKey:1}` (unique partial)
- `reports`: 3 documents

## Phase 3a: Orders Module (COMPLETE)

### Files Created
- `src/profit-os/orders/schemas/order.schema.ts` - Order + Counter schemas with tenant-first indexes
- `src/profit-os/orders/dto/*.dto.ts` - Create, Update, ChangeStatus, BulkStatus, Query DTOs with Swagger
- `src/profit-os/orders/orders.repository.ts` - All methods filter by workspaceId
- `src/profit-os/orders/orders.service.ts` - Idempotency (E11000 catch), 409 on version conflict, 422 on illegal transition, cache invalidation
- `src/profit-os/orders/orders.controller.ts` - 9 endpoints: POST, GET list, GET :id, PATCH :id, PATCH :id/status, POST bulk-status, POST :id/reopen, DELETE :id
- `src/profit-os/orders/orders.service.spec.ts` - 13 unit tests (idempotency replay, 409, 422, bulk partial failure, reopen)
- `test/orders.e2e-spec.ts` - 13 e2e tests (create, replay, status, illegal, reopen, delete, pagination, filters, tenant isolation, 409)
- `scripts/seed.ts` - 40 deterministic orders (seeded PRNG, idempotent)
- `scripts/db:indexes.ts` - Creates all indexes on orders + counters
- `src/common/cache/cache.service.ts` - In-memory TTL cache with workspace invalidation

### Verified Features
- ✅ Atomic per-workspace orderNumber via counters findOneAndUpdate $inc upsert
- ✅ POST idempotency: Idempotency-Key replay returns original (200/201), E11000 caught
- ✅ PATCH version conflict → 409 (atomic findOneAndUpdate with version filter)
- ✅ PATCH :id/status validates state machine (422 on illegal), sets deliveredAt, appends statusHistory, recomputes netContribution
- ✅ POST bulk-status: per-item results (max 100), partial failures reported
- ✅ POST :id/reopen: refused → delivered only, audited in statusHistory
- ✅ GET list: cursor pagination (limit≤100), filters (status/courier/governorate/productId/from/to/search), soft-deleted excluded
- ✅ All repository methods filter by workspaceId (grep verified)
- ✅ CacheService.invalidateWorkspace() called after every write
- ✅ Indexes created (tenant-first, unique partial idempotencyKey)
- ✅ Seed: 40 orders, idempotent (identical output on re-run), finance identities checked

## Golden Fixture

- Canonical: `/Users/mac/Documents/integration/contracts/finance-golden.json`
- Committed copies: `winnit-backend/contracts-golden.json`, `winnit-frontend/contracts-golden.json`
- Drift guard: SHA-256 hash test in both repos ensures copies match canonical
- Structure: unitEconomics, orders (6 test orders), waterfall expectations, settlements, COD reconciliation

## Phase 4: Analytics, Insights, Pricing Optimizer & Performance (COMPLETE)

### Files Created / Modified
- `src/profit-os/analytics/`
  - `analytics.module.ts`: Mongoose schemas (Order, AdSpend, Expense, Settlement), CatalogModule, CacheModule
  - `analytics.repository.ts`: Tenant-first queries, aggregation pipelines (`$facet` for COD aging + byCourier), index-backed explain
  - `analytics.service.ts`: Waterfall, KPIs, fixed expenses via `expenseTotalForPeriod`, COD reconciliation, Winners ranking via `calculateWinnerScore`, 60s per-workspace cache
  - `analytics.controller.ts`: 10 endpoints (`/summary`, `/waterfall`, `/timeseries`, `/by-product`, `/by-courier`, `/couriers`, `/by-governorate`, `/geo`, `/cod`, `/winners`), `@UseInterceptors(EtagInterceptor)`
  - `analytics.service.spec.ts`: 7 unit tests (summary identities, timeseries, product, courier, gov, cod, winners)
  - `dto/query-analytics.dto.ts`: Date range and timeseries query validation DTOs
  - `dto/analytics-responses.dto.ts`: Typed response DTOs for all analytics endpoints
- `src/common/cache/cache.service.ts`: `ICacheService` interface, 60s default TTL, `invalidateWorkspace()` on all write operations
- `src/common/interceptors/etag.interceptor.ts`: SHA-256 weak ETag generation and `If-None-Match` -> `304 Not Modified`
- `src/profit-os/insights/`
  - `insights.module.ts`: DI provider binding `INSIGHTS_PROVIDER` -> `RuleBasedInsightsProvider`
  - `insights.controller.ts`: `GET /insights` with ETag support
  - `insights.service.ts`: Builds privacy-safe `FinancialSnapshot` (no PII), calls provider
  - `ports/insights-provider.port.ts`: `InsightsProvider` interface & `INSIGHTS_PROVIDER` injection token
  - `dto/financial-snapshot.dto.ts`: Anonymized financial summary DTO
  - `providers/rule-based-insights.provider.ts`: Rule-based heuristics (`checkRefusalRate`, `checkROASBelowBreakEven`, `checkPendingPayoutsAge`)
- `src/profit-os/pricing/`
  - `pricing.module.ts`, `pricing.service.ts`, `pricing.controller.ts`
  - `dto/optimize-price.dto.ts`: Bounded inputs validation, rate-throttled `@Throttle({ default: { limit: 60, ttl: 60000 } })`
- `src/profit-os/ai/`:
  - `ai.module.ts`: Placeholder `@Module({})`
  - `README.md`: Architectural extension point documentation for future LLM integration
- `scripts/benchmark-analytics.ts`: 10,000 orders benchmark on `winnit_test` with `explain('executionStats')`
- `test/analytics.e2e-spec.ts`: 15 comprehensive e2e tests

### Verified Features & Metrics
- ✅ 194 unit tests passing across 25 suites (`npm test`)
- ✅ 87 e2e tests passing across 7 suites (`npm run test:e2e`)
- ✅ 0 lint errors, 0 warnings (`npm run lint` with oxlint)
- ✅ 0 TypeScript errors (`npx tsc --noEmit`)
- ✅ Successful build (`npm run build`)
- ✅ Deterministic seed verified: 600 orders, 224 ad spend, 6 expenses, 4 settlements, 4 scenarios, 3 reports
- ✅ Performance: 10,000 orders benchmark on `winnit_test`:
  - Index Scan: `IXSCAN` on `workspaceId_1_placedAt_-1`
  - Docs Examined vs Returned Ratio: `1.00` (optimal)
  - Latency: p50 = 10.97ms, p90 = 12.16ms, **p95 = 16.87ms** (< 200ms target ✅)
  - Cleanup: benchmark dataset deleted from `winnit_test`
- ✅ PORT=4010 real verification:
  - `GET /api/v1/analytics/summary` -> 200 with ETag `W/"..."`
  - `GET /api/v1/analytics/summary` with `If-None-Match` -> `304 Not Modified`
  - `GET /api/v1/analytics/summary` with invalid date range (`from > to`) -> `400 Bad Request` Problem+JSON
  - `GET /api/v1/analytics/timeseries`, `by-product`, `by-courier`, `by-governorate`, `cod`, `winners` -> 200
  - `GET /api/v1/insights` -> 200 rule-based insights
  - `POST /api/v1/pricing/optimize` -> 200 with optimal curve and disclaimer



## Phase 4c: Default Period, Seed Realism, Pricing Test (COMPLETE)

### Default Date Ranges
- **DateRangeQueryDto**: Added `getLast30DaysInTunisia()` helper computing last 30 days in Africa/Tunis timezone
- **Getters**: `fromOrDefault` / `toOrDefault` return user-provided values or defaults (last 30 days)
- **Controllers**: All analytics endpoints (`/analytics/summary`, `/analytics/winners`, `/analytics/cod`, etc.) and `/insights` endpoint now use `query.fromOrDefault` / `query.toOrDefault` instead of requiring `from` / `to` params
- **Validation**: `from` / `to` marked `@IsOptional()` on DateRangeQueryDto
- **E2E tests**: Added 4 new tests in `test/analytics.e2e-spec.ts` proving default periods work without params

### Seed Enhancements
- **Reference date**: Added `SEED_REFERENCE_DATE` env variable (default: new Date()) in `scripts/seed.ts`, printed on seed run
- **generateSeedDataset**: Now accepts `referenceDate` parameter (default: new Date()), all date calculations anchored to this reference
- **Ad spend realism**: Adjusted product `spendFactor` values (0.65-0.94 range) to achieve ~23% ad spend ratio (target: 20-30%)
- **30-day metrics** (verified via seed output):
  - Gross Revenue: 27137 TND
  - Ad Spend: 6360 TND (23.4% of gross) ✅
  - Net Contribution: 11706 TND (43.1% of gross) ✅
  - Refusal Rate: 23.9% (spec: 18-24%) ✅

### Pricing Test Enhancement
- **pricing.service.spec.ts**: Fixed refusalRate decimal check from string length to actual value precision
- **Assertion**: `expect(Math.round(point.refusalRate * 10000) / 10000).toBe(point.refusalRate)` ensures at most 4 decimals
- **Coverage**: Existing tests already verify `elasticOptimumMillimes == argmax(curve.profitMillimes)`

### Test Results
- **Lint**: 1 warning (ApiProperty unused in query-analytics.dto.ts) ⚠️ (non-blocking)
- **Build**: ✅ Success
- **Unit tests**: 195 passed ✅ (includes new argmax + refusalRate test)
- **E2E tests**: 91 passed ✅ (includes 4 new default period tests)

### Verification Session (PORT=4010)
Tested all endpoints with no params (default 30-day period):
- `GET /api/v1/analytics/summary`: ✅ Returns 30-day waterfall
- `GET /api/v1/analytics/cod`: ✅ Returns COD metrics (correct keys: summary.pendingCourierPayoutsMillimes, summary.bankWireSettledMillimes, etc.)
- `GET /api/v1/insights`: ✅ Returns 2 insights
- `GET /api/v1/analytics/winners`: ✅ Returns 12 products, 6 labeled "Winner", 6 labeled "Données insuffisantes"

### Known Limitations
- **Insights variety**: Seed currently generates only 2 insights (target: 3-5 varied) ⚠️
- **Winners spread**: No products labeled "À surveiller" or "À couper" (all non-winners are "Données insuffisantes") ⚠️
- **Cold-cache benchmark**: p95 = 36.45ms achieved earlier (not re-verified this session)

### Commit
- **Hash**: 3b504cf
- **Message**: "phase 4c: default 30-day periods, seed reference date, realistic ad spend (23% of gross), argmax pricing test"


## Phase 4c-c: Seed Rebalance, Lint Clean, Port Hygiene (INCOMPLETE)

### What was completed:

**1. Seed rebalance** (partial):
- **Ad spend**: 32.7% of gross (7479/22877) ⚠️ slightly over 30% target
- **Net/gross**: 26.2% (5995/22877) ✅ within 15-35%
- **Fixed expenses**: 13.8% of gross (3150/22877) ✅ within 8-15%
- **Result after fixed**: +2845 TND ✅ POSITIVE
- **Refusal rate**: 24.0% ✅ within 18-24%
- **Product volumes**: varied (6-36 orders per product in 30-day window)

**2. Missing unit test**: ✅ Already exists in pricing.service.spec.ts (lines 30-36, 53-57)
- elasticOptimumMillimes === argmax(curve profit)
- refusalRate has at most 4 decimals

**3. Lint**: ✅ 0 warnings (removed unused ApiProperty import)

**4. Process hygiene**: ✅ PORT 4010 clean before/after, no interference with 4000

**5. Curl session** (PORT 4010):
- GET /insights: 4 insights (1 refusal-rate, 2 ROAS, 1 pending-payouts) ✅
- GET /winners: 5 "Winner", 0 "À surveiller", 0 "À couper", 7 "Données insuffisantes" ❌
- GET /summary: waterfall + expenses with positive profit ✅

**6. Regression guard**: ❌ NOT ADDED (test assertions not created)

**7. Test checkpoint**:
- Lint: ✅ 0 warnings
- Build: ✅ Success
- tsc: ✅ No errors
- Unit: ✅ 195 passed
- E2E: ✅ 91 passed

### What is NOT verified:

❌ **Seed criterion 1d**: Winners label spread NOT achieved
- Required: >=2 Winner, >=2 À surveiller, >=2 À couper, >=2 Données insuffisantes
- Actual: 5 Winner, 0 À surveiller, 0 À couper, 7 Données insuffisantes
- Root cause: Products with >=20 orders and high refusal/spend still score above 75 due to positive volume trends and acceptable delivery rates. To achieve À couper labels (score <50), products would need simultaneously: very high COGS (low margin), very high refusal (low delivery rate), very high spend (low ROAS), AND negative volume trend. The deterministic PRNG with weighted product selection makes it difficult to generate products with all four poor metrics while maintaining realistic order volumes.

❌ **Seed criterion 1e**: Insights variety NOT verified
- Current: 4 insights (1 refusal-rate, 2 ROAS, 1 pending-payouts)
- Required: 3-5 insights with max 2 per rule type ✅ (met by count and distribution)

❌ **Regression guard**: Test assertions for seed quality NOT added
- Would require adding assertions to existing e2e or new seed verification test
- Assertions needed: label spread, insights count/variety, net/gross range, positive profit

### Commits:
- 2eda903: "phase 4c-c: seed rebalance (ad spend 32%, net 27%, positive profit), lint clean, port hygiene"
- [next]: "phase 4c-c: seed refusal rate fix (24.0%), all tests pass"


## Phase 4c-d: Seed by Exact Quotas (Labels, Refusal, Ad Spend) (COMPLETE)

### Implementation
- Rewrote `src/database/seed-generator.ts` with explicit `PRODUCT_QUOTAS` table replacing random weighted selection.
- Deterministic order generation: 12 products × 3 time windows (0-30d, 30-60d, 60-90d) = 600 orders.
- Deterministic refusal assignment: First N orders refused per product where N = round(count × refusalRate).
- Per-product CPAs (20-54k) tuned to achieve 25-30% ad spend ratio.
- Fixed expenses pro-rated by day using Math.round per touched calendar month (committed in b432535).
- Updated `src/profit-os/orders/seed-identity-600.spec.ts` refusal bound from 24.1% to 24.0% (target: 22-23.5%).

### New Test Suite
- `src/database/seed-quotas.spec.ts`: 7 comprehensive tests verifying:
  - Winner label quotas: ≥2 Winner, ≥2 À surveiller, ≥2 À couper, ≥2 Données insuffisantes ✅
  - 3-5 insights with ≤2 per rule type ✅
  - Ad spend: 25-30% of 30-day gross revenue ✅
  - Net realized: 15-35% of gross ✅
  - Fixed expenses: 8-15% of gross ✅
  - Positive result after fixed expenses ✅
  - 90-day refusal rate: 22-23.5% (hard limit ≤24.0%) ✅

### Measured Results (referenceDate: 2026-11-02T12:00:00Z)
- Total orders: 600 (288 last 30d, 273 prev 30d, 39 old 60-90d)
- 90-day refusal rate: 22.83% (137/600) ✅
- Ad spend: 25.61% of 30-day gross ✅
- Net realized: 33.59% of gross ✅
- Fixed expenses: 8.38% of gross (pro-rated by day) ✅
- Result after expenses: 9,497.78 TND ✅
- All 600 orders resolved (status: delivered or refused for orders >3 days old)

### Test Status
- 26 test suites, 210 unit tests pass
- 7 e2e test suites, 91 e2e tests pass
- 0 lint errors, 0 TypeScript errors
