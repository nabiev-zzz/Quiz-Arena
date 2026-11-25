import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('live')
  getLiveness() {
    return { status: 'ok' as const };
  }

  @Get('ready')
  async getReadiness() {
    try {
      if (!this.dataSource.isInitialized) {
        throw new Error('Database connection is not initialized');
      }

      await this.dataSource.query('SELECT 1');

      return {
        status: 'ok' as const,
        checks: { database: 'ok' as const },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        checks: { database: 'unavailable' },
      });
    }
  }
}
