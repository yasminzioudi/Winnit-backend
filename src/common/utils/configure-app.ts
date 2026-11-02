import { INestApplication, ValidationPipe } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { NoDollarQueryGuard } from '../guards/no-dollar-query.guard';

/**
 * Shared app configuration used by main.ts and e2e tests.
 * Ensures tests run against the real production setup.
 */
export function configureApp(app: INestApplication): void {
  // Reject any query key starting with "$" or containing "." at any depth
  app.useGlobalGuards(new NoDollarQueryGuard());
  // Generate x-request-id BEFORE guards run (middleware, not interceptor)
  app.use((req: any, res: any, next: any) => {
    const requestId =
      req.headers['x-request-id'] ||
      `req_${randomBytes(12).toString('hex')}`;
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false, // Explicit @Type() decorators only
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api/v1');
}
