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
  Pencil, Trash2, ShieldCheck,
} from 'lucide-react';
import {
  Button,
  EmptyRow,
  ErrorBanner,
  FormField,
  INPUT_CLS,
  PageHeader,
  RowActionButton,
  SELECT_CLS,
  StatusBadge,
} from '@/components/ui';

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
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-slate-800 leading-tight">
        {value === null ? '—' : value.toLocaleString()}
      </p>
    </div>
  </div>
);

// ─── Section wrapper ──────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
      {title}
    </h4>
    {children}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const AdministrationPage: React.FC = () => {
  const { financialYears, financialCalendar, adminSettings, refreshData } = useCRM();

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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
          label="Total Users"
          value={overviewLoading ? null : (overview?.totalUsers ?? 0)}
          color="bg-indigo-50"
        />
        <StatCard
          icon={<Briefcase className="w-5 h-5 text-blue-600" aria-hidden="true" />}
          label="Accounts"
          value={overviewLoading ? null : (overview?.totalAccounts ?? 0)}
          color="bg-blue-50"
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5 text-emerald-600" aria-hidden="true" />}
          label="Opportunities"
          value={overviewLoading ? null : (overview?.totalOpportunities ?? 0)}
          color="bg-emerald-50"
        />
        <StatCard
          icon={<FileText className="w-5 h-5 text-amber-600" aria-hidden="true" />}
          label="Documents"
          value={overviewLoading ? null : (overview?.totalDocuments ?? 0)}
          color="bg-amber-50"
        />
        <StatCard
          icon={<Bell className="w-5 h-5 text-rose-600" aria-hidden="true" />}
          label="Notifications"
          value={overviewLoading ? null : (overview?.totalNotifications ?? 0)}
          color="bg-rose-50"
        />
      </div>

      {/* ── 2. User Management ── */}
      <Section title="User Management">
        {usersLoading ? (
          <p className="text-xs text-slate-400 italic py-4 text-center">Loading users…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2 text-left">Name</th>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Role</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-left">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <EmptyRow colSpan={5} message="No users found." />
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="py-2.5 font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0"
                            aria-hidden="true"
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          {u.name}
                        </div>
                      </td>
                      <td className="py-2.5 text-slate-500 font-mono">{u.email}</td>
                      <td className="py-2.5 text-slate-600">{u.role}</td>
                      <td className="py-2.5">
                        <StatusBadge
                          value={u.isActive ? 'Active' : 'Inactive'}
                          colorMap={USER_STATUS_COLORS}
                        />
                      </td>
                      <td className="py-2.5 text-slate-400 font-mono">
                        {u.lastLogin
                          ? new Date(u.lastLogin).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : <span className="italic">Never</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── 2b. Employee Master ── */}
      <Section title="Employee Master">
        <p className="text-xs text-slate-500">
          Only employees listed here are authorized to create an account. Deleting an entry is blocked if the employee has already registered.
        </p>

        {/* Add employee row */}
        <div className="flex flex-wrap items-end gap-3">
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
        </div>

        {empAddError   && <ErrorBanner message={empAddError} />}
        {empAddSuccess && <p className="text-xs text-green-600 font-medium">{empAddSuccess}</p>}

        {/* Employee list */}
        {empLoading ? (
          <p className="text-xs text-slate-400 italic py-4 text-center">Loading employees…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Name</th>
                  <th className="py-2 text-left">Registered User</th>
                  <th className="py-2 text-left">Added</th>
                  <th className="py-2 text-left">Actions</th>
                </tr>
              </thead>
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
                        <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="py-2.5 font-mono text-slate-700">
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
                          </td>
                          <td className="py-2.5 text-slate-700">
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
                          </td>
                          <td className="py-2.5">
                            {registeredUser ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                                {registeredUser.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">Not registered</span>
                            )}
                          </td>
                          <td className="py-2.5 text-slate-400 font-mono text-[10px]">
                            {new Date(emp.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-2.5">
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
                          </td>
                        </tr>
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
            </table>
          </div>
        )}
      </Section>

      {/* ── 3. Financial Year Management ── */}
      <Section title="Financial Year Management">
        {/* Add FY row */}
        <div className="flex flex-wrap items-end gap-3">
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
        </div>

        {fyError   && <ErrorBanner message={fyError} />}
        {fySuccess && <p className="text-xs text-green-600 font-medium">{fySuccess}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2 text-left">Financial Year</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-left">Start Date</th>
                <th className="py-2 text-left">End Date</th>
                <th className="py-2 text-left">Financial Calendar</th>
                <th className="py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {financialYears.length === 0 ? (
                <EmptyRow colSpan={6} message="No financial years configured." />
              ) : (
                [...financialYears].sort((a, b) => b.startYear - a.startYear).map((fy) => {
                  const isActioning = fyActionId === fy.id;
                  return (
                    <React.Fragment key={fy.id}>
                    <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="py-2.5 font-bold text-slate-800">FY {fy.fyLabel}</td>
                      <td className="py-2.5">
                        <StatusBadge
                          value={fy.isActive ? 'ACTIVE' : 'INACTIVE'}
                          colorMap={FY_STATUS_COLORS}
                        />
                      </td>
                      <td className="py-2.5 font-mono text-slate-600">{fy.startDate}</td>
                      <td className="py-2.5 font-mono text-slate-600">{fy.endDate}</td>
                      <td className="py-2.5 text-slate-500">
                        {fy.calendarQuarters.map((q) => (
                          <span key={q.label} className="mr-2 whitespace-nowrap">
                            <span className="font-semibold text-slate-700">{q.label}</span>{' '}
                            <span className="text-[10px]">{monthAbbr(q.startMonth)}–{monthAbbr(q.endMonth)}</span>
                          </span>
                        ))}
                      </td>
                      <td className="py-2.5">
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
                      </td>
                    </tr>
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
          </table>
        </div>
      </Section>

      {/* ── 4. Financial Calendar Configuration ── */}
      <Section title="Financial Calendar Configuration">
        <p className="text-xs text-slate-500">
          Define the start month of the financial year. Quarter boundaries are automatically derived as equal 3-month periods.
          Changes apply to <strong>new financial years only</strong>; existing records retain their current FY assignments.
        </p>

        <div className="flex flex-wrap items-end gap-6">
          {/* Start Month */}
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

          {/* Preview */}
          <div className="flex items-center gap-2 flex-wrap">
            {previewQuarters.map((q) => (
              <span key={q.label} className="px-2.5 py-1 bg-indigo-50 rounded-lg text-xs font-semibold text-indigo-700 border border-indigo-100">
                {q.label}: {monthAbbr(q.startMonth)}–{monthAbbr(q.endMonth)}
              </span>
            ))}
          </div>
        </div>

        {/* Quarter detail table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-1.5 text-left">Quarter</th>
                <th className="py-1.5 text-left">Start Month</th>
                <th className="py-1.5 text-left">End Month</th>
                <th className="py-1.5 text-left">Calendar Months</th>
              </tr>
            </thead>
            <tbody>
              {previewQuarters.map((q) => (
                <tr key={q.label} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 font-bold text-slate-800">{q.label}</td>
                  <td className="py-2 text-slate-600">{monthName(q.startMonth)}</td>
                  <td className="py-2 text-slate-600">{monthName(q.endMonth)}</td>
                  <td className="py-2 text-slate-500">
                    {Array.from({ length: 3 }, (_, i) => {
                      const m = ((q.startMonth - 1 + i) % 12) + 1;
                      return monthAbbr(m);
                    }).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
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
        </div>

        {financialCalendar?.updatedAt && (
          <p className="text-[10px] text-slate-400">
            Last updated: {new Date(financialCalendar.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </Section>

      {/* ── 5. Application Settings ── */}
      <Section title="Application Settings">
        <div className="space-y-4">
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
        </div>
      </Section>
    </div>
  );
};
