const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface FetchOptions extends RequestInit {
  params?: Record<string, any>;
}

async function fetchApi<T = unknown>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;
  
  let url = `${API_BASE_URL}/api${endpoint}`;
  
  // Add query params if present
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

  // Get token from localStorage (client-side only)
  let headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      headers = {
        ...headers,
        Authorization: `Bearer ${token}`,
      };
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
        window.location.href = '/login';
      }
    }
    const error = await (response.json() as Promise<{ message?: string }>).catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// ============ Auth API ============
export const authApi = {
  login: (data: Record<string, unknown>) => fetchApi<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: Record<string, unknown>) => fetchApi<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
};

// ============ Users API ============
export const usersApi = {
  getAll: () => fetchApi<any[]>('/users'),
  getRoles: () => fetchApi<any[]>('/users/roles'),
  create: (data: Record<string, unknown>) => fetchApi<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => fetchApi<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<any>(`/users/${id}`, { method: 'DELETE' }),
};

// ============ Tenants API ============
export const tenantsApi = {
  getAll: () => fetchApi<any>('/tenants'),
  getById: (id: string) => fetchApi<any>(`/tenants/${id}`),
  create: (data: { name: string; domain?: string; settings?: any }) => 
    fetchApi<any>('/tenants', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; domain?: string; isActive?: boolean; settings?: any }) => 
    fetchApi<any>(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<any>(`/tenants/${id}`, { method: 'DELETE' }),
};

// ============ Finance API ============
export const financeApi = {
  getAccounts: (params?: { page?: number; limit?: number }) =>
    fetchApi<any>('/finance/accounts', { params }),
  createAccount: (data: Record<string, unknown>) =>
    fetchApi<any>('/finance/accounts', { method: 'POST', body: JSON.stringify(data) }),
  getJournalEntries: (params?: { page?: number; limit?: number; startDate?: string; endDate?: string; status?: string }) =>
    fetchApi<any>('/finance/journal-entries', { params }),
  createJournalEntry: (data: Record<string, unknown>) =>
    fetchApi<any>('/finance/journal-entries', { method: 'POST', body: JSON.stringify(data) }),
  getCurrencies: () =>
    fetchApi<any>('/finance/currencies'),
  getExchangeRates: () =>
    fetchApi<any>('/finance/exchange-rates'),
};

// ============ HR API ============
export const employeesApi = {
  getAll: () => fetchApi<any[]>('/employees'),
  create: (data: Record<string, unknown>) => fetchApi<any>('/employees', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => fetchApi<any>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<any>(`/employees/${id}`, { method: 'DELETE' }),
};

export const departmentsApi = {
  getAll: () => fetchApi<any[]>('/departments'),
  create: (data: Record<string, unknown>) => fetchApi<any>('/departments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => fetchApi<any>(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<any>(`/departments/${id}`, { method: 'DELETE' }),
};

export const leaveRequestsApi = {
  getAll: () => fetchApi<any[]>('/leave-requests'),
  create: (data: Record<string, unknown>) => fetchApi<any>('/leave-requests', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => fetchApi<any>(`/leave-requests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  approve: (id: string) => fetchApi<any>(`/leave-requests/${id}/approve`, { method: 'PUT' }),
  reject: (id: string) => fetchApi<any>(`/leave-requests/${id}/reject`, { method: 'PUT' }),
};

// ============ Inventory API ============
export const productsApi = {
  getAll: () => fetchApi<any[]>('/products'),
  create: (data: Record<string, unknown>) => fetchApi<any>('/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => fetchApi<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<any>(`/products/${id}`, { method: 'DELETE' }),
};

export const inventoryApi = {
  getAll: () => fetchApi<any[]>('/inventory'),
  getLowStock: () => fetchApi<any[]>('/inventory/low-stock'),
  update: (id: string, data: Record<string, unknown>) => fetchApi<any>(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adjust: (id: string, data: Record<string, unknown>) => fetchApi<any>(`/inventory/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
};

export const vendorsApi = {
  getAll: () => fetchApi<any[]>('/vendors'),
  create: (data: Record<string, unknown>) => fetchApi<any>('/vendors', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => fetchApi<any>(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<any>(`/vendors/${id}`, { method: 'DELETE' }),
};

export const purchaseOrdersApi = {
  getAll: () => fetchApi<any[]>('/purchase-orders'),
  create: (data: Record<string, unknown>) => fetchApi<any>('/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => fetchApi<any>(`/purchase-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  approve: (id: string) => fetchApi<any>(`/purchase-orders/${id}/approve`, { method: 'PUT' }),
  receive: (id: string) => fetchApi<any>(`/purchase-orders/${id}/receive`, { method: 'PUT' }),
  cancel: (id: string) => fetchApi<any>(`/purchase-orders/${id}/cancel`, { method: 'PUT' }),
};

// ============ Projects API ============
export const projectsApi = {
  getAll: () => fetchApi<any[]>('/projects'),
  getById: (id: string) => fetchApi<any>(`/projects/${id}`),
  create: (data: Record<string, unknown>) => fetchApi<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => fetchApi<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<any>(`/projects/${id}`, { method: 'DELETE' }),
  getMilestones: (projectId?: string) => fetchApi<any[]>('/projects/milestones/all', { params: { projectId } }),
  createMilestone: (data: Record<string, unknown>) => fetchApi<any>('/projects/milestones', { method: 'POST', body: JSON.stringify(data) }),
  updateMilestone: (id: string, data: Record<string, unknown>) => fetchApi<any>(`/projects/milestones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  createTask: (projectId: string, data: Record<string, unknown>) => fetchApi<any>(`/projects/${projectId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  getBudget: (projectId: string) => fetchApi<any>(`/projects/${projectId}/budget`),
  updateBudget: (projectId: string, data: Record<string, unknown>) => fetchApi<any>(`/projects/${projectId}/budget`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const tasksApi = {
  update: (id: string, data: Record<string, unknown>) => fetchApi<any>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ============ Notifications API ============
export const notificationsApi = {
  getAll: () => fetchApi<any>('/notifications'),
  markAsRead: (id: string) => fetchApi<any>(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllAsRead: () => fetchApi<any>('/notifications/read-all', { method: 'PUT' }),
  delete: (id: string) => fetchApi<any>(`/notifications/${id}`, { method: 'DELETE' }),
  getPreferences: () => fetchApi<any>('/notifications/preferences'),
  updatePreferences: (data: any) => fetchApi<any>('/notifications/preferences', { method: 'PUT', body: JSON.stringify(data) }),
};

// ============ Dashboard/Stats API ============
export const dashboardApi = {
  getStats: () => fetchApi<any>('/dashboard/stats'),
  getRecentActivity: () => fetchApi<any>('/dashboard/recent-activity'),
};

// ============ Forecast API (AI Demand Forecasting) ============
export const forecastApi = {
  forecastDemand: (data: { sku: string; periods?: number }) =>
    fetchApi<any>('/forecast/demand', { method: 'POST', body: JSON.stringify(data) }),
  getForecast: (sku: string, periods?: number) =>
    fetchApi<any>(`/forecast/demand/${sku}`, { params: { periods } }),
  addHistoricalData: (data: { sku: string; quantity: number; date: string }) =>
    fetchApi<any>('/forecast/historical', { method: 'POST', body: JSON.stringify(data) }),
  getTrends: (sku?: string) =>
    fetchApi<any>('/forecast/trends', { params: { sku } }),
};

// ============ OCR API (Invoice Parsing) ============
export const ocrApi = {
  parseInvoice: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_BASE_URL}/api/ocr/invoice`, {
      method: 'POST',
      headers: {
        Authorization: typeof window !== 'undefined' ? `Bearer ${localStorage.getItem('token')}` : '',
      },
      body: formData,
    }).then(r => r.json());
  },
  parseInvoiceText: (text: string) =>
    fetchApi<any>('/ocr/invoice/text', { method: 'POST', body: JSON.stringify({ text }) }),
};

// ============ Payroll API ============
export const payrollApi = {
  getRuns: () => fetchApi<any>('/payroll/runs'),
  createRun: (data: { period: string; currency: string }) =>
    fetchApi<any>('/payroll/runs', { method: 'POST', body: JSON.stringify(data) }),
  getRun: (id: string) => fetchApi<any>(`/payroll/runs/${id}`),
  approveRun: (id: string) => fetchApi<any>(`/payroll/runs/${id}/approve`, { method: 'POST' }),
  getPayslips: (runId: string) => fetchApi<any>(`/payroll/runs/${runId}/payslips`),
  getPayslip: (id: string) => fetchApi<any>(`/payroll/payslips/${id}`),
};

// ============ Audit API ============
export const auditApi = {
  getLogs: (params?: { page?: number; limit?: number; action?: string; userId?: string }) =>
    fetchApi<any>('/audit/logs', { params }),
  exportLogs: (params?: { from?: string; to?: string }) =>
    fetchApi<any>('/audit/logs/export', { params }),
};

// ============ Webhooks API ============
export const webhooksApi = {
  getAll: () => fetchApi<any>('/webhooks'),
  create: (data: { url: string; events: string[]; secret?: string }) =>
    fetchApi<any>('/webhooks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { url?: string; events?: string[]; isActive?: boolean }) =>
    fetchApi<any>(`/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => fetchApi<any>(`/webhooks/${id}`, { method: 'DELETE' }),
  test: (id: string) => fetchApi<any>(`/webhooks/${id}/test`, { method: 'POST' }),
  getDeliveries: (id: string) => fetchApi<any>(`/webhooks/${id}/deliveries`),
};

// ============ Reports API ============
export const reportsApi = {
  getAll: () => fetchApi<any>('/reports'),
  generate: (type: string, params?: any) =>
    fetchApi<any>('/reports/generate', { method: 'POST', body: JSON.stringify({ type, ...params }) }),
  download: (id: string, format: 'pdf' | 'excel') =>
    fetchApi<any>(`/reports/${id}/download?format=${format}`),
};

export default fetchApi;