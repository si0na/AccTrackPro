/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import type { StakeholderConnectMomAttachment } from '@/types';
import { Button, ConfirmDialog, ErrorBanner } from '@/components/ui';
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  X,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileType2,
  Presentation,
  Sheet,
  LetterText,
  File as FileIcon,
  type LucideIcon,
} from 'lucide-react';

export const MOM_ATTACHMENT_ALLOWED_EXTS = [
  '.doc', '.docx',
  '.pdf',
  '.txt',
  '.rtf',
  '.xls', '.xlsx',
  '.csv',
  '.ppt', '.pptx',
  '.odt', '.ods', '.odp',
  '.png', '.jpg', '.jpeg',
] as const;

export const MOM_ATTACHMENT_ACCEPT = MOM_ATTACHMENT_ALLOWED_EXTS.join(',');
export const MOM_ATTACHMENT_MAX_FILE_MB = 15;
export const MOM_ATTACHMENT_MAX_TOTAL_MB = 50;
export const MOM_ATTACHMENT_MAX_FILES = 10;

const MAX_FILE_BYTES = MOM_ATTACHMENT_MAX_FILE_MB * 1024 * 1024;
const MAX_TOTAL_BYTES = MOM_ATTACHMENT_MAX_TOTAL_MB * 1024 * 1024;
const ALLOWED_EXT_SET = new Set<string>(MOM_ATTACHMENT_ALLOWED_EXTS);

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentIconInfo {
  label: string;
  icon: LucideIcon;
  colorClass: string;
  badgeClass: string;
}

function getAttachmentIconInfo(filename: string): AttachmentIconInfo {
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : '';

  switch (ext) {
    case '.pdf':
      return { label: 'PDF', icon: FileType2, colorClass: 'bg-red-50 text-red-600', badgeClass: 'bg-red-100 text-red-700' };
    case '.doc':
    case '.docx':
      return { label: 'Word', icon: FileText, colorClass: 'bg-blue-50 text-blue-600', badgeClass: 'bg-blue-100 text-blue-700' };
    case '.odt':
      return { label: 'ODT', icon: FileText, colorClass: 'bg-sky-50 text-sky-600', badgeClass: 'bg-sky-100 text-sky-700' };
    case '.rtf':
      return { label: 'RTF', icon: LetterText, colorClass: 'bg-indigo-50 text-indigo-600', badgeClass: 'bg-indigo-100 text-indigo-700' };
    case '.txt':
      return { label: 'Text', icon: LetterText, colorClass: 'bg-slate-100 text-slate-600', badgeClass: 'bg-slate-200 text-slate-700' };
    case '.xls':
    case '.xlsx':
      return { label: 'Excel', icon: FileSpreadsheet, colorClass: 'bg-emerald-50 text-emerald-600', badgeClass: 'bg-emerald-100 text-emerald-700' };
    case '.ods':
      return { label: 'ODS', icon: FileSpreadsheet, colorClass: 'bg-teal-50 text-teal-600', badgeClass: 'bg-teal-100 text-teal-700' };
    case '.csv':
      return { label: 'CSV', icon: Sheet, colorClass: 'bg-green-50 text-green-600', badgeClass: 'bg-green-100 text-green-700' };
    case '.ppt':
    case '.pptx':
      return { label: 'PowerPoint', icon: Presentation, colorClass: 'bg-orange-50 text-orange-600', badgeClass: 'bg-orange-100 text-orange-700' };
    case '.odp':
      return { label: 'ODP', icon: Presentation, colorClass: 'bg-amber-50 text-amber-600', badgeClass: 'bg-amber-100 text-amber-700' };
    case '.png':
    case '.jpg':
    case '.jpeg':
      return { label: 'Image', icon: FileImage, colorClass: 'bg-purple-50 text-purple-600', badgeClass: 'bg-purple-100 text-purple-700' };
    default:
      return { label: 'File', icon: FileIcon, colorClass: 'bg-slate-100 text-slate-500', badgeClass: 'bg-slate-200 text-slate-600' };
  }
}

export interface MomAttachmentsSectionProps {
  /** Persisted attachments already associated with this Stakeholder Connect. */
  existingAttachments?: StakeholderConnectMomAttachment[];
  /** Newly selected files queued for upload. */
  pendingFiles: File[];
  /** Called when pending files change (add/remove/clear). */
  onPendingFilesChange: (files: File[]) => void;
  /** Whether the user is allowed to upload or remove attachments (false for read-only / Cancelled). */
  canMutate: boolean;
  /** Upload in progress state. */
  isUploading?: boolean;
  /** Upload progress percentage (0..100) when uploading. */
  uploadProgress?: number | null;
  /** Optional external upload/delete error message. */
  error?: string | null;
  onDismissError?: () => void;
  /** Optional direct upload action (used in ConnectDetailsModal so attachments upload independently of MoM text). */
  onUploadPending?: () => void | Promise<unknown>;
  /** Download handler for an existing attachment. */
  onDownload?: (attachment: StakeholderConnectMomAttachment) => void | Promise<void>;
  /** Delete handler for an existing attachment. */
  onDelete?: (attachment: StakeholderConnectMomAttachment) => void | Promise<void>;
  /** Attachment currently being downloaded or deleted. */
  busyAttachmentId?: string | null;
  /** Compact styling inside FormModal vs expanded inside ConnectDetailsModal. */
  compact?: boolean;
  /** Custom helper text under heading. */
  hint?: string;
}

export const MomAttachmentsSection: React.FC<MomAttachmentsSectionProps> = ({
  existingAttachments = [],
  pendingFiles,
  onPendingFilesChange,
  canMutate,
  isUploading = false,
  uploadProgress = null,
  error = null,
  onDismissError,
  onUploadPending,
  onDownload,
  onDelete,
  busyAttachmentId = null,
  compact = false,
  hint,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StakeholderConnectMomAttachment | null>(null);

  const handleFilesPicked = (pickedList: FileList | null) => {
    if (!pickedList || pickedList.length === 0) return;
    setValidationError(null);

    const next = [...pendingFiles];
    const seenLower = new Set(next.map((f) => f.name.toLowerCase()));
    let runningTotal = next.reduce((acc, f) => acc + f.size, 0);
    const issues: string[] = [];

    for (const file of Array.from(pickedList)) {
      const dot = file.name.lastIndexOf('.');
      const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';

      if (!ext || !ALLOWED_EXT_SET.has(ext)) {
        issues.push(`"${file.name}" has an unsupported file type.`);
        continue;
      }

      if (file.size > MAX_FILE_BYTES) {
        issues.push(`"${file.name}" exceeds the ${MOM_ATTACHMENT_MAX_FILE_MB} MB per-file limit.`);
        continue;
      }

      if (seenLower.has(file.name.toLowerCase())) {
        issues.push(`"${file.name}" is already selected.`);
        continue;
      }

      if (next.length >= MOM_ATTACHMENT_MAX_FILES) {
        issues.push(`You can attach up to ${MOM_ATTACHMENT_MAX_FILES} files per upload.`);
        break;
      }

      if (runningTotal + file.size > MAX_TOTAL_BYTES) {
        issues.push(`Adding "${file.name}" exceeds the ${MOM_ATTACHMENT_MAX_TOTAL_MB} MB total upload limit.`);
        continue;
      }

      seenLower.add(file.name.toLowerCase());
      runningTotal += file.size;
      next.push(file);
    }

    if (issues.length > 0) {
      setValidationError(issues.join(' '));
    }

    if (next.length !== pendingFiles.length) {
      onPendingFilesChange(next);
    }
  };

  const handleRemovePending = (index: number) => {
    setValidationError(null);
    const updated = pendingFiles.filter((_, idx) => idx !== index);
    onPendingFilesChange(updated);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !onDelete) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    await onDelete(target);
  };

  const combinedError = error || validationError;
  const pendingTotalBytes = pendingFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50/60 ${
        compact ? 'p-3.5 space-y-3' : 'p-4 space-y-3.5'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-blue-600" />
            <h4 className="text-xs font-bold text-slate-800">
              MoM Document Attachments
              {existingAttachments.length > 0 && (
                <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {existingAttachments.length}
                </span>
              )}
            </h4>
          </div>
          <p className="text-[11px] text-slate-500">
            {hint ||
              `PDF, Word, Excel, PowerPoint, OpenDocument, RTF, TXT, CSV, PNG/JPG — up to ${MOM_ATTACHMENT_MAX_FILE_MB} MB each (${MOM_ATTACHMENT_MAX_TOTAL_MB} MB total).`}
          </p>
        </div>

        {canMutate && (
          <label
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              isUploading
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-200 shadow-xs cursor-pointer'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Select Files</span>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={MOM_ATTACHMENT_ACCEPT}
              disabled={isUploading}
              aria-label="Select MoM attachment files"
              className="hidden"
              onChange={(e) => {
                handleFilesPicked(e.target.files);
                if (inputRef.current) inputRef.current.value = '';
              }}
            />
          </label>
        )}
      </div>

      {/* Validation / upload / download error */}
      {combinedError && (
        <ErrorBanner
          message={combinedError}
          onDismiss={() => {
            setValidationError(null);
            onDismissError?.();
          }}
        />
      )}

      {/* Upload progress bar */}
      {isUploading && (
        <div className="space-y-1 bg-white border border-blue-200 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700">
            <span>Uploading attachments…</span>
            {uploadProgress !== null && <span>{uploadProgress}%</span>}
          </div>
          <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-150"
              style={{ width: `${uploadProgress ?? 40}%` }}
            />
          </div>
        </div>
      )}

      {/* Pending / Queued Files */}
      {canMutate && pendingFiles.length > 0 && (
        <div className="space-y-2 bg-white border border-blue-200/80 rounded-lg p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-blue-800">
              Selected for Upload ({pendingFiles.length} {pendingFiles.length === 1 ? 'file' : 'files'} •{' '}
              {formatFileSize(pendingTotalBytes)})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  setValidationError(null);
                  onPendingFilesChange([]);
                }}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
              >
                Clear selected
              </button>
              {onUploadPending && (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => void onUploadPending()}
                  className="gap-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>{isUploading ? 'Uploading…' : 'Upload Now'}</span>
                </Button>
              )}
            </div>
          </div>

          <ul className="space-y-1.5">
            {pendingFiles.map((file, idx) => {
              const info = getAttachmentIconInfo(file.name);
              const Icon = info.icon;
              return (
                <li
                  key={`${file.name}-${file.size}-${idx}`}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`p-1 rounded-md shrink-0 ${info.colorClass}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-medium text-slate-800 truncate" title={file.name}>
                      {file.name}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${info.badgeClass}`}>
                      {info.label}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    title={`Remove ${file.name}`}
                    disabled={isUploading}
                    onClick={() => handleRemovePending(idx)}
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Existing Persisted Attachments */}
      {existingAttachments.length > 0 ? (
        <ul className="space-y-2">
          {existingAttachments.map((att) => {
            const info = getAttachmentIconInfo(att.originalFilename);
            const Icon = info.icon;
            const isBusy = busyAttachmentId === att.id;
            const uploadedDate = att.uploadedAt
              ? new Date(att.uploadedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '';

            return (
              <li
                key={att.id}
                className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`p-1.5 rounded-lg shrink-0 ${info.colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-semibold text-slate-800 truncate max-w-[320px]"
                        title={att.originalFilename}
                      >
                        {att.originalFilename}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${info.badgeClass}`}>
                        {info.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-400 mt-0.5">
                      <span>{formatFileSize(att.fileSize)}</span>
                      {uploadedDate && <span>Uploaded {uploadedDate}</span>}
                      {att.uploadedByName && (
                        <span>
                          by <strong className="font-medium text-slate-600">{att.uploadedByName}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onDownload && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void onDownload(att)}
                      title={`Download ${att.originalFilename}`}
                      className="gap-1 text-slate-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{isBusy ? 'Working…' : 'Download'}</span>
                    </Button>
                  )}
                  {canMutate && onDelete && (
                    <button
                      type="button"
                      disabled={isBusy}
                      title={`Remove ${att.originalFilename}`}
                      onClick={() => setDeleteTarget(att)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        pendingFiles.length === 0 && (
          <p className="text-[11px] text-slate-400 italic">
            {canMutate
              ? 'No documents attached to this MoM yet. Click "Select Files" to attach supporting documents.'
              : 'No documents attached to this MoM.'}
          </p>
        )
      )}

      {/* Confirmation dialog before deleting a persisted attachment */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Remove MoM Attachment"
        message={
          deleteTarget
            ? `Are you sure you want to permanently remove "${deleteTarget.originalFilename}" from this meeting's Minutes of Meeting?`
            : undefined
        }
        confirmLabel="Remove Attachment"
      />
    </div>
  );
};

