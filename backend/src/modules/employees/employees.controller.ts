import { Controller, Get, Query } from '@nestjs/common';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  async getEmployees(@Query('search') search?: string) {
    return this.employeesService.getLocalEmployeeDirectory(search);
  }
}
