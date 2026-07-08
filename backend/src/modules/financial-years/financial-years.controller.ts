import { Controller, Get, Post, Patch, Body, Param, Req, HttpCode } from '@nestjs/common';
import { FinancialYearsService } from './financial-years.service';
import { CreateFinancialYearDto } from './dto/financial-year.dto';
import { UpdateFinancialCalendarDto } from '../administration/dto/administration.dto';

@Controller('financial-years')
export class FinancialYearsController {
  constructor(private readonly service: FinancialYearsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: CreateFinancialYearDto, @Req() req: any) {
    const userId: string | undefined = req.user?.sub;
    return this.service.create(body, userId);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.service.activate(id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }

  @Patch(':id/calendar')
  updateCalendar(@Param('id') id: string, @Body() body: UpdateFinancialCalendarDto) {
    return this.service.updateCalendar(id, body);
  }
}
