import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PerformanceEvaluationsService } from './performance-evaluations.service';
import { CreatePerformanceEvaluationDto, UpdatePerformanceEvaluationDto } from './dto/performance-evaluation.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { mergeWithCustomFields } from '../../common/utils/merge-custom-fields.util';

@Controller('performance-evaluations')
export class PerformanceEvaluationsController {
  constructor(private readonly service: PerformanceEvaluationsService) {}

  // Scope is always the authenticated user (JWT); any client-sent userId is ignored.
  @Get()
  findAll(@AuthUser() authUser: JwtPayload) {
    return this.service.findAll(authUser.sub);
  }

  // Per-employee aggregates for the reporting header (scoped to the evaluator).
  @Get('summary')
  summary(@AuthUser() authUser: JwtPayload) {
    return this.service.summary(authUser.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.service.findOne(id, authUser.sub);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() body: CreatePerformanceEvaluationDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    const fullData = mergeWithCustomFields(body as Record<string, any>, req.body ?? {});
    return this.service.create(fullData, authUser.sub);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdatePerformanceEvaluationDto,
    @Req() req: { body: Record<string, any> },
    @AuthUser() authUser: JwtPayload,
  ) {
    const fullData = mergeWithCustomFields(body as Record<string, any>, req.body ?? {});
    return this.service.update(id, fullData, authUser.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.service.remove(id, authUser.sub);
  }
}
