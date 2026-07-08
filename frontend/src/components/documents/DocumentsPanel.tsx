/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Document } from '@/types';
import { documentsApi, DocumentTarget } from '@/api/crm.api';
import {
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  FileUploadButton,
  RowActionButton,
} from '@/components/ui';
import { LoadingState } from '@/components/common/LoadingState';
import { FileText, Eye, Download, Trash2 } from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** File types browsers can render natively — these get a "View in browser" action.
 * SVG is excluded: blob URLs are same-origin and user-uploaded SVG can embed
 * scripts, so opening it in a tab would be a stored-XSS vector. */
function isViewableInBrowser(mimeType: string): boolean {
  if (mimeType === 'image/svg+xml') return false;
  return (
    mimeType === 'application/pdf' ||
    mimeType.startsWith('image/') ||
    mimeType.startsWith('text/') ||
    mimeType === 'application/json'
  );
}

function getFileTypeInfo(mimeType: string): { label: string; colorClass: string; badgeClass: string } {
  if (mimeType === 'application/pdf')
    return { label: 'PDF', colorClass: 'bg-red-50 text-red-600', badgeClass: 'bg-red-100 text-red-700' };
  if (mimeType.includes('word') || mimeType.includes('document'))
    return { label: 'Word', colorClass: 'bg-blue-50 text-blue-600', badgeClass: 'bg-blue-100 text-blue-700' };
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet'))
    return { label: 'Excel', colorClass: 'bg-green-50 text-green-600', badgeClass: 'bg-green-100 text-green-700' };
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation'))
    return { label: 'PPT', colorClass: 'bg-orange-50 text-orange-600', badgeClass: 'bg-orange-100 text-orange-700' };
  if (mimeType.startsWith('image/'))
    return { label: 'Image', colorClass: 'bg-purple-50 text-purple-600', badgeClass: 'bg-purple-100 text-purple-700' };
  if (mimeType === 'text/csv')
    return { label: 'CSV', colorClass: 'bg-emerald-50 text-emerald-600', badgeClass: 'bg-emerald-100 text-emerald-700' };
  if (mimeType === 'text/plain')
    return { label: 'TXT', colorClass: 'bg-slate-100 text-slate-600', badgeClass: 'bg-slate-200 text-slate-600' };
  if (mimeType.includes('zip'))
    return { label: 'ZIP', colorClass: 'bg-amber-50 text-amber-600', badgeClass: 'bg-amber-100 text-amber-700' };
  if (mimeType === 'application/json')
    return { label: 'JSON', colorClass: 'bg-teal-50 text-teal-600', badgeClass: 'bg-teal-100 text-teal-700' };
  return { label: 'File', colorClass: 'bg-slate-100 text-slate-500', badgeClass: 'bg-slate-200 text-slate-500' };
}

const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip';
const MAX_FILE_MB = 50;

export interface DocumentsPanelProps {
  /** The business entity the documents belong to (account or opportunity). */
  target: DocumentTarget;
  /** Used in copy: "…files for this account/opportunity". */
  entityLabel: 'account' | 'opportunity';
  /** Display name of the uploading user. */
  currentUser: string;
  /** Fires whenever the document count changes (for tab labels). */
  onCountChange?: (count: number) => void;
}

/**
 * Self-contained documents repository panel — list, upload, view, download and
 * delete — shared by the Account and Opportunity details views.
 */
export const DocumentsPanel: React.FC<DocumentsPanelProps> = ({
  target,
  entityLabel,
  currentUser,
  onCountChange,
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

  const targetKey = target.opportunityId ?? target.accountId ?? '';

  useEffect(() => {
    if (!targetKey) return;
    setDocsLoading(true);
    setDocsError('');
    documentsApi.getByTarget(target)
      .then(setDocuments)
      .catch(() => {})
      .finally(() => setDocsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  useEffect(() => {
    onCountChange?.(documents.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents.length]);

  const handleFileSelected = async (file: File) => {
    if (!targetKey) return;

    setDocsError('');

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setDocsError(`File too large. Maximum allowed size is ${MAX_FILE_MB} MB.`);
      return;
    }

    const isDuplicate = documents.some(d => d.originalName === file.name);
    if (isDuplicate) {
      setDocsError(`A file named "${file.name}" already exists for this ${entityLabel}.`);
      return;
    }

    setUploading(true);
    try {
      const created = await documentsApi.upload(target, file, currentUser);
      setDocuments(prev => [created, ...prev]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Upload failed. Please try again.';
      setDocsError(Array.isArray(msg) ? msg.join('. ') : String(msg));
    } finally {
      setUploading(false);
    }
  };

  // View and Download both stream the file through the authenticated API
  // client (auth cookies + silent token refresh + VITE_API_URL base) and then
  // hand the browser a local blob URL — one mechanism for both actions.
  const handleViewDocument = async (docItem: Document) => {
    if (busyDocId) return;
    // Open the tab synchronously so popup blockers allow it, then navigate it
    // to the blob once the file has streamed down.
    const viewerTab = window.open('', '_blank');
    setBusyDocId(docItem.id);
    setDocsError('');
    try {
      const blob = await documentsApi.getFileBlob(docItem.id);
      const url = URL.createObjectURL(blob);
      if (viewerTab) {
        viewerTab.location.href = url;
      } else {
        window.open(url, '_blank');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      viewerTab?.close();
      setDocsError(`Could not open "${docItem.originalName}". Please try again.`);
    } finally {
      setBusyDocId(null);
    }
  };

  const handleDownloadDocument = async (docItem: Document) => {
    if (busyDocId) return;
    setBusyDocId(docItem.id);
    setDocsError('');
    try {
      const blob = await documentsApi.getFileBlob(docItem.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = docItem.originalName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setDocsError(`Could not download "${docItem.originalName}". Please try again.`);
    } finally {
      setBusyDocId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <h4 className="font-extrabold text-slate-800 text-sm tracking-tight">Documents Repository</h4>
          <p className="text-[10px] text-slate-400 mt-0.5">
            PDF, Word, Excel, PowerPoint, images, CSV, TXT, ZIP — up to {MAX_FILE_MB} MB each.
          </p>
        </div>
        <FileUploadButton
          accept={ALLOWED_EXTENSIONS}
          onFileSelected={handleFileSelected}
          uploading={uploading}
        />
      </div>

      {/* Upload / view / download error */}
      {docsError && <ErrorBanner message={docsError} onDismiss={() => setDocsError('')} />}

      {/* Loading */}
      {docsLoading && <LoadingState label="Loading documents…" />}

      {/* Empty state */}
      {!docsLoading && documents.length === 0 && (
        <EmptyState
          icon={<FileText className="w-6 h-6 text-slate-400" aria-hidden="true" />}
          title="No documents yet"
          hint={`Upload contracts, SOWs, proposals, and other files for this ${entityLabel}.`}
        />
      )}

      {/* Document list */}
      {!docsLoading && documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => {
            const typeInfo = getFileTypeInfo(doc.mimeType);
            const uploadDate = new Date(doc.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 border border-slate-100 hover:border-slate-200 rounded-lg bg-slate-50/40 hover:bg-white transition-all text-xs group"
              >
                {/* File type badge */}
                <div className={`p-2 rounded-lg shrink-0 ${typeInfo.colorClass}`}>
                  <FileText className="w-4 h-4" />
                </div>

                {/* Metadata */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate" title={doc.originalName}>{doc.originalName}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${typeInfo.badgeClass}`}>{typeInfo.label}</span>
                    <span className="text-[10px] text-slate-400">{formatBytes(doc.sizeBytes)}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[10px] text-slate-400">{uploadDate}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[10px] text-slate-400">by {doc.uploadedBy}</span>
                  </div>
                </div>

                {/* Actions — always visible so View/Download are discoverable */}
                <div className="flex items-center space-x-1 shrink-0">
                  {isViewableInBrowser(doc.mimeType) && (
                    <RowActionButton
                      intent="view"
                      label={`View "${doc.originalName}" in browser`}
                      icon={<Eye className="w-3.5 h-3.5" />}
                      onClick={() => handleViewDocument(doc)}
                      disabled={busyDocId === doc.id}
                    />
                  )}
                  <RowActionButton
                    intent="download"
                    label={`Download "${doc.originalName}"`}
                    icon={<Download className="w-3.5 h-3.5" />}
                    onClick={() => handleDownloadDocument(doc)}
                    disabled={busyDocId === doc.id}
                  />
                  <RowActionButton
                    intent="delete"
                    label={`Delete "${doc.originalName}"`}
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => setDeleteTarget(doc)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Count footer */}
      {!docsLoading && documents.length > 0 && (
        <div className="text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100">
          {documents.length} document{documents.length !== 1 ? 's' : ''} · {formatBytes(documents.reduce((s, d) => s + d.sizeBytes, 0))} total
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Document"
        message={deleteTarget ? (
          <>Delete the document <span className="font-bold">"{deleteTarget.originalName}"</span>? This action cannot be undone.</>
        ) : undefined}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await documentsApi.delete(deleteTarget.id);
            setDocuments(prev => prev.filter(d => d.id !== deleteTarget.id));
          } finally {
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
