/**
 * AI MANDATE: Production-Grade API Client (No Vibe Coding)
 * Strict typing, robust error handling, and centralized authentication.
 */

import { 
  User, Tenant, Account, JournalEntry, Employee, 
  Product, PurchaseOrder, AuditLog, PaginatedResponse,
  LoginResponse, Currency, Department, LeaveRequest,
  Vendor, Project, Task, Milestone, PayrollRun, Role
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface FetchOptions extends RequestInit {
  params?: Record<string, any>;
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
        localStorage.removeItem('token');
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        window.location.href = '/login';
      }
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
};

// ============ Users API ============
export const usersApi = {
  getAll: () => fetchApi<User[]>('/users'),
  getRoles: () => fetchApi<Role[]>('/users/roles'),
  create: (data: Partial<User>) => fetchApi<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
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
    fetchApi<PaginatedResponse<Account>>('/finance/accounts', { params }),
  createAccount: (data: any) => fetchApi<Account>('/finance/accounts', { method: 'POST', body: JSON.stringify(data) }),
  getJournalEntries: (params?: { page?: number; limit?: number; status?: string }) =>
    fetchApi<PaginatedResponse<JournalEntry>>('/finance/journal-entries', { params }),
  createJournalEntry: (data: Partial<JournalEntry>) =>
    fetchApi<JournalEntry>('/finance/journal-entries', { method: 'POST', body: JSON.stringify(data) }),
  getCurrencies: () => fetchApi<Currency[]>('/finance/currencies'),
};

// ============ HR API ============
export const employeesApi = {
  getAll: () => fetchApi<Employee[]>('/employees'),
  create: (data: Partial<Employee>) => fetchApi<Employee>('/employees', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<void>(`/employees/${id}`, { method: 'DELETE' }),
};

export const departmentsApi = {
  getAll: () => fetchApi<Department[]>('/departments'),
  create: (data: any) => fetchApi<Department>('/departments', { method: 'POST', body: JSON.stringify(data) }),
};

export const leaveRequestsApi = {
  getAll: () => fetchApi<LeaveRequest[]>('/leave-requests'),
  approve: (id: string) => fetchApi<void>(`/leave-requests/${id}/approve`, { method: 'PUT' }),
  reject: (id: string) => fetchApi<void>(`/leave-requests/${id}/reject`, { method: 'PUT' }),
};

// ============ Inventory / SCM ============
export const productsApi = {
  getAll: () => fetchApi<Product[]>('/products'),
  create: (data: any) => fetchApi<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
};

export const inventoryApi = {
  getAll: () => fetchApi<any[]>('/inventory'),
  getLowStock: () => fetchApi<any[]>('/inventory/low-stock'),
  adjust: (id: string, data: any) => fetchApi<void>(`/inventory/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
};

export const vendorsApi = {
  getAll: () => fetchApi<Vendor[]>('/vendors'),
  create: (data: any) => fetchApi<Vendor>('/vendors', { method: 'POST', body: JSON.stringify(data) }),
};

export const purchaseOrdersApi = {
  getAll: () => fetchApi<PurchaseOrder[]>('/purchase-orders'),
  create: (data: any) => fetchApi<PurchaseOrder>('/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
  approve: (id: string) => fetchApi<void>(`/purchase-orders/${id}/approve`, { method: 'PUT' }),
  receive: (id: string) => fetchApi<void>(`/purchase-orders/${id}/receive`, { method: 'PUT' }),
};

// ============ Projects ============
export const projectsApi = {
  getAll: () => fetchApi<Project[]>('/projects'),
  getById: (id: string) => fetchApi<Project>(`/projects/${id}`),
  create: (data: any) => fetchApi<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => fetchApi<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<void>(`/projects/${id}`, { method: 'DELETE' }),
  getMilestones: (projectId?: string) => fetchApi<Milestone[]>('/projects/milestones/all', { params: { projectId } }),
  createMilestone: (data: any) => fetchApi<Milestone>('/projects/milestones', { method: 'POST', body: JSON.stringify(data) }),
  createTask: (projectId: string, data: any) => fetchApi<Task>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  getBudget: (projectId: string) => fetchApi<any>(`/projects/${projectId}/budget`),
};

export const tasksApi = {
  update: (id: string, data: any) => fetchApi<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ============ Notifications ============
export const notificationsApi = {
  getAll: () => fetchApi<any[]>('/notifications'),
  markAsRead: (id: string) => fetchApi<void>(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllAsRead: () => fetchApi<void>('/notifications/read-all', { method: 'PUT' }),
  delete: (id: string) => fetchApi<void>(`/notifications/${id}`, { method: 'DELETE' }),
  getPreferences: () => fetchApi<any>('/notifications/preferences'),
  updatePreferences: (data: any) => fetchApi<void>('/notifications/preferences', { method: 'PUT', body: JSON.stringify(data) }),
};

// ============ Dashboard ============
export const dashboardApi = {
  getStats: () => fetchApi<any>('/dashboard/stats'),
  getRecentActivity: () => fetchApi<any[]>('/dashboard/recent-activity'),
};

// ============ AI / Forecast ============
export const forecastApi = {
  getTrends: (sku?: string) => fetchApi<any>('/forecast/trends', { params: { sku } }),
  getForecast: (sku: string) => fetchApi<any>(`/forecast/demand/${sku}`),
};

// ============ OCR ============
export const ocrApi = {
  parseInvoice: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetchApi<any>('/ocr/invoice', {
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
  getPayslips: (runId: string) => fetchApi<any[]>(`/payroll/runs/${runId}/payslips`),
};

// ============ Audit ============
export const auditApi = {
  getLogs: (params?: { page?: number; limit?: number; action?: string; userId?: string }) =>
    fetchApi<PaginatedResponse<AuditLog>>('/audit/logs', { params }),
  exportLogs: () => fetchApi<{ csv: string }>('/audit/logs/export'),
};

// ============ Webhooks ============
export const webhooksApi = {
  getAll: () => fetchApi<any[]>('/webhooks'),
  create: (data: any) => fetchApi<any>('/webhooks', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<void>(`/webhooks/${id}`, { method: 'DELETE' }),
  test: (id: string) => fetchApi<any>(`/webhooks/${id}/test`, { method: 'POST' }),
};

// ============ Reports ============
export const reportsApi = {
  getAll: () => fetchApi<any[]>('/reports'),
  generate: (type: string) => fetchApi<any>('/reports/generate', { method: 'POST', body: JSON.stringify({ type }) }),
};

export default fetchApi;
