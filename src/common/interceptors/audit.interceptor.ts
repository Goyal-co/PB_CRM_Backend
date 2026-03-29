import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CurrentUser } from '@common/types/user.types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (req as FastifyRequest & { user?: CurrentUser }).user;
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          this.logger.log(
            `${req.method} ${req.url} ${user?.id ?? 'anon'} ${ms}ms`,
          );
        },
        error: () => {
          const ms = Date.now() - started;
          this.logger.warn(
            `${req.method} ${req.url} ${user?.id ?? 'anon'} ${ms}ms (error)`,
          );
        },
      }),
    );
  }
}
