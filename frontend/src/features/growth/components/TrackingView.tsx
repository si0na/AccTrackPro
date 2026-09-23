import React from 'react';
import { ClipboardList, Truck, Settings2, BadgeCheck } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import { useCRM } from '@/contexts/CRMContext';
import { matchesGlobalAccount } from '@/utils';

const TrackingCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  count?: number | null;
  badgeText?: string;
  onClick: () => void;
}> = ({ icon, title, description, count, badgeText, onClick }) => (
  <button
    onClick={onClick}
    className="w-full text-left group cursor-pointer"
  >
    <Card className="h-full transition-all duration-150 group-hover:shadow-md group-hover:border-slate-300">
      <div className="flex items-start gap-4 p-1">
        <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl shrink-0 group-hover:bg-teal-50 transition-colors">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-bold text-slate-800 group-hover:text-teal-700 transition-colors">{title}</h3>
            {count !== undefined && count !== null ? (
              <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                {count} {count === 1 ? 'Record' : 'Records'}
              </span>
            ) : badgeText ? (
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-slate-100 text-slate-500">
                {badgeText}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{description}</p>
        </div>
      </div>
    </Card>
  </button>
);

export const TrackingView: React.FC = () => {
  const { setView, sqaRecords, globalAccountId } = useCRM();

  const sqaCount = (sqaRecords ?? []).filter(s => matchesGlobalAccount(s.accountId, globalAccountId)).length;
  const totalTrackingCount = sqaCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking"
        subtitle="Comprehensive delivery, technical, and Software Quality Assurance tracking across projects."
        icon={<ClipboardList className="w-5 h-5 text-teal-500" />}
        actions={
          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-lg border border-slate-200 shadow-sm text-xs font-bold text-slate-700">
            <span className="text-slate-400 font-medium">Total Tracking Records:</span>
            <span className="text-blue-700 font-black text-sm">{totalTrackingCount}</span>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
        <TrackingCard
          icon={<Truck className="w-5 h-5 text-teal-500" />}
          title="Delivery Review"
          description="Structured delivery review tracking across projects and accounts."
          badgeText="In Progress"
          onClick={() => setView('delivery-review')}
        />
        <TrackingCard
          icon={<Settings2 className="w-5 h-5 text-slate-500" />}
          title="Technical Review"
          description="Technical assessment and review tracking for active engagements."
          badgeText="In Progress"
          onClick={() => setView('technical-review')}
        />
        <TrackingCard
          icon={<BadgeCheck className="w-5 h-5 text-blue-500" />}
          title="SQA Review"
          description="Software Quality Assurance tracking, project classification, and weekly quality health reviews."
          count={sqaCount}
          onClick={() => setView('sqa-review')}
        />
      </div>
    </div>
  );
};
