import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  userId?: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantId(): string | undefined {
  return tenantContextStorage.getStore()?.tenantId;
}

export function getUserId(): string | undefined {
  return tenantContextStorage.getStore()?.userId;
}
