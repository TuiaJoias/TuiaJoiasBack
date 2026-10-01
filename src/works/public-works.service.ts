import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { ListPublicWorksQueryDto } from './dto/list-works.query.dto.js';
import { Work } from './entities/work.entity.js';

export interface PaginatedWorks {
  items: Work[];
  total: number;
  page: number;
  limit: number;
}

/** Consultas do site público: somente trabalhos publicados. */
@Injectable()
export class PublicWorksService {
  constructor(@InjectRepository(Work) private readonly works: Repository<Work>) {}

  async list({ category, page, limit }: ListPublicWorksQueryDto): Promise<PaginatedWorks> {
    const [items, total] = await this.works.findAndCount({
      where: { isPublished: true, ...(category ? { category: { slug: category } } : {}) },
      relations: { category: true },
      order: { position: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async findOne(id: number): Promise<Work> {
    const work = await this.works.findOne({
      where: { id, isPublished: true },
      relations: { category: true },
    });
    if (!work) {
      throw new NotFoundException('Trabalho não encontrado.');
    }
    return work;
  }
}
