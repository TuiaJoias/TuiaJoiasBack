import { Controller, Get, Param, Query } from '@nestjs/common';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe.js';
import { ListPublicWorksQueryDto } from './dto/list-works.query.dto.js';
import { PublicWorksService } from './public-works.service.js';
import {
  type PaginatedResponse,
  type PublicWorkResponse,
  toPublicWorkResponse,
} from './works.mapper.js';

@Controller('works')
export class PublicWorksController {
  constructor(private readonly works: PublicWorksService) {}

  @Get()
  async list(@Query() query: ListPublicWorksQueryDto): Promise<PaginatedResponse<PublicWorkResponse>> {
    const { items, total, page, limit } = await this.works.list(query);
    return {
      items: items.map(toPublicWorkResponse),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIdPipe) id: number): Promise<PublicWorkResponse> {
    return toPublicWorkResponse(await this.works.findOne(id));
  }
}
