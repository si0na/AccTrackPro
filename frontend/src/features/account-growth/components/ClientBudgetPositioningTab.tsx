import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, DollarSign, Target, Award, PieChart, Save } from 'lucide-react';
import {
  AccountGrowthBudgetPositioning,
  AccountGrowthWalletSharePlan,
  AccountGrowthSuccessParameter,
  AccountGrowthOutsourcingSplit,
} from '@/types';
import { Modal, ModalFooter, Button, ConfirmDialog } from '@/components/ui';

interface ClientBudgetPositioningTabProps {
  accountId: string;
  financialYearId: string;
  financialLabel: string;
  budgetPositioning: AccountGrowthBudgetPositioning | null;
  walletSharePlans: AccountGrowthWalletSharePlan[];
  successParameters: AccountGrowthSuccessParameter[];
  outsourcingSplits: AccountGrowthOutsourcingSplit[];
  canEdit: boolean;
  onSaveBudgetPositioning: (data: Partial<AccountGrowthBudgetPositioning>) => Promise<void>;
  onSaveWalletSharePlan: (data: Partial<AccountGrowthWalletSharePlan>) => Promise<void>;
  onDeleteWalletSharePlan: (id: string) => Promise<void>;
  onSaveSuccessParameters: (items: Array<{ parameterKey: string; parameterName: string; clientPerception: string }>) => Promise<void>;
  onSaveOutsourcingSplit: (data: Partial<AccountGrowthOutsourcingSplit>) => Promise<void>;
  onDeleteOutsourcingSplit: (id: string) => Promise<void>;
}

type SubTabKey = 'financial-info' | 'wallet-share' | 'success-parameters' | 'outsourcing-split';

const FIXED_SUCCESS_PARAMETERS = [
  { key: 'relationship', name: 'Relationship' },
  { key: 'domain_expertise', name: 'Domain Expertise' },
  { key: 'technology_expertise', name: 'Technology Expertise' },
  { key: 'delivery_expertise', name: 'Delivery Expertise' },
  { key: 'talent_availability', name: 'Talent Availability' },
  { key: 'nps_score', name: 'NPS Score' },
];

export const ClientBudgetPositioningTab: React.FC<ClientBudgetPositioningTabProps> = ({
  accountId,
  financialYearId,
  financialLabel,
  budgetPositioning,
  walletSharePlans,
  successParameters,
  outsourcingSplits,
  canEdit,
  onSaveBudgetPositioning,
  onSaveWalletSharePlan,
  onDeleteWalletSharePlan,
  onSaveSuccessParameters,
  onSaveOutsourcingSplit,
  onDeleteOutsourcingSplit,
}) => {
  // Sub-Tab Navigation State
  const [subTab, setSubTab] = useState<SubTabKey>('financial-info');

  // Financial Form State
  const [financialForm, setFinancialForm] = useState<Partial<AccountGrowthBudgetPositioning>>({});
  const [savingFinancials, setSavingFinancials] = useState(false);

  // Success Parameters State mapped by parameterKey
  const [paramPerceptions, setParamPerceptions] = useState<Record<string, 'Expert' | 'Good' | 'Average' | 'Weak'>>({});
  const [savingParams, setSavingParams] = useState(false);

  // Financial Form Error State
  const [financialsError, setFinancialsError] = useState<string | null>(null);
  const [paramsError, setParamsError] = useState<string | null>(null);

  // Wallet Share Plan Modal State
  const [wspModalOpen, setWspModalOpen] = useState(false);
  const [editingWsp, setEditingWsp] = useState<AccountGrowthWalletSharePlan | null>(null);
  const [wspForm, setWspForm] = useState<Partial<AccountGrowthWalletSharePlan>>({});
  const [wspError, setWspError] = useState<string | null>(null);
  const [deletingWspId, setDeletingWspId] = useState<string | null>(null);

  // Outsourcing Split Modal State
  const [osModalOpen, setOsModalOpen] = useState(false);
  const [editingOs, setEditingOs] = useState<AccountGrowthOutsourcingSplit | null>(null);
  const [osForm, setOsForm] = useState<Partial<AccountGrowthOutsourcingSplit>>({});
  const [osError, setOsError] = useState<string | null>(null);
  const [deletingOsId, setDeletingOsId] = useState<string | null>(null);
  const [savingModal, setSavingModal] = useState(false);

  useEffect(() => {
    setFinancialsError(null);
    if (budgetPositioning) {
      setFinancialForm({ ...budgetPositioning });
    } else {
      setFinancialForm({
        accountId,
        financialYearId,
        clientRevenue: undefined,
        itBudgetTam: undefined,
        inhouseSpendSam: undefined,
        outsourcingSpend: undefined,
        reflectionsWalletSharePrevFyPct: undefined,
        walletSharePlanCurrentFyPct: undefined,
      });
    }
  }, [budgetPositioning, accountId, financialYearId]);

  useEffect(() => {
    const map: Record<string, 'Expert' | 'Good' | 'Average' | 'Weak'> = {};
    FIXED_SUCCESS_PARAMETERS.forEach((p) => {
      const existing = successParameters.find((sp) => sp.parameterKey === p.key);
      map[p.key] = existing?.clientPerception || 'Good';
    });
    setParamPerceptions(map);
  }, [successParameters]);

  const parseNum = (val: any) =>
    val !== undefined && val !== null && val !== '' ? Number(val) : undefined;

  // --- Handlers ---
  const handleSaveFinancials = async (e: React.FormEvent) => {
    e.preventDefault();
    setFinancialsError(null);
    try {
      setSavingFinancials(true);
      await onSaveBudgetPositioning({
        ...financialForm,
        accountId,
        financialYearId,
        clientRevenue: parseNum(financialForm.clientRevenue),
        itBudgetTam: parseNum(financialForm.itBudgetTam),
        inhouseSpendSam: parseNum(financialForm.inhouseSpendSam),
        outsourcingSpend: parseNum(financialForm.outsourcingSpend),
        reflectionsWalletSharePrevFyPct: parseNum(financialForm.reflectionsWalletSharePrevFyPct),
        walletSharePlanCurrentFyPct: parseNum(financialForm.walletSharePlanCurrentFyPct),
      });
    } catch (err: any) {
      console.error('[ClientBudgetPositioningTab] Save financials error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to save Financial Information.';
      setFinancialsError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSavingFinancials(false);
    }
  };

  const handleSaveParameters = async () => {
    setParamsError(null);
    try {
      setSavingParams(true);
      const items = FIXED_SUCCESS_PARAMETERS.map((p) => ({
        parameterKey: p.key,
        parameterName: p.name,
        clientPerception: paramPerceptions[p.key] || 'Good',
      }));
      await onSaveSuccessParameters(items);
    } catch (err: any) {
      console.error('[ClientBudgetPositioningTab] Save success params error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to save Success Parameters.';
      setParamsError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSavingParams(false);
    }
  };

  const handleOpenWspModal = (item?: AccountGrowthWalletSharePlan) => {
    setWspError(null);
    if (item) {
      setEditingWsp(item);
      setWspForm({ ...item });
    } else {
      setEditingWsp(null);
      setWspForm({
        accountId,
        financialYearId,
        initiativeTitle: '',
        strategyDetails: '',
        targetRevenueImpact: undefined,
      });
    }
    setWspModalOpen(true);
  };

  const handleSaveWspSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWspError(null);
    if (!wspForm.initiativeTitle?.trim()) {
      setWspError('Initiative / Plan Title is required.');
      return;
    }
    try {
      setSavingModal(true);
      await onSaveWalletSharePlan({
        ...wspForm,
        id: editingWsp?.id,
        accountId,
        financialYearId,
        initiativeTitle: wspForm.initiativeTitle.trim(),
        strategyDetails: wspForm.strategyDetails?.trim() || undefined,
        targetRevenueImpact: parseNum(wspForm.targetRevenueImpact),
      });
      setWspModalOpen(false);
    } catch (err: any) {
      console.error('[ClientBudgetPositioningTab] Save WSP error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to save Wallet Share Plan.';
      setWspError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSavingModal(false);
    }
  };

  const handleOpenOsModal = (item?: AccountGrowthOutsourcingSplit) => {
    setOsError(null);
    if (item) {
      setEditingOs(item);
      setOsForm({ ...item });
    } else {
      setEditingOs(null);
      setOsForm({
        accountId,
        financialYearId,
        businessDivision: '',
        outsourcingSpendPct: undefined,
        presence: 'Y',
      });
    }
    setOsModalOpen(true);
  };

  const handleSaveOsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOsError(null);

    if (!osForm.businessDivision?.trim()) {
      setOsError('Business Division is required.');
      return;
    }

    const pct = parseNum(osForm.outsourcingSpendPct);
    if (pct !== undefined && (pct < 0 || pct > 100)) {
      setOsError('Outsourcing Spend % must be between 0 and 100.');
      return;
    }

    try {
      setSavingModal(true);
      await onSaveOutsourcingSplit({
        ...osForm,
        id: editingOs?.id,
        accountId,
        financialYearId,
        businessDivision: osForm.businessDivision.trim(),
        outsourcingSpendPct: pct,
        presence: osForm.presence || 'Y',
      });
      setOsModalOpen(false);
    } catch (err: any) {
      console.error('[ClientBudgetPositioningTab] Save Outsourcing Split error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to save Outsourcing Split division.';
      setOsError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSavingModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Client Budget & Positioning Internal Navigation Sub-Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl px-4 pt-3 border-x border-t">
        <nav className="flex space-x-6 text-xs font-semibold overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSubTab('financial-info')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              subTab === 'financial-info'
                ? 'border-emerald-600 text-emerald-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Financial Information
          </button>
          <button
            onClick={() => setSubTab('wallet-share')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              subTab === 'wallet-share'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Target className="w-4 h-4" />
            Wallet Share Plan
          </button>
          <button
            onClick={() => setSubTab('success-parameters')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              subTab === 'success-parameters'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award className="w-4 h-4" />
            Success Parameters
          </button>
          <button
            onClick={() => setSubTab('outsourcing-split')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              subTab === 'outsourcing-split'
                ? 'border-amber-600 text-amber-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PieChart className="w-4 h-4" />
            Outsourcing Split
          </button>
        </nav>
      </div>

      {/* SUB-TAB 1: FINANCIAL INFORMATION */}
      {subTab === 'financial-info' && (
        <div className="bg-white rounded-b-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-800 tracking-tight text-base">
                Client Financial Information ({financialLabel})
              </h3>
            </div>
          </div>

          <form onSubmit={handleSaveFinancials} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Client Revenue ($)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={!canEdit}
                  value={financialForm.clientRevenue ?? ''}
                  onChange={(e) =>
                    setFinancialForm({ ...financialForm, clientRevenue: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">IT Budget ($) TAM</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={!canEdit}
                  value={financialForm.itBudgetTam ?? ''}
                  onChange={(e) =>
                    setFinancialForm({ ...financialForm, itBudgetTam: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">In-house Spend ($) SAM</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={!canEdit}
                  value={financialForm.inhouseSpendSam ?? ''}
                  onChange={(e) =>
                    setFinancialForm({ ...financialForm, inhouseSpendSam: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Outsourcing Spend ($)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={!canEdit}
                  value={financialForm.outsourcingSpend ?? ''}
                  onChange={(e) =>
                    setFinancialForm({ ...financialForm, outsourcingSpend: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reflections Wallet Share (%) Prev FY</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  disabled={!canEdit}
                  value={financialForm.reflectionsWalletSharePrevFyPct ?? ''}
                  onChange={(e) =>
                    setFinancialForm({
                      ...financialForm,
                      reflectionsWalletSharePrevFyPct: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Wallet Share Plan (%) Current FY</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  disabled={!canEdit}
                  value={financialForm.walletSharePlanCurrentFyPct ?? ''}
                  onChange={(e) =>
                    setFinancialForm({
                      ...financialForm,
                      walletSharePlanCurrentFyPct: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-slate-50"
                />
              </div>
            </div>

            {canEdit && (
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button type="submit" variant="primary" disabled={savingFinancials}>
                  <Save className="w-4 h-4 mr-1.5" />
                  {savingFinancials ? 'Saving...' : 'Save Financial Information'}
                </Button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* SUB-TAB 2: WALLET SHARE PLAN */}
      {subTab === 'wallet-share' && (
        <div className="bg-white rounded-b-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Target className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-800 tracking-tight text-base">Wallet Share Increase Plan</h3>
            </div>
            {canEdit && (
              <Button variant="primary" size="sm" onClick={() => handleOpenWspModal()}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add Plan
              </Button>
            )}
          </div>

          <div className="p-6">
            {walletSharePlans.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No Wallet Share Increase Plans added yet for this Account & Financial Year.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Initiative / Plan Title *</th>
                      <th className="py-3 px-4">Strategy Details</th>
                      <th className="py-3 px-4 text-right">Target Rev Impact ($)</th>
                      {canEdit && <th className="py-3 px-4 text-center w-20">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {walletSharePlans.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-xs">{item.initiativeTitle}</td>
                        <td className="py-3.5 px-4 text-slate-600">{item.strategyDetails || '—'}</td>
                        <td className="py-3.5 px-4 text-right font-medium text-emerald-600">
                          {item.targetRevenueImpact ? `$${item.targetRevenueImpact.toLocaleString()}` : '—'}
                        </td>
                        {canEdit && (
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => handleOpenWspModal(item)}
                                className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition-colors"
                                title="Edit Plan"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingWspId(item.id)}
                                className="p-1.5 hover:bg-red-50 rounded text-slate-500 hover:text-red-600 transition-colors"
                                title="Delete Plan"
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
      )}

      {/* SUB-TAB 3: SUCCESS PARAMETERS MATRIX */}
      {subTab === 'success-parameters' && (
        <div className="bg-white rounded-b-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Award className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 tracking-tight text-base">Success Parameters Matrix</h3>
            </div>
            {canEdit && (
              <Button variant="primary" size="sm" onClick={handleSaveParameters} disabled={savingParams}>
                <Save className="w-4 h-4 mr-1.5" />
                {savingParams ? 'Saving...' : 'Save Matrix'}
              </Button>
            )}
          </div>

          <div className="p-6">
            <div className="max-w-3xl overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Parameter</th>
                    <th className="py-3 px-4 w-64">Client Perception *</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {FIXED_SUCCESS_PARAMETERS.map((p) => {
                    const currentPerception = paramPerceptions[p.key] || 'Good';
                    return (
                      <tr key={p.key} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {p.name}
                          {p.key === 'nps_score' && (
                            <span className="ml-2 text-[10px] text-slate-400 font-normal">(Standalone Growth Field)</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {canEdit ? (
                            <select
                              value={currentPerception}
                              onChange={(e) =>
                                setParamPerceptions({
                                  ...paramPerceptions,
                                  [p.key]: e.target.value as any,
                                })
                              }
                              className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-medium text-slate-700"
                            >
                              <option value="Expert">Expert</option>
                              <option value="Good">Good</option>
                              <option value="Average">Average</option>
                              <option value="Weak">Weak</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                                currentPerception === 'Expert'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : currentPerception === 'Good'
                                  ? 'bg-blue-100 text-blue-800'
                                  : currentPerception === 'Average'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {currentPerception}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: OUTSOURCING SPLIT */}
      {subTab === 'outsourcing-split' && (
        <div className="bg-white rounded-b-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PieChart className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-slate-800 tracking-tight text-base">Outsourcing Split</h3>
            </div>
            {canEdit && (
              <Button variant="primary" size="sm" onClick={() => handleOpenOsModal()}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add Business Division
              </Button>
            )}
          </div>

          <div className="p-6">
            {outsourcingSplits.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No Outsourcing Split divisions recorded yet for this Account & Financial Year.
              </div>
            ) : (
              <div className="overflow-x-auto max-w-3xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Business Division *</th>
                      <th className="py-3 px-4 text-right w-44">Outsourcing Spend %</th>
                      <th className="py-3 px-4 text-center w-36">Presence (Y/N)</th>
                      {canEdit && <th className="py-3 px-4 text-center w-20">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {outsourcingSplits.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{item.businessDivision}</td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                          {item.outsourcingSpendPct !== undefined ? `${item.outsourcingSpendPct}%` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              item.presence === 'Y' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.presence || 'N'}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => handleOpenOsModal(item)}
                                className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition-colors"
                                title="Edit Division"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingOsId(item.id)}
                                className="p-1.5 hover:bg-red-50 rounded text-slate-500 hover:text-red-600 transition-colors"
                                title="Delete Division"
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
      )}

      {/* Wallet Share Plan Modal */}
      {wspModalOpen && (
        <Modal
          isOpen={wspModalOpen}
          title={editingWsp ? 'Edit Wallet Share Increase Plan' : 'Add Wallet Share Increase Plan'}
          icon={<Target className="w-5 h-5 text-blue-600" />}
          onClose={() => setWspModalOpen(false)}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveWspSubmit} className="p-6 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Initiative / Plan Title *</label>
              <input
                type="text"
                required
                value={wspForm.initiativeTitle || ''}
                onChange={(e) => setWspForm({ ...wspForm, initiativeTitle: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Title of wallet share initiative..."
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Strategy Details</label>
              <textarea
                rows={3}
                value={wspForm.strategyDetails || ''}
                onChange={(e) => setWspForm({ ...wspForm, strategyDetails: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Execution details or strategic approach..."
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Revenue Impact ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={wspForm.targetRevenueImpact ?? ''}
                onChange={(e) => setWspForm({ ...wspForm, targetRevenueImpact: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <ModalFooter className="-mx-6 -mb-6 mt-6">
              <Button variant="secondary" onClick={() => setWspModalOpen(false)} disabled={savingModal}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingModal}>
                {savingModal ? 'Saving...' : 'Save Plan'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Outsourcing Split Modal */}
      {osModalOpen && (
        <Modal
          isOpen={osModalOpen}
          title={editingOs ? 'Edit Business Division' : 'Add Business Division'}
          icon={<PieChart className="w-5 h-5 text-amber-600" />}
          onClose={() => setOsModalOpen(false)}
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveOsSubmit} className="p-6 space-y-4 text-xs">
            {osError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-medium">
                {osError}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Business Division *</label>
              <input
                type="text"
                required
                value={osForm.businessDivision || ''}
                onChange={(e) => setOsForm({ ...osForm, businessDivision: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                placeholder="Division name (e.g. Retail, IT Infrastructure)..."
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Outsourcing Spend %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                value={osForm.outsourcingSpendPct ?? ''}
                onChange={(e) => setOsForm({ ...osForm, outsourcingSpendPct: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reflections Presence (Y/N)</label>
              <select
                value={osForm.presence || 'Y'}
                onChange={(e) => setOsForm({ ...osForm, presence: e.target.value as any })}
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Y">Y</option>
                <option value="N">N</option>
              </select>
            </div>

            <ModalFooter className="-mx-6 -mb-6 mt-6">
              <Button variant="secondary" onClick={() => setOsModalOpen(false)} disabled={savingModal}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingModal}>
                {savingModal ? 'Saving...' : 'Save Division'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {/* Confirm Deletes */}
      <ConfirmDialog
        isOpen={!!deletingWspId}
        title="Delete Wallet Share Plan"
        message="Are you sure you want to delete this plan entry?"
        onConfirm={async () => {
          if (deletingWspId) {
            await onDeleteWalletSharePlan(deletingWspId);
            setDeletingWspId(null);
          }
        }}
        onCancel={() => setDeletingWspId(null)}
      />

      <ConfirmDialog
        isOpen={!!deletingOsId}
        title="Delete Business Division"
        message="Are you sure you want to delete this outsourcing split division?"
        onConfirm={async () => {
          if (deletingOsId) {
            await onDeleteOutsourcingSplit(deletingOsId);
            setDeletingOsId(null);
          }
        }}
        onCancel={() => setDeletingOsId(null)}
      />
    </div>
  );
};
