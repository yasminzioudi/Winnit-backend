import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * RFC 7807 Problem Details for HTTP APIs
 * Returns application/problem+json on all errors
 */
@Catch()
export class ProblemJsonExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemJsonExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestId = request.headers['x-request-id'] || 'unknown';

    let title = 'An error occurred';
    let detail = 'An unexpected error occurred';
    let errors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      title = exception.message;

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        detail = (responseObj.message as string) || detail;

        // class-validator errors
        if (Array.isArray(responseObj.message)) {
          detail = 'Validation failed';
          errors = { validation: responseObj.message };
        }
      }
    } else if (exception instanceof Error) {
      detail = exception.message;
    }

    // Log error (never log PII)
    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} - ${status} - ${detail}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} - ${status} - ${detail}`,
      );
    }

    // Never expose stack traces in production
    const problemDetail = {
      type: `https://winnit.tn/errors/${status}`,
      title,
      status,
      detail:
        process.env.NODE_ENV === 'production'
          ? this.sanitizeDetailForProduction(detail, status)
          : detail,
      instance: request.url,
      requestId,
      ...(errors && { errors }),
    };

    response.status(status).type('application/problem+json').json(problemDetail);
  }

  private sanitizeDetailForProduction(detail: string, status: number): string {
    if (status >= 500) {
      return 'Internal server error';
    }
    return detail;
  }
}
