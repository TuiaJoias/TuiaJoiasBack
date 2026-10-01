import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  /** Usado pelo provedor de hospedagem para saber se a API está saudável. */
  @Get()
  async check(): Promise<{ status: 'ok'; database: 'up' }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Banco de dados indisponível.');
    }
    return { status: 'ok', database: 'up' };
  }
}
