import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Work } from '../works/entities/work.entity.js';
import { AdminCategoriesController } from './admin-categories.controller.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { Category } from './entities/category.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Work])],
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
