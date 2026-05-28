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
  tenantId: string;
  roleId: string;
  role?: Role;
  tenant?: string; // Legacy support
}

export interface LoginResponse {
  user: User;
  token: string;
  access_token?: string; // Legacy support
  mfaRequired?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  isActive: boolean;
  createdAt: string;
}

// Finance
export interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  balance: number;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  status: 'DRAFT' | 'POSTED' | 'VOIDED';
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

export interface LeaveRequest {
  id: string;
  employeeId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface PayrollRun {
  id: string;
  period: string;
  currency: string;
  status: 'DRAFT' | 'PROCESSING' | 'APPROVED' | 'PAID';
  totalEmployees: number;
}

// SCM
export interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  reorderThreshold: number;
}

export interface Vendor {
  id: string;
  name: string;
  code: string;
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
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  status?: string;
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
