import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { RequestHandler } from 'express';
import type { HelmetOptions } from 'helmet';
import { createRequire } from 'node:module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { validationExceptionFactory } from './common/validation/validation-exception.factory.js';
import { AppConfigService } from './config/app-config.service.js';

/**
 * O helmet publica tipos separados para ESM e CommonJS, e o type-check do
 * builder da Vercel resolve a variante CommonJS mesmo em arquivos ESM, onde
 * `import helmet from 'helmet'` deixa de ser chamável. Em CommonJS o próprio
 * módulo é a função, então carregá-lo com require funciona nos dois casos.
 */
const helmet = createRequire(import.meta.url)('helmet') as (options?: HelmetOptions) => RequestHandler;

/** Configuração HTTP compartilhada entre main.ts e os testes e2e. */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfigService);

  if (config.isProduction) {
    // Atrás do proxy do provedor de hospedagem: usa o IP real no rate limit do login.
    (app as NestExpressApplication).set('trust proxy', 1);
  }

  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}
