import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { QueryFailedError } from 'typeorm';

export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string;
  details?: string[];
  path: string;
  timestamp: string;
}

interface ResolvedError {
  status: number;
  message: string;
  details?: string[];
}

/** Mensagens usadas quando o erro vem do framework com texto genérico em inglês. */
const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Requisição inválida.',
  401: 'Token ausente ou inválido.',
  403: 'Usuário sem permissão.',
  404: 'Recurso não encontrado.',
  409: 'Conflito com dados existentes.',
  413: 'Requisição grande demais.',
  415: 'Tipo de conteúdo não suportado.',
  429: 'Muitas tentativas. Aguarde um minuto e tente novamente.',
  500: 'Erro interno.',
  503: 'Serviço temporariamente indisponível.',
};

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_INVALID_INPUT = ['22P02', '22003', '22001'];

/**
 * Padroniza todas as respostas de erro em
 * { statusCode, error, message, details?, path, timestamp }.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const { status, message, details } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      error: STATUS_CODES[status] ?? 'Error',
      message,
      ...(details?.length ? { details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    if (exception instanceof QueryFailedError) {
      return this.fromDatabaseError(exception);
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: DEFAULT_MESSAGES[500] };
  }

  private fromHttpException(exception: HttpException): ResolvedError {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const raw =
      typeof body === 'string'
        ? body
        : ((body as { message?: unknown }).message ?? exception.message);
    const details = (body as { details?: unknown }).details;

    // ValidationPipe sem exceptionFactory customizada devolve um array.
    if (Array.isArray(raw)) {
      return { status, message: 'Dados inválidos.', details: raw.map(String) };
    }

    return {
      status,
      message: this.translate(status, String(raw)),
      details: Array.isArray(details) ? details.map(String) : undefined,
    };
  }

  private fromDatabaseError(exception: QueryFailedError): ResolvedError {
    const code = (exception.driverError as { code?: string }).code;
    if (code === PG_UNIQUE_VIOLATION) {
      return { status: HttpStatus.CONFLICT, message: 'Já existe um registro com esses dados.' };
    }
    if (code === PG_FOREIGN_KEY_VIOLATION) {
      return {
        status: HttpStatus.CONFLICT,
        message: 'Operação não permitida: o registro está vinculado a outros dados.',
      };
    }
    if (code && PG_INVALID_INPUT.includes(code)) {
      return { status: HttpStatus.BAD_REQUEST, message: DEFAULT_MESSAGES[400] };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: DEFAULT_MESSAGES[500] };
  }

  /** Mantém mensagens da aplicação; troca textos genéricos do framework. */
  private translate(status: number, message: string): string {
    if (status === HttpStatus.NOT_FOUND && message.startsWith('Cannot ')) {
      return 'Rota não encontrada.';
    }
    const isFrameworkDefault =
      message === STATUS_CODES[status] || message.startsWith('ThrottlerException');
    return isFrameworkDefault ? (DEFAULT_MESSAGES[status] ?? message) : message;
  }
}
