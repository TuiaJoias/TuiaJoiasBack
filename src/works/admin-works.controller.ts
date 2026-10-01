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
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe.js';
import { CreateUploadDto } from './dto/create-upload.dto.js';
import { CreateWorkDto } from './dto/create-work.dto.js';
import { ListAdminWorksQueryDto } from './dto/list-works.query.dto.js';
import { ReorderWorksDto } from './dto/reorder-works.dto.js';
import { SetFavoriteDto } from './dto/set-favorite.dto.js';
import { SetPublishedDto } from './dto/set-published.dto.js';
import { UpdateWorkDto } from './dto/update-work.dto.js';
import {
  type AdminWorkResponse,
  toAdminWorkResponse,
  toUploadTicketResponse,
  type UploadTicketResponse,
  type WorkStatsResponse,
} from './works.mapper.js';
import { WorksService } from './works.service.js';

/**
 * Rotas estáticas (stats, uploads, reorder) ficam antes das rotas com :id para
 * não serem capturadas pelo parâmetro.
 */
@Controller('admin/works')
@UseGuards(JwtAuthGuard)
export class AdminWorksController {
  constructor(private readonly works: WorksService) {}

  @Get()
  async findAll(@Query() query: ListAdminWorksQueryDto): Promise<AdminWorkResponse[]> {
    return (await this.works.findAll(query.category)).map(toAdminWorkResponse);
  }

  @Get('stats')
  stats(): Promise<WorkStatsResponse> {
    return this.works.getStats();
  }

  /** 1ª etapa do upload: URL assinada para o navegador enviar a foto ao Storage. */
  @Post('uploads')
  async prepareUpload(@Body() dto: CreateUploadDto): Promise<UploadTicketResponse> {
    return toUploadTicketResponse(await this.works.prepareUpload(dto));
  }

  /** 2ª etapa: cria o trabalho a partir da foto já enviada (uploadPath). */
  @Post()
  async create(@Body() dto: CreateWorkDto): Promise<AdminWorkResponse> {
    return toAdminWorkResponse(await this.works.create(dto));
  }

  @Patch('reorder')
  async reorder(@Body() dto: ReorderWorksDto): Promise<AdminWorkResponse[]> {
    return (await this.works.reorder(dto)).map(toAdminWorkResponse);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: UpdateWorkDto,
  ): Promise<AdminWorkResponse> {
    return toAdminWorkResponse(await this.works.update(id, dto));
  }

  @Patch(':id/favorite')
  async setFavorite(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: SetFavoriteDto,
  ): Promise<AdminWorkResponse> {
    return toAdminWorkResponse(await this.works.setFavorite(id, dto.isFavorite));
  }

  @Patch(':id/publish')
  async setPublished(
    @Param('id', ParseIdPipe) id: number,
    @Body() dto: SetPublishedDto,
  ): Promise<AdminWorkResponse> {
    return toAdminWorkResponse(await this.works.setPublished(id, dto.isPublished));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIdPipe) id: number): Promise<void> {
    return this.works.remove(id);
  }
}
