import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { useCRM } from '@/contexts/CRMContext';
import { canAccessView, getFirstAccessibleView } from '@/utils/permissions';

/**
 * Rendered in place of a gated view when the current user lacks the RBAC
 * permission for it (either via the sidebar or a direct URL). Light-theme
 * consistent centered card with an escape hatch to the user's home view.
 */
export const NotAuthorized: React.FC = () => {
  const { setView, can } = useCRM();
  const firstView = getFirstAccessibleView(can);
  const isDashboardAccessible = canAccessView('dashboard', can);

  const handleGoHome = () => {
    if (firstView) {
      setView(firstView);
    }
  };

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
          {firstView && (
            <Button variant="primary" size="md" onClick={handleGoHome}>
              {isDashboardAccessible ? 'Go to Dashboard' : 'Go to Home'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};
