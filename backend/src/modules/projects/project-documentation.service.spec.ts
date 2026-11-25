import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectDocumentationService } from './project-documentation.service';
import * as fs from 'fs';
import * as path from 'path';

describe('ProjectDocumentationService', () => {
  let service: ProjectDocumentationService;
  let mockDb: any;
  let mockProjectsService: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    mockProjectsService = {
      findOne: jest.fn().mockResolvedValue({ id: 'proj-123', name: 'Test Project' }),
    };

    service = new ProjectDocumentationService(mockDb, mockProjectsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findAll', () => {
    it('returns all documentation for a project mapped correctly', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'doc-1',
            project_id: 'proj-123',
            name: 'API Specs',
            type: 'URL',
            url: 'https://example.com/api',
            description: 'API reference documentation',
            created_by_id: 'user-1',
            added_by_name: 'Alice Johnson',
            added_by_email: 'alice@example.com',
            created_at: new Date('2026-11-18T10:00:00Z'),
            updated_at: new Date('2026-11-18T11:00:00Z'),
          },
        ],
      });

      const result = await service.findAll('proj-123', 'user-1');
      expect(mockProjectsService.findOne).toHaveBeenCalledWith('proj-123', 'user-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'doc-1',
        projectId: 'proj-123',
        name: 'API Specs',
        type: 'URL',
        url: 'https://example.com/api',
        fileName: undefined,
        fileSize: undefined,
        mimeType: undefined,
        description: 'API reference documentation',
        createdById: 'user-1',
        addedBy: 'Alice Johnson',
        createdAt: '2026-11-18T10:00:00.000Z',
        updatedAt: '2026-11-18T11:00:00.000Z',
      });
    });
  });

  describe('createUrl', () => {
    it('creates URL documentation with valid fields', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'doc-url-1' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'doc-url-1',
              project_id: 'proj-123',
              name: 'Architecture Diagram',
              type: 'URL',
              url: 'https://miro.com/app/board/123',
              description: 'System context diagram',
              created_by_id: 'user-1',
              added_by_name: 'Alice',
              created_at: new Date('2026-11-18T10:00:00Z'),
              updated_at: new Date('2026-11-18T10:00:00Z'),
            },
          ],
        });

      const result = await service.createUrl(
        'proj-123',
        {
          name: 'Architecture Diagram',
          url: 'https://miro.com/app/board/123',
          description: 'System context diagram',
        },
        'user-1',
      );

      expect(mockProjectsService.findOne).toHaveBeenCalledWith('proj-123', 'user-1');
      expect(result.id).toBe('doc-url-1');
      expect(result.type).toBe('URL');
      expect(result.url).toBe('https://miro.com/app/board/123');
    });

    it('rejects empty name or invalid URL', async () => {
      await expect(
        service.createUrl('proj-123', { name: '', url: 'https://example.com' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createUrl('proj-123', { name: 'Valid Name', url: 'ftp://not-allowed' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createUrl('proj-123', { name: 'Valid Name', url: 'not-a-valid-url' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createFile', () => {
    it('creates File documentation when valid file and signature provided', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.7\n%test content\n', 'latin1');
      const fakeFile = {
        originalname: 'ProjectPlan.pdf',
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
        buffer: pdfBuffer,
      };

      jest.spyOn(fs.promises, 'writeFile').mockResolvedValueOnce(undefined);

      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ id: 'doc-file-1' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'doc-file-1',
              project_id: 'proj-123',
              name: 'Project Plan 2026',
              type: 'FILE',
              file_name: 'ProjectPlan.pdf',
              file_path: 'mock-uuid.pdf',
              file_size: pdfBuffer.length,
              mime_type: 'application/pdf',
              description: 'Initial plan',
              created_by_id: 'user-1',
              added_by_name: 'Alice',
              created_at: new Date('2026-11-18T10:00:00Z'),
              updated_at: new Date('2026-11-18T10:00:00Z'),
            },
          ],
        });

      const result = await service.createFile(
        'proj-123',
        { name: 'Project Plan 2026', description: 'Initial plan' },
        fakeFile,
        'user-1',
      );

      expect(result.id).toBe('doc-file-1');
      expect(result.type).toBe('FILE');
      expect(result.fileName).toBe('ProjectPlan.pdf');
      expect(result.mimeType).toBe('application/pdf');
    });

    it('rejects upload when no file is provided', async () => {
      await expect(
        service.createFile('proj-123', { name: 'Doc Name' }, null as any, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unsupported file extensions/mime', async () => {
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
      const fakeFile = {
        originalname: 'malicious.exe',
        mimetype: 'application/x-msdownload',
        size: exeBuffer.length,
        buffer: exeBuffer,
      };

      await expect(
        service.createFile('proj-123', { name: 'Doc Name' }, fakeFile, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects spoofed file where bytes do not match declared PDF type', async () => {
      const fakeFile = {
        originalname: 'fake.pdf',
        mimetype: 'application/pdf',
        size: 10,
        buffer: Buffer.from('NOT_A_PDF!'),
      };

      await expect(
        service.createFile('proj-123', { name: 'Doc Name' }, fakeFile, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates metadata and updates updated_at', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'doc-url-1',
              project_id: 'proj-123',
              name: 'Old Name',
              type: 'URL',
              url: 'https://example.com/old',
              description: 'Old desc',
              file_path: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'doc-url-1',
              project_id: 'proj-123',
              name: 'Updated Name',
              type: 'URL',
              url: 'https://example.com/updated',
              description: 'Updated desc',
              created_by_id: 'user-1',
              added_by_name: 'Alice',
              created_at: new Date('2026-11-18T10:00:00Z'),
              updated_at: new Date('2026-11-18T12:00:00Z'),
            },
          ],
        });

      const result = await service.update(
        'proj-123',
        'doc-url-1',
        {
          name: 'Updated Name',
          url: 'https://example.com/updated',
          description: 'Updated desc',
        },
        undefined,
        'user-1',
      );

      expect(result.name).toBe('Updated Name');
      expect(result.url).toBe('https://example.com/updated');
      expect(result.description).toBe('Updated desc');
    });

    it('throws NotFoundException if record to update is missing', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.update('proj-123', 'non-existent', { name: 'New Name' }, undefined, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes record from database and unlinks file if present', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ file_path: 'mock-file.pdf' }],
        })
        .mockResolvedValueOnce({ rowCount: 1 });

      const unlinkSpy = jest.spyOn(fs.promises, 'unlink').mockResolvedValueOnce(undefined);

      const result = await service.remove('proj-123', 'doc-1', 'user-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM project_documentation WHERE id = $1 AND project_id = $2',
        ['doc-1', 'proj-123'],
      );
      expect(unlinkSpy).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when removing a non-existent document', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.remove('proj-123', 'missing-id', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getFilePath', () => {
    it('throws BadRequestException if document is a URL and not a FILE', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'doc-url',
            project_id: 'proj-123',
            name: 'Web Link',
            type: 'URL',
            file_path: null,
          },
        ],
      });

      await expect(service.getFilePath('proj-123', 'doc-url', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns doc and filepath when file exists on disk', async () => {
      const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads'));
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const testFilePath = path.join(uploadDir, 'stored-spec.pdf');
      fs.writeFileSync(testFilePath, 'dummy pdf content');

      mockDb.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'doc-file',
            project_id: 'proj-123',
            name: 'Spec.pdf',
            type: 'FILE',
            file_name: 'Spec.pdf',
            file_path: 'stored-spec.pdf',
            file_size: 1024,
            mime_type: 'application/pdf',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });

      try {
        const result = await service.getFilePath('proj-123', 'doc-file', 'user-1');
        expect(result.doc.name).toBe('Spec.pdf');
        expect(result.filePath).toContain('stored-spec.pdf');
      } finally {
        try { fs.unlinkSync(testFilePath); } catch (_) {}
      }
    });
  });
});
