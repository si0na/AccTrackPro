/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Download, Info } from 'lucide-react';
import { Document } from '@/types';
import { documentsApi } from '@/api/crm.api';
import { Button, Modal, ErrorBanner } from '@/components/ui';
import { LoadingState } from '@/components/common/LoadingState';
import { getFileTypeInfo } from '../fileType';
import {
  loadPreview,
  PreviewUnsupportedError,
  type PreviewContent,
  type PreviewResult,
  type SheetPreview,
} from './previewLoader';

export interface DocumentPreviewModalProps {
  doc: Document;
  onClose: () => void;
  /** Reuses the panel's download handler for the footer button. */
  onDownload: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Content renderers ─────────────────────────────────────────────────────────

const SheetsView: React.FC<{ sheets: SheetPreview[] }> = ({ sheets }) => {
  const [active, setActive] = useState(0);
  const sheet = sheets[active];
  if (!sheet) return null;

  const truncated = sheet.totalRows > sheet.rows.length || sheet.totalCols > (sheet.rows[0]?.length ?? 0);

  return (
    <div className="space-y-3">
      {sheets.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setActive(i)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                i === active ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {sheet.rows.length === 0 ? (
        <p className="text-xs text-slate-500 py-8 text-center">This sheet is empty.</p>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-auto custom-scrollbar max-h-[60vh]">
          <table className="text-xs border-collapse w-full">
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r} className={r === 0 ? '' : 'hover:bg-slate-50'}>
                  {/* Row-number gutter, like a spreadsheet */}
                  <td className="sticky left-0 z-10 bg-slate-100 text-slate-400 text-[10px] font-bold text-right px-2 py-1.5 border-b border-r border-slate-200 select-none">
                    {r + 1}
                  </td>
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      title={cell}
                      className={`px-3 py-1.5 border-b border-slate-100 whitespace-nowrap max-w-[320px] truncate ${
                        r === 0 ? 'bg-slate-50 font-bold text-slate-700 sticky top-0 z-[5]' : 'text-slate-600'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-slate-400 font-medium">
        {sheet.totalRows.toLocaleString()} row{sheet.totalRows !== 1 ? 's' : ''} · {sheet.totalCols} column
        {sheet.totalCols !== 1 ? 's' : ''}
        {truncated && <span className="text-amber-600"> · preview truncated — download for the full sheet</span>}
      </p>
    </div>
  );
};

const ContentView: React.FC<{ content: PreviewContent }> = ({ content }) => {
  switch (content.type) {
    case 'sheets':
      return <SheetsView sheets={content.sheets} />;

    case 'html':
      return (
        <div className="border border-slate-200 rounded-lg bg-white overflow-auto custom-scrollbar max-h-[65vh] p-6">
          {/* Sanitized by DOMPurify in previewLoader before it reaches here. */}
          <div className="docx-body" dangerouslySetInnerHTML={{ __html: content.html }} />
        </div>
      );

    case 'slides':
      return (
        <div className="space-y-3 overflow-auto custom-scrollbar max-h-[65vh] pr-1">
          {content.slides.map((slide, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-4 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">
                  {i + 1}
                </span>
                <h5 className="font-bold text-slate-800 text-sm">{slide.title}</h5>
              </div>
              {slide.lines.length > 0 && (
                <ul className="space-y-1 pl-3">
                  {slide.lines.map((line, j) => (
                    <li key={j} className="text-xs text-slate-600 list-disc list-outside ml-2">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      );

    case 'objectUrl':
      return content.render === 'pdf' ? (
        <iframe
          src={content.url}
          title="Document preview"
          className="w-full h-[70vh] border border-slate-200 rounded-lg bg-slate-50"
        />
      ) : (
        <div className="flex justify-center bg-slate-50 border border-slate-200 rounded-lg p-4 overflow-auto custom-scrollbar max-h-[70vh]">
          <img src={content.url} alt="Document preview" className="max-w-full object-contain" />
        </div>
      );

    case 'svg':
      return (
        <div className="flex justify-center bg-slate-50 border border-slate-200 rounded-lg p-4 overflow-auto custom-scrollbar max-h-[70vh]">
          {/* Sanitized with DOMPurify's SVG profile — scripts and handlers stripped. */}
          <div className="max-w-full [&>svg]:max-w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: content.markup }} />
        </div>
      );

    case 'text':
      return (
        <pre className="text-[11px] leading-relaxed text-slate-700 font-mono whitespace-pre-wrap break-words border border-slate-200 rounded-lg bg-slate-50 p-4 overflow-auto custom-scrollbar max-h-[65vh]">
          {content.text}
        </pre>
      );

    case 'archive':
      return (
        <div className="border border-slate-200 rounded-lg overflow-auto custom-scrollbar max-h-[65vh] divide-y divide-slate-100">
          {content.entries.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
              <span className={`truncate ${entry.isDir ? 'font-bold text-slate-700' : 'text-slate-600'}`} title={entry.name}>
                {entry.name}
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">
                {entry.isDir ? 'folder' : formatBytes(entry.size)}
              </span>
            </div>
          ))}
        </div>
      );
  }
};

// ── Modal shell ───────────────────────────────────────────────────────────────

/**
 * In-app preview for every document type the repository accepts.
 *
 * The file is streamed down through the authenticated API client and decoded in
 * the browser (see `previewLoader`). Nothing is handed to an external viewer,
 * so preview does not depend on the deployment being reachable from the
 * internet — and client documents never leave the server.
 */
export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ doc, onClose, onDownload }) => {
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const objectUrlRef = useRef<string | null>(null);

  const typeInfo = getFileTypeInfo(doc.originalName, doc.mimeType);
  const TypeIcon = typeInfo.icon;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      setResult(null);
      try {
        const blob = await documentsApi.getFileBlob(doc.id);
        const loaded = await loadPreview(typeInfo.kind, doc.originalName, blob);
        if (cancelled) {
          if (loaded.content.type === 'objectUrl') URL.revokeObjectURL(loaded.content.url);
          return;
        }
        if (loaded.content.type === 'objectUrl') objectUrlRef.current = loaded.content.url;
        setResult(loaded);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof PreviewUnsupportedError
            ? err.message
            : `Could not open "${doc.originalName}". The file may be corrupted or password-protected — try downloading it instead.`,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [doc.id, doc.originalName, typeInfo.kind]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      maxWidth="max-w-6xl"
      title={doc.originalName}
      icon={<TypeIcon className={`w-5 h-5 ${typeInfo.colorClass.split(' ').pop()}`} aria-hidden="true" />}
    >
      <div className="p-4 space-y-3">
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        {loading && <LoadingState label={`Opening ${typeInfo.label}…`} />}

        {result?.note && (
          <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <Info className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
            <span>{result.note}</span>
          </div>
        )}

        {result && <ContentView content={result.content} />}

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[10px] text-slate-400 font-medium">
            {typeInfo.label} · {formatBytes(doc.sizeBytes)}
          </span>
          <Button variant="secondary" size="sm" onClick={onDownload} icon={<Download className="w-3.5 h-3.5" />}>
            Download
          </Button>
        </div>
      </div>
    </Modal>
  );
};
