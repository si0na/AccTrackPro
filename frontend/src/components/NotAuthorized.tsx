import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { useCRM } from '@/contexts/CRMContext';

/**
 * Rendered in place of a gated view when the current user lacks the RBAC
 * permission for it (either via the sidebar or a direct URL). Light-theme
 * consistent centered card with a "Go to Dashboard" escape hatch.
 */
export const NotAuthorized: React.FC = () => {
  const { setView } = useCRM();

  return (
    <div className="flex items-center justify-center min-h-full py-16">
      <Card className="max-w-md w-full text-center" padding="cozy">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200/70 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-amber-500" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">
              Access restricted
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              You don't have permission to view this page.
            </p>
          </div>
          <Button variant="primary" size="md" onClick={() => setView('dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};
