/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useCRM, ViewType } from '@/contexts/CRMContext';
import { isOpenActionItemStatus, matchesGlobalAccount } from '@/utils';
import { canAccessView } from '@/utils/permissions';
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  FolderKanban,
  CheckSquare,
  Users,
  LineChart,
  BarChart3,
  Bell,
  Settings,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Search,
  ClipboardCheck,
  BadgeCheck,
  HeartHandshake,
  Award,
  AlertTriangle,
  Layers,
  LogOut,
  Menu
} from 'lucide-react';

import { ReflectOneLogo } from '@/components/common/ReflectOneLogo';

export const Sidebar: React.FC = () => {
  const {
    currentView,
    setView,
    accounts: allAccounts,
    opportunities: allOpportunities,
    projects: allProjects,
    actionItems: allActionItems,
    stakeholders: allStakeholders,
    serviceProviders: allServiceProviders,
    sqaRecords: allSqaRecords,
    risks: allRisks,
    performanceEvaluations: allPerformanceEvaluations,
    employeeAppreciations: allEmployeeAppreciations,
    employeeRewardsRecognitions: allEmployeeRewardsRecognitions,
    globalAccountId,
    unreadNotificationCount,
    setCameFromDashboard,
    setSelectedStage,
    sidebarCollapsed,
    setSidebarCollapsed,
    can,
  } = useCRM();

  // Nav badges reflect the Global Account Selector, same as every other module.
  const accounts = allAccounts.filter(a => matchesGlobalAccount(a.id, globalAccountId));
  const opportunities = allOpportunities.filter(o => matchesGlobalAccount(o.accountId, globalAccountId));
  const projects = allProjects.filter(p => matchesGlobalAccount(p.accountId, globalAccountId));
  const actionItems = allActionItems.filter(ai => {
    const effAccId = ai.accountId || (ai.projectId ? allProjects.find(p => p.id === ai.projectId)?.accountId : '');
    return matchesGlobalAccount(effAccId, globalAccountId);
  });
  const normalActionItemsCount = actionItems.filter(ai => !ai.projectId).length;
  const projectActionItemsCount = actionItems.filter(ai => !!ai.projectId).length;

  const clientStakeholdersCount = allStakeholders.filter(s => s.stakeholderType === 'CLIENT' && matchesGlobalAccount(s.accountId, globalAccountId)).length;
  const activeServiceProvidersCount = (allServiceProviders ?? []).filter(sp => sp.isActive !== false).length;
  const totalStakeholdersCount = clientStakeholdersCount + activeServiceProvidersCount;

  const risksAndIssuesCount = (allRisks ?? []).filter(r => matchesGlobalAccount(r.accountId, globalAccountId)).length;
  const sqaCount = (allSqaRecords ?? []).filter(s => matchesGlobalAccount(s.accountId, globalAccountId)).length;

  const employeeAppreciationCount = (allEmployeeAppreciations ?? []).filter(e => matchesGlobalAccount(e.accountId, globalAccountId)).length;
  const employeeRewardsCount = (allEmployeeRewardsRecognitions ?? []).length;
  const employeeFeedbackCount = (allPerformanceEvaluations ?? []).filter(p => matchesGlobalAccount(p.accountId, globalAccountId)).length;

  const sections = [
    {
      label: 'Workspace',
      items: [
        {
          id: 'dashboard' as ViewType,
          label: 'Dashboard',
          icon: LayoutDashboard,
          badge: null,
        },
        {
          id: 'accounts' as ViewType,
          label: 'Accounts',
          icon: Building2,
          badge: accounts.length,
        },
        {
          id: 'opportunities' as ViewType,
          label: 'Opportunities',
          icon: TrendingUp,
          badge: opportunities.length,
        },
        {
          id: 'actionItems' as ViewType,
          label: 'Action Items',
          icon: CheckSquare,
          badge: normalActionItemsCount,
        },
        {
          id: 'stakeholders' as ViewType,
          label: 'Stakeholders',
          icon: Users,
          badge: totalStakeholdersCount,
        },
        {
          id: 'risks' as ViewType,
          label: 'Risks & Issues',
          icon: AlertTriangle,
          badge: risksAndIssuesCount,
        },
      ],
    },
    {
      label: 'Delivery',
      items: [
        {
          id: 'projects' as ViewType,
          label: 'Projects',
          icon: FolderKanban,
          badge: projects.length,
        },
        {
          id: 'projectActionItems' as ViewType,
          label: 'Project Action Items',
          icon: CheckSquare,
          badge: projectActionItemsCount,
        },
        {
          id: 'sqa' as ViewType,
          label: 'SQA',
          icon: BadgeCheck,
          badge: sqaCount,
        },
      ],
    },
    {
      label: 'Insights',
      items: [
        {
          id: 'forecast' as ViewType,
          label: 'Portfolio Forecast',
          icon: LineChart,
          badge: null
        },
        {
          id: 'executive' as ViewType,
          label: 'Reports',
          icon: BarChart3,
          badge: null
        },
      ],
    },
    {
      label: 'Employee Engagement',
      items: [
        {
          id: 'employee-appreciation' as ViewType,
          label: 'Employee Appreciation',
          icon: HeartHandshake,
          badge: employeeAppreciationCount,
        },
        {
          id: 'employee-rewards-recognition' as ViewType,
          label: 'Employee R&R',
          icon: Award,
          badge: employeeRewardsCount,
        },
        {
          id: 'performance-evaluation' as ViewType,
          label: 'Employee Feedback',
          icon: ClipboardCheck,
          badge: employeeFeedbackCount,
        },
      ],
    },
    {
      label: 'System',
      items: [
        {
          id: 'notifications' as ViewType,
          label: 'Alerts & Notifications',
          icon: Bell,
          badge: unreadNotificationCount,
        },
        {
          id: 'audit-log' as ViewType,
          label: 'Audit Logs',
          icon: ShieldCheck,
          badge: null
        },
        {
          id: 'administration' as ViewType,
          label: 'Administration',
          icon: Settings,
          badge: null
        },
      ],
    },
  ];

  // Permission-gate the nav: keep only items the user can access, and drop any
  // section left with zero visible items (no empty section headers).
  const visibleSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => canAccessView(item.id, can)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <aside className={`bg-slate-900 flex flex-col h-screen shrink-0 border-r border-slate-800 transition-all duration-300 ease-in-out ${
      sidebarCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Brand Logo Header with Toggle Button */}
      <div className={`p-4 border-b border-slate-800/60 flex ${
        sidebarCollapsed ? 'flex-col items-center gap-4 justify-center' : 'items-center justify-between'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <ReflectOneLogo className="w-8 h-8 shrink-0" />
          {!sidebarCollapsed && (
            <span className="font-extrabold text-white text-base tracking-tight truncate">
              ReflectOne
            </span>
          )}
        </div>
        
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-colors shrink-0`}
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className={`flex-1 space-y-1 overflow-y-auto no-scrollbar py-4 ${
        sidebarCollapsed ? 'px-2' : 'px-3'
      }`}>
        {visibleSections.map((section, sectionIndex) => (
          <div key={section.label} className={sectionIndex > 0 ? 'pt-3 mt-3 border-t border-slate-800/60' : ''}>
            {!sidebarCollapsed && (
              <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                {section.label}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map(item => {
                const isActive = currentView === item.id ||
                  (item.id === 'accounts' && currentView === 'account-details') ||
                  (item.id === 'opportunities' && currentView === 'opportunity-details') ||
                  (item.id === 'projects' && currentView === 'project-details') ||
                  (item.id === 'sqa' && currentView === 'sqa-details');
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCameFromDashboard(false);
                      if (item.id === 'opportunities') {
                        setSelectedStage('All');
                      }
                      setView(item.id);
                    }}
                    title={item.label}
                    className={`flex items-center rounded-lg text-sm font-medium transition-all duration-150 group cursor-pointer ${
                      sidebarCollapsed
                        ? 'justify-center w-10 h-10 mx-auto px-0'
                        : 'w-full justify-between gap-2 px-2.5 py-2'
                    } ${
                      isActive
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <div className={`flex items-center min-w-0 flex-1 ${sidebarCollapsed ? 'justify-center space-x-0' : 'space-x-2'}`}>
                      <Icon
                        className={`w-4 h-4 transition-colors shrink-0 ${
                          isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                      />
                      {!sidebarCollapsed && (
                        <span className="whitespace-nowrap text-xs sm:text-[13px] font-medium">
                          {item.label}
                        </span>
                      )}
                    </div>

                    {!sidebarCollapsed && item.badge !== null && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all shrink-0 ml-auto ${
                          isActive
                            ? 'bg-slate-700 text-white'
                            : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
};
