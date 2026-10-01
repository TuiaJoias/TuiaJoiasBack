import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, type Repository } from 'typeorm';
import { slugify } from '../common/utils/slugify.js';
import { Work } from '../works/entities/work.entity.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';
import { Category } from './entities/category.entity.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Work) private readonly works: Repository<Work>,
  ) {}

  /** Ordem de criação: mantém a sequência das categorias iniciais nos filtros. */
  findAll(): Promise<Category[]> {
    return this.categories.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categories.findOneBy({ id });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada.');
    }
    return category;
  }

  /** Para referências vindas no corpo da requisição (ex.: categoryId de um trabalho). */
  async assertExists(id: number): Promise<void> {
    if (!(await this.categories.existsBy({ id }))) {
      throw new BadRequestException('Categoria não encontrada.');
    }
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = this.resolveSlug(dto.slug ?? dto.name);
    await this.assertUnique(dto.name, slug);
    return this.categories.save(this.categories.create({ name: dto.name, slug }));
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    const name = dto.name ?? category.name;
    const slug = dto.slug ? this.resolveSlug(dto.slug) : category.slug;

    await this.assertUnique(name, slug, id);
    category.name = name;
    category.slug = slug;
    return this.categories.save(category);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    if (await this.works.existsBy({ categoryId: id })) {
      throw new ConflictException(
        'Não é possível excluir uma categoria com trabalhos. Mova ou exclua esses trabalhos antes.',
      );
    }
    await this.categories.delete({ id });
  }

  private resolveSlug(source: string): string {
    const slug = slugify(source);
    if (!slug) {
      throw new BadRequestException('Não foi possível gerar um slug válido para a categoria.');
    }
    return slug;
  }

  private async assertUnique(name: string, slug: string, ignoreId?: number): Promise<void> {
    const idFilter = ignoreId ? { id: Not(ignoreId) } : {};
    const duplicated = await this.categories.existsBy([
      { name, ...idFilter },
      { slug, ...idFilter },
    ]);
    if (duplicated) {
      throw new ConflictException('Já existe uma categoria com esse nome ou slug.');
    }
  }
}
