import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Req,
} from '@nestjs/common';
import { EmployeeRewardsRecognitionService } from './employee-rewards-recognition.service';
import { CreateEmployeeRewardsRecognitionDto, UpdateEmployeeRewardsRecognitionDto } from './dto/employee-rewards-recognition.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('employee-rewards-recognition')
export class EmployeeRewardsRecognitionController {
  constructor(private readonly service: EmployeeRewardsRecognitionService) {}

  @Get()
  @RequirePermission('employeeRewardsRecognition', 'view')
  findAll(
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('teamOrIndividual') teamOrIndividual?: string,
    @Query('status') status?: string,
    @Query('monthOfRr') monthOfRr?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({ type, category, teamOrIndividual, status, monthOfRr, search });
  }

  @Get(':id')
  @RequirePermission('employeeRewardsRecognition', 'view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('employeeRewardsRecognition', 'create')
  create(@Body() dto: CreateEmployeeRewardsRecognitionDto, @AuthUser() authUser: JwtPayload) {
    return this.service.create(dto, authUser?.sub);
  }

  @Put(':id')
  @RequirePermission('employeeRewardsRecognition', 'update')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeRewardsRecognitionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('employeeRewardsRecognition', 'delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
