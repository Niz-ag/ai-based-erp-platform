import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  constructor(private auditService: AuditService, private prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const { user, method, url, body, ip, params } = request;

    // Only log mutations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      // Avoid logging the login path to prevent password leak in newValue
      if (url.includes('/auth/login')) return next.handle();

      let userId = user?.id;
      if (!userId && request.headers?.authorization?.startsWith('Bearer ')) {
        try {
          const token = request.headers.authorization.split(' ')[1];
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          userId = payload.sub || payload.id || payload.userId;
        } catch (e) {
          this.logger.warn(`Failed to parse token for audit logging: ${e.message}`);
        }
      }

      let oldValue: any = undefined;
      const entityId = params?.id || params?.code || params?.sku || params?.name || params?.orderNumber || params?.rfqNumber || params?.employeeCode || params?.entryNumber;
      const entityType = this.getEntityType(url, params);

      if (['PUT', 'PATCH', 'DELETE'].includes(method) && entityId) {
        const modelName = this.getModelName(entityType);
        if (modelName && (this.prisma as any)[modelName]) {
          try {
            // Determine the key to use for findUnique/findFirst
            const where: any = {};
            if (params?.id) where.id = params.id;
            else if (params?.code) where.code = params.code;
            else if (params?.sku) where.sku = params.sku;
            else if (params?.name) where.name = params.name;
            else if (params?.orderNumber) where.orderNumber = params.orderNumber;
            else if (params?.rfqNumber) where.rfqNumber = params.rfqNumber;
            else if (params?.employeeCode) where.employeeCode = params.employeeCode;
            else if (params?.entryNumber) where.entryNumber = params.entryNumber;

            // Fetch the full record BEFORE the operation completes
            oldValue = await (this.prisma as any)[modelName].findFirst({ where });
          } catch (e) {
            this.logger.error(`Failed to fetch oldValue for audit log (${modelName}): ${e.message}`);
          }
        }
      }

      return next.handle().pipe(
        tap({
          next: (data) => {
            if (userId) {
              this.auditService.log({
                userId,
                action: method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE',
                entityType,
                entityId: data?.id || data?.code || data?.sku || data?.orderNumber || data?.rfqNumber || data?.employeeCode || data?.entryNumber || entityId,
                oldValue,
                newValue: method !== 'DELETE' ? body : undefined,
                ipAddress: ip,
                userAgent: request.headers['user-agent'],
              }).catch(err => this.logger.error(`Audit logging failed: ${err.message}`));
            }
          },
          error: (err) => {
            if (userId) {
              this.auditService.log({
                userId,
                action: method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE',
                entityType,
                entityId,
                oldValue,
                newValue: method !== 'DELETE' ? body : undefined,
                ipAddress: ip,
                userAgent: request.headers['user-agent'],
              }).catch(logErr => this.logger.error(`Audit logging failed for error state: ${logErr.message}`));
            }
          }
        }),
      );
    }

    return next.handle();
  }

  private getEntityType(url: string, params: any): string {
    const path = url.split('?')[0];
    const parts = path.split('/');
    
    // If params.id is at the end, use the part before it
    if (params?.id && parts[parts.length - 1] === params.id) {
      return parts[parts.length - 2] || 'UNKNOWN';
    }
    
    // If params.id is the second to last part (e.g. /projects/:id/budget)
    if (params?.id && parts[parts.length - 2] === params.id) {
      return parts[parts.length - 3] || 'UNKNOWN';
    }

    // Default to parts[3] which is the resource name in /api/v1/resource
    // Some routes might be different, let's try to find a known resource name
    for (const part of parts.reverse()) {
      if (['v1', 'api', ''].includes(part)) continue;
      if (Object.keys(this.getModelNameMap()).includes(part)) return part;
    }

    return parts[3] || 'UNKNOWN';
  }

  private getModelNameMap(): Record<string, string> {
    return {
      'departments': 'department',
      'employees': 'employee',
      'roles': 'role',
      'users': 'user',
      'vendors': 'vendor',
      'products': 'product',
      'inventory': 'inventory',
      'purchase-orders': 'purchaseOrder',
      'sales-orders': 'salesOrder',
      'customers': 'customer',
      'leads': 'lead',
      'attendance': 'attendance',
      'leave-requests': 'leaveRequest',
      'leave-balances': 'leaveBalance',
      'projects': 'project',
      'tasks': 'task',
      'milestones': 'milestone',
      'payroll': 'payrollRun',
      'payroll-runs': 'payrollRun',
      'payslips': 'payslip',
      'tax-slabs': 'taxSlab',
      'webhooks': 'webhookSubscription',
      'reports': 'report',
      'rfq': 'requestForQuote',
      'request-for-quotes': 'requestForQuote',
      'budget': 'projectBudget',
      'project-budgets': 'projectBudget',
      'sequences': 'sequence',
      'journal-entries': 'journalEntry',
      'accounts': 'account',
      'currencies': 'currency',
      'exchange-rates': 'exchangeRate',
      'notifications': 'notification',
      'task-dependencies': 'taskDependency',
      'sku-history': 'skuHistory',
      'tenants': 'tenant',
      'inventory-transactions': 'inventoryTransaction',
      'purchase-order-lines': 'purchaseOrderLine',
      'sales-order-lines': 'salesOrderLine',
      'notification-preferences': 'notificationPreference',
      'dashboard-layouts': 'dashboardLayout',
      'tenant-settings': 'tenantSetting',
      'webhook-deliveries': 'webhookDelivery',
      'request-for-quote-lines': 'requestForQuoteLine',
      'bank-statement-lines': 'bankStatementLine',
      'journal-lines': 'journalLine',
    };
  }

  private getModelName(resource: string): string | null {
    const standardMap = this.getModelNameMap();

    if (standardMap[resource]) return standardMap[resource];

    // Heuristic: remove trailing 's' and convert kebab-case to camelCase
    const singular = resource.endsWith('s') ? resource.slice(0, -1) : resource;
    return singular.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }
}

