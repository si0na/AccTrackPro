import React, { useState, useEffect } from 'react';
import {
  FileText,
  Link2,
  UploadCloud,
  File as FileIcon,
  X,
  AlertCircle,
} from 'lucide-react';
import type { ProjectDocumentation } from '@/types';
import {
  FormModal,
  FormSection,
  FormField,
  INPUT_CLS,
} from '@/components/ui';

const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip';
const MAX_FILE_MB = 50;

function formatBytes(bytes?: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ProjectDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitUrl: (data: { name: string; url: string; description?: string }) => Promise<void>;
  onSubmitFile: (data: { name: string; description?: string }, file: File) => Promise<void>;
  onUpdate: (
    id: string,
    data: { name?: string; url?: string; description?: string },
    replacementFile?: File | null,
  ) => Promise<void>;
  editingDoc?: ProjectDocumentation | null;
}

export const ProjectDocumentationModal: React.FC<ProjectDocumentationModalProps> = ({
  isOpen,
  onClose,
  onSubmitUrl,
  onSubmitFile,
  onUpdate,
  editingDoc,
}) => {
  const isEdit = !!editingDoc;
  const [docType, setDocType] = useState<'URL' | 'FILE'>(editingDoc?.type ?? 'URL');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingDoc) {
      setDocType(editingDoc.type);
      setName(editingDoc.name);
      setUrl(editingDoc.url ?? '');
      setDescription(editingDoc.description ?? '');
      setFile(null);
      setReplacementFile(null);
      setError('');
    } else {
      setDocType('URL');
      setName('');
      setUrl('');
      setDescription('');
      setFile(null);
      setReplacementFile(null);
      setError('');
    }
  }, [editingDoc, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isReplacement = false) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File too large. Maximum allowed size is ${MAX_FILE_MB} MB.`);
      return;
    }

    setError('');
    if (isReplacement) {
      setReplacementFile(selected);
    } else {
      setFile(selected);
      // Pre-fill name if empty
      if (!name.trim()) {
        const baseName = selected.name.replace(/\.[^/.]+$/, '');
        setName(baseName);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Document name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && editingDoc) {
        if (editingDoc.type === 'URL') {
          const trimmedUrl = url.trim();
          if (!trimmedUrl) {
            setError('Document URL is required');
            setSubmitting(false);
            return;
          }
          if (!/^https?:\/\/.+/i.test(trimmedUrl)) {
            setError('Document URL must start with http:// or https://');
            setSubmitting(false);
            return;
          }
          await onUpdate(editingDoc.id, {
            name: trimmedName,
            url: trimmedUrl,
            description: description.trim(),
          });
        } else {
          // FILE edit
          await onUpdate(
            editingDoc.id,
            {
              name: trimmedName,
              description: description.trim(),
            },
            replacementFile,
          );
        }
      } else {
        // Create mode
        if (docType === 'URL') {
          const trimmedUrl = url.trim();
          if (!trimmedUrl) {
            setError('Document URL is required');
            setSubmitting(false);
            return;
          }
          if (!/^https?:\/\/.+/i.test(trimmedUrl)) {
            setError('Document URL must start with http:// or https://');
            setSubmitting(false);
            return;
          }
          await onSubmitUrl({
            name: trimmedName,
            url: trimmedUrl,
            description: description.trim(),
          });
        } else {
          // Upload File create
          if (!file) {
            setError('Please select a file to upload');
            setSubmitting(false);
            return;
          }
          await onSubmitFile(
            {
              name: trimmedName,
              description: description.trim(),
            },
            file,
          );
        }
      }
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save documentation entry';
      setError(Array.isArray(msg) ? msg.join('. ') : String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      title={isEdit ? 'Edit Documentation' : 'Add Documentation'}
      icon={<FileText className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Documentation'}
      isSubmitting={submitting}
      submitVariant="primary"
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Option Selection (only in create mode) */}
        {!isEdit && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Documentation Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setDocType('URL');
                  setError('');
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-medium transition-all ${
                  docType === 'URL'
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 ring-1 ring-indigo-500'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Link2 className="w-4 h-4" />
                <span>Option A – Add URL</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDocType('FILE');
                  setError('');
                }}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-medium transition-all ${
                  docType === 'FILE'
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 ring-1 ring-indigo-500'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>Option B – Upload File</span>
              </button>
            </div>
          </div>
        )}

        {isEdit && (
          <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">Type:</span>
            <span className="font-semibold text-slate-800">
              {editingDoc?.type === 'URL' ? 'URL Link' : 'Uploaded File'}
            </span>
          </div>
        )}

        <FormSection title="Document Details">
          <FormField label="Document Name" required wide>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Architecture Specification or Project Drive"
              className={INPUT_CLS}
            />
          </FormField>

          {/* URL Input (Option A) */}
          {docType === 'URL' && (
            <FormField label="Document URL" required wide>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/document"
                className={INPUT_CLS}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Enter a valid reference link starting with http:// or https://
              </p>
            </FormField>
          )}

          {/* File Upload Input (Option B) */}
          {docType === 'FILE' && (
            <div className="space-y-3">
              {isEdit && editingDoc?.fileName && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-xs text-slate-500 font-medium mb-1">Current File:</div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <FileIcon className="w-4 h-4 text-slate-500" />
                    <span className="truncate">{editingDoc.fileName}</span>
                    <span className="text-slate-400 font-normal">
                      ({formatBytes(editingDoc.fileSize)})
                    </span>
                  </div>
                </div>
              )}

              <FormField
                label={isEdit ? 'Replace File (Optional)' : 'Upload File'}
                required={!isEdit}
                wide
              >
                <div className="mt-1 flex justify-center px-4 pt-4 pb-4 border-2 border-slate-300 border-dashed rounded-lg hover:border-indigo-400 transition-colors">
                  <div className="space-y-1 text-center">
                    <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
                    <div className="flex text-xs text-slate-600 justify-center">
                      <label className="relative cursor-pointer rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                        <span>{isEdit ? 'Choose replacement file' : 'Select a file'}</span>
                        <input
                          type="file"
                          accept={ALLOWED_EXTENSIONS}
                          onChange={(e) => handleFileChange(e, isEdit)}
                          className="sr-only"
                        />
                      </label>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      PDF, Word, Excel, PowerPoint, images, CSV, TXT, ZIP up to {MAX_FILE_MB}MB
                    </p>
                  </div>
                </div>

                {/* Show selected file */}
                {((isEdit && replacementFile) || (!isEdit && file)) && (
                  <div className="mt-2 flex items-center justify-between p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="font-medium text-indigo-900 truncate">
                        {isEdit ? replacementFile?.name : file?.name}
                      </span>
                      <span className="text-indigo-600 text-[11px] shrink-0">
                        ({formatBytes(isEdit ? replacementFile?.size : file?.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => (isEdit ? setReplacementFile(null) : setFile(null))}
                      className="text-indigo-400 hover:text-indigo-600 p-0.5 rounded"
                      title="Remove selected file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </FormField>
            </div>
          )}

          <FormField label="Description (Optional)" wide>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add optional notes or description about this document..."
              className={`${INPUT_CLS} resize-none`}
            />
          </FormField>
        </FormSection>
      </div>
    </FormModal>
  );
};
