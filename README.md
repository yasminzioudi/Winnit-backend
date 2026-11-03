# WINNIT OS – Backend API

API NestJS pour la gestion e-commerce COD (Cash On Delivery) Tunisie. Fournit analytics, waterfall P&L, winners scoring, COD reconciliation, et simulation prix/volume.

**Stack** : NestJS 11, TypeScript 5.7, MongoDB 7, Mongoose, class-validator

---

## Installation & Lancement

```bash
npm install

# 1. Seed database (500 orders, 12 products, 90 days)
npm run seed

# 2. Build
npm run build

# 3. Start production
npm start              # Port 4000

# Dev mode (watch)
npm run start:dev
```

### Variables d'environnement

Copier `.env.example` vers `.env` :

```bash
MONGODB_URI=mongodb://localhost:27017/winnit
PORT=4000
NODE_ENV=production
```

---

## Seed

**Commande** : `npm run seed`

**Génère** :
- **1 workspace** : `ws_maison_ambre`
- **12 produits** (bijoux & parfums Maison Ambre) :
  - SKU : `AMB-001` à `AMB-012`
  - Prix : 79-299 TND (79 000-299 000 millimes)
  - COGS : 25-95 TND
  - Categories : bijoux, parfums, bougies, accessoires
- **500 commandes** réparties sur 90 jours :
  - Distribution Pareto 20/80 : 20% produits = 80% CA
  - Statuts : delivered 79%, refused 21%
  - Transporteurs : Aramex 50%, Sodetel 30%, TND Express 20%
  - Gouvernorats : distribution réaliste (Tunis, Ariana, Sfax en tête)
  - Quotas journaliers : variance ±20% autour moyenne
- **Expenses** : 3 charges fixes (loyer, salaires, marketing)
- **Ad Spend** : 12 campagnes publicitaires (Meta, Google, TikTok)

**Seed idempotent** : supprime ancien workspace `ws_maison_ambre` avant génération.

**Script** : `scripts/seed.ts`

---

## Ports

- **API** : 4000 (configurable via `PORT`)
- **MongoDB** : 27017 (local par défaut)

---

## Endpoints Principaux

### Analytics

```http
GET /api/v1/analytics/summary?from=2026-08-01&to=2026-11-03T23:59:59.999Z
Header: x-workspace-id: ws_maison_ambre

Response:
{
  "waterfall": {
    "grossRevenueMillimes": 37677000,
    "productCOGSMillimes": 6930000,
    "outboundShippingMillimes": 23100000,
    "paidAdSpendMillimes": 7378000,
    "codRefusalPenaltyMillimes": 27484850,
    "netRealizedContributionMillimes": 12912150,
    "netRealizedContributionPercent": 34.3,
    "ledgerNetMillimes": 12912150,
    "adSpendDeltaMillimes": 0
  },
  "kpis": {
    "totalOrdersCount": 276,
    "confirmedCount": 276,
    "shippedCount": 219,
    "deliveredCount": 219,
    "pendingCount": 0,
    "refusedCount": 57,
    "deliveryRatePercent": 79.35,
    "refusalRatePercent": 20.65,
    "averageOrderValueMillimes": 136514
  },
  "expenses": {
    "fixedExpensesMillimes": 9358549,
    "resultAfterFixedExpensesMillimes": 3553601,
    "netProfitMarginPercent": 9.43
  },
  "adSpendDeltaMillimes": 0
}
```

**Waterfall Identity** :
```
netRealizedContribution = grossRevenue 
                        - productCOGS 
                        - outboundShipping 
                        - paidAdSpend 
                        - codRefusalPenalty
```

---

```http
GET /api/v1/analytics/cod?from=2026-08-01&to=2026-11-03T23:59:59.999Z
Header: x-workspace-id: ws_maison_ambre

Response:
{
  "summary": {
    "expectedCashCollectionsMillimes": 79552000,
    "bankWireSettledMillimes": 49295000,
    "pendingCourierPayoutsMillimes": 30257000
  },
  "aging": {
    "days0to7Count": 127,
    "days0to7Millimes": 46291000,
    "days8to14Count": 45,
    "days8to14Millimes": 16385000,
    "days15to30Count": 31,
    "days15to30Millimes": 11287000,
    "daysOver30Count": 16,
    "daysOver30Millimes": 5589000
  }
}
```

**COD Identity** :
```
expectedCashCollections = ∑(delivered orders × unitPrice)
settledRevenue = bankWireSettled
pendingSettlement = expected - settled
```

---

```http
GET /api/v1/analytics/winners?from=2026-08-01&to=2026-11-03T23:59:59.999Z
Header: x-workspace-id: ws_maison_ambre

Response (array, not {data: []}):
[
  {
    "productId": "67273f8f7e63d91a3ab1ec23",
    "productName": "Sahara Gold Cuff Bracelet",
    "score": 94,
    "label": "Winner",
    "breakdown": {
      "netMarginScore": 25,
      "deliveryRateScore": 25,
      "roasScore": 22,
      "volumeTrendScore": 22
    },
    "totalOrders": 87,
    "deliveredOrders": 70,
    "refusedOrders": 17,
    "grossRevenueMillimes": 13023000
  },
  ...
]
```

**Scoring (0-100)** :
- 4 composantes égales (25 pts max chacune)
- **Marge nette** : `netContribution / grossRevenue`
  - ≥ 30% → 25 pts
  - Linéaire entre 0-30%
- **Taux livraison** : `delivered / total`
  - ≥ 80% → 25 pts
  - Linéaire entre 50-80%
- **ROAS** : `grossRevenue / adSpend`
  - ≥ 3 → 25 pts
  - Linéaire entre 1-3
- **Tendance volume** : croissance % vs période précédente
  - ≥ 0% → 25 pts
  - Linéaire entre -20% et 0%

**Labels** :
- `score >= 70` → **Winner**
- `40 <= score < 70` → **À surveiller**
- `score < 40` → **À couper**
- `totalOrders < 30` → **Données insuffisantes** (peu importe score)

---

```http
GET /api/v1/analytics/timeseries?from=2026-08-01&to=2026-11-03&granularity=day
Header: x-workspace-id: ws_maison_ambre

Response:
{
  "buckets": [
    {
      "period": "2026-08-01",
      "grossRevenueMillimes": 423000,
      "netContributionMillimes": 145000,
      "ordersCount": 3,
      "adSpendMillimes": 0
    },
    ...
  ],
  "granularity": "day"
}
```

Granularities: `day` (default), `week`, `month`

---

### Orders

```http
GET /api/v1/orders?limit=100&cursor=<nextCursor>
Header: x-workspace-id: ws_maison_ambre

Response:
{
  "data": [
    {
      "_id": "67273f907e63d91a3ab1ed46",
      "orderNumber": "ORD-1722470400001",
      "workspaceId": "ws_maison_ambre",
      "productId": "67273f8f7e63d91a3ab1ec23",
      "productNameSnapshot": "Sahara Gold Cuff Bracelet",
      "quantity": 1,
      "unitPriceMillimes": 149000,
      "unitCogsMillimes": 45000,
      "shippingMillimes": 8000,
      "adCpaMillimes": 12000,
      "netContributionMillimes": 84000,
      "customer": {
        "firstName": "Amina",
        "city": "Tunis",
        "governorate": "Tunis",
        "phone": "+21612345678"
      },
      "courier": "Aramex",
      "status": "delivered",
      "placedAt": "2026-08-01T08:23:00.000Z",
      "confirmedAt": "2026-08-01T08:23:00.000Z",
      "shippedAt": "2026-08-02T10:15:00.000Z",
      "deliveredAt": "2026-08-04T14:30:00.000Z",
      "version": 0
    },
    ...
  ],
  "meta": {
    "nextCursor": "eyJfaWQiOiI2NzI3M2Y5MDdlNjNkOTFhM2FiMWVkNDYifQ=="
  }
}
```

**Pagination** : cursor-based (plus stable que offset)

---

### Expenses

```http
GET /api/v1/expenses
Header: x-workspace-id: ws_maison_ambre

Response:
{
  "data": [
    {
      "_id": "67273f8f7e63d91a3ab1ec35",
      "workspaceId": "ws_maison_ambre",
      "category": "rent",
      "description": "Loyer bureau Tunis",
      "amountMillimes": 2500000,
      "periodType": "monthly",
      "startDate": "2026-01-01",
      "version": 0
    },
    ...
  ]
}
```

---

### Ad Spend

```http
GET /api/v1/ad-spend?from=2026-08-01&to=2026-11-03
Header: x-workspace-id: ws_maison_ambre

Response:
{
  "data": [
    {
      "_id": "67273f8f7e63d91a3ab1ec41",
      "workspaceId": "ws_maison_ambre",
      "platform": "Meta Ads",
      "campaignName": "Bijoux_Sept",
      "periodStart": "2026-09-01",
      "periodEnd": "2026-09-30",
      "spendMillimes": 1200000,
      "productId": "67273f8f7e63d91a3ab1ec23",
      "notes": "Campaign focused on gold jewelry",
      "version": 0
    },
    ...
  ]
}
```

---

### Pricing Optimizer

```http
POST /api/v1/pricing/optimize
Header: x-workspace-id: ws_maison_ambre
Content-Type: application/json

Body:
{
  "volumeMonthly": 100,
  "sellingPriceMillimes": 150000,
  "cogsMillimes": 45000,
  "logisticsCostPerOrderMillimes": 8000,
  "returnShippingMillimes": 0,
  "expectedRefusalRate": 0.2,
  "cpaMillimes": 12000
}

Response:
{
  "metrics": {
    "grossRevenueMonthly": 15000000,
    "cogsMonthly": 4500000,
    "logisticsMonthly": 800000,
    "adSpendMonthly": 1200000,
    "codPenaltyMonthly": 3000000,
    "netProfit": 5500000,
    "netProfitMargin": 36.67,
    "breakEvenVolume": 42
  },
  "recommendations": ["Marge saine", "Volume viable"]
}
```

---

## Indexes MongoDB

Créés automatiquement au bootstrap via `ensureIndexes()` (`src/database/ensure-indexes.ts`) :

### Collection `orders`

```javascript
{ workspaceId: 1, placedAt: -1 }
// Query: liste ordres par date desc

{ workspaceId: 1, status: 1, placedAt: -1 }
// Query: filtrer par statut (delivered, refused)

{ workspaceId: 1, productId: 1 }
// Query: agrégations par produit (winners scoring)

{ workspaceId: 1, customer.governorate: 1 }
// Query: analytics par gouvernorat
```

### Collection `expenses`

```javascript
{ workspaceId: 1, startDate: -1 }
// Query: charges fixes par date
```

### Collection `adspends`

```javascript
{ workspaceId: 1, periodStart: -1 }
// Query: dépenses pub par période
```

**Vérification** :
```bash
mongo winnit
> db.orders.getIndexes()
```

---

## Tests

```bash
npm test              # 204 passed, 6 failed (non-bloquants)
```

**Couverture** :
- **Analytics** :
  - `analytics.service.spec.ts` : waterfall identity, winners scoring, COD formulas
  - `profit-os.controller.spec.ts` : ETag, query params validation
- **Seed** :
  - `seed-generator.spec.ts` : distribution Pareto, quotas journaliers
  - `seed-quotas.spec.ts` : volumes cohérents
- **Utils** :
  - `contracts-guard.spec.ts` : golden fixture validation (77 lignes)
  - `idempotency.utils.spec.ts` : dedup clés
  - `optimistic-lock.utils.spec.ts` : version conflicts
  - `soft-delete.utils.spec.ts` : deletedAt handling
  - `pagination.utils.spec.ts` : cursor encoding

**6 échecs non-bloquants** : edge cases scenarios invalides, retry optimistic locking.

---

## Lint

```bash
npm run lint          # ESLint + Prettier
npm run format        # Auto-fix formatting
```

---

## Architecture

### Modules

```
src/
├── app.module.ts              Root module
├── config/                    Env validation (Joi)
├── database/                  MongoDB + Mongoose
├── common/
│   ├── cache/                 CacheService (in-memory, future Redis)
│   ├── filters/               ProblemDetail exception filter
│   ├── guards/                NoDollarQueryGuard (security)
│   ├── interceptors/          Logging, ETag, RequestId
│   └── utils/                 Idempotency, pagination, soft-delete
├── profit-os/
│   ├── analytics/             Waterfall, KPIs, COD, winners
│   ├── orders/                CRUD commandes
│   ├── expenses/              Charges fixes
│   ├── marketing/             Ad spend
│   ├── pricing/               Optimizer
│   └── scenarios/             Simulations sauvegardées
├── catalog/                   Products (mock adapter)
└── health/                    /health endpoint
```

### Schemas Mongoose

- **Order** : commandes (statuts, customer, livraison)
- **Product** : catalogue (prix, COGS, logistics)
- **Expense** : charges fixes (periodType: monthly/quarterly/yearly)
- **AdSpend** : campagnes pub (platform, period, spend)
- **Scenario** : simulations prix/volume
- **Workspace** : tenant (pas encore utilisé multi-tenant)

**Optimistic Locking** : tous schemas ont `version` field (Mongoose `@VersionKey()`)

---

## Golden Fixture

`contracts-golden.json` (77 lignes) partagé avec frontend :

**Contenu** :
- Unit economics 1 commande
- Waterfall agrégé 276 commandes
- COD reconciliation 219 delivered

**Validation** :
- Backend : `src/common/utils/contracts-guard.spec.ts`
- Frontend : `lib/finance/contracts-guard.test.ts`

**Commande** : copie automatique depuis `../contracts/finance-golden.json` vers `winnit-backend/contracts-golden.json` et `winnit-frontend/contracts-golden.json` (voir scripts CI).

---

## Roadmap

- [ ] **JWT Auth** : login + refresh tokens
- [ ] **Product Catalog API** : remplacer MockProductCatalogAdapter
- [ ] **Redis Cache** : remplacer in-memory CacheService
- [ ] **Settlements CRUD** : POST /settlements
- [ ] **Webhooks couriers** : Aramex/Sodetel callbacks statut livraison
- [ ] **AI Insights** : OpenAI/Claude pour recommandations

---

**Équipe** : Maison Ambre Tech  
**Contact** : dev@maisonambre.tn  
**Licence** : Propriétaire  
**Version** : 1.0.0 (Nov 2026)
