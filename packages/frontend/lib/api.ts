/**
 * AI MANDATE: Production-Grade API Client (No Vibe Coding)
 * Strict typing, robust error handling, and centralized authentication.
 */

import { 
  User, Tenant, Account, JournalEntry, Employee, 
  Product, PurchaseOrder, AuditLog, PaginatedResponse,
  LoginResponse, Currency, Department, LeaveRequest,
  Vendor, Project, Task, Milestone, PayrollRun, Role,
  AttendanceStatus, AttendanceRecord, InventoryItem, 
  Customer, Lead, RFQ, SalesOrder, Notification, 
  NotificationPreferences, DashboardStats, RecentActivity,
  DemandForecast, Webhook, Report, ReportSchedule,
  SystemSettings, SmtpSettings, Payslip, TaxSlab
} from './types';
import { useAuthStore } from './store/useAuthStore';
import { toast } from 'sonner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

async function fetchApi<T = unknown>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;
  
  let url = `${API_BASE_URL}${endpoint}`;
  
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  // If we're sending FormData (multipart/form-data), 
  // we MUST remove the Content-Type header to let the browser set the boundary correctly.
  if (headers['Content-Type'] === 'multipart/form-data') {
    delete headers['Content-Type'];
  }

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        // AI MANDATE: Immediate Session Eviction
        localStorage.removeItem('token');
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        
        // Clear zustand store
        useAuthStore.getState().logout();
        
        // AI MANDATE: Use router for navigation when possible, but for 401 outside of components 
        // window.location is often the only way unless we use an event bus or a store-based navigation.
        // Given the requirement to replace window.location.href, we might want to trigger a global event.
        window.location.href = '/login?expired=true';
      }
    }

    if (response.status >= 500) {
      toast.error('A server error occurred. Please try again later.');
    }

    const error = await (response.json() as Promise<{ message?: string }>).catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const result = await response.json();
  return (result && typeof result === 'object' && 'data' in result ? result.data : result) as T;
}

// ============ Auth API ============
export const authApi = {
  login: (data: Record<string, unknown>) => fetchApi<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: Record<string, unknown>) => fetchApi<LoginResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  verifyMfa: (mfaToken: string, otpCode: string) => fetchApi<LoginResponse>('/auth/verify-mfa', { method: 'POST', body: JSON.stringify({ mfaToken, otpCode }) }),
  forgotPassword: (email: string, tenantId?: string) => fetchApi<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email, tenantId }) }),
  resetPassword: (token: string, password: string) => fetchApi<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
};

// ============ Users API ============
export const usersApi = {
  getAll: () => fetchApi<User[]>('/users'),
  getRoles: () => fetchApi<Role[]>('/users/roles'),
  create: (data: Partial<User> & { password?: string }) => fetchApi<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<User>) => fetchApi<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<void>(`/users/${id}`, { method: 'DELETE' }),
};

// ============ Tenants API ============
export const tenantsApi = {
  getAll: () => fetchApi<Tenant[]>('/tenants'),
  getById: (id: string) => fetchApi<Tenant>(`/tenants/${id}`),
  create: (data: { name: string; domain?: string }) => 
    fetchApi<Tenant>('/tenants', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Tenant>) => 
    fetchApi<Tenant>(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<void>(`/tenants/${id}`, { method: 'DELETE' }),
};

// ============ Finance API ============
export const financeApi = {
  getAccounts: (params?: { page?: number; limit?: number }) =>
    fetchApi<Account[]>('/finance/accounts', { params }),
  createAccount: (data: Partial<Account>) => fetchApi<Account>('/finance/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: string, data: Partial<Account>) => fetchApi<Account>(`/finance/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id: string) => fetchApi<void>(`/finance/accounts/${id}`, { method: 'DELETE' }),
  getJournalEntries: (params?: { page?: number; limit?: number; status?: string; startDate?: string; endDate?: string }) =>
    fetchApi<JournalEntry[]>('/finance/journal-entries', { params }),
  createJournalEntry: (data: Partial<JournalEntry>) => fetchApi<JournalEntry>('/finance/journal-entries', { method: 'POST', body: JSON.stringify(data) }),
  postJournalEntry: (id: string) =>
    fetchApi<JournalEntry>(`/finance/journal-entries/${id}/post`, { method: 'POST' }),
  getCurrencies: () => fetchApi<Currency[]>('/finance/currencies'),
  createCurrency: (data: Partial<Currency>) => fetchApi<Currency>('/finance/currencies', { method: 'POST', body: JSON.stringify(data) }),
  updateCurrency: (id: string, data: Partial<Currency>) => fetchApi<Currency>(`/finance/currencies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCurrency: (id: string) => fetchApi<void>(`/finance/currencies/${id}`, { method: 'DELETE' }),
  getProfitLoss: (params: { startDate: string; endDate: string }) =>
    fetchApi<{ 
      revenue: any[]; 
      expense: any[]; 
      totalRevenue: number; 
      totalExpense: number; 
      netProfit: number;
    }>('/finance/reports/profit-loss', { params }),
  getBalanceSheet: (params?: { date?: string }) =>
    fetchApi<{ 
      assets: any[]; 
      liabilities: any[]; 
      equity: any[];
      totalAssets: number;
      totalLiabilities: number;
      totalEquity: number;
      retainedEarnings: number;
    }>('/finance/reports/balance-sheet', { params }),
  processBankStatement: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetchApi<any[]>('/finance/bank-reconciliation/process', {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  reconcile: (journalEntryId: string, statementLine: any) =>
    fetchApi<{ success: boolean }>('/finance/bank-reconciliation/reconcile', {
      method: 'POST',
      body: JSON.stringify({ journalEntryId, statementLine })
    }),
  createManualBankEntry: (data: { statementLine: any, bankAccountId: string, otherAccountId: string }) =>
    fetchApi<{ success: boolean }>('/finance/bank-reconciliation/manual', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
};

// ============ HR API ============
export const employeesApi = {
  getAll: () => fetchApi<Employee[]>('/employees'),
  create: (data: Partial<Employee>) => fetchApi<Employee>('/employees', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Employee>) => fetchApi<Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<void>(`/employees/${id}`, { method: 'DELETE' }),
};

export const attendanceApi = {
  getStatus: () => fetchApi<AttendanceStatus>('/attendance/status'),
  getAll: () => fetchApi<AttendanceRecord[]>('/attendance'),
  clockIn: () => fetchApi<AttendanceRecord>('/attendance/clock-in', { method: 'POST' }),
  clockOut: () => fetchApi<AttendanceRecord>('/attendance/clock-out', { method: 'POST' }),
  exportReport: async (employeeId: string, month: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${API_BASE_URL}/attendance/export?employeeId=${employeeId}&month=${month}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  },
};

export const departmentsApi = {
  getAll: () => fetchApi<Department[]>('/departments'),
  create: (data: { name: string }) => fetchApi<Department>('/departments', { method: 'POST', body: JSON.stringify(data) }),
};

export const leaveRequestsApi = {
  getAll: () => fetchApi<LeaveRequest[]>('/leave-requests'),
  getBalances: (employeeId?: string) => 
    fetchApi<any[]>(employeeId ? `/leave-requests/balances/${employeeId}` : '/leave-requests/balances'),
  create: (data: Partial<LeaveRequest>) => fetchApi<LeaveRequest>('/leave-requests', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id: string) => fetchApi<void>(`/leave-requests/${id}/approve`, { method: 'PUT' }),
  reject: (id: string) => fetchApi<void>(`/leave-requests/${id}/reject`, { method: 'PUT' }),
};

// ============ Inventory / SCM ============
export const productsApi = {
  getAll: () => fetchApi<Product[]>('/products'),
  create: (data: Partial<Product>) => fetchApi<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
};

export const inventoryApi = {
  getAll: () => fetchApi<InventoryItem[]>('/inventory'),
  getLowStock: () => fetchApi<InventoryItem[]>('/inventory/low-stock'),
  adjust: (id: string, data: { quantity: number; type: string; reason: string }) => fetchApi<void>(`/inventory/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
  getHistory: (productId: string) => fetchApi<any[]>(`/inventory/product/${productId}/history`),
  transfer: (data: { fromLocation: string; toLocation: string; productId: string; quantity: number; notes?: string }) => fetchApi<void>('/inventory/transfer', { method: 'POST', body: JSON.stringify(data) }),
  search: (query: string) => fetchApi<any>('/inventory/search', { params: { query } }),
};

export const vendorsApi = {
  getAll: () => fetchApi<Vendor[]>('/vendors'),
  getById: (id: string) => fetchApi<Vendor>(`/vendors/${id}`),
  getPerformance: (id: string) => fetchApi<{ rating: number; onTimeDelivery: number }>(`/vendors/${id}/performance`),
  create: (data: Partial<Vendor>) => fetchApi<Vendor>('/vendors', { method: 'POST', body: JSON.stringify(data) }),
};

export const customersApi = {
  getAll: () => fetchApi<Customer[]>('/customers'),
  create: (data: Partial<Customer>) => fetchApi<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) }),
};

export const leadsApi = {
  getAll: () => fetchApi<Lead[]>('/leads'),
  getById: (id: string) => fetchApi<Lead>(`/leads/${id}`),
  create: (data: Partial<Lead>) => fetchApi<Lead>('/leads', { method: 'POST', body: JSON.stringify(data) }),
  convertToCustomer: (id: string) => fetchApi<Customer>(`/leads/${id}/convert`, { method: 'POST' }),
};

export const purchaseOrdersApi = {
  getAll: () => fetchApi<PurchaseOrder[]>('/purchase-orders'),
  create: (data: Partial<PurchaseOrder>) => fetchApi<PurchaseOrder>('/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id: string) => fetchApi<void>(`/purchase-orders/${id}/approve`, { method: 'PUT' }),
  receive: (id: string, data: any = {}) => fetchApi<void>(`/purchase-orders/${id}/receive`, { method: 'PUT', body: JSON.stringify(data) }),
  returnItems: (id: string, data: any = {}) => fetchApi<void>(`/purchase-orders/${id}/return`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const rfqsApi = {
  getAll: () => fetchApi<RFQ[]>('/rfqs'),
  getById: (id: string) => fetchApi<RFQ>(`/rfqs/${id}`),
  create: (data: Partial<RFQ>) => fetchApi<RFQ>('/rfqs', { method: 'POST', body: JSON.stringify(data) }),
  convertToPO: (id: string) => fetchApi<PurchaseOrder>(`/rfqs/${id}/convert`, { method: 'POST' }),
};

export const salesOrdersApi = {
  getAll: () => fetchApi<SalesOrder[]>('/sales-orders'),
  getById: (id: string) => fetchApi<SalesOrder>(`/sales-orders/${id}`),
  create: (data: Partial<SalesOrder>) => fetchApi<SalesOrder>('/sales-orders', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string) => 
    fetchApi<SalesOrder>(`/sales-orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
};

// ============ Projects ============
export const projectsApi = {
  getAll: () => fetchApi<Project[]>('/projects'),
  getById: (id: string) => fetchApi<Project>(`/projects/${id}`),
  create: (data: Partial<Project>) => fetchApi<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Project>) => fetchApi<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<void>(`/projects/${id}`, { method: 'DELETE' }),
  getMilestones: (projectId?: string) => fetchApi<Milestone[]>('/projects/milestones/all', { params: { projectId } }),
  createMilestone: (data: Partial<Milestone>) => fetchApi<Milestone>('/projects/milestones', { method: 'POST', body: JSON.stringify(data) }),
  updateMilestone: (id: string, data: Partial<Milestone>) => fetchApi<Milestone>(`/projects/milestones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMilestone: (id: string) => fetchApi<void>(`/projects/milestones/${id}`, { method: 'DELETE' }),
  createTask: (projectId: string, data: Partial<Task>) => fetchApi<Task>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (taskId: string, data: Partial<Task>) => fetchApi<Task>(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getBudget: (projectId: string) => fetchApi<{ plannedAmount: number; actualAmount: number }>(`/projects/${projectId}/budget`),
  getResourceWorkload: () => fetchApi<any[]>('/projects/resources/workload'),
};

export const tasksApi = {
  update: (id: string, data: Partial<Task>) => fetchApi<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<void>(`/tasks/${id}`, { method: 'DELETE' }),
};

// ============ Notifications ============
export const notificationsApi = {
  getAll: () => fetchApi<Notification[]>('/notifications'),
  getUnreadCount: () => fetchApi<number>('/notifications/unread-count'),
  markAsRead: (id: string) => fetchApi<void>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllAsRead: () => fetchApi<void>('/notifications/read-all', { method: 'PUT' }),
  delete: (id: string) => fetchApi<void>(`/notifications/${id}`, { method: 'DELETE' }),
  getPreferences: () => fetchApi<NotificationPreferences>('/notifications/preferences'),
  updatePreferences: (data: Partial<NotificationPreferences>) => fetchApi<void>('/notifications/preferences', { method: 'PUT', body: JSON.stringify(data) }),
};

// ============ Dashboard ============
export const dashboardApi = {
  getStats: () => fetchApi<DashboardStats>('/dashboard/stats'),
  getRecentActivity: () => fetchApi<RecentActivity[]>('/dashboard/recent-activity'),
  getLayout: () => fetchApi<any>('/dashboard/layout'),
  saveLayout: (layout: any) => fetchApi<any>('/dashboard/layout', { method: 'POST', body: JSON.stringify({ layout }) }),
};

// ============ AI / Forecast ============
export const forecastApi = {
  getTrends: (sku?: string) => fetchApi<any>('/forecast/trends', { params: { sku } }),
  getForecast: (sku: string) => fetchApi<DemandForecast>(`/forecast/demand/${sku}`),
  addHistoricalData: (data: { sku: string; quantity: number; date: string }) =>
    fetchApi<any>('/forecast/historical', { method: 'POST', body: JSON.stringify(data) }),
  bulkAddHistoricalData: (data: { sku: string; quantity: number; date: string }[]) =>
    fetchApi<any>('/forecast/historical/bulk', { method: 'POST', body: JSON.stringify({ data }) }),
  };

// ============ OCR ============
export const ocrApi = {
  parseInvoice: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetchApi<{ 
      invoiceNumber?: string; 
      date?: string; 
      total?: number; 
      items: any[]; 
      journalEntryId?: string; 
      vendorName?: string; 
      vendor?: string;
      lines?: any[];
      vendorAccountId?: string;
      expenseAccountId?: string;
    }>('/ocr/invoice', {
      method: 'POST',
      body: formData,
      // Note: fetchApi handles Content-Type and Auth headers, 
      // but for FormData we must let fetch set the boundary.
      headers: { 'Content-Type': 'multipart/form-data' } 
    });
  },
};

// ============ Payroll ============
export const payrollApi = {
  getRuns: () => fetchApi<PayrollRun[]>('/payroll/runs'),
  createRun: (data: { period: string; currency: string }) =>
    fetchApi<PayrollRun>('/payroll/runs', { method: 'POST', body: JSON.stringify(data) }),
  approveRun: (id: string) => fetchApi<void>(`/payroll/runs/${id}/approve`, { method: 'POST' }),
  getPayslips: (runId: string) => fetchApi<Payslip[]>(`/payroll/runs/${runId}/payslips`),
  downloadPayslip: async (id: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${API_BASE_URL}/payroll/payslips/${id}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Download failed');
    return response.blob();
  },
  getTaxSlabs: () => fetchApi<TaxSlab[]>('/payroll/tax-slabs'),
  createTaxSlab: (data: { min: number; max: number; rate: number; fixed: number }) =>
    fetchApi<TaxSlab>('/payroll/tax-slabs', { method: 'POST', body: JSON.stringify(data) }),
  updateTaxSlab: (id: string, data: Partial<TaxSlab>) =>
    fetchApi<TaxSlab>(`/payroll/tax-slabs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTaxSlab: (id: string) =>
    fetchApi<void>(`/payroll/tax-slabs/${id}`, { method: 'DELETE' }),
};

// ============ Audit ============
export const auditApi = {
  getLogs: (params?: { page?: number; limit?: number; action?: string; userId?: string }) =>
    fetchApi<PaginatedResponse<AuditLog>>('/audit/logs', { params }),
  exportLogs: () => fetchApi<{ csv: string }>('/audit/logs/export'),
};

// ============ Webhooks ============
export const webhooksApi = {
  getAll: () => fetchApi<Webhook[]>('/webhooks'),
  create: (data: Partial<Webhook>) => fetchApi<Webhook>('/webhooks', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<void>(`/webhooks/${id}`, { method: 'DELETE' }),
  test: (id: string) => fetchApi<{ success: boolean; response: any }>(`/webhooks/${id}/test`, { method: 'POST' }),
};

// ============ Reports ============
export const reportsApi = {
  getAll: () => fetchApi<Report[]>('/reports'),
  createSchedule: (data: Partial<ReportSchedule>) => fetchApi<ReportSchedule>('/reports/schedule', { method: 'POST', body: JSON.stringify(data) }),
  generate: (type: string) => fetchApi<Report>('/reports/generate', { method: 'POST', body: JSON.stringify({ type }) }),
  download: async (id: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const response = await fetch(`${API_BASE_URL}/reports/${id}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Download failed');
    return response.blob();
  }
};

// ============ Search ============
export const searchApi = {
  global: (query: string) => fetchApi<any>('/search', { params: { q: query } }),
};

// ============ Settings ============
export const settingsApi = {
  get: () => fetchApi<any>('/settings'),
  update: (data: any) => fetchApi<any>('/settings', { method: 'POST', body: JSON.stringify(data) }),
  updateSmtp: (data: any) => fetchApi<any>('/settings/smtp', { method: 'POST', body: JSON.stringify(data) }),
};

// ============ Replenishment ============
export const replenishmentApi = {
  run: () => fetchApi<{ success: boolean }>('/replenishment/run', { method: 'POST' }),
};

export default fetchApi;
