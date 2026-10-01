import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service.js';
import { validateEnv } from './env.validation.js';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      // Em testes o .env.test é carregado pelo setup do Vitest.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnv,
      cache: true,
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
