import { Controller, Get } from '@nestjs/common';
import { type CategoryResponse, toCategoryResponse } from './categories.mapper.js';
import { CategoriesService } from './categories.service.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  async findAll(): Promise<CategoryResponse[]> {
    return (await this.categories.findAll()).map(toCategoryResponse);
  }
}
