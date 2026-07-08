import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

export interface FileUploadButtonProps {
  /** Comma-separated extension list for the native picker. */
  accept: string;
  onFileSelected: (file: File) => void;
  uploading?: boolean;
  label?: string;
  uploadingLabel?: string;
  className?: string;
}

/**
 * Standard file-upload button: styled label wrapping a hidden file input,
 * with a spinner while the upload is in flight. The input value is cleared
 * after each pick so selecting the same file twice re-fires the handler.
 */
export const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  accept,
  onFileSelected,
  uploading = false,
  label = 'Upload Document',
  uploadingLabel = 'Uploading…',
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <label
      className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors ${
        uploading
          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-sm shadow-blue-500/20 cursor-pointer'
      } ${className}`}
    >
      {uploading ? (
        <>
          <div
            className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
          <span>{uploadingLabel}</span>
        </>
      ) : (
        <>
          <Upload className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={uploading}
        aria-label={label}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (inputRef.current) inputRef.current.value = '';
          if (file) onFileSelected(file);
        }}
      />
    </label>
  );
};
