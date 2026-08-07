import { Client } from 'pg';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PermissionsService } from './modules/rbac/permissions.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const permissions = app.get(PermissionsService);
  const myPerms = await permissions.getMyPermissions('5a9fdf59-fefd-46e5-8e7f-8e565ab7bbc3');
  console.log("MY PERMISSIONS:", myPerms);
  await app.close();
}
bootstrap();
