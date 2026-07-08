import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Public } from '../auth/public.decorator';

interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  uptime: number;
  timestamp: string;
}

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor(process.uptime());

    try {
      await this.db.query('SELECT 1');
      return { status: 'ok', database: 'connected', uptime, timestamp };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'disconnected',
        uptime,
        timestamp,
      });
    }
  }
}
