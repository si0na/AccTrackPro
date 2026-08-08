/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Turns a downloaded document Blob into something the preview modal can render.
 *
 * Every format is decoded **in the browser** from the authenticated download
 * stream. Nothing is sent to a third-party viewer, so preview works the same on
 * a public deployment, an internal server, an IP-only host or a laptop.
 *
 * All parser libraries are dynamically imported so none of them land in the
 * main bundle — they are fetched the first time a user previews that format.
 */

import { extensionOf, type FileKind } from '../fileType';
import { extractDocText, extractPptSlides, LegacyParseError, type LegacySlide } from './legacyOffice';

/** Raised when a file cannot be previewed at all; the UI offers Download instead. */
export class PreviewUnsupportedError extends Error {}

export interface SheetPreview {
  name: string;
  rows: string[][];
  /** Row/column totals before the preview caps below were applied. */
  totalRows: number;
  totalCols: number;
}

export type PreviewContent =
  | { type: 'sheets'; sheets: SheetPreview[] }
  /** Sanitized HTML — Word documents converted by mammoth. */
  | { type: 'html'; html: string }
  | { type: 'slides'; slides: LegacySlide[] }
  /** Blob URL rendered by the browser itself (PDF viewer / <img>). */
  | { type: 'objectUrl'; url: string; render: 'pdf' | 'image' }
  /** Sanitized inline SVG markup. */
  | { type: 'svg'; markup: string }
  | { type: 'text'; text: string }
  | { type: 'archive'; entries: { name: string; size: number; isDir: boolean }[] };

export interface PreviewResult {
  content: PreviewContent;
  /** Caveat shown above the preview, e.g. formatting dropped from a legacy file. */
  note?: string;
}

/** Guards against a runaway render on a very large file. */
const MAX_ROWS = 1000;
const MAX_COLS = 60;
const MAX_TEXT_CHARS = 500_000;
const MAX_ARCHIVE_ENTRIES = 500;

// ── Per-format loaders ────────────────────────────────────────────────────────

async function loadSheets(blob: Blob): Promise<PreviewContent> {
  const XLSX = await import('xlsx');
  const buf = await blob.arrayBuffer();
  // cellDates + raw:false so dates, currency and percentages render the way
  // they are formatted in the workbook rather than as serial numbers.
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });

  const sheets: SheetPreview[] = wb.SheetNames.map((name) => {
    const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false,
    });
    const totalCols = aoa.reduce((max, row) => Math.max(max, row.length), 0);
    const width = Math.min(totalCols, MAX_COLS);
    return {
      name,
      rows: aoa
        .slice(0, MAX_ROWS)
        .map((row) => Array.from({ length: width }, (_, i) => (row[i] == null ? '' : String(row[i])))),
      totalRows: aoa.length,
      totalCols,
    };
  });

  return { type: 'sheets', sheets };
}

async function sanitizeHtml(html: string, svg = false): Promise<string> {
  const DOMPurify = (await import('dompurify')).default;
  return DOMPurify.sanitize(html, svg ? { USE_PROFILES: { svg: true, svgFilters: true } } : undefined);
}

async function loadWord(blob: Blob, fileName: string): Promise<PreviewResult> {
  // Legacy binary .doc — not a ZIP, so mammoth cannot open it.
  if (extensionOf(fileName) === '.doc') {
    const XLSX: any = await import('xlsx');
    const buf = await blob.arrayBuffer();
    try {
      const cfb = XLSX.CFB.read(new Uint8Array(buf), { type: 'array' });
      return {
        content: { type: 'text', text: extractDocText(cfb, XLSX.CFB) },
        note: 'Legacy .doc file — text extracted without formatting, images or tables. Download for the original.',
      };
    } catch (err) {
      throw err instanceof LegacyParseError
        ? new PreviewUnsupportedError(
            'This Word 97-2003 file could not be decoded. Download it, or re-save it as .docx for a full preview.',
          )
        : err;
    }
  }

  const mammoth = await import('mammoth');
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
  if (!value.trim()) throw new PreviewUnsupportedError('This document appears to be empty.');
  return { content: { type: 'html', html: await sanitizeHtml(value) } };
}

/** DrawingML namespace — where a slide's paragraph and text-run elements live. */
const DRAWINGML_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';

/** Read the text of every slide in a .pptx, in slide order. */
async function loadPptx(blob: Blob): Promise<LegacySlide[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(blob);

  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const n = (p: string) => parseInt(p.match(/slide(\d+)\.xml$/)![1], 10);
      return n(a) - n(b);
    });

  const slides: LegacySlide[] = [];
  for (const [index, path] of slideFiles.entries()) {
    const xml = await zip.file(path)!.async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    // One line per DrawingML paragraph; its text is split across <a:t> runs.
    // Matched by namespace rather than by the `a:` prefix, which a producer
    // other than Office is free to name differently.
    const lines = Array.from(doc.getElementsByTagNameNS(DRAWINGML_NS, 'p'))
      .map((p) =>
        Array.from(p.getElementsByTagNameNS(DRAWINGML_NS, 't'))
          .map((t) => t.textContent ?? '')
          .join('')
          .trim(),
      )
      .filter(Boolean);
    slides.push({ title: lines[0] ?? `Slide ${index + 1}`, lines: lines.slice(1) });
  }

  if (!slides.length) throw new PreviewUnsupportedError('This presentation contains no slides.');
  return slides;
}

async function loadPowerPoint(blob: Blob, fileName: string): Promise<PreviewResult> {
  if (extensionOf(fileName) === '.ppt') {
    const XLSX: any = await import('xlsx');
    try {
      const cfb = XLSX.CFB.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array' });
      return {
        content: { type: 'slides', slides: extractPptSlides(cfb, XLSX.CFB) },
        note: 'Legacy .ppt file — slide text extracted without layout, images or theming. Download for the original.',
      };
    } catch (err) {
      throw err instanceof LegacyParseError
        ? new PreviewUnsupportedError(
            'This PowerPoint 97-2003 file could not be decoded. Download it, or re-save it as .pptx for a full preview.',
          )
        : err;
    }
  }

  return {
    content: { type: 'slides', slides: await loadPptx(blob) },
    note: 'Slide text preview — layout, images and animations are not rendered. Download for the original.',
  };
}

async function loadArchive(blob: Blob): Promise<PreviewResult> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(blob);
  const all = Object.values(zip.files) as any[];
  const entries = all
    .slice(0, MAX_ARCHIVE_ENTRIES)
    .map((f) => ({
      name: f.name,
      size: Number(f._data?.uncompressedSize ?? 0),
      isDir: !!f.dir,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    content: { type: 'archive', entries },
    note:
      all.length > MAX_ARCHIVE_ENTRIES
        ? `Listing the first ${MAX_ARCHIVE_ENTRIES} of ${all.length} entries. Archive contents are listed, not opened.`
        : 'Archive contents are listed, not opened. Download to extract the files.',
  };
}

async function loadText(blob: Blob, fileName: string): Promise<PreviewContent> {
  let text = await blob.text();
  if (extensionOf(fileName) === '.json') {
    try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* show as-is */ }
  }
  if (text.length > MAX_TEXT_CHARS) {
    text = `${text.slice(0, MAX_TEXT_CHARS)}\n\n… truncated — download the file to see the rest.`;
  }
  return { type: 'text', text };
}

// ── Entry point ───────────────────────────────────────────────────────────────

/**
 * Decode `blob` into renderable preview content. Throws
 * `PreviewUnsupportedError` when the format cannot be shown at all — callers
 * surface the message and fall back to Download.
 */
export async function loadPreview(
  kind: FileKind,
  fileName: string,
  blob: Blob,
): Promise<PreviewResult> {
  switch (kind) {
    case 'excel':
    case 'csv':
      return { content: await loadSheets(blob) };

    case 'word':
      return loadWord(blob, fileName);

    case 'powerpoint':
      return loadPowerPoint(blob, fileName);

    case 'pdf':
      return { content: { type: 'objectUrl', url: URL.createObjectURL(blob), render: 'pdf' } };

    case 'image': {
      // A user-uploaded SVG is markup and can carry scripts, so it is sanitized
      // and inlined rather than handed to the browser as a same-origin document.
      if (extensionOf(fileName) === '.svg' || blob.type === 'image/svg+xml') {
        return { content: { type: 'svg', markup: await sanitizeHtml(await blob.text(), true) } };
      }
      return { content: { type: 'objectUrl', url: URL.createObjectURL(blob), render: 'image' } };
    }

    case 'text':
    case 'json':
      return { content: await loadText(blob, fileName) };

    case 'zip':
      return loadArchive(blob);

    default:
      throw new PreviewUnsupportedError('This file type cannot be previewed. Download it to open it locally.');
  }
}
