/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useCRM, ViewType } from '@/contexts/CRMContext';
import { isOpenActionItemStatus, matchesGlobalAccount } from '@/utils';
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
  LogOut,
  Menu
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    currentView,
    setView,
    accounts: allAccounts,
    opportunities: allOpportunities,
    projects: allProjects,
    actionItems: allActionItems,
    stakeholders: allStakeholders,
    globalAccountId,
    unreadNotificationCount,
    setCameFromDashboard,
    setSelectedStage,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useCRM();

  // Nav badges reflect the Global Account Selector, same as every other module.
  const accounts = allAccounts.filter(a => matchesGlobalAccount(a.id, globalAccountId));
  const opportunities = allOpportunities.filter(o => matchesGlobalAccount(o.accountId, globalAccountId));
  const projects = allProjects.filter(p => matchesGlobalAccount(p.accountId, globalAccountId));
  const actionItems = allActionItems.filter(ai => matchesGlobalAccount(ai.accountId, globalAccountId));
  const stakeholders = allStakeholders.filter(s => matchesGlobalAccount(s.accountId, globalAccountId));

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
          id: 'projects' as ViewType,
          label: 'Projects',
          icon: FolderKanban,
          badge: projects.length,
        },
        {
          id: 'actionItems' as ViewType,
          label: 'Action Items',
          icon: CheckSquare,
          badge: actionItems.filter(ai => isOpenActionItemStatus(ai.status)).length,
        },
        {
          id: 'stakeholders' as ViewType,
          label: 'Stakeholders',
          icon: Users,
          badge: stakeholders.length,
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
        {
          id: 'performance-evaluation' as ViewType,
          label: 'Performance Evaluation',
          icon: ClipboardCheck,
          badge: null
        },
      ],
    },
    {
      label: 'System',
      items: [
        {
          id: 'notifications' as ViewType,
          label: 'Notifications',
          icon: Bell,
          badge: unreadNotificationCount > 0 ? unreadNotificationCount : null
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

  return (
    <aside className={`bg-slate-900 flex flex-col h-screen shrink-0 border-r border-slate-800 transition-all duration-300 ease-in-out ${
      sidebarCollapsed ? 'w-16' : 'w-60'
    }`}>
      {/* Brand Logo Header with Toggle Button */}
      <div className={`p-4 border-b border-slate-800/60 flex ${
        sidebarCollapsed ? 'flex-col items-center gap-4 justify-center' : 'items-center justify-between'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shrink-0 shadow-md">
            AT
          </div>
          {!sidebarCollapsed && (
            <span className="font-bold text-white text-sm tracking-tight truncate">
              AccTrack Pro
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
        sidebarCollapsed ? 'px-2' : 'px-4'
      }`}>
        {sections.map((section, sectionIndex) => (
          <div key={section.label} className={sectionIndex > 0 ? 'pt-3 mt-3 border-t border-slate-800/60' : ''}>
            {!sidebarCollapsed && (
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {section.label}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map(item => {
                const isActive = currentView === item.id ||
                  (item.id === 'accounts' && currentView === 'account-details') ||
                  (item.id === 'opportunities' && currentView === 'opportunity-details') ||
                  (item.id === 'projects' && currentView === 'project-details');
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
                        : 'w-full justify-between px-3 py-2'
                    } ${
                      isActive
                        ? 'bg-slate-800 text-white font-semibold'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    <div className={`flex items-center ${sidebarCollapsed ? 'space-x-0' : 'space-x-3'}`}>
                      <Icon
                        className={`w-4 h-4 transition-colors shrink-0 ${
                          isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                      />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!sidebarCollapsed && item.badge !== null && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all shrink-0 ${
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
