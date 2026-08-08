/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Text extraction for the legacy binary Office formats — Word 97-2003 (`.doc`)
 * and PowerPoint 97-2003 (`.ppt`).
 *
 * Unlike their OOXML successors these are not ZIP archives, so mammoth/JSZip
 * cannot read them. Both are OLE compound files (CFB), and the `xlsx` package
 * already bundles a CFB reader (`XLSX.CFB`) for `.xls` — this module reuses it
 * rather than adding another dependency.
 *
 * What is recovered is the *text*, not the layout: these extractors read the
 * document's character stream and drop the formatting tables. The UI labels
 * such previews as text-only and always offers Download for the real file.
 */

/** Thrown when the bytes cannot be recognised as the expected legacy format. */
export class LegacyParseError extends Error {}

export interface LegacySlide {
  title: string;
  lines: string[];
}

/** CFB entry contents come back as Uint8Array or number[] depending on options. */
function toBytes(content: any): Uint8Array {
  return content instanceof Uint8Array ? content : new Uint8Array(content);
}

/**
 * Decode a run of character data that may be UTF-16LE or a single-byte codepage.
 * Word stores either depending on the document, with no flag we can read
 * without walking the piece table, so the encoding is inferred from the bytes:
 * in UTF-16LE Latin text almost every odd byte is 0x00.
 */
function decodeChars(bytes: Uint8Array): { text: string; utf16: boolean } {
  const sample = Math.min(bytes.length, 4096);
  let zeros = 0;
  for (let i = 1; i < sample; i += 2) if (bytes[i] === 0) zeros++;
  const utf16 = sample > 8 && zeros > sample / 4;
  const text = new TextDecoder(utf16 ? 'utf-16le' : 'windows-1252', { fatal: false })
    .decode(bytes);
  return { text, utf16 };
}

/**
 * Map Word's in-band control characters to whitespace and drop the rest:
 * 0x07 ends a table cell/row, 0x0B is a line break, 0x0C a page break, and
 * 0x13/0x14/0x15 delimit field codes (whose raw text is machine-readable noise).
 */
function cleanWordText(raw: string): string {
  let out = '';
  let inFieldCode = false;
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code === 0x13) { inFieldCode = true; continue; }   // field begin
    if (code === 0x14) { inFieldCode = false; continue; }  // field separator
    if (code === 0x15) { inFieldCode = false; continue; }  // field end
    if (inFieldCode) continue;
    if (code === 0x0d || code === 0x0b || code === 0x0c || code === 0x0e) { out += '\n'; continue; }
    if (code === 0x07) { out += '\t'; continue; }
    if (ch === '\n' || ch === '\t') { out += ch; continue; }
    if (code < 0x20 || code === 0x7f) continue;
    out += ch;
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Share of characters that are plain readable text — a sanity check on the decode. */
function printableRatio(text: string): number {
  if (!text.length) return 0;
  let ok = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code === 9 || code === 10 || (code >= 32 && code !== 0xfffd)) ok++;
  }
  return ok / text.length;
}

/**
 * Extract the body text of a Word 97-2003 document.
 *
 * The main text always begins at offset 0x800 of the `WordDocument` stream;
 * `ccpText` in the FIB gives its length in characters.
 */
export function extractDocText(cfb: any, CFB: any): string {
  const entry = CFB.find(cfb, 'WordDocument');
  if (!entry) throw new LegacyParseError('Not a Word 97-2003 document');

  const bytes = toBytes(entry.content);
  if (bytes.length < 0x80) throw new LegacyParseError('Word stream is truncated');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (dv.getUint16(0, true) !== 0xa5ec) throw new LegacyParseError('Unrecognised Word file header');

  const nFib = dv.getUint16(2, true);
  let start: number;
  let byteLength: number;

  if (nFib >= 101) {
    // Word 97 and later: FibRgLw97 begins at 0x40, ccpText is its 4th DWORD.
    const ccpText = dv.getUint32(0x4c, true);
    start = 0x800;
    byteLength = ccpText > 0 ? ccpText * 2 : bytes.length - start;
  } else {
    // Word 6/95: the text range is given directly by fcMin/fcMac.
    start = dv.getUint32(0x18, true);
    byteLength = dv.getUint32(0x1c, true) - start;
  }

  if (start >= bytes.length || byteLength <= 0) throw new LegacyParseError('Document contains no text');
  byteLength = Math.min(byteLength, bytes.length - start, 8 * 1024 * 1024);

  const slice = bytes.subarray(start, start + byteLength);
  let { text, utf16 } = decodeChars(slice);
  // A single-byte document over-reads by 2x with the UTF-16 length estimate;
  // re-slice to the true character count once the encoding is known.
  if (!utf16 && nFib >= 101) {
    const chars = Math.min(dv.getUint32(0x4c, true) || byteLength, byteLength);
    text = decodeChars(bytes.subarray(start, start + chars)).text;
  }

  const cleaned = cleanWordText(text);
  if (!cleaned || printableRatio(cleaned) < 0.8) {
    throw new LegacyParseError('Document text could not be decoded');
  }
  return cleaned;
}

// ── PowerPoint 97-2003 ────────────────────────────────────────────────────────

const REC_SLIDE          = 0x03ee; // SlideContainer
const REC_TEXT_CHARS      = 0x0fa0; // TextCharsAtom  — UTF-16LE
const REC_TEXT_BYTES      = 0x0fa8; // TextBytesAtom  — single byte per char
const CONTAINER_MASK      = 0x000f;

/** Walk a PowerPoint record stream, invoking `visit` for each record in order. */
function walkRecords(
  dv: DataView,
  start: number,
  end: number,
  visit: (type: number, isContainer: boolean, bodyStart: number, bodyEnd: number) => void,
): void {
  let offset = start;
  while (offset + 8 <= end) {
    const verInstance = dv.getUint16(offset, true);
    const type = dv.getUint16(offset + 2, true);
    const length = dv.getUint32(offset + 4, true);
    const bodyStart = offset + 8;
    const bodyEnd = bodyStart + length;
    if (length === 0 && type === 0) break;          // padding / end of stream
    if (bodyEnd > end || bodyEnd <= bodyStart) {
      visit(type, (verInstance & CONTAINER_MASK) === 0x0f, bodyStart, Math.min(bodyEnd, end));
      break;
    }
    visit(type, (verInstance & CONTAINER_MASK) === 0x0f, bodyStart, bodyEnd);
    offset = bodyEnd;
  }
}

/** Collect every text atom inside a record range, recursing through containers. */
function collectText(bytes: Uint8Array, dv: DataView, start: number, end: number, out: string[]): void {
  walkRecords(dv, start, end, (type, isContainer, bodyStart, bodyEnd) => {
    if (type === REC_TEXT_CHARS) {
      out.push(new TextDecoder('utf-16le', { fatal: false }).decode(bytes.subarray(bodyStart, bodyEnd)));
    } else if (type === REC_TEXT_BYTES) {
      out.push(new TextDecoder('windows-1252', { fatal: false }).decode(bytes.subarray(bodyStart, bodyEnd)));
    } else if (isContainer) {
      collectText(bytes, dv, bodyStart, bodyEnd, out);
    }
  });
}

/** Split a PowerPoint text run into display lines (CR and 0x0B both break lines). */
function toLines(chunks: string[]): string[] {
  return chunks
    .join('\n')
    .split(/[\r\n\x0b]+/)
    .map((line) => line.replace(/[\x00-\x08\x0c\x0e-\x1f\x7f]/g, '').trim())
    .filter(Boolean);
}

/**
 * Extract per-slide text from a PowerPoint 97-2003 presentation. Slides are
 * `SlideContainer` records in the `PowerPoint Document` stream, in file order.
 */
export function extractPptSlides(cfb: any, CFB: any): LegacySlide[] {
  const entry = CFB.find(cfb, 'PowerPoint Document');
  if (!entry) throw new LegacyParseError('Not a PowerPoint 97-2003 presentation');

  const bytes = toBytes(entry.content);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const slides: LegacySlide[] = [];
  const loose: string[] = [];

  walkRecords(dv, 0, bytes.length, (type, isContainer, bodyStart, bodyEnd) => {
    if (type === REC_SLIDE) {
      const chunks: string[] = [];
      collectText(bytes, dv, bodyStart, bodyEnd, chunks);
      const lines = toLines(chunks);
      slides.push({ title: lines[0] ?? `Slide ${slides.length + 1}`, lines: lines.slice(1) });
    } else if (isContainer) {
      collectText(bytes, dv, bodyStart, bodyEnd, loose);
    }
  });

  if (slides.length) return slides;

  // Presentations written by some tools keep slide text outside SlideContainers;
  // fall back to one block of everything that was found.
  const lines = toLines(loose);
  if (!lines.length) throw new LegacyParseError('Presentation contains no readable text');
  return [{ title: 'Extracted text', lines }];
}
