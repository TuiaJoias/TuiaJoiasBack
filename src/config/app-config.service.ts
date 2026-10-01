import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DatabaseEnv } from '../database/database-env.js';
import { Environment, EnvironmentVariables } from './env.validation.js';

const MEGABYTE = 1024 * 1024;

/** Acesso tipado às configurações já validadas em env.validation.ts. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  private get<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === Environment.Production;
  }

  get port(): number {
    return this.get('PORT');
  }

  get corsOrigins(): string[] {
    return this.get('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  get database(): DatabaseEnv {
    return { url: this.get('DATABASE_URL'), ssl: this.get('DATABASE_SSL') };
  }

  get jwt() {
    return {
      secret: this.get('JWT_SECRET'),
      expiresIn: this.get('JWT_EXPIRES_IN'),
    };
  }

  get supabase() {
    return {
      url: this.get('SUPABASE_URL'),
      serviceRoleKey: this.get('SUPABASE_SERVICE_ROLE_KEY'),
      bucket: this.get('SUPABASE_STORAGE_BUCKET'),
      uploadsBucket: this.get('SUPABASE_UPLOADS_BUCKET'),
    };
  }

  get upload() {
    const maxFileSizeMb = this.get('MAX_FILE_SIZE_MB');
    return { maxFileSizeMb, maxFileSizeBytes: maxFileSizeMb * MEGABYTE };
  }

  get maxWorks(): number {
    return this.get('MAX_WORKS');
  }

  get image() {
    return {
      maxDimension: this.get('IMAGE_MAX_DIMENSION'),
      webpQuality: this.get('IMAGE_WEBP_QUALITY'),
    };
  }
}
