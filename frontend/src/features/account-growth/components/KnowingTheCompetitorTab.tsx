import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Users, Eye, X } from 'lucide-react';
import { AccountGrowthCompetitor } from '@/types';
import { Modal, ModalFooter, Button, ConfirmDialog } from '@/components/ui';

interface KnowingTheCompetitorTabProps {
  accountId: string;
  financialYearId: string;
  competitors: AccountGrowthCompetitor[];
  canEdit: boolean;
  onSaveCompetitor: (data: Partial<AccountGrowthCompetitor>) => Promise<void>;
  onDeleteCompetitor: (id: string) => Promise<void>;
}

export const KnowingTheCompetitorTab: React.FC<KnowingTheCompetitorTabProps> = ({
  accountId,
  financialYearId,
  competitors,
  canEdit,
  onSaveCompetitor,
  onDeleteCompetitor,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AccountGrowthCompetitor | null>(null);
  const [form, setForm] = useState<Partial<AccountGrowthCompetitor>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [drawerItem, setDrawerItem] = useState<AccountGrowthCompetitor | null>(null);
  const [saving, setSaving] = useState(false);

  const [modalError, setModalError] = useState<string | null>(null);

  const handleOpenModal = (item?: AccountGrowthCompetitor) => {
    setModalError(null);
    if (item) {
      setEditingItem(item);
      setForm({ ...item });
    } else {
      setEditingItem(null);
      setForm({
        accountId,
        financialYearId,
        competitorName: '',
        areasInvolved: '',
        resCount: undefined,
        relationshipStatus: '',
        sponsorFromClient: '',
        majorSkillsProvided: '',
        reasonConsideringCompetitor: '',
        reflectionsPresence: 'No',
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!form.competitorName?.trim()) {
      setModalError('Competitor Name is required.');
      return;
    }

    const resCountVal =
      form.resCount !== undefined && form.resCount !== null && (form.resCount as any) !== ''
        ? Number(form.resCount)
        : undefined;

    const payload: Partial<AccountGrowthCompetitor> = {
      ...form,
      id: editingItem?.id,
      accountId,
      financialYearId,
      competitorName: form.competitorName.trim(),
      areasInvolved: form.areasInvolved?.trim() || undefined,
      resCount: resCountVal,
      relationshipStatus: form.relationshipStatus?.trim() || undefined,
      sponsorFromClient: form.sponsorFromClient?.trim() || undefined,
      majorSkillsProvided: form.majorSkillsProvided?.trim() || undefined,
      reasonConsideringCompetitor: form.reasonConsideringCompetitor?.trim() || undefined,
      reflectionsPresence: form.reflectionsPresence || 'No',
    };

    try {
      setSaving(true);
      await onSaveCompetitor(payload);
      setModalOpen(false);
    } catch (err: any) {
      console.error('[KnowingTheCompetitorTab] Save competitor error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to save competitor.';
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
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 tracking-tight text-base">Knowing the Competitor</h3>
          </div>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => handleOpenModal()}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Competitor
            </Button>
          )}
        </div>

        <div className="p-6">
          {competitors.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No competitors tracked for this Account & Financial Year context yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Competitor Name</th>
                    <th className="py-3 px-4">Areas Involved</th>
                    <th className="py-3 px-4 text-center">Res Count</th>
                    <th className="py-3 px-4">Relationship Status</th>
                    <th className="py-3 px-4">Sponsor from Client</th>
                    <th className="py-3 px-4">Reflections Presence</th>
                    <th className="py-3 px-4 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {competitors.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">{item.competitorName}</td>
                      <td className="py-3 px-4 text-slate-600">{item.areasInvolved || '—'}</td>
                      <td className="py-3 px-4 text-center font-medium text-slate-700">{item.resCount ?? 0}</td>
                      <td className="py-3 px-4 text-slate-600">{item.relationshipStatus || '—'}</td>
                      <td className="py-3 px-4 text-slate-600">{item.sponsorFromClient || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.reflectionsPresence === 'Yes' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.reflectionsPresence || 'No'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => setDrawerItem(item)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600"
                            title="View Quick Panel Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => handleOpenModal(item)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600"
                                title="Edit Competitor"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingId(item.id)}
                                className="p-1 hover:bg-red-50 rounded text-slate-500 hover:text-red-600"
                                title="Delete Competitor"
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

      {/* Competitor Create/Edit Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          title={editingItem ? 'Edit Competitor' : 'Add Competitor'}
          icon={<Users className="w-5 h-5 text-indigo-600" />}
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
                <label className="block font-semibold text-slate-700 mb-1">Competitor Name *</label>
                <input
                  type="text"
                  required
                  value={form.competitorName || ''}
                  onChange={(e) => setForm({ ...form, competitorName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Company name..."
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Res Count (Resources)</label>
                <input
                  type="number"
                  min="0"
                  value={form.resCount ?? ''}
                  onChange={(e) => setForm({ ...form, resCount: e.target.value === '' ? undefined : parseInt(e.target.value, 10) })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Areas Involved</label>
              <input
                type="text"
                value={form.areasInvolved || ''}
                onChange={(e) => setForm({ ...form, areasInvolved: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Domain / project areas..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Relationship Status</label>
                <input
                  type="text"
                  value={form.relationshipStatus || ''}
                  onChange={(e) => setForm({ ...form, relationshipStatus: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Primary Partner, Preferred Vendor..."
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reflections Presence</label>
                <select
                  value={form.reflectionsPresence || 'No'}
                  onChange={(e) => setForm({ ...form, reflectionsPresence: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Any Sponsor from Client</label>
              <input
                type="text"
                value={form.sponsorFromClient || ''}
                onChange={(e) => setForm({ ...form, sponsorFromClient: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Client executive / sponsor name..."
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Major Skills Provided</label>
              <textarea
                rows={2}
                value={form.majorSkillsProvided || ''}
                onChange={(e) => setForm({ ...form, majorSkillsProvided: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Core skills / services provided..."
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reason for Considering Competitor over Reflections</label>
              <textarea
                rows={2}
                value={form.reasonConsideringCompetitor || ''}
                onChange={(e) => setForm({ ...form, reasonConsideringCompetitor: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Key reasons / competitive edge..."
              />
            </div>

            <ModalFooter className="-mx-6 -mb-6 mt-6">
              <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Competitor'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Quick Panel Drawer for View Details */}
      {drawerItem && (
        <div className="fixed inset-0 z-[250] flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{drawerItem.competitorName}</h3>
                <span className="text-xs text-slate-500">Competitor Analysis Quick Panel</span>
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
                  <span className="text-slate-400 font-semibold block text-[11px]">Resources Count</span>
                  <span className="font-bold text-slate-800 text-sm">{drawerItem.resCount ?? 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block text-[11px]">Reflections Presence</span>
                  <span className="font-bold text-slate-800 text-sm">{drawerItem.reflectionsPresence || 'No'}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Areas Involved</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">{drawerItem.areasInvolved || 'None specified'}</p>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Relationship Status</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">{drawerItem.relationshipStatus || 'None specified'}</p>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Client Sponsor</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">{drawerItem.sponsorFromClient || 'None specified'}</p>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Major Skills Provided</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 whitespace-pre-wrap">{drawerItem.majorSkillsProvided || 'None specified'}</p>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Reason for Considering Competitor over Reflections</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 whitespace-pre-wrap">{drawerItem.reasonConsideringCompetitor || 'None specified'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!deletingId}
        title="Delete Competitor"
        message="Are you sure you want to delete this competitor record?"
        onConfirm={async () => {
          if (deletingId) {
            await onDeleteCompetitor(deletingId);
            setDeletingId(null);
          }
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};
