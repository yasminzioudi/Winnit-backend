import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { randomBytes } from 'crypto';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);

  // Generate x-request-id BEFORE guards run (middleware, not interceptor)
  app.use((req: any, res: any, next: any) => {
    const requestId =
      req.headers['x-request-id'] ||
      `req_${randomBytes(12).toString('hex')}`;
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  // Security middleware (relax CSP for Swagger)
  app.use((req: any, res: any, next: any) => {
    if (req.path.startsWith('/api/docs')) {
      // Swagger needs inline scripts and styles
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
      })(req, res, next);
    } else {
      helmet()(req, res, next);
    }
  });
  app.use(compression());

  // CORS (even though frontend rewrite makes it unused, keep allow-list)
  const corsOrigins = configService.get<string[]>('cors.origins', []);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

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

  // Swagger (disabled in production unless SWAGGER=on)
  const swaggerEnabled = configService.get<boolean>('swagger.enabled');
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('WINNIT OS API')
      .setDescription('Profit OS & COD Reconciliation for Tunisia e-commerce')
      .setVersion('1.0')
      .addServer('/api/v1')
      .addApiKey({ type: 'apiKey', name: 'x-workspace-id', in: 'header' }, 'workspace')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = configService.get<number>('port', 4000);
  await app.listen(port);

  console.log(`WINNIT Backend listening on port ${port}`);
  console.log(`Swagger: ${swaggerEnabled ? `http://localhost:${port}/api/docs` : 'disabled'}`);
}

bootstrap();
