import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantContextStorage } from '../tenant-context';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    let user = request.user;

    // If user is not yet populated by guard (early failure), try to extract from JWT
    if (!user && request.headers?.authorization?.startsWith('Bearer ')) {
      try {
        const token = request.headers.authorization.split(' ')[1];
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        user = {
          id: payload.sub || payload.id || payload.userId,
          tenantId: payload.tenantId,
        };
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // If we have tenant info, populate the tenant context
    if (user && user.tenantId) {
      return new Observable((subscriber) => {
        tenantContextStorage.run(
          { tenantId: user.tenantId, userId: user.id },
          () => {
            next.handle().subscribe(subscriber);
          },
        );
      });
    }

    return next.handle();
  }
}
