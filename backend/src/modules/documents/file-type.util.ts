/**
 * Canonical MIME-type resolution for uploaded documents.
 *
 * The MIME type a browser reports for a file depends on the uploader's machine,
 * not on the file itself: Windows sends `.csv` as `application/vnd.ms-excel`
 * when Excel is installed, some clients send `application/x-zip-compressed` for
 * `.zip`, and others fall back to `application/octet-stream` entirely. Storing
 * that value verbatim makes a document's type — and therefore its label, icon
 * and preview behaviour — depend on who uploaded it.
 *
 * The file extension is therefore authoritative for every format the app
 * accepts, and the declared MIME type is only a fallback for files without a
 * recognised extension. The result is one canonical MIME type per format, which
 * the signature check, the download Content-Type header and the frontend all
 * rely on.
 */

import * as path from 'path';

/** The single MIME type stored for each accepted file extension. */
export const CANONICAL_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.pdf':  'application/pdf',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt':  'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt':  'text/plain',
  '.csv':  'text/csv',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.zip':  'application/zip',
};

/** Non-standard MIME spellings various clients emit, folded onto the canonical value. */
const MIME_ALIASES: Readonly<Record<string, string>> = {
  'application/x-zip-compressed': 'application/zip',
  'application/x-zip':            'application/zip',
  'image/jpg':                    'image/jpeg',
  'image/pjpeg':                  'image/jpeg',
  'text/json':                    'application/json',
  'application/x-msexcel':        'application/vnd.ms-excel',
  'application/excel':            'application/vnd.ms-excel',
  'application/mspowerpoint':     'application/vnd.ms-powerpoint',
  'application/vnd.msword':       'application/msword',
};

/** Lower-cased extension including the leading dot, or '' when there is none. */
export function extensionOf(originalName: string): string {
  return path.extname(originalName ?? '').toLowerCase();
}

/**
 * The MIME type to store for an upload. Prefers the file extension, falls back
 * to the (alias-normalised) type declared by the client.
 */
export function resolveMimeType(originalName: string, declaredMimeType?: string): string {
  const byExtension = CANONICAL_MIME_BY_EXTENSION[extensionOf(originalName)];
  if (byExtension) return byExtension;

  const declared = (declaredMimeType ?? '').toLowerCase().trim();
  return MIME_ALIASES[declared] ?? declared;
}
