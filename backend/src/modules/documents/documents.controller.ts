import {
  Controller, Get, Post, Delete, Query, Param, Body,
  UploadedFile, UseInterceptors, HttpCode, HttpStatus,
  Res, StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { AuthUser, JwtPayload } from '../auth/auth-user.decorator';
import { Public } from '../auth/public.decorator';
import { createReadStream } from 'fs';
import type { Response } from 'express';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  findByTarget(
    @Query('accountId') accountId?: string,
    @Query('opportunityId') opportunityId?: string,
    @AuthUser() authUser?: JwtPayload,
  ) {
    const userId = authUser?.sub;
    if (opportunityId) return this.service.findByOpportunity(opportunityId, userId);
    return this.service.findByAccount(accountId ?? '', userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: any,
    @Body('accountId') accountId: string,
    @Body('opportunityId') opportunityId: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    // The uploader is always the authenticated user — any client-sent
    // uploadedBy field is ignored.
    return this.service.create(file, { accountId, opportunityId }, { id: authUser.sub, name: authUser.name });
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Query('inline') inline: string,
    @Res({ passthrough: true }) res: Response,
    @AuthUser() authUser: JwtPayload,
  ): Promise<StreamableFile> {
    const { doc, filePath } = await this.service.getFilePath(id, authUser.sub);
    const disposition = inline === 'true'
      ? `inline; filename="${doc.originalName}"`
      : `attachment; filename="${encodeURIComponent(doc.originalName)}"`;
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': disposition,
      'Content-Length': String(doc.sizeBytes),
    });
    return new StreamableFile(createReadStream(filePath));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @AuthUser() authUser: JwtPayload) {
    return this.service.remove(id, authUser.sub);
  }

  @Get(':id/share-token')
  async getShareToken(
    @Param('id') id: string,
    @AuthUser() authUser: JwtPayload,
  ) {
    const token = await this.service.generateShareToken(id, authUser.sub);
    return { token };
  }

  @Public()
  @Get('public/:token/:filename')
  async downloadPublic(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { doc, filePath } = await this.service.verifyShareToken(token);
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': `inline; filename="${doc.originalName}"`,
      'Content-Length': String(doc.sizeBytes),
    });
    return new StreamableFile(createReadStream(filePath));
  }
}
