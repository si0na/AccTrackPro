import { Module } from '@nestjs/common';
import { AdministrationController } from './administration.controller';
import { AdministrationService } from './administration.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports:     [UsersModule],
  controllers: [AdministrationController],
  providers:   [AdministrationService],
  exports:     [AdministrationService],
})
export class AdministrationModule {}
