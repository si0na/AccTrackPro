import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Lock, ChevronRight, ChevronDown, Plus, Pencil, Trash2, Save,
  RefreshCw, RotateCcw, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyRow,
  ErrorBanner,
  FormField,
  FormModal,
  INPUT_CLS,
  RowActionButton,
  SELECT_CLS,
  StatusBadge,
  Table,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '@/components/ui';
import { rbacApi } from '@/api/crm.api';
import type { PermissionMatrix, Role } from '@/types';
import { showToast } from '@/components/common/ToastHost';

type CellState = { isAllowed: boolean; isLocked: boolean };

const keyOf = (roleId: string, moduleKey: string, permissionKey: string) =>
  `${roleId}:${moduleKey}:${permissionKey}`;

function extractError(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return typeof msg === 'string' ? msg : fallback;
}

const ROLE_TYPE_COLORS: Record<string, string> = {
  System: 'bg-indigo-100 text-indigo-700 font-semibold',
  Custom: 'bg-slate-100 text-slate-600 font-semibold',
};

const SUPPORTED_PERMISSIONS: Record<string, string[]> = {
  dashboard:      ['view'],
  accounts:       ['view', 'view-all', 'create', 'update', 'delete', 'import', 'export'],
  opportunities:  ['view', 'view-all', 'create', 'update', 'delete', 'export'],
  'action-items': ['view', 'view-all', 'create', 'update', 'delete'],
  stakeholders:   ['view', 'view-all', 'create', 'update', 'delete'],
  projects:       ['view', 'view-all', 'create', 'update', 'delete'],
  sqa:            ['view', 'view-all', 'create', 'update', 'delete', 'export'],
  forecast:       ['view', 'export'],
  reports:        ['view', 'export'],
  performance:    ['view', 'create', 'update', 'delete'],
  'import-export':['view', 'import', 'export'],
  administration: ['view', 'create', 'update', 'delete', 'manage'],
};

const DISPLAY_PERMISSIONS = [
  { key: 'view', label: 'View' },
  { key: 'view-all', label: 'View All' },
  { key: 'create', label: 'Create' },
  { key: 'update', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'import', label: 'Import' },
  { key: 'export', label: 'Export' },
  { key: 'manage', label: 'Manage' },
];

interface RolePermissionMatrixProps {
  onPermissionsChanged: () => void;
}

export const RolePermissionMatrix: React.FC<RolePermissionMatrixProps> = ({ onPermissionsChanged }) => {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [cellMap, setCellMap] = useState<Record<string, CellState>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Selected Role for Permissions Configuration
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  // Save flow
  const [saving, setSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Roles management
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleScope, setRoleScope] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<Role | null>(null);

  const buildCellMap = useCallback((m: PermissionMatrix) => {
    const next: Record<string, CellState> = {};
    for (const c of m.cells) {
      next[keyOf(c.roleId, c.moduleKey, c.permissionKey)] = {
        isAllowed: c.isAllowed,
        isLocked: c.isLocked,
      };
    }
    return next;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [m, r] = await Promise.all([rbacApi.getMatrix(), rbacApi.getRoles()]);
      setMatrix(m);
      setRoles(r);
      setCellMap(buildCellMap(m));
      if (r.length > 0 && !selectedRoleId) {
        setSelectedRoleId(r[0].id);
      }
    } catch (err: unknown) {
      setLoadError(extractError(err, 'Failed to load the permission matrix.'));
    } finally {
      setLoading(false);
    }
  }, [buildCellMap, selectedRoleId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Selected role object
  const selectedRole = useMemo(() => {
    return roles.find((r) => r.id === selectedRoleId);
  }, [roles, selectedRoleId]);

  // Allowed permissions count for the selected role
  const allowedCount = useMemo(() => {
    if (!matrix || !selectedRoleId) return 0;
    let count = 0;
    for (const mod of matrix.modules) {
      const supported = SUPPORTED_PERMISSIONS[mod.key] ?? [];
      for (const p of matrix.permissions) {
        if (supported.includes(p.key)) {
          const k = keyOf(selectedRoleId, mod.key, p.key);
          if (cellMap[k]?.isAllowed) {
            count++;
          }
        }
      }
    }
    return count;
  }, [matrix, selectedRoleId, cellMap]);

  // ── Diff vs the loaded snapshot ─────────────────────────────────────────────
  const changes = useMemo(() => {
    if (!matrix) return [];
    const out: Array<{ roleId: string; moduleKey: string; permissionKey: string; isAllowed: boolean }> = [];
    for (const c of matrix.cells) {
      if (c.isLocked) continue;
      const cur = cellMap[keyOf(c.roleId, c.moduleKey, c.permissionKey)];
      if (cur && cur.isAllowed !== c.isAllowed) {
        out.push({
          roleId: c.roleId,
          moduleKey: c.moduleKey,
          permissionKey: c.permissionKey,
          isAllowed: cur.isAllowed,
        });
      }
    }
    return out;
  }, [matrix, cellMap]);

  const dirty = changes.length > 0;

  // ── Cell toggling ───────────────────────────────────────────────────────────
  const toggleCell = (roleId: string, moduleKey: string, permissionKey: string) => {
    const k = keyOf(roleId, moduleKey, permissionKey);
    setCellMap((prev) => {
      const cur = prev[k];
      if (!cur || cur.isLocked) return prev;
      return { ...prev, [k]: { ...cur, isAllowed: !cur.isAllowed } };
    });
  };

  const handleReset = () => {
    if (matrix) setCellMap(buildCellMap(matrix));
  };

  const handleSave = async () => {
    setShowSaveConfirm(false);
    setSaving(true);
    try {
      const res = await rbacApi.saveMatrix(changes);
      showToast({ kind: 'success', message: `Applied ${res.updated} permission change(s).` });
      await loadAll();
      onPermissionsChanged();
    } catch (err: unknown) {
      showToast({ kind: 'error', message: extractError(err, 'Failed to save permission changes.') });
    } finally {
      setSaving(false);
    }
  };

  // ── Roles management ────────────────────────────────────────────────────────
  const openCreateRole = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDesc('');
    setRoleScope('');
    setRoleError('');
    setRoleModalOpen(true);
  };

  // Editing is limited to the description — name, type and scope stay fixed.
  const openEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description ?? '');
    setRoleScope(role.accountScopeField ?? '');
    setRoleError('');
    setRoleModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = roleName.trim();
    if (!editingRole && !name) {
      setRoleError('Role name is required.');
      return;
    }
    setRoleSaving(true);
    setRoleError('');
    try {
      if (editingRole) {
        await rbacApi.updateRole(editingRole.id, { description: roleDesc.trim() });
        showToast({ kind: 'success', message: 'Role description updated.' });
      } else {
        await rbacApi.createRole({
          name,
          description: roleDesc.trim() || undefined,
          accountScopeField: roleScope.trim() || null,
        });
        showToast({ kind: 'success', message: 'Role created.' });
      }
      setRoleModalOpen(false);
      await loadAll();
      onPermissionsChanged();
    } catch (err: unknown) {
      setRoleError(extractError(err, 'Failed to save the role.'));
    } finally {
      setRoleSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    try {
      await rbacApi.deleteRole(deleteRoleTarget.id);
      showToast({ kind: 'success', message: `Role "${deleteRoleTarget.name}" deleted.` });
      if (selectedRoleId === deleteRoleTarget.id) {
        setSelectedRoleId('');
      }
      setDeleteRoleTarget(null);
      await loadAll();
      onPermissionsChanged();
    } catch (err: unknown) {
      showToast({ kind: 'error', message: extractError(err, 'Cannot delete this role.') });
      setDeleteRoleTarget(null);
    }
  };

  if (loading) {
    return <p className="text-xs text-slate-400 italic py-6 text-center">Loading permission matrix…</p>;
  }

  if (loadError || !matrix) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={loadError || 'Permission matrix unavailable.'} />
        <Button size="sm" variant="secondary" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={loadAll}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Roles Management Card ── */}
      <Card
        title="Roles Configuration"
        subtitle="Manage custom roles and view system roles. System roles are protected and cannot be edited or deleted."
        actions={
          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />} onClick={openCreateRole}>
            Add Role
          </Button>
        }
        padding="cozy"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>Role Name</TableHeadCell>
              <TableHeadCell>Description</TableHeadCell>
              <TableHeadCell>Type</TableHeadCell>
              <TableHeadCell>Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {roles.length === 0 ? (
                <EmptyRow colSpan={4} message="No roles configured." />
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-semibold text-slate-800">
                      {role.name}
                    </TableCell>
                    <TableCell className="text-slate-600 text-xs">
                      {role.description || <span className="text-slate-400 italic">—</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        value={role.isSystem ? 'System' : 'Custom'}
                        colorMap={ROLE_TYPE_COLORS}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <RowActionButton
                          intent="edit"
                          label={`Edit description of role ${role.name}`}
                          icon={<Pencil className="w-3.5 h-3.5" />}
                          onClick={() => openEditRole(role)}
                        />
                        {role.isSystem ? (
                          <span className="text-[10px] text-slate-400 italic">Protected</span>
                        ) : (
                          <RowActionButton
                            intent="delete"
                            label={`Delete role ${role.name}`}
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            onClick={() => setDeleteRoleTarget(role)}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      {/* ── 2. Roles Selector Cards & Permissions Grid ── */}
      <Card
        title="Permissions Matrix"
        subtitle="Manage allowed actions for each role. Select a role below to configure its permissions."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={handleReset}
              disabled={!dirty || saving}
            >
              Reset Changes
            </Button>
            <Button
              size="sm"
              icon={saving
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                : <Save className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={() => setShowSaveConfirm(true)}
              disabled={!dirty || saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        }
        padding="cozy"
      >
        {/* Roles Selectable Cards Section */}
        <div className="mb-6">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 block">
            Select Role to Configure
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {roles.map((r) => {
              const isSelected = r.id === selectedRoleId;
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden h-28 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/10'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-xs text-slate-800 mb-1 line-clamp-1">{r.name}</span>
                  <span className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed flex-grow">
                    {r.description || 'No description provided.'}
                  </span>
                  <div className="mt-auto flex items-center justify-between w-full pt-1.5">
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      r.isSystem ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {r.isSystem ? 'System' : 'Custom'}
                    </span>
                    {isSelected && (
                      <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Role Summary header and Matrix */}
        {selectedRole ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-50/60 border border-indigo-100 text-xs font-semibold text-indigo-900">
              <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Active Role:</span>
              <span className="font-bold">{selectedRole.name}</span>
              <span className="mx-1 text-slate-300">|</span>
              <span className="text-[11px] font-mono text-slate-500">
                {matrix.modules.length} Modules &amp; {allowedCount} Active Permissions
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <Table>
                <TableHead>
                  <TableHeadCell>Module</TableHeadCell>
                  {DISPLAY_PERMISSIONS.map((p) => (
                    <TableHeadCell key={p.key} className="text-center">
                      <span className="whitespace-nowrap">{p.label}</span>
                    </TableHeadCell>
                  ))}
                </TableHead>
                <tbody>
                  {matrix.modules.map((mod) => {
                    const supported = SUPPORTED_PERMISSIONS[mod.key] ?? [];
                    return (
                      <TableRow key={mod.key} className="hover:bg-slate-50/40">
                        <TableCell className="font-bold text-slate-800 uppercase tracking-wide text-xs">
                          {mod.name}
                        </TableCell>
                        {DISPLAY_PERMISSIONS.map((p) => {
                          const isSupported = supported.includes(p.key);
                          const k = keyOf(selectedRoleId, mod.key, p.key);
                          const cell = cellMap[k];
                          const isAllowed = cell?.isAllowed ?? false;
                          const isLocked = cell?.isLocked ?? false;

                          return (
                            <TableCell key={p.key} className="text-center py-3">
                              {isSupported ? (
                                <div className="inline-flex items-center justify-center">
                                  <label className="relative flex items-center p-1 rounded-full cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isAllowed}
                                      disabled={isLocked}
                                      onChange={() => toggleCell(selectedRoleId, mod.key, p.key)}
                                      title={isLocked ? 'Locked by system business rules' : `Allow ${p.label} on ${mod.name}`}
                                      className={`w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer ${
                                        isLocked ? 'cursor-not-allowed opacity-50' : ''
                                      }`}
                                    />
                                  </label>
                                  {isLocked && (
                                    <Lock className="w-2.5 h-2.5 text-slate-400 absolute translate-x-2.5 -translate-y-2" />
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300 font-medium">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Please select a role card above to configure permissions.
          </p>
        )}
      </Card>

      {/* Role creation & edit modal */}
      <FormModal
        isOpen={roleModalOpen}
        title={editingRole ? `Edit ${editingRole.name} Description` : 'Create Custom Role'}
        submitLabel={editingRole ? 'Save Changes' : 'Create Role'}
        submitVariant={editingRole ? 'warning' : 'primary'}
        isSubmitting={roleSaving}
        onClose={() => setRoleModalOpen(false)}
        onSubmit={handleSaveRole}
      >
        <div className="space-y-4">
          {roleError && <ErrorBanner message={roleError} />}
          <FormField label="Role Name *" required={!editingRole}>
            {editingRole ? (
              <p className="text-xs font-semibold text-slate-700 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                {editingRole.name}
              </p>
            ) : (
              <input
                type="text"
                required
                value={roleName}
                onChange={(e) => { setRoleName(e.target.value); setRoleError(''); }}
                placeholder="e.g., Vertical Head"
                className={INPUT_CLS}
              />
            )}
          </FormField>
          <FormField label="Description">
            <textarea
              value={roleDesc}
              onChange={(e) => { setRoleDesc(e.target.value); setRoleError(''); }}
              placeholder="Explain the responsibilities of this role…"
              className={`${INPUT_CLS} min-h-20 py-2`}
            />
          </FormField>
          {!editingRole && (
            <FormField label="Account Scope Field" hint="Restricts account visibility to rows where this field matches the user's ID.">
              <select
                value={roleScope}
                onChange={(e) => { setRoleScope(e.target.value); setRoleError(''); }}
                className={SELECT_CLS}
              >
                <option value="">(None - Unscoped/Global)</option>
                <option value="account_manager_id">account_manager_id (Account Manager)</option>
                <option value="practice_lead_id">practice_lead_id (Practice Lead)</option>
                <option value="client_partner_id">client_partner_id (Client Partner)</option>
                <option value="vertical_head_id">vertical_head_id (Vertical Head)</option>
              </select>
            </FormField>
          )}
        </div>
      </FormModal>

      {/* Save permissions matrix confirmation dialog */}
      <ConfirmDialog
        isOpen={showSaveConfirm}
        title="Save Permission Changes"
        confirmLabel="Save"
        tone="default"
        message={
          <>
            Are you sure you want to save the <strong>{changes.length}</strong> permission modification(s)?
            This will take effect immediately for all users with the affected roles.
          </>
        }
        onConfirm={handleSave}
        onCancel={() => setShowSaveConfirm(false)}
      />

      {/* Delete custom role confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteRoleTarget}
        title="Delete Custom Role"
        tone="danger"
        confirmLabel="Delete"
        message={
          deleteRoleTarget ? (
            <>
              Delete custom role <strong>{deleteRoleTarget.name}</strong>?
              All users currently assigned to this role will lose their associated permissions.
            </>
          ) : undefined
        }
        onConfirm={handleDeleteRole}
        onCancel={() => setDeleteRoleTarget(null)}
      />
    </div>
  );
};
