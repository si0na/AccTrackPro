import React, { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import {
  administrationApi, financialYearsApi, employeeMasterApi,
} from '@/api/crm.api';
import type {
  AdminSystemOverview, AdminUser, FinancialCalendar, FYQuarterDef, EmployeeMaster,
} from '@/types';
import {
  Users, BarChart3, Briefcase, FileText, Bell,
  Plus, CheckCircle, XCircle, Settings2,
  RefreshCw, CalendarDays,
  Pencil, Trash2, ShieldCheck, ShieldAlert,
  ClipboardList, SlidersHorizontal,
} from 'lucide-react';
import {
  Button,
  Card,
  EmptyRow,
  ErrorBanner,
  FormField,
  INPUT_CLS,
  PageHeader,
  RowActionButton,
  SELECT_CLS,
  StatusBadge,
  SummaryCard,
  Table,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '@/components/ui';
import type { CardTone } from '@/components/ui';

// ─── Local status color maps (admin-only enums) ──────────────────────────────

const USER_STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-slate-100 text-slate-500',
};

const FY_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-slate-100 text-slate-500',
};

// ─── Month helpers ────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthName(m: number)  { return MONTH_NAMES[m - 1] ?? ''; }
function monthAbbr(m: number)  { return MONTH_ABBR[m - 1]  ?? ''; }

/** Auto-compute 4 equal quarters (3 months each) starting from startMonth. */
function deriveQuarters(startMonth: number): FYQuarterDef[] {
  return Array.from({ length: 4 }, (_, i) => {
    const qStart = ((startMonth - 1 + i * 3) % 12) + 1;
    const qEnd   = ((startMonth - 1 + i * 3 + 2) % 12) + 1;
    return { label: `Q${i + 1}`, startMonth: qStart, endMonth: qEnd };
  });
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  tone: CardTone;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, tone }) => (
  <SummaryCard label={label} value={value === null ? '—' : value.toLocaleString()} icon={icon} tone={tone} />
);

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'employees', label: 'Employee Master', icon: ShieldCheck },
  { id: 'financial-years', label: 'Financial Years', icon: CalendarDays },
  { id: 'calendar', label: 'Calendar Configuration', icon: ClipboardList },
  { id: 'settings', label: 'Application Settings', icon: SlidersHorizontal },
] as const;

type AdminTab = typeof TABS[number]['id'];

/** A form/action row that sits above a table — visually separated so buttons don't crowd the table. */
const Toolbar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap items-end gap-3 pb-5 mb-5 border-b border-slate-100">
    {children}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const AdministrationPage: React.FC = () => {
  const { financialYears, financialCalendar, adminSettings, refreshData } = useCRM();

  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  // System Overview
  const [overview, setOverview] = useState<AdminSystemOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // User Management
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // Financial Year
  const [newFYYear, setNewFYYear]     = useState('');
  const [fyLoading, setFYLoading]     = useState(false);
  const [fyError, setFYError]         = useState('');
  const [fySuccess, setFYSuccess]     = useState('');
  const [fyActionId, setFYActionId]   = useState<string | null>(null); // FY being actioned

  // Financial Calendar config (local edit state, separate from context)
  const [calStartMonth, setCalStartMonth] = useState<number>(4);
  const [calLoading, setCalLoading]       = useState(false);
  const [calSuccess, setCalSuccess]       = useState('');
  const [calError, setCalError]           = useState('');

  // Per-FY calendar editing
  const [editingCalendarFYId, setEditingCalendarFYId] = useState<string | null>(null);
  const [editCalStartMonth, setEditCalStartMonth]     = useState<number>(4);
  const [calendarSaving, setCalendarSaving]           = useState(false);
  const [calendarEditError, setCalendarEditError]     = useState('');

  // Application Settings
  const [selectorCount, setSelectorCount] = useState('5');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');

  // Employee Master
  const [employees, setEmployees]               = useState<EmployeeMaster[]>([]);
  const [empLoading, setEmpLoading]             = useState(true);
  const [newEmpEmail, setNewEmpEmail]           = useState('');
  const [newEmpName, setNewEmpName]             = useState('');
  const [empAddError, setEmpAddError]           = useState('');
  const [empAddSuccess, setEmpAddSuccess]       = useState('');
  const [empAdding, setEmpAdding]               = useState(false);
  const [editingEmpId, setEditingEmpId]         = useState<string | null>(null);
  const [editEmpEmail, setEditEmpEmail]         = useState('');
  const [editEmpName, setEditEmpName]           = useState('');
  const [empEditError, setEmpEditError]         = useState('');
  const [empEditSaving, setEmpEditSaving]       = useState(false);
  const [deletingEmpId, setDeletingEmpId]       = useState<string | null>(null);
  const [empDeleteError, setEmpDeleteError]     = useState<Record<string, string>>({});

  // ── Load overview + users ──────────────────────────────────────────────────
  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const data = await administrationApi.getSystemOverview();
      setOverview(data);
    } catch { /* swallow */ } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await administrationApi.getUsers();
      setUsers(data);
    } catch { /* swallow */ } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const data = await employeeMasterApi.getAll();
      setEmployees(data);
    } catch { /* swallow */ } finally {
      setEmpLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    loadUsers();
    loadEmployees();
  }, [loadOverview, loadUsers, loadEmployees]);

  // Sync local calendar state from context
  useEffect(() => {
    if (financialCalendar) setCalStartMonth(financialCalendar.startMonth);
  }, [financialCalendar]);

  // Sync settings
  useEffect(() => {
    if (adminSettings?.fySelectorCount) setSelectorCount(adminSettings.fySelectorCount);
  }, [adminSettings]);

  // ── Suggested next FY start year ──────────────────────────────────────────
  const suggestedNext = financialYears.length > 0
    ? Math.max(...financialYears.map((fy) => fy.startYear)) + 1
    : new Date().getFullYear();

  // ── FY actions ─────────────────────────────────────────────────────────────

  const handleAddFY = async () => {
    const startYear = parseInt(newFYYear, 10);
    if (isNaN(startYear) || startYear < 2000 || startYear > 2100) {
      setFYError('Enter a valid start year between 2000 and 2100.');
      return;
    }
    setFYLoading(true);
    setFYError('');
    setFYSuccess('');
    try {
      await financialYearsApi.create({ startYear });
      await refreshData();
      setFYSuccess(`Financial year created successfully.`);
      setNewFYYear('');
    } catch {
      setFYError('Failed to create financial year — it may already exist.');
    } finally {
      setFYLoading(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    setFYActionId(id);
    setFYError('');
    setFYSuccess('');
    try {
      if (isActive) {
        await financialYearsApi.deactivate(id);
      } else {
        await financialYearsApi.activate(id);
      }
      await refreshData();
    } catch {
      setFYError('Failed to update financial year status.');
    } finally {
      setFYActionId(null);
    }
  };

  // ── Per-FY calendar save ──────────────────────────────────────────────────

  const handleSaveFYCalendar = async (fyId: string) => {
    setCalendarSaving(true);
    setCalendarEditError('');
    try {
      const quarters = deriveQuarters(editCalStartMonth);
      await financialYearsApi.updateCalendar(fyId, { startMonth: editCalStartMonth, quarters });
      await refreshData();
      setEditingCalendarFYId(null);
    } catch {
      setCalendarEditError('Failed to update calendar.');
    } finally {
      setCalendarSaving(false);
    }
  };

  // ── Employee Master handlers ───────────────────────────────────────────────

  const handleAddEmployee = async () => {
    const email = newEmpEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmpAddError('Please enter a valid email address.');
      return;
    }
    setEmpAdding(true);
    setEmpAddError('');
    setEmpAddSuccess('');
    try {
      await employeeMasterApi.create(email, newEmpName.trim());
      setNewEmpEmail('');
      setNewEmpName('');
      setEmpAddSuccess('Employee added successfully.');
      await loadEmployees();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEmpAddError(typeof msg === 'string' ? msg : 'Failed to add employee. The email may already exist.');
    } finally {
      setEmpAdding(false);
    }
  };

  const handleStartEditEmployee = (emp: EmployeeMaster) => {
    setEditingEmpId(emp.id);
    setEditEmpEmail(emp.email);
    setEditEmpName(emp.name || '');
    setEmpEditError('');
  };

  const handleSaveEditEmployee = async () => {
    if (!editingEmpId) return;
    const email = editEmpEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmpEditError('Please enter a valid email address.');
      return;
    }
    setEmpEditSaving(true);
    setEmpEditError('');
    try {
      await employeeMasterApi.update(editingEmpId, email, editEmpName.trim());
      setEditingEmpId(null);
      await loadEmployees();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEmpEditError(typeof msg === 'string' ? msg : 'Failed to update email.');
    } finally {
      setEmpEditSaving(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    setDeletingEmpId(id);
    setEmpDeleteError((prev) => ({ ...prev, [id]: '' }));
    try {
      await employeeMasterApi.delete(id);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEmpDeleteError((prev) => ({
        ...prev,
        [id]: typeof msg === 'string' ? msg : 'Cannot delete this employee.',
      }));
    } finally {
      setDeletingEmpId(null);
    }
  };

  // ── Financial Calendar save ────────────────────────────────────────────────

  const handleSaveCalendar = async () => {
    setCalLoading(true);
    setCalError('');
    setCalSuccess('');
    try {
      const quarters = deriveQuarters(calStartMonth);
      await administrationApi.updateFinancialCalendar({ startMonth: calStartMonth, quarters });
      await refreshData();
      setCalSuccess('Financial calendar updated. New financial years will use this structure.');
    } catch {
      setCalError('Failed to save financial calendar configuration.');
    } finally {
      setCalLoading(false);
    }
  };

  // ── Application Settings save ──────────────────────────────────────────────

  const handleSaveSettings = async () => {
    const n = parseInt(selectorCount, 10);
    if (isNaN(n) || n < 1 || n > 20) {
      setSettingsSuccess('');
      return;
    }
    setSettingsSaving(true);
    setSettingsSuccess('');
    try {
      await administrationApi.updateSettings({ fySelectorCount: String(n) });
      await refreshData();
      setSettingsSuccess('Settings saved.');
    } catch { /* swallow */ } finally {
      setSettingsSaving(false);
    }
  };

  // ── Derived calendar preview ───────────────────────────────────────────────
  const previewQuarters = deriveQuarters(calStartMonth);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration"
        subtitle="Manage users, financial years, calendar configuration, and global application settings."
      />

      {/* ── 1. System Overview ── */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">System Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            icon={<Users className="w-5 h-5" aria-hidden="true" />}
            label="Total Users"
            value={overviewLoading ? null : (overview?.totalUsers ?? 0)}
            tone="indigo"
          />
          <StatCard
            icon={<Briefcase className="w-5 h-5" aria-hidden="true" />}
            label="Accounts"
            value={overviewLoading ? null : (overview?.totalAccounts ?? 0)}
            tone="blue"
          />
          <StatCard
            icon={<BarChart3 className="w-5 h-5" aria-hidden="true" />}
            label="Opportunities"
            value={overviewLoading ? null : (overview?.totalOpportunities ?? 0)}
            tone="emerald"
          />
          <StatCard
            icon={<FileText className="w-5 h-5" aria-hidden="true" />}
            label="Documents"
            value={overviewLoading ? null : (overview?.totalDocuments ?? 0)}
            tone="amber"
          />
          <StatCard
            icon={<Bell className="w-5 h-5" aria-hidden="true" />}
            label="Notifications"
            value={overviewLoading ? null : (overview?.totalNotifications ?? 0)}
            tone="purple"
          />
        </div>
      </div>

      {/* ── Section tabs ── */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto select-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 -mb-px border-b-2 rounded-t-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── User Management ── */}
      {activeTab === 'users' && (
      <Card title="User Management" actions={<span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold font-mono">{users.length} USERS</span>} padding="cozy">
        {usersLoading ? (
          <p className="text-xs text-slate-400 italic py-4 text-center">Loading users…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableHeadCell>Name</TableHeadCell>
                <TableHeadCell>Email</TableHeadCell>
                <TableHeadCell>Role</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Security</TableHeadCell>
                <TableHeadCell>Created</TableHeadCell>
                <TableHeadCell>Last Login</TableHeadCell>
              </TableHead>
              <tbody>
                {users.length === 0 ? (
                  <EmptyRow colSpan={7} message="No users found." />
                ) : (
                  users.map((u) => {
                    const isLocked = !!(u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now());
                    return (
                    <TableRow key={u.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0"
                            aria-hidden="true"
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          {u.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 font-mono">{u.email}</TableCell>
                      <TableCell className="text-slate-600">{u.role}</TableCell>
                      <TableCell>
                        <StatusBadge
                          value={u.isActive ? 'Active' : 'Inactive'}
                          colorMap={USER_STATUS_COLORS}
                        />
                      </TableCell>
                      <TableCell>
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                            <ShieldAlert className="w-3 h-3" aria-hidden="true" /> Locked
                          </span>
                        ) : u.failedAttempts ? (
                          <span className="text-[10px] font-semibold text-amber-600">
                            {u.failedAttempts} failed attempt{u.failedAttempts === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Clear</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400 font-mono text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="text-slate-400 font-mono">
                        {u.lastLogin
                          ? new Date(u.lastLogin).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : <span className="italic">Never</span>}
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
      )}

      {/* ── Employee Master ── */}
      {activeTab === 'employees' && (
      <Card
        title="Employee Master"
        subtitle="Only employees listed here are authorized to create an account. Deleting an entry is blocked if the employee has already registered."
        padding="cozy"
      >
        <Toolbar>
          <FormField label="Email Address" className="flex-1 min-w-48">
            <input
              type="email"
              value={newEmpEmail}
              onChange={(e) => { setNewEmpEmail(e.target.value); setEmpAddError(''); setEmpAddSuccess(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddEmployee(); }}
              placeholder="employee@reflectionsinfos.com"
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
          <FormField
            label="Name"
            hint="Used by Performance Evaluations"
            className="flex-1 min-w-48"
          >
            <input
              type="text"
              value={newEmpName}
              onChange={(e) => { setNewEmpName(e.target.value); setEmpAddError(''); setEmpAddSuccess(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddEmployee(); }}
              placeholder="e.g., John Smith"
              className={INPUT_CLS}
            />
          </FormField>
          <Button
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
            onClick={handleAddEmployee}
            disabled={empAdding}
          >
            {empAdding ? 'Adding…' : 'Add Employee'}
          </Button>
        </Toolbar>

        {empAddError   && <div className="mb-4"><ErrorBanner message={empAddError} /></div>}
        {empAddSuccess && <p className="text-xs text-green-600 font-medium mb-4">{empAddSuccess}</p>}

        {/* Employee list */}
        {empLoading ? (
          <p className="text-xs text-slate-400 italic py-4 text-center">Loading employees…</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableHeadCell>Email</TableHeadCell>
                <TableHeadCell>Name</TableHeadCell>
                <TableHeadCell>Registered User</TableHeadCell>
                <TableHeadCell>Added</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </TableHead>
              <tbody>
                {employees.length === 0 ? (
                  <EmptyRow colSpan={5} message="No authorized employees configured." />
                ) : (
                  employees.map((emp) => {
                    const registeredUser = users.find((u) => u.email.toLowerCase() === emp.email.toLowerCase());
                    const isEditing  = editingEmpId === emp.id;
                    const isDeleting = deletingEmpId === emp.id;
                    const deleteErr  = empDeleteError[emp.id];
                    return (
                      <React.Fragment key={emp.id}>
                        <TableRow className="hover:bg-slate-50/50">
                          <TableCell className="font-mono text-slate-700">
                            {isEditing ? (
                              <input
                                type="email"
                                value={editEmpEmail}
                                onChange={(e) => { setEditEmpEmail(e.target.value); setEmpEditError(''); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditEmployee(); if (e.key === 'Escape') setEditingEmpId(null); }}
                                autoFocus
                                aria-label="Employee email"
                                className="w-full border border-blue-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                                {emp.email}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editEmpName}
                                onChange={(e) => { setEditEmpName(e.target.value); setEmpEditError(''); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditEmployee(); if (e.key === 'Escape') setEditingEmpId(null); }}
                                placeholder="e.g., John Smith"
                                aria-label="Employee name"
                                className="w-full border border-blue-300 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              />
                            ) : (
                              emp.name || <span className="text-slate-400 italic text-[10px]">No name set</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {registeredUser ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                                {registeredUser.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">Not registered</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-400 font-mono text-[10px]">
                            {new Date(emp.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {isEditing ? (
                                <>
                                  <Button
                                    variant="success"
                                    size="xs"
                                    icon={<CheckCircle className="w-3 h-3" aria-hidden="true" />}
                                    onClick={handleSaveEditEmployee}
                                    disabled={empEditSaving}
                                  >
                                    {empEditSaving ? 'Saving…' : 'Save'}
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="xs"
                                    icon={<XCircle className="w-3 h-3" aria-hidden="true" />}
                                    onClick={() => { setEditingEmpId(null); setEmpEditError(''); }}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <RowActionButton
                                    intent="edit"
                                    label={`Edit employee ${emp.email}`}
                                    icon={<Pencil className="w-3.5 h-3.5" />}
                                    onClick={() => handleStartEditEmployee(emp)}
                                  />
                                  <RowActionButton
                                    intent="delete"
                                    label={registeredUser ? 'Cannot delete — user has an account' : `Delete employee ${emp.email}`}
                                    icon={<Trash2 className="w-3.5 h-3.5" />}
                                    onClick={() => handleDeleteEmployee(emp.id)}
                                    disabled={isDeleting}
                                  />
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {(isEditing && empEditError) && (
                          <tr>
                            <td colSpan={5} className="pb-2">
                              <ErrorBanner message={empEditError} />
                            </td>
                          </tr>
                        )}
                        {deleteErr && (
                          <tr>
                            <td colSpan={5} className="pb-2">
                              <ErrorBanner message={deleteErr} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
      )}

      {/* ── Financial Year Management ── */}
      {activeTab === 'financial-years' && (
      <Card title="Financial Year Management" padding="cozy">
        <Toolbar>
          <FormField label="Start Year" className="w-32">
            <input
              type="number"
              value={newFYYear}
              onChange={(e) => { setNewFYYear(e.target.value); setFYError(''); setFYSuccess(''); }}
              placeholder={String(suggestedNext)}
              min={2000}
              max={2100}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
          <Button
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
            onClick={handleAddFY}
            disabled={fyLoading}
          >
            {fyLoading ? 'Creating…' : 'Add Financial Year'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setNewFYYear(String(suggestedNext)); setFYError(''); setFYSuccess(''); }}
          >
            Suggest Next
          </Button>
        </Toolbar>

        {fyError   && <div className="mb-4"><ErrorBanner message={fyError} /></div>}
        {fySuccess && <p className="text-xs text-green-600 font-medium mb-4">{fySuccess}</p>}

        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>Financial Year</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell>Start Date</TableHeadCell>
              <TableHeadCell>End Date</TableHeadCell>
              <TableHeadCell>Financial Calendar</TableHeadCell>
              <TableHeadCell>Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {financialYears.length === 0 ? (
                <EmptyRow colSpan={6} message="No financial years configured." />
              ) : (
                [...financialYears].sort((a, b) => b.startYear - a.startYear).map((fy) => {
                  const isActioning = fyActionId === fy.id;
                  return (
                    <React.Fragment key={fy.id}>
                    <TableRow className="hover:bg-slate-50/50">
                      <TableCell className="font-bold text-slate-800">FY {fy.fyLabel}</TableCell>
                      <TableCell>
                        <StatusBadge
                          value={fy.isActive ? 'ACTIVE' : 'INACTIVE'}
                          colorMap={FY_STATUS_COLORS}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-slate-600">{fy.startDate}</TableCell>
                      <TableCell className="font-mono text-slate-600">{fy.endDate}</TableCell>
                      <TableCell className="text-slate-500">
                        {fy.calendarQuarters.map((q) => (
                          <span key={q.label} className="mr-2 whitespace-nowrap">
                            <span className="font-semibold text-slate-700">{q.label}</span>{' '}
                            <span className="text-[10px]">{monthAbbr(q.startMonth)}–{monthAbbr(q.endMonth)}</span>
                          </span>
                        ))}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant={fy.isActive ? 'warning' : 'success'}
                            size="xs"
                            icon={fy.isActive
                              ? <XCircle className="w-3 h-3" aria-hidden="true" />
                              : <CheckCircle className="w-3 h-3" aria-hidden="true" />}
                            onClick={() => handleToggleActive(fy.id, fy.isActive)}
                            disabled={isActioning}
                            title={fy.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {fy.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <button
                            onClick={() => {
                              if (editingCalendarFYId === fy.id) {
                                setEditingCalendarFYId(null);
                              } else {
                                setEditingCalendarFYId(fy.id);
                                setEditCalStartMonth(fy.calendarStartMonth);
                                setCalendarEditError('');
                              }
                            }}
                            title="Change Calendar"
                            aria-pressed={editingCalendarFYId === fy.id}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                              editingCalendarFYId === fy.id
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                            }`}
                          >
                            <CalendarDays className="w-3 h-3" aria-hidden="true" /> Change Calendar
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {editingCalendarFYId === fy.id && (
                      <tr className="bg-indigo-50/40 border-b border-indigo-100">
                        <td colSpan={6} className="py-3 px-4">
                          <div className="flex flex-wrap items-end gap-4">
                            <FormField label={`FY Start Month — ${fy.fyLabel}`} className="min-w-44">
                              <select
                                value={editCalStartMonth}
                                onChange={(e) => setEditCalStartMonth(Number(e.target.value))}
                                className={SELECT_CLS}
                              >
                                {MONTH_NAMES.map((name, i) => (
                                  <option key={i + 1} value={i + 1}>{name}</option>
                                ))}
                              </select>
                            </FormField>
                            <div className="flex items-center gap-2 flex-wrap">
                              {deriveQuarters(editCalStartMonth).map((q) => (
                                <span key={q.label} className="px-2.5 py-1 bg-white rounded-lg text-xs font-semibold text-indigo-700 border border-indigo-200">
                                  {q.label}: {monthAbbr(q.startMonth)}–{monthAbbr(q.endMonth)}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 ml-auto">
                              {calendarEditError && <ErrorBanner message={calendarEditError} />}
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => setEditingCalendarFYId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="xs"
                                icon={calendarSaving
                                  ? <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                                  : <Settings2 className="w-3 h-3" aria-hidden="true" />}
                                onClick={() => handleSaveFYCalendar(fy.id)}
                                disabled={calendarSaving}
                              >
                                {calendarSaving ? 'Saving…' : 'Apply'}
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
      </Card>
      )}

      {/* ── Financial Calendar Configuration ── */}
      {activeTab === 'calendar' && (
      <Card
        title="Financial Calendar Configuration"
        subtitle={<>Define the start month of the financial year — quarter boundaries are derived automatically. Applies to <strong>new financial years only</strong>.</>}
        padding="cozy"
      >
        <Toolbar>
          <FormField label="FY Start Month" className="min-w-44">
            <select
              value={calStartMonth}
              onChange={(e) => { setCalStartMonth(Number(e.target.value)); setCalError(''); setCalSuccess(''); }}
              className={SELECT_CLS}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </FormField>

          <div className="flex items-center gap-2 flex-wrap">
            {previewQuarters.map((q) => (
              <span key={q.label} className="px-2.5 py-1 bg-indigo-50 rounded-lg text-xs font-semibold text-indigo-700 border border-indigo-100">
                {q.label}: {monthAbbr(q.startMonth)}–{monthAbbr(q.endMonth)}
              </span>
            ))}
          </div>
        </Toolbar>

        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>Quarter</TableHeadCell>
              <TableHeadCell>Start Month</TableHeadCell>
              <TableHeadCell>End Month</TableHeadCell>
              <TableHeadCell>Calendar Months</TableHeadCell>
            </TableHead>
            <tbody>
              {previewQuarters.map((q) => (
                <TableRow key={q.label}>
                  <TableCell className="font-bold text-slate-800">{q.label}</TableCell>
                  <TableCell className="text-slate-600">{monthName(q.startMonth)}</TableCell>
                  <TableCell className="text-slate-600">{monthName(q.endMonth)}</TableCell>
                  <TableCell className="text-slate-500">
                    {Array.from({ length: 3 }, (_, i) => {
                      const m = ((q.startMonth - 1 + i) % 12) + 1;
                      return monthAbbr(m);
                    }).join(', ')}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-5 mt-5 border-t border-slate-100">
          <Button
            size="sm"
            icon={calLoading
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              : <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />}
            onClick={handleSaveCalendar}
            disabled={calLoading}
          >
            {calLoading ? 'Saving…' : 'Save Calendar'}
          </Button>
          {calError   && <ErrorBanner message={calError} />}
          {calSuccess && <p className="text-xs text-green-600 font-medium">{calSuccess}</p>}
          {financialCalendar?.updatedAt && (
            <p className="text-[10px] text-slate-400 ml-auto">
              Last updated: {new Date(financialCalendar.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </Card>
      )}

      {/* ── Application Settings ── */}
      {activeTab === 'settings' && (
      <Card title="Application Settings" padding="cozy">
        <div className="flex flex-wrap items-end gap-4">
          <FormField
            label="Financial Years shown in global selector"
            hint="Controls how many financial years appear in the period selector in the application header."
            className="max-w-xs"
          >
            <input
              type="number"
              value={selectorCount}
              onChange={(e) => { setSelectorCount(e.target.value); setSettingsSuccess(''); }}
              min={1}
              max={20}
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
          <Button
            size="sm"
            onClick={handleSaveSettings}
            disabled={settingsSaving}
          >
            {settingsSaving ? 'Saving…' : 'Save Settings'}
          </Button>
          {settingsSuccess && <p className="text-xs text-green-600 font-medium">{settingsSuccess}</p>}
        </div>
      </Card>
      )}
    </div>
  );
};
