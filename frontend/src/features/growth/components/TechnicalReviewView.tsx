import React from 'react';
import { Settings2, Construction } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';

export const TechnicalReviewView: React.FC = () => (
  <div className="space-y-6">
    <PageHeader
      title="Technical Review"
      subtitle="Technical assessment and review tracking for your engagements."
      icon={<Settings2 className="w-5 h-5 text-slate-600" />}
    />

    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center py-14 px-10">
        <div className="flex items-center justify-center w-14 h-14 bg-slate-100 rounded-2xl mx-auto mb-5">
          <Construction className="w-7 h-7 text-slate-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Technical Review</h2>
        <span className="inline-block mb-4 text-[11px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
          Development in Progress
        </span>
        <p className="text-sm text-slate-500 leading-relaxed">
          Technical review capabilities are currently under development. This module will
          enable structured technical assessment and review tracking for your engagements.
        </p>
      </Card>
    </div>
  </div>
);
