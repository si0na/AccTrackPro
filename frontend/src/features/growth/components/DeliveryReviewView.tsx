import React from 'react';
import { Truck, Construction } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';

export const DeliveryReviewView: React.FC = () => (
  <div className="space-y-6">
    <PageHeader
      title="Delivery Review"
      subtitle="Structured delivery review tracking across projects and accounts."
      icon={<Truck className="w-5 h-5 text-teal-500" />}
    />

    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center py-14 px-10">
        <div className="flex items-center justify-center w-14 h-14 bg-teal-50 rounded-2xl mx-auto mb-5">
          <Construction className="w-7 h-7 text-teal-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Delivery Review</h2>
        <span className="inline-block mb-4 text-[11px] font-bold uppercase tracking-widest text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
          Development in Progress
        </span>
        <p className="text-sm text-slate-500 leading-relaxed">
          Delivery review capabilities are currently under development. This module will
          provide structured delivery review tracking across your projects and accounts.
        </p>
      </Card>
    </div>
  </div>
);
