import React from 'react';
import { ClipboardList, Construction, Truck, Settings2, BadgeCheck } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import { useCRM } from '@/contexts/CRMContext';

const TrackingCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}> = ({ icon, title, description, onClick }) => (
  <button
    onClick={onClick}
    className="w-full text-left group cursor-pointer"
  >
    <Card className="h-full transition-all duration-150 group-hover:shadow-md group-hover:border-slate-300">
      <div className="flex items-start gap-4 p-1">
        <div className="flex items-center justify-center w-10 h-10 bg-slate-100 rounded-xl shrink-0 group-hover:bg-teal-50 transition-colors">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800 group-hover:text-teal-700 transition-colors mb-1">{title}</h3>
          <p className="text-xs text-slate-400 font-medium">Development in progress</p>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{description}</p>
        </div>
      </div>
    </Card>
  </button>
);

export const TrackingView: React.FC = () => {
  const { setView } = useCRM();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking"
        subtitle="Tracking and review capabilities are currently under development."
        icon={<ClipboardList className="w-5 h-5 text-teal-500" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
        <TrackingCard
          icon={<Truck className="w-5 h-5 text-teal-500" />}
          title="Delivery Review"
          description="Delivery review capabilities are currently under development."
          onClick={() => setView('delivery-review')}
        />
        <TrackingCard
          icon={<Settings2 className="w-5 h-5 text-slate-500" />}
          title="Technical Review"
          description="Technical review capabilities are currently under development."
          onClick={() => setView('technical-review')}
        />
        <TrackingCard
          icon={<BadgeCheck className="w-5 h-5 text-blue-500" />}
          title="SQA Review"
          description="SQA review capabilities are currently under development."
          onClick={() => setView('sqa-review')}
        />
      </div>
    </div>
  );
};
