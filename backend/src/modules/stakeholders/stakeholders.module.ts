import { Module } from '@nestjs/common';
import { StakeholdersController } from './stakeholders.controller';
import { StakeholdersService } from './stakeholders.service';

@Module({ controllers: [StakeholdersController], providers: [StakeholdersService], exports: [StakeholdersService] })
export class StakeholdersModule {}
