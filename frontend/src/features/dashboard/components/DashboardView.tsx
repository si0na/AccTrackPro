/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { isDueThisWeek } from '@/utils';
import {
  Building2,
  Briefcase,
  ChevronRight,
  AlertTriangle,
  CheckSquare,
} from 'lucide-react';
import { PageHeader } from '@/components/ui';

export const DashboardView: React.FC = () => {
  const {
    accounts,
    opportunities,
    actionItems,
    activities,
    setView,
    setSelectedAccountId,
    setSelectedOpportunityId,
    setSelectedStage,
    setDashboardStageHighlight,
    setDueThisWeekFilter,
    setDashboardOppStatusFilter,
    setOpenActionItemsFilter,
    setOverdueActionItemsFilter,
    currentUserProfile,
  } = useCRM();

  // ── Operational metrics — always live, never fiscal-period-filtered ─────────
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local
  const totalAccountsVal = accounts.length;
  const myOpenOpps = opportunities.filter(o => (o.status ?? 'Open') === 'Open');
  const myOpenTasks = actionItems.filter(ai => ai.status !== 'Completed');
  const overdueTasks = myOpenTasks.filter(
    ai => ai.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(ai.dueDate) && ai.dueDate < todayStr,
  );
  // Live pipeline excludes closed-lost deals.
  const pipelineOpps = opportunities.filter(o => (o.status ?? 'Open') !== 'Lost');

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000)     return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  };

  // Account Health distribution.
  const C = 364.4; // 2 * π * 58 (SVG circle radius = 58)
  const healthTotal   = accounts.length;
  const healthyCount  = accounts.filter(a => a.health === 'Healthy').length;
  const atRiskCount   = accounts.filter(a => a.health === 'At Risk').length;
  const criticalCount = accounts.filter(a => a.health === 'Critical').length;
  const healthyPct  = healthTotal > 0 ? healthyCount  / healthTotal : 0;
  const atRiskPct   = healthTotal > 0 ? atRiskCount   / healthTotal : 0;
  const criticalPct = healthTotal > 0 ? criticalCount / healthTotal : 0;
  const healthBadge = criticalCount > 0
    ? { label: 'Critical', cls: 'text-red-600 bg-red-50' }
    : atRiskCount > 0
    ? { label: 'At Risk', cls: 'text-orange-600 bg-orange-50' }
    : { label: 'Good', cls: 'text-emerald-600 bg-emerald-50' };

  // Open action items due in the current calendar week (same rule as the
  // Action Items drill-down filter).
  const dueThisWeekItems = actionItems.filter(
    ai => ai.status !== 'Completed' && isDueThisWeek(ai.dueDate),
  );
  const activeActionItems = dueThisWeekItems.slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Overview"
        subtitle={`Welcome back, ${currentUserProfile.name}. Here is the latest on your enterprise account pipeline.`}
      />

      {/* Operational Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Accounts */}
        <div
          onClick={() => setView('accounts', { fromDashboard: true })}
          className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Accounts</p>
            <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">{totalAccountsVal}</h3>
            <span className="text-[11px] text-slate-400 font-medium">
              Long-term customer portfolio
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* My Open Opportunities */}
        <div
          onClick={() => { setDashboardOppStatusFilter('Open'); setView('opportunities', { fromDashboard: true }); }}
          className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">My Open Opportunities</p>
            <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">{myOpenOpps.length}</h3>
            <span className="text-[11px] text-slate-400 font-medium">
              Visible until closed (Won/Lost)
            </span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Briefcase className="w-6 h-6" />
          </div>
        </div>

        {/* My Action Items */}
        <div
          onClick={() => { setOpenActionItemsFilter(true); setView('actionItems', { fromDashboard: true }); }}
          className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">My Action Items</p>
            <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">{myOpenTasks.length}</h3>
            <span className="text-[11px] text-slate-400 font-medium">
              Open tasks assigned to you
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckSquare className="w-6 h-6" />
          </div>
        </div>

        {/* Overdue Tasks */}
        <div
          onClick={() => { setOverdueActionItemsFilter(true); setView('actionItems', { fromDashboard: true }); }}
          className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between hover:border-slate-300 transition-all cursor-pointer"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overdue Tasks</p>
            <h3 className={`text-3xl font-extrabold tracking-tight ${overdueTasks.length > 0 ? 'text-red-600' : 'text-slate-800'}`}>
              {overdueTasks.length}
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">
              Past their due date
            </span>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Pipeline Funnel Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <h4 className="font-bold text-slate-800 tracking-tight">Opportunity Pipeline</h4>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100/50">
              Live · excludes lost deals
            </span>
          </div>
          
          {/* Custom Funnel SVG Visualizer */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="w-full max-w-[280px] shrink-0">
              <svg viewBox="0 0 200 160" className="w-full h-auto">
                <defs>
                  <linearGradient id="funnel-lead" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#60a5fa" />
                  </linearGradient>
                  <linearGradient id="funnel-qual" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                  <linearGradient id="funnel-prop" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                  <linearGradient id="funnel-nego" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ec4899" />
                    <stop offset="100%" stopColor="#f472b6" />
                  </linearGradient>
                  <linearGradient id="funnel-won" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
                {/* Lead Row */}
                <polygon points="10,5 190,5 175,30 25,30" fill="url(#funnel-lead)" opacity="0.9" className="cursor-pointer hover:opacity-100 transition-all" onClick={() => { setSelectedStage('Lead'); setDashboardStageHighlight('Lead'); setView('opportunities', { fromDashboard: true }); }} />
                {/* Qualified Row */}
                <polygon points="25,35 175,35 155,60 45,60" fill="url(#funnel-qual)" opacity="0.9" className="cursor-pointer hover:opacity-100 transition-all" onClick={() => { setSelectedStage('Qualified'); setDashboardStageHighlight('Qualified'); setView('opportunities', { fromDashboard: true }); }} />
                {/* Proposal Row */}
                <polygon points="45,65 155,65 135,90 65,90" fill="url(#funnel-prop)" opacity="0.9" className="cursor-pointer hover:opacity-100 transition-all" onClick={() => { setSelectedStage('Proposal'); setDashboardStageHighlight('Proposal'); setView('opportunities', { fromDashboard: true }); }} />
                {/* Negotiation Row */}
                <polygon points="65,95 135,95 115,120 85,120" fill="url(#funnel-nego)" opacity="0.9" className="cursor-pointer hover:opacity-100 transition-all" onClick={() => { setSelectedStage('Negotiation'); setDashboardStageHighlight('Negotiation'); setView('opportunities', { fromDashboard: true }); }} />
                {/* Won Row */}
                <polygon points="85,125 115,125 105,150 95,150" fill="url(#funnel-won)" opacity="0.9" className="cursor-pointer hover:opacity-100 transition-all" onClick={() => { setSelectedStage('Won'); setDashboardStageHighlight('Won'); setView('opportunities', { fromDashboard: true }); }} />
              </svg>
            </div>

            {/* Funnel Table Legend */}
            <div className="flex-1 space-y-3.5 w-full">
              {[
                { stage: 'Lead', color: 'bg-blue-500' },
                { stage: 'Qualified', color: 'bg-indigo-600' },
                { stage: 'Proposal', color: 'bg-purple-500' },
                { stage: 'Negotiation', color: 'bg-pink-500' },
                { stage: 'Won', color: 'bg-emerald-500' }
              ].map((item) => {
                const stageOpps = pipelineOpps.filter(o => o.stage === item.stage);
                const count = stageOpps.length;
                const valueSum = stageOpps.reduce((sum, o) => sum + o.value, 0);
                const displayValue = formatCurrency(valueSum);
                
                return (
                  <div 
                    key={item.stage} 
                    onClick={() => {
                      setSelectedStage(item.stage);
                      setDashboardStageHighlight(item.stage);
                      setView('opportunities', { fromDashboard: true });
                    }}
                    className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-all"
                  >
                    <div className="flex items-center space-x-2">
                      <span className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
                      <span className="font-bold text-slate-700">{item.stage}</span>
                    </div>
                    <div className="flex items-center space-x-4 text-slate-500">
                      <span className="font-mono text-slate-600 font-semibold">{count} items</span>
                      <span className="font-mono text-slate-900 font-bold">{displayValue}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Account Health Doughnut Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h4 className="font-bold text-slate-800 tracking-tight">Account Health</h4>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${healthBadge.cls}`}>{healthBadge.label}</span>
            </div>

            {/* SVG Radial Circle Graph — driven by live account data */}
            <div className="flex items-center justify-center relative py-2">
              <svg className="w-36 h-36 transform -rotate-90">
                <circle cx="72" cy="72" r="58" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                {/* Healthy arc */}
                <circle cx="72" cy="72" r="58" stroke="#10b981" strokeWidth="12" fill="none"
                        strokeDasharray={C} strokeDashoffset={C * (1 - healthyPct)} />
                {/* At Risk arc — starts where Healthy ends */}
                <circle cx="72" cy="72" r="58" stroke="#f97316" strokeWidth="12" fill="none"
                        strokeDasharray={C} strokeDashoffset={C * (1 - atRiskPct)}
                        transform={`rotate(${healthyPct * 360} 72 72)`} />
                {/* Critical arc — starts where At Risk ends */}
                <circle cx="72" cy="72" r="58" stroke="#ef4444" strokeWidth="12" fill="none"
                        strokeDasharray={C} strokeDashoffset={C * (1 - criticalPct)}
                        transform={`rotate(${(healthyPct + atRiskPct) * 360} 72 72)`} />
              </svg>
              {/* Center Text */}
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-slate-800">{healthTotal}</span>
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Total Accounts</span>
              </div>
            </div>
          </div>

          {/* Legends */}
          <div className="grid grid-cols-3 gap-2 mt-4 text-center border-t border-slate-100 pt-4">
            <div className="space-y-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Healthy</p>
              <p className="text-sm font-bold text-slate-800">{healthyCount} <span className="text-[10px] text-slate-400 font-normal">({Math.round(healthyPct * 100)}%)</span></p>
            </div>
            <div className="space-y-1">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500"></span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">At Risk</p>
              <p className="text-sm font-bold text-slate-800">{atRiskCount} <span className="text-[10px] text-slate-400 font-normal">({Math.round(atRiskPct * 100)}%)</span></p>
            </div>
            <div className="space-y-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Critical</p>
              <p className="text-sm font-bold text-slate-800">{criticalCount} <span className="text-[10px] text-slate-400 font-normal">({Math.round(criticalPct * 100)}%)</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row: Action Items & Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action Items Column */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h4 className="font-bold text-slate-800 tracking-tight">Action Items Due This Week</h4>
            <button
              onClick={() => {
                setDueThisWeekFilter(true);
                setView('actionItems', { fromDashboard: true });
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center cursor-pointer"
            >
              View all <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-2.5">Title</th>
                  <th className="py-2.5">Owner</th>
                  <th className="py-2.5">Due Date</th>
                  <th className="py-2.5 text-right">Priority</th>
                </tr>
              </thead>
              <tbody>
                {activeActionItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 font-medium italic">
                      No open action items due this week.
                    </td>
                  </tr>
                )}
                {activeActionItems.map(item => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="py-3 pr-2">
                      <div>
                        <p className="font-semibold text-slate-700 truncate max-w-[180px]">{item.title}</p>
                        <p className="text-[10px] text-slate-400">
                          {accounts.find(a => a.id === item.accountId)?.name || 'Account'}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 text-slate-600 font-medium">{item.owner}</td>
                    <td className="py-3 text-slate-500 font-mono">{item.dueDate}</td>
                    <td className="py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.priority === 'High' ? 'bg-red-50 text-red-600' :
                        item.priority === 'Medium' ? 'bg-orange-50 text-orange-600' :
                        'bg-green-50 text-green-600'
                      }`}>
                        {item.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activities Column */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h4 className="font-bold text-slate-800 tracking-tight">Recent Activity</h4>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold">Real-time</span>
          </div>

          <div className="space-y-4 overflow-y-auto max-h-[240px] pr-1">
            {activities.slice(0, 5).map((actv) => {
              const account = accounts.find(a => a.id === actv.accountId);
              const opportunity = opportunities.find(o => o.id === actv.opportunityId);
              
              return (
                <div key={actv.id} className="flex items-start space-x-3 text-xs group">
                  {/* Styled bullet */}
                  <div className="mt-1 relative shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                      actv.type === 'opportunity' ? 'bg-indigo-500 border-indigo-200' :
                      actv.type === 'actionItem' ? 'bg-emerald-500 border-emerald-200' :
                      actv.type === 'stakeholder' ? 'bg-blue-500 border-blue-200' :
                      'bg-slate-400 border-slate-200'
                    }`} />
                  </div>
                  
                  {/* Description Box */}
                  <div className="flex-1 space-y-0.5">
                    <p className="text-slate-700 font-medium">
                      {actv.text}{' '}
                      <span className="text-slate-400 font-normal">by {actv.user}</span>
                    </p>
                    <div className="flex items-center space-x-2 text-[10px]">
                      <span className="text-slate-400 font-mono">{actv.timestamp}</span>
                      {account && (
                        <button
                          onClick={() => {
                            setSelectedAccountId(account.id);
                            setView('account-details');
                          }}
                          className="text-blue-500 hover:underline font-semibold cursor-pointer"
                        >
                          {account.name}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
};
