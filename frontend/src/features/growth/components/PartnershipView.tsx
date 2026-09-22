import React from 'react';
import { Handshake, Construction } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';

export const PartnershipView: React.FC = () => (
  <div className="space-y-6">
    <PageHeader
      title="Partnership"
      subtitle="Manage and track strategic partnership activities."
      icon={<Handshake className="w-5 h-5 text-violet-500" />}
    />

    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full text-center py-14 px-10">
        <div className="flex items-center justify-center w-14 h-14 bg-violet-50 rounded-2xl mx-auto mb-5">
          <Construction className="w-7 h-7 text-violet-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">Partnership</h2>
        <span className="inline-block mb-4 text-[11px] font-bold uppercase tracking-widest text-violet-500 bg-violet-50 px-3 py-1 rounded-full">
          Coming Soon
        </span>
        <p className="text-sm text-slate-500 leading-relaxed">
          Partnership management capabilities are currently under development. This module will
          enable you to manage and track strategic partnership activities across your accounts.
        </p>
      </Card>
    </div>
  </div>
);
