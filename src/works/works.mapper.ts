import { type CategoryResponse, toCategoryResponse } from '../categories/categories.mapper.js';
import type { SignedUpload } from '../storage/storage.interface.js';
import type { Work } from './entities/work.entity.js';

/** Dados expostos no site público (sem storagePath nem status de publicação). */
export interface PublicWorkResponse {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string;
  width: number;
  height: number;
  isFavorite: boolean;
  position: number;
  category: CategoryResponse;
  createdAt: Date;
}

export interface AdminWorkResponse extends PublicWorkResponse {
  categoryId: number;
  isPublished: boolean;
  updatedAt: Date;
}

export interface WorkStatsResponse {
  total: number;
  favorites: number;
  hidden: number;
  published: number;
  maxWorks: number;
  remaining: number;
  upload: {
    maxFileSizeMb: number;
    acceptedMimeTypes: string[];
  };
}

/** Resposta de POST /admin/works/uploads. */
export interface UploadTicketResponse {
  /** Enviar em POST /admin/works (ou PATCH /admin/works/:id) depois do upload. */
  uploadPath: string;
  /** URL para o navegador fazer PUT do arquivo, com Content-Type do arquivo. */
  uploadUrl: string;
  expiresInSeconds: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function toPublicWorkResponse(work: Work): PublicWorkResponse {
  return {
    id: work.id,
    title: work.title,
    description: work.description,
    imageUrl: work.imageUrl,
    width: work.width,
    height: work.height,
    isFavorite: work.isFavorite,
    position: work.position,
    category: toCategoryResponse(work.category),
    createdAt: work.createdAt,
  };
}

export function toAdminWorkResponse(work: Work): AdminWorkResponse {
  return {
    ...toPublicWorkResponse(work),
    categoryId: work.categoryId,
    isPublished: work.isPublished,
    updatedAt: work.updatedAt,
  };
}

export function toUploadTicketResponse(upload: SignedUpload): UploadTicketResponse {
  return {
    uploadPath: upload.path,
    uploadUrl: upload.uploadUrl,
    expiresInSeconds: upload.expiresInSeconds,
  };
}
