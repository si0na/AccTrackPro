import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface ExpandableTextCellProps {
  /** Full (possibly multi-line) text; blank/whitespace renders the muted empty label. */
  text?: string | null;
  /** Accessible name announced on the Show More / Show Less toggle. */
  label: string;
  /** Muted placeholder shown when there is no content. */
  emptyLabel?: string;
  /** Fixed cell width so the column stays balanced regardless of content. */
  widthClass?: string;
  /** Number of preview lines shown while collapsed. */
  lines?: number;
}

/**
 * Long-text table cell that expands inline — no popover, tooltip, or modal.
 * Collapsed, it shows a fixed-width preview clamped to `lines` lines (line
 * breaks and word wrap preserved); when the content overflows, a Show More
 * link appears below the preview. Expanding animates the cell's height open
 * so only that row grows, and Show Less collapses it back. Each cell instance
 * owns its own state, so rows expand and collapse independently.
 */
export const ExpandableTextCell: React.FC<ExpandableTextCellProps> = ({
  text,
  label,
  emptyLabel = '—',
  widthClass = 'w-[240px] max-w-full',
  lines = 3,
}) => {
  const value = (text ?? '').trim();
  const [expanded, setExpanded] = useState(false);
  // The ellipsis clamp is lifted during expansion and re-applied only after
  // the collapse animation finishes, so text never snaps mid-transition.
  const [clamped, setClamped] = useState(true);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null);
  const [fullHeight, setFullHeight] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const clampedRef = useRef(clamped);
  clampedRef.current = clamped;

  // Measure the clamped (preview) height and the full content height to know
  // whether a toggle is needed and what heights to animate between. Re-runs
  // on text changes and, via ResizeObserver, on column width changes.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      setFullHeight(el.scrollHeight);
      if (clampedRef.current) {
        const collapsed = el.clientHeight;
        setCollapsedHeight(collapsed);
        setIsOverflowing(el.scrollHeight > collapsed + 1);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  // If the text shrinks below the clamp while expanded, drop back to the
  // plain collapsed rendering so a stale Show Less can't strand the cell.
  useEffect(() => {
    if (!isOverflowing && expanded) {
      setExpanded(false);
      setClamped(true);
    }
  }, [isOverflowing, expanded]);

  if (!value) {
    return <span className={`block ${widthClass} text-slate-400 font-medium`}>{emptyLabel}</span>;
  }

  const handleToggle = () => {
    if (expanded) {
      setExpanded(false); // clamp is re-applied on transition end
    } else {
      setClamped(false);
      setExpanded(true);
    }
  };

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && e.propertyName === 'max-height' && !expanded) {
      setClamped(true);
    }
  };

  const maxHeight =
    !isOverflowing || collapsedHeight === null || fullHeight === null
      ? undefined
      : expanded
      ? fullHeight
      : collapsedHeight;

  return (
    <div className={`${widthClass}`}>
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out motion-reduce:transition-none"
        style={maxHeight !== undefined ? { maxHeight } : undefined}
        onTransitionEnd={handleTransitionEnd}
      >
        <div
          ref={contentRef}
          className="text-xs leading-relaxed text-slate-600 font-medium whitespace-pre-wrap break-words"
          style={
            clamped
              ? {
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: lines,
                  overflow: 'hidden',
                }
              : undefined
          }
        >
          {value}
        </div>
      </div>

      {isOverflowing && (
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
          aria-label={expanded ? `Show less of ${label}` : `Show more of ${label}`}
          className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
        >
          <span>{expanded ? 'Show Less' : 'Show More'}</span>
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-300 motion-reduce:transition-none ${
              expanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
};
