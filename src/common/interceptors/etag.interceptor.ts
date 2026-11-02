import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class EtagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    if (req.method !== 'GET') {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (data === undefined || data === null) {
          return data;
        }

        const serialized = JSON.stringify(data);
        const hash = crypto.createHash('sha256').update(serialized).digest('hex');
        const etag = `W/"${hash}"`;

        res.setHeader('ETag', etag);

        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch) {
          const normalize = (tag: string) =>
            tag.replace(/^W\//, '').replace(/"/g, '').trim();
          const normalizedClient = normalize(ifNoneMatch);
          const normalizedServer = normalize(etag);

          if (normalizedClient === normalizedServer || ifNoneMatch === '*') {
            res.status(304);
            return null;
          }
        }

        return data;
      }),
    );
  }
}
