import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy } from 'lucide-react';

export interface TextPreviewCellProps {
  /** Full (possibly multi-line) text; blank/whitespace renders the muted empty label. */
  text?: string | null;
  /** Accessible name for the trigger and heading shown inside the popover. */
  label: string;
  /** Muted placeholder shown when there is no content. */
  emptyLabel?: string;
  /** Fixed preview width so the column stays balanced regardless of content. */
  widthClass?: string;
}

const POPOVER_GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Long-text table cell: a fixed-width single-line preview truncated with an
 * ellipsis. Hover shows the full text as a native tooltip; click opens a
 * small portal-rendered popover with the complete text (line breaks
 * preserved) and a copy-to-clipboard action. The popover closes on outside
 * click, Escape, scroll, or resize — reading never leaves the table.
 */
export const TextPreviewCell: React.FC<TextPreviewCellProps> = ({
  text,
  label,
  emptyLabel = '—',
  widthClass = 'w-[190px]',
}) => {
  const value = (text ?? '').trim();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<number | undefined>(undefined);

  // Position below the trigger (above when there is no room), clamped to the
  // viewport. Runs after the popover renders so its real height is measurable;
  // it stays invisible until the position is known.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    const rect = trigger.getBoundingClientRect();
    let top = rect.bottom + POPOVER_GAP;
    if (
      top + popover.offsetHeight > window.innerHeight - VIEWPORT_MARGIN &&
      rect.top - POPOVER_GAP - popover.offsetHeight > VIEWPORT_MARGIN
    ) {
      top = rect.top - POPOVER_GAP - popover.offsetHeight;
    }
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, window.innerWidth - popover.offsetWidth - VIEWPORT_MARGIN),
    );
    setPos({ top, left });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only the popover should close — not any dialog hosting the table.
        e.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    // The popover is fixed-positioned, so scrolling anywhere outside it would
    // detach it from its cell — close instead of chasing the cell around.
    const onScrollOrResize = (e: Event) => {
      if (e.target instanceof Node && popoverRef.current?.contains(e.target)) return;
      setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [isOpen]);

  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

  if (!value) {
    return <span className={`block ${widthClass} text-slate-400 font-medium`}>{emptyLabel}</span>;
  }

  const handleToggle = () => {
    setPos(null);
    setCopied(false);
    setIsOpen((open) => !open);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — leave the label as "Copy".
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        title={value}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${label}: show full text`}
        className={`block ${widthClass} truncate text-left text-slate-600 font-medium hover:text-slate-900 hover:underline decoration-slate-300 underline-offset-2 cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40`}
      >
        {value}
      </button>

      {isOpen && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={label}
          style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
          className="fixed z-[70] w-80 max-w-[calc(100vw-16px)] rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/10"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {copied
                ? <Check className="w-3 h-3 text-green-600" aria-hidden="true" />
                : <Copy className="w-3 h-3" aria-hidden="true" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="px-3 py-2.5 max-h-64 overflow-y-auto text-xs leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
            {value}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
