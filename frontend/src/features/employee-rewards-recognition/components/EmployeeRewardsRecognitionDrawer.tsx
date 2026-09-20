import React from 'react';
import { createPortal } from 'react-dom';
import { EmployeeRewardsRecognition } from '@/types';
import { X, Award, Calendar, User, Users, CheckCircle2, AlertCircle, Clock, FileText, Tag, Layers } from 'lucide-react';
import { StatusBadge, Button } from '@/components/ui';

export interface EmployeeRewardsRecognitionDrawerProps {
  isOpen: boolean;
  item: EmployeeRewardsRecognition | null;
  onClose: () => void;
  onEdit?: (item: EmployeeRewardsRecognition) => void;
  canEdit?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  'Won': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Nominated - Not Won': 'bg-amber-50 text-amber-700 border-amber-200',
  'Nomination Rejected': 'bg-rose-50 text-rose-700 border-rose-200',
};

const TYPE_COLORS: Record<string, string> = {
  'Continous': 'bg-blue-50 text-blue-700 border-blue-200',
  'Quarterly': 'bg-purple-50 text-purple-700 border-purple-200',
  'Annual': 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export const EmployeeRewardsRecognitionDrawer: React.FC<EmployeeRewardsRecognitionDrawerProps> = ({
  isOpen,
  item,
  onClose,
  onEdit,
  canEdit,
}) => {
  if (!isOpen || !item) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight">{item.category}</h3>
                <p className="text-xs text-slate-300 font-medium">
                  {item.type} Award • {item.teamOrIndividual} Nomination
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* Status & Type Bar */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Status</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border mt-1 ${STATUS_COLORS[item.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {item.status}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block text-right">Award Type</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border mt-1 ${TYPE_COLORS[item.type] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {item.type}
                </span>
              </div>
            </div>

            {/* Key Field Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Month of R&amp;R</span>
                </div>
                <p className="text-sm font-semibold text-slate-800">{item.monthOfRr}</p>
              </div>

              <div className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nominated By</span>
                </div>
                <p className="text-sm font-semibold text-slate-800">{item.nominatedByName || '—'}</p>
              </div>

              <div className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nominee / Team</span>
                </div>
                <p className="text-sm font-semibold text-slate-800">{item.employeeName || '—'}</p>
              </div>

              <div className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Creation Date</span>
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                </p>
              </div>
            </div>

            {/* Category Banner */}
            <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center space-x-3">
              <Tag className="w-5 h-5 text-indigo-600 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider block">Award Category</span>
                <span className="text-sm font-bold text-indigo-900">{item.category}</span>
              </div>
            </div>

            {/* Team Members */}
            {item.teamOrIndividual === 'Team' && item.teamMembers && (
              <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100/80 space-y-1">
                <div className="flex items-center space-x-2 text-indigo-700">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-800">Team Members</h4>
                </div>
                <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                  {item.teamMembers}
                </p>
              </div>
            )}

            {/* Details Content */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-slate-700">
                <FileText className="w-4 h-4 text-slate-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Nomination Details &amp; Citation</h4>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                {item.details || 'No details specified.'}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-3">
            {canEdit && onEdit && (
              <Button
                variant="secondary"
                onClick={() => {
                  onClose();
                  onEdit(item);
                }}
              >
                Edit Nomination
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
