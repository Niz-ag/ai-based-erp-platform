-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- The actual table creation is handled by Prisma db push, 
-- but we need this SQL to convert it to a hypertable.
-- This ensures F-09 compliance (Audit in TimescaleDB).

SELECT create_hypertable('audit_logs', 'createdAt', if_not_exists => TRUE);
