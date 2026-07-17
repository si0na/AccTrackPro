import React from 'react';

export interface DetailTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Omit or pass null to render the tab without a count pill. */
  count?: number | null;
}

export interface DetailTabBarProps {
  tabs: DetailTab[];
  activeTab: string;
  onChange: (id: string) => void;
}

/**
 * Shared entity-detail tab navigation: icon + label + a count pill, used by
 * Account Detail and Opportunity Detail so both pages share one tab styling.
 */
export const DetailTabBar: React.FC<DetailTabBarProps> = ({ tabs, activeTab, onChange }) => (
  <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto select-none">
    {tabs.map(tab => {
      const Icon = tab.icon;
      const isActive = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-3 -mb-px border-b-2 rounded-t-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            isActive
              ? 'border-blue-600 text-blue-600 bg-blue-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Icon className="w-4 h-4" />
          <span>{tab.label}</span>
          {tab.count !== null && tab.count !== undefined && (
            <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-bold ${
              isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
