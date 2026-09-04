import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { npsApi } from '@/api/crm.api';
import type { NpsResponse } from '@/types';
import { NpsFormModal, getNpsClassification } from './NpsFormModal';
import { LoadingState } from '@/components/common/LoadingState';
import {
  Plus, Search, Star, AlertCircle, Smile, Meh, Frown,
  Trash2, Edit, MessageSquare, Calendar, UserCheck
} from 'lucide-react';

export function formatMonthYear(val: string): string {
  if (!val) return '';
  const match = String(val).match(/^(\d{4})-(\d{2})/);
  if (!match) return val;
  const year = match[1];
  const monthIdx = parseInt(match[2], 10) - 1;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${monthNames[monthIdx]} ${year}`;
  }
  return val;
}

export interface NpsTabProps {
  accountId: string;
  accountName?: string;
  projectId?: string;
}

export const NpsTab: React.FC<NpsTabProps> = ({ accountId, accountName = '', projectId }) => {
  const { projects: allProjects, stakeholders: allStakeholders } = useCRM();

  const projects = useMemo(
    () => (allProjects || []).filter((p) => p.accountId === accountId),
    [allProjects, accountId],
  );

  const stakeholders = useMemo(
    () => (allStakeholders || []).filter((s) => s.accountId === accountId && (s.stakeholderType === 'CLIENT' || !s.stakeholderType)),
    [allStakeholders, accountId],
  );

  const [responses, setResponses] = useState<NpsResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter & Search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [classificationFilter, setClassificationFilter] = useState<'ALL' | 'PROMOTER' | 'PASSIVE' | 'DETRACTOR'>('ALL');
  const [quarterFilter, setQuarterFilter] = useState<string>('ALL');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<NpsResponse | null>(null);

  const fetchNpsData = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const data = await npsApi.getAll({ accountId, projectId });
      setResponses(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load NPS responses.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNpsData();
  }, [accountId, projectId]);

  // Derived NPS Summary Metrics
  const metrics = useMemo(() => {
    if (!responses.length) return { avgScore: 0, promotersPct: 0, passivesPct: 0, detractorsPct: 0, total: 0 };
    const total = responses.length;
    const sum = responses.reduce((acc, r) => acc + r.npsScore, 0);
    const promoters = responses.filter((r) => r.npsScore >= 9).length;
    const passives = responses.filter((r) => r.npsScore >= 7 && r.npsScore <= 8).length;
    const detractors = responses.filter((r) => r.npsScore <= 6).length;

    return {
      avgScore: Number((sum / total).toFixed(1)),
      promotersCount: promoters,
      passivesCount: passives,
      detractorsCount: detractors,
      promotersPct: Math.round((promoters / total) * 100),
      passivesPct: Math.round((passives / total) * 100),
      detractorsPct: Math.round((detractors / total) * 100),
      total,
    };
  }, [responses]);

  // Available Quarters for filter
  const availableQuarters = useMemo(() => {
    const qSet = new Set<string>();
    responses.forEach((r) => {
      if (r.quarter) qSet.add(r.quarter);
    });
    return Array.from(qSet).sort();
  }, [responses]);

  // Filtered Responses
  const filteredResponses = useMemo(() => {
    return responses.filter((r) => {
      if (classificationFilter === 'PROMOTER' && r.npsScore < 9) return false;
      if (classificationFilter === 'PASSIVE' && (r.npsScore < 7 || r.npsScore > 8)) return false;
      if (classificationFilter === 'DETRACTOR' && r.npsScore > 6) return false;

      if (quarterFilter !== 'ALL' && r.quarter !== quarterFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchRespondent = (r.respondentName || '').toLowerCase().includes(q);
        const matchLiked = (r.likedMost || '').toLowerCase().includes(q);
        const matchImpr = (r.improvementSuggestions || '').toLowerCase().includes(q);
        const matchQuarter = (r.quarter || '').toLowerCase().includes(q);
        const matchDate = (r.receivedMonthYear || '').toLowerCase().includes(q);
        return matchRespondent || matchLiked || matchImpr || matchQuarter || matchDate;
      }
      return true;
    });
  }, [responses, classificationFilter, quarterFilter, searchTerm]);

  const handleCreateOrUpdate = async (dto: Omit<NpsResponse, 'id' | 'createdAt' | 'updatedAt' | 'quarter'>) => {
    if (editingItem) {
      await npsApi.update(editingItem.id, dto);
    } else {
      await npsApi.create(dto);
    }
    await fetchNpsData();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this NPS response?')) return;
    try {
      await npsApi.delete(id);
      await fetchNpsData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete NPS response.');
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading NPS responses..." />;
  }

  const emptyText = projectId
    ? 'No NPS feedback available for this Project.'
    : 'No NPS feedback available for this Account.';

  return (
    <div className="space-y-6">
      {/* ── NPS OVERVIEW SUMMARY SECTION ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Overall Score */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-4 rounded-xl shadow-sm border border-indigo-900 flex flex-col justify-between">
          <div className="text-xs font-medium text-slate-400">Overall NPS Score</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold">{responses.length ? metrics.avgScore : '—'}</span>
            <span className="text-xs text-slate-400">/ 10</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{metrics.total} Total Responses</div>
        </div>

        {/* Total Responses */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="text-xs font-semibold text-slate-500">Total Feedback</div>
          <div className="mt-2 text-3xl font-bold text-slate-800">{metrics.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">Customer Reviews</div>
        </div>

        {/* Promoters */}
        <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
            <span className="flex items-center gap-1.5"><Smile className="w-4 h-4 text-emerald-600" /> Promoters</span>
            <span>{metrics.promotersPct}%</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-900">{metrics.promotersCount}</div>
          <div className="text-[11px] text-emerald-700">Scores 9 – 10</div>
        </div>

        {/* Passives */}
        <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
            <span className="flex items-center gap-1.5"><Meh className="w-4 h-4 text-amber-600" /> Passives</span>
            <span>{metrics.passivesPct}%</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-900">{metrics.passivesCount}</div>
          <div className="text-[11px] text-amber-700">Scores 7 – 8</div>
        </div>

        {/* Detractors */}
        <div className="bg-rose-50/80 border border-rose-200 p-4 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-800">
            <span className="flex items-center gap-1.5"><Frown className="w-4 h-4 text-rose-600" /> Detractors</span>
            <span>{metrics.detractorsPct}%</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-900">{metrics.detractorsCount}</div>
          <div className="text-[11px] text-rose-700">Scores 0 – 6</div>
        </div>
      </div>

      {/* ── LIGHTWEIGHT SEARCH & FILTER BAR ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by respondent or feedback..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
            />
          </div>

          <select
            value={classificationFilter}
            onChange={(e) => setClassificationFilter(e.target.value as any)}
            className="text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700"
          >
            <option value="ALL">All Classifications</option>
            <option value="PROMOTER">Promoters (9-10)</option>
            <option value="PASSIVE">Passives (7-8)</option>
            <option value="DETRACTOR">Detractors (0-6)</option>
          </select>

          {availableQuarters.length > 0 && (
            <select
              value={quarterFilter}
              onChange={(e) => setQuarterFilter(e.target.value)}
              className="text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 font-medium text-slate-700"
            >
              <option value="ALL">All Quarters</option>
              {availableQuarters.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Add NPS Response
          </button>
        </div>
      </div>

      {/* ── CARD-BASED NPS RESPONSE CARDS GRID ─────────────────────────────────── */}
      {errorMsg ? (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {errorMsg}
        </div>
      ) : !filteredResponses.length ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-xl shadow-sm">
          <Star className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-slate-700">{emptyText}</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm || classificationFilter !== 'ALL' || quarterFilter !== 'ALL'
              ? 'No NPS feedback matches your current filter criteria.'
              : 'Add an NPS response to begin recording customer feedback.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredResponses.map((r) => {
            const cls = getNpsClassification(r.npsScore);

            return (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
              >
                {/* Header Row: Score Badge + Metadata + Action Buttons */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Numeric Score Pill */}
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-extrabold border shrink-0 ${cls.bg} ${cls.color}`}>
                      <span className="text-base leading-none">{r.npsScore}</span>
                      <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75 mt-0.5">/ 10</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold border ${cls.bg} ${cls.color}`}>
                          {cls.label}
                        </span>
                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 inline" />
                          {formatMonthYear(r.receivedMonthYear)} · <span className="font-semibold text-indigo-700">{r.quarter}</span>
                        </span>
                      </div>

                      <div className="text-xs font-bold text-slate-900 truncate mt-1 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          Respondent: {r.respondentName || 'Anonymous / Unspecified'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(r);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit response"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Delete response"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Feedback Content Blocks */}
                <div className="space-y-3 flex-1 text-xs">
                  {/* Positive Feedback */}
                  <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                    <span className="font-bold text-emerald-900 block mb-1">
                      What do you like the most about Reflections?
                    </span>
                    <p className="text-slate-700 leading-relaxed font-normal">
                      {r.likedMost || <span className="text-slate-400 italic">No feedback provided.</span>}
                    </p>
                  </div>

                  {/* Improvement Suggestions */}
                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg">
                    <span className="font-bold text-slate-800 block mb-1">
                      How can we improve your experience?
                    </span>
                    <p className="text-slate-700 leading-relaxed font-normal">
                      {r.improvementSuggestions || <span className="text-slate-400 italic">No suggestions provided.</span>}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── NPS FORM MODAL (ADD / EDIT) ────────────────────────────────────────── */}
      {isModalOpen && (
        <NpsFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingItem(null);
          }}
          onSubmit={handleCreateOrUpdate}
          initialData={editingItem}
          accountId={accountId}
          accountName={accountName}
          projectId={projectId}
          projects={projects}
          stakeholders={stakeholders}
        />
      )}
    </div>
  );
};
