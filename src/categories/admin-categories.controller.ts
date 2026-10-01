import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe.js';
import { type CategoryResponse, toCategoryResponse } from './categories.mapper.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Controller('admin/categories')
@UseGuards(JwtAuthGuard)
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  async findAll(): Promise<CategoryResponse[]> {
    return (await this.categories.findAll()).map(toCategoryResponse);
  }

  @Post()
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryResponse> {
    return toCategoryResponse(await this.categories.create(dto));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    return toCategoryResponse(await this.categories.update(id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIdPipe) id: number): Promise<void> {
    return this.categories.remove(id);
  }
}
