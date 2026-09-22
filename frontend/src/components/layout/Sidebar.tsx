/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useCRM, ViewType } from '@/contexts/CRMContext';
import { matchesGlobalAccount } from '@/utils';
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
  ChevronDown,
  ShieldCheck,
  ClipboardCheck,
  BadgeCheck,
  HeartHandshake,
  Award,
  AlertTriangle,
  Sprout,
  Handshake,
  ClipboardList,
  Truck,
  Settings2,
} from 'lucide-react';

import { ReflectOneLogo } from '@/components/common/ReflectOneLogo';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavSubItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
}

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
  badge: number | null;
  /** When present, renders this item as an expandable parent with these children. */
  children?: NavSubItem[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Sidebar: React.FC = () => {
  const {
    currentView, setView,
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

  // Track which parent nav items are expanded (by ViewType id)
  const TRACKING_VIEWS: ViewType[] = ['tracking', 'delivery-review', 'technical-review', 'sqa-review'];
  const isTrackingActive = TRACKING_VIEWS.includes(currentView);
  const [trackingExpanded, setTrackingExpanded] = useState(isTrackingActive);

  // Auto-expand Tracking when navigating to a Tracking sub-page
  useEffect(() => {
    if (isTrackingActive) setTrackingExpanded(true);
  }, [currentView, isTrackingActive]);

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

  const sections: NavSection[] = [
    {
      label: 'Account Management',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
        { id: 'accounts', label: 'Accounts', icon: Building2, badge: accounts.length },
        { id: 'opportunities', label: 'Opportunities', icon: TrendingUp, badge: opportunities.length },
        { id: 'actionItems', label: 'Action Items', icon: CheckSquare, badge: normalActionItemsCount },
        { id: 'stakeholders', label: 'Stakeholders', icon: Users, badge: totalStakeholdersCount },
        { id: 'risks', label: 'Risks & Issues', icon: AlertTriangle, badge: risksAndIssuesCount },
      ],
    },
    {
      label: 'Growth',
      items: [
        { id: 'account-growth', label: 'Account Growth', icon: Sprout, badge: null },
        { id: 'partnership', label: 'Partnership', icon: Handshake, badge: null },
        {
          id: 'tracking',
          label: 'Tracking',
          icon: ClipboardList,
          badge: null,
          children: [
            { id: 'delivery-review', label: 'Delivery Review', icon: Truck },
            { id: 'technical-review', label: 'Technical Review', icon: Settings2 },
            { id: 'sqa-review', label: 'SQA Review', icon: BadgeCheck },
          ],
        },
      ],
    },
    {
      label: 'Delivery',
      items: [
        { id: 'projects', label: 'Projects', icon: FolderKanban, badge: projects.length },
        { id: 'projectActionItems', label: 'Project Action Items', icon: CheckSquare, badge: projectActionItemsCount },
        { id: 'sqa', label: 'SQA', icon: BadgeCheck, badge: sqaCount },
      ],
    },
    {
      label: 'Insights',
      items: [
        { id: 'forecast', label: 'Portfolio Forecast', icon: LineChart, badge: null },
        { id: 'executive', label: 'Reports', icon: BarChart3, badge: null },
      ],
    },
    {
      label: 'Team and Engagement',
      items: [
        { id: 'employee-appreciation', label: 'Appreciation', icon: HeartHandshake, badge: employeeAppreciationCount },
        { id: 'employee-rewards-recognition', label: 'Reward and Recognition', icon: Award, badge: employeeRewardsCount },
        { id: 'performance-evaluation', label: 'Feedback', icon: ClipboardCheck, badge: employeeFeedbackCount },
      ],
    },
    {
      label: 'System',
      items: [
        { id: 'notifications', label: 'Alerts & Notifications', icon: Bell, badge: unreadNotificationCount },
        { id: 'audit-log', label: 'Audit Logs', icon: ShieldCheck, badge: null },
        { id: 'administration', label: 'Administration', icon: Settings, badge: null },
      ],
    },
  ];

  // Permission-gate: keep only items the user can access; drop empty sections.
  const visibleSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => canAccessView(item.id, can)),
    }))
    .filter(section => section.items.length > 0);

  // Is the given item ID the active view (including detail-view aliases)?
  const isItemActive = (id: ViewType): boolean =>
    currentView === id ||
    (id === 'accounts' && currentView === 'account-details') ||
    (id === 'opportunities' && currentView === 'opportunity-details') ||
    (id === 'projects' && currentView === 'project-details') ||
    (id === 'sqa' && currentView === 'sqa-details');

  const handleNavClick = (id: ViewType) => {
    setCameFromDashboard(false);
    if (id === 'opportunities') setSelectedStage('All');
    setView(id);
  };

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
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-colors shrink-0"
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
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
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = isItemActive(item.id);
                const Icon = item.icon;
                const hasChildren = !!(item.children && item.children.length > 0);

                // ── Parent item with sub-items (Tracking) ──────────────────
                if (hasChildren && item.children) {
                  const isParentActive = isActive || isTrackingActive;
                  const isExpanded = !sidebarCollapsed && trackingExpanded;

                  return (
                    <div key={item.id}>
                      <button
                        onClick={() => {
                          if (sidebarCollapsed) {
                            handleNavClick(item.id);
                          } else {
                            const willExpand = !trackingExpanded;
                            setTrackingExpanded(willExpand);
                            if (willExpand) handleNavClick(item.id);
                          }
                        }}
                        title={item.label}
                        className={`flex items-center rounded-lg text-sm font-medium transition-all duration-150 group cursor-pointer ${
                          sidebarCollapsed
                            ? 'justify-center w-10 h-10 mx-auto px-0'
                            : 'w-full justify-between gap-2 px-2.5 py-2'
                        } ${
                          isParentActive
                            ? 'bg-slate-800 text-white font-semibold'
                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                        }`}
                      >
                        <div className={`flex items-center min-w-0 flex-1 ${sidebarCollapsed ? 'justify-center space-x-0' : 'space-x-2'}`}>
                          <Icon
                            className={`w-4 h-4 transition-colors shrink-0 ${
                              isParentActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                            }`}
                          />
                          {!sidebarCollapsed && (
                            <span className="whitespace-nowrap text-xs sm:text-[13px] font-medium truncate">
                              {item.label}
                            </span>
                          )}
                        </div>
                        {!sidebarCollapsed && (
                          <ChevronDown
                            className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                              isExpanded ? 'rotate-0' : '-rotate-90'
                            } ${isParentActive ? 'text-slate-300' : 'text-slate-600'}`}
                          />
                        )}
                      </button>

                      {/* Sub-items */}
                      {isExpanded && (
                        <div className="mt-0.5 ml-3 pl-3 border-l border-slate-700/60 space-y-0.5">
                          {item.children.map(child => {
                            const isChildActive = currentView === child.id;
                            const ChildIcon = child.icon;
                            return (
                              <button
                                key={child.id}
                                onClick={() => handleNavClick(child.id)}
                                title={child.label}
                                className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                                  isChildActive
                                    ? 'bg-slate-700 text-white font-semibold'
                                    : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-200'
                                }`}
                              >
                                <ChildIcon className={`w-3.5 h-3.5 shrink-0 ${isChildActive ? 'text-white' : 'text-slate-600'}`} />
                                <span className="whitespace-nowrap truncate">{child.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // ── Regular flat nav item ──────────────────────────────────
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
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
