# AMX-ERP Frontend Guide
## AI-Powered Cloud ERP Suite — Frontend Reference
**Amdox Technologies | April 2026 | AMX-ERP-2026-04**

---

## Tech Stack

| Category | Technology | Notes |
|---|---|---|
| Framework | Next.js 15 + React 19 + TypeScript 5.5 | SSR/SSG via App Router; Remix & Vite evaluated |
| UI Components | shadcn/ui + Radix UI + Tailwind CSS 4 | Accessible, unstyled primitives; MUI ruled out |
| State Management | Zustand + TanStack React Query v5 | Zustand = client state; React Query = server state |
| Data Visualisation | Recharts + ECharts (Apache) + D3.js | Recharts for dashboards; ECharts for heavy analytics; D3 for custom |
| Forms | React Hook Form + Zod | Type-safe validation with schema inference |
| PWA / Offline | Service Worker (Workbox) | Cache critical read views; sync on reconnect |

---

## Functional Requirements (Frontend-Facing)

| ID | Feature | UI Responsibility | Acceptance Criteria |
|---|---|---|---|
| F-01 | SSO Login | OIDC redirect, MFA prompt, tenant selection screen | Login completes < 2s; MFA enforced per tenant |
| F-07 | Project Management | Gantt chart (D3 / react-gantt), resource heatmap, milestone timeline | Gantt renders < 1s |
| F-08 | Business Intelligence | Drag-and-drop dashboard builder, chart widgets, drill-down data tables | Dashboard saved in < 500ms; exports to PDF/Excel |
| F-10 | Notifications | In-app notification panel (SSE / Socket.io), preference settings UI | Real-time delivery; per-user channel settings |
| F-12 | Offline / PWA | Service worker cache for GL, inventory, project read views | Core views functional offline; no data loss on sync |

---

## Key UI Modules

### Dashboard Builder (F-08)
- Drag-and-drop widget grid using `react-grid-layout`
- Widget types: `BarChart`, `LineChart`, `PieChart`, `KPICard`, `DataTable`, `Funnel`, `Heatmap`
- Widget config stored as JSON in PostgreSQL per tenant/user
- Real-time refresh via **Server-Sent Events (SSE)**
- Scheduled report delivery: PDF/Excel generated server-side, emailed on cron

### Gantt Chart (F-07)
- Custom D3.js Gantt or `react-gantt` library
- Task dependencies rendered as DAG edges
- Drag-to-reschedule with constraint validation
- Budget vs. actual variance bar overlay
- Alert badge when actual spend > planned by 10%

### Data Visualisation Stack
```
Recharts      → Standard dashboards (bar, line, area, pie)
ECharts       → Heavy analytics, large datasets, heatmaps
D3.js         → Custom/bespoke visualisations, Gantt, org chart
```

---

## Performance Targets

| Metric | Target | Tool |
|---|---|---|
| Lighthouse Performance | >= 90 | Lighthouse CI |
| Lighthouse Accessibility | >= 90 (WCAG 2.1 AA) | Lighthouse CI + axe-core |
| Bundle Size | Analysed & split | webpack-bundle-analyzer |
| Gantt Render | < 1s | Chrome DevTools |
| Dashboard Save | < 500ms | React Query mutation timing |
| Initial Page Load | SSR via Next.js App Router | Core Web Vitals |

---

## Accessibility (WCAG 2.1 AA)

- All interactive elements have ARIA labels
- Keyboard navigation supported across all modules
- Colour contrast ratio >= 4.5:1 for normal text
- Focus indicators visible
- Screen reader tested with VoiceOver / NVDA

---

## Responsive Breakpoints

| Breakpoint | Width | Target Device |
|---|---|---|
| Mobile | 375px | iPhone SE / small phones |
| Tablet | 768px | iPad / landscape phones |
| Desktop | 1440px | Standard laptop / monitor |

---

## Security (Frontend)

| Control | Implementation |
|---|---|
| XSS Prevention | `DOMPurify` for user-generated content; strict CSP headers |
| Input Validation | Zod schemas on all forms before API submission |
| CSRF Protection | SameSite cookies + CSRF token header |
| Secure Headers | `Helmet.js` on Next.js: HSTS, X-Frame-Options, Referrer-Policy |
| No Hardcoded Secrets | All env vars via `.env.local`; never exposed to client bundle |

---

## Folder Structure

```
apps/web/
├── app/                   # Next.js App Router pages
│   ├── (auth)/            # Login, SSO callback, MFA
│   ├── dashboard/         # BI dashboard builder
│   ├── finance/           # GL, AP/AR views
│   ├── hr/                # Employee, payroll, leave
│   ├── supply-chain/      # PO, inventory, vendor portal
│   ├── projects/          # Gantt, resources, budget
│   └── settings/          # Tenant config, notifications
├── components/
│   ├── ui/                # shadcn/ui base components
│   ├── charts/            # Recharts, ECharts, D3 wrappers
│   ├── layout/            # Sidebar, topbar, breadcrumbs
│   └── shared/            # Reusable domain components
├── hooks/                 # Custom React hooks
├── stores/                # Zustand stores
├── lib/                   # API clients, utils, constants
└── public/                # Static assets
```

---

## Testing

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest + React Testing Library | Components, hooks, utils |
| E2E | Playwright | Auth flows, dashboard, Gantt, forms |
| Accessibility | axe-core + Playwright | WCAG audit on all major pages |
| Visual Regression | Playwright screenshots | Catch unintended UI regressions |

---

## Deployment

- **Hosting:** Vercel (Next.js native) or AWS CloudFront + S3
- **CDN:** Vercel Edge Network / CloudFront for static assets
- **TLS:** Let's Encrypt via cert-manager or Vercel-managed
- **Custom Domain:** Configured in Vercel / Route 53
- **Preview Deployments:** Auto-generated per PR by Vercel

---

*Amdox Technologies • Frontend Reference • April 2026*
