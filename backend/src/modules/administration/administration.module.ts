import { Module } from '@nestjs/common';
import { AdministrationController } from './administration.controller';
import { AdministrationService } from './administration.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports:     [UsersModule, AuthModule],
  controllers: [AdministrationController],
  providers:   [AdministrationService],
  exports:     [AdministrationService],
})
export class AdministrationModule {}
