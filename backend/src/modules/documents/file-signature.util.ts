/**
 * File-signature (magic-byte) validation for uploaded documents.
 *
 * The MIME type sent by the client is attacker-controlled — a renamed
 * executable arrives as "application/pdf" if the client says so. Each upload
 * is therefore checked against the binary signature expected for its declared
 * MIME type, and rejected when the content does not match.
 */

type SignatureCheck = (buf: Buffer) => boolean;

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

const isPdf: SignatureCheck  = (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]); // %PDF
const isPng: SignatureCheck  = (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isJpeg: SignatureCheck = (b) => startsWith(b, [0xff, 0xd8, 0xff]);
const isGif: SignatureCheck  = (b) =>
  startsWith(b, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || // GIF87a
  startsWith(b, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);   // GIF89a
const isWebp: SignatureCheck = (b) =>
  startsWith(b, [0x52, 0x49, 0x46, 0x46]) &&              // RIFF
  startsWith(b, [0x57, 0x45, 0x42, 0x50], 8);             // WEBP
// PK\x03\x04 (normal), PK\x05\x06 (empty archive), PK\x07\x08 (spanned)
const isZip: SignatureCheck = (b) =>
  startsWith(b, [0x50, 0x4b, 0x03, 0x04]) ||
  startsWith(b, [0x50, 0x4b, 0x05, 0x06]) ||
  startsWith(b, [0x50, 0x4b, 0x07, 0x08]);
// OOXML (docx/xlsx/pptx) is a ZIP container — non-empty archive only.
const isOoxml: SignatureCheck = (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]);
// Legacy Office (doc/xls/ppt) uses the OLE2 compound-file signature.
const isOle2: SignatureCheck = (b) =>
  startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/**
 * Plain-text types have no magic bytes. Sniff the first 8 KB: UTF-16 BOMs are
 * accepted as text; otherwise any NUL byte marks the content as binary.
 */
const isText: SignatureCheck = (b) => {
  if (b.length === 0) return true;
  if (startsWith(b, [0xff, 0xfe]) || startsWith(b, [0xfe, 0xff])) return true; // UTF-16 BOM
  const sample = b.subarray(0, 8192);
  return !sample.includes(0x00);
};

const isSvg: SignatureCheck = (b) => {
  if (!isText(b)) return false;
  const head = b.subarray(0, 4096).toString('utf8').toLowerCase();
  return head.includes('<svg');
};

const SIGNATURE_BY_MIME: Record<string, SignatureCheck> = {
  'application/pdf': isPdf,
  'application/msword': isOle2,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': isOoxml,
  'application/vnd.ms-excel': isOle2,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': isOoxml,
  'application/vnd.ms-powerpoint': isOle2,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': isOoxml,
  'text/plain': isText,
  'text/csv': isText,
  'application/json': isText,
  'image/png': isPng,
  'image/jpeg': isJpeg,
  'image/jpg': isJpeg,
  'image/gif': isGif,
  'image/webp': isWebp,
  'image/svg+xml': isSvg,
  'application/zip': isZip,
  'application/x-zip-compressed': isZip,
};

/**
 * Returns true when the buffer's content matches the signature expected for
 * the declared MIME type. Unknown MIME types return false — the allowed-type
 * whitelist in DocumentsService is checked first, so this only fires if the
 * two lists ever drift apart.
 */
export function matchesDeclaredMimeType(buffer: Buffer, mimeType: string): boolean {
  const check = SIGNATURE_BY_MIME[mimeType];
  if (!check) return false;
  return check(buffer);
}
