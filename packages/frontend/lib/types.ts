/**
 * AI MANDATE: Strict Typing (No Vibe Coding)
 * These types are the source of truth for the frontend and must align with the backend Prisma schema.
 */

export type UserRole = 'superadmin' | 'admin' | 'manager' | 'user' | 'viewer';

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string; // Display name
  isActive: boolean;
  mfaEnabled: boolean;
  theme?: string;
  language?: string;
  avatar?: string;
  tenantId: string;
  roleId: string;
  role?: Role;
  tenant?: {
    id: string;
    name: string;
  };
}

export interface LoginResponse {
  user: User;
  token: string;
  access_token?: string; // Legacy support
  mfaRequired?: boolean;
  mfaToken?: string;
  message?: string;
}

export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  isActive: boolean;
  createdAt: string;
  _count?: {
    users: number;
  };
}

// Finance
export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  balance: number;
}

export interface JournalLine {
  id?: string;
  accountId: string;
  account?: Account;
  debit?: number;
  credit?: number;
  baseDebit?: number;
  baseCredit?: number;
  currencyId?: string;
  currency?: Currency;
  exchangeRate?: number;
  description?: string;
}

export interface JournalEntry {
  id?: string;
  entryNumber?: string;
  date: string;
  description: string;
  status: 'DRAFT' | 'POSTED' | 'VOIDED';
  lines?: JournalLine[];
  totalAmount?: number;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol?: string;
}

// HR
export interface Department {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId?: string;
  position?: string;
  isActive: boolean;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  clockIn: string;
  clockOut?: string;
  status: string;
  employee?: Employee;
}

export interface AttendanceStatus {
  isClockedIn: boolean;
  lastAttendance: AttendanceRecord | null;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employee?: Employee;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface PayrollRun {
  id: string;
  period: string;
  currency: string;
  status: 'DRAFT' | 'PROCESSING' | 'APPROVED' | 'PAID' | 'COMPLETED' | 'CANCELLED';
  totalEmployees: number;
  totalAmount?: number;
}

export interface Payslip {
  id: string;
  runId: string;
  employeeId: string;
  employee?: Employee;
  grossSalary: number;
  netSalary: number;
  taxDeduction: number;
  otherDeductions: number;
  allowances: number;
  createdAt: string;
}

export interface TaxSlab {
  id: string;
  minIncome: number;
  maxIncome: number | null;
  rate: number;
  fixedAmount: number;
}

// SCM
export interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  reorderThreshold: number;
}

export interface InventoryItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  location?: string;
  lastUpdated: string;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  quantity: number;
  type: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'RETURN';
  reference?: string;
  reasonCode?: string;
  notes?: string;
  createdAt: string;
  createdById: string;
  createdBy: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

export interface Vendor {
  id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  status: string;
  source?: string;
  createdAt: string;
}

export interface RFQ {
  id: string;
  rfqNumber: string;
  vendorId: string;
  vendor?: Vendor;
  status: string;
  requestDate: string;
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customer?: Customer;
  status: string;
  totalAmount: number;
  orderDate: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  vendorId: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';
  orderDate: string;
  totalAmount: number;
}

// Projects
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  tasks?: Task[];
  milestones?: Milestone[];
  budget?: {
    plannedAmount: number;
    actualAmount: number;
    notes?: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  startDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  assignee?: User;
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  status?: string;
  amount?: number;
  projectId: string;
  dueDate?: string;
}

// Notifications
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  marketing: boolean;
}

// Dashboard
export interface DashboardStats {
  totalRevenue: number;
  activeUsers: number;
  pendingOrders: number;
  lowStockItems: number;
  employees?: number;
  projects?: number;
  accounts?: number;
  purchaseOrders?: number;
  lowStock?: number;
}

export interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  userId: string;
  user?: Partial<User>;
}

// AI / Forecast
export interface ForecastTrend {
  date: string;
  value: number;
}

export interface DemandForecast {
  sku: string;
  forecast: ForecastTrend[];
  trend?: string | number;
  forecasts?: any[];
}

// Webhooks
export interface Webhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
}

// Reports
export interface Report {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
}

export interface ReportSchedule {
  id: string;
  reportType: string;
  frequency: string;
  recipients: string[];
  nextRun: string;
}

// Settings
export interface SystemSettings {
  organizationName: string;
  currency: string;
  timezone: string;
}

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  secure: boolean;
}

// Audit
export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  userId: string;
  user?: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  createdAt: string;
  hash: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  total?: number; // Legacy support
}
