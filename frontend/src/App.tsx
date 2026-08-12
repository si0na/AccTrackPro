import React, { useState, useEffect } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { CRMProvider, useCRM } from '@/contexts/CRMContext';
import { buildPath } from '@/routes';
import { canAccessView } from '@/utils/permissions';
import { NotAuthorized } from '@/components/NotAuthorized';
import { Sidebar } from '@/components/layout/Sidebar';
import { GlobalAccountSelector } from '@/components/layout/GlobalAccountSelector';
import { DashboardView } from '@/features/dashboard/components/DashboardView';
import { AccountsListView } from '@/features/accounts/components/AccountsListView';
import { AccountDetailsView } from '@/features/accounts/components/AccountDetailsView';
import { OpportunitiesView } from '@/features/opportunities/components/OpportunitiesView';
import { OpportunityDetailsView } from '@/features/opportunities/components/OpportunityDetailsView';
import { OpportunityForecastView } from '@/features/opportunities/components/OpportunityForecastView';
import { ProjectsListView } from '@/features/projects/components/ProjectsListView';
import { ProjectDetailsView } from '@/features/projects/components/ProjectDetailsView';
import { ActionItemsView } from '@/features/action-items/components/ActionItemsView';
import { StakeholdersView } from '@/features/stakeholders/components/StakeholdersView';
import { ExecutiveDashboardView } from '@/features/reports/components/ExecutiveDashboardView';
import { AuditLogView } from '@/features/reports/components/AuditLogView';
import { PerformanceEvaluationView } from '@/features/reports/components/PerformanceEvaluationView';
import { AlertsAndNotificationsView } from '@/features/notifications/components/AlertsAndNotificationsView';
import { AdministrationPage } from '@/features/administration/components/AdministrationPage';
import { ImportExportLauncher } from '@/features/import-export';
import { LoginPage } from '@/features/auth/components/LoginPage';
import { SignUpPage } from '@/features/auth/components/SignUpPage';
import { ForgotPasswordPage } from '@/features/auth/components/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/components/ResetPasswordPage';
import { FullPageLoading } from '@/components/common/LoadingState';

import {
  Bell, Settings, LogOut, Camera, UserCog,
} from 'lucide-react';

// ─── Main layout (requires BrowserRouter context) ─────────────────────────────

const InnerLayout: React.FC = () => {
  const {
    currentView, setView,
    currentUser, isLoggedIn, authLoading, currentUserProfile, logout,
    selectedAccountId, selectedOpportunityId, selectedProjectId,
    updateProfilePicture,
    unreadNotificationCount,
    can, permissionsLoaded,
    refreshCurrentUser, refreshData,
  } = useCRM();

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 256;
        const scale = max / Math.max(img.width, img.height);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        updateProfilePicture(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot-password' | 'reset-password'>('login');

  // Sync state → URL so browser history reflects the current view
  useEffect(() => {
    const path = buildPath(currentView, selectedAccountId, selectedOpportunityId, selectedProjectId);
    if (window.location.pathname !== path) {
      navigate(path, { replace: true });
    }
  }, [currentView, selectedAccountId, selectedOpportunityId, selectedProjectId, navigate]);

  if (authLoading) {
    return <FullPageLoading />;
  }

  if (!isLoggedIn) {
    if (authView === 'signup') {
      return (
        <SignUpPage
          onGoToLogin={() => setAuthView('login')}
          onSignUp={() => setAuthView('login')}
        />
      );
    }
    if (authView === 'forgot-password') {
      return (
        <ForgotPasswordPage
          onBack={() => setAuthView('login')}
          onGoToReset={() => setAuthView('reset-password')}
        />
      );
    }
    if (authView === 'reset-password') {
      return (
        <ResetPasswordPage
          onBack={() => setAuthView('login')}
          onSuccess={() => setAuthView('login')}
        />
      );
    }
    return (
      <LoginPage
        onGoToSignUp={() => setAuthView('signup')}
        onForgotPassword={() => setAuthView('forgot-password')}
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50/50 overflow-hidden font-sans antialiased text-slate-800">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Global header — the FY/Quarter reporting-period selector lives on
            the reporting pages themselves (Forecast, Reports); the Account
            scope selector below applies everywhere, so it lives here. */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between">
          <GlobalAccountSelector />

          {/* Actions */}
          <div className="flex items-center space-x-4">
            {can('import-export', 'view') && <ImportExportLauncher />}
            <button
              onClick={() => setView('notifications')}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 relative cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </span>
              )}
            </button>
            {can('administration', 'view') && (
              <button
                onClick={() => setView('administration')}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                title="SSO Administration"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Profile avatar */}
            <div className="relative flex items-center space-x-2 border-l pl-4 border-slate-200">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-2 text-left focus:outline-none hover:opacity-90 transition-opacity cursor-pointer group"
              >
                <div className="relative group/avatar shrink-0">
                  {currentUserProfile?.avatarUrl ? (
                    <img
                      src={currentUserProfile.avatarUrl}
                      alt={`${currentUser} avatar`}
                      className="w-7 h-7 rounded-full border border-slate-200 object-cover group-hover:ring-2 group-hover:ring-indigo-500/20 transition-all"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full border border-slate-200 bg-indigo-100 flex items-center justify-center text-[11px] font-bold text-indigo-700 group-hover:ring-2 group-hover:ring-indigo-500/20 transition-all select-none">
                      {currentUser.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    title="Upload photo"
                  >
                    <Camera className="w-3 h-3 text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  </label>
                </div>
                <div className="hidden md:block select-none">
                  <p className="text-xs font-bold text-slate-700 leading-tight group-hover:text-indigo-600 transition-colors">{currentUser}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{currentUserProfile?.role || 'Account Manager'}</p>
                </div>
              </button>

              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsProfileOpen(false)} />
                  <div className="absolute right-0 top-10 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-40">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Signed in as</p>
                      <p className="text-xs font-bold text-slate-800 truncate">{currentUser}</p>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">{currentUserProfile?.email}</p>
                    </div>
                    <div className="p-1">
                      {can('administration', 'view') && (
                        <button
                          onClick={() => { setIsProfileOpen(false); setView('administration'); }}
                          className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5 text-slate-400" />
                          <span>SSO Administration</span>
                        </button>
                      )}
                      <button
                        onClick={() => { setIsProfileOpen(false); logout(); }}
                        className="w-full flex items-center space-x-2 px-3 py-1.5 rounded-lg text-left text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-red-500" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Main workspace — view rendered conditionally by currentView state.
            Once permissions have loaded, a gated view the user can't access is
            replaced by <NotAuthorized/> — this also closes direct-URL access. */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          {permissionsLoaded && !canAccessView(currentView, can) ? (
            <NotAuthorized />
          ) : (
          <>
          {currentView === 'dashboard'              && <DashboardView />}
          {currentView === 'accounts'               && <AccountsListView />}
          {currentView === 'account-details'        && <AccountDetailsView />}
          {currentView === 'opportunities'          && <OpportunitiesView />}
          {currentView === 'opportunity-details'    && <OpportunityDetailsView />}
          {currentView === 'opportunity-forecast'   && <OpportunityForecastView mode="opportunity" />}
          {currentView === 'projects'                && <ProjectsListView />}
          {currentView === 'project-details'         && <ProjectDetailsView />}
          {currentView === 'actionItems'            && <ActionItemsView />}
          {currentView === 'projectActionItems'     && <ActionItemsView />}
          {currentView === 'stakeholders'           && <StakeholdersView />}
          {currentView === 'forecast'               && <OpportunityForecastView mode="portfolio" />}
          {currentView === 'executive'              && <ExecutiveDashboardView />}
          {currentView === 'reports'                && <ExecutiveDashboardView />}
          {currentView === 'audit-log'              && <AuditLogView />}
          {currentView === 'performance-evaluation' && <PerformanceEvaluationView />}
          {currentView === 'notifications'          && <AlertsAndNotificationsView />}
          {currentView === 'administration'         && <AdministrationPage />}
          </>
          )}
        </main>
      </div>
    </div>
  );
};

// ─── Root component ───────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <CRMProvider>
        <InnerLayout />
      </CRMProvider>
    </BrowserRouter>
  );
}
