import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Lock, ChevronRight, ChevronDown, Plus, Pencil, Trash2, Save,
  RefreshCw, RotateCcw, ShieldCheck,
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
  SearchBar,
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
  System: 'bg-indigo-100 text-indigo-700',
  Custom: 'bg-slate-100 text-slate-600',
};

interface RolePermissionMatrixProps {
  /** Called after any change that could affect the current admin's own permissions. */
  onPermissionsChanged: () => void;
}

export const RolePermissionMatrix: React.FC<RolePermissionMatrixProps> = ({ onPermissionsChanged }) => {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [cellMap, setCellMap] = useState<Record<string, CellState>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Controls
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Save flow
  const [saving, setSaving] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Roles management
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
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
      // Expand all modules by default so the grid is immediately usable.
      setExpanded(Object.fromEntries(m.modules.map((mod) => [mod.key, true])));
    } catch (err: unknown) {
      setLoadError(extractError(err, 'Failed to load the permission matrix.'));
    } finally {
      setLoading(false);
    }
  }, [buildCellMap]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Derived: which roles / modules / permissions are visible ────────────────
  const visibleRoles = useMemo(() => {
    if (!matrix) return [];
    return roleFilter === 'ALL' ? matrix.roles : matrix.roles.filter((r) => r.id === roleFilter);
  }, [matrix, roleFilter]);

  const searchLc = search.trim().toLowerCase();

  const visibleModules = useMemo(() => {
    if (!matrix) return [];
    let mods = matrix.modules;
    if (moduleFilter !== 'ALL') mods = mods.filter((m) => m.key === moduleFilter);
    if (searchLc) {
      mods = mods.filter((m) => {
        const moduleMatches = m.name.toLowerCase().includes(searchLc);
        const anyPermMatches = matrix.permissions.some((p) => p.name.toLowerCase().includes(searchLc));
        return moduleMatches || anyPermMatches;
      });
    }
    return [...mods].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [matrix, moduleFilter, searchLc]);

  const sortedPermissions = useMemo(
    () => (matrix ? [...matrix.permissions].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [matrix],
  );

  const permissionsForModule = useCallback(
    (moduleName: string) => {
      if (!searchLc) return sortedPermissions;
      const moduleMatches = moduleName.toLowerCase().includes(searchLc);
      if (moduleMatches) return sortedPermissions;
      return sortedPermissions.filter((p) => p.name.toLowerCase().includes(searchLc));
    },
    [searchLc, sortedPermissions],
  );

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

  /** Toggle a whole permission row across all NON-LOCKED visible roles. */
  const togglePermissionRow = (moduleKey: string, permissionKey: string) => {
    setCellMap((prev) => {
      const editable = visibleRoles
        .map((r) => keyOf(r.id, moduleKey, permissionKey))
        .filter((k) => prev[k] && !prev[k].isLocked);
      if (editable.length === 0) return prev;
      const allOn = editable.every((k) => prev[k].isAllowed);
      const target = !allOn;
      const next = { ...prev };
      for (const k of editable) next[k] = { ...next[k], isAllowed: target };
      return next;
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
    setRoleError('');
    setRoleModalOpen(true);
  };

  const openEditRole = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description ?? '');
    setRoleError('');
    setRoleModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = roleName.trim();
    if (!name) {
      setRoleError('Role name is required.');
      return;
    }
    setRoleSaving(true);
    setRoleError('');
    try {
      if (editingRole) {
        await rbacApi.updateRole(editingRole.id, { name, description: roleDesc.trim() });
        showToast({ kind: 'success', message: 'Role updated.' });
      } else {
        await rbacApi.createRole({ name, description: roleDesc.trim() || undefined });
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
      setDeleteRoleTarget(null);
      await loadAll();
      onPermissionsChanged();
    } catch (err: unknown) {
      showToast({ kind: 'error', message: extractError(err, 'Cannot delete this role.') });
      setDeleteRoleTarget(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
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

  const leftColSpan = 2;
  const totalCols = leftColSpan + visibleRoles.length;

  return (
    <div className="space-y-6">
      {/* ── Roles management ── */}
      <Card
        title="Roles"
        subtitle="System roles are protected — they cannot be renamed or deleted. Create custom roles to fit your organisation."
        actions={
          <Button size="xs" icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />} onClick={openCreateRole}>
            Create Role
          </Button>
        }
        padding="cozy"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>Role</TableHeadCell>
              <TableHeadCell>Description</TableHeadCell>
              <TableHeadCell>Type</TableHeadCell>
              <TableHeadCell>Account Scope</TableHeadCell>
              <TableHeadCell>Actions</TableHeadCell>
            </TableHead>
            <tbody>
              {roles.length === 0 ? (
                <EmptyRow colSpan={5} message="No roles configured." />
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        {role.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {role.description || <span className="text-slate-400 italic text-[10px]">No description</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={role.isSystem ? 'System' : 'Custom'} colorMap={ROLE_TYPE_COLORS} />
                    </TableCell>
                    <TableCell className="text-slate-500 font-mono text-[11px]">
                      {role.accountScopeField || <span className="text-slate-400 italic">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <RowActionButton
                          intent="edit"
                          label={role.isSystem ? 'System roles cannot be edited' : `Edit role ${role.name}`}
                          icon={<Pencil className="w-3.5 h-3.5" />}
                          onClick={() => openEditRole(role)}
                          disabled={role.isSystem}
                        />
                        <RowActionButton
                          intent="delete"
                          label={role.isSystem ? 'System roles cannot be deleted' : `Delete role ${role.name}`}
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={() => setDeleteRoleTarget(role)}
                          disabled={role.isSystem}
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

      {/* ── Permission matrix ── */}
      <Card
        title="Permission Matrix"
        subtitle="Toggle module/permission access per role. Cells locked by a business rule cannot be changed."
        actions={
          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold font-mono">
            {dirty ? `${changes.length} UNSAVED` : 'NO CHANGES'}
          </span>
        }
        padding="cozy"
      >
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 pb-5 mb-5 border-b border-slate-100">
          <div className="flex-1 min-w-56">
            <FormField label="Search">
              <SearchBar value={search} onChange={setSearch} placeholder="Filter by module or permission…" />
            </FormField>
          </div>
          <FormField label="Module" className="min-w-44">
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="ALL">All Modules</option>
              {[...matrix.modules].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => (
                <option key={m.key} value={m.key}>{m.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Role" className="min-w-44">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="ALL">All Roles</option>
              {matrix.roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </FormField>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />}
              onClick={handleReset}
              disabled={!dirty || saving}
            >
              Reset changes
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
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableHeadCell>Module</TableHeadCell>
              <TableHeadCell>Permission</TableHeadCell>
              {visibleRoles.map((r) => (
                <TableHeadCell key={r.id}>
                  <span className="whitespace-nowrap">{r.name}</span>
                </TableHeadCell>
              ))}
            </TableHead>
            <tbody>
              {visibleModules.length === 0 ? (
                <EmptyRow colSpan={totalCols} message="No modules match the current filters." />
              ) : (
                visibleModules.map((mod) => {
                  const isExpanded = expanded[mod.key] !== false;
                  const perms = permissionsForModule(mod.name);
                  return (
                    <React.Fragment key={mod.key}>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <td colSpan={totalCols} className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => setExpanded((prev) => ({ ...prev, [mod.key]: !isExpanded }))}
                            aria-expanded={isExpanded}
                            className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
                          >
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4" aria-hidden="true" />
                              : <ChevronRight className="w-4 h-4" aria-hidden="true" />}
                            <span className="uppercase tracking-wider">{mod.name}</span>
                            <span className="text-[10px] font-mono font-medium text-slate-400">
                              {perms.length} permission{perms.length === 1 ? '' : 's'}
                            </span>
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (perms.length === 0 ? (
                        <tr>
                          <td colSpan={totalCols} className="py-2 px-4 text-[11px] text-slate-400 italic">
                            No permissions match the search.
                          </td>
                        </tr>
                      ) : (
                        perms.map((perm) => (
                          <TableRow key={`${mod.key}:${perm.key}`} className="hover:bg-slate-50/50">
                            <TableCell className="text-slate-400 text-[11px]" />
                            <TableCell className="text-slate-700">
                              <div className="flex items-center gap-2">
                                <span>{perm.name}</span>
                                <button
                                  type="button"
                                  onClick={() => togglePermissionRow(mod.key, perm.key)}
                                  title="Toggle this permission for all unlocked roles"
                                  className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 hover:underline cursor-pointer"
                                >
                                  toggle all
                                </button>
                              </div>
                            </TableCell>
                            {visibleRoles.map((role) => {
                              const k = keyOf(role.id, mod.key, perm.key);
                              const cell = cellMap[k];
                              const isAllowed = cell?.isAllowed ?? false;
                              const isLocked = cell?.isLocked ?? false;
                              return (
                                <TableCell key={role.id} className="text-center">
                                  {isLocked ? (
                                    <span
                                      className="inline-flex items-center justify-center gap-1 text-slate-400"
                                      title="Locked by business rule"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isAllowed}
                                        disabled
                                        aria-label={`${role.name} — ${mod.name} ${perm.name} (locked)`}
                                        className="w-4 h-4 rounded border-slate-300 cursor-not-allowed opacity-60"
                                      />
                                      <Lock className="w-3 h-3" aria-hidden="true" />
                                    </span>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={isAllowed}
                                      onChange={() => toggleCell(role.id, mod.key, perm.key)}
                                      aria-label={`${role.name} — ${mod.name} ${perm.name}`}
                                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                                    />
                                  )}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
      </Card>

      {/* ── Save confirmation ── */}
      <ConfirmDialog
        isOpen={showSaveConfirm}
        title="Apply permission changes"
        tone="default"
        confirmLabel="Apply"
        message={`Apply ${changes.length} permission change(s)? This updates access immediately for the affected roles.`}
        onConfirm={handleSave}
        onCancel={() => setShowSaveConfirm(false)}
      />

      {/* ── Role create / edit ── */}
      <FormModal
        isOpen={roleModalOpen}
        title={editingRole ? 'Edit Role' : 'Create Role'}
        icon={<ShieldCheck className="w-5 h-5 text-blue-500" aria-hidden="true" />}
        submitLabel={editingRole ? 'Save Role' : 'Create Role'}
        submitVariant={editingRole ? 'warning' : 'primary'}
        isSubmitting={roleSaving}
        onClose={() => setRoleModalOpen(false)}
        onSubmit={handleSaveRole}
      >
        <div className="space-y-4">
          {roleError && <ErrorBanner message={roleError} />}
          <FormField label="Role Name" required>
            <input
              type="text"
              value={roleName}
              onChange={(e) => { setRoleName(e.target.value); setRoleError(''); }}
              placeholder="e.g., Regional Manager"
              className={INPUT_CLS}
              autoFocus
            />
          </FormField>
          <FormField label="Description" hint="Optional — shown in the roles list.">
            <textarea
              value={roleDesc}
              onChange={(e) => setRoleDesc(e.target.value)}
              placeholder="What this role is for…"
              rows={3}
              className={`${INPUT_CLS} resize-none`}
            />
          </FormField>
        </div>
      </FormModal>

      {/* ── Delete role confirmation ── */}
      <ConfirmDialog
        isOpen={!!deleteRoleTarget}
        title="Delete role"
        confirmLabel="Delete"
        message={
          <>Delete role <strong>{deleteRoleTarget?.name}</strong>? This cannot be undone. Roles assigned to users or system roles cannot be deleted.</>
        }
        onConfirm={handleDeleteRole}
        onCancel={() => setDeleteRoleTarget(null)}
      />
    </div>
  );
};
