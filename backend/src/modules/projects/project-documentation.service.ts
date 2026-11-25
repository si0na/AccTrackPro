import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { ProjectsService } from './projects.service';
import { ProjectDocumentation } from '../../types';
import {
  CreateProjectDocumentationUrlDto,
  CreateProjectDocumentationFileDto,
  UpdateProjectDocumentationDto,
} from './dto/project-documentation.dto';
import { matchesDeclaredMimeType } from '../documents/file-signature.util';
import { resolveMimeType } from '../documents/file-type.util';
import { toIsoString } from '../../common/utils/db-mapping.util';

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads'));

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/zip',
  'application/x-zip-compressed',
]);

const MAX_BYTES = 50 * 1024 * 1024; // 50MB

function rowToDoc(row: any): ProjectDocumentation {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    type: row.type,
    url: row.url ?? undefined,
    fileName: row.file_name ?? undefined,
    fileSize: row.file_size !== null && row.file_size !== undefined ? Number(row.file_size) : undefined,
    mimeType: row.mime_type ?? undefined,
    description: row.description ?? '',
    createdById: row.created_by_id ?? undefined,
    addedBy: row.added_by_name || row.added_by_email || undefined,
    createdAt: toIsoString(row.created_at) || '',
    updatedAt: toIsoString(row.updated_at) || '',
  };
}

@Injectable()
export class ProjectDocumentationService {
  private readonly logger = new Logger(ProjectDocumentationService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly projectsService: ProjectsService,
  ) {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  async findAll(projectId: string, userId?: string): Promise<ProjectDocumentation[]> {
    await this.projectsService.findOne(projectId, userId);
    const { rows } = await this.db.query(
      `SELECT d.*, u.name AS added_by_name, u.email AS added_by_email
       FROM project_documentation d
       LEFT JOIN users u ON d.created_by_id = u.id
       WHERE d.project_id = $1
       ORDER BY d.created_at DESC`,
      [projectId],
    );
    return rows.map(rowToDoc);
  }

  async findOne(projectId: string, id: string, userId?: string): Promise<ProjectDocumentation> {
    await this.projectsService.findOne(projectId, userId);
    const { rows } = await this.db.query(
      `SELECT d.*, u.name AS added_by_name, u.email AS added_by_email
       FROM project_documentation d
       LEFT JOIN users u ON d.created_by_id = u.id
       WHERE d.id = $1 AND d.project_id = $2`,
      [id, projectId],
    );
    if (!rows.length) throw new NotFoundException(`Project documentation "${id}" not found`);
    return rowToDoc(rows[0]);
  }

  async createUrl(
    projectId: string,
    dto: CreateProjectDocumentationUrlDto,
    userId?: string,
  ): Promise<ProjectDocumentation> {
    await this.projectsService.findOne(projectId, userId);

    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Document name is required');

    const url = dto.url?.trim();
    if (!url) throw new BadRequestException('Document URL is required');
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new BadRequestException('Document URL must use http or https protocol');
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid URL format');
    }

    const { rows } = await this.db.query(
      `INSERT INTO project_documentation (
         id, project_id, name, type, url, description, created_by_id, created_at, updated_at
       ) VALUES (
         gen_random_uuid()::TEXT, $1, $2, 'URL', $3, $4, $5, NOW(), NOW()
       ) RETURNING *`,
      [projectId, name, url, dto.description?.trim() ?? '', userId || null],
    );

    return this.findOne(projectId, rows[0].id, userId);
  }

  async createFile(
    projectId: string,
    dto: CreateProjectDocumentationFileDto,
    file: any,
    userId?: string,
  ): Promise<ProjectDocumentation> {
    await this.projectsService.findOne(projectId, userId);

    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Document name is required');
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_BYTES) throw new BadRequestException('File exceeds the 50 MB size limit');

    const mimeType = resolveMimeType(file.originalname, file.mimetype);
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new BadRequestException(
        `File type "${mimeType || file.originalname}" is not supported. Allowed formats: PDF, Word, Excel, PowerPoint, images, CSV, TXT, ZIP, JSON`,
      );
    }

    if (!matchesDeclaredMimeType(file.buffer, mimeType)) {
      this.logger.warn(`Project documentation upload rejected: content of "${file.originalname}" does not match declared type "${mimeType}"`);
      throw new BadRequestException(
        `The content of "${file.originalname}" does not match its file type "${mimeType}". The file was rejected.`,
      );
    }

    const ext = path.extname(file.originalname) || '';
    const storedName = `${randomUUID()}${ext}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, storedName), file.buffer);

    const { rows } = await this.db.query(
      `INSERT INTO project_documentation (
         id, project_id, name, type, file_name, file_path, file_size, mime_type, description, created_by_id, created_at, updated_at
       ) VALUES (
         gen_random_uuid()::TEXT, $1, $2, 'FILE', $3, $4, $5, $6, $7, $8, NOW(), NOW()
       ) RETURNING *`,
      [
        projectId,
        name,
        file.originalname,
        storedName,
        file.size,
        mimeType,
        dto.description?.trim() ?? '',
        userId || null,
      ],
    );

    return this.findOne(projectId, rows[0].id, userId);
  }

  async update(
    projectId: string,
    id: string,
    dto: UpdateProjectDocumentationDto,
    file?: any,
    userId?: string,
  ): Promise<ProjectDocumentation> {
    await this.projectsService.findOne(projectId, userId);

    const { rows: existingRows } = await this.db.query(
      `SELECT * FROM project_documentation WHERE id = $1 AND project_id = $2`,
      [id, projectId],
    );
    if (!existingRows.length) throw new NotFoundException(`Project documentation "${id}" not found`);

    const existing = existingRows[0];
    let newFileName = existing.file_name;
    let newFilePath = existing.file_path;
    let newFileSize = existing.file_size;
    let newMimeType = existing.mime_type;

    if (file) {
      if (file.size > MAX_BYTES) throw new BadRequestException('File exceeds the 50 MB size limit');
      const mimeType = resolveMimeType(file.originalname, file.mimetype);
      if (!ALLOWED_MIME.has(mimeType)) {
        throw new BadRequestException(
          `File type "${mimeType || file.originalname}" is not supported. Allowed formats: PDF, Word, Excel, PowerPoint, images, CSV, TXT, ZIP, JSON`,
        );
      }
      if (!matchesDeclaredMimeType(file.buffer, mimeType)) {
        throw new BadRequestException(
          `The content of "${file.originalname}" does not match its file type "${mimeType}". The file was rejected.`,
        );
      }

      const ext = path.extname(file.originalname) || '';
      const storedName = `${randomUUID()}${ext}`;
      await fs.promises.writeFile(path.join(UPLOAD_DIR, storedName), file.buffer);

      // Clean up previous file if present
      if (existing.file_path) {
        try {
          await fs.promises.unlink(path.join(UPLOAD_DIR, existing.file_path));
        } catch (_) {}
      }

      newFileName = file.originalname;
      newFilePath = storedName;
      newFileSize = file.size;
      newMimeType = mimeType;
    }

    const updatedName = dto.name !== undefined ? dto.name.trim() : existing.name;
    if (!updatedName) throw new BadRequestException('Document name cannot be empty');

    let updatedUrl = dto.url !== undefined ? dto.url.trim() : existing.url;
    if (existing.type === 'URL' && dto.url !== undefined) {
      if (!updatedUrl) throw new BadRequestException('Document URL cannot be empty');
      try {
        const parsed = new URL(updatedUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new BadRequestException('Document URL must use http or https protocol');
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Invalid URL format');
      }
    }

    const updatedDesc = dto.description !== undefined ? dto.description.trim() : existing.description;

    await this.db.query(
      `UPDATE project_documentation
       SET name = $1, url = $2, file_name = $3, file_path = $4, file_size = $5, mime_type = $6, description = $7, updated_at = NOW()
       WHERE id = $8 AND project_id = $9`,
      [
        updatedName,
        updatedUrl,
        newFileName,
        newFilePath,
        newFileSize,
        newMimeType,
        updatedDesc,
        id,
        projectId,
      ],
    );

    return this.findOne(projectId, id, userId);
  }

  async remove(projectId: string, id: string, userId?: string): Promise<{ success: boolean }> {
    await this.projectsService.findOne(projectId, userId);

    const { rows } = await this.db.query(
      `SELECT file_path FROM project_documentation WHERE id = $1 AND project_id = $2`,
      [id, projectId],
    );
    if (!rows.length) throw new NotFoundException(`Project documentation "${id}" not found`);

    const filePath = rows[0].file_path;
    await this.db.query(`DELETE FROM project_documentation WHERE id = $1 AND project_id = $2`, [id, projectId]);

    if (filePath) {
      try {
        await fs.promises.unlink(path.join(UPLOAD_DIR, filePath));
      } catch (_) {}
    }

    return { success: true };
  }

  async getFilePath(
    projectId: string,
    id: string,
    userId?: string,
  ): Promise<{ doc: ProjectDocumentation; filePath: string }> {
    await this.projectsService.findOne(projectId, userId);

    const { rows } = await this.db.query(
      `SELECT d.*, u.name AS added_by_name, u.email AS added_by_email
       FROM project_documentation d
       LEFT JOIN users u ON d.created_by_id = u.id
       WHERE d.id = $1 AND d.project_id = $2`,
      [id, projectId],
    );
    if (!rows.length) throw new NotFoundException(`Project documentation "${id}" not found`);

    const row = rows[0];
    if (row.type !== 'FILE' || !row.file_path) {
      throw new BadRequestException('This documentation entry is not an uploaded file');
    }

    const fullFilePath = path.join(UPLOAD_DIR, row.file_path);
    if (!fs.existsSync(fullFilePath)) {
      throw new NotFoundException('File data not found on server');
    }

    return { doc: rowToDoc(row), filePath: fullFilePath };
  }
}
