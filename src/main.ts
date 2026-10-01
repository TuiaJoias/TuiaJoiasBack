import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { AppConfigService } from './config/app-config.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const config = app.get(AppConfigService);
  await app.listen(config.port);
  Logger.log(`API Tuia Joias em http://localhost:${config.port}`, 'Bootstrap');
}
await bootstrap();
