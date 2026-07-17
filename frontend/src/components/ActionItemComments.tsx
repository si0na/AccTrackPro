import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Button, INPUT_CLS } from '@/components/ui';
import type { Comment } from '@/types';

export interface ActionItemCommentToggleProps {
  itemTitle: string;
  commentCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Per-row comment icon + live count badge for an Action Item — clicking
 * expands/collapses that row's comments. Shared by the Action Items page and
 * every other table that lists Action Items (e.g. an Opportunity's Quick
 * Actions panel), so the affordance and behavior can't drift between them.
 */
export const ActionItemCommentToggle: React.FC<ActionItemCommentToggleProps> = ({
  itemTitle,
  commentCount,
  isExpanded,
  onToggle,
}) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
    className={`inline-flex items-center space-x-1 ml-2 px-1.5 py-0.5 rounded transition-all cursor-pointer ${
      isExpanded
        ? 'bg-blue-100 text-blue-700 font-bold'
        : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'
    }`}
    title="View/Add Comments"
    aria-label={`View or add comments for ${itemTitle}`}
    aria-expanded={isExpanded}
  >
    <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
    <span className="text-[10px] font-bold">{commentCount}</span>
  </button>
);

export interface ActionItemCommentsExpandedRowProps {
  colSpan: number;
  comments: Comment[];
  /** When provided, a read-only "Risks & Dependencies" detail block is shown above the comments. */
  risksAndDependencies?: string;
  onAddComment: (text: string) => void;
  onDeleteComment: (comment: Comment) => void;
}

/**
 * Expanded inline detail row for a single Action Item — shows the item's
 * Risks & Dependencies (when supplied) plus its comments, and lets the user
 * add a new comment. Rendered as a sibling `<tr>` spanning the full table
 * width, directly below the Action Item's row.
 */
export const ActionItemCommentsExpandedRow: React.FC<ActionItemCommentsExpandedRowProps> = ({
  colSpan,
  comments,
  risksAndDependencies,
  onAddComment,
  onDeleteComment,
}) => (
  <tr className="bg-slate-50/70 border-b border-slate-200">
    <td colSpan={colSpan} className="p-4">
      <div className="space-y-3 max-w-2xl">
        {risksAndDependencies !== undefined && (
          <div>
            <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Risks & Dependencies</span>
            <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
              {risksAndDependencies || <span className="text-slate-400 font-medium italic">None noted</span>}
            </p>
          </div>
        )}

        <div className="flex items-center space-x-2 border-b border-slate-200 pb-1.5">
          <MessageSquare className="w-4 h-4 text-blue-600" aria-hidden="true" />
          <h4 className="font-bold text-slate-700 text-xs">Governance Comments ({comments.length})</h4>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {comments.length === 0 ? (
            <p className="text-[11px] text-slate-400 font-medium py-1">No comments logged for this action item.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-1 relative group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-700 text-[11px]">{c.user}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[9px] text-slate-400 font-mono">{c.timestamp}</span>
                  </div>
                  <button
                    onClick={() => onDeleteComment(c)}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-[10px] font-bold cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{c.text}</p>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem('commentText') as HTMLInputElement;
            if (input && input.value.trim()) {
              onAddComment(input.value.trim());
              input.value = '';
            }
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            name="commentText"
            required
            placeholder="Add a comment or update..."
            aria-label="Add a comment or update"
            className={`${INPUT_CLS} flex-1 bg-white`}
          />
          <Button type="submit" size="xs" className="shrink-0">
            Add Comment
          </Button>
        </form>
      </div>
    </td>
  </tr>
);
