import React, { useState, useEffect, useMemo } from 'react';
import { FormModal, FormSection, FormField, FormGrid, INPUT_CLS_AMBER } from '@/components/ui';
import { Star, MessageSquare, UserCheck, Calendar, ThumbsUp, HeartHandshake } from 'lucide-react';
import type { NpsResponse, Stakeholder, Project } from '@/types';

export function deriveQuarterFromMonthYear(val: string): string {
  if (!val) return 'Q1';
  const match = String(val).match(/^(\d{4})-(\d{2})/);
  if (!match) return 'Q1';
  const month = parseInt(match[2], 10);
  if (isNaN(month) || month < 1 || month > 12) return 'Q1';
  if (month >= 4 && month <= 6) return 'Q1';
  if (month >= 7 && month <= 9) return 'Q2';
  if (month >= 10 && month <= 12) return 'Q3';
  return 'Q4';
}

export function getNpsClassification(score: number): {
  label: 'Promoter' | 'Passive' | 'Detractor';
  color: string;
  bg: string;
  badgeBg: string;
  description: string;
} {
  if (score >= 9) {
    return {
      label: 'Promoter',
      color: 'text-emerald-800 font-bold',
      bg: 'bg-emerald-50/90 border-emerald-200',
      badgeBg: 'bg-emerald-600 text-white',
      description: 'Highly satisfied customer likely to recommend Reflections.',
    };
  }
  if (score >= 7) {
    return {
      label: 'Passive',
      color: 'text-amber-800 font-bold',
      bg: 'bg-amber-50/90 border-amber-200',
      badgeBg: 'bg-amber-500 text-white',
      description: 'Satisfied but unenthusiastic customer vulnerable to competitive offers.',
    };
  }
  return {
    label: 'Detractor',
    color: 'text-rose-800 font-bold',
    bg: 'bg-rose-50/90 border-rose-200',
    badgeBg: 'bg-rose-600 text-white',
    description: 'Unhappy customer who may damage brand reputation through negative word of mouth.',
  };
}

export interface NpsFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<NpsResponse, 'id' | 'createdAt' | 'updatedAt' | 'quarter'>) => Promise<void>;
  initialData?: NpsResponse | null;
  accountId: string;
  accountName?: string;
  projectId?: string;
  projects?: Project[];
  stakeholders?: Stakeholder[];
}

export const NpsFormModal: React.FC<NpsFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  accountId,
  accountName = '',
  projectId,
  projects = [],
  stakeholders = [],
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialData?.projectId || projectId || '');
  const [selectedRespondentId, setSelectedRespondentId] = useState<string>(initialData?.respondentId || '');
  const [respondentName, setRespondentName] = useState<string>(initialData?.respondentName || '');
  const [receivedMonthYear, setReceivedMonthYear] = useState<string>(
    initialData?.receivedMonthYear || new Date().toISOString().slice(0, 7)
  );
  const [npsScore, setNpsScore] = useState<number>(initialData?.npsScore ?? 10);
  const [likedMost, setLikedMost] = useState<string>(initialData?.likedMost || '');
  const [improvementSuggestions, setImprovementSuggestions] = useState<string>(initialData?.improvementSuggestions || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setSelectedProjectId(initialData.projectId || projectId || '');
      setSelectedRespondentId(initialData.respondentId || '');
      setRespondentName(initialData.respondentName || '');
      setReceivedMonthYear(initialData.receivedMonthYear || new Date().toISOString().slice(0, 7));
      setNpsScore(initialData.npsScore ?? 10);
      setLikedMost(initialData.likedMost || '');
      setImprovementSuggestions(initialData.improvementSuggestions || '');
    } else {
      setSelectedProjectId(projectId || '');
      setSelectedRespondentId('');
      setRespondentName('');
      setReceivedMonthYear(new Date().toISOString().slice(0, 7));
      setNpsScore(10);
      setLikedMost('');
      setImprovementSuggestions('');
    }
    setErrorMsg(null);
  }, [initialData, isOpen, projectId]);

  // Derived quarter (read-only, derived automatically!)
  const derivedQuarter = useMemo(() => deriveQuarterFromMonthYear(receivedMonthYear), [receivedMonthYear]);
  const classification = useMemo(() => getNpsClassification(npsScore), [npsScore]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (npsScore < 0 || npsScore > 10) {
      setErrorMsg('NPS Score must be between 0 and 10.');
      return;
    }
    if (!receivedMonthYear) {
      setErrorMsg('Received Month/Year is required.');
      return;
    }

    // Resolve respondent name if linked to a stakeholder
    let finalRespondentName = respondentName;
    if (selectedRespondentId) {
      const sh = stakeholders.find((s) => s.id === selectedRespondentId);
      if (sh) {
        finalRespondentName = `${sh.name}${sh.designation ? ` (${sh.designation})` : ''}`;
      }
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await onSubmit({
        accountId,
        projectId: selectedProjectId || undefined,
        respondentId: selectedRespondentId || undefined,
        respondentName: finalRespondentName || undefined,
        receivedMonthYear,
        npsScore,
        likedMost,
        improvementSuggestions,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to save NPS response.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={initialData ? 'Edit Customer Feedback (NPS)' : 'Record Customer Feedback (NPS)'}
      icon={<Star className="w-5.5 h-5.5 text-amber-500" />}
      isSubmitting={isSubmitting}
      submitLabel={initialData ? 'Save Changes' : 'Save Feedback'}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        {errorMsg && (
          <div className="p-3.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
            {errorMsg}
          </div>
        )}

        {/* 1. Account & Project Scope */}
        <FormSection title="Account & Project Information">
          <FormGrid columns={2}>
            <FormField label="Account">
              <input
                type="text"
                disabled
                value={accountName || accountId}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-100 text-slate-700 font-semibold"
              />
            </FormField>

            <FormField label="Associated Project (Optional)">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className={INPUT_CLS_AMBER}
              >
                <option value="">All Account Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FormField>
          </FormGrid>
        </FormSection>

        {/* 2. Respondent & Date Information */}
        <FormSection title="Respondent & Date Information">
          <FormGrid columns={2}>
            <FormField label="Respondent (Client Stakeholder)">
              <select
                value={selectedRespondentId}
                onChange={(e) => {
                  setSelectedRespondentId(e.target.value);
                  if (e.target.value) {
                    const sh = stakeholders.find((s) => s.id === e.target.value);
                    if (sh) setRespondentName(sh.name);
                  }
                }}
                className={INPUT_CLS_AMBER}
              >
                <option value="">Select Stakeholder...</option>
                {stakeholders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.designation ? `(${s.designation})` : ''}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Respondent Name (Manual Fallback)">
              <input
                type="text"
                value={respondentName}
                placeholder="e.g. Jane Smith (VP of Engineering)"
                onChange={(e) => setRespondentName(e.target.value)}
                className={INPUT_CLS_AMBER}
              />
            </FormField>

            <FormField label="Received Month/Year">
              <input
                type="month"
                required
                value={receivedMonthYear}
                onChange={(e) => setReceivedMonthYear(e.target.value)}
                className={INPUT_CLS_AMBER}
              />
            </FormField>

            {/* Derived Quarter (Read-Only) */}
            <FormField label="Derived Quarter (Auto-Calculated)">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <span className="text-slate-600 font-medium">Fiscal Quarter:</span>
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {derivedQuarter}
                </span>
              </div>
            </FormField>
          </FormGrid>
        </FormSection>

        {/* 3. Prominent 0–10 NPS Score Selection */}
        <FormSection title="NPS Score Rating (0 – 10)">
          <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-800 block">
                  "On a scale of 0 to 10, how likely are you to recommend Reflections to a friend or colleague?"
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">{classification.description}</p>
              </div>

              <div className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-2 shrink-0 ${classification.bg}`}>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-sm ${classification.badgeBg}`}>
                  {npsScore}
                </span>
                <span className={`text-xs ${classification.color}`}>
                  {classification.label} ({npsScore} / 10)
                </span>
              </div>
            </div>

            {/* Rating Pills Grid */}
            <div className="grid grid-cols-11 gap-1.5 pt-1">
              {Array.from({ length: 11 }, (_, i) => i).map((num) => {
                const isSelected = npsScore === num;
                const isPromoter = num >= 9;
                const isPassive = num >= 7 && num <= 8;

                let pillStyle = isSelected
                  ? isPromoter
                    ? 'bg-emerald-600 text-white font-extrabold ring-2 ring-emerald-400 scale-105 shadow'
                    : isPassive
                    ? 'bg-amber-500 text-white font-extrabold ring-2 ring-amber-300 scale-105 shadow'
                    : 'bg-rose-600 text-white font-extrabold ring-2 ring-rose-400 scale-105 shadow'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 font-semibold';

                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setNpsScore(num)}
                    className={`h-11 flex flex-col items-center justify-center text-xs rounded-xl transition-all ${pillStyle}`}
                  >
                    <span>{num}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between text-[10px] text-slate-400 px-1 font-medium">
              <span>0 = Not at all likely</span>
              <span>5 = Neutral</span>
              <span>10 = Extremely likely</span>
            </div>
          </div>
        </FormSection>

        {/* 4. Qualitative Customer Feedback (Spacious Textareas) */}
        <FormSection title="Customer Feedback & Comments">
          <div className="space-y-5">
            <FormField label="What do you like the most about Reflections?">
              <textarea
                rows={5}
                value={likedMost}
                placeholder="Enter detailed positive feedback, highlights, or appreciated aspects of the service..."
                onChange={(e) => setLikedMost(e.target.value)}
                className={`${INPUT_CLS_AMBER} leading-relaxed`}
              />
            </FormField>

            <FormField label="How can we improve your experience?">
              <textarea
                rows={5}
                value={improvementSuggestions}
                placeholder="Enter suggestions, areas for enhancement, or specific customer concerns..."
                onChange={(e) => setImprovementSuggestions(e.target.value)}
                className={`${INPUT_CLS_AMBER} leading-relaxed`}
              />
            </FormField>
          </div>
        </FormSection>
      </div>
    </FormModal>
  );
};
