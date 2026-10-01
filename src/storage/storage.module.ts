import { Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';
import { SupabaseStorageService } from './supabase-storage.service.js';

@Module({
  providers: [{ provide: StorageService, useClass: SupabaseStorageService }],
  exports: [StorageService],
})
export class StorageModule {}
