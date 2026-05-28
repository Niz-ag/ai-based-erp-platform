import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, method, url, body, ip } = request;

    // Only log mutations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && user) {
      // Avoid logging the login path to prevent password leak in newValue
      if (url.includes('/auth/login')) return next.handle();

      return next.handle().pipe(
        tap((data) => {
          this.auditService.log({
            userId: user.id,
            action: method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE',
            entityType: this.getEntityType(url),
            entityId: data?.id || request.params?.id,
            newValue: method !== 'DELETE' ? body : undefined,
            ipAddress: ip,
            userAgent: request.headers['user-agent'],
          }).catch(console.error);
        }),
      );
    }

    return next.handle();
  }

  private getEntityType(url: string): string {
    const parts = url.split('/');
    // Assuming /api/v1/resource/:id format, resource is at index 3
    return parts[3] || 'UNKNOWN';
  }
}
