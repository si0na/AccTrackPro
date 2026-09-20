import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Button, EmptyState, ConfirmDialog } from '@/components/ui';
import { EmployeeAppreciation } from '@/types';
import { HeartHandshake, Plus, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { EmployeeAppreciationCard } from './EmployeeAppreciationCard';
import { EmployeeAppreciationTable } from './EmployeeAppreciationTable';
import { EmployeeAppreciationFormModal } from './EmployeeAppreciationFormModal';

export interface EmployeeAppreciationTabProps {
  accountId?: string;
  projectId?: string;
  accountName?: string;
}

export const EmployeeAppreciationTab: React.FC<EmployeeAppreciationTabProps> = ({
  accountId,
  projectId,
}) => {
  const { employeeAppreciations, can, deleteEmployeeAppreciation } = useCRM();

  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeAppreciation | null>(null);
  const [deletingItem, setDeletingItem] = useState<EmployeeAppreciation | null>(null);

  const canCreate = can('employeeAppreciation', 'create');
  const canManage = can('employeeAppreciation', 'update') || can('employeeAppreciation', 'delete');

  const items = React.useMemo(() => {
    return employeeAppreciations.filter((item) => {
      if (accountId && item.accountId !== accountId) return false;
      if (projectId && item.projectId !== projectId) return false;
      return true;
    });
  }, [employeeAppreciations, accountId, projectId]);

  const handleDelete = async () => {
    if (!deletingItem) return;
    await deleteEmployeeAppreciation(deletingItem.id);
    setDeletingItem(null);
  };

  return (
    <div className="space-y-4">
      {/* Subheader action */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-blue-600" />
            <span>Employee Appreciation ({items.length})</span>
          </h3>
          <p className="text-xs text-slate-500">
            Commendations & feedback captured for team members on this {projectId ? 'Project' : 'Account'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          <div className="inline-flex p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>

          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Appreciation</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Content (Table / Cards) */}
      {items.length === 0 ? (
        <EmptyState
          icon={<HeartHandshake className="w-8 h-8 text-slate-400" />}
          title="No Appreciation Logged"
          hint={`No positive feedback recorded yet for this ${projectId ? 'project' : 'account'}.`}
        />
      ) : viewMode === 'table' ? (
        <EmployeeAppreciationTable
          items={items}
          onEdit={canManage ? (i) => { setEditingItem(i); setIsModalOpen(true); } : undefined}
          onDelete={canManage ? (i) => setDeletingItem(i) : undefined}
          canManage={canManage}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <EmployeeAppreciationCard
              key={item.id}
              item={item}
              onEdit={canManage ? (i) => { setEditingItem(i); setIsModalOpen(true); } : undefined}
              onDelete={canManage ? (i) => setDeletingItem(i) : undefined}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <EmployeeAppreciationFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        initialData={editingItem}
        defaultAccountId={accountId}
        defaultProjectId={projectId}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deletingItem}
        onCancel={() => setDeletingItem(null)}
        onConfirm={handleDelete}
        title="Delete Employee Appreciation"
        message={`Are you sure you want to delete the appreciation record for ${deletingItem?.employeeName}?`}
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  );
};
