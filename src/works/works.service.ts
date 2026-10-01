import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { ACCEPTED_MIME_TYPES } from '../images/image-formats.js';
import { ImageProcessorService } from '../images/image-processor.service.js';
import type { SignedUpload, StoredFile } from '../storage/storage.interface.js';
import { StorageService } from '../storage/storage.service.js';
import { type CreateUploadDto, UploadPurpose } from './dto/create-upload.dto.js';
import type { CreateWorkDto } from './dto/create-work.dto.js';
import type { ReorderWorksDto } from './dto/reorder-works.dto.js';
import type { UpdateWorkDto } from './dto/update-work.dto.js';
import { Work } from './entities/work.entity.js';
import { ImageStagingService } from './staging/image-staging.service.js';
import type { WorkStatsResponse } from './works.mapper.js';

/**
 * Chave do advisory lock do PostgreSQL que serializa operações que mudam a
 * quantidade ou a ordem dos trabalhos (criar, excluir, reordenar). Evita que
 * uploads simultâneos ultrapassem MAX_WORKS ou gerem posições repetidas.
 */
const WORKS_POSITION_LOCK = 74_120_001;

const STORAGE_FOLDER = 'works';

interface UploadedImage extends StoredFile {
  width: number;
  height: number;
}

@Injectable()
export class WorksService {
  private readonly logger = new Logger(WorksService.name);

  constructor(
    @InjectRepository(Work) private readonly works: Repository<Work>,
    private readonly dataSource: DataSource,
    private readonly categories: CategoriesService,
    private readonly images: ImageProcessorService,
    private readonly storage: StorageService,
    private readonly staging: ImageStagingService,
    private readonly config: AppConfigService,
  ) {}

  findAll(categorySlug?: string): Promise<Work[]> {
    return this.works.find({
      where: categorySlug ? { category: { slug: categorySlug } } : {},
      relations: { category: true },
      order: { position: 'ASC', id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Work> {
    const work = await this.works.findOne({ where: { id }, relations: { category: true } });
    if (!work) {
      throw new NotFoundException('Trabalho não encontrado.');
    }
    return work;
  }

  async getStats(): Promise<WorkStatsResponse> {
    const raw = await this.works
      .createQueryBuilder('work')
      .select('COUNT(*)::int', 'total')
      .addSelect('COUNT(*) FILTER (WHERE work.is_favorite)::int', 'favorites')
      .addSelect('COUNT(*) FILTER (WHERE NOT work.is_published)::int', 'hidden')
      .getRawOne<{ total: number; favorites: number; hidden: number }>();

    const total = raw?.total ?? 0;
    const hidden = raw?.hidden ?? 0;
    const maxWorks = this.config.maxWorks;
    return {
      total,
      favorites: raw?.favorites ?? 0,
      hidden,
      published: total - hidden,
      maxWorks,
      remaining: Math.max(maxWorks - total, 0),
      upload: {
        maxFileSizeMb: this.config.upload.maxFileSizeMb,
        acceptedMimeTypes: ACCEPTED_MIME_TYPES,
      },
    };
  }

  /**
   * Primeira etapa do upload: devolve a URL assinada para o navegador enviar o
   * original direto ao Storage. Foto de trabalho novo já respeita MAX_WORKS aqui.
   */
  async prepareUpload({ contentType, size, purpose }: CreateUploadDto): Promise<SignedUpload> {
    if (purpose === UploadPurpose.Create) {
      await this.assertBelowLimit(this.works.manager);
    }
    return this.staging.createUpload(contentType, size);
  }

  async create(dto: CreateWorkDto): Promise<Work> {
    await this.categories.assertExists(dto.categoryId);
    // Checagem rápida antes de processar/enviar; a definitiva fica na transação.
    await this.assertBelowLimit(this.works.manager);

    const uploaded = await this.processAndUpload(await this.staging.consume(dto.uploadPath));
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        await this.lockPositions(manager);
        await this.assertBelowLimit(manager);
        const saved = await manager.save(
          manager.create(Work, {
            title: dto.title,
            description: dto.description || null,
            categoryId: dto.categoryId,
            imageUrl: uploaded.publicUrl,
            storagePath: uploaded.path,
            width: uploaded.width,
            height: uploaded.height,
            isFavorite: dto.isFavorite ?? false,
            isPublished: dto.isPublished ?? true,
            position: await this.nextPosition(manager),
          }),
        );
        return saved.id;
      });
      return await this.findOne(id);
    } catch (error) {
      await this.deleteQuietly(uploaded.path);
      throw error;
    }
  }

  async update(id: number, dto: UpdateWorkDto): Promise<Work> {
    const current = await this.findOne(id);
    if (dto.categoryId !== undefined) {
      await this.categories.assertExists(dto.categoryId);
    }

    const changes: Partial<Work> = {};
    if (dto.title !== undefined) changes.title = dto.title;
    if (dto.description !== undefined) changes.description = dto.description || null;
    if (dto.categoryId !== undefined) changes.categoryId = dto.categoryId;
    if (dto.isFavorite !== undefined) changes.isFavorite = dto.isFavorite;
    if (dto.isPublished !== undefined) changes.isPublished = dto.isPublished;

    // A imagem nova é salva antes; a antiga só é removida depois do banco atualizado.
    const replacement = dto.uploadPath
      ? await this.processAndUpload(await this.staging.consume(dto.uploadPath))
      : undefined;
    if (replacement) {
      Object.assign(changes, {
        imageUrl: replacement.publicUrl,
        storagePath: replacement.path,
        width: replacement.width,
        height: replacement.height,
      });
    }

    if (Object.keys(changes).length === 0) {
      return current;
    }

    try {
      const result = await this.works.update({ id }, changes);
      if (!result.affected) {
        throw new NotFoundException('Trabalho não encontrado.');
      }
    } catch (error) {
      if (replacement) await this.deleteQuietly(replacement.path);
      throw error;
    }

    if (replacement) {
      await this.deleteQuietly(current.storagePath);
    }
    return this.findOne(id);
  }

  setFavorite(id: number, isFavorite: boolean): Promise<Work> {
    return this.updateFlag(id, { isFavorite });
  }

  setPublished(id: number, isPublished: boolean): Promise<Work> {
    return this.updateFlag(id, { isPublished });
  }

  /**
   * Remove o registro e o arquivo na mesma transação: se o Storage falhar, o
   * banco volta atrás (nada fica órfão nem com imagem quebrada). Arquivo que já
   * não existe no Storage não impede a exclusão.
   */
  async remove(id: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockPositions(manager);
      const work = await manager.findOneBy(Work, { id });
      if (!work) {
        throw new NotFoundException('Trabalho não encontrado.');
      }
      await manager.delete(Work, { id });
      await manager
        .createQueryBuilder()
        .update(Work)
        .set({ position: () => 'position - 1' })
        .where('position > :position', { position: work.position })
        .execute();
      await this.storage.delete(work.storagePath);
    });
  }

  /** Recebe a lista completa com posições 1..N e grava tudo em uma transação. */
  async reorder({ items }: ReorderWorksDto): Promise<Work[]> {
    const ids = items.map((item) => item.id);
    const positions = items.map((item) => item.position);

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A lista de ordenação contém trabalhos repetidos.');
    }
    const sorted = [...positions].sort((a, b) => a - b);
    if (sorted.some((position, index) => position !== index + 1)) {
      throw new BadRequestException(
        'As posições devem ser sequenciais, sem repetição, de 1 até o total de trabalhos.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await this.lockPositions(manager);
      const existing = await manager.find(Work, { select: { id: true } });
      const existingIds = new Set(existing.map((work) => work.id));
      if (existing.length !== ids.length || ids.some((id) => !existingIds.has(id))) {
        throw new BadRequestException(
          'A lista de ordenação deve conter todos os trabalhos cadastrados.',
        );
      }
      for (const item of items) {
        await manager.update(Work, { id: item.id }, { position: item.position });
      }
    });

    return this.findAll();
  }

  private async updateFlag(
    id: number,
    flag: Pick<Partial<Work>, 'isFavorite' | 'isPublished'>,
  ): Promise<Work> {
    const result = await this.works.update({ id }, flag);
    if (!result.affected) {
      throw new NotFoundException('Trabalho não encontrado.');
    }
    return this.findOne(id);
  }

  /** Valida o conteúdo real, gera o WebP otimizado e o publica no bucket público. */
  private async processAndUpload(original: Buffer): Promise<UploadedImage> {
    const processed = await this.images.process(original);
    const stored = await this.storage.upload({
      path: `${STORAGE_FOLDER}/${randomUUID()}.${processed.extension}`,
      body: processed.buffer,
      contentType: processed.mimeType,
    });
    return { ...stored, width: processed.width, height: processed.height };
  }

  private async assertBelowLimit(manager: EntityManager): Promise<void> {
    const maxWorks = this.config.maxWorks;
    if ((await manager.count(Work)) >= maxWorks) {
      throw new BadRequestException(
        `Limite de ${maxWorks} trabalhos atingido. Exclua um trabalho para cadastrar outro.`,
      );
    }
  }

  private async nextPosition(manager: EntityManager): Promise<number> {
    const raw = await manager
      .createQueryBuilder(Work, 'work')
      .select('COALESCE(MAX(work.position), 0)::int', 'max')
      .getRawOne<{ max: number }>();
    return (raw?.max ?? 0) + 1;
  }

  /** Válido até o fim da transação atual. */
  private async lockPositions(manager: EntityManager): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock($1)', [WORKS_POSITION_LOCK]);
  }

  /** Limpeza de arquivos: falhas são registradas, mas não mascaram o erro original. */
  private async deleteQuietly(path: string): Promise<void> {
    try {
      await this.storage.delete(path);
    } catch (error) {
      this.logger.warn(`Não foi possível remover ${path} do Storage: ${(error as Error).message}`);
    }
  }
}
