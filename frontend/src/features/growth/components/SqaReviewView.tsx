import React from 'react';
import { BadgeCheck, Construction } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';

export const SqaReviewView: React.FC = () => (
  <div className="space-y-6">
    <PageHeader
      title="SQA Review"
      subtitle="Software quality assurance review tracking for your delivery engagements."
      icon={<BadgeCheck className="w-5 h-5 text-blue-500" />}
    />

    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center py-14 px-10">
        <div className="flex items-center justify-center w-14 h-14 bg-blue-50 rounded-2xl mx-auto mb-5">
          <Construction className="w-7 h-7 text-blue-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">SQA Review</h2>
        <span className="inline-block mb-4 text-[11px] font-bold uppercase tracking-widest text-blue-500 bg-blue-50 px-3 py-1 rounded-full">
          Development in Progress
        </span>
        <p className="text-sm text-slate-500 leading-relaxed">
          SQA review capabilities are currently under development. This module will
          provide software quality assurance review tracking for your delivery engagements.
        </p>
      </Card>
    </div>
  </div>
);
