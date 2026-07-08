import { Module } from '@nestjs/common';
import { CustomColumnsController } from './custom-columns.controller';
import { CustomColumnsService } from './custom-columns.service';

@Module({ controllers: [CustomColumnsController], providers: [CustomColumnsService] })
export class CustomColumnsModule {}
