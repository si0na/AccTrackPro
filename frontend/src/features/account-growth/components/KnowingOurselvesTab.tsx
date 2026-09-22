import React, { useState } from 'react';
import { Plus, Edit2, Trash2, ShieldCheck, Zap, AlertTriangle, Target } from 'lucide-react';
import { AccountGrowthSwot } from '@/types';
import { Modal, ModalFooter, Button, ConfirmDialog } from '@/components/ui';

interface KnowingOurselvesTabProps {
  accountId: string;
  financialYearId: string;
  swotItems: AccountGrowthSwot[];
  canEdit: boolean;
  onSaveSwot: (data: Partial<AccountGrowthSwot>) => Promise<void>;
  onDeleteSwot: (id: string) => Promise<void>;
}

const CATEGORIES: Array<{ key: 'Strength' | 'Weakness' | 'Opportunity' | 'Threat'; title: string; color: string; icon: any }> = [
  { key: 'Strength', title: 'Strengths', color: 'border-emerald-200 bg-emerald-50/40 text-emerald-800', icon: ShieldCheck },
  { key: 'Weakness', title: 'Weaknesses', color: 'border-amber-200 bg-amber-50/40 text-amber-800', icon: AlertTriangle },
  { key: 'Opportunity', title: 'Opportunities', color: 'border-blue-200 bg-blue-50/40 text-blue-800', icon: Zap },
  { key: 'Threat', title: 'Threats', color: 'border-rose-200 bg-rose-50/40 text-rose-800', icon: Target },
];

export const KnowingOurselvesTab: React.FC<KnowingOurselvesTabProps> = ({
  accountId,
  financialYearId,
  swotItems,
  canEdit,
  onSaveSwot,
  onDeleteSwot,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AccountGrowthSwot | null>(null);
  const [form, setForm] = useState<Partial<AccountGrowthSwot>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modalError, setModalError] = useState<string | null>(null);

  const handleOpenModal = (category: 'Strength' | 'Weakness' | 'Opportunity' | 'Threat', item?: AccountGrowthSwot) => {
    setModalError(null);
    if (item) {
      setEditingItem(item);
      setForm({ ...item });
    } else {
      setEditingItem(null);
      setForm({
        accountId,
        financialYearId,
        category,
        details: '',
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!form.details?.trim()) {
      setModalError('Details / Insights is required.');
      return;
    }

    try {
      setSaving(true);
      await onSaveSwot({
        ...form,
        id: editingItem?.id,
        accountId,
        financialYearId,
        details: form.details.trim(),
      });
      setModalOpen(false);
    } catch (err: any) {
      console.error('[KnowingOurselvesTab] Save SWOT error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to save SWOT entry.';
      setModalError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 text-base tracking-tight mb-2">Knowing Ourselves — SWOT Analysis</h3>
        <p className="text-slate-500 text-xs mb-6">
          Standalone Account Growth analysis context. Evaluate Strengths, Weaknesses, Opportunities, and Threats for this Account & Financial Year context.
        </p>

        {/* 4 Quadrants Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const items = swotItems.filter((i) => i.category === cat.key);

            return (
              <div key={cat.key} className={`rounded-xl border p-5 ${cat.color} flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5" />
                      <h4 className="font-bold text-sm">{cat.title}</h4>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/80 text-slate-700 shadow-2xs">
                        {items.length}
                      </span>
                    </div>
                    {canEdit && (
                      <Button variant="secondary" size="xs" onClick={() => handleOpenModal(cat.key)}>
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add {cat.key}
                      </Button>
                    )}
                  </div>

                  {items.length === 0 ? (
                    <div className="text-xs text-slate-400 italic py-4">No {cat.title.toLowerCase()} recorded.</div>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {items.map((item) => (
                        <li
                          key={item.id}
                          className="bg-white rounded-lg p-3 border border-slate-200 shadow-2xs flex items-start justify-between gap-2"
                        >
                          <span className="text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">{item.details}</span>
                          {canEdit && (
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                onClick={() => handleOpenModal(cat.key, item)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingId(item.id)}
                                className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SWOT Entry Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          title={editingItem ? `Edit ${form.category}` : `Add ${form.category}`}
          onClose={() => setModalOpen(false)}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                {modalError}
              </div>
            )}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category *</label>
              <select
                value={form.category || 'Strength'}
                onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Strength">Strength</option>
                <option value="Weakness">Weakness</option>
                <option value="Opportunity">Opportunity</option>
                <option value="Threat">Threat</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Details / Insights *</label>
              <textarea
                required
                rows={4}
                value={form.details || ''}
                onChange={(e) => setForm({ ...form, details: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Provide detailed SWOT insight..."
              />
            </div>

            <ModalFooter className="-mx-6 -mb-6 mt-6">
              <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save SWOT Entry'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!deletingId}
        title="Delete SWOT Entry"
        message="Are you sure you want to delete this SWOT item?"
        onConfirm={async () => {
          if (deletingId) {
            await onDeleteSwot(deletingId);
            setDeletingId(null);
          }
        }}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};
