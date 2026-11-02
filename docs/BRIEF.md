# WINNIT OS: PROFIT OS BRIEF (v3.1, condensed)

## Mission

Profit OS module of WINNIT OS, an e-commerce back-office for a Tunisian merchant (cash on delivery, TND, couriers Aramex/Yalidine). Backend NestJS + MongoDB, frontend Next.js 16 (existing shell and design system, extend, never restyle).

IN SCOPE: CRUD for orders, ad spend, fixed expenses, pricing scenarios, courier COD settlements; analytics and statistics; winning-products ranking; pricing optimizer; COD reconciliation; rule-based insights; reports (PDF, CSV, XLSX); PWA (manifest + hand-written Service Worker + offline outbox); Web Workers.

OUT OF SCOPE: products CRUD (teammate; use the mock read-only catalog behind ProductCatalogPort), real auth (mock frontend auth, backend DevTenantGuard via x-workspace-id), other sidebar modules, any LLM call (AI later: interfaces only: InsightsProvider, FinancialSnapshot DTO without personal data, empty ai/ module).

## Environment rules

Folder integration/ with winnit-frontend (Next 16.4, React 19, Tailwind 4 via turbopack.rules, do not touch) and winnit-backend (NestJS 12, CommonJS, TS 6, Jest 30, oxlint, Mongoose 9). MongoDB 7 standalone on 127.0.0.1:27017, no replica set, no transactions; databases winnit (dev) and winnit_test (tests). No new packages, no npm install/ci/update/audit fix (slow network, disk ~97% full). Ports: backend 4000 (user's dev server, never kill it; use PORT=4010), frontend 3000. API prefix /api/v1; frontend reaches it through a Next rewrite /api/v1/:path* to BACKEND_URL. next.config.ts: only rewrites() may be added. npm run build may panic in the agent sandbox (Tailwind via Turbopack): validate with lint, tsc, tests and ask the user to run npm run build.

## Conventions

Money is INTEGER MILLIMES (1 TND = 1000), fields end with Millimes; rates 0..1; convert at the UI edge only (lib/format, displayed like "16 420 TND"). Dates ISO UTC, bucketing in Africa/Tunis. Errors RFC 7807 problem+json. Every document and query has workspaceId; every index starts with workspaceId. Soft delete (deletedAt), version for optimistic concurrency (409), Idempotency-Key on POST. Pagination: cursor for orders (limit<=100), page-based for small lists. Never log customer name/phone.

## Domain

Order: orderNumber ORD-n (atomic per-workspace counter), productId + productNameSnapshot, quantity, unitPrice, unitCogs, shipping, returnShipping, courierFee, adCpa, courier (aramex|yalidine|other), customer {firstName, city, governorate}, status, statusHistory, placedAt, deliveredAt, settlementId, netContributionMillimes (recomputed on every write).

State machine: pending->confirmed|cancelled; confirmed->shipped|cancelled; shipped->delivered|refused; delivered/refused terminal (refused->delivered only via audited reopen); illegal move = 422.

AdSpendEntry (platform meta|tiktok|google|snapchat|other, campaign, productId?, amount), Expense (category, label, amount, recurrence none|monthly expanded in analytics), Scenario (inputs, outputsSnapshot, pinned), Settlement (courier, reference, period, orderIds, gross, commission, net, status pending|settled), ReportRecord (metadata only).

## Finance rules (pure functions in domain/, the only place for formulas)

Per unit: logistics = shipping + packaging + fees. maxTolerableCPA = price - COGS - logistics. breakEvenROAS = price / maxTolerableCPA. netProfitPerUnit = price - COGS - logistics - CPA - refusalRate*CPA. Calibration: price 129, COGS 28, logistics 14, CPA 22, refusal 21% -> maxCPA 87.0, breakEvenROAS 1.48, netProfitPerUnit 60.4.

Per order: delivered net = price*qty - COGS*qty - shipping - courierFee - adCpa. Refused net = -(shipping + returnShipping + adCpa).

Realized = delivered + refused; projected = confirmed + shipped; pending/cancelled excluded.

Waterfall (realized only, steps sum exactly): 1 grossRevenue, 2 productCogs, 3 outboundShipping (shipping + courier fees of delivered), 4 paidAdSpend (actual AdSpendEntry sum), 5 codRefusalPenalty (shipping + returnShipping of refused), 6 netRealizedContribution = 1-2-3-4-5, pct = 6/1. resultAfterFixedExpenses = 6 - expenses. Identity: waterfallNet = ledgerNet(realized) - adSpendDelta, adSpendDelta = actualAdSpend - sum of allocated adCpa (show "dépenses publicitaires non attribuées" in the UI).

COD: pendingPayouts = sum(price*qty - courierFee) of delivered orders not in a settled settlement; expectedCashCollections = settledNet + pendingPayouts. POST /settlements/:id/reconcile is idempotent and crash-recoverable without transactions.

Winners score 0..100: net margin 40, delivery rate 25, ROAS vs break-even 20, 30-day volume trend 15. Under 20 orders: "données insuffisantes", never ranked. Labels: >=75 Winner, 50-74 À surveiller, <50 À couper.

Pricing optimizer: break-even price, target-margin price, recommended band, profit-vs-price curve with editable elasticity (default -1.5) and refusal sensitivity; optimum must equal the argmax of the returned curve; always labelled "modèle basé sur vos hypothèses".

Insights: rule-based InsightsProvider (refusal rate per courier/governorate, ROAS below break-even, ad spend vs revenue trend, product losing money after refusals, pending payouts older than 14 days), each with severity, title, evidence, suggested action, deep link.

## API (/api/v1, workspace-scoped)

/products (mock catalog) | /orders (+status, bulk-status, reopen) | /ad-spend | /expenses | /scenarios (+duplicate) | /settlements (+reconcile) | /analytics/summary, timeseries (granularity day|week|month, aliases daily|weekly), by-product, by-courier, by-governorate, cod, winners | /insights | POST /pricing/optimize | POST /reports, GET /reports, GET /reports/:id/download?format=pdf|csv | /health/live, /health/ready. Analytics: aggregation pipelines, $facet, 60 s workspace cache invalidated on writes, ETag/304.

## Frontend pages (real API only; period and filters in URL searchParams; useSearchParams inside Suspense; French UI, English code)

- /dashboard/profit-os: period picker (7j/30j/90j/mois), KPI tiles with count-up, animated six-step waterfall + net %, unattributed ad spend, revenue/profit trend (recharts, lazy), insights strip, mini winners leaderboard, COD cash status.

- /orders: ledger, filters (status, courier, governorate, product, date), search, cursor pagination, create/edit drawer (bottom sheet on mobile) with LIVE net preview via lib/finance, optimistic status change, bulk status, soft delete with undo toast, status timeline, product picker from /products.

- /costs: tabs "Publicité" and "Charges fixes", CRUD, ROAS per platform/product vs break-even, monthly expense summary.

- /cod: expected/settled/pending cards, aging, settlements list + create, "Réconcilier" with confirmation and optimistic update, courier and governorate breakdown (bars, no external map).

- /winners (podium, ranked table, score ring, why-this-score), /simulator (4 sliders, 3 live tiles, profit-vs-price curve, canvas sensitivity heatmap, elasticity, save/compare up to 3 scenarios, math via Web Worker using the same pure functions), /reports (generate, history, download PDF/CSV/XLSX).

- TanStack Query for server state; types generated from the backend OpenAPI (api:types script); shared golden fixture integration/contracts/finance-golden.json used by backend (Jest) and frontend (node:test) with drift guards.

## Reports and workers

PDF server-side with pdfmake 0.3 (Roboto TTFs registered explicitly, French accents verified; semaphore of 2, throttle 20/min; aggregate in Mongo, never load all documents). CSV streamed, RFC 4180, UTF-8 BOM. XLSX built client-side in the Web Worker with the installed xlsx package (sheets Summary/Orders/Ad spend/Expenses/Winners/COD). Worker tasks: priceCurve, sensitivityGrid, scenarioCompare, exportXlsx, exportCsv; typed protocol with request ids, cancellation, main-thread fallback.

## PWA (hand-written, no Serwist/Workbox)

app/manifest.ts (id, name WINNIT OS, short_name WINNIT, lang fr, start_url /dashboard/profit-os?source=pwa, scope /, standalone, theme colors from tokens, icons 192/512 any + maskable, shortcuts). Icons generated with a Node script using only built-in modules. public/sw.js with versioned caches, cleanup on activate, no automatic skipWaiting; navigations Network First with app-shell then /offline.html fallback; /_next/static and fonts/images Cache First; GET analytics/orders/products/scenarios/settlements Stale-While-Revalidate (workspace id in cache key, max 60 entries, 24 h TTL, purged on CLEAR_USER_CACHES); never cache non-GET, /reports, auth, Authorization requests. Offline outbox in IndexedDB with Idempotency-Key, replayed in order via Background Sync (tag winnit-outbox) or the online event; "En attente de synchronisation" chips; conflict sheet on 409/422; update toast "Nouvelle version disponible: Recharger". components/RegisterSW.tsx registers in production only. Install card (beforeinstallprompt), iOS Safari hint, online/offline pill.

## Non-functional requirements

API p95 under 200 ms for /analytics/summary with 10 000 orders (measured cold, cache bypassed, with explain() evidence; temporary dataset in winnit_test only, removed afterwards). Lighthouse mobile >= 90; LCP < 2.5 s, INP < 200 ms, CLS < 0.1; route-level code splitting. Security: helmet, compression, CORS allow-list, throttler (120/min default), 100 kb body limit, strict DTO validation, allow-listed sort fields, query keys starting with "$" rejected, no stack traces in production, secrets from env. Reliability: graceful shutdown, health checks, idempotent writes, retry/backoff and timeout in the frontend client. Scalability: stateless API, tenant-first indexes, CacheService / ProductCatalogPort / InsightsProvider / TenantResolver interfaces. Testing: Jest unit + supertest e2e against winnit_test, node:test for lib/finance on the shared fixture.

## Phases

0 audit, 1 backend foundation, 2 domain + golden fixture, 3 CRUD, 4 analytics/insights/pricing/performance (all done), 5 frontend foundation, 6 orders/costs/COD/dashboard pages, 7 winners + simulator, 8 reports, 9 PWA, 10 hardening and README. One batch per run, one stop at the end, commit "phase N: ...".
