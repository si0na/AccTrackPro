import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';
import type { Comment } from '@/types';

export interface CommentCardProps {
  comment: Comment;
  onDelete: (id: string) => Promise<void> | void;
  onEdit?: (id: string, text: string) => Promise<void> | void;
  disabled?: boolean;
}

export const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  onDelete,
  onEdit,
  disabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editText.trim() || !onEdit) return;
    setIsSaving(true);
    try {
      await onEdit(comment.id, editText.trim());
      setIsEditing(false);
    } catch {
      // Keep edit mode active on failure
    } finally {
      setIsSaving(false);
    }
  };

  const isLong = comment.text.length > 220;
  const displayedText = isLong && !isExpanded ? `${comment.text.substring(0, 220)}...` : comment.text;

  return (
    <div className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200/60 rounded-xl p-4 space-y-2.5 relative group transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-[11px] shadow-sm select-none shrink-0">
            {(comment.user || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="font-bold text-slate-700 text-xs block leading-tight">{comment.user}</span>
            <span className="text-[9px] text-slate-400 font-semibold font-mono block mt-0.5">{comment.timestamp}</span>
          </div>
        </div>
        {!disabled && (
          <div className="flex items-center space-x-1 shrink-0">
            {onEdit && !isEditing && (
              <button
                type="button"
                onClick={() => { setEditText(comment.text); setIsEditing(true); }}
                className="text-slate-400 hover:text-blue-600 cursor-pointer p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit comment"
                aria-label="Edit comment"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {!isEditing && (
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="text-slate-400 hover:text-red-500 cursor-pointer p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete comment"
                aria-label="Delete comment"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Comment"
        onConfirm={() => { onDelete(comment.id); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />

      {isEditing ? (
        <div className="space-y-2 pt-1">
          <textarea
            rows={2}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full text-xs p-2.5 border border-blue-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none font-medium text-slate-700"
            placeholder="Edit comment..."
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-md cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || !editText.trim()}
              onClick={handleSave}
              className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
            {displayedText}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 mt-1 inline-block cursor-pointer"
            >
              {isExpanded ? 'Show less' : 'Read full comment'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
