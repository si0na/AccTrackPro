import React, { useState } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { PageHeader, Button, SearchBar, EmptyState, ConfirmDialog } from '@/components/ui';
import { EmployeeAppreciation } from '@/types';
import { matchesGlobalAccount } from '@/utils';
import { HeartHandshake, Plus, Filter, Building2, FolderKanban } from 'lucide-react';
import { EmployeeAppreciationCard } from './EmployeeAppreciationCard';
import { EmployeeAppreciationFormModal } from './EmployeeAppreciationFormModal';

export const EmployeeAppreciationView: React.FC = () => {
  const {
    employeeAppreciations,
    accounts,
    projects,
    globalAccountId,
    can,
    deleteEmployeeAppreciation,
  } = useCRM();

  const [search, setSearch] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedSourceType, setSelectedSourceType] = useState<string>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeAppreciation | null>(null);
  const [deletingItem, setDeletingItem] = useState<EmployeeAppreciation | null>(null);

  // Permission check
  const canCreate = can('employeeAppreciation', 'create');
  const canManage = can('employeeAppreciation', 'update') || can('employeeAppreciation', 'delete');

  // Filter projects based on account selection
  const filterProjects = React.useMemo(() => {
    if (!selectedAccountId) return projects;
    return projects.filter((p) => p.accountId === selectedAccountId);
  }, [projects, selectedAccountId]);

  // Scoped & Filtered Items
  const filteredItems = React.useMemo(() => {
    return employeeAppreciations.filter((item) => {
      // Global account filter
      if (!matchesGlobalAccount(item.accountId, globalAccountId)) return false;

      // Module Account filter
      if (selectedAccountId && item.accountId !== selectedAccountId) return false;

      // Module Project filter
      if (selectedProjectId && item.projectId !== selectedProjectId) return false;

      // Source Type filter
      if (selectedSourceType !== 'ALL' && item.internalExternal !== selectedSourceType) return false;

      // Search Query (Employee Name, Respondent Name, Feedback, Emp ID)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchEmp = item.employeeName.toLowerCase().includes(q);
        const matchResp = item.respondentName.toLowerCase().includes(q);
        const matchFeedback = item.feedback.toLowerCase().includes(q);
        const matchEmpId = (item.empId || '').toLowerCase().includes(q);
        const matchAccount = (item.accountName || '').toLowerCase().includes(q);
        if (!matchEmp && !matchResp && !matchFeedback && !matchEmpId && !matchAccount) {
          return false;
        }
      }

      return true;
    });
  }, [employeeAppreciations, globalAccountId, selectedAccountId, selectedProjectId, selectedSourceType, search]);

  const handleEdit = (item: EmployeeAppreciation) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    await deleteEmployeeAppreciation(deletingItem.id);
    setDeletingItem(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Employee Appreciation"
        subtitle="Employee Engagement • Capture client and internal commendations for team members"
        actions={
          canCreate && (
            <Button
              variant="primary"
              onClick={() => {
                setEditingItem(null);
                setIsModalOpen(true);
              }}
              className="gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Appreciation</span>
            </Button>
          )
        }
      />

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search bar */}
          <div className="sm:col-span-2">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by employee name, respondent, feedback quote, emp ID..."
            />
          </div>

          {/* Account Filter */}
          <div>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setSelectedProjectId('');
                }}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="">All Accounts</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Project Filter */}
          <div>
            <div className="relative">
              <FolderKanban className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="">All Projects</option>
                {filterProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Source Type Filter Chips */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Source:
          </span>
          <button
            onClick={() => setSelectedSourceType('ALL')}
            className={`px-3 py-1 rounded-full font-bold text-xs transition-all cursor-pointer ${
              selectedSourceType === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Sources ({employeeAppreciations.length})
          </button>
          <button
            onClick={() => setSelectedSourceType('External')}
            className={`px-3 py-1 rounded-full font-bold text-xs transition-all cursor-pointer ${
              selectedSourceType === 'External'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            External (Client)
          </button>
          <button
            onClick={() => setSelectedSourceType('Internal')}
            className={`px-3 py-1 rounded-full font-bold text-xs transition-all cursor-pointer ${
              selectedSourceType === 'Internal'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            Internal (Colleague)
          </button>
        </div>
      </div>

      {/* Cards List Grid */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={<HeartHandshake className="w-8 h-8 text-slate-400" />}
          title="No Employee Appreciation Records Found"
          hint="Log positive feedback and client commendations received for team members."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredItems.map((item) => (
            <EmployeeAppreciationCard
              key={item.id}
              item={item}
              onEdit={canManage ? handleEdit : undefined}
              onDelete={canManage ? (i) => setDeletingItem(i) : undefined}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Form Modal */}
      <EmployeeAppreciationFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        initialData={editingItem}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deletingItem}
        onCancel={() => setDeletingItem(null)}
        onConfirm={handleDelete}
        title="Delete Employee Appreciation"
        message={`Are you sure you want to delete the appreciation record for ${deletingItem?.employeeName}? This action cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  );
};
