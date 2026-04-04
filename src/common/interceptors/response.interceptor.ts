import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface PaginatedControllerResult<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    unread_count?: number;
    [key: string]: unknown;
  };
  message?: string;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((body: unknown) => {
        if (body instanceof StreamableFile) {
          return body;
        }
        if (
          body !== null &&
          typeof body === 'object' &&
          'success' in (body as object)
        ) {
          return body;
        }

        if (
          body !== null &&
          typeof body === 'object' &&
          'data' in (body as object)
        ) {
          const b = body as PaginatedControllerResult<unknown>;
          return {
            success: true,
            data: b.data,
            ...(b.meta ? { meta: b.meta } : {}),
            ...(b.message ? { message: b.message } : {}),
          };
        }

        return { success: true, data: body };
      }),
    );
  }
}
