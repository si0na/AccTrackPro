import 'reflect-metadata';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  RequestMethod,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { StakeholderConnectsController } from '../stakeholder-connects.controller';
import { StakeholderConnectsService } from '../stakeholder-connects.service';
import {
  MOM_ATTACHMENT_ALLOWED_EXTENSIONS,
  MOM_ATTACHMENTS_SUBDIR,
  buildSafeContentDisposition,
  getMomAttachmentsBaseDir,
  resolveMomAttachmentDiskPath,
  sanitizeOriginalFilename,
  validateMomAttachmentBatch,
} from '../mom-attachment.util';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { PermissionsService } from '../../rbac/permissions.service';
import { AccessScopeService } from '../../rbac/access-scope.service';
import { TtlCacheService } from '../../../common/services/ttl-cache.service';
import type { JwtPayload } from '../../auth/auth-user.decorator';

// Valid binary/text magic-byte fixtures
const PDF_BUF  = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n', 'latin1');
const OLE2_BUF = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
const ZIP_BUF  = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
const RTF_BUF  = Buffer.from('{\\rtf1\\ansi\\deff0 Hello MoM}', 'ascii');
const TXT_BUF  = Buffer.from('Meeting discussion notes and next steps.', 'utf8');
const CSV_BUF  = Buffer.from('Topic,Owner,Status\nPricing,Jane,Open\n', 'utf8');
const PNG_BUF  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPG_BUF  = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const EXE_BUF  = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // PE MZ header

function makeFile(originalname: string, buffer: Buffer, mimetype = 'application/octet-stream', size?: number) {
  return {
    originalname,
    mimetype,
    buffer,
    size: size ?? buffer.length,
  };
}

describe('Stakeholder Connect MoM Document Attachments', () => {
  let tempUploadDir: string;
  let prevUploadDir: string | undefined;

  beforeEach(() => {
    prevUploadDir = process.env.UPLOAD_DIR;
    tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acctrack-mom-test-'));
    process.env.UPLOAD_DIR = tempUploadDir;
  });

  afterEach(() => {
    if (prevUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = prevUploadDir;
    fs.rmSync(tempUploadDir, { recursive: true, force: true });
    delete process.env.MOM_ATTACHMENT_MAX_FILE_SIZE_MB;
    delete process.env.MOM_ATTACHMENT_MAX_TOTAL_SIZE_MB;
    delete process.env.MOM_ATTACHMENT_MAX_FILES;
  });

  // ─── 1. Allowlist, Signature Validation, Path Traversal & Size Limits ────
  describe('File validation, allowlist, signatures & security utilities', () => {
    it('accepts every supported file type with valid content signatures', () => {
      const validSamples: Array<[string, Buffer, string]> = [
        ['brief.doc', OLE2_BUF, 'application/msword'],
        ['brief.docx', ZIP_BUF, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        ['minutes.pdf', PDF_BUF, 'application/pdf'],
        ['notes.txt', TXT_BUF, 'text/plain'],
        ['summary.rtf', RTF_BUF, 'application/rtf'],
        ['budget.xls', OLE2_BUF, 'application/vnd.ms-excel'],
        ['budget.xlsx', ZIP_BUF, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        ['metrics.csv', CSV_BUF, 'text/csv'],
        ['deck.ppt', OLE2_BUF, 'application/vnd.ms-powerpoint'],
        ['deck.pptx', ZIP_BUF, 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        ['minutes.odt', ZIP_BUF, 'application/vnd.oasis.opendocument.text'],
        ['sheet.ods', ZIP_BUF, 'application/vnd.oasis.opendocument.spreadsheet'],
        ['slides.odp', ZIP_BUF, 'application/vnd.oasis.opendocument.presentation'],
        ['whiteboard.png', PNG_BUF, 'image/png'],
        ['photo.jpg', JPG_BUF, 'image/jpeg'],
        ['photo2.jpeg', JPG_BUF, 'image/jpeg'],
      ];

      expect(validSamples.length).toBe(MOM_ATTACHMENT_ALLOWED_EXTENSIONS.length);

      for (const [name, buf, expectedMime] of validSamples) {
        const res = validateMomAttachmentBatch([makeFile(name, buf)]);
        expect(res).toHaveLength(1);
        expect(res[0].mimeType).toBe(expectedMime);
        expect(res[0].fileExtension).toBe(path.extname(name).toLowerCase());
      }
    });

    it('rejects unsupported extensions regardless of browser-declared MIME type', () => {
      const disallowed = [
        makeFile('payload.exe', PDF_BUF, 'application/pdf'),
        makeFile('script.sh', TXT_BUF, 'text/plain'),
        makeFile('xss.html', TXT_BUF, 'text/plain'),
        makeFile('xss.svg', Buffer.from('<svg></svg>'), 'image/svg+xml'),
        makeFile('archive.zip', ZIP_BUF, 'application/zip'),
        makeFile('noextension', PDF_BUF, 'application/pdf'),
      ];
      for (const file of disallowed) {
        expect(() => validateMomAttachmentBatch([file])).toThrow(BadRequestException);
      }
    });

    it('rejects files whose binary signature does not match their declared extension', () => {
      const forged = [
        makeFile('fake.pdf', EXE_BUF, 'application/pdf'),
        makeFile('fake.docx', EXE_BUF, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        makeFile('fake.odt', TXT_BUF, 'application/vnd.oasis.opendocument.text'),
        makeFile('fake.rtf', TXT_BUF, 'application/rtf'),
        makeFile('fake.png', JPG_BUF, 'image/png'),
        makeFile('fake.jpg', PNG_BUF, 'image/jpeg'),
        makeFile('fake.doc', PDF_BUF, 'application/msword'),
        makeFile('binary.txt', EXE_BUF, 'text/plain'),
        makeFile('binary.csv', PNG_BUF, 'text/csv'),
      ];
      for (const file of forged) {
        expect(() => validateMomAttachmentBatch([file])).toThrow(BadRequestException);
      }
    });

    it('enforces per-file size limit, total submission size limit, max files count, and duplicate prevention', () => {
      // Exceeds default 15 MB per-file limit
      expect(() =>
        validateMomAttachmentBatch([makeFile('huge.pdf', PDF_BUF, 'application/pdf', 16 * 1024 * 1024)]),
      ).toThrow(/exceeds the maximum allowed size of 15 MB/i);

      // Exceeds default 50 MB total submission limit across multiple valid files
      expect(() =>
        validateMomAttachmentBatch([
          makeFile('part1.pdf', PDF_BUF, 'application/pdf', 14 * 1024 * 1024),
          makeFile('part2.pdf', PDF_BUF, 'application/pdf', 14 * 1024 * 1024),
          makeFile('part3.pdf', PDF_BUF, 'application/pdf', 14 * 1024 * 1024),
          makeFile('part4.pdf', PDF_BUF, 'application/pdf', 14 * 1024 * 1024),
        ]),
      ).toThrow(/Total attachment size exceeds the maximum allowed limit of 50 MB/i);

      // Duplicate filenames within same submission (case-insensitive)
      expect(() =>
        validateMomAttachmentBatch([
          makeFile('Minutes.pdf', PDF_BUF),
          makeFile('minutes.PDF', PDF_BUF),
        ]),
      ).toThrow(/Duplicate file/i);

      // Configurable env var limits
      process.env.MOM_ATTACHMENT_MAX_FILES = '2';
      expect(() =>
        validateMomAttachmentBatch([
          makeFile('a.pdf', PDF_BUF),
          makeFile('b.pdf', PDF_BUF),
          makeFile('c.pdf', PDF_BUF),
        ]),
      ).toThrow(/at most 2 files/i);
    });

    it('sanitizes filenames, prevents path traversal, and formats safe Content-Disposition headers', () => {
      expect(sanitizeOriginalFilename('../../etc/passwd.pdf')).toBe('passwd.pdf');
      expect(sanitizeOriginalFilename('..\\..\\secret\r\n.pdf')).toBe('secret.pdf');

      expect(() => resolveMomAttachmentDiskPath('../outside.pdf')).toThrow(BadRequestException);
      expect(() => resolveMomAttachmentDiskPath('stakeholder-connects-mom/../../escape.pdf')).toThrow(BadRequestException);
      expect(() => resolveMomAttachmentDiskPath('stakeholder-connects-mom/bad\0name.pdf')).toThrow(BadRequestException);

      const safePath = resolveMomAttachmentDiskPath(`${MOM_ATTACHMENTS_SUBDIR}/abc-123.pdf`);
      expect(safePath.startsWith(getMomAttachmentsBaseDir() + path.sep)).toBe(true);

      const header = buildSafeContentDisposition('Q3 "Review"; Notes.pdf');
      expect(header).toContain('attachment;');
      expect(header).not.toContain('\r');
      expect(header).not.toContain('\n');
      expect(header).toContain("filename*=UTF-8''");
    });
  });

  // ─── 2. Storage Consistency, Failure Cleanup & Controller HTTP Verbs ─────
  describe('Storage consistency, failure cleanup & HTTP contracts', () => {
    let service: StakeholderConnectsService;
    let mockDb: any;
    let mockAccess: any;
    let mockPermissions: any;
    let storedRows: any[];

    beforeEach(() => {
      storedRows = [];
      mockDb = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('FROM stakeholder_connects') && sql.includes('WHERE id = $1')) {
            return {
              rows: [{ id: 'conn-1', accountId: 'acc-1', title: 'Q3 Review', status: 'Scheduled', isDeleted: false }],
            };
          }
          if (sql.startsWith('INSERT INTO stakeholder_connect_mom_attachments')) {
            const row = {
              id: `att-${storedRows.length + 1}`,
              connect_id: params[0],
              original_filename: params[1],
              stored_filename: params[2],
              storage_path: params[3],
              mime_type: params[4],
              file_extension: params[5],
              file_size: params[6],
              uploaded_by: params[7],
              uploaded_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            };
            storedRows.push(row);
            return { rows: [{ id: row.id }] };
          }
          if (sql.includes('FROM stakeholder_connect_mom_attachments a') && sql.includes('WHERE a.id = ANY($1)')) {
            const ids: string[] = params[0] || [];
            return {
              rows: storedRows
                .filter((r) => ids.includes(r.id))
                .map((r) => ({
                  id: r.id,
                  connectId: r.connect_id,
                  originalFilename: r.original_filename,
                  mimeType: r.mime_type,
                  fileExtension: r.file_extension,
                  fileSize: r.file_size,
                  uploadedBy: r.uploaded_by,
                  uploadedByName: 'Alice Manager',
                  uploadedAt: r.uploaded_at,
                  createdAt: r.created_at,
                })),
            };
          }
          if (sql.startsWith('DELETE FROM stakeholder_connect_mom_attachments')) {
            storedRows = storedRows.filter((r) => !(r.id === params[0] && r.connect_id === params[1]));
            return { rows: [] };
          }
          if (sql.includes('FROM stakeholder_connect_mom_attachments') && sql.includes('WHERE id = $1 AND connect_id = $2')) {
            const found = storedRows.find((r) => r.id === params[0] && r.connect_id === params[1]);
            return {
              rows: found
                ? [{
                    id: found.id,
                    connectId: found.connect_id,
                    originalFilename: found.original_filename,
                    storagePath: found.storage_path,
                    mimeType: found.mime_type,
                    fileSize: found.file_size,
                  }]
                : [],
            };
          }
          return { rows: [] };
        }),
        withTransaction: jest.fn(async (cb: any) => {
          const hooks: Array<() => void | Promise<void>> = [];
          const res = await cb(mockDb, { afterCommit: (fn: () => void | Promise<void>) => hooks.push(fn) });
          for (const h of hooks) await h();
          return res;
        }),
      };
      mockAccess = {
        getContext: jest.fn<any>().mockResolvedValue({ canViewAllAccounts: true, permissions: new Set() }),
        verifyAccountVisibility: jest.fn<any>().mockResolvedValue(true),
      };
      mockPermissions = { can: jest.fn<any>().mockResolvedValue(true) };

      service = new StakeholderConnectsService(
        mockDb,
        mockAccess,
        mockPermissions,
        { create: jest.fn() } as any,
        { resolveOrCreate: jest.fn() } as any,
      );
    });

    it('uploads multiple files, stores safely under UPLOAD_DIR, and never exposes storage paths', async () => {
      const uploaded = await service.uploadMomAttachments(
        'conn-1',
        [
          makeFile('agenda.pdf', PDF_BUF, 'application/pdf'),
          makeFile('notes.odt', ZIP_BUF, 'application/octet-stream'),
        ],
        'user-1',
        'Alice Manager',
      );

      expect(uploaded).toHaveLength(2);
      expect(uploaded[0]).not.toHaveProperty('storagePath');
      expect(uploaded[0]).not.toHaveProperty('storedFilename');
      expect(uploaded.map((a) => a.originalFilename).sort()).toEqual(['agenda.pdf', 'notes.odt']);

      const diskFiles = fs.readdirSync(getMomAttachmentsBaseDir());
      expect(diskFiles).toHaveLength(2);
      expect(diskFiles.every((f) => !f.includes('agenda') && !f.includes('notes'))).toBe(true);
    });

    it('cleans up written disk files when storage write fails mid-batch (no orphaned files or DB rows)', async () => {
      const realWrite = fs.promises.writeFile;
      let calls = 0;
      const writeSpy = jest.spyOn(fs.promises, 'writeFile').mockImplementation(async (p: any, data: any) => {
        calls++;
        if (calls === 2) throw new Error('ENOSPC: disk full');
        return realWrite(p, data);
      });

      try {
        await expect(
          service.uploadMomAttachments(
            'conn-1',
            [makeFile('first.pdf', PDF_BUF), makeFile('second.pdf', PDF_BUF)],
            'user-1',
          ),
        ).rejects.toThrow(InternalServerErrorException);

        const momDir = getMomAttachmentsBaseDir();
        const remaining = fs.existsSync(momDir) ? fs.readdirSync(momDir) : [];
        expect(remaining).toHaveLength(0);
        expect(mockDb.withTransaction).not.toHaveBeenCalled();
        expect(storedRows).toHaveLength(0);
      } finally {
        writeSpy.mockRestore();
      }
    });

    it('cleans up written disk files when DB transaction fails (no orphaned files)', async () => {
      mockDb.withTransaction.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(
        service.uploadMomAttachments(
          'conn-1',
          [makeFile('report.pdf', PDF_BUF), makeFile('sheet.xlsx', ZIP_BUF)],
          'user-1',
        ),
      ).rejects.toThrow('DB connection lost');

      const momDir = getMomAttachmentsBaseDir();
      const remaining = fs.existsSync(momDir) ? fs.readdirSync(momDir) : [];
      expect(remaining).toHaveLength(0);
    });

    it('defers disk deletion until DB commit succeeds and preserves file on rollback', async () => {
      const [att] = await service.uploadMomAttachments('conn-1', [makeFile('keep.pdf', PDF_BUF)], 'user-1');
      const diskPath = resolveMomAttachmentDiskPath(storedRows[0].storage_path);
      expect(fs.existsSync(diskPath)).toBe(true);

      // Simulate rollback during delete transaction (e.g. DELETE fails mid-transaction)
      mockDb.withTransaction.mockImplementationOnce(async (cb: any) => {
        const hooks: Array<() => void | Promise<void>> = [];
        await cb(
          {
            query: jest.fn(async (sql: string, params: any[]) => {
              if (sql.startsWith('DELETE FROM stakeholder_connect_mom_attachments')) {
                throw new Error('DB delete failed');
              }
              return mockDb.query(sql, params);
            }),
          },
          { afterCommit: (fn: () => void | Promise<void>) => hooks.push(fn) },
        );
      });

      await expect(service.deleteMomAttachment('conn-1', att.id, 'user-1')).rejects.toThrow('DB delete failed');
      // File MUST still exist on disk because transaction rolled back
      expect(fs.existsSync(diskPath)).toBe(true);
    });

    it('sets secure download headers via controller and uses GET/POST-only HTTP methods', async () => {
      expect(Reflect.getMetadata(METHOD_METADATA, StakeholderConnectsController.prototype.listMomAttachments)).toBe(RequestMethod.GET);
      expect(Reflect.getMetadata(METHOD_METADATA, StakeholderConnectsController.prototype.uploadMomAttachments)).toBe(RequestMethod.POST);
      expect(Reflect.getMetadata(METHOD_METADATA, StakeholderConnectsController.prototype.downloadMomAttachment)).toBe(RequestMethod.GET);
      expect(Reflect.getMetadata(METHOD_METADATA, StakeholderConnectsController.prototype.deleteMomAttachment)).toBe(RequestMethod.POST);
      expect(Reflect.getMetadata(PATH_METADATA, StakeholderConnectsController.prototype.deleteMomAttachment)).toBe(':id/mom-attachments/:attachmentId/delete');

      const [att] = await service.uploadMomAttachments('conn-1', [makeFile('final.pdf', PDF_BUF)], 'user-1');
      const controller = new StakeholderConnectsController(service);
      const setHeaders = jest.fn();
      const streamable = await controller.downloadMomAttachment(
        'conn-1',
        att.id,
        { set: setHeaders } as any,
        { sub: 'user-1', email: 'a@b.com', name: 'Alice', role: 'Admin', roleId: 'r1', type: 'access' },
      );

      expect(streamable).toBeDefined();
      const stream = streamable.getStream();
      await new Promise<void>((resolve) => {
        stream.once('close', () => resolve());
        stream.once('error', () => resolve());
        stream.destroy();
      });
      expect(setHeaders).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
          'Content-Length': String(PDF_BUF.length),
        }),
      );
    });
  });

  // ─── 3. RBAC, Account Isolation, Cross-Connect IDOR & Lifecycle Rules ────
  describe('RBAC, account-level scoping, cross-connect isolation & lifecycle policy', () => {
    let connects: any[];
    let attachments: any[];
    let service: StakeholderConnectsService;
    let controller: StakeholderConnectsController;
    let guard: PermissionsGuard;

    const auth = (sub: string, name = 'User'): JwtPayload => ({
      sub,
      email: `${sub}@example.com`,
      name,
      role: 'User',
      roleId: 'r',
      type: 'access',
    });

    beforeEach(() => {
      connects = [
        { id: 'conn-x-sched', account_id: 'acc-x', title: 'X Scheduled', status: 'Scheduled', is_deleted: false },
        { id: 'conn-x-comp', account_id: 'acc-x', title: 'X Completed', status: 'Completed', is_deleted: false },
        { id: 'conn-x-canc', account_id: 'acc-x', title: 'X Cancelled', status: 'Cancelled', is_deleted: false },
        { id: 'conn-x-del', account_id: 'acc-x', title: 'X Deleted', status: 'Scheduled', is_deleted: true },
        { id: 'conn-z-sched', account_id: 'acc-z', title: 'Z Scheduled', status: 'Scheduled', is_deleted: false },
      ];
      attachments = [];

      const roles = [
        { id: 'role-am', key: 'account-manager', name: 'Account Manager', account_scope_field: 'account_manager_id' },
      ];
      const users = [
        { id: 'u-am-a', email: 'a@test.com', name: 'AM A', role_id: 'role-am' },
        { id: 'u-am-b', email: 'b@test.com', name: 'AM B', role_id: 'role-am' },
        { id: 'u-readonly', email: 'ro@test.com', name: 'Viewer', role_id: 'role-am' },
      ];
      const accounts = [
        { id: 'acc-x', account_manager_id: 'u-am-a', owner_id: 'u-am-a', is_deleted: false },
        { id: 'acc-z', account_manager_id: 'u-am-b', owner_id: 'u-am-b', is_deleted: false },
      ];
      const rolePerms = [
        { role_id: 'role-am', module_key: 'accounts', permission_key: 'view' },
        { role_id: 'role-am', module_key: 'stakeholder-connects', permission_key: 'view' },
        { role_id: 'role-am', module_key: 'stakeholder-connects', permission_key: 'update' },
        { role_id: 'role-am', module_key: 'stakeholder-connects', permission_key: 'delete' },
      ];

      const inMemDb: any = {
        query: jest.fn(async (sql: string, params: any[] = []) => {
          if (sql.includes('FROM users u') && sql.includes('LEFT JOIN roles r')) {
            const u = users.find((x) => x.id === params[0]);
            if (!u) return { rows: [] };
            const r = roles[0];
            return { rows: [{ role_id: r.id, email: u.email, role_key: r.key, role_name: r.name, account_scope_field: r.account_scope_field }] };
          }
          if (sql.includes('FROM user_roles ur')) {
            return { rows: roles };
          }
          if (sql.includes('FROM role_permissions')) {
            return { rows: rolePerms };
          }
          if (sql.includes('FROM accounts a WHERE a.id = $1')) {
            const acc = accounts.find((a) => a.id === params[0] && !a.is_deleted);
            if (!acc) return { rows: [] };
            const scopeUserId = params[1];
            if (scopeUserId && acc.account_manager_id !== scopeUserId && acc.owner_id !== scopeUserId) {
              return { rows: [] };
            }
            return { rows: [{ id: acc.id }] };
          }
          if (sql.includes('FROM stakeholder_connects sc') && sql.includes('JOIN accounts a')) {
            const sc = connects.find((c) => c.id === params[0]);
            if (!sc) return { rows: [] };
            return {
              rows: [{
                id: sc.id,
                accountId: sc.account_id,
                accountName: sc.account_id,
                accountDeleted: false,
                ownerId: 'u-am-a',
                title: sc.title,
                meetingDate: '2026-10-01',
                meetingTime: '10:00:00',
                status: sc.status,
                momNotes: 'Notes',
                isDeleted: sc.is_deleted,
              }],
            };
          }
          if (sql.includes('FROM stakeholder_connects') && sql.includes('WHERE id = $1')) {
            const sc = connects.find((c) => c.id === params[0]);
            if (!sc) return { rows: [] };
            return {
              rows: [{
                id: sc.id,
                accountId: sc.account_id,
                title: sc.title,
                status: sc.status,
                isDeleted: sc.is_deleted,
              }],
            };
          }
          if (sql.startsWith('UPDATE stakeholder_connects') && sql.includes('SET is_deleted = FALSE')) {
            const sc = connects.find((c) => c.id === params[1]);
            if (sc) sc.is_deleted = false;
            return { rows: [] };
          }
          if (sql.startsWith('INSERT INTO stakeholder_connect_mom_attachments')) {
            const row = {
              id: `att-${attachments.length + 1}`,
              connect_id: params[0],
              original_filename: params[1],
              stored_filename: params[2],
              storage_path: params[3],
              mime_type: params[4],
              file_extension: params[5],
              file_size: params[6],
              uploaded_by: params[7],
              uploaded_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            };
            attachments.push(row);
            return { rows: [{ id: row.id }] };
          }
          if (sql.includes('FROM stakeholder_connect_mom_attachments a') && sql.includes('WHERE a.id = ANY($1)')) {
            const ids: string[] = params[0] || [];
            return {
              rows: attachments
                .filter((a) => ids.includes(a.id))
                .map((a) => ({
                  id: a.id,
                  connectId: a.connect_id,
                  originalFilename: a.original_filename,
                  mimeType: a.mime_type,
                  fileExtension: a.file_extension,
                  fileSize: a.file_size,
                  uploadedBy: a.uploaded_by,
                  uploadedByName: users.find((u) => u.id === a.uploaded_by)?.name ?? null,
                  uploadedAt: a.uploaded_at,
                  createdAt: a.created_at,
                })),
            };
          }
          if (sql.includes('FROM stakeholder_connect_mom_attachments a') && sql.includes('WHERE a.connect_id = $1')) {
            return {
              rows: attachments
                .filter((a) => a.connect_id === params[0])
                .map((a) => ({
                  id: a.id,
                  connectId: a.connect_id,
                  originalFilename: a.original_filename,
                  mimeType: a.mime_type,
                  fileExtension: a.file_extension,
                  fileSize: a.file_size,
                  uploadedBy: a.uploaded_by,
                  uploadedByName: users.find((u) => u.id === a.uploaded_by)?.name ?? null,
                  uploadedAt: a.uploaded_at,
                  createdAt: a.created_at,
                })),
            };
          }
          if (sql.startsWith('DELETE FROM stakeholder_connect_mom_attachments')) {
            attachments = attachments.filter((a) => !(a.id === params[0] && a.connect_id === params[1]));
            return { rows: [] };
          }
          if (sql.includes('FROM stakeholder_connect_mom_attachments') && sql.includes('WHERE id = $1 AND connect_id = $2')) {
            const found = attachments.find((a) => a.id === params[0] && a.connect_id === params[1]);
            return {
              rows: found
                ? [{
                    id: found.id,
                    connectId: found.connect_id,
                    originalFilename: found.original_filename,
                    storagePath: found.storage_path,
                    mimeType: found.mime_type,
                    fileSize: found.file_size,
                  }]
                : [],
            };
          }
          return { rows: [] };
        }),
        withTransaction: jest.fn(async (cb: any) => {
          const hooks: Array<() => void | Promise<void>> = [];
          const res = await cb(inMemDb, { afterCommit: (fn: () => void | Promise<void>) => hooks.push(fn) });
          for (const h of hooks) await h();
          return res;
        }),
      };

      const perms = new PermissionsService(inMemDb, new TtlCacheService());
      const access = new AccessScopeService(perms);
      service = new StakeholderConnectsService(
        inMemDb,
        access,
        perms,
        { create: jest.fn() } as any,
        { resolveOrCreate: jest.fn() } as any,
      );
      controller = new StakeholderConnectsController(service);
      guard = new PermissionsGuard(new Reflector(), perms);
    });

    it('permits upload, list, download & delete on Completed meetings for authorized Account Manager', async () => {
      const [uploaded] = await controller.uploadMomAttachments(
        'conn-x-comp',
        [makeFile('completed-mom.pdf', PDF_BUF)],
        auth('u-am-a', 'AM A'),
      );
      expect(uploaded.originalFilename).toBe('completed-mom.pdf');
      expect(uploaded.uploadedByName).toBe('AM A');

      const listed = await controller.listMomAttachments('conn-x-comp', auth('u-am-a'));
      expect(listed).toHaveLength(1);

      const dl = await service.getMomAttachmentDownload('conn-x-comp', uploaded.id, 'u-am-a');
      expect(dl.attachment.originalFilename).toBe('completed-mom.pdf');

      const del = await controller.deleteMomAttachment('conn-x-comp', uploaded.id, auth('u-am-a'));
      expect(del).toEqual({ success: true });
      expect(await controller.listMomAttachments('conn-x-comp', auth('u-am-a'))).toHaveLength(0);
    });

    it('Cancelled meetings allow view/download of existing attachments but reject upload and delete', async () => {
      // Seed an attachment on conn-x-sched then cancel it
      const [att] = await service.uploadMomAttachments('conn-x-sched', [makeFile('pre-cancel.pdf', PDF_BUF)], 'u-am-a');
      connects[0].status = 'Cancelled';

      const listed = await controller.listMomAttachments('conn-x-sched', auth('u-am-a'));
      expect(listed).toHaveLength(1);
      const dl = await service.getMomAttachmentDownload('conn-x-sched', att.id, 'u-am-a');
      expect(dl.attachment.id).toBe(att.id);

      await expect(
        controller.uploadMomAttachments('conn-x-sched', [makeFile('blocked.pdf', PDF_BUF)], auth('u-am-a')),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.deleteMomAttachment('conn-x-sched', att.id, auth('u-am-a')),
      ).rejects.toThrow(BadRequestException);
    });

    it('Soft-deleted meetings block attachment listing, download, upload & delete, and preserve attachments after restore', async () => {
      const [att] = await service.uploadMomAttachments('conn-x-sched', [makeFile('preserved.pdf', PDF_BUF)], 'u-am-a');
      connects[0].is_deleted = true;

      await expect(controller.listMomAttachments('conn-x-sched', auth('u-am-a'))).rejects.toThrow(NotFoundException);
      await expect(service.getMomAttachmentDownload('conn-x-sched', att.id, 'u-am-a')).rejects.toThrow(NotFoundException);
      await expect(
        controller.uploadMomAttachments('conn-x-sched', [makeFile('new.pdf', PDF_BUF)], auth('u-am-a')),
      ).rejects.toThrow(NotFoundException);
      await expect(controller.deleteMomAttachment('conn-x-sched', att.id, auth('u-am-a'))).rejects.toThrow(NotFoundException);

      // Restore meeting -> existing attachment remains intact and downloadable
      await controller.restore('conn-x-sched', auth('u-am-a'));
      const listedAfterRestore = await controller.listMomAttachments('conn-x-sched', auth('u-am-a'));
      expect(listedAfterRestore).toHaveLength(1);
      expect(listedAfterRestore[0].id).toBe(att.id);
      const dlAfterRestore = await service.getMomAttachmentDownload('conn-x-sched', att.id, 'u-am-a');
      expect(fs.existsSync(dlAfterRestore.filePath)).toBe(true);
    });

    it('rejects cross-account access with 403 Forbidden (no state oracle) and blocks cross-connect attachment IDOR', async () => {
      const [attX] = await service.uploadMomAttachments('conn-x-sched', [makeFile('x-secret.pdf', PDF_BUF)], 'u-am-a');
      const [attZ] = await service.uploadMomAttachments('conn-z-sched', [makeFile('z-secret.pdf', PDF_BUF)], 'u-am-b');

      // AM B cannot access any attachment endpoint on AM A's Scheduled, Completed, Cancelled, or Soft-Deleted connects (always 403)
      for (const cid of ['conn-x-sched', 'conn-x-comp', 'conn-x-canc', 'conn-x-del']) {
        await expect(controller.listMomAttachments(cid, auth('u-am-b'))).rejects.toThrow(ForbiddenException);
        await expect(service.getMomAttachmentDownload(cid, attX.id, 'u-am-b')).rejects.toThrow(ForbiddenException);
        await expect(
          controller.uploadMomAttachments(cid, [makeFile('probe.pdf', PDF_BUF)], auth('u-am-b')),
        ).rejects.toThrow(ForbiddenException);
        await expect(controller.deleteMomAttachment(cid, attX.id, auth('u-am-b'))).rejects.toThrow(ForbiddenException);
      }

      // Cross-connect IDOR: AM A cannot use AM B's attachment ID through AM A's own connect route
      await expect(service.getMomAttachmentDownload('conn-x-sched', attZ.id, 'u-am-a')).rejects.toThrow(NotFoundException);
      await expect(controller.deleteMomAttachment('conn-x-sched', attZ.id, auth('u-am-a'))).rejects.toThrow(NotFoundException);

      // Cross-connect IDOR within same account: attachment from conn-x-sched cannot be downloaded/deleted via conn-x-comp
      await expect(service.getMomAttachmentDownload('conn-x-comp', attX.id, 'u-am-a')).rejects.toThrow(NotFoundException);
      await expect(controller.deleteMomAttachment('conn-x-comp', attX.id, auth('u-am-a'))).rejects.toThrow(NotFoundException);

      // Verify RBAC permission guard metadata on attachment routes
      const ctx: ExecutionContext = {
        getHandler: () => StakeholderConnectsController.prototype.uploadMomAttachments,
        getClass: () => StakeholderConnectsController,
        switchToHttp: () => ({ getRequest: () => ({ user: { sub: 'u-am-a' } }) }),
      } as any;
      expect(await guard.canActivate(ctx)).toBe(true);
    });
  });

  // ─── 4. Migration 116 Definition Sanity Check ────────────────────────────
  describe('Migration 116 SQL Definition', () => {
    it('defines stakeholder_connect_mom_attachments table with FK, indexes, and rollback instructions', () => {
      const sql = fs.readFileSync(
        path.join(__dirname, '../../../database/migrations/116_stakeholder_connect_mom_attachments.sql'),
        'utf-8',
      );
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS stakeholder_connect_mom_attachments');
      expect(sql).toContain('REFERENCES stakeholder_connects(id)');
      expect(sql).toContain('original_filename');
      expect(sql).toContain('stored_filename');
      expect(sql).toContain('storage_path');
      expect(sql).toContain('mime_type');
      expect(sql).toContain('file_extension');
      expect(sql).toContain('file_size');
      expect(sql).toContain('uploaded_by');
      expect(sql).toContain('uploaded_at');
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS');
      expect(sql).toContain('Reversible rollback:');
    });
  });
});

