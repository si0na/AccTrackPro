import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CentralRisksService } from './central-risks.service';

@Controller('risks')
@UseGuards(JwtAuthGuard)
export class RisksController {
  constructor(private readonly service: CentralRisksService) {}

  @Get('all')
  async findAll(
    @Query('source') source?: string,
    @Query('accountId') accountId?: string,
    @Query('rag') rag?: string,
    @Query('priority') priority?: string,
    @Query('status') status?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id;
    return this.service.findAll(source, accountId, rag, priority, status, userId);
  }
}
