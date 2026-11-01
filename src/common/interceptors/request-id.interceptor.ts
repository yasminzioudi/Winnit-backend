import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomBytes } from 'crypto';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const requestId =
      request.headers['x-request-id'] ||
      `req_${randomBytes(12).toString('hex')}`;

    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);

    return next.handle();
  }
}
