import React from 'react';
import { EmployeeAppreciation } from '@/types';
import { Building2, FolderKanban, Calendar, User, Quote, Pencil, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui';

export interface EmployeeAppreciationCardProps {
  item: EmployeeAppreciation;
  onEdit?: (item: EmployeeAppreciation) => void;
  onDelete?: (item: EmployeeAppreciation) => void;
  canManage?: boolean;
}

export const EmployeeAppreciationCard: React.FC<EmployeeAppreciationCardProps> = ({
  item,
  onEdit,
  onDelete,
  canManage = true,
}) => {
  const isInternal = item.internalExternal === 'Internal';

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative group">
      {/* Header Info */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h3 className="font-extrabold text-slate-900 text-base tracking-tight truncate">
              {item.employeeName}
            </h3>
            {item.empId && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                {item.empId}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Internal / External Badge */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isInternal
                  ? 'bg-purple-100 text-purple-700 border border-purple-200'
                  : 'bg-blue-100 text-blue-700 border border-blue-200'
              }`}
            >
              <Tag className="w-3 h-3" />
              {item.internalExternal}
            </span>

            {/* Action Buttons */}
            {canManage && (
              <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                  <button
                    onClick={() => onEdit(item)}
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                    title="Edit Appreciation"
                    aria-label={`Edit appreciation for ${item.employeeName}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(item)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-md transition-colors"
                    title="Delete Appreciation"
                    aria-label={`Delete appreciation for ${item.employeeName}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Account / Project Context Pills */}
        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap font-medium">
          <div className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-800">{item.accountName || 'Account'}</span>
          </div>

          {item.projectName && (
            <div className="flex items-center gap-1 text-slate-500">
              <span>•</span>
              <FolderKanban className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{item.projectName}</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-slate-400 ml-auto text-[11px] font-mono">
            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{item.receivedDate}</span>
          </div>
        </div>
      </div>

      {/* Prominent Feedback Quote Box */}
      <div className="bg-slate-50/80 rounded-lg p-3.5 border border-slate-200/60 relative">
        <Quote className="w-4 h-4 text-blue-400 absolute top-2.5 right-2.5 opacity-40" />
        <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap italic">
          "{item.feedback}"
        </p>
      </div>

      {/* Respondent Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1.5 min-w-0">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[11px]">Given by:</span>
          <span className="font-bold text-slate-800 truncate">{item.respondentName}</span>
        </div>
      </div>
    </div>
  );
};
