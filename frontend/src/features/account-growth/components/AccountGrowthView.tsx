import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Sprout, Loader2, Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { accountGrowthApi } from '@/api/crm.api';
import { AccountGrowthWorkspace, FinancialYear } from '@/types';
import {
  Button,
  Card,
  EmptyRow,
  FilterBar,
  PageHeader,
  Pagination,
  SearchBar,
  SELECT_CLS,
  SortableHeader,
  Table,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '@/components/ui';

import { ClientPrioritiesTab } from './ClientPrioritiesTab';
import { ClientBudgetPositioningTab } from './ClientBudgetPositioningTab';
import { KnowingOurselvesTab } from './KnowingOurselvesTab';
import { KnowingTheCompetitorTab } from './KnowingTheCompetitorTab';
import { ActionPlanGeneralTab } from './ActionPlanGeneralTab';

type TabKey = 'client-priorities' | 'client-budget' | 'knowing-ourselves' | 'knowing-competitor' | 'action-plan';
type ViewMode = 'list' | 'detail';

export const AccountGrowthView: React.FC = () => {
  const { accounts, financialYears, can } = useCRM();

  // Navigation View Mode State: 'list' (Landing Page) | 'detail' (Workspace)
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Search filter on Account Landing Page
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Per-row Financial Year selections: accountId => financialYearId
  const [selectedFinancialYears, setSelectedFinancialYears] = useState<Record<string, string>>({});

  // Active Detail View Context State
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedFinancialYearId, setSelectedFinancialYearId] = useState<string>('');

  // Active Detail Tab state
  const [activeTab, setActiveTab] = useState<TabKey>('client-priorities');

  // Workspace Data state
  const [workspace, setWorkspace] = useState<AccountGrowthWorkspace | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Canonical Accounts sorted case-insensitively by Account Name ASC
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, [accounts]);

  // Filtered Accounts by Landing Page search term
  const filteredAccounts = useMemo(() => {
    if (!searchTerm.trim()) return sortedAccounts;
    const term = searchTerm.toLowerCase();
    return sortedAccounts.filter((a) => a.name.toLowerCase().includes(term));
  }, [sortedAccounts, searchTerm]);

  // Canonical Financial Years sorted chronologically by startYear ASC
  const sortedFinancialYears = useMemo(() => {
    return [...financialYears].sort((a, b) => (a.startYear ?? 0) - (b.startYear ?? 0));
  }, [financialYears]);

  // Canonical active/current Financial Year determination
  const activeFinancialYear = useMemo(() => {
    if (sortedFinancialYears.length === 0) return null;
    return (
      sortedFinancialYears.find((fy) => fy.isActive) ??
      sortedFinancialYears[sortedFinancialYears.length - 1] ??
      sortedFinancialYears[0]
    );
  }, [sortedFinancialYears]);

  // Helper to format Financial Year display label
  const getFyLabel = (fy: FinancialYear | undefined | null): string => {
    if (!fy || !fy.fyLabel) return '';
    return fy.fyLabel.startsWith('FY') ? fy.fyLabel : `FY ${fy.fyLabel}`;
  };

  // Synchronize/initialize per-row FY selection safely
  useEffect(() => {
    if (!activeFinancialYear) return;

    setSelectedFinancialYears((prev) => {
      const updated = { ...prev };
      let changed = false;

      sortedAccounts.forEach((account) => {
        const currentSelectedId = updated[account.id];
        const isValid =
          currentSelectedId &&
          sortedFinancialYears.some((fy) => fy.id === currentSelectedId);

        if (!isValid) {
          updated[account.id] = activeFinancialYear.id;
          changed = true;
        }
      });

      return changed ? updated : prev;
    });
  }, [sortedAccounts, sortedFinancialYears, activeFinancialYear]);

  // Handle row FY selector change
  const handleRowFyChange = (accountId: string, fyId: string) => {
    setSelectedFinancialYears((prev) => ({
      ...prev,
      [accountId]: fyId,
    }));
  };

  // Open Account Growth Detail View for a specific Account + FY context
  const handleOpenGrowthDetail = (accountId: string, fyId: string) => {
    // Clear previous workspace state immediately to prevent stale data display
    setWorkspace(null);
    setError(null);
    setLoading(true);
    setSelectedAccountId(accountId);
    setSelectedFinancialYearId(fyId);
    setActiveTab('client-priorities');
    setViewMode('detail');
  };

  // Return from Detail View back to Landing Page Account List
  const handleBackToList = () => {
    setViewMode('list');
    setSelectedAccountId('');
    setSelectedFinancialYearId('');
    setWorkspace(null);
    setError(null);
    setLoading(false);
  };

  // Workspace Loader: Runs when in detail view and selectedAccountId or selectedFinancialYearId changes
  useEffect(() => {
    if (viewMode !== 'detail' || !selectedAccountId || !selectedFinancialYearId) return;

    // Validate context against canonical sources
    const validAccount = sortedAccounts.some((a) => a.id === selectedAccountId);
    const validFy = sortedFinancialYears.some((fy) => fy.id === selectedFinancialYearId);

    if (!validAccount || !validFy) {
      console.warn('[AccountGrowthView] Invalid detail context IDs, resetting to landing list.');
      handleBackToList();
      return;
    }

    let isMounted = true;
    setWorkspace(null);
    setLoading(true);
    setError(null);

    accountGrowthApi
      .getWorkspace(selectedAccountId, selectedFinancialYearId)
      .then((data) => {
        if (isMounted) {
          setWorkspace(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('[AccountGrowthView] Error loading workspace:', err);
          setError('Failed to load Account Growth workspace.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [viewMode, selectedAccountId, selectedFinancialYearId, sortedAccounts, sortedFinancialYears]);

  const currentAccount = useMemo(
    () => sortedAccounts.find((a) => a.id === selectedAccountId),
    [sortedAccounts, selectedAccountId]
  );

  const currentFy = useMemo(
    () => sortedFinancialYears.find((fy) => fy.id === selectedFinancialYearId),
    [sortedFinancialYears, selectedFinancialYearId]
  );

  const fyDisplayLabel = getFyLabel(currentFy);

  const canEdit = can('accountGrowth', 'update') || can('accountGrowth', 'create');

  // Check if workspace has any entered growth data
  const hasWorkspaceData = useMemo(() => {
    if (!workspace) return false;
    return (
      (workspace.clientPriorities && workspace.clientPriorities.length > 0) ||
      (workspace.industryTrends && workspace.industryTrends.length > 0) ||
      (workspace.budgetPositioning &&
        ((workspace.budgetPositioning.clientRevenue ?? 0) > 0 ||
          (workspace.budgetPositioning.itBudgetTam ?? 0) > 0 ||
          (workspace.budgetPositioning.reflectionsWalletSharePrevFyPct ?? 0) > 0)) ||
      (workspace.walletSharePlans && workspace.walletSharePlans.length > 0) ||
      (workspace.outsourcingSplits && workspace.outsourcingSplits.length > 0) ||
      (workspace.swot && workspace.swot.length > 0) ||
      (workspace.competitors && workspace.competitors.length > 0) ||
      (workspace.actionPlans && workspace.actionPlans.length > 0)
    );
  }, [workspace]);

  // Client-side pagination state for Account Growth landing list
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Sorting state for Account Name column
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const handleSort = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const sortedFilteredAccounts = useMemo(() => {
    const list = [...filteredAccounts];
    list.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredAccounts, sortDirection]);

  // Paginated Accounts slice
  const pagedAccounts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedFilteredAccounts.slice(start, start + pageSize);
  }, [sortedFilteredAccounts, page, pageSize]);

  const refreshWorkspace = async () => {
    if (!selectedAccountId || !selectedFinancialYearId) return;
    const data = await accountGrowthApi.getWorkspace(selectedAccountId, selectedFinancialYearId);
    setWorkspace(data);
  };

  // --- LANDING PAGE VIEW (ACCOUNT LIST) ---
  if (viewMode === 'list') {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title="Account Growth"
          subtitle="Select an Account and Financial Year to open the Account Growth workspace."
          icon={<Sprout className="w-5 h-5 text-emerald-600" />}
        />

        <FilterBar>
          <SearchBar
            value={searchTerm}
            onChange={(val: string) => {
              setSearchTerm(val);
              setPage(1);
            }}
            placeholder="Search Accounts by name..."
          />
        </FilterBar>

        <Card padding="none" clip>
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableHeadCell columnId="name">
                  <SortableHeader
                    label="Account Name"
                    field="name"
                    sortField="name"
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableHeadCell>
                <TableHeadCell columnId="fy" className="w-64">
                  Financial Year
                </TableHeadCell>
                <TableHeadCell align="right" className="w-44">
                  Actions
                </TableHeadCell>
              </TableHead>
              <tbody>
                {sortedFilteredAccounts.length === 0 ? (
                  <EmptyRow
                    colSpan={3}
                    message={searchTerm ? 'No accounts match your search criteria.' : 'No accessible accounts found.'}
                  />
                ) : (
                  pagedAccounts.map((account) => {
                    const rowFyId = selectedFinancialYears[account.id] || activeFinancialYear?.id || '';
                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-bold text-slate-800">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {account.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-xs hover:text-blue-600 transition-colors">
                                {account.name}
                              </p>
                              {account.industry && (
                                <p className="text-[10px] text-slate-400 font-normal">{account.industry}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <select
                            value={rowFyId}
                            onChange={(e) => handleRowFyChange(account.id, e.target.value)}
                            className={SELECT_CLS}
                          >
                            {sortedFinancialYears.map((fy) => (
                              <option key={fy.id} value={fy.id}>
                                {getFyLabel(fy)}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenGrowthDetail(account.id, rowFyId)}
                          >
                            View Growth
                            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
          {sortedFilteredAccounts.length > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={sortedFilteredAccounts.length}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          )}
        </Card>
      </div>
    );
  }

  // --- DETAIL WORKSPACE VIEW ---
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Detail Page Context Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="Back to Account Growth List"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                {currentAccount?.name || 'Account Growth Detail'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {fyDisplayLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Account Growth workspace for <span className="font-semibold text-slate-700">{currentAccount?.name}</span> ({fyDisplayLabel})
            </p>
          </div>
        </div>
      </div>

      {/* Detail Workspace Navigation Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl px-4 pt-3 border-x border-t">
        <nav className="flex space-x-6 text-xs font-semibold overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('client-priorities')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'client-priorities'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Client Priorities
          </button>
          <button
            onClick={() => setActiveTab('client-budget')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'client-budget'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Client Budget & Positioning
          </button>
          <button
            onClick={() => setActiveTab('knowing-ourselves')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'knowing-ourselves'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Knowing Ourselves
          </button>
          <button
            onClick={() => setActiveTab('knowing-competitor')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'knowing-competitor'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Knowing the Competitor
          </button>
          <button
            onClick={() => setActiveTab('action-plan')}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'action-plan'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Action Plan - General
          </button>
        </nav>
      </div>

      {/* Main Workspace Body */}
      {loading ? (
        <div className="bg-white rounded-b-xl border border-slate-200 p-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-xs font-semibold text-slate-600">
            Loading Account Growth for {currentAccount?.name || 'Account'} — {fyDisplayLabel}...
          </p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-b-xl border border-slate-200 p-12 text-center text-red-500 text-xs">
          {error}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Empty State Banner if no growth data entered */}
          {!hasWorkspaceData && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center space-y-2">
              <Sparkles className="w-8 h-8 text-blue-500 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">
                No Account Growth data entered for {currentAccount?.name} — {fyDisplayLabel}
              </h4>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                Start building the Account Growth plan by adding Client Priorities, Budget & Positioning, SWOT, Competitor information, or Action Plans using the tabs below.
              </p>
            </div>
          )}

          {/* Active Tab Content */}
          {activeTab === 'client-priorities' && (
            <ClientPrioritiesTab
              accountId={selectedAccountId}
              financialYearId={selectedFinancialYearId}
              clientPriorities={workspace?.clientPriorities || []}
              industryTrends={workspace?.industryTrends || []}
              canEdit={canEdit}
              onSavePriority={async (data) => {
                if (data.id) {
                  await accountGrowthApi.updateClientPriority(data.id, data);
                } else {
                  await accountGrowthApi.createClientPriority(data);
                }
                await refreshWorkspace();
              }}
              onDeletePriority={async (id) => {
                await accountGrowthApi.deleteClientPriority(id, selectedAccountId);
                await refreshWorkspace();
              }}
              onSaveTrend={async (data) => {
                if (data.id) {
                  await accountGrowthApi.updateIndustryTrend(data.id, data);
                } else {
                  await accountGrowthApi.createIndustryTrend(data);
                }
                await refreshWorkspace();
              }}
              onDeleteTrend={async (id) => {
                await accountGrowthApi.deleteIndustryTrend(id, selectedAccountId);
                await refreshWorkspace();
              }}
            />
          )}

          {activeTab === 'client-budget' && (
            <ClientBudgetPositioningTab
              accountId={selectedAccountId}
              financialYearId={selectedFinancialYearId}
              financialLabel={fyDisplayLabel}
              budgetPositioning={workspace?.budgetPositioning || null}
              walletSharePlans={workspace?.walletSharePlans || []}
              successParameters={workspace?.successParameters || []}
              outsourcingSplits={workspace?.outsourcingSplits || []}
              canEdit={canEdit}
              onSaveBudgetPositioning={async (data) => {
                await accountGrowthApi.saveBudgetPositioning(data);
                await refreshWorkspace();
              }}
              onSaveWalletSharePlan={async (data) => {
                if (data.id) {
                  await accountGrowthApi.updateWalletSharePlan(data.id, data);
                } else {
                  await accountGrowthApi.createWalletSharePlan(data);
                }
                await refreshWorkspace();
              }}
              onDeleteWalletSharePlan={async (id) => {
                await accountGrowthApi.deleteWalletSharePlan(id, selectedAccountId);
                await refreshWorkspace();
              }}
              onSaveSuccessParameters={async (items) => {
                await accountGrowthApi.saveSuccessParameters(selectedAccountId, selectedFinancialYearId, items);
                await refreshWorkspace();
              }}
              onSaveOutsourcingSplit={async (data) => {
                if (data.id) {
                  await accountGrowthApi.updateOutsourcingSplit(data.id, data);
                } else {
                  await accountGrowthApi.createOutsourcingSplit(data);
                }
                await refreshWorkspace();
              }}
              onDeleteOutsourcingSplit={async (id) => {
                await accountGrowthApi.deleteOutsourcingSplit(id, selectedAccountId);
                await refreshWorkspace();
              }}
            />
          )}

          {activeTab === 'knowing-ourselves' && (
            <KnowingOurselvesTab
              accountId={selectedAccountId}
              financialYearId={selectedFinancialYearId}
              swotItems={workspace?.swot || []}
              canEdit={canEdit}
              onSaveSwot={async (data) => {
                if (data.id) {
                  await accountGrowthApi.updateSwot(data.id, data);
                } else {
                  await accountGrowthApi.createSwot(data);
                }
                await refreshWorkspace();
              }}
              onDeleteSwot={async (id) => {
                await accountGrowthApi.deleteSwot(id, selectedAccountId);
                await refreshWorkspace();
              }}
            />
          )}

          {activeTab === 'knowing-competitor' && (
            <KnowingTheCompetitorTab
              accountId={selectedAccountId}
              financialYearId={selectedFinancialYearId}
              competitors={workspace?.competitors || []}
              canEdit={canEdit}
              onSaveCompetitor={async (data) => {
                if (data.id) {
                  await accountGrowthApi.updateCompetitor(data.id, data);
                } else {
                  await accountGrowthApi.createCompetitor(data);
                }
                await refreshWorkspace();
              }}
              onDeleteCompetitor={async (id) => {
                await accountGrowthApi.deleteCompetitor(id, selectedAccountId);
                await refreshWorkspace();
              }}
            />
          )}

          {activeTab === 'action-plan' && (
            <ActionPlanGeneralTab
              accountId={selectedAccountId}
              financialYearId={selectedFinancialYearId}
              actionPlans={workspace?.actionPlans || []}
              canEdit={canEdit}
              onSaveActionPlan={async (data) => {
                if (data.id) {
                  await accountGrowthApi.updateActionPlan(data.id, data);
                } else {
                  await accountGrowthApi.createActionPlan(data);
                }
                await refreshWorkspace();
              }}
              onDeleteActionPlan={async (id) => {
                await accountGrowthApi.deleteActionPlan(id, selectedAccountId);
                await refreshWorkspace();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

