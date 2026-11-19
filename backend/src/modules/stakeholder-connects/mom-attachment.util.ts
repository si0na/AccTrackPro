import * as path from 'path';
import { BadRequestException } from '@nestjs/common';

/**
 * Explicit server-side allowlist for Stakeholder Connect MoM attachments.
 * Maps each allowed lowercase extension to its canonical MIME type.
 */
export const MOM_ATTACHMENT_MIME_BY_EXT: Readonly<Record<string, string>> = {
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf':  'application/pdf',
  '.txt':  'text/plain',
  '.rtf':  'application/rtf',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv':  'text/csv',
  '.ppt':  'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt':  'application/vnd.oasis.opendocument.text',
  '.ods':  'application/vnd.oasis.opendocument.spreadsheet',
  '.odp':  'application/vnd.oasis.opendocument.presentation',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export const MOM_ATTACHMENT_ALLOWED_EXTENSIONS = Object.keys(MOM_ATTACHMENT_MIME_BY_EXT);

export const MOM_ATTACHMENTS_SUBDIR = 'stakeholder-connects-mom';

export const DEFAULT_MOM_MAX_FILE_SIZE_MB = 15;
export const DEFAULT_MOM_MAX_TOTAL_SIZE_MB = 50;
export const DEFAULT_MOM_MAX_FILES = 10;

function parsePositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getMomMaxFileSizeBytes(): number {
  return parsePositiveIntEnv('MOM_ATTACHMENT_MAX_FILE_SIZE_MB', DEFAULT_MOM_MAX_FILE_SIZE_MB) * 1024 * 1024;
}

export function getMomMaxTotalSizeBytes(): number {
  return parsePositiveIntEnv('MOM_ATTACHMENT_MAX_TOTAL_SIZE_MB', DEFAULT_MOM_MAX_TOTAL_SIZE_MB) * 1024 * 1024;
}

export function getMomMaxFilesPerUpload(): number {
  return parsePositiveIntEnv('MOM_ATTACHMENT_MAX_FILES', DEFAULT_MOM_MAX_FILES);
}

/** Resolves the base upload root dynamically so tests and production envs stay aligned. */
export function getUploadRootDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads'));
}

export function getMomAttachmentsBaseDir(): string {
  return path.join(getUploadRootDir(), MOM_ATTACHMENTS_SUBDIR);
}

/**
 * Safely resolves a stored relative storage_path to an absolute disk path inside
 * the MoM attachments base directory, rejecting any path traversal attempts.
 */
export function resolveMomAttachmentDiskPath(storagePath: string): string {
  if (!storagePath || storagePath.includes('\0')) {
    throw new BadRequestException('Invalid attachment storage path.');
  }
  const rootDir = getUploadRootDir();
  const momDir = getMomAttachmentsBaseDir();
  const normalized = storagePath.replace(/\\/g, '/');
  const resolved = path.resolve(rootDir, normalized);

  const prefix = momDir.endsWith(path.sep) ? momDir : `${momDir}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    throw new BadRequestException('Invalid attachment storage path.');
  }
  return resolved;
}

/**
 * Strips directory components and unsafe control characters from a client-supplied
 * filename so it is safe for metadata display and Content-Disposition headers.
 */
export function sanitizeOriginalFilename(rawName: string): string {
  const base = path.basename((rawName ?? '').replace(/\\/g, '/')).trim();
  const cleaned = base
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim();

  if (!cleaned || cleaned === '.' || cleaned === '..') {
    throw new BadRequestException('Uploaded file has an invalid filename.');
  }
  return cleaned.length > 255 ? cleaned.slice(0, 255) : cleaned;
}

/**
 * Formats a safe Content-Disposition header value for downloads (ASCII fallback + RFC 5987 UTF-8).
 */
export function buildSafeContentDisposition(filename: string): string {
  const safe = sanitizeOriginalFilename(filename);
  const asciiFallback = safe.replace(/[^\x20-\x7e]/g, '_').replace(/["\\;]/g, '_');
  const utf8Encoded = encodeURIComponent(safe).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`;
}

// ─── Binary Signature (Magic-Byte) Validation ──────────────────────────────

type SignatureCheck = (buf: Buffer) => boolean;

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (!buf || buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

const isPdf: SignatureCheck = (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]); // %PDF
const isPng: SignatureCheck = (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isJpeg: SignatureCheck = (b) => startsWith(b, [0xff, 0xd8, 0xff]);
const isOle2: SignatureCheck = (b) =>
  startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
// OOXML & OpenDocument containers are non-empty ZIP archives (PK\x03\x04)
const isZipContainer: SignatureCheck = (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]);

const isRtf: SignatureCheck = (b) => {
  if (!b || b.length < 5) return false;
  // Allow optional UTF-8 BOM and leading ASCII whitespace before {\rtf
  let offset = 0;
  if (startsWith(b, [0xef, 0xbb, 0xbf])) offset = 3;
  while (offset < Math.min(b.length, 32) && (b[offset] === 0x20 || b[offset] === 0x09 || b[offset] === 0x0a || b[offset] === 0x0d)) {
    offset++;
  }
  return startsWith(b, [0x7b, 0x5c, 0x72, 0x74, 0x66], offset); // {\rtf
};

const isPlainText: SignatureCheck = (b) => {
  if (!b) return false;
  if (b.length === 0) return true;
  if (startsWith(b, [0xff, 0xfe]) || startsWith(b, [0xfe, 0xff])) return true; // UTF-16 BOM
  const sample = b.subarray(0, 8192);
  return !sample.includes(0x00);
};

const SIGNATURE_BY_EXT: Readonly<Record<string, SignatureCheck>> = {
  '.pdf':  isPdf,
  '.doc':  isOle2,
  '.docx': isZipContainer,
  '.xls':  isOle2,
  '.xlsx': isZipContainer,
  '.ppt':  isOle2,
  '.pptx': isZipContainer,
  '.odt':  isZipContainer,
  '.ods':  isZipContainer,
  '.odp':  isZipContainer,
  '.rtf':  isRtf,
  '.txt':  isPlainText,
  '.csv':  isPlainText,
  '.png':  isPng,
  '.jpg':  isJpeg,
  '.jpeg': isJpeg,
};

export interface ValidatedMomUpload {
  originalFilename: string;
  fileExtension: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
}

export interface UploadedMomFileInput {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

/**
 * Validates a batch of uploaded MoM files strictly on the server:
 * - Non-empty batch and within max file count
 * - Extension in explicit allowlist (case-insensitive)
 * - No duplicate filenames within the same submission
 * - Per-file size <= configured limit & total size <= configured limit
 * - File content bytes match expected binary/text signature for the extension
 */
export function validateMomAttachmentBatch(files: UploadedMomFileInput[]): ValidatedMomUpload[] {
  if (!Array.isArray(files) || files.length === 0) {
    throw new BadRequestException('At least one file must be provided.');
  }

  const maxFiles = getMomMaxFilesPerUpload();
  if (files.length > maxFiles) {
    throw new BadRequestException(`You can upload at most ${maxFiles} files per submission.`);
  }

  const maxFileBytes = getMomMaxFileSizeBytes();
  const maxTotalBytes = getMomMaxTotalSizeBytes();
  const maxFileMb = Math.round(maxFileBytes / (1024 * 1024));
  const maxTotalMb = Math.round(maxTotalBytes / (1024 * 1024));

  const seenLowerNames = new Set<string>();
  const validated: ValidatedMomUpload[] = [];
  let totalBytes = 0;

  for (const file of files) {
    if (!file || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('Invalid file upload payload.');
    }

    const originalFilename = sanitizeOriginalFilename(file.originalname ?? '');
    const ext = path.extname(originalFilename).toLowerCase();
    const canonicalMime = MOM_ATTACHMENT_MIME_BY_EXT[ext];

    if (!ext || !canonicalMime) {
      throw new BadRequestException(
        `File "${originalFilename}" has an unsupported file type. Allowed types: ${MOM_ATTACHMENT_ALLOWED_EXTENSIONS.join(', ')}.`,
      );
    }

    const dedupeKey = originalFilename.toLowerCase();
    if (seenLowerNames.has(dedupeKey)) {
      throw new BadRequestException(
        `Duplicate file "${originalFilename}" detected in the same upload submission.`,
      );
    }
    seenLowerNames.add(dedupeKey);

    const fileSize = typeof file.size === 'number' ? file.size : file.buffer.length;
    if (fileSize > maxFileBytes || file.buffer.length > maxFileBytes) {
      throw new BadRequestException(
        `File "${originalFilename}" exceeds the maximum allowed size of ${maxFileMb} MB.`,
      );
    }

    totalBytes += fileSize;
    if (totalBytes > maxTotalBytes) {
      throw new BadRequestException(
        `Total attachment size exceeds the maximum allowed limit of ${maxTotalMb} MB per submission.`,
      );
    }

    const checkSignature = SIGNATURE_BY_EXT[ext];
    if (!checkSignature || !checkSignature(file.buffer)) {
      throw new BadRequestException(
        `The content of "${originalFilename}" does not match its declared file type (${ext}). The file was rejected.`,
      );
    }

    validated.push({
      originalFilename,
      fileExtension: ext,
      mimeType: canonicalMime,
      fileSize,
      buffer: file.buffer,
    });
  }

  return validated;
}

