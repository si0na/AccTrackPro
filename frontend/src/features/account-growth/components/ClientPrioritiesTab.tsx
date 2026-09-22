import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Shield, TrendingUp, Cpu } from 'lucide-react';
import { AccountGrowthClientPriority, AccountGrowthIndustryTrend } from '@/types';
import { Modal, ModalFooter, Button, ConfirmDialog } from '@/components/ui';

interface ClientPrioritiesTabProps {
  accountId: string;
  financialYearId: string;
  clientPriorities: AccountGrowthClientPriority[];
  industryTrends: AccountGrowthIndustryTrend[];
  canEdit: boolean;
  onSavePriority: (data: Partial<AccountGrowthClientPriority>) => Promise<void>;
  onDeletePriority: (id: string) => Promise<void>;
  onSaveTrend: (data: Partial<AccountGrowthIndustryTrend>) => Promise<void>;
  onDeleteTrend: (id: string) => Promise<void>;
}

export const ClientPrioritiesTab: React.FC<ClientPrioritiesTabProps> = ({
  accountId,
  financialYearId,
  clientPriorities,
  industryTrends,
  canEdit,
  onSavePriority,
  onDeletePriority,
  onSaveTrend,
  onDeleteTrend,
}) => {
  // Priority Modal State
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [editingPriority, setEditingPriority] = useState<AccountGrowthClientPriority | null>(null);
  const [priorityForm, setPriorityForm] = useState<Partial<AccountGrowthClientPriority>>({});

  // Trend Modal State
  const [trendModalOpen, setTrendModalOpen] = useState(false);
  const [editingTrend, setEditingTrend] = useState<AccountGrowthIndustryTrend | null>(null);
  const [trendForm, setTrendForm] = useState<Partial<AccountGrowthIndustryTrend>>({});

  // Confirm Delete State
  const [deletingPriorityId, setDeletingPriorityId] = useState<string | null>(null);
  const [deletingTrendId, setDeletingTrendId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [priorityModalError, setPriorityModalError] = useState<string | null>(null);
  const [trendModalError, setTrendModalError] = useState<string | null>(null);

  // --- Priority Modal Handlers ---
  const handleOpenPriorityModal = (item?: AccountGrowthClientPriority) => {
    setPriorityModalError(null);
    if (item) {
      setEditingPriority(item);
      setPriorityForm({ ...item });
    } else {
      setEditingPriority(null);
      setPriorityForm({
        accountId,
        financialYearId,
        digitalTechPriorities: '',
        potentialServicesInvolved: '',
        customerMaturity: 'Medium',
        ourPresence: 'Yes',
        competitorPresence: '',
        estimatedClientSpend: undefined,
        revenuePotential: undefined,
      });
    }
    setPriorityModalOpen(true);
  };

  const handleSavePrioritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPriorityModalError(null);

    const estSpend =
      priorityForm.estimatedClientSpend !== undefined &&
      priorityForm.estimatedClientSpend !== null &&
      (priorityForm.estimatedClientSpend as any) !== ''
        ? Number(priorityForm.estimatedClientSpend)
        : undefined;

    const revPot =
      priorityForm.revenuePotential !== undefined &&
      priorityForm.revenuePotential !== null &&
      (priorityForm.revenuePotential as any) !== ''
        ? Number(priorityForm.revenuePotential)
        : undefined;

    const payload: Partial<AccountGrowthClientPriority> = {
      ...priorityForm,
      id: editingPriority?.id,
      accountId,
      financialYearId,
      estimatedClientSpend: estSpend,
      revenuePotential: revPot,
      potentialServicesInvolved: priorityForm.potentialServicesInvolved?.trim() || undefined,
      competitorPresence: priorityForm.competitorPresence?.trim() || undefined,
    };

    try {
      setSaving(true);
      await onSavePriority(payload);
      setPriorityModalOpen(false);
    } catch (err: any) {
      console.error('[ClientPrioritiesTab] Save priority error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to save Digital / Tech Priority.';
      setPriorityModalError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSaving(false);
    }
  };

  // --- Trend Modal Handlers ---
  const handleOpenTrendModal = (item?: AccountGrowthIndustryTrend) => {
    setTrendModalError(null);
    if (item) {
      setEditingTrend(item);
      setTrendForm({ ...item });
    } else {
      setEditingTrend(null);
      setTrendForm({
        accountId,
        financialYearId,
        industryTrend: '',
        clientImpact: 'Medium',
        customerMaturity: 'Medium',
        ourCapabilityToAddress: '',
        estimatedClientSpend: undefined,
        revenuePotential: undefined,
      });
    }
    setTrendModalOpen(true);
  };

  const handleSaveTrendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrendModalError(null);

    const estSpend =
      trendForm.estimatedClientSpend !== undefined &&
      trendForm.estimatedClientSpend !== null &&
      (trendForm.estimatedClientSpend as any) !== ''
        ? Number(trendForm.estimatedClientSpend)
        : undefined;

    const revPot =
      trendForm.revenuePotential !== undefined &&
      trendForm.revenuePotential !== null &&
      (trendForm.revenuePotential as any) !== ''
        ? Number(trendForm.revenuePotential)
        : undefined;

    const payload: Partial<AccountGrowthIndustryTrend> = {
      ...trendForm,
      id: editingTrend?.id,
      accountId,
      financialYearId,
      estimatedClientSpend: estSpend,
      revenuePotential: revPot,
      ourCapabilityToAddress: trendForm.ourCapabilityToAddress?.trim() || undefined,
    };

    try {
      setSaving(true);
      await onSaveTrend(payload);
      setTrendModalOpen(false);
    } catch (err: any) {
      console.error('[ClientPrioritiesTab] Save trend error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to save Industry Trend.';
      setTrendModalError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Digital / Tech Priorities Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cpu className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 tracking-tight text-base">Digital / Tech Priorities</h3>
          </div>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => handleOpenPriorityModal()}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Priority
            </Button>
          )}
        </div>

        <div className="p-6">
          {clientPriorities.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No Digital / Tech Priorities defined for this Account & Financial Year context yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Digital / Tech Priorities</th>
                    <th className="py-3 px-4">Potential Services</th>
                    <th className="py-3 px-4">Customer Maturity</th>
                    <th className="py-3 px-4">Our Presence</th>
                    <th className="py-3 px-4">Competitor Presence</th>
                    <th className="py-3 px-4 text-right">Est. Spend ($)</th>
                    <th className="py-3 px-4 text-right">Rev Potential ($)</th>
                    {canEdit && <th className="py-3 px-4 text-center w-20">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clientPriorities.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800 max-w-xs">{item.digitalTechPriorities}</td>
                      <td className="py-3 px-4 text-slate-600">{item.potentialServicesInvolved || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.customerMaturity === 'High' ? 'bg-emerald-100 text-emerald-800' :
                          item.customerMaturity === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {item.customerMaturity || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.ourPresence === 'Yes' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.ourPresence || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{item.competitorPresence || '—'}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {item.estimatedClientSpend ? `$${item.estimatedClientSpend.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600">
                        {item.revenuePotential ? `$${item.revenuePotential.toLocaleString()}` : '—'}
                      </td>
                      {canEdit && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => handleOpenPriorityModal(item)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600"
                              title="Edit Priority"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingPriorityId(item.id)}
                              className="p-1 hover:bg-red-50 rounded text-slate-500 hover:text-red-600"
                              title="Delete Priority"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 2. Top Two Trends in Client Industry Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800 tracking-tight text-base">Top Two Trends in Client Industry</h3>
          </div>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => handleOpenTrendModal()}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Industry Trend
            </Button>
          )}
        </div>

        <div className="p-6">
          {industryTrends.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              No Industry Trends recorded for this Account & Financial Year context yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Industry Trend</th>
                    <th className="py-3 px-4">Client Impact</th>
                    <th className="py-3 px-4">Customer Maturity</th>
                    <th className="py-3 px-4">Our Capability to Address</th>
                    <th className="py-3 px-4 text-right">Est. Spend ($)</th>
                    <th className="py-3 px-4 text-right">Rev Potential ($)</th>
                    {canEdit && <th className="py-3 px-4 text-center w-20">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {industryTrends.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800 max-w-xs">{item.industryTrend}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.clientImpact === 'High' ? 'bg-red-100 text-red-800' :
                          item.clientImpact === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {item.clientImpact || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.customerMaturity === 'High' ? 'bg-emerald-100 text-emerald-800' :
                          item.customerMaturity === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {item.customerMaturity || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{item.ourCapabilityToAddress || '—'}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {item.estimatedClientSpend ? `$${item.estimatedClientSpend.toLocaleString()}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600">
                        {item.revenuePotential ? `$${item.revenuePotential.toLocaleString()}` : '—'}
                      </td>
                      {canEdit && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => handleOpenTrendModal(item)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600"
                              title="Edit Trend"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingTrendId(item.id)}
                              className="p-1 hover:bg-red-50 rounded text-slate-500 hover:text-red-600"
                              title="Delete Trend"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Priority Create/Edit Modal */}
      {priorityModalOpen && (
        <Modal
          isOpen={priorityModalOpen}
          title={editingPriority ? 'Edit Digital / Tech Priority' : 'Add Digital / Tech Priority'}
          icon={<Cpu className="w-5 h-5 text-blue-600" />}
          onClose={() => setPriorityModalOpen(false)}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleSavePrioritySubmit} className="p-6 space-y-4 text-xs">
            {priorityModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                {priorityModalError}
              </div>
            )}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Digital / Tech Priorities *</label>
              <textarea
                required
                rows={3}
                value={priorityForm.digitalTechPriorities || ''}
                onChange={(e) => setPriorityForm({ ...priorityForm, digitalTechPriorities: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Describe digital & technology priorities..."
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Potential Services Involved</label>
              <input
                type="text"
                value={priorityForm.potentialServicesInvolved || ''}
                onChange={(e) => setPriorityForm({ ...priorityForm, potentialServicesInvolved: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Cloud Migration, App Modernization, Data Engineering..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Maturity</label>
                <select
                  value={priorityForm.customerMaturity || 'Medium'}
                  onChange={(e) => setPriorityForm({ ...priorityForm, customerMaturity: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Our Presence</label>
                <select
                  value={priorityForm.ourPresence || 'Yes'}
                  onChange={(e) => setPriorityForm({ ...priorityForm, ourPresence: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Competitor Presence</label>
              <input
                type="text"
                value={priorityForm.competitorPresence || ''}
                onChange={(e) => setPriorityForm({ ...priorityForm, competitorPresence: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Competitor names or active scope..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estimated Client Spend ($)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={priorityForm.estimatedClientSpend ?? ''}
                  onChange={(e) => setPriorityForm({ ...priorityForm, estimatedClientSpend: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Revenue Potential ($)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={priorityForm.revenuePotential ?? ''}
                  onChange={(e) => setPriorityForm({ ...priorityForm, revenuePotential: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <ModalFooter className="-mx-6 -mb-6 mt-6">
              <Button variant="secondary" onClick={() => setPriorityModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Priority'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Trend Create/Edit Modal */}
      {trendModalOpen && (
        <Modal
          isOpen={trendModalOpen}
          title={editingTrend ? 'Edit Industry Trend' : 'Add Industry Trend'}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          onClose={() => setTrendModalOpen(false)}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleSaveTrendSubmit} className="p-6 space-y-4 text-xs">
            {trendModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                {trendModalError}
              </div>
            )}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Industry Trend *</label>
              <textarea
                required
                rows={3}
                value={trendForm.industryTrend || ''}
                onChange={(e) => setTrendForm({ ...trendForm, industryTrend: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Key trend impacting client's industry..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Impact</label>
                <select
                  value={trendForm.clientImpact || 'Medium'}
                  onChange={(e) => setTrendForm({ ...trendForm, clientImpact: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Maturity</label>
                <select
                  value={trendForm.customerMaturity || 'Medium'}
                  onChange={(e) => setTrendForm({ ...trendForm, customerMaturity: e.target.value as any })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Our Capability to Address</label>
              <input
                type="text"
                value={trendForm.ourCapabilityToAddress || ''}
                onChange={(e) => setTrendForm({ ...trendForm, ourCapabilityToAddress: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Describe team expertise or solutions..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estimated Client Spend ($)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={trendForm.estimatedClientSpend ?? ''}
                  onChange={(e) => setTrendForm({ ...trendForm, estimatedClientSpend: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Revenue Potential ($)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={trendForm.revenuePotential ?? ''}
                  onChange={(e) => setTrendForm({ ...trendForm, revenuePotential: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <ModalFooter className="-mx-6 -mb-6 mt-6">
              <Button variant="secondary" onClick={() => setTrendModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Trend'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Confirm Priority Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deletingPriorityId}
        title="Delete Digital / Tech Priority"
        message="Are you sure you want to delete this priority entry?"
        onConfirm={async () => {
          if (deletingPriorityId) {
            await onDeletePriority(deletingPriorityId);
            setDeletingPriorityId(null);
          }
        }}
        onCancel={() => setDeletingPriorityId(null)}
      />

      {/* Confirm Trend Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deletingTrendId}
        title="Delete Industry Trend"
        message="Are you sure you want to delete this industry trend entry?"
        onConfirm={async () => {
          if (deletingTrendId) {
            await onDeleteTrend(deletingTrendId);
            setDeletingTrendId(null);
          }
        }}
        onCancel={() => setDeletingTrendId(null)}
      />
    </div>
  );
};
