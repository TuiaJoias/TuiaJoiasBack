import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module.js';
import { ImagesModule } from '../images/images.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AdminWorksController } from './admin-works.controller.js';
import { Work } from './entities/work.entity.js';
import { PublicWorksController } from './public-works.controller.js';
import { PublicWorksService } from './public-works.service.js';
import { ImageStagingService } from './staging/image-staging.service.js';
import { WorksService } from './works.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Work]), CategoriesModule, ImagesModule, StorageModule],
  controllers: [PublicWorksController, AdminWorksController],
  providers: [WorksService, PublicWorksService, ImageStagingService],
})
export class WorksModule {}
