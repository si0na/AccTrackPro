import { Module } from '@nestjs/common';
import { ColumnConfigsController } from './column-configs.controller';
import { ColumnConfigsService } from './column-configs.service';

@Module({ controllers: [ColumnConfigsController], providers: [ColumnConfigsService] })
export class ColumnConfigsModule {}
