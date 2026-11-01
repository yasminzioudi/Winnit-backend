import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;
    const requestId = headers['x-request-id'] || 'unknown';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;
          this.logger.log(
            JSON.stringify({
              requestId,
              method,
              url,
              statusCode: response.statusCode,
              duration,
            }),
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            JSON.stringify({
              requestId,
              method,
              url,
              error: error.message,
              duration,
            }),
          );
        },
      }),
    );
  }
}
