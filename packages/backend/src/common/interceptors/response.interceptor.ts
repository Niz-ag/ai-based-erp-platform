import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  meta?: any;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((res) => {
        // If the response is already a standard wrapper, return as is
        if (res && typeof res === 'object' && 'success' in res && 'data' in res) {
          return res;
        }

        // Handle complex objects that might contain 'data' and 'pagination' or other meta
        if (res && typeof res === 'object' && 'data' in res) {
          const { data, ...meta } = res;
          return {
            success: true,
            data: data,
            meta: Object.keys(meta).length > 0 ? meta : undefined,
          };
        }

        // Standard direct return
        return {
          success: true,
          data: res,
        };
      }),
    );
  }
}
