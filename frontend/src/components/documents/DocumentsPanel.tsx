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
import { getFileTypeInfo } from './fileType';
import { DocumentPreviewModal } from './preview/DocumentPreviewModal';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [previewTarget, setPreviewTarget] = useState<Document | null>(null);

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

  /**
   * Every supported format is previewed in-app, decoded in the browser from the
   * authenticated download stream — no popup, no external viewer, and no
   * dependency on the deployment being reachable from the public internet.
   */
  const handleViewDocument = (docItem: Document) => {
    setDocsError('');
    setPreviewTarget(docItem);
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
            const typeInfo = getFileTypeInfo(doc.originalName, doc.mimeType);
            const TypeIcon = typeInfo.icon;
            const uploadDate = new Date(doc.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 border border-slate-100 hover:border-slate-200 rounded-lg bg-slate-50/40 hover:bg-white transition-all text-xs group"
              >
                {/* File type icon */}
                <div className={`p-2 rounded-lg shrink-0 ${typeInfo.colorClass}`} title={typeInfo.label}>
                  <TypeIcon className="w-4 h-4" aria-hidden="true" />
                </div>

                {/* Metadata */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate" title={doc.originalName}>{doc.originalName}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    <span className={`text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded whitespace-nowrap ${typeInfo.badgeClass}`}>{typeInfo.label}</span>
                    <span className="text-[10px] text-slate-400">{formatBytes(doc.sizeBytes)}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[10px] text-slate-400">{uploadDate}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-[10px] text-slate-400">by {doc.uploadedBy}</span>
                  </div>
                </div>

                {/* Actions — always visible so View/Download are discoverable */}
                <div className="flex items-center space-x-1 shrink-0">
                  {typeInfo.isPreviewable && (
                    <RowActionButton
                      intent="view"
                      label={`View "${doc.originalName}" (${typeInfo.label})`}
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

      {previewTarget && (
        <DocumentPreviewModal
          doc={previewTarget}
          onClose={() => setPreviewTarget(null)}
          onDownload={() => handleDownloadDocument(previewTarget)}
        />
      )}
    </div>
  );
};
