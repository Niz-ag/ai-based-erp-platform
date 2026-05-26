# AMX-ERP API Endpoints Reference
## AI-Powered Cloud ERP Suite — REST & GraphQL API Documentation
**Amdox Technologies | April 2026 | AMX-ERP-2026-04**

> **Base URL:** `https://api.amx-erp.com/api/v1`
> **Auth:** All endpoints require `Authorization: Bearer <JWT>` unless marked public
> **Tenant Isolation:** `X-Tenant-ID` header required on all requests
> **API Docs (Swagger UI):** `GET /api-docs`
> **OpenAPI Spec:** `GET /api-docs-json`

---

## Table of Contents
1. [Health & System](#1-health--system)
2. [Authentication & Users](#2-authentication--users)
3. [Financial Ledger — GL](#3-financial-ledger--gl)
4. [AP / AR Automation](#4-ap--ar-automation)
5. [HR & Employee Management](#5-hr--employee-management)
6. [Payroll Engine](#6-payroll-engine)
7. [Supply Chain & Inventory](#7-supply-chain--inventory)
8. [AI Demand Forecasting](#8-ai-demand-forecasting)
9. [Project Management](#9-project-management)
10. [Business Intelligence](#10-business-intelligence)
11. [Audit & Compliance Log](#11-audit--compliance-log)
12. [Notifications](#12-notifications)
13. [API Gateway & Webhooks](#13-api-gateway--webhooks)
14. [GraphQL API](#14-graphql-api)

---

## 1. Health & System

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health/live` | ❌ Public | Liveness probe — is the process running? |
| `GET` | `/health/ready` | ❌ Public | Readiness probe — is DB/Redis connected? |
| `GET` | `/health/db` | ❌ Public | Database connectivity check |
| `GET` | `/api-docs` | ❌ Public | Swagger UI |
| `GET` | `/api-docs-json` | ❌ Public | OpenAPI 3.1 JSON spec |

### Sample Response — `/health/ready`
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-04-15T10:00:00Z"
}
```

---

## 2. Authentication & Users

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Exchange credentials for JWT (Keycloak OIDC) |
| `POST` | `/auth/refresh` | Public | Refresh access token using refresh token |
| `POST` | `/auth/logout` | Any | Revoke refresh token (Redis blacklist) |
| `GET` | `/auth/me` | Any | Get current authenticated user profile |
| `GET` | `/auth/sso/callback` | Public | OIDC/SAML callback handler |
| `POST` | `/auth/mfa/enable` | Any | Enable MFA for current user |
| `POST` | `/auth/mfa/verify` | Any | Verify MFA TOTP code |
| `GET` | `/users` | Admin | List all users in tenant |
| `POST` | `/users` | Admin | Create new user |
| `GET` | `/users/:id` | Admin | Get user by ID |
| `PATCH` | `/users/:id` | Admin | Update user details |
| `DELETE` | `/users/:id` | Admin | Soft-delete user |
| `POST` | `/users/:id/roles` | Admin | Assign roles to user |
| `DELETE` | `/users/:id/roles/:role` | Admin | Remove role from user |

### POST `/auth/login` — Request Body
```json
{
  "email": "john.doe@company.com",
  "password": "••••••••"
}
```

### POST `/auth/login` — Response
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiJ9...",
  "refreshToken": "dGhpcyBpcyBh...",
  "expiresIn": 900,
  "user": {
    "id": "usr_01HX...",
    "email": "john.doe@company.com",
    "roles": ["Manager"],
    "tenantId": "ten_01HX..."
  }
}
```

---

## 3. Financial Ledger — GL

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/finance/accounts` | Finance, Admin | List chart of accounts |
| `POST` | `/finance/accounts` | Finance Admin | Create GL account |
| `GET` | `/finance/accounts/:id` | Finance | Get account detail + balance |
| `PATCH` | `/finance/accounts/:id` | Finance Admin | Update account metadata |
| `GET` | `/finance/journal-entries` | Finance | List journal entries (paginated) |
| `POST` | `/finance/journal-entries` | Finance | Create journal entry (double-entry) |
| `GET` | `/finance/journal-entries/:id` | Finance | Get single journal entry |
| `POST` | `/finance/period-close` | Finance Admin | Lock accounting period |
| `DELETE` | `/finance/period-close/:period` | SuperAdmin | Unlock period (override) |
| `GET` | `/finance/fx-rates` | Finance | Get current FX rates |
| `GET` | `/finance/fx-rates/history` | Finance | Get historical FX rate series |
| `GET` | `/finance/trial-balance` | Finance | Generate trial balance report |
| `GET` | `/finance/intercompany` | Finance | List intercompany transfer records |
| `POST` | `/finance/intercompany` | Finance Admin | Create intercompany transfer |

### POST `/finance/journal-entries` — Request Body
```json
{
  "description": "Office supplies purchase",
  "currency": "USD",
  "lines": [
    { "accountId": "acc_expenses_01", "debit": 500.00, "credit": 0 },
    { "accountId": "acc_cash_01",     "debit": 0,      "credit": 500.00 }
  ],
  "reference": "PO-2026-0042",
  "date": "2026-04-15"
}
```

---

## 4. AP / AR Automation

### Accounts Payable (AP)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/ap/invoices` | Finance | List supplier invoices |
| `POST` | `/ap/invoices` | Finance | Create invoice manually |
| `POST` | `/ap/invoices/ocr` | Finance | Upload invoice image for OCR parsing |
| `GET` | `/ap/invoices/:id` | Finance | Get invoice detail |
| `PATCH` | `/ap/invoices/:id` | Finance | Update invoice fields |
| `POST` | `/ap/invoices/:id/match` | Finance | Trigger 3-way PO/GR/Invoice matching |
| `POST` | `/ap/invoices/:id/approve` | Manager | Approve matched invoice |
| `POST` | `/ap/invoices/:id/reject` | Manager | Reject invoice with reason |
| `POST` | `/ap/payment-runs` | Finance Admin | Execute payment run (batch) |
| `GET` | `/ap/payment-runs/:id` | Finance | Get payment run status |
| `GET` | `/ap/aging-report` | Finance | AP aging report by vendor |

### Accounts Receivable (AR)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/ar/invoices` | Finance | List customer invoices |
| `POST` | `/ar/invoices` | Finance | Create customer invoice |
| `GET` | `/ar/invoices/:id` | Finance | Get customer invoice detail |
| `POST` | `/ar/invoices/:id/payment` | Finance | Record payment against invoice |
| `GET` | `/ar/aging-report` | Finance | AR aging report by customer |

### POST `/ap/invoices/ocr` — Request (multipart/form-data)
```
file: invoice_scan.pdf   (PDF or image)
vendorId: ven_01HX...
```

### Response
```json
{
  "invoiceId": "inv_01HX...",
  "vendorName": "Acme Supplies Ltd",
  "amount": 12500.00,
  "currency": "USD",
  "invoiceDate": "2026-04-10",
  "lineItems": [...],
  "ocrConfidence": 0.97,
  "matchStatus": "pending"
}
```

---

## 5. HR & Employee Management

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/hr/employees` | HR, Admin | List employees (paginated, filterable) |
| `POST` | `/hr/employees` | HR Admin | Create employee record (onboarding) |
| `GET` | `/hr/employees/:id` | HR | Get employee profile |
| `PATCH` | `/hr/employees/:id` | HR Admin | Update employee details |
| `DELETE` | `/hr/employees/:id` | HR Admin | Soft-delete (offboard) employee |
| `GET` | `/hr/employees/:id/documents` | HR | List employee documents |
| `POST` | `/hr/employees/:id/documents` | HR | Upload employee document |
| `GET` | `/hr/org-chart` | Any | Get organisational hierarchy (recursive) |
| `GET` | `/hr/departments` | HR | List departments |
| `POST` | `/hr/departments` | HR Admin | Create department |
| `GET` | `/hr/leave/types` | Any | List leave types + accrual rules |
| `POST` | `/hr/leave/types` | HR Admin | Create leave type |
| `GET` | `/hr/leave/requests` | HR | List all leave requests |
| `POST` | `/hr/leave/requests` | Employee | Submit leave request |
| `GET` | `/hr/leave/requests/:id` | HR, Employee | Get leave request detail |
| `POST` | `/hr/leave/requests/:id/approve` | Manager | Approve leave request |
| `POST` | `/hr/leave/requests/:id/reject` | Manager | Reject leave request |
| `POST` | `/hr/attendance/clock-in` | Employee | Record clock-in |
| `POST` | `/hr/attendance/clock-out` | Employee | Record clock-out |
| `GET` | `/hr/attendance` | HR | Get attendance records (filterable by date/employee) |

---

## 6. Payroll Engine

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/payroll/runs` | HR Admin | List all payroll runs |
| `POST` | `/payroll/runs` | HR Admin | Initiate new payroll run (async BullMQ job) |
| `GET` | `/payroll/runs/:id` | HR Admin | Get payroll run status & summary |
| `POST` | `/payroll/runs/:id/retry` | HR Admin | Retry failed payroll run (saga) |
| `POST` | `/payroll/runs/:id/approve` | Finance Admin | Approve and disburse payroll |
| `GET` | `/payroll/runs/:id/payslips` | HR Admin | List all payslips for a run |
| `GET` | `/payroll/payslips/:id` | HR, Employee | Get individual payslip |
| `GET` | `/payroll/payslips/:id/pdf` | HR, Employee | Download payslip as PDF |
| `GET` | `/payroll/tax-slabs` | HR Admin | Get configured tax slabs |
| `POST` | `/payroll/tax-slabs` | HR Admin | Create/update tax slab configuration |

### POST `/payroll/runs` — Request Body
```json
{
  "period": "2026-04",
  "employeeIds": "all",
  "currency": "INR"
}
```

### GET `/payroll/runs/:id` — Response
```json
{
  "runId": "prl_01HX...",
  "period": "2026-04",
  "status": "processing",
  "totalEmployees": 10000,
  "processed": 7420,
  "totalGross": 45000000.00,
  "totalNet": 38250000.00,
  "startedAt": "2026-04-30T02:00:00Z",
  "estimatedCompletion": "2026-04-30T02:04:30Z"
}
```

---

## 7. Supply Chain & Inventory

### Purchase Orders

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/scm/purchase-requisitions` | SCM | List purchase requisitions |
| `POST` | `/scm/purchase-requisitions` | SCM | Create purchase requisition |
| `POST` | `/scm/purchase-requisitions/:id/approve` | Manager | Approve and convert to PO |
| `GET` | `/scm/purchase-orders` | SCM | List purchase orders |
| `POST` | `/scm/purchase-orders` | SCM Admin | Create PO manually |
| `GET` | `/scm/purchase-orders/:id` | SCM | Get PO detail |
| `PATCH` | `/scm/purchase-orders/:id` | SCM Admin | Update PO |
| `POST` | `/scm/purchase-orders/:id/goods-receipt` | Warehouse | Record goods receipt |
| `POST` | `/scm/purchase-orders/:id/cancel` | SCM Admin | Cancel PO |

### Vendors

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/scm/vendors` | SCM | List vendors |
| `POST` | `/scm/vendors` | SCM Admin | Create vendor |
| `GET` | `/scm/vendors/:id` | SCM | Get vendor profile |
| `PATCH` | `/scm/vendors/:id` | SCM Admin | Update vendor |
| `GET` | `/scm/vendors/:id/performance` | SCM | Vendor performance metrics |

### Inventory

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/scm/inventory` | SCM | List inventory items with stock levels |
| `POST` | `/scm/inventory` | SCM Admin | Create inventory item |
| `GET` | `/scm/inventory/:id` | SCM | Get item detail + stock movement history |
| `PATCH` | `/scm/inventory/:id` | SCM Admin | Update item (reorder point, cost method) |
| `POST` | `/scm/inventory/:id/adjustment` | Warehouse | Manual stock adjustment with reason |
| `GET` | `/scm/inventory/low-stock` | SCM | List items below reorder threshold |
| `GET` | `/scm/warehouses` | SCM | List warehouse locations |

---

## 8. AI Demand Forecasting

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/forecasting/predictions` | SCM, Admin | Get cached SKU-level demand predictions |
| `GET` | `/forecasting/predictions/:skuId` | SCM | Get forecast for a specific SKU |
| `POST` | `/forecasting/predictions/batch` | SCM Admin | Request batch predictions for multiple SKUs |
| `POST` | `/forecasting/retrain` | Admin | Manually trigger model retraining job |
| `GET` | `/forecasting/models` | Admin | List model versions with accuracy metrics |
| `GET` | `/forecasting/models/active` | Admin | Get currently active model version |
| `GET` | `/forecasting/accuracy` | SCM, Admin | Get MAPE and forecast accuracy report |

### GET `/forecasting/predictions/:skuId` — Response
```json
{
  "skuId": "SKU-00421",
  "skuName": "Industrial Bearing 6204",
  "model": "prophet-v3",
  "horizon": "90d",
  "mape": 0.089,
  "predictions": [
    { "date": "2026-05-01", "quantity": 142, "lower": 120, "upper": 165 },
    { "date": "2026-05-08", "quantity": 138, "lower": 115, "upper": 161 },
    ...
  ],
  "retrainedAt": "2026-04-28T00:00:00Z",
  "cachedAt": "2026-04-30T06:00:00Z"
}
```

---

## 9. Project Management

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/projects` | Any | List projects in tenant |
| `POST` | `/projects` | Manager | Create project |
| `GET` | `/projects/:id` | Any | Get project overview |
| `PATCH` | `/projects/:id` | Manager | Update project metadata |
| `DELETE` | `/projects/:id` | Admin | Archive project |
| `GET` | `/projects/:id/milestones` | Any | List milestones |
| `POST` | `/projects/:id/milestones` | Manager | Create milestone |
| `PATCH` | `/projects/:id/milestones/:mId` | Manager | Update milestone |
| `GET` | `/projects/:id/tasks` | Any | List tasks (filterable by milestone/assignee) |
| `POST` | `/projects/:id/tasks` | Manager | Create task |
| `PATCH` | `/projects/:id/tasks/:tId` | Any | Update task (status, assignee, dates) |
| `GET` | `/projects/:id/gantt` | Any | Get Gantt chart data (tasks + dependencies) |
| `GET` | `/projects/:id/resources` | Manager | Get resource allocation + utilisation |
| `POST` | `/projects/:id/resources` | Manager | Assign employee to task |
| `GET` | `/projects/:id/budget` | Manager, Finance | Get planned vs actual budget |
| `POST` | `/projects/:id/expenses` | Manager | Log actual expense |

### GET `/projects/:id/gantt` — Response (abbreviated)
```json
{
  "projectId": "prj_01HX...",
  "tasks": [
    {
      "id": "tsk_01HX...",
      "name": "API Gateway Setup",
      "start": "2026-04-03",
      "end": "2026-04-06",
      "progress": 100,
      "dependencies": [],
      "assignee": "usr_01HX..."
    },
    {
      "id": "tsk_02HX...",
      "name": "Authentication Module",
      "start": "2026-04-04",
      "end": "2026-04-08",
      "progress": 75,
      "dependencies": ["tsk_01HX..."],
      "assignee": "usr_02HX..."
    }
  ]
}
```

---

## 10. Business Intelligence

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/bi/dashboards` | Any | List saved dashboards |
| `POST` | `/bi/dashboards` | Any | Create new dashboard |
| `GET` | `/bi/dashboards/:id` | Any | Get dashboard with widget configs |
| `PATCH` | `/bi/dashboards/:id` | Any | Update dashboard layout/title |
| `DELETE` | `/bi/dashboards/:id` | Any | Delete dashboard |
| `POST` | `/bi/dashboards/:id/widgets` | Any | Add widget to dashboard |
| `PATCH` | `/bi/dashboards/:id/widgets/:wId` | Any | Update widget config |
| `DELETE` | `/bi/dashboards/:id/widgets/:wId` | Any | Remove widget |
| `POST` | `/bi/query` | Any | Execute ad-hoc BI data query |
| `GET` | `/bi/reports` | Any | List scheduled reports |
| `POST` | `/bi/reports` | Any | Create scheduled report |
| `POST` | `/bi/reports/:id/run` | Any | Trigger report export immediately |
| `GET` | `/bi/reports/:id/download` | Any | Download report (PDF/Excel) |
| `GET` | `/bi/stream` | Any | SSE stream for real-time dashboard metric refresh |

### POST `/bi/query` — Request Body
```json
{
  "metric": "revenue_by_month",
  "filters": {
    "dateRange": { "from": "2026-01-01", "to": "2026-04-30" },
    "currency": "USD",
    "department": "sales"
  },
  "groupBy": ["month", "region"],
  "limit": 100
}
```

---

## 11. Audit & Compliance Log

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/audit/logs` | Admin | Query audit logs (filterable, paginated) |
| `GET` | `/audit/logs/:id` | Admin | Get single audit event detail |
| `GET` | `/audit/logs/export` | Admin | Export audit log range as CSV |
| `POST` | `/gdpr/dsr` | Admin | Submit GDPR Data Subject Request |
| `GET` | `/gdpr/dsr/:id` | Admin | Get DSR status |
| `POST` | `/gdpr/dsr/:id/fulfill` | Admin | Mark DSR as fulfilled |
| `POST` | `/gdpr/erasure` | Admin | Trigger right-to-erasure for a user |

### GET `/audit/logs` — Query Params
```
?userId=usr_01HX...
&action=JOURNAL_ENTRY_CREATED
&from=2026-04-01T00:00:00Z
&to=2026-04-30T23:59:59Z
&page=1
&limit=50
```

### Sample Audit Log Entry
```json
{
  "id": "aud_01HX...",
  "tenantId": "ten_01HX...",
  "userId": "usr_01HX...",
  "action": "INVOICE_APPROVED",
  "resource": "ap_invoices",
  "resourceId": "inv_01HX...",
  "before": { "status": "pending" },
  "after":  { "status": "approved" },
  "ip": "203.0.113.42",
  "userAgent": "Mozilla/5.0...",
  "hash": "sha256:a3f9d2...",
  "timestamp": "2026-04-15T09:32:11Z"
}
```

---

## 12. Notifications

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/notifications` | Any | List notifications for current user |
| `PATCH` | `/notifications/:id/read` | Any | Mark notification as read |
| `POST` | `/notifications/read-all` | Any | Mark all as read |
| `GET` | `/notifications/preferences` | Any | Get user notification preferences |
| `PATCH` | `/notifications/preferences` | Any | Update channel preferences per event type |
| `GET` | `/notifications/stream` | Any | SSE stream for real-time in-app notifications |
| `GET` | `/admin/notifications/queue` | Admin | View BullMQ notification queue status |
| `GET` | `/admin/notifications/dlq` | Admin | View dead-letter queue (failed deliveries) |
| `POST` | `/admin/notifications/dlq/:id/retry` | Admin | Retry failed notification delivery |

### PATCH `/notifications/preferences` — Request Body
```json
{
  "INVOICE_APPROVED":   { "inApp": true, "email": true,  "sms": false },
  "PAYROLL_COMPLETE":   { "inApp": true, "email": true,  "sms": true  },
  "LOW_STOCK_ALERT":    { "inApp": true, "email": false, "sms": false },
  "PROJECT_OVERRUN":    { "inApp": true, "email": true,  "sms": false }
}
```

---

## 13. API Gateway & Webhooks

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/webhooks` | Admin | List registered webhook subscriptions |
| `POST` | `/webhooks` | Admin | Register new webhook endpoint |
| `GET` | `/webhooks/:id` | Admin | Get webhook detail |
| `PATCH` | `/webhooks/:id` | Admin | Update webhook URL or events |
| `DELETE` | `/webhooks/:id` | Admin | Delete webhook subscription |
| `POST` | `/webhooks/:id/test` | Admin | Send test event to webhook endpoint |
| `GET` | `/webhooks/:id/deliveries` | Admin | List recent webhook delivery attempts |

### POST `/webhooks` — Request Body
```json
{
  "url": "https://your-system.com/erp-events",
  "events": ["INVOICE_APPROVED", "PAYROLL_COMPLETE", "LOW_STOCK_ALERT"],
  "secret": "whsec_your_signing_secret"
}
```

### Outbound Webhook Payload
```json
{
  "id": "evt_01HX...",
  "event": "INVOICE_APPROVED",
  "tenantId": "ten_01HX...",
  "data": {
    "invoiceId": "inv_01HX...",
    "amount": 12500.00,
    "currency": "USD",
    "approvedBy": "usr_01HX...",
    "approvedAt": "2026-04-15T09:32:11Z"
  },
  "timestamp": "2026-04-15T09:32:12Z"
}
```

> **Webhook Signature:** Every outbound payload includes `X-AMX-Signature: hmac-sha256=<hash>` header.
> Verify with: `HMAC-SHA256(payload, secret)`

---

## 14. GraphQL API

> **Endpoint:** `POST /graphql`
> **Playground:** `GET /graphql` (development only)
> **Use case:** Flexible BI queries, dashboard data, cross-module reporting

### Sample Queries

```graphql
# Revenue + inventory summary in one request
query ExecutiveDashboard($tenantId: ID!, $period: String!) {
  revenueByMonth(tenantId: $tenantId, period: $period) {
    month
    revenue
    currency
  }
  inventorySummary(tenantId: $tenantId) {
    totalSKUs
    lowStockCount
    totalValue
  }
  projectHealth(tenantId: $tenantId) {
    onTrack
    atRisk
    overBudget
  }
}

# Employee payroll detail
query EmployeePayroll($employeeId: ID!, $period: String!) {
  employee(id: $employeeId) {
    name
    department
    payslip(period: $period) {
      grossPay
      netPay
      deductions { type amount }
      pdfUrl
    }
  }
}
```

---

## Common Response Envelopes

### Success (200 / 201)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 1240
  }
}
```

### Error (4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "INVOICE_NOT_FOUND",
    "message": "Invoice inv_01HX... does not exist in this tenant.",
    "statusCode": 404,
    "timestamp": "2026-04-15T09:32:11Z",
    "path": "/api/v1/ap/invoices/inv_01HX..."
  }
}
```

### Validation Error (400)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "fields": [
      { "field": "lines[0].debit", "message": "debit must be a positive number" },
      { "field": "date",           "message": "date must be a valid ISO 8601 date" }
    ]
  }
}
```

---

## Rate Limits

| Tier | Limit | Window | Applies To |
|---|---|---|---|
| Standard | 1,000 req | per minute | All authenticated endpoints |
| Bulk / Batch | 100 req | per minute | `/payroll/runs`, `/forecasting/predictions/batch` |
| OCR Upload | 50 req | per minute | `/ap/invoices/ocr` |
| Public | 20 req | per minute | `/health/*`, `/auth/login` |

> Rate limit headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
> On breach: `HTTP 429 Too Many Requests`

---

*Amdox Technologies • API Reference • April 2026*
