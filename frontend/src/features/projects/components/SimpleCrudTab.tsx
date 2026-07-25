/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyRow,
  RowActionButton,
  Table,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '@/components/ui';

export interface SimpleCrudColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  render: (row: T) => React.ReactNode;
}

export interface SimpleCrudTabProps<T extends { id: string }> {
  /** Lucide icon rendered next to the card title, e.g. <Flag className="w-5 h-5 text-blue-600" />. */
  icon: React.ReactNode;
  /** Entity plural, e.g. "Milestones" — used for the card title "Milestones (3)". */
  title: string;
  /** Entity singular, e.g. "Milestone" — used for the Add button, delete dialog title, and row action labels. */
  entityLabel: string;
  columns: SimpleCrudColumn<T>[];
  rows: T[];
  loading?: boolean;
  emptyMessage: string;
  onAddClick: () => void;
  onEditClick: (row: T) => void;
  /** Short human-readable identifier for a row, used in the delete confirmation and action labels. */
  getRowLabel: (row: T) => string;
  onDelete: (row: T) => Promise<void>;
}

/**
 * Shared table + add/edit/delete UI shell for the five small project child
 * tabs (Milestones, Risks, Assumptions, Issues, Dependencies) — avoids
 * repeating the same Card/Table/pagination-less/empty-state/delete-confirm
 * JSX five times. Column rendering and the add/edit form are entirely
 * delegated to the caller since fields differ per entity; this component
 * only owns the table shell and the delete confirmation.
 */
export function SimpleCrudTab<T extends { id: string }>({
  icon,
  title,
  entityLabel,
  columns,
  rows,
  loading = false,
  emptyMessage,
  onAddClick,
  onEditClick,
  getRowLabel,
  onDelete,
}: SimpleCrudTabProps<T>) {
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);

  return (
    <>
      <Card
        padding="none"
        clip
        title={
          <span className="inline-flex items-center gap-2">
            {icon}
            <span className="text-sm font-bold text-slate-800 tracking-tight truncate">
              {title} ({rows.length})
            </span>
          </span>
        }
        actions={
          <Button icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />} onClick={onAddClick}>
            Add {entityLabel}
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              {columns.map((col) => (
                <TableHeadCell key={col.key} align={col.align}>{col.label}</TableHeadCell>
              ))}
              <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {loading ? (
                <EmptyRow colSpan={columns.length + 1} message={`Loading ${title.toLowerCase()}…`} />
              ) : rows.length === 0 ? (
                <EmptyRow colSpan={columns.length + 1} message={emptyMessage} />
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((col) => (
                      <TableCell key={col.key} align={col.align} className={col.className}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                    <TableCell align="center" sticky="right">
                      <div className="flex items-center justify-center gap-1.5">
                        <RowActionButton
                          intent="edit"
                          label={`Edit ${entityLabel.toLowerCase()} ${getRowLabel(row)}`}
                          icon={<Pencil className="w-3.5 h-3.5" />}
                          onClick={() => onEditClick(row)}
                        />
                        <RowActionButton
                          intent="delete"
                          label={`Delete ${entityLabel.toLowerCase()} ${getRowLabel(row)}`}
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={() => setDeleteTarget(row)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={`Delete ${entityLabel}`}
        message={deleteTarget ? <>Delete <span className="font-bold">"{getRowLabel(deleteTarget)}"</span>? This cannot be undone.</> : undefined}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await onDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
