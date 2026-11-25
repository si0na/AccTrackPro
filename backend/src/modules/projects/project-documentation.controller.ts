import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { ProjectDocumentationService } from './project-documentation.service';
import {
  CreateProjectDocumentationUrlDto,
  CreateProjectDocumentationFileDto,
  UpdateProjectDocumentationDto,
} from './dto/project-documentation.dto';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';

@Controller('projects/:projectId/documentation')
export class ProjectDocumentationController {
  constructor(private readonly service: ProjectDocumentationService) {}

  @Get()
  @RequirePermission('projects', 'view')
  findAll(@Param('projectId') projectId: string, @AuthUser() authUser: JwtPayload) {
    return this.service.findAll(projectId, authUser.sub);
  }

  @Get(':id')
  @RequirePermission('projects', 'view')
  findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.findOne(projectId, id, authUser.sub);
  }

  @Post('url')
  @RequirePermission('projects', 'create')
  @HttpCode(HttpStatus.CREATED)
  createUrl(
    @Param('projectId') projectId: string,
    @Body() body: CreateProjectDocumentationUrlDto,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.createUrl(projectId, body, authUser.sub);
  }

  @Post('upload')
  @RequirePermission('projects', 'create')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  createFile(
    @Param('projectId') projectId: string,
    @Body() body: CreateProjectDocumentationFileDto,
    @UploadedFile() file: any,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.createFile(projectId, body, file, authUser.sub);
  }

  @Post(':id/update')
  @RequirePermission('projects', 'update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  updatePost(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: UpdateProjectDocumentationDto,
    @UploadedFile() file: any,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.update(projectId, id, body, file, authUser.sub);
  }

  @Put(':id')
  @RequirePermission('projects', 'update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  updatePut(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: UpdateProjectDocumentationDto,
    @UploadedFile() file: any,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.update(projectId, id, body, file, authUser.sub);
  }

  @Post(':id/delete')
  @RequirePermission('projects', 'delete')
  @HttpCode(HttpStatus.OK)
  removePost(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.remove(projectId, id, authUser.sub);
  }

  @Delete(':id')
  @RequirePermission('projects', 'delete')
  @HttpCode(HttpStatus.OK)
  removeDelete(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    return this.service.remove(projectId, id, authUser.sub);
  }

  @Get(':id/download')
  @RequirePermission('projects', 'view')
  async download(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Query('inline') inline: string,
    @Res({ passthrough: true }) res: Response,
    @AuthUser() authUser: JwtPayload,
  ): Promise<StreamableFile> {
    const { doc, filePath } = await this.service.getFilePath(projectId, id, authUser.sub);
    const disposition = inline === 'true'
      ? `inline; filename="${doc.fileName}"`
      : `attachment; filename="${encodeURIComponent(doc.fileName ?? 'document')}"`;
    res.set({
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': disposition,
      'Content-Length': String(doc.fileSize ?? 0),
    });
    return new StreamableFile(createReadStream(filePath));
  }
}
