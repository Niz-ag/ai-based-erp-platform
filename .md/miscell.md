# AMX-ERP Miscellaneous Reference
## AI-Powered Cloud ERP Suite — DevOps, Infra, Security & Compliance
**Amdox Technologies | April 2026 | AMX-ERP-2026-04**

---

## Containerisation

| Item | Detail |
|---|---|
| Docker Version | Docker 27 multi-stage builds |
| Base Image | Distroless (minimal attack surface) |
| Compatibility | Podman-compatible |
| Optimisation | `.dockerignore` tuned to minimise build context |
| Security Scan | Trivy container scan integrated in CI pipeline |
| Compose (Dev) | `docker-compose.yml` — PostgreSQL, Redis, Keycloak, Elasticsearch |
| Compose (Prod) | `docker-compose.prod.yml` — health checks + resource limits |

### Multi-Stage Dockerfile Pattern
```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

# Stage 2: Runtime (Distroless)
FROM gcr.io/distroless/nodejs22-debian12
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["dist/main.js"]
```

---

## Kubernetes & Helm

| Resource | Detail |
|---|---|
| K8s Version | Kubernetes 1.31 |
| Package Manager | Helm 3 charts |
| GitOps | ArgoCD continuous delivery |
| Service Mesh | Istio 1.22 (mTLS + traffic policies) |
| Namespace Strategy | Isolated per environment: `dev`, `staging`, `prod` |
| Local Validation | minikube / kind |

### Helm Chart Resources
- `Deployment` — rolling update strategy
- `Service` — ClusterIP for internal; LoadBalancer for ingress
- `ConfigMap` — non-sensitive env config
- `Secret` — Sealed Secrets (encrypted at rest in Git)
- `Ingress` — NGINX ingress controller + TLS
- `HorizontalPodAutoscaler (HPA)` — scale on CPU/memory > 70%
- `PodDisruptionBudget (PDB)` — maintain availability during node drain

### Istio Traffic Management
- mTLS enforced between all services (zero-trust)
- Virtual services + destination rules for **canary deployments**
- Traffic split: 90% stable / 10% canary → promote on success

---

## CI/CD Pipeline

```
GitHub Actions Matrix Pipeline:
lint → unit-test → integration-test → build → docker-push → deploy
```

| Stage | Tool | Detail |
|---|---|---|
| Lint | ESLint + Prettier | Fail fast on code style |
| Unit Tests | Vitest | All services |
| Integration Tests | Vitest + Supertest | Against test DB |
| Build | tsc + Next.js build | Type-check + bundle |
| Docker Push | docker buildx | Multi-arch image to ECR |
| Deploy | ArgoCD | GitOps sync to K8s |
| Smoke Tests | Playwright | Post-deploy health check |
| Notifications | Slack webhook | Pipeline pass/fail alerts |

---

## Cloud Deployment

### Frontend
| Option | Detail |
|---|---|
| Primary | Vercel (Next.js native; edge functions; preview deployments per PR) |
| Alternative | AWS CloudFront + S3 (static export) |

### Backend
| Option | Detail |
|---|---|
| Primary | AWS EKS (Elastic Kubernetes Service) |
| Alternative | Railway / Fly.io (staging) |

### Database
| Service | Detail |
|---|---|
| PostgreSQL | AWS RDS Aurora Serverless v2 / Supabase |
| Redis | AWS ElastiCache / Upstash |
| Elasticsearch | AWS OpenSearch Service |
| File Storage | AWS S3 + CloudFront |

### Networking
- Custom domain + **Let's Encrypt TLS** via cert-manager
- DNS configured in Route 53 / Cloudflare
- CDN for static assets (CloudFront / Vercel Edge)
- **AWS WAF** rules for OWASP Top 10 protection at edge

---

## Observability Stack

| Tool | Purpose |
|---|---|
| OpenTelemetry SDK | Instrumentation across all services (traces, metrics, logs) |
| Prometheus | Metrics scraping + alerting rules |
| Grafana | Dashboards: latency, error rate, saturation, throughput |
| Loki | Log aggregation + Grafana log explorer |
| PagerDuty / OpsGenie | On-call alerting for SLA breaches |

### Tracing Strategy
- **100% sampling** for error traces
- **10% sampling** for successful traces
- Distributed trace IDs propagated via HTTP headers (W3C TraceContext)

### Key Grafana Dashboards
1. API Gateway — P50/P95/P99 latency, error rate, RPS
2. Database — query time, connection pool, slow queries
3. Queue — BullMQ job throughput, failure rate, DLQ depth
4. ML Service — prediction latency, model accuracy drift
5. Infrastructure — pod CPU/memory, HPA events, node status

---

## Infrastructure as Code (IaC)

| Tool | Usage |
|---|---|
| Terraform 1.9 | AWS + GCP multi-cloud resource provisioning |
| Terragrunt | DRY Terraform configurations across environments |
| ArgoCD | GitOps — K8s state synced from Git repository |

### Terraform Modules
- `vpc` — VPC, subnets, security groups, NAT gateway
- `eks` — EKS cluster, node groups, IAM roles
- `rds` — Aurora Serverless v2, parameter groups, backups
- `elasticache` — Redis cluster, subnet groups
- `s3` — Buckets, lifecycle policies, replication
- `waf` — WAF rules, IP sets, rate-based rules

---

## Security & Compliance Framework

### Identity & Access
| Control | Detail | Standard |
|---|---|---|
| MFA | Enforced per tenant via Keycloak | NIST 800-63 |
| RBAC + ABAC | NestJS guards + resource-level policies | Zero Trust |
| JIT Access | Just-in-time elevated access for prod | NIST 800-207 |
| Session Timeout | Configurable idle timeout per tenant | — |

### Encryption
| Layer | Detail | Standard |
|---|---|---|
| In Transit | TLS 1.3 (all services) | FIPS 140-2 |
| At Rest | AES-256 (RDS encryption, S3 SSE) | FIPS 140-2 |
| Secrets | HashiCorp Vault / AWS Secrets Manager | CIS K8s Benchmark |

### Security Scanning in CI
| Tool | Scope |
|---|---|
| Trivy | Container image vulnerability scanning |
| Snyk | SCA — dependency CVE scanning |
| OWASP ZAP | DAST — dynamic API security testing |
| TruffleHog | Secret scanning — detect committed secrets |
| Renovate Bot | Auto-PRs for dependency updates |

### OWASP Hardening
- CSRF protection: SameSite cookies + CSRF token
- XSS: `DOMPurify` + strict `Content-Security-Policy` headers
- IDOR: tenant-scoped queries enforce resource ownership
- Rate limiting: Redis sliding window via `nestjs-throttler`
- `Helmet.js`: HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy

---

## Disaster Recovery

| Metric | Target | Mechanism |
|---|---|---|
| RPO (Recovery Point Objective) | < 15 minutes | Aurora continuous backup + PITR |
| RTO (Recovery Time Objective) | < 60 minutes | Aurora automatic failover; DNS flip |
| DB Failover | < 5 min RTO | Aurora promotes read replica automatically |
| Data Durability | 99.999999999% | S3 11-nines durability for backups |

---

## Runbook Quick Reference

| Scenario | Action |
|---|---|
| DB Failover | Aurora auto-promotes replica; health check flips DNS; verify RTO < 5 min |
| Pod OOM / CrashLoop | Liveness probe restarts pod; PagerDuty alert after 3 restarts; HPA scales |
| Cache Miss Storm | Circuit breaker activates; fallback to DB; adaptive TTL warmup begins |
| Payroll Job Failure | Saga compensates; partial calculations reverted; alert sent; manual retry via `/api/v1/payroll/retry/:runId` |
| Security Incident | WAF IP block; PagerDuty alert; Vault rotates affected secrets within 15 min |
| High Latency Alert | Check Grafana API dashboard; inspect slow query log; scale read replicas if BI query bottleneck |

---

## Local Development Stack (Docker Compose)

```yaml
services:
  postgres:     # PostgreSQL 17 + TimescaleDB
  redis:        # Redis 8
  keycloak:     # Keycloak 25 (auth server)
  elasticsearch: # Elasticsearch 8.15
  mailpit:      # Local email capture (SMTP trap)
  minio:        # Local S3-compatible file storage
```

Start with:
```bash
docker compose up -d
pnpm dev   # Starts all apps in Turborepo
```

---

## Submission Checklist

| # | Deliverable | Format | Status |
|---|---|---|---|
| 1 | Project Report PDF | A4, 8–15 pages | ☐ |
| 2 | Live Public Demo URL | HTTPS, no VPN | ☐ |
| 3 | GitHub Repository | Public, clean structure | ☐ |
| 4 | README.md | Setup + screenshots + video link | ☐ |
| 5 | Demo Video | 5–7 min, YouTube Unlisted / Loom | ☐ |

**File naming:** `YourName_AMX_ERP_AmdoxTechnologies_April2026.pdf / .zip`
**Submit via:** Amdox Technologies project dashboard (no email)
**Deadline:** Strict — late submissions disqualified from stipend

---

*Amdox Technologies • DevOps & Infrastructure Reference • April 2026*
