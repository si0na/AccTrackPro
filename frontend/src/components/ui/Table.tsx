import React, { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';

/** User-resized columns are clamped to this range so no column can collapse or swallow the table. */
const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 640;

const clampWidth = (w: number) => Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, w));

const widthStoreKey = (key: string) => `reflectone:column-widths:${key}`;

const headerCells = (table: HTMLTableElement): HTMLTableCellElement[] =>
  table.tHead?.rows[0] ? Array.from(table.tHead.rows[0].cells) : [];

/**
 * Stable persistence id for a header cell — explicit `columnId` first, header
 * position otherwise. When *some* cells carry a columnId (config-driven tables
 * whose column set can change), positional keys are unreliable, so cells
 * without an id (e.g. the sticky Actions column) are excluded from
 * persistence; in fully static tables the header position is stable and used.
 */
const cellColId = (cell: HTMLTableCellElement, index: number, mixed: boolean): string | null =>
  cell.dataset.colid ?? (mixed ? null : `#${index}`);

const hasAnyColId = (cells: HTMLTableCellElement[]) => cells.some((c) => c.dataset.colid);

/** Computes a clean default width for a column when no user-dragged width is saved yet. */
const getDefaultColWidth = (id: string | null, cell: HTMLTableCellElement, index: number): number => {
  if (id) {
    const lower = id.toLowerCase();
    if (lower.includes('actions') || lower === 'actions') return 180;
    if (lower.includes('actionitemnumber') || lower.includes('actionitem#') || lower === 'number') return 110;
    if (lower.includes('name') || lower.includes('title')) return 220;
    if (lower.includes('account') || lower.includes('opportunity') || lower.includes('project')) return 160;
    if (lower.includes('owner') || lower.includes('user') || lower.includes('stakeholder')) return 150;
    if (lower.includes('desc') || lower.includes('note') || lower.includes('risk') || lower.includes('issue') || lower.includes('address') || lower.includes('nextaction') || lower.includes('impediment')) return 240;
    if (lower.includes('status') || lower.includes('health') || lower.includes('stage') || lower.includes('priority') || lower.includes('type')) return 120;
    if (lower.includes('date') || lower.includes('time') || lower.includes('year') || lower.includes('quarter')) return 110;
    if (lower.includes('revenue') || lower.includes('value') || lower.includes('cost') || lower.includes('margin') || lower.includes('prob')) return 110;
  }
  const text = cell.textContent?.trim().toLowerCase() || '';
  if (text.includes('action item #') || text.includes('item #') || text.includes('action item number')) return 110;
  if (text.includes('actions')) return 180;
  if (text.includes('name') || text.includes('title')) return 220;
  if (text.includes('account') || text.includes('opportunity') || text.includes('project')) return 160;
  if (text.includes('owner')) return 150;
  if (text.includes('description') || text.includes('notes') || text.includes('risks') || text.includes('impediments')) return 240;
  if (text.includes('status') || text.includes('priority') || text.includes('stage') || text.includes('type')) return 120;
  if (text.includes('date')) return 110;
  return 180;
};

/**
 * Switch the table to fixed layout with an explicit width per column. Only the
 * dragged column changes afterwards; the rest keep their frozen widths.
 */
const applyColumnWidths = (table: HTMLTableElement, widths: number[]) => {
  const sum = widths.reduce((a, b) => a + b, 0);
  const container = table.parentElement;
  const containerWidth = container ? container.clientWidth : 0;
  const cells = headerCells(table);

  let currentStickyLeft = 0;
  cells.forEach((cell, i) => {
    cell.style.width = `${widths[i]}px`;
    if (cell.dataset.sticky === 'left') {
      cell.style.left = `${currentStickyLeft}px`;
      const bodyCells = table.querySelectorAll(`tbody tr > td:nth-child(${i + 1})`);
      bodyCells.forEach((td) => {
        (td as HTMLElement).style.left = `${currentStickyLeft}px`;
      });
      currentStickyLeft += widths[i];
    }
  });

  table.style.tableLayout = 'fixed';
  if (containerWidth && sum < containerWidth) {
    table.style.width = '100%';
  } else {
    table.style.width = `${sum}px`;
  }
  table.style.minWidth = '';
};

/**
 * Helper to compute cumulative sticky left offsets for pinned columns.
 * Pass the array of displayed column configs and the table's storageKey (if any).
 */
export function computePinnedOffsets<T extends { key: string; isPinned?: boolean }>(
  columns: T[],
  storageKey?: string
): Record<string, number> {
  let saved: Record<string, number> | null = null;
  if (storageKey) {
    try {
      saved = JSON.parse(sessionStorage.getItem(widthStoreKey(storageKey)) ?? 'null');
    } catch {
      saved = null;
    }
  }
  const offsets: Record<string, number> = {};
  let currentOffset = 0;
  columns.forEach((col, i) => {
    if (col.isPinned) {
      offsets[col.key] = currentOffset;
      const w = saved?.[col.key];
      const width = typeof w === 'number' && Number.isFinite(w) ? clampWidth(w) : getDefaultColWidth(col.key, {} as any, i);
      currentOffset += width;
    }
  });
  return offsets;
}

interface TableResizeContextValue {
  startResize: (e: React.PointerEvent<HTMLElement>) => void;
}

/** Present (non-null) only inside a `<Table resizable>` — header cells use it to render drag handles. */
const TableResizeContext = React.createContext<TableResizeContextValue | null>(null);

export interface TableProps {
  /** Sets the whole table's text size. Defaults to the app-standard 'xs'. */
  size?: 'xs' | 'sm';
  /**
   * Number of optional (user-added) columns currently displayed beyond the
   * module's standard set. Default columns always share the container width
   * (no horizontal scroll); each extra column widens the table past 100% so
   * the surrounding `overflow-x-auto` wrapper scrolls only when the user has
   * opted into more columns via Customize Columns.
   */
  extraColumns?: number;
  /**
   * Lets users drag the column separators in the header to resize columns.
   * Pass a `storageKey` so the chosen widths persist for the session.
   */
  resizable?: boolean;
  /** Session-storage namespace for persisted column widths (one per table/module). */
  storageKey?: string;
  className?: string;
  children: React.ReactNode;
}

const SIZE_CLS: Record<NonNullable<TableProps['size']>, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
};

/**
 * Bare <table> wrapper standardizing the left-aligned, border-collapse,
 * base text size shared by every list view. Callers still render their own
 * <thead>/<tbody>/<tr> — this only fixes the table-root class drift.
 *
 * With `resizable`, every non-sticky `TableHeadCell` grows a drag handle on
 * its right edge; dragging resizes only that column (others are frozen at
 * their current widths) and the result is stored in sessionStorage under
 * `storageKey`, keyed by each column's `columnId` (or header position).
 */
export const Table: React.FC<TableProps> = ({
  size = 'xs',
  extraColumns = 0,
  resizable = false,
  storageKey,
  className = '',
  children,
}) => {
  const tableRef = useRef<HTMLTableElement>(null);

  // Re-apply persisted widths after every render: header cells are re-created
  // whenever the column set changes (Customize Columns, view switches), which
  // drops the inline styles set during the last drag.
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    let saved: Record<string, number> | null = null;
    if (storageKey) {
      try {
        saved = JSON.parse(sessionStorage.getItem(widthStoreKey(storageKey)) ?? 'null');
      } catch {
        saved = null;
      }
    }
    const cells = headerCells(table);
    if (cells.length === 0) return;
    const mixed = hasAnyColId(cells);
    const widths = cells.map((cell, i) => {
      const id = cellColId(cell, i, mixed);
      const w = id === null ? undefined : saved?.[id];
      if (typeof w === 'number' && Number.isFinite(w)) {
        return clampWidth(w);
      }
      return getDefaultColWidth(id, cell, i);
    });
    applyColumnWidths(table, widths);
  });

  const startResize = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const table = tableRef.current;
      const th = (e.currentTarget as HTMLElement).closest('th');
      if (!table || !th) return;
      e.preventDefault();
      e.stopPropagation();

      const cells = headerCells(table);
      const index = cells.indexOf(th as HTMLTableCellElement);
      if (index === -1) return;

      // Freeze every column at its current width so the drag affects only this one.
      const widths = cells.map((cell) => cell.getBoundingClientRect().width);
      applyColumnWidths(table, widths);

      const startX = e.clientX;
      const startWidth = widths[index];
      const otherTotal = widths.reduce((a, b) => a + b, 0) - startWidth;

      const onMove = (ev: PointerEvent) => {
        const next = clampWidth(startWidth + (ev.clientX - startX));
        th.style.width = `${next}px`;
        table.style.width = `${otherTotal + next}px`;

        let currentLeft = 0;
        cells.forEach((cell, i) => {
          const w = i === index ? next : widths[i];
          cell.style.width = `${w}px`;
          if (cell.dataset.sticky === 'left') {
            cell.style.left = `${currentLeft}px`;
            const bodyCells = table.querySelectorAll(`tbody tr > td:nth-child(${i + 1})`);
            bodyCells.forEach((td) => {
              (td as HTMLElement).style.left = `${currentLeft}px`;
            });
            currentLeft += w;
          }
        });
      };
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.body.style.removeProperty('cursor');
        document.body.style.removeProperty('user-select');
        if (storageKey) {
          const persisted: Record<string, number> = {};
          const cellsNow = headerCells(table);
          const mixed = hasAnyColId(cellsNow);
          cellsNow.forEach((cell, i) => {
            const id = cellColId(cell, i, mixed);
            if (id !== null) persisted[id] = Math.round(cell.getBoundingClientRect().width);
          });
          try {
            sessionStorage.setItem(widthStoreKey(storageKey), JSON.stringify(persisted));
          } catch {
            // Storage unavailable — widths still apply until the next remount.
          }
        }
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [storageKey],
  );

  const resizeCtx = useMemo<TableResizeContextValue | null>(
    () => (resizable ? { startResize } : null),
    [resizable, startResize],
  );

  return (
    <TableResizeContext.Provider value={resizeCtx}>
      <table
        ref={tableRef}
        className={`w-full text-left border-collapse ${SIZE_CLS[size]} ${className}`}
        style={extraColumns > 0 ? { minWidth: `calc(100% + ${extraColumns * 160}px)` } : undefined}
      >
        {children}
      </table>
    </TableResizeContext.Provider>
  );
};

export interface TableHeadProps {
  children: React.ReactNode;
}

/** Standard <thead> row styling: slate-50 band, bold uppercase slate-600 labels, a firm bottom rule separating it from the body. */
export const TableHead: React.FC<TableHeadProps> = ({ children }) => (
  <thead>
    <tr className="bg-slate-50/80 border-b-2 border-slate-200 select-none text-slate-600 font-semibold text-label uppercase tracking-wider">
      {children}
    </tr>
  </thead>
);

export interface TableHeadCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
  /** Pins the cell to the table's left or right edge during horizontal scroll. */
  sticky?: 'left' | 'right';
  /** Cumulative pixel offset for sticky left positioning. */
  stickyLeft?: number;
  /** Stable id used to persist this column's user-resized width across re-renders. */
  columnId?: string;
}

/** Standard <th> padding/alignment; wrap a <SortableHeader> or plain label as children.
 *  Horizontal padding (px-3) intentionally matches TableCell so header labels sit
 *  flush over their column data. Labels may wrap onto a second line so every
 *  default column fits the viewport without horizontal scrolling. */
export const TableHeadCell: React.FC<TableHeadCellProps> = ({
  align = 'left',
  sticky,
  stickyLeft = 0,
  columnId,
  className = '',
  style,
  children,
  ...rest
}) => {
  const resize = useContext(TableResizeContext);
  // Sticky right (Actions) columns are intentionally not resizable — their width is
  // driven by the action buttons and they must stay compact while pinned.
  const showHandle = !!resize && sticky !== 'right';

  const stickyCls =
    sticky === 'right'
      ? 'sticky right-0 z-30 bg-slate-50 border-l border-slate-200 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.15)] min-w-[140px] w-[140px]'
      : sticky === 'left'
      ? 'sticky z-30 bg-slate-50 border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.1)]'
      : 'relative';

  const combinedStyle: React.CSSProperties = {
    ...(sticky === 'left' ? { left: `${stickyLeft}px` } : {}),
    ...style,
  };

  return (
    <th
      data-colid={columnId}
      data-sticky={sticky}
      style={combinedStyle}
      className={`py-3 px-3 font-semibold text-label uppercase tracking-wider leading-snug align-middle overflow-hidden ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${stickyCls} ${className}`}
      {...rest}
    >
      {children}
      {showHandle && (
        <span
          role="presentation"
          onPointerDown={resize.startResize}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-y-0 right-0 w-1.5 cursor-col-resize select-none touch-none hover:bg-blue-400/60 active:bg-blue-500/70 transition-colors"
        />
      )}
    </th>
  );
};

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right' | 'center';
  /** Pins the cell to the table's left or right edge during horizontal scroll. */
  sticky?: 'left' | 'right';
  /** Cumulative pixel offset for sticky left positioning. */
  stickyLeft?: number;
}

/**
 * Standard <td>: py-3 px-3, middle-aligned — the same horizontal rhythm as
 * TableHeadCell so every column's data lines up under its header. Append
 * typography/color classes via `className`; pass `align` for numeric (right)
 * or badge/action (center) columns, mirroring the header's `align`.
 *
 * Sticky cells need an opaque background so scrolling content can't show
 * through; the default white + row-hover pair is skipped when the caller
 * supplies its own `bg-*` class (e.g. a selected-row highlight).
 */
export const TableCell: React.FC<TableCellProps> = ({
  align = 'left',
  sticky,
  stickyLeft = 0,
  className = '',
  style,
  children,
  title: explicitTitle,
  ...rest
}) => {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const [tooltipText, setTooltipText] = useState<string | undefined>(undefined);

  const handleMouseEnter = () => {
    if (explicitTitle !== undefined) {
      setTooltipText(explicitTitle);
      return;
    }
    const cell = cellRef.current;
    if (!cell) return;
    if (sticky === 'right' || (explicitTitle === undefined && cell.querySelector('button, input, select'))) {
      setTooltipText(undefined);
      return;
    }
    const targetEl = (cell.querySelector('.truncate') as HTMLElement) || cell;
    if (targetEl && targetEl.scrollWidth > targetEl.clientWidth + 1) {
      const txt = targetEl.textContent?.trim();
      if (txt && txt !== '—' && txt !== '-' && txt !== 'None') {
        setTooltipText(txt);
        return;
      }
    }
    setTooltipText(undefined);
  };

  const stickyCls =
    sticky === 'right'
      ? `sticky right-0 z-20 border-l border-slate-100 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.12)] min-w-[140px] w-[140px] ${
          /(^|\s)bg-/.test(className) ? '' : 'bg-white group-hover/row:bg-slate-50'
        }`
      : sticky === 'left'
      ? `sticky z-20 border-r border-slate-100 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)] ${
          /(^|\s)bg-/.test(className) ? '' : 'bg-white group-hover/row:bg-slate-50'
        }`
      : '';

  const combinedStyle: React.CSSProperties = {
    ...(sticky === 'left' ? { left: `${stickyLeft}px` } : {}),
    ...style,
  };

  return (
    <td
      ref={cellRef}
      data-sticky={sticky}
      onMouseEnter={handleMouseEnter}
      title={tooltipText}
      style={combinedStyle}
      className={`py-3 px-3 align-middle overflow-hidden truncate max-w-0 ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${stickyCls} ${className}`}
      {...rest}
    >
      {children}
    </td>
  );
};

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Adds cursor-pointer for rows that navigate/open on click. Hover highlight applies to every row regardless. */
  clickable?: boolean;
}

/** Standard <tr> border/hover/typography for a data row. Every row gets a hover highlight for scannability; `clickable` only adds the pointer cursor.
 *  The named `group/row` lets sticky cells mirror the row's hover state with an opaque background. */
export const TableRow: React.FC<TableRowProps> = ({
  clickable = false,
  className = '',
  children,
  ...rest
}) => (
  <tr
    className={`group/row border-b border-slate-100 last:border-0 text-xs font-medium text-slate-800 transition-colors duration-150 hover:bg-slate-50/60 ${
      clickable ? 'cursor-pointer' : ''
    } ${className}`}
    {...rest}
  >
    {children}
  </tr>
);

