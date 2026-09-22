import React, { useState } from 'react';
import { Plus, Edit2, Trash2, CheckSquare, Eye, X, Calendar } from 'lucide-react';
import { AccountGrowthActionPlan } from '@/types';
import { Modal, ModalFooter, Button, ConfirmDialog } from '@/components/ui';

interface ActionPlanGeneralTabProps {
  accountId: string;
  financialYearId: string;
  actionPlans: AccountGrowthActionPlan[];
  canEdit: boolean;
  onSaveActionPlan: (data: Partial<AccountGrowthActionPlan>) => Promise<void>;
  onDeleteActionPlan: (id: string) => Promise<void>;
}

export const ActionPlanGeneralTab: React.FC<ActionPlanGeneralTabProps> = ({
  accountId,
  financialYearId,
  actionPlans,
  canEdit,
  onSaveActionPlan,
  onDeleteActionPlan,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AccountGrowthActionPlan | null>(null);
  const [form, setForm] = useState<Partial<AccountGrowthActionPlan>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [drawerItem, setDrawerItem] = useState<AccountGrowthActionPlan | null>(null);
  const [saving, setSaving] = useState(false);

  const [modalError, setModalError] = useState<string | null>(null);

  const handleOpenModal = (item?: AccountGrowthActionPlan) => {
    setModalError(null);
    if (item) {
      setEditingItem(item);
      setForm({
        ...item,
        targetDate: item.targetDate ? item.targetDate.substring(0, 10) : '',
      });
    } else {
      setEditingItem(null);
      setForm({
        accountId,
        financialYearId,
        category: '',
        actionPlanned: '',
        ourApproach: '',
        timeline: '',
        expectedOutcome: '',
        targetDate: '',
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const payload: Partial<AccountGrowthActionPlan> = {
      ...form,
      id: editingItem?.id,
      accountId,
      financialYearId,
      targetDate: form.targetDate && form.targetDate.trim() !== '' ? form.targetDate : undefined,
      ourApproach: form.ourApproach && form.ourApproach.trim() !== '' ? form.ourApproach : undefined,
      timeline: form.timeline && form.timeline.trim() !== '' ? form.timeline : undefined,
      expectedOutcome: form.expectedOutcome && form.expectedOutcome.trim() !== '' ? form.expectedOutcome : undefined,
    };

    try {
      setSaving(true);
      await onSaveActionPlan(payload);
      setModalOpen(false);
    } catch (err: any) {
      console.error('[ActionPlanGeneralTab] Save error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to save Action Plan.';
      setModalError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckSquare className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 tracking-tight text-base">Action Plan - General</h3>
          </div>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Action Plan
            </Button>
          )}
        </div>

        <div className="p-6">
          {actionPlans.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No Action Plans created for this Account & Financial Year context yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Action Planned</th>
                    <th className="py-3 px-4">Our Approach</th>
                    <th className="py-3 px-4">Timeline</th>
                    <th className="py-3 px-4">Expected Outcome</th>
                    <th className="py-3 px-4">Target Date</th>
                    {canEdit && <th className="py-3 px-4 text-center w-28">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {actionPlans.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">{item.category}</td>
                      <td className="py-3 px-4 font-medium text-slate-800 max-w-xs">{item.actionPlanned}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{item.ourApproach || '—'}</td>
                      <td className="py-3 px-4 text-slate-600">{item.timeline || '—'}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{item.expectedOutcome || '—'}</td>
                      <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                        {item.targetDate ? new Date(item.targetDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => setDrawerItem(item)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600"
                            title="View Quick Panel Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => handleOpenModal(item)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600"
                                title="Edit Action Plan"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingId(item.id)}
                                className="p-1 hover:bg-red-50 rounded text-slate-500 hover:text-red-600"
                                title="Delete Action Plan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Action Plan Create/Edit Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          title={editingItem ? 'Edit Action Plan' : 'Add Action Plan'}
          icon={<CheckSquare className="w-5 h-5 text-blue-600" />}
          onClose={() => setModalOpen(false)}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                {modalError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                <input
                  type="text"
                  required
                  value={form.category || ''}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="e.g. Technology Alignment, Executive Relationship..."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Date</label>
                <input
                  type="date"
                  value={form.targetDate || ''}
                  onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Action Planned *</label>
              <textarea
                required
                rows={3}
                value={form.actionPlanned || ''}
                onChange={(e) => setForm({ ...form, actionPlanned: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Describe planned action..."
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Our Approach</label>
              <textarea
                rows={2}
                value={form.ourApproach || ''}
                onChange={(e) => setForm({ ...form, ourApproach: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Execution strategy & methodology..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Timeline</label>
                <input
                  type="text"
                  value={form.timeline || ''}
                  onChange={(e) => setForm({ ...form, timeline: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="e.g. Q1 FY27, 4 Weeks..."
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expected Outcome</label>
              <textarea
                rows={2}
                value={form.expectedOutcome || ''}
                onChange={(e) => setForm({ ...form, expectedOutcome: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Expected impact or outcome..."
              />
            </div>

            <ModalFooter className="-mx-6 -mb-6 mt-6">
              <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Action Plan'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Quick Panel Drawer */}
      {drawerItem && (
        <div className="fixed inset-0 z-[250] flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{drawerItem.category}</h3>
                <span className="text-xs text-slate-500">Action Plan Quick Panel</span>
              </div>
              <button
                onClick={() => setDrawerItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Timeline</span>
                  <span className="font-bold text-slate-800 text-xs">{drawerItem.timeline || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Target Date</span>
                  <span className="font-bold text-slate-800 text-xs">
                    {drawerItem.targetDate ? new Date(drawerItem.targetDate).toLocaleDateString() : '—'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Action Planned</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-medium whitespace-pre-wrap">{drawerItem.actionPlanned}</p>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Our Approach</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 whitespace-pre-wrap">{drawerItem.ourApproach || 'None specified'}</p>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Expected Outcome</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 whitespace-pre-wrap">{drawerItem.expectedOutcome || 'None specified'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!deletingId}
        title="Delete Action Plan"
        message="Are you sure you want to delete this action plan record?"
        onConfirm={async () => {
          if (deletingId) {
            await onDeleteActionPlan(deletingId);
            setDeletingId(null);
          }
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};
