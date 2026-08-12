import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { UsersModule } from '../users/users.module';
import { EmployeeMasterModule } from '../employee-master/employee-master.module';
import { GraphMailService } from './graph-mail.service';

@Module({
  imports: [
    UsersModule,
    EmployeeMasterModule,
    JwtModule.register({
      // Secret is also passed explicitly in sign/verify calls. JWT_SECRET is
      // guaranteed present by the startup env validation in main.ts — there is
      // deliberately no hardcoded fallback.
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    GraphMailService,
  ],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
