/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { performanceEvaluationsApi, employeeMasterApi, PerformanceEvaluationSummaryRow } from '@/api/crm.api';
import type { PerformanceEvaluation, EmployeeMaster, ColumnConfig } from '@/types';
import {
  Plus,
  Trash2,
  FileSpreadsheet,
  X,
  Download,
  Settings2,
  Pencil,
  Info,
  Loader2,
  Users,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PageHeader,
  Button,
  Card,
  FilterBar,
  FilterSelect,
  SearchBar,
  SortableHeader,
  StatusBadge,
  RETENTION_RISK_COLORS,
  EmptyRow,
  ErrorState,
  RowActionButton,
  Pagination,
  SummaryCard,
  Table,
  SearchableSelect,
} from '@/components/ui';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import { CustomColumnFields } from '@/components/CustomColumnFields';

/** Standard 1–10 score fields get the bounded slider-style progress cell; custom numeric columns don't. */
const NUMERIC_METRIC_KEYS = new Set([
  'deliveryExcellence', 'qualityStandards', 'technicalCapability', 'communication', 'sla',
  'teamCollaboration', 'reliability', 'innovation', 'ideation', 'behavioural', 'leadership',
]);

export const PerformanceEvaluationView: React.FC = () => {
  const {
    currentUserId,
    accounts,
    projects,
    performanceEvaluationColumns,
    performanceEvaluationColumnConfig,
    can,
  } = useCRM();

  const canDeleteEvaluation = can('performance', 'delete');

  const [evaluations, setEvaluations] = useState<PerformanceEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Load from API ──────────────────────────────────────────────────────────

  const loadEvaluations = useCallback(async () => {
    try {
      setError(null);
      const data = await performanceEvaluationsApi.getAll(
        currentUserId ? { userId: currentUserId } : undefined,
      );
      setEvaluations(data);
    } catch {
      setError('Failed to load performance evaluations. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => { loadEvaluations(); }, [loadEvaluations]);

  // Employee Master directory — only whitelisted employees can be evaluated.
  const [employees, setEmployees] = useState<EmployeeMaster[]>([]);
  useEffect(() => {
    employeeMasterApi.getAll().then(setEmployees).catch(() => {});
  }, []);
  const employeeLabel = (emp: EmployeeMaster) => emp.name || emp.email;

  // Server-side per-employee reporting aggregates.
  const [summaryRows, setSummaryRows] = useState<PerformanceEvaluationSummaryRow[]>([]);
  const loadSummary = useCallback(() => {
    performanceEvaluationsApi.summary().then(setSummaryRows).catch(() => {});
  }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // ─── Derived filter lists ───────────────────────────────────────────────────

  const managersList = useMemo(() => Array.from(new Set(evaluations.map(e => e.manager))), [evaluations]);
  const projectsList = useMemo(() => Array.from(new Set(evaluations.map(e => e.project))), [evaluations]);
  const accountsList = useMemo(() => Array.from(new Set(evaluations.map(e => e.account))), [evaluations]);
  const monthsList   = useMemo(() => Array.from(new Set(evaluations.map(e => e.month))), [evaluations]);

  // ─── Filter state ───────────────────────────────────────────────────────────

  const [searchQuery, setSearchQuery]               = useState('');
  const [filterAccount, setFilterAccount]           = useState('All');
  const [filterProject, setFilterProject]           = useState('All');
  const [filterManager, setFilterManager]           = useState('All');
  const [filterMonth, setFilterMonth]               = useState('All');
  const [filterHasReportees, setFilterHasReportees] = useState('All');
  const [filterRetentionRisk, setFilterRetentionRisk] = useState('All');

  // ─── Sort state ─────────────────────────────────────────────────────────────

  const [sortField, setSortField]         = useState<keyof PerformanceEvaluation>('employeeName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // ─── Pagination state ───────────────────────────────────────────────────────

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]       = useState(10);

  // ─── Modal state ────────────────────────────────────────────────────────────

  const [isAddModalOpen, setIsAddModalOpen]   = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEval, setEditingEval]         = useState<PerformanceEvaluation | null>(null);
  const [isSaving, setIsSaving]               = useState(false);

  // ─── Column visibility ────────────────────────────────────────────────────
  // Sourced from the same Customize Columns architecture used by Accounts,
  // Opportunities, and Action Items (performanceEvaluationColumnConfig).

  const displayedConfigs = performanceEvaluationColumnConfig.filter(col => col.isDisplayed);

  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  // ─── New eval form state ─────────────────────────────────────────────────

  // Scores and retention risk start EMPTY — the evaluator must enter every
  // score explicitly instead of inheriting a flattering default of 8.
  const UNSCORED = '' as unknown as number;

  const blankForm = (): Omit<PerformanceEvaluation, 'id' | 'createdAt' | 'updatedAt'> => ({
    accountId: '',
    projectId: '',
    account: '',
    project: '',
    employeeId: '',
    employeeName: '',
    manager: '',
    month: '',
    hasReportees: false,
    deliveryExcellence: UNSCORED,
    qualityStandards: UNSCORED,
    technicalCapability: UNSCORED,
    communication: UNSCORED,
    sla: UNSCORED,
    teamCollaboration: UNSCORED,
    reliability: UNSCORED,
    innovation: UNSCORED,
    ideation: UNSCORED,
    behavioural: UNSCORED,
    leadership: UNSCORED,
    customerFeedback: '',
    employeeFeedback: '',
    trainingRequired: '',
    strength: '',
    improvementArea: '',
    keyContributionDetails: '',
    ideaDetails: '',
    overallComment: '',
    actionItemNextMonth: '',
    retentionRisk: '' as PerformanceEvaluation['retentionRisk'],
  });

  const [newEval, setNewEval] = useState(blankForm);

  // ─── Score calculation ───────────────────────────────────────────────────

  const calculateScores = (item: Partial<PerformanceEvaluation>) => {
    // Coerce defensively: while the create form is being filled, score fields
    // may transiently hold '' (unscored) instead of a number.
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isNaN(n) ? 0 : n;
    };
    const scores = [
      num(item.deliveryExcellence), num(item.qualityStandards), num(item.technicalCapability),
      num(item.communication), num(item.sla), num(item.teamCollaboration),
      num(item.reliability), num(item.innovation), num(item.ideation), num(item.behavioural),
    ];
    if (item.hasReportees && item.leadership !== undefined) scores.push(num(item.leadership));
    const finalScore = scores.reduce((s, v) => s + v, 0) / scores.length;
    const q4Score =
      ((item.deliveryExcellence ?? 0) * 0.25) +
      ((item.technicalCapability ?? 0) * 0.20) +
      ((item.innovation ?? 0) * 0.20) +
      ((item.qualityStandards ?? 0) * 0.15) +
      ((item.sla ?? 0) * 0.10) +
      ((item.teamCollaboration ?? 0) * 0.10);
    return {
      finalScore: Number(finalScore.toFixed(2)),
      q4Score: Number(q4Score.toFixed(2)),
    };
  };

  // ─── Inline cell editing ─────────────────────────────────────────────────

  const [editingCell, setEditingCell] = useState<{ id: string; key: keyof PerformanceEvaluation; value: any } | null>(null);

  const saveInlineCell = async (id: string, key: keyof PerformanceEvaluation, value: any, extraFields?: Partial<PerformanceEvaluation>) => {
    const target = evaluations.find(e => e.id === id);
    if (!target) return;

    let nextValue = value;
    if (typeof target[key] === 'number') {
      nextValue = Number(value);
      if (isNaN(nextValue)) nextValue = target[key];
      // Only the fixed 1–10 score metrics are clamped — custom numeric columns are unbounded.
      if (NUMERIC_METRIC_KEYS.has(key as string)) nextValue = Math.max(0, Math.min(10, nextValue));
    } else if (typeof target[key] === 'boolean') {
      nextValue = value === 'true' || value === true;
    }

    const updated = { ...target, [key]: nextValue, ...(extraFields || {}) };
    try {
      const saved = await performanceEvaluationsApi.update(id, updated);
      setEvaluations(prev => prev.map(e => e.id === id ? saved : e));
      loadSummary();
    } catch {
      // revert on error — original data stays in state
    }
    setEditingCell(null);
  };

  // ─── Sort handler ─────────────────────────────────────────────────────────

  const handleSort = (field: keyof PerformanceEvaluation) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  // ─── Processed / paginated data ──────────────────────────────────────────

  const processedEvaluations = useMemo(() => {
    return evaluations.map(e => {
      const { finalScore, q4Score } = calculateScores(e);
      return { ...e, finalScore, q4Score };
    }).filter(e => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        e.employeeName.toLowerCase().includes(q) ||
        e.project.toLowerCase().includes(q) ||
        e.account.toLowerCase().includes(q) ||
        e.manager.toLowerCase().includes(q) ||
        e.overallComment.toLowerCase().includes(q) ||
        e.strength.toLowerCase().includes(q) ||
        e.improvementArea.toLowerCase().includes(q);

      const matchesAccount   = filterAccount === 'All'       || e.account === filterAccount;
      const matchesProject   = filterProject === 'All'       || e.project === filterProject;
      const matchesManager   = filterManager === 'All'       || e.manager === filterManager;
      const matchesMonth     = filterMonth === 'All'         || e.month === filterMonth;
      const matchesReportees =
        filterHasReportees === 'All' ||
        (filterHasReportees === 'Yes' && e.hasReportees) ||
        (filterHasReportees === 'No' && !e.hasReportees);
      const matchesRetention = filterRetentionRisk === 'All' || e.retentionRisk === filterRetentionRisk;

      return matchesSearch && matchesAccount && matchesProject && matchesManager && matchesMonth && matchesReportees && matchesRetention;
    }).sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];
      if (aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
      if (bVal === undefined) return sortDirection === 'asc' ? -1 : 1;
      if (typeof aVal === 'boolean') {
        return sortDirection === 'asc' ? (aVal ? 1 : 0) - (bVal ? 1 : 0) : (bVal ? 1 : 0) - (aVal ? 1 : 0);
      }
      if (typeof aVal === 'number') {
        return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
      }
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [evaluations, searchQuery, filterAccount, filterProject, filterManager, filterMonth, filterHasReportees, filterRetentionRisk, sortField, sortDirection]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(processedEvaluations.length / pageSize) || 1;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginatedEvaluations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedEvaluations.slice(start, start + pageSize);
  }, [processedEvaluations, currentPage, pageSize]);

  // ─── CSV export ────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    const visibleCols = displayedConfigs;
    const headers = visibleCols.map(col => `"${col.name.replace(/"/g, '""')}"`).join(',');
    const rows = processedEvaluations.map(e =>
      visibleCols.map(col => {
        let val = (e as any)[col.key];
        if (typeof val === 'boolean') val = val ? 'Yes' : 'No';
        else if (val === undefined || val === null) val = 'N/A';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','),
    );
    const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Performance_Evaluations_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // ─── CRUD handlers ────────────────────────────────────────────────────────

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEval.employeeId || (!newEval.accountId && !newEval.account) || (!newEval.projectId && !newEval.project) || !newEval.retentionRisk) return;
    setIsSaving(true);
    try {
      // Coerce score fields to numbers and drop leadership when the employee
      // has no reportees — the API expects it absent, not empty.
      const { leadership, ...rest } = newEval;
      const payload: typeof newEval = {
        ...rest,
        deliveryExcellence:  Number(newEval.deliveryExcellence),
        qualityStandards:    Number(newEval.qualityStandards),
        technicalCapability: Number(newEval.technicalCapability),
        communication:       Number(newEval.communication),
        sla:                 Number(newEval.sla),
        teamCollaboration:   Number(newEval.teamCollaboration),
        reliability:         Number(newEval.reliability),
        innovation:          Number(newEval.innovation),
        ideation:            Number(newEval.ideation),
        behavioural:         Number(newEval.behavioural),
        ...(newEval.hasReportees ? { leadership: Number(leadership) } : {}),
      };
      const created = await performanceEvaluationsApi.create(payload);
      setEvaluations(prev => [created, ...prev]);
      loadSummary();
      setIsAddModalOpen(false);
      setNewEval(blankForm());
    } catch {
      // keep modal open on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (evalItem: PerformanceEvaluation) => {
    setEditingEval({ ...evalItem });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEval) return;
    setIsSaving(true);
    try {
      const saved = await performanceEvaluationsApi.update(editingEval.id, editingEval);
      setEvaluations(prev => prev.map(item => item.id === editingEval.id ? saved : item));
      loadSummary();
      setIsEditModalOpen(false);
      setEditingEval(null);
    } catch {
      // keep modal open on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this performance evaluation record?')) return;
    try {
      await performanceEvaluationsApi.delete(id);
      setEvaluations(prev => prev.filter(item => item.id !== id));
      loadSummary();
    } catch {
      // ignore
    }
  };

  // ─── Loading / error state ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
        <span className="ml-3 text-sm font-semibold text-slate-500">Loading evaluations…</span>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadEvaluations} />;
  }

  // ─── Shared form section renderers ───────────────────────────────────────

  const renderGeneralFields = (vals: any, set: (v: any) => void) => {
    const selectedAccId = vals.accountId || (accounts.find(a => a.name.toLowerCase() === (vals.account || '').toLowerCase())?.id ?? '');
    const availableProjects = selectedAccId
      ? projects.filter(p => p.accountId === selectedAccId)
      : [];
    const selectedProjId = vals.projectId || (projects.find(p => p.name.toLowerCase() === (vals.project || '').toLowerCase())?.id ?? '');

    return (
      <div className="space-y-4">
        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 border-b pb-1">A. Operational Context</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-600 uppercase tracking-wide">Employee</label>
            {/* Evaluations are restricted to Employee Master entries — no free-text names. */}
            <select required value={vals.employeeId ?? ''}
              onChange={e => {
                const emp = employees.find(x => x.id === e.target.value);
                set({ ...vals, employeeId: e.target.value, employeeName: emp ? employeeLabel(emp) : '' });
              }}
              className="w-full p-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 text-xs focus:outline-none">
              <option value="" disabled>
                {employees.length ? 'Select employee…' : 'No employees in Employee Master'}
              </option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{employeeLabel(emp)}</option>
              ))}
            </select>
            {vals.employeeName && !vals.employeeId && (
              <p className="text-[10px] text-amber-600 font-medium">
                Legacy record for “{vals.employeeName}” — select the matching employee to link it.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="font-bold text-slate-600 uppercase tracking-wide">Account Client</label>
            <SearchableSelect
              value={selectedAccId}
              onChange={(accId) => {
                const acc = accounts.find(a => a.id === accId);
                const accName = acc ? acc.name : '';
                const currentProj = projects.find(p => p.id === selectedProjId);
                const projMatches = currentProj && currentProj.accountId === accId;
                set({
                  ...vals,
                  accountId: accId,
                  account: accName,
                  ...(projMatches ? {} : { projectId: '', project: '' }),
                });
              }}
              options={accounts.map(a => ({ value: a.id, label: a.name }))}
              placeholder="Search account…"
              aria-label="Account Client"
            />
            {vals.account && !selectedAccId && (
              <p className="text-[10px] text-amber-600 font-medium">
                Legacy record for “{vals.account}” — select the matching account to link it.
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="font-bold text-slate-600 uppercase tracking-wide">Project Name</label>
            <SearchableSelect
              value={selectedProjId}
              onChange={(projId) => {
                const proj = projects.find(p => p.id === projId);
                const projName = proj ? proj.name : '';
                const projAcc = proj ? accounts.find(a => a.id === proj.accountId) : undefined;
                set({
                  ...vals,
                  projectId: projId,
                  project: projName,
                  ...(projAcc && !selectedAccId ? { accountId: projAcc.id, account: projAcc.name } : {}),
                });
              }}
              options={availableProjects.map(p => ({ value: p.id, label: p.name }))}
              placeholder={selectedAccId ? (availableProjects.length ? "Search project…" : "No projects under this Account") : "Select an Account first…"}
              aria-label="Project Name"
              disabled={!selectedAccId}
            />
            {vals.project && !selectedProjId && (
              <p className="text-[10px] text-amber-600 font-medium">
                Legacy record for “{vals.project}” — select the matching project to link it.
              </p>
            )}
          </div>
        <div className="space-y-1">
          <label className="font-bold text-slate-600 uppercase tracking-wide">Manager</label>
          <input type="text" required value={vals.manager}
            onChange={e => set({ ...vals, manager: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-xs focus:outline-none" />
        </div>
        <div className="space-y-1">
          <label className="font-bold text-slate-600 uppercase tracking-wide">Evaluation Period (Month)</label>
          <input type="text" required value={vals.month}
            onChange={e => set({ ...vals, month: e.target.value })}
            placeholder="e.g. June 2026"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 text-xs focus:outline-none" />
        </div>
        <div className="space-y-1">
          <label className="font-bold text-slate-600 uppercase tracking-wide">Retention Risk</label>
          <select required value={vals.retentionRisk} onChange={e => set({ ...vals, retentionRisk: e.target.value as any })}
            className="w-full p-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 text-xs focus:outline-none">
            <option value="" disabled>Select risk level…</option>
            <option value="Low">Low Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="High">High Risk</option>
          </select>
        </div>
        <div className="md:col-span-3 flex items-center h-10 bg-slate-50 px-3 rounded-lg border">
          <input type="checkbox" id="hasReportees_form" checked={vals.hasReportees}
            onChange={e => set({ ...vals, hasReportees: e.target.checked })}
            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" />
          <label htmlFor="hasReportees_form" className="font-bold text-slate-700 ml-2 cursor-pointer text-xs">
            This employee has active reportees (Enables Leadership Score metric)
          </label>
        </div>
      </div>
    </div>
  );
};

  const renderScoreFields = (vals: any, set: (v: any) => void) => (
    <div className="space-y-4">
      <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 border-b pb-1">B. Performance Dimension Scores (1 – 10)</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-xs">
        {[
          ['deliveryExcellence', 'Delivery Excellence'],
          ['qualityStandards', 'Quality Standards'],
          ['technicalCapability', 'Technical Capability'],
          ['communication', 'Communication'],
          ['sla', 'SLA Performance'],
          ['teamCollaboration', 'Team Collaboration'],
          ['reliability', 'Reliability'],
          ['innovation', 'Innovation & AI Adoption'],
          ['ideation', 'Ideation'],
          ['behavioural', 'Behavioural Competency'],
        ].map(([field, label]) => (
          <div key={field} className="space-y-1">
            <label className="font-bold text-slate-600">{label}</label>
            <input type="number" min="0" max="10" step="0.5" required value={(vals as any)[field]}
              onChange={e => set({ ...vals, [field]: e.target.value === '' ? '' : Number(e.target.value) })}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none" />
          </div>
        ))}
        {vals.hasReportees && (
          <div className="space-y-1">
            <label className="font-bold text-slate-600">Leadership</label>
            <input type="number" min="0" max="10" step="0.5" required value={vals.leadership ?? ''}
              onChange={e => set({ ...vals, leadership: e.target.value === '' ? '' : Number(e.target.value) })}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none" />
          </div>
        )}
      </div>
    </div>
  );

  const renderQualitativeFields = (vals: any, set: (v: any) => void) => (
    <div className="space-y-4">
      <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 border-b pb-1">C. Qualitative Assessments</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <label className="font-bold text-slate-600">Customer Feedback Details</label>
          <textarea rows={2} value={vals.customerFeedback}
            onChange={e => set({ ...vals, customerFeedback: e.target.value })}
            className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Client remarks, SLA testimonials…" />
        </div>
        <div className="space-y-1">
          <label className="font-bold text-slate-600">Employee Feedback Remarks</label>
          <textarea rows={2} value={vals.employeeFeedback}
            onChange={e => set({ ...vals, employeeFeedback: e.target.value })}
            className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Developer needs, timeline sentiments…" />
        </div>
        {[
          ['trainingRequired', 'Training / Upskilling Required', 'e.g. React Performance, Docker Compliance'],
          ['strength', 'Core Strength Area', 'Identify 1 or 2 key strength vectors'],
          ['improvementArea', 'Target Area for Improvement', 'Target metrics to scale up next month'],
          ['keyContributionDetails', 'Key Contribution Details', 'Quantified delivery highlights'],
          ['ideaDetails', 'Idea Details Proposed', 'Process or tool optimization suggestions'],
          ['actionItemNextMonth', 'Action Item for Next Month', 'Task/deliverable milestones for next period'],
        ].map(([field, label, placeholder]) => (
          <div key={field} className="space-y-1">
            <label className="font-bold text-slate-600">{label}</label>
            <input type="text" value={(vals as any)[field]}
              onChange={e => set({ ...vals, [field]: e.target.value })}
              placeholder={placeholder}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        ))}
        <div className="space-y-1 md:col-span-2">
          <label className="font-bold text-slate-600">Overall Evaluator Comment</label>
          <textarea rows={2} required value={vals.overallComment}
            onChange={e => set({ ...vals, overallComment: e.target.value })}
            className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Comprehensive summary of review" />
        </div>
      </div>
    </div>
  );

  // ─── Cell render helper ──────────────────────────────────────────────────

  const renderCell = (evalItem: PerformanceEvaluation & { finalScore?: number; q4Score?: number }, col: ColumnConfig) => {
    const cellKey = col.key as keyof PerformanceEvaluation;
    const cellVal = (evalItem as any)[cellKey];
    const isCalculated = (cellKey as string) === 'finalScore' || (cellKey as string) === 'q4Score';
    const isEditingThis = editingCell?.id === evalItem.id && editingCell?.key === cellKey;

    if (isEditingThis) {
      if (cellKey === 'account' || cellKey === 'accountId') {
        const curAccId = evalItem.accountId || (accounts.find(a => a.name.toLowerCase() === (evalItem.account || '').toLowerCase())?.id ?? '');
        return (
          <div className="min-w-[160px]" onClick={e => e.stopPropagation()}>
            <SearchableSelect
              value={curAccId}
              onChange={(accId) => {
                const acc = accounts.find(a => a.id === accId);
                const accName = acc ? acc.name : '';
                const curProjId = evalItem.projectId || (projects.find(p => p.name.toLowerCase() === (evalItem.project || '').toLowerCase())?.id ?? '');
                const currentProj = projects.find(p => p.id === curProjId);
                const projMatches = currentProj && currentProj.accountId === accId;
                saveInlineCell(evalItem.id, 'accountId', accId, {
                  account: accName,
                  ...(projMatches ? {} : { projectId: '', project: '' }),
                });
              }}
              options={accounts.map(a => ({ value: a.id, label: a.name }))}
              placeholder="Search account…"
              aria-label="Account Client"
            />
          </div>
        );
      } else if (cellKey === 'project' || cellKey === 'projectId') {
        const curAccId = evalItem.accountId || (accounts.find(a => a.name.toLowerCase() === (evalItem.account || '').toLowerCase())?.id ?? '');
        const availableProjects = curAccId ? projects.filter(p => p.accountId === curAccId) : projects;
        const curProjId = evalItem.projectId || (projects.find(p => p.name.toLowerCase() === (evalItem.project || '').toLowerCase())?.id ?? '');
        return (
          <div className="min-w-[160px]" onClick={e => e.stopPropagation()}>
            <SearchableSelect
              value={curProjId}
              onChange={(projId) => {
                const proj = projects.find(p => p.id === projId);
                const projName = proj ? proj.name : '';
                const projAcc = proj ? accounts.find(a => a.id === proj.accountId) : undefined;
                saveInlineCell(evalItem.id, 'projectId', projId, {
                  project: projName,
                  ...(projAcc && !curAccId ? { accountId: projAcc.id, account: projAcc.name } : {}),
                });
              }}
              options={availableProjects.map(p => ({ value: p.id, label: p.name }))}
              placeholder={curAccId ? (availableProjects.length ? "Search project…" : "No projects under this Account") : "Select an Account first…"}
              aria-label="Project Name"
              disabled={!curAccId}
            />
          </div>
        );
      } else if (NUMERIC_METRIC_KEYS.has(col.key)) {
        return (
          <input type="number" min="0" max="10" autoFocus value={editingCell.value}
            onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
            onBlur={() => saveInlineCell(evalItem.id, cellKey, editingCell.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveInlineCell(evalItem.id, cellKey, editingCell.value); if (e.key === 'Escape') setEditingCell(null); }}
            className="w-16 px-1.5 py-0.5 border border-indigo-500 rounded focus:outline-none" />
        );
      } else if (cellKey === 'hasReportees') {
        return (
          <select autoFocus value={editingCell.value ? 'true' : 'false'}
            onChange={e => setEditingCell({ ...editingCell, value: e.target.value === 'true' })}
            onBlur={() => saveInlineCell(evalItem.id, cellKey, editingCell.value)}
            className="px-1 py-0.5 border border-indigo-500 rounded focus:outline-none bg-white">
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      } else if (cellKey === 'retentionRisk') {
        return (
          <select autoFocus value={editingCell.value}
            onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
            onBlur={() => saveInlineCell(evalItem.id, cellKey, editingCell.value)}
            className="px-1 py-0.5 border border-indigo-500 rounded focus:outline-none bg-white">
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        );
      } else {
        return (
          <input type="text" autoFocus value={editingCell.value}
            onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
            onBlur={() => saveInlineCell(evalItem.id, cellKey, editingCell.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveInlineCell(evalItem.id, cellKey, editingCell.value); if (e.key === 'Escape') setEditingCell(null); }}
            className="w-full min-w-[120px] px-2 py-0.5 border border-indigo-500 rounded focus:outline-none" />
        );
      }
    }

    if (cellKey === 'hasReportees') {
      return (
        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${cellVal ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-600'}`}>
          {cellVal ? 'Yes' : 'No'}
        </span>
      );
    }
    if (cellKey === 'retentionRisk') {
      return <StatusBadge value={cellVal} colorMap={RETENTION_RISK_COLORS} shape="rounded" />;
    }
    if (isCalculated) {
      const n = Number(cellVal);
      return (
        <span className={`font-mono font-bold text-xs ${n >= 8.5 ? 'text-green-600' : n < 7.0 ? 'text-red-500' : 'text-slate-800'}`}>
          {cellVal}
        </span>
      );
    }
    if (cellKey === 'leadership' && !evalItem.hasReportees) {
      return <span className="text-slate-400 italic text-[10px] bg-slate-50 px-1.5 py-0.5 rounded">N/A (No reportees)</span>;
    }
    if (NUMERIC_METRIC_KEYS.has(col.key)) {
      const n = Number(cellVal || 0);
      return (
        <div className="flex items-center space-x-2">
          <span className="font-mono font-bold text-slate-800">{n}</span>
          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden lg:block">
            <div className={`h-full rounded-full ${n >= 8 ? 'bg-green-500' : n >= 6 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${n * 10}%` }} />
          </div>
        </div>
      );
    }
    // Custom columns: boolean gets a Yes/No badge like the fixed hasReportees field; everything else is plain text.
    if (!col.isStandard && col.type === 'boolean') {
      return (
        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${cellVal ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-600'}`}>
          {cellVal ? 'Yes' : 'No'}
        </span>
      );
    }
    return (
      <span className="truncate max-w-[200px] block font-medium" title={String(cellVal || '')}>
        {String(cellVal ?? '-')}
      </span>
    );
  };

  // ─── JSX ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Performance Evaluations"
        subtitle="Analyze, track, and optimize professional delivery metrics, feedback loops, and AI adoption records."
        actions={<>
          <Button variant="secondary" icon={<Settings2 className="w-4 h-4 text-slate-400" aria-hidden="true" />} onClick={() => setIsCustomizerOpen(true)}>Customize Columns</Button>
          <Button variant="secondary" icon={<Download className="w-4 h-4 text-slate-400" aria-hidden="true" />} onClick={handleExportCSV}>Export CSV</Button>
          <Button size="md" icon={<Plus className="w-4 h-4" aria-hidden="true" />} onClick={() => setIsAddModalOpen(true)}>Add Evaluation</Button>
        </>}
      />

      {/* Reporting summary — server-side per-employee aggregates */}
      {summaryRows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Employees Evaluated"
            value={summaryRows.length}
            icon={<Users className="w-4.5 h-4.5" />}
            tone="blue"
          />
          <SummaryCard
            label="Total Evaluations"
            value={summaryRows.reduce((s, r) => s + r.evaluations, 0)}
            icon={<ClipboardList className="w-4.5 h-4.5" />}
            tone="emerald"
          />
          <SummaryCard
            label="Average Score"
            value={
              <span className="text-indigo-600">
                {(summaryRows.reduce((s, r) => s + r.averageScore * r.evaluations, 0)
                  / Math.max(1, summaryRows.reduce((s, r) => s + r.evaluations, 0))).toFixed(2)}
              </span>
            }
            icon={<TrendingUp className="w-4.5 h-4.5" />}
            tone="purple"
          />
          <SummaryCard
            label="High Retention Risk"
            value={
              <span className={summaryRows.some(r => r.latestRetentionRisk === 'High') ? 'text-red-600' : ''}>
                {summaryRows.filter(r => r.latestRetentionRisk === 'High').length}
              </span>
            }
            icon={<AlertTriangle className="w-4.5 h-4.5" />}
            tone="amber"
          />
        </div>
      )}

      {/* Filters */}
      <FilterBar className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="col-span-1 sm:col-span-2">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search name, text feedback…" className="w-full" />
        </div>
        <FilterSelect label="Account" hideLabel value={filterAccount} onChange={setFilterAccount}
          options={[{ value: 'All', label: 'All Accounts' }, ...accountsList.map(o => ({ value: o, label: o }))]} />
        <FilterSelect label="Project" hideLabel value={filterProject} onChange={setFilterProject}
          options={[{ value: 'All', label: 'All Projects' }, ...projectsList.map(o => ({ value: o, label: o }))]} />
        <FilterSelect label="Manager" hideLabel value={filterManager} onChange={setFilterManager}
          options={[{ value: 'All', label: 'All Managers' }, ...managersList.map(o => ({ value: o, label: o }))]} />
        <FilterSelect label="Month" hideLabel value={filterMonth} onChange={setFilterMonth}
          options={[{ value: 'All', label: 'All Months' }, ...monthsList.map(o => ({ value: o, label: o }))]} />
        <FilterSelect label="Has Reportees" hideLabel value={filterHasReportees} onChange={setFilterHasReportees}
          options={[{ value: 'All', label: 'All Staff' }, { value: 'Yes', label: 'Yes (Managers/Leads)' }, { value: 'No', label: 'No (Ind. Contributors)' }]} />
        <FilterSelect label="Retention Risk" hideLabel value={filterRetentionRisk} onChange={setFilterRetentionRisk}
          options={[{ value: 'All', label: 'All Risks' }, { value: 'Low', label: 'Low Risk' }, { value: 'Medium', label: 'Medium Risk' }, { value: 'High', label: 'High Risk' }]} />
      </FilterBar>

      {/* Table */}
      <Card
        padding="none"
        clip
        className="flex flex-col"
        title={
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4.5 h-4.5 text-green-600" />
            <span className="uppercase tracking-wider text-slate-700 text-xs font-bold">Evaluations Ledger (Excel View)</span>
            <span className="bg-indigo-50 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-mono">
              {processedEvaluations.length} RECORDS FOUND
            </span>
          </div>
        }
        actions={
          <span className="text-[10px] text-slate-400 font-medium hidden md:block">
            💡 Double-click cells to edit scores. Click headers to sort.
          </span>
        }
      >
        <div className="overflow-x-auto w-full custom-scrollbar">
          <Table size="xs" className="select-none">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 select-none">
                <th className="px-3 py-3 w-10 text-center font-mono text-[10px] bg-slate-100/80 text-slate-400 border-r border-slate-200 sticky left-0 z-10">#</th>
                <th className="px-4 py-3 min-w-[120px] border-r border-slate-200 sticky left-10 bg-slate-100 z-10">
                  <SortableHeader
                    label="Employee Name"
                    field="employeeName"
                    sortField={sortField as string}
                    sortDirection={sortDirection}
                    onSort={(f) => handleSort(f as keyof PerformanceEvaluation)}
                  />
                </th>
                {displayedConfigs.filter(col => col.key !== 'employeeName').map(col => (
                  <th key={col.key} className="px-4 py-3 min-w-[150px] max-w-[280px] border-r border-slate-200 font-semibold">
                    <SortableHeader
                      label={col.name}
                      field={col.key}
                      sortField={sortField as string}
                      sortDirection={sortDirection}
                      onSort={(f) => handleSort(f as keyof PerformanceEvaluation)}
                      className="truncate"
                    />
                  </th>
                ))}
                <th className="px-4 py-3 w-20 text-center font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEvaluations.length === 0 ? (
                <EmptyRow colSpan={32} message='No evaluations match the active filter criteria. Click "Add Evaluation" to create a new one.' />
              ) : (
                paginatedEvaluations.map((evalItem, idx) => {
                  const numIndex = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={evalItem.id} className="hover:bg-slate-50/50 border-b border-slate-200/80 transition-colors group text-slate-800">
                      <td className="text-center font-mono text-[10px] bg-slate-50/65 text-slate-500 border-r border-slate-200 py-3 sticky left-0 z-10 group-hover:bg-slate-100">
                        {numIndex}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 border-r border-slate-200 sticky left-10 bg-white group-hover:bg-slate-50 z-10 cursor-cell"
                        onDoubleClick={() => setEditingCell({ id: evalItem.id, key: 'employeeName', value: evalItem.employeeId || '' })}>
                        {editingCell?.id === evalItem.id && (editingCell?.key === 'employeeName' || editingCell?.key === 'employeeId') ? (
                          <select
                            autoFocus
                            value={evalItem.employeeId ?? ''}
                            onChange={(e) => {
                              const emp = employees.find(x => x.id === e.target.value);
                              if (emp) {
                                saveInlineCell(evalItem.id, 'employeeId', emp.id, { employeeName: emp.name || emp.email });
                              }
                            }}
                            onBlur={() => setEditingCell(null)}
                            className="text-xs p-1 border border-indigo-500 rounded bg-white w-full min-w-[140px]"
                          >
                            <option value="" disabled>Select employee…</option>
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>{employeeLabel(emp)}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span>{evalItem.employeeName}</span>
                            {evalItem.hasReportees && (
                              <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded shrink-0 ml-1">MGR</span>
                            )}
                          </div>
                        )}
                      </td>
                      {displayedConfigs.filter(col => col.key !== 'employeeName').map(col => {
                        const cellKey = col.key as keyof PerformanceEvaluation;
                        const isCalculated = (cellKey as string) === 'finalScore' || (cellKey as string) === 'q4Score';
                        return (
                          <td key={col.key}
                            onDoubleClick={() => {
                              if (!isCalculated) setEditingCell({ id: evalItem.id, key: cellKey, value: (evalItem as any)[cellKey] ?? '' });
                            }}
                            className={`px-4 py-3 border-r border-slate-200 cursor-cell transition-all ${isCalculated ? 'bg-slate-50/30' : 'hover:bg-indigo-50/20'}`}>
                            {renderCell(evalItem, col)}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <RowActionButton intent="edit" label="Edit evaluation" icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => handleEditClick(evalItem)} />
                          {canDeleteEvaluation && (
                            <RowActionButton intent="delete" label="Delete record" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDeleteClick(evalItem.id)} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        {/* Pagination */}
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          totalItems={processedEvaluations.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          itemLabel="evaluations"
        />
      </Card>

      {/* Score formula note */}
      <div className="bg-gradient-to-br from-indigo-50/80 to-white border border-indigo-200/70 rounded-xl p-4 flex items-start gap-3 text-xs leading-relaxed text-indigo-900/90 shadow-sm">
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/15">
          <Info className="w-4.5 h-4.5" />
        </div>
        <div className="space-y-1 pt-0.5">
          <p className="font-extrabold text-indigo-950 uppercase tracking-wider text-[10px]">Calculated Fields Formula Guide</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Final Score:</strong> Plain mathematical average of all active score dimensions (10 standard metrics, plus <em>Leadership</em> only if reportees are enabled). Range is 1.00 to 10.00.</li>
            <li><strong>Q4 2025 Score:</strong> Weighted index: <em>Delivery Excellence</em> (25%), <em>Technical Capability</em> (20%), <em>Innovation &amp; AI</em> (20%), <em>Quality Standards</em> (15%), <em>SLA compliance</em> (10%), and <em>Team Collaboration</em> (10%).</li>
          </ul>
        </div>
      </div>

      {/* Column Customizer Sidebar — shared architecture also used by Accounts, Opportunities, Action Items */}
      <CustomizeColumnsSidebar
        module="performanceEvaluation"
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
      />

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={() => setIsAddModalOpen(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Plus className="w-5 h-5" aria-hidden="true" /></div>
                  <div>
                    <h3 className="font-bold text-slate-800 tracking-tight text-sm">Add New Performance Evaluation</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Create comprehensive ledger record</p>
                  </div>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
              <form onSubmit={handleAddSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {renderGeneralFields(newEval, setNewEval)}
                {renderScoreFields(newEval, setNewEval)}
                {renderQualitativeFields(newEval, setNewEval)}
                <CustomColumnFields
                  columns={performanceEvaluationColumns}
                  config={performanceEvaluationColumnConfig}
                  values={newEval}
                  onChange={(key, value) => setNewEval({ ...newEval, [key]: value })}
                />
                <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100">
                  <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSaving} icon={isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : undefined}>Save Record</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingEval && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4"
            onClick={() => setIsEditModalOpen(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Pencil className="w-5 h-5" aria-hidden="true" /></div>
                  <div>
                    <h3 className="font-bold text-slate-800 tracking-tight text-sm">Edit Performance Evaluation</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Modify Record of {editingEval.employeeName}</p>
                  </div>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {renderGeneralFields(editingEval, setEditingEval)}
                {renderScoreFields(editingEval, setEditingEval)}
                {renderQualitativeFields(editingEval, setEditingEval)}
                <CustomColumnFields
                  columns={performanceEvaluationColumns}
                  config={performanceEvaluationColumnConfig}
                  values={editingEval}
                  onChange={(key, value) => setEditingEval(prev => (prev ? { ...prev, [key]: value } : prev))}
                />
                <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100">
                  <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSaving} icon={isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : undefined}>Save Changes</Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
