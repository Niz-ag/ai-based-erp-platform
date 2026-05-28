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
    const user = request.user;

    // If user is authenticated, populate the tenant context
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
