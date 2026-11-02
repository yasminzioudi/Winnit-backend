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
npm test               # Jest unit tests (88 tests pass)
npm run test:e2e       # Supertest e2e tests (23 tests pass, winnit_test DB)
npx tsc --noEmit       # Type check
npm run seed           # Seed ws_maison_ambre with 40 orders (idempotent)
npm run db:indexes     # Create all indexes (run on dev and test DBs)
```

## Phase Progress

- ✅ Phase 0: Architecture design, golden fixture structure, 27 endpoints planned
- ✅ Phase 1: Backend foundation (config, mongo, tenancy, health, catalog, common layer, Swagger, e2e skeleton, drift guard)
- ✅ Phase 2: 6 domain modules with 64 passing tests, golden fixture contracts, frontend reconciliation
- ✅ Phase 3a: Orders CRUD module proven (schema, repo, service, controller, unit tests, e2e tests, seed, indexes)

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
