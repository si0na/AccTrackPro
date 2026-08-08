import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { toIsoString } from '../../common/utils/db-mapping.util';
import { matchesDeclaredMimeType } from './file-signature.util';
import { resolveMimeType } from './file-type.util';

export interface CrmDocument {
  id: string;
  accountId: string;
  /** Set when the document is attached to an opportunity rather than the account itself. */
  opportunityId?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

/** A document is attached to exactly one business entity. */
export interface DocumentTarget {
  accountId?: string;
  opportunityId?: string;
}

// Resolved once at startup. In production UPLOAD_DIR must point outside the
// application directory (enforced by env validation in main.ts) so uploaded
// documents survive redeploys; the cwd fallback is a dev-only convenience.
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

const MAX_BYTES = 50 * 1024 * 1024;

function rowToDoc(row: any): CrmDocument {
  return {
    id:           row.id,
    accountId:    row.account_id,
    opportunityId: row.opportunity_id ?? undefined,
    fileName:     row.file_name,
    originalName: row.original_name,
    // Resolved rather than returned verbatim so rows stored before MIME types
    // were canonicalised on write still report the correct type.
    mimeType:     resolveMimeType(row.original_name, row.mime_type),
    sizeBytes:    Number(row.size_bytes),
    uploadedBy:   row.uploaded_by,
    createdAt:    toIsoString(row.created_at)!,
  };
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly bus: NotificationEventBus,
  ) {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    this.logger.log(`Document storage directory: ${UPLOAD_DIR}`);
  }

  /** Account-level documents only — attachments on the account's opportunities are listed on the opportunity. */
  async findByAccount(accountId: string, userId?: string): Promise<CrmDocument[]> {
    await this.assertAccountAccess(accountId, userId);
    const { rows } = await this.db.query(
      `SELECT * FROM documents WHERE account_id=$1 AND opportunity_id IS NULL ORDER BY created_at DESC`,
      [accountId],
    );
    return rows.map(rowToDoc);
  }

  async findByOpportunity(opportunityId: string, userId?: string): Promise<CrmDocument[]> {
    await this.assertOpportunityAccess(opportunityId, userId);
    const { rows } = await this.db.query(
      `SELECT * FROM documents WHERE opportunity_id=$1 ORDER BY created_at DESC`,
      [opportunityId],
    );
    return rows.map(rowToDoc);
  }

  async findOne(id: string, userId?: string): Promise<CrmDocument> {
    const { rows } = await this.db.query(
      `SELECT d.*
       FROM documents d
       INNER JOIN accounts a ON d.account_id = a.id
       WHERE d.id=$1
       AND ($2::TEXT IS NULL OR a.owner_id = $2)`,
      [id, userId ?? null],
    );
    if (!rows.length) throw new NotFoundException(`Document "${id}" not found`);
    return rowToDoc(rows[0]);
  }

  async create(
    file: any,
    target: DocumentTarget,
    uploader: { id: string; name: string },
  ): Promise<CrmDocument> {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_BYTES) throw new BadRequestException('File exceeds the 50 MB size limit');

    // Browsers disagree on the MIME type they report for the same file, so the
    // extension decides the type and the client's value is only a fallback.
    // This is what stops e.g. a .xlsx arriving as octet-stream, or a .csv
    // arriving as application/vnd.ms-excel, from being stored as the wrong type.
    const mimeType = resolveMimeType(file.originalname, file.mimetype);
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new BadRequestException(
        `File type "${mimeType || file.originalname}" is not supported. Allowed types: PDF, Word, Excel, PowerPoint, images, CSV, TXT, ZIP, JSON`,
      );
    }
    // Neither the extension nor the declared MIME type describes the bytes —
    // verify the actual file content (magic bytes) before anything touches disk.
    if (!matchesDeclaredMimeType(file.buffer, mimeType)) {
      this.logger.warn(
        `Upload rejected: content of "${file.originalname}" does not match its type "${mimeType}"`,
      );
      throw new BadRequestException(
        `The content of "${file.originalname}" does not match its file type "${mimeType}". The file was rejected.`,
      );
    }

    let accountId = target.accountId;
    const opportunityId = target.opportunityId || undefined;

    if (opportunityId) {
      // Opportunity attachment: the parent account is derived server-side so
      // account-level cascade delete continues to cover these documents.
      // Also verifies the opportunity belongs to the uploading user.
      const { rows: opp } = await this.db.query(
        `SELECT id, account_id FROM opportunities WHERE id=$1 AND is_deleted=FALSE
         AND ($2::TEXT IS NULL OR owner_id = $2)`,
        [opportunityId, uploader.id || null],
      );
      if (!opp.length) throw new BadRequestException('The selected opportunity does not exist');
      accountId = opp[0].account_id;
    } else {
      if (!accountId) throw new BadRequestException('An accountId or opportunityId is required');
      const { rows: acct } = await this.db.query(
        `SELECT id FROM accounts WHERE id=$1 AND is_deleted=FALSE
         AND ($2::TEXT IS NULL OR owner_id = $2)`,
        [accountId, uploader.id || null],
      );
      if (!acct.length) throw new BadRequestException('The selected account does not exist');
    }

    // Duplicate names are checked per attachment target, so an account and its
    // opportunities can each hold a file of the same name independently.
    const { rows: dup } = opportunityId
      ? await this.db.query(
          `SELECT id FROM documents WHERE opportunity_id=$1 AND original_name=$2`,
          [opportunityId, file.originalname],
        )
      : await this.db.query(
          `SELECT id FROM documents WHERE account_id=$1 AND opportunity_id IS NULL AND original_name=$2`,
          [accountId, file.originalname],
        );
    if (dup.length) {
      throw new ConflictException(
        `A file named "${file.originalname}" already exists for this ${opportunityId ? 'opportunity' : 'account'}`,
      );
    }

    const ext = path.extname(file.originalname) || '';
    const storedName = `${randomUUID()}${ext}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, storedName), file.buffer);

    const { rows } = await this.db.query(
      `INSERT INTO documents (id, account_id, opportunity_id, file_name, original_name, mime_type, size_bytes, uploaded_by)
       VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      // uploaded_by stores the display name (shown in the UI); the uploader's
      // UUID is used for the notification below.
      [accountId, opportunityId ?? null, storedName, file.originalname, mimeType, file.size, uploader.name],
    );
    const doc = rowToDoc(rows[0]);

    if (uploader.id) {
      this.bus.emit({
        userId:               uploader.id,
        type:                 'Document',
        eventType:            'Uploaded',
        title:                'Document Uploaded',
        message:              `"${doc.originalName}" has been uploaded successfully.`,
        severity:             'Info',
        notificationCategory: 'BUSINESS',
        accountId:            doc.accountId,
        opportunityId:        doc.opportunityId,
        documentId:           doc.id,
      });
    }

    return doc;
  }

  async getFilePath(id: string, userId?: string): Promise<{ doc: CrmDocument; filePath: string }> {
    const doc = await this.findOne(id, userId);
    const filePath = path.join(UPLOAD_DIR, doc.fileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File data not found on server');
    }
    return { doc, filePath };
  }

  async remove(id: string, requestingUserId?: string): Promise<{ success: boolean }> {
    const doc = await this.findOne(id, requestingUserId);
    await this.db.query(`DELETE FROM documents WHERE id=$1`, [id]);
    try { await fs.promises.unlink(path.join(UPLOAD_DIR, doc.fileName)); } catch (_) {}

    // Notify the requesting user (uploaded_by only holds a display name, not a user id).
    if (requestingUserId) {
      this.bus.emit({
        userId:               requestingUserId,
        type:                 'Document',
        eventType:            'Deleted',
        title:                'Document Deleted',
        message:              `"${doc.originalName}" has been removed from the ${doc.opportunityId ? 'opportunity' : 'account'}.`,
        severity:             'Warning',
        notificationCategory: 'BUSINESS',
        accountId:            doc.accountId,
        opportunityId:        doc.opportunityId,
      });
    }

    return { success: true };
  }

  /** Verify the requesting user owns the account before listing its documents. */
  private async assertAccountAccess(accountId: string, userId?: string): Promise<void> {
    if (!accountId) throw new BadRequestException('accountId is required');
    const { rows } = await this.db.query(
      `SELECT id FROM accounts WHERE id=$1 AND is_deleted=FALSE
       AND ($2::TEXT IS NULL OR owner_id = $2)`,
      [accountId, userId ?? null],
    );
    if (!rows.length) throw new NotFoundException(`Account "${accountId}" not found`);
  }

  /** Verify the requesting user owns the opportunity (via its account) before listing its documents. */
  private async assertOpportunityAccess(opportunityId: string, userId?: string): Promise<void> {
    const { rows } = await this.db.query(
      `SELECT o.id FROM opportunities o
       INNER JOIN accounts a ON o.account_id = a.id
       WHERE o.id=$1 AND o.is_deleted=FALSE
       AND ($2::TEXT IS NULL OR a.owner_id = $2)`,
      [opportunityId, userId ?? null],
    );
    if (!rows.length) throw new NotFoundException(`Opportunity "${opportunityId}" not found`);
  }
}
