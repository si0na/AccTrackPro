import {
  Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { RequirePermission } from './require-permission.decorator';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { UpdateMatrixDto, CreateRoleDto, UpdateRoleDto } from './dto/rbac.dto';

@Controller('rbac')
export class RbacController {
  constructor(private readonly permissions: PermissionsService) {}

  // ── The logged-in user's own effective permissions (drives the SPA). ──────────
  // No @RequirePermission: every authenticated user may read their own grants.
  @Get('permissions/me')
  getMyPermissions(@AuthUser() user: JwtPayload) {
    return this.permissions.getMyPermissions(user.sub);
  }

  // ── Role & Permission Management (Administration → manage). ────────────────────
  @Get('matrix')
  @RequirePermission('administration', 'manage')
  getMatrix() {
    return this.permissions.getMatrix();
  }

  @Put('matrix')
  @RequirePermission('administration', 'manage')
  updateMatrix(@Body() dto: UpdateMatrixDto, @AuthUser() user: JwtPayload) {
    return this.permissions.updateMatrix(dto.changes, user.sub);
  }

  @Get('roles')
  @RequirePermission('administration', 'manage')
  listRoles() {
    return this.permissions.listRoles();
  }

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('administration', 'manage')
  createRole(@Body() dto: CreateRoleDto, @AuthUser() user: JwtPayload) {
    return this.permissions.createRole(dto, user.sub);
  }

  @Put('roles/:id')
  @RequirePermission('administration', 'manage')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto, @AuthUser() user: JwtPayload) {
    return this.permissions.updateRole(id, dto, user.sub);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('administration', 'manage')
  deleteRole(@Param('id') id: string, @AuthUser() user: JwtPayload) {
    return this.permissions.deleteRole(id, user.sub);
  }
}
