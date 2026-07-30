import React, { useState, useEffect, useCallback } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import {
  administrationApi, financialYearsApi, employeeMasterApi, rbacApi,
} from '@/api/crm.api';
import type { UserRbacAttrs } from '@/api/crm.api';
import type {
  AdminSystemOverview, AdminUser, FinancialCalendar, FYQuarterDef, EmployeeMaster, Role,
} from '@/types';
import {
  Users, BarChart3, Briefcase, FileText, Bell,
  Plus, CheckCircle, XCircle, Settings2,
  RefreshCw, CalendarDays,
  Pencil, Trash2, ShieldCheck, ShieldAlert,
  ClipboardList, SlidersHorizontal,
  KeyRound, Power, PowerOff, UserCog,
} from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyRow,
  ErrorBanner,
  FormField,
  FormGrid,
  FormModal,
  INPUT_CLS,
  PageHeader,
  RowActionButton,
  SearchableSelect,
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
import { showToast } from '@/components/common/ToastHost';
import { RolePermissionMatrix } from './RolePermissionMatrix';

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
  { id: 'roles', label: 'Roles & Permissions', icon: KeyRound },
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
  const { financialYears, financialCalendar, adminSettings, refreshData, refreshPermissions } = useCRM();

  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  // Roles (shared dropdown source for User + Employee Master forms)
  const [roles, setRoles] = useState<Role[]>([]);

  // User Management — edit / activate flows
  const [editingUser, setEditingUser]         = useState<AdminUser | null>(null);
  // Multi-role: a user may hold several roles at once. The first entry is treated
  // as the primary role server-side (JWT display claim).
  const [userRoleIds, setUserRoleIds]         = useState<string[]>([]);
  const [userDepartment, setUserDepartment]   = useState('');
  const [userDesignation, setUserDesignation] = useState('');
  const [userEmployeeId, setUserEmployeeId]   = useState('');
  const [userSaving, setUserSaving]           = useState(false);
  const [userError, setUserError]             = useState('');
  const [togglingUserId, setTogglingUserId]   = useState<string | null>(null);
  const [statusTarget, setStatusTarget]       = useState<AdminUser | null>(null);

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
  const [newEmpRoleId, setNewEmpRoleId]         = useState('');
  const [newEmpEmployeeId, setNewEmpEmployeeId] = useState('');
  const [newEmpDepartment, setNewEmpDepartment] = useState('');
  const [newEmpDesignation, setNewEmpDesignation] = useState('');
  const [empAddError, setEmpAddError]           = useState('');
  const [empAddSuccess, setEmpAddSuccess]       = useState('');
  const [empAdding, setEmpAdding]               = useState(false);
  const [editingEmpId, setEditingEmpId]         = useState<string | null>(null);
  const [editEmpEmail, setEditEmpEmail]         = useState('');
  const [editEmpName, setEditEmpName]           = useState('');
  const [editEmpRoleId, setEditEmpRoleId]       = useState('');
  const [editEmpEmployeeId, setEditEmpEmployeeId] = useState('');
  const [editEmpDepartment, setEditEmpDepartment] = useState('');
  const [editEmpDesignation, setEditEmpDesignation] = useState('');
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

  const loadRoles = useCallback(async () => {
    try {
      const data = await rbacApi.getRoles();
      setRoles(data);
    } catch { /* swallow — dropdowns simply show no options */ }
  }, []);

  useEffect(() => {
    loadOverview();
    loadUsers();
    loadEmployees();
    loadRoles();
  }, [loadOverview, loadUsers, loadEmployees, loadRoles]);

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));
  const roleNameById = (id?: string | null) => roles.find((r) => r.id === id)?.name ?? null;

  /** Comma-separated display of every role a user holds (falls back to primary). */
  const roleNamesFor = (u: AdminUser): string => {
    const ids = u.roleIds?.length ? u.roleIds : (u.roleId ? [u.roleId] : []);
    const names = ids.map((id) => roleNameById(id)).filter(Boolean) as string[];
    return names.join(', ') || u.roleName || u.role || '';
  };

  /** Toggle a role in the edit modal's multi-select selection. */
  const toggleUserRole = (roleId: string) => {
    setUserError('');
    setUserRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  };

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

  // ── User Management handlers ───────────────────────────────────────────────

  const handleStartEditUser = (u: AdminUser) => {
    setEditingUser(u);
    setUserRoleIds(u.roleIds?.length ? u.roleIds : (u.roleId ? [u.roleId] : []));
    setUserDepartment(u.department ?? '');
    setUserDesignation(u.designation ?? '');
    setUserEmployeeId(u.employeeId ?? '');
    setUserError('');
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUserSaving(true);
    setUserError('');
    try {
      const payload: UserRbacAttrs & { roleIds?: string[] } = {
        roleIds: userRoleIds,
        department: userDepartment.trim() || undefined,
        designation: userDesignation.trim() || undefined,
        employeeId: userEmployeeId.trim() || undefined,
      };
      await administrationApi.updateUser(editingUser.id, payload);
      setEditingUser(null);
      await loadUsers();
      // The edited user may be the current admin — refresh own permissions/menu.
      await refreshPermissions();
      showToast({ kind: 'success', message: 'User updated.' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setUserError(typeof msg === 'string' ? msg : 'Failed to update user.');
    } finally {
      setUserSaving(false);
    }
  };

  const handleToggleUserActive = async (u: AdminUser) => {
    setStatusTarget(null);
    setTogglingUserId(u.id);
    try {
      await administrationApi.updateUser(u.id, { isActive: !u.isActive });
      await loadUsers();
      await refreshPermissions();
      showToast({
        kind: 'success',
        message: `${u.name} ${u.isActive ? 'deactivated' : 'activated'}.`,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast({ kind: 'error', message: typeof msg === 'string' ? msg : 'Failed to update user status.' });
    } finally {
      setTogglingUserId(null);
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
      const attrs: UserRbacAttrs = {
        roleId: newEmpRoleId || undefined,
        employeeId: newEmpEmployeeId.trim() || undefined,
        department: newEmpDepartment.trim() || undefined,
        designation: newEmpDesignation.trim() || undefined,
      };
      await employeeMasterApi.create(email, newEmpName.trim(), attrs);
      setNewEmpEmail('');
      setNewEmpName('');
      setNewEmpRoleId('');
      setNewEmpEmployeeId('');
      setNewEmpDepartment('');
      setNewEmpDesignation('');
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
    setEditEmpRoleId(emp.roleId ?? '');
    setEditEmpEmployeeId(emp.employeeId ?? '');
    setEditEmpDepartment(emp.department ?? '');
    setEditEmpDesignation(emp.designation ?? '');
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
      const attrs: UserRbacAttrs = {
        roleId: editEmpRoleId || undefined,
        employeeId: editEmpEmployeeId.trim() || undefined,
        department: editEmpDepartment.trim() || undefined,
        designation: editEmpDesignation.trim() || undefined,
      };
      await employeeMasterApi.update(editingEmpId, email, editEmpName.trim(), attrs);
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
                <TableHeadCell>Employee ID</TableHeadCell>
                <TableHeadCell>Department</TableHeadCell>
                <TableHeadCell>Designation</TableHeadCell>
                <TableHeadCell>Role</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Security</TableHeadCell>
                <TableHeadCell>Created</TableHeadCell>
                <TableHeadCell>Last Login</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </TableHead>
              <tbody>
                {users.length === 0 ? (
                  <EmptyRow colSpan={11} message="No users found." />
                ) : (
                  users.map((u) => {
                    const isLocked = !!(u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now());
                    const isToggling = togglingUserId === u.id;
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
                      <TableCell className="text-slate-600 font-mono text-[11px]">
                        {u.employeeId || <span className="text-slate-400 italic">—</span>}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {u.department || <span className="text-slate-400 italic">—</span>}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {u.designation || <span className="text-slate-400 italic">—</span>}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {roleNamesFor(u) || <span className="text-slate-400 italic">—</span>}
                      </TableCell>
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
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <RowActionButton
                            intent="edit"
                            label={`Edit user ${u.name}`}
                            icon={<Pencil className="w-3.5 h-3.5" />}
                            onClick={() => handleStartEditUser(u)}
                          />
                          <RowActionButton
                            intent={u.isActive ? 'delete' : 'view'}
                            label={u.isActive ? `Deactivate ${u.name}` : `Activate ${u.name}`}
                            icon={u.isActive
                              ? <PowerOff className="w-3.5 h-3.5" />
                              : <Power className="w-3.5 h-3.5" />}
                            onClick={() => setStatusTarget(u)}
                            disabled={isToggling}
                          />
                        </div>
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

      {/* ── Roles & Permissions ── */}
      {activeTab === 'roles' && (
        <RolePermissionMatrix onPermissionsChanged={refreshPermissions} />
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
          <FormField label="Role"  className="min-w-44">
            <SearchableSelect
              value={newEmpRoleId}
              onChange={(v) => { setNewEmpRoleId(v); setEmpAddError(''); setEmpAddSuccess(''); }}
              options={roleOptions}
              placeholder="Select role…"
              aria-label="Pre-assigned role"
            />
          </FormField>
          <FormField label="Employee ID" className="min-w-32">
            <input
              type="text"
              value={newEmpEmployeeId}
              onChange={(e) => { setNewEmpEmployeeId(e.target.value); setEmpAddError(''); setEmpAddSuccess(''); }}
              placeholder="e.g., EMP-001"
              className={`${INPUT_CLS} font-mono`}
            />
          </FormField>
          <FormField label="Department" className="min-w-40">
            <input
              type="text"
              value={newEmpDepartment}
              onChange={(e) => { setNewEmpDepartment(e.target.value); setEmpAddError(''); setEmpAddSuccess(''); }}
              placeholder="e.g., Sales"
              className={INPUT_CLS}
            />
          </FormField>
          <FormField label="Designation" className="min-w-40">
            <input
              type="text"
              value={newEmpDesignation}
              onChange={(e) => { setNewEmpDesignation(e.target.value); setEmpAddError(''); setEmpAddSuccess(''); }}
              placeholder="e.g., Account Manager"
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
                <TableHeadCell>Role</TableHeadCell>
                <TableHeadCell>Registered User</TableHeadCell>
                <TableHeadCell>Added</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </TableHead>
              <tbody>
                {employees.length === 0 ? (
                  <EmptyRow colSpan={6} message="No authorized employees configured." />
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
                          <TableCell className="text-slate-600">
                            {roleNameById(emp.roleId) || <span className="text-slate-400 italic text-[10px]">Not set</span>}
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
                        {isEditing && (
                          <tr className="bg-indigo-50/40 border-b border-indigo-100">
                            <td colSpan={6} className="py-3 px-4">
                              <div className="flex flex-wrap items-end gap-3">
                                <FormField label="Role" className="min-w-44">
                                  <SearchableSelect
                                    value={editEmpRoleId}
                                    onChange={(v) => { setEditEmpRoleId(v); setEmpEditError(''); }}
                                    options={roleOptions}
                                    placeholder="Select role…"
                                    tone="amber"
                                    aria-label="Pre-assigned role"
                                  />
                                </FormField>
                                <FormField label="Employee ID" className="min-w-32">
                                  <input
                                    type="text"
                                    value={editEmpEmployeeId}
                                    onChange={(e) => { setEditEmpEmployeeId(e.target.value); setEmpEditError(''); }}
                                    placeholder="e.g., EMP-001"
                                    aria-label="Employee ID"
                                    className={`${INPUT_CLS} font-mono`}
                                  />
                                </FormField>
                                <FormField label="Department" className="min-w-40">
                                  <input
                                    type="text"
                                    value={editEmpDepartment}
                                    onChange={(e) => { setEditEmpDepartment(e.target.value); setEmpEditError(''); }}
                                    placeholder="e.g., Sales"
                                    aria-label="Department"
                                    className={INPUT_CLS}
                                  />
                                </FormField>
                                <FormField label="Designation" className="min-w-40">
                                  <input
                                    type="text"
                                    value={editEmpDesignation}
                                    onChange={(e) => { setEditEmpDesignation(e.target.value); setEmpEditError(''); }}
                                    placeholder="e.g., Account Manager"
                                    aria-label="Designation"
                                    className={INPUT_CLS}
                                  />
                                </FormField>
                              </div>
                            </td>
                          </tr>
                        )}
                        {(isEditing && empEditError) && (
                          <tr>
                            <td colSpan={6} className="pb-2">
                              <ErrorBanner message={empEditError} />
                            </td>
                          </tr>
                        )}
                        {deleteErr && (
                          <tr>
                            <td colSpan={6} className="pb-2">
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

      {/* ── User edit modal ── */}
      <FormModal
        isOpen={!!editingUser}
        title={editingUser ? `Edit ${editingUser.name}` : 'Edit User'}
        icon={<UserCog className="w-5 h-5 text-amber-500" aria-hidden="true" />}
        submitLabel="Save Changes"
        submitVariant="warning"
        isSubmitting={userSaving}
        onClose={() => setEditingUser(null)}
        onSubmit={handleSaveUser}
      >
        <div className="space-y-4">
          {userError && <ErrorBanner message={userError} />}
          <FormField label="Roles">
            {/* Multi-role: a user may hold several roles at once (e.g. Admin +
                Account Manager). The first selected role is the primary one. */}
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 max-h-56 overflow-y-auto">
              {roles.map((r) => {
                const checked = userRoleIds.includes(r.id);
                const isPrimary = checked && userRoleIds[0] === r.id;
                return (
                  <label
                    key={r.id}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-semibold cursor-pointer transition-colors ${
                      checked
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUserRole(r.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="truncate">{r.name}</span>
                    {isPrimary && (
                      <span className="ml-auto shrink-0 rounded bg-amber-200/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                        Primary
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Select one or more roles. The first selected role is used as the primary role.
            </p>
          </FormField>
          <FormGrid>
            <FormField label="Employee ID">
              <input
                type="text"
                value={userEmployeeId}
                onChange={(e) => { setUserEmployeeId(e.target.value); setUserError(''); }}
                placeholder="e.g., EMP-001"
                className={`${INPUT_CLS} font-mono`}
              />
            </FormField>
            <FormField label="Department">
              <input
                type="text"
                value={userDepartment}
                onChange={(e) => { setUserDepartment(e.target.value); setUserError(''); }}
                placeholder="e.g., Sales"
                className={INPUT_CLS}
              />
            </FormField>
            <FormField label="Designation">
              <input
                type="text"
                value={userDesignation}
                onChange={(e) => { setUserDesignation(e.target.value); setUserError(''); }}
                placeholder="e.g., Account Manager"
                className={INPUT_CLS}
              />
            </FormField>
          </FormGrid>
        </div>
      </FormModal>

      {/* ── Activate / deactivate confirmation ── */}
      <ConfirmDialog
        isOpen={!!statusTarget}
        title={statusTarget?.isActive ? 'Deactivate user' : 'Activate user'}
        tone={statusTarget?.isActive ? 'danger' : 'default'}
        confirmLabel={statusTarget?.isActive ? 'Deactivate' : 'Activate'}
        message={
          statusTarget
            ? (statusTarget.isActive
                ? <>Deactivate <strong>{statusTarget.name}</strong>? They will be unable to sign in until reactivated.</>
                : <>Activate <strong>{statusTarget.name}</strong>? They will regain access to the application.</>)
            : undefined
        }
        onConfirm={() => { if (statusTarget) return handleToggleUserActive(statusTarget); }}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  );
};
