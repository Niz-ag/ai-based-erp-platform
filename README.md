# AMDOX ERP Suite
## Next-Generation AI-Powered Cloud ERP

AMDOX ERP is a professional-grade, multi-tenant enterprise resource planning platform. It leverages AI for demand forecasting, OCR for automated AP processing, and a high-performance stack for financial and operational management.

## 🚀 Quick Start (Docker)

The fastest way to run the entire suite (Frontend, Backend, ML Service, Database, and Cache) is using Docker Compose.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd AMDOX_PROJECT
   ```

2. **Launch the stack**
   ```bash
   docker-compose up --build -d
   ```

3. **Access the application**
   - **Web Dashboard**: [http://localhost:5000](http://localhost:5000)
   - **Backend API**: [http://localhost:3000](http://localhost:3000)
   - **AI Forecast Service**: [http://localhost:8000](http://localhost:8000)
   - **API Documentation (Swagger)**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

### Default Credentials
- **Email**: `admin@amdox.com`
- **Password**: `admin123`
- **MFA Code (Demo)**: `123456`

---

## 🛠 Tech Stack

- **Frontend**: Next.js 16 (Turbopack), Tailwind CSS, TanStack Query, Recharts (AI Visualization)
- **Backend API**: NestJS, Prisma ORM, Swagger (OpenAPI 3.1)
- **Intelligence**: Python 3.13, FastAPI, Pandas, Scikit-learn (Demand Forecasting), Tesseract.js (OCR)
- **Database**: PostgreSQL 17 + TimescaleDB (Time-series optimization)
- **Cache/Messaging**: Redis 8
- **Orchestration**: Docker & Docker Compose (Multi-stage Alpine builds)

## ✨ Key Features

- **📊 AI Demand Forecasting**: Hybrid ML model (Weighted Moving Average + Seasonality) for SKU-level prediction.
- **📄 AP Automation (OCR)**: Real-time invoice scanning and automated ledger entry generation.
- **📈 Project Engine**: Integrated Gantt charts with task dependency tracking and budget utilization.
- **🔐 Enterprise Auth**: Multi-tenant isolation, Role-Based Access Control (RBAC), SSO (Keycloak), and MFA.
- **📝 Audit & Compliance**: Global interceptor logging every mutation for SOC 2 Type II readiness.
- **📱 PWA Enabled**: Full offline support and mobile-installable dashboard.

---

## 🏗 System Architecture

The suite operates as a microservices mesh:
1. **Frontend (Port 5000)**: Server-side rendered UI with real-time state synchronization.
2. **Backend (Port 3000)**: The core API gateway and business logic orchestrator.
3. **ML Service (Port 8000)**: Specialized Python service for heavy mathematical computations.
4. **TimescaleDB (Port 5433)**: Persistent storage optimized for financial and inventory telemetry.
5. **Redis (Port 6379)**: Fast distributed caching for session management and notifications.

---

## 📝 Compliance Note
This project adheres strictly to the **AMX-ERP-2026-04** specifications, fulfilling all functional requirements from F-01 to F-12.
