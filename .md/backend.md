# AMX-ERP Backend Guide
## AI-Powered Cloud ERP Suite — Backend Reference
**Amdox Technologies | April 2026 | AMX-ERP-2026-04**

---

## Tech Stack

| Category | Technology | Notes |
|---|---|---|
| Runtime | Node.js 22 LTS + TypeScript 5.5 | Bun evaluated; Node chosen for ecosystem maturity |
| API Framework | NestJS 11 (modular monolith) | DI + decorators; Fastify evaluated |
| API Protocols | REST (OpenAPI 3.1) + GraphQL (Apollo v4) | GraphQL for BI queries; REST for CRUD & integrations |
| Primary Database | PostgreSQL 17 + Prisma ORM | ACID compliance; MongoDB ruled out |
| Time-Series DB | TimescaleDB (PostgreSQL extension) | Audit logs, telemetry; InfluxDB evaluated |
| Cache & Session | Redis 8 + ioredis | Sessions, job queues, pub/sub |
| Message Queue | BullMQ (Redis-backed) | Payroll, email, webhooks; Kafka for future scale |
| Search | Elasticsearch 8.15 / OpenSearch | Full-text search; Typesense evaluated |
| File Storage | AWS S3 + CloudFront / MinIO (self-hosted) | Invoices, exports, backups |
| Authentication | Keycloak 25 (OIDC/SAML) + JWT (RS256) | Enterprise SSO; Auth0 evaluated |
| Email | AWS SES + Resend (fallback) | DKIM/SPF configured |
| ML Service | Python 3.13 + FastAPI + Prophet + PyTorch | Dedicated microservice; communicates over Istio mTLS |

---

## Core Backend Modules (NestJS)

### Authentication & Multi-Tenancy
- Keycloak realm-per-tenant strategy: OIDC + SAML 2.0
- `passport-jwt` with RS256 token validation
- Tenant context middleware: injects `tenantId` into every request
- RBAC guard: `SuperAdmin`, `TenantAdmin`, `Manager`, `Viewer`
- Refresh token rotation + Redis blacklist (`SET` with TTL)

### Financial Ledger (F-02)
- Double-entry accounting engine with journal entry validation
- Multi-currency: ECB / OpenExchangeRates daily FX rate fetch
- Period close locking with role-based override
- Intercompany transfer support across tenant entities

### AP / AR Automation (F-03)
- Invoice OCR pipeline (AWS Textract / Tesseract) — target accuracy >= 95%
- 3-way PO/GR/Invoice matching with auto-approve if match passes
- Payment run logic with bank export (SEPA / ACH formats)
- Aging report via optimised SQL window functions

### HR & Payroll Engine (F-04)
- Employee CRUD with org hierarchy (recursive CTE in PostgreSQL)
- Leave management: accrual rules, approval workflow (state machine pattern)
- Gross-to-net payroll calculation (configurable tax slabs, statutory deductions)
- Batch payroll processing via **BullMQ** — async, retry-safe, audit-logged
- Payslip PDF generation (Puppeteer / pdfkit)

### Supply Chain & Inventory (F-05)
- Purchase requisition → PO → goods receipt workflow
- Real-time stock levels with FIFO costing
- Configurable reorder point → auto-draft PO on threshold breach
- Vendor notification via BullMQ + AWS SES / webhook

### AI Demand Forecasting (F-06)
- NestJS `ForecastingModule` proxies requests to Python ML microservice
- Predictions cached in Redis (TTL = 24h)
- Weekly retrain cron scheduled via BullMQ + Redis cron
- ML service endpoints: `POST /train`, `POST /predict`, `GET /health`

### Business Intelligence (F-08)
- Widget configuration stored as JSONB in PostgreSQL
- Optimised read-model SQL views for BI queries (CQRS pattern)
- Scheduled report jobs: PDF/Excel generation + SES delivery
- Real-time metric push via **Server-Sent Events (SSE)**

### Notification Engine (F-10)
- Domain events via `NestJS EventEmitter2`
- Channels: in-app (SSE / Socket.io), email (SES), SMS, webhook (HMAC-signed)
- BullMQ dead-letter queue + retry up to 3x
- Per-user notification preferences stored in DB

### Audit & Compliance Log (F-09)
- Immutable audit trail in **TimescaleDB** (append-only hypertable)
- Tamper detection via hash chaining (SHA-256 of previous row hash + payload)
- GDPR DSR (Data Subject Request) API — fulfilled in < 72h
- Soft-delete pipeline for right-to-erasure (GDPR Art. 17)

---

## Design Patterns

| Pattern | Where Applied |
|---|---|
| Domain-Driven Design (DDD) | Bounded contexts: Finance, HR, SCM, Projects |
| CQRS (lightweight) | Separate read SQL views from write models for BI |
| Outbox Pattern | DB transaction + outbox table → BullMQ for guaranteed event delivery |
| Saga (Orchestration) | Payroll run: multi-step saga with compensating transactions |
| Repository Pattern | All DB access via Prisma repositories; no raw SQL outside reporting |
| Decorator / Guard | RBAC, tenant isolation, audit logging via NestJS decorators |

---

## Database Schema (Key Entities)

```
Tenant
User ──── TenantUser (role join)
Account ──── JournalEntry
Employee ──── PayrollRun ──── Payslip
PurchaseOrder ──── GoodsReceipt ──── Invoice
InventoryItem ──── StockMovement
Project ──── Milestone ──── Task ──── ResourceAllocation
Notification ──── NotificationPreference
AuditLog (TimescaleDB)
```

- All tables include: `tenantId`, `createdAt`, `updatedAt`, `deletedAt` (soft delete)
- Row-level security: `tenantId` filter injected at Prisma query layer
- Indexes on: `tenantId`, `createdAt`, FK columns, common filter fields

---

## API Design

- **REST:** OpenAPI 3.1 spec; all endpoints versioned (`/api/v1/...`)
- **GraphQL:** Apollo v4; flexible queries for BI and reporting
- **Swagger UI** served at `/api-docs`
- **Postman collection** auto-generated from OpenAPI spec
- Global NestJS pipes: `ValidationPipe` (class-validator), `ParseUUIDPipe`
- Global exception filters + request logging interceptors
- Health checks: `GET /health/live`, `/health/ready`, `/health/db`

---

## Performance Targets

| Metric | Target | Measurement |
|---|---|---|
| P95 API Latency | < 300ms | Prometheus + Grafana |
| Concurrent Users | >= 2,000 per tenant | k6 load test |
| Payroll Run (10k employees) | < 5 min | BullMQ job timing |
| OCR Match Time | < 30s | API response timing |
| Dashboard Save | < 500ms | API response timing |

---

## Security

| Control | Implementation |
|---|---|
| Authentication | Keycloak OIDC/SAML + JWT RS256 + MFA |
| Authorisation | NestJS RBAC guards + ABAC for resource-level |
| Input Validation | `class-validator` DTOs on all endpoints |
| SQL Injection | Prisma parameterised queries only |
| Rate Limiting | `nestjs-throttler` with Redis sliding window |
| CORS | Strict allowlist per tenant domain |
| Secrets | HashiCorp Vault / AWS Secrets Manager; no hardcoded secrets |
| Container Security | Distroless Docker images; Trivy scan in CI |
| Dependency Audit | Snyk SCA + Renovate bot for auto-updates |

---

## Monorepo Folder Structure

```
apps/api/
├── src/
│   ├── auth/              # Keycloak, JWT, RBAC, tenant middleware
│   ├── finance/           # GL, AP, AR modules
│   ├── hr/                # Employee, leave, payroll
│   ├── supply-chain/      # PO, inventory, vendor
│   ├── projects/          # Milestones, tasks, resources
│   ├── bi/                # Dashboard, reports, SSE
│   ├── notifications/     # Event bus, channels, preferences
│   ├── audit/             # Immutable log, GDPR DSR
│   ├── forecasting/       # ML service proxy, Redis cache
│   └── common/            # Guards, interceptors, filters, pipes
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
└── test/                  # Vitest + Supertest integration tests

apps/ml-service/
├── main.py                # FastAPI entry point
├── models/                # Prophet + LSTM model definitions
├── routers/               # /train, /predict, /health
└── mlflow/                # Model versioning
```

---

## Testing

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | Services, guards, pipes, utilities |
| Integration | Vitest + Supertest | Module-level API tests with real DB |
| E2E Cross-module | Supertest | PO → Inventory → AP Invoice → GL Journal |
| Load | k6 | 2,000 VUs, 10-min steady state |
| Security | OWASP ZAP + Snyk | DAST + SCA in CI pipeline |

---

*Amdox Technologies • Backend Reference • April 2026*
