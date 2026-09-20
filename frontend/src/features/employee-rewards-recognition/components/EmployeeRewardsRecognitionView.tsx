import React, { useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { EmployeeRewardsRecognition } from '@/types';
import {
  Award,
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  Eye,
  Calendar,
  User,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  FileText,
} from 'lucide-react';
import {
  Card,
  Button,
  SummaryCard,
  Table,
  TableHead,
  TableHeadCell,
  TableRow,
  TableCell,
  EmptyState,
  ConfirmDialog,
  StatusBadge,
  INPUT_CLS,
  SELECT_CLS,
} from '@/components/ui';
import {
  REWARDS_RECOGNITION_TYPE_OPTIONS,
  REWARDS_RECOGNITION_TEAM_OR_INDIVIDUAL_OPTIONS,
  REWARDS_RECOGNITION_STATUS_OPTIONS,
  REWARDS_RECOGNITION_CATEGORIES_BY_TYPE,
} from '@/constants/rewards-recognition';
import { EmployeeRewardsRecognitionFormModal } from './EmployeeRewardsRecognitionFormModal';
import { EmployeeRewardsRecognitionDrawer } from './EmployeeRewardsRecognitionDrawer';

const STATUS_BADGE_MAP: Record<string, 'emerald' | 'amber' | 'rose' | 'slate'> = {
  'Won': 'emerald',
  'Nominated - Not Won': 'amber',
  'Nomination Rejected': 'rose',
};

const TYPE_BADGE_MAP: Record<string, 'indigo' | 'purple' | 'blue' | 'slate'> = {
  'Continous': 'blue',
  'Quarterly': 'purple',
  'Annual': 'indigo',
};

export const EmployeeRewardsRecognitionView: React.FC = () => {
  const {
    employeeRewardsRecognitions,
    addEmployeeRewardsRecognition,
    updateEmployeeRewardsRecognition,
    deleteEmployeeRewardsRecognition,
    can,
  } = useCRM();

  const canCreate = can('employeeRewardsRecognition', 'create');
  const canUpdate = can('employeeRewardsRecognition', 'update');
  const canDelete = can('employeeRewardsRecognition', 'delete');

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [teamFilter, setTeamFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [monthFilter, setMonthFilter] = useState<string>('');

  // Modals and Drawer states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeRewardsRecognition | null>(null);
  const [viewingItem, setViewingItem] = useState<EmployeeRewardsRecognition | null>(null);
  const [deletingItem, setDeletingItem] = useState<EmployeeRewardsRecognition | null>(null);

  // Available Categories for category filter based on selected type
  const availableFilterCategories = useMemo(() => {
    if (typeFilter === 'All') {
      return Object.values(REWARDS_RECOGNITION_CATEGORIES_BY_TYPE).flat();
    }
    return REWARDS_RECOGNITION_CATEGORIES_BY_TYPE[typeFilter] || [];
  }, [typeFilter]);

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return (employeeRewardsRecognitions || []).filter((item) => {
      if (typeFilter !== 'All' && item.type !== typeFilter) return false;
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (teamFilter !== 'All' && item.teamOrIndividual !== teamFilter) return false;
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;
      if (monthFilter && item.monthOfRr !== monthFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const emp = (item.employeeName || '').toLowerCase();
        const nom = (item.nominatedByName || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const typ = (item.type || '').toLowerCase();
        const det = (item.details || '').toLowerCase();
        return emp.includes(q) || nom.includes(q) || cat.includes(q) || typ.includes(q) || det.includes(q);
      }
      return true;
    });
  }, [employeeRewardsRecognitions, typeFilter, categoryFilter, teamFilter, statusFilter, monthFilter, searchTerm]);

  // KPI counters
  const totalCount = (employeeRewardsRecognitions || []).length;
  const wonCount = (employeeRewardsRecognitions || []).filter((i) => i.status === 'Won').length;
  const nominatedCount = (employeeRewardsRecognitions || []).filter((i) => i.status === 'Nominated - Not Won').length;
  const rejectedCount = (employeeRewardsRecognitions || []).filter((i) => i.status === 'Nomination Rejected').length;

  const handleCreateSubmit = async (data: any) => {
    await addEmployeeRewardsRecognition(data);
  };

  const handleEditSubmit = async (data: any) => {
    if (editingItem) {
      await updateEmployeeRewardsRecognition(editingItem.id, data);
      setEditingItem(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletingItem) {
      await deleteEmployeeRewardsRecognition(deletingItem.id);
      setDeletingItem(null);
    }
  };

  const handleInlineStatusChange = async (item: EmployeeRewardsRecognition, newStatus: string) => {
    if (!canUpdate) return;
    try {
      await updateEmployeeRewardsRecognition(item.id, { status: newStatus as any });
    } catch {
      // Error toast raised centrally
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Employee Rewards and Recognition</h1>
              <p className="text-xs text-slate-500 font-medium">
                Employee Engagement • Capture and celebrate continuous, quarterly, and annual team awards
              </p>
            </div>
          </div>
        </div>

        {canCreate && (
          <Button
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Add Nomination
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total R&R Nominations"
          value={totalCount}
          icon={<Award className="w-4.5 h-4.5" />}
          tone="indigo"
        />
        <SummaryCard
          label="Awards Won"
          value={wonCount}
          icon={<Sparkles className="w-4.5 h-4.5" />}
          tone="emerald"
        />
        <SummaryCard
          label="Pending Nominations"
          value={nominatedCount}
          icon={<Clock className="w-4.5 h-4.5" />}
          tone="amber"
        />
        <SummaryCard
          label="Nomination Rejected"
          value={rejectedCount}
          icon={<XCircle className="w-4.5 h-4.5" />}
          tone="purple"
        />
      </div>

      {/* Main Content Card */}
      <Card padding="none">
        {/* Filter and Search Bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Employee, Nominated By, Category, Type or Details..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${INPUT_CLS} pl-9 bg-white text-xs`}
              />
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Type Filter */}
              <div className="flex items-center space-x-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCategoryFilter('All');
                  }}
                  className={`${SELECT_CLS} py-1 text-xs bg-white w-auto min-w-[110px]`}
                >
                  <option value="All">All Types</option>
                  {REWARDS_RECOGNITION_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="flex items-center space-x-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={`${SELECT_CLS} py-1 text-xs bg-white w-auto min-w-[130px] max-w-[200px]`}
                >
                  <option value="All">All Categories</option>
                  {availableFilterCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Team/Individual Filter */}
              <div className="flex items-center space-x-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Scope:</span>
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className={`${SELECT_CLS} py-1 text-xs bg-white w-auto min-w-[110px]`}
                >
                  <option value="All">All Scopes</option>
                  {REWARDS_RECOGNITION_TEAM_OR_INDIVIDUAL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`${SELECT_CLS} py-1 text-xs bg-white w-auto min-w-[130px]`}
                >
                  <option value="All">All Statuses</option>
                  {REWARDS_RECOGNITION_STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState
              icon={<Award className="w-8 h-8 text-slate-400" />}
              title="No Recognition Nominations Found"
              hint={
                searchTerm || typeFilter !== 'All' || categoryFilter !== 'All' || statusFilter !== 'All'
                  ? 'No nominations match your active filters.'
                  : 'Start by nominating an employee or team for Rewards and Recognition.'
              }
            />
            {canCreate && (
              <div className="mt-4 flex justify-center">
                <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setIsCreateModalOpen(true)}>
                  Create First Nomination
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableHeadCell>Month of R&amp;R</TableHeadCell>
              <TableHeadCell>Nominated By</TableHeadCell>
              <TableHeadCell>Type</TableHeadCell>
              <TableHeadCell>Category</TableHeadCell>
              <TableHeadCell>Team / Individual</TableHeadCell>
              <TableHeadCell>Employee Name</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell>Details</TableHeadCell>
              <TableHeadCell>Creation Date</TableHeadCell>
              <TableHeadCell align="right">Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {filteredItems.map((item) => (
                <TableRow key={item.id} onClick={() => setViewingItem(item)} className="cursor-pointer hover:bg-slate-50/80">
                  <TableCell className="font-semibold text-slate-800 text-xs">
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.monthOfRr}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-slate-700 text-xs font-medium">
                    {item.nominatedByName || '—'}
                  </TableCell>

                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      item.type === 'Continous' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      item.type === 'Quarterly' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}>
                      {item.type}
                    </span>
                  </TableCell>

                  <TableCell className="text-slate-900 font-bold text-xs">
                    {item.category}
                  </TableCell>

                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      item.teamOrIndividual === 'Team'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {item.teamOrIndividual}
                    </span>
                  </TableCell>

                  <TableCell className="text-slate-800 text-xs font-semibold">
                    <div>
                      <span>{item.employeeName || '—'}</span>
                      {item.teamOrIndividual === 'Team' && item.teamMembers && (
                        <span className="block text-[11px] text-slate-500 font-normal truncate max-w-[200px]" title={item.teamMembers}>
                          Members: {item.teamMembers}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canUpdate ? (
                      <select
                        value={item.status}
                        onChange={(e) => handleInlineStatusChange(item, e.target.value)}
                        className={`text-xs font-semibold px-2 py-1 rounded-md border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                          item.status === 'Won' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                          item.status === 'Nominated - Not Won' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {REWARDS_RECOGNITION_STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                        item.status === 'Won' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        item.status === 'Nominated - Not Won' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {item.status}
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="max-w-[220px]">
                    <p className="text-xs text-slate-600 font-medium truncate" title={item.details}>
                      {item.details}
                    </p>
                  </TableCell>

                  <TableCell className="text-slate-500 text-[11px] font-mono">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                  </TableCell>

                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => setViewingItem(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canUpdate && (
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                          title="Edit nomination"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeletingItem(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete nomination"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Form Modal for Create */}
      <EmployeeRewardsRecognitionFormModal
        isOpen={isCreateModalOpen}
        mode="create"
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
      />

      {/* Form Modal for Edit */}
      <EmployeeRewardsRecognitionFormModal
        isOpen={!!editingItem}
        mode="edit"
        initialData={editingItem}
        onClose={() => setEditingItem(null)}
        onSubmit={handleEditSubmit}
      />

      {/* Detail Drawer */}
      <EmployeeRewardsRecognitionDrawer
        isOpen={!!viewingItem}
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        onEdit={(item) => setEditingItem(item)}
        canEdit={canUpdate}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deletingItem}
        title="Delete Recognition Nomination"
        message={
          <>
            Are you sure you want to delete nomination <span className="font-bold">"{deletingItem?.category}"</span> for <span className="font-bold">"{deletingItem?.employeeName}"</span>?
          </>
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingItem(null)}
      />
    </div>
  );
};
