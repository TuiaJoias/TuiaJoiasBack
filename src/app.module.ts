import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { buildDataSourceOptions } from './database/typeorm-options.js';
import { HealthController } from './health/health.controller.js';
import { UsersModule } from './users/users.module.js';
import { WorksModule } from './works/works.module.js';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => buildDataSourceOptions(config.database),
    }),
    // Aplicado apenas onde há @UseGuards(ThrottlerGuard) (login).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 60 }]),
    UsersModule,
    AuthModule,
    CategoriesModule,
    WorksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
