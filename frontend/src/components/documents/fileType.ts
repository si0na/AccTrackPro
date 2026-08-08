/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Document type detection — one place that decides the label, icon and preview
 * behaviour for an uploaded file.
 *
 * Detection is driven by the file extension first and the MIME type second.
 * Substring matching on the MIME type is deliberately avoided: every OOXML
 * type contains the literal "officedocument", so a `.xlsx`
 * (`…officedocument.spreadsheetml.sheet`) and a `.pptx`
 * (`…officedocument.presentationml.presentation`) both match a naive
 * `includes('document')` test and get labelled as Word.
 */

import {
  File as FileIcon,
  FileArchive,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType2,
  LetterText,
  Presentation,
  Sheet,
  type LucideIcon,
} from 'lucide-react';

export type FileKind =
  | 'pdf' | 'word' | 'excel' | 'powerpoint'
  | 'csv' | 'text' | 'json' | 'image' | 'zip' | 'unknown';

export interface FileTypeInfo {
  kind: FileKind;
  /** Human-readable type name, e.g. "Microsoft Excel". */
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile. */
  colorClass: string;
  /** Tailwind classes for the type badge. */
  badgeClass: string;
  /**
   * The preview modal can render this file. True for every accepted kind —
   * each format is decoded in the browser (see `preview/previewLoader`), so
   * nothing depends on an external viewer.
   */
  isPreviewable: boolean;
}

/** Extensions accepted by the upload control — kept in sync with ALLOWED_EXTENSIONS. */
const KIND_BY_EXTENSION: Record<string, FileKind> = {
  '.pdf': 'pdf',
  '.doc': 'word', '.docx': 'word',
  '.xls': 'excel', '.xlsx': 'excel',
  '.ppt': 'powerpoint', '.pptx': 'powerpoint',
  '.csv': 'csv',
  '.txt': 'text',
  '.json': 'json',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image',
  '.gif': 'image', '.webp': 'image', '.svg': 'image',
  '.zip': 'zip',
};

/** Exact MIME types — the fallback when a file arrives without a known extension. */
const KIND_BY_MIME: Record<string, FileKind> = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-powerpoint': 'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
  'text/csv': 'csv',
  'text/plain': 'text',
  'application/json': 'json',
  'text/json': 'json',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
};

type KindStyle = Omit<FileTypeInfo, 'kind' | 'isPreviewable'>;

const STYLE_BY_KIND: Record<FileKind, KindStyle> = {
  pdf: {
    label: 'PDF', icon: FileType2,
    colorClass: 'bg-red-50 text-red-600', badgeClass: 'bg-red-100 text-red-700',
  },
  word: {
    label: 'Microsoft Word', icon: FileText,
    colorClass: 'bg-blue-50 text-blue-600', badgeClass: 'bg-blue-100 text-blue-700',
  },
  excel: {
    label: 'Microsoft Excel', icon: FileSpreadsheet,
    colorClass: 'bg-green-50 text-green-600', badgeClass: 'bg-green-100 text-green-700',
  },
  powerpoint: {
    label: 'Microsoft PowerPoint', icon: Presentation,
    colorClass: 'bg-orange-50 text-orange-600', badgeClass: 'bg-orange-100 text-orange-700',
  },
  csv: {
    label: 'CSV', icon: Sheet,
    colorClass: 'bg-emerald-50 text-emerald-600', badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  text: {
    label: 'Text', icon: LetterText,
    colorClass: 'bg-slate-100 text-slate-600', badgeClass: 'bg-slate-200 text-slate-600',
  },
  json: {
    label: 'JSON', icon: FileJson,
    colorClass: 'bg-teal-50 text-teal-600', badgeClass: 'bg-teal-100 text-teal-700',
  },
  image: {
    label: 'Image', icon: FileImage,
    colorClass: 'bg-purple-50 text-purple-600', badgeClass: 'bg-purple-100 text-purple-700',
  },
  zip: {
    label: 'ZIP Archive', icon: FileArchive,
    colorClass: 'bg-amber-50 text-amber-600', badgeClass: 'bg-amber-100 text-amber-700',
  },
  unknown: {
    label: 'File', icon: FileIcon,
    colorClass: 'bg-slate-100 text-slate-500', badgeClass: 'bg-slate-200 text-slate-500',
  },
};

/** Lower-cased extension including the leading dot, or '' when there is none. */
export function extensionOf(fileName: string): string {
  const dot = (fileName ?? '').lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot).toLowerCase() : '';
}

function resolveKind(fileName: string, mimeType: string): FileKind {
  const byExtension = KIND_BY_EXTENSION[extensionOf(fileName)];
  if (byExtension) return byExtension;

  const mime = (mimeType ?? '').toLowerCase().trim();
  const byMime = KIND_BY_MIME[mime];
  if (byMime) return byMime;

  // Family fallback for types outside the accepted list (e.g. image/bmp).
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('text/')) return 'text';
  return 'unknown';
}

/**
 * Everything the UI needs to render a document row, derived from its original
 * file name and MIME type.
 */
export function getFileTypeInfo(fileName: string, mimeType: string): FileTypeInfo {
  const kind = resolveKind(fileName, mimeType);
  const style = STYLE_BY_KIND[kind];

  // Only a file whose kind we could not identify has no renderer. SVG is
  // previewable because the modal inlines it through DOMPurify's SVG profile
  // instead of opening the raw upload as a same-origin document, which would
  // have made an embedded <script> a stored-XSS vector.
  return { kind, ...style, isPreviewable: kind !== 'unknown' };
}
