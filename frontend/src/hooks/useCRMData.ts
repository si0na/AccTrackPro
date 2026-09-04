import { useState, useEffect } from 'react';
import type {
  Account, Opportunity, ActionItem, Stakeholder, Activity, Comment,
  CustomColumn, ColumnConfig, FinancialYear, FinancialCalendar, AdminSettings, Project,
  EmployeeAppreciation,
} from '@/types';
import type { OwnerFilter } from '@/api/crm.api';
import {
  accountsApi, opportunitiesApi, actionItemsApi, stakeholdersApi,
  activitiesApi, commentsApi, customColumnsApi, columnConfigsApi, financialYearsApi,
  notificationsApi, administrationApi, projectsApi, serviceProvidersApi, employeeAppreciationApi,
} from '@/api/crm.api';

const DEFAULT_ACCOUNTS_COLUMNS: ColumnConfig[] = [
  { key: 'name',     name: 'Account Name',   isStandard: true, isPinned: true,  isDisplayed: true, type: 'text'   },
  { key: 'type',     name: 'Account Type',   isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'industry', name: 'Industry',       isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'status',   name: 'Status',         isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'health',   name: 'Health',         isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'location', name: 'Location',       isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'tower',    name: 'Tower',          isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'since',    name: 'Customer Since', isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'revenue',  name: 'Revenue',        isStandard: true, isPinned: false, isDisplayed: true, type: 'number' },
];

const DEFAULT_OPPORTUNITIES_COLUMNS: ColumnConfig[] = [
  { key: 'name',                name: 'Opportunity Name',           isStandard: true, isPinned: true,  isDisplayed: true, type: 'text'   },
  { key: 'accountId',           name: 'Account Name',               isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'description',         name: 'Description',                isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'stage',               name: 'Stage',                      isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'opportunityType',     name: 'Category',                   isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'serviceLine',         name: 'Service Line',               isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'probability',         name: 'Probability',                isStandard: true, isPinned: false, isDisplayed: true, type: 'number' },
  { key: 'serviceProviderStakeholderId', name: 'Owner',             isStandard: true, isPinned: false, isDisplayed: true, type: 'text'   },
  { key: 'dealStartDate',       name: 'Deal Start Date',            isStandard: true, isPinned: false, isDisplayed: true, type: 'date'   },
  { key: 'allocationStartDate', name: 'Expected Project Start Date',isStandard: true, isPinned: false, isDisplayed: true, type: 'date'   },
  { key: 'allocationEndDate',   name: 'Expected Project End Date',  isStandard: true, isPinned: false, isDisplayed: true, type: 'date'   },
  { key: 'value',               name: 'Deal Size',                  isStandard: true, isPinned: false, isDisplayed: false, type: 'number' },
  { key: 'opportunityHealth',   name: 'Opportunity Health',         isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'location',             name: 'Location',                   isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'cost',                 name: 'Cost',                       isStandard: true, isPinned: false, isDisplayed: false, type: 'number' },
  { key: 'grossMargin',          name: 'Gross Margin (%)',           isStandard: true, isPinned: false, isDisplayed: false, type: 'number' },
  { key: 'priority',             name: 'Priority',                   isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'deliveryModel',        name: 'Delivery Model',             isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'billingModel',         name: 'Billing Model',              isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'tower',                name: 'Tower',                      isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'risksAndDependencies', name: 'Risks & Dependencies',       isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
];

const DEFAULT_ACTION_ITEMS_COLUMNS: ColumnConfig[] = [
  { key: 'title',         name: 'Action Item Title', isStandard: true, isPinned: true,  isDisplayed: true, type: 'text' },
  { key: 'accountId',     name: 'Account',           isStandard: true, isPinned: false, isDisplayed: true, type: 'text' },
  { key: 'opportunityId', name: 'Opportunity',       isStandard: true, isPinned: false, isDisplayed: true, type: 'text' },
  { key: 'projectId',     name: 'Project',           isStandard: true, isPinned: false, isDisplayed: true, type: 'text' },
  { key: 'owner',         name: 'Owner',             isStandard: true, isPinned: false, isDisplayed: true, type: 'text' },
  { key: 'priority',      name: 'Priority',          isStandard: true, isPinned: false, isDisplayed: true, type: 'text' },
  { key: 'status',        name: 'Status',            isStandard: true, isPinned: false, isDisplayed: true, type: 'text' },
  { key: 'openDate',      name: 'Open Date',         isStandard: true, isPinned: false, isDisplayed: true, type: 'date' },
  { key: 'dueDate',       name: 'Due Date',          isStandard: true, isPinned: false, isDisplayed: true, type: 'date' },
  { key: 'notes',         name: 'Description',       isStandard: true, isPinned: false, isDisplayed: true, type: 'text' },
  { key: 'risksAndDependencies', name: 'Risks & Dependencies', isStandard: true, isPinned: false, isDisplayed: true, type: 'text' },
];

const DEFAULT_PERFORMANCE_EVALUATION_COLUMNS: ColumnConfig[] = [
  { key: 'employeeName',           name: 'Employee Name',              isStandard: true, isPinned: true,  isDisplayed: true,  type: 'text'   },
  { key: 'account',                name: 'Account',                    isStandard: true, isPinned: false, isDisplayed: true,  type: 'text'   },
  { key: 'project',                name: 'Project',                    isStandard: true, isPinned: false, isDisplayed: true,  type: 'text'   },
  { key: 'manager',                name: 'Manager',                    isStandard: true, isPinned: false, isDisplayed: true,  type: 'text'   },
  { key: 'month',                  name: 'Month',                      isStandard: true, isPinned: false, isDisplayed: true,  type: 'text'   },
  { key: 'hasReportees',           name: 'Has Reportees',              isStandard: true, isPinned: false, isDisplayed: true,  type: 'boolean' },
  { key: 'finalScore',             name: 'Final Score (Calculated)',   isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'q4Score',                name: 'Q4 2025 Score (Calculated)', isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'deliveryExcellence',     name: 'Delivery Excellence',        isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'qualityStandards',       name: 'Quality Standards',          isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'technicalCapability',    name: 'Technical Capability',       isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'communication',          name: 'Communication (Int/Ext)',    isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'sla',                    name: 'SLA (Schedule/Cost/Scope)',  isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'teamCollaboration',      name: 'Team Collaboration',         isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'reliability',            name: 'Reliability',                isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'innovation',             name: 'Innovation & AI Adoption',   isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'ideation',               name: 'Ideation',                   isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'behavioural',            name: 'Behavioural Competency',     isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'leadership',             name: 'Leadership',                 isStandard: true, isPinned: false, isDisplayed: true,  type: 'number' },
  { key: 'customerFeedback',       name: 'Customer Feedback',          isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'employeeFeedback',       name: 'Employee Feedback',          isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'trainingRequired',       name: 'Training Required',          isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'strength',               name: 'Strength',                   isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'improvementArea',        name: 'Improvement Area',           isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'keyContributionDetails', name: 'Key Contribution Details',   isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'ideaDetails',            name: 'Idea Details',               isStandard: true, isPinned: false, isDisplayed: false, type: 'text'   },
  { key: 'overallComment',         name: 'Overall Comment',            isStandard: true, isPinned: false, isDisplayed: true,  type: 'text'   },
  { key: 'actionItemNextMonth',    name: 'Action Item for Next Month', isStandard: true, isPinned: false, isDisplayed: true,  type: 'text'   },
  { key: 'retentionRisk',          name: 'Retention Risk',             isStandard: true, isPinned: false, isDisplayed: true,  type: 'text'   },
];

type CustomColumnModule = 'accounts' | 'opportunities' | 'actionItems' | 'performanceEvaluation';

function getMergedConfig(
  module: CustomColumnModule,
  savedConfig: ColumnConfig[],
  customCols: CustomColumn[],
): ColumnConfig[] {
  const defaults =
    module === 'accounts' ? DEFAULT_ACCOUNTS_COLUMNS
    : module === 'opportunities' ? DEFAULT_OPPORTUNITIES_COLUMNS
    : module === 'actionItems' ? DEFAULT_ACTION_ITEMS_COLUMNS
    : DEFAULT_PERFORMANCE_EVALUATION_COLUMNS;

  let current = savedConfig?.length > 0 ? [...savedConfig] : [...defaults];

  // Detect and migrate legacy configs (e.g. missing new standard columns like dealStartDate)
  const hasNewStandardCol = current.some(col => col.key === 'dealStartDate');
  if (module === 'opportunities' && !hasNewStandardCol) {
    current = [...defaults];
  }

  defaults.forEach((d) => {
    if (!current.some((c) => c.key === d.key)) current.push({ ...d });
  });

  current = current.filter((col) =>
    (col.isStandard && defaults.some((d) => d.key === col.key)) ||
    (!col.isStandard && customCols.some((cc) => cc.key === col.key)),
  );

  // Align standard column names with defaults
  current = current.map(col => {
    if (col.isStandard) {
      const def = defaults.find(d => d.key === col.key);
      if (def) {
        return {
          ...col,
          name: def.name,
        };
      }
    }
    return col;
  });

  // Note: Do not force-sort current columns back to default order here, so that user custom column arrangement/ordering is preserved.

  customCols.forEach((cc) => {
    if (!current.some((col) => col.key === cc.key)) {
      current.push({ key: cc.key, name: cc.name, isStandard: false, isPinned: false, isDisplayed: true, type: cc.type as ColumnConfig['type'] });
    }
  });

  return current;
}

/** Operational modules are never period-filtered — owner scope only. */
function buildOwnerFilter(currentUserId: string): OwnerFilter {
  return { userId: currentUserId || undefined };
}

export const useCRMData = (
  currentUser: string,
  currentUserId: string,
  isAuthenticated: boolean,
) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [deactivatedAccounts, setDeactivatedAccounts] = useState<Account[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [deactivatedOpportunities, setDeactivatedOpportunities] = useState<Opportunity[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [deactivatedProjects, setDeactivatedProjects] = useState<Project[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [deactivatedActionItems, setDeactivatedActionItems] = useState<ActionItem[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [deactivatedStakeholders, setDeactivatedStakeholders] = useState<Stakeholder[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [employeeAppreciations, setEmployeeAppreciations] = useState<EmployeeAppreciation[]>([]);
  const [accountColumns, setAccountColumns] = useState<CustomColumn[]>([]);
  const [opportunityColumns, setOpportunityColumns] = useState<CustomColumn[]>([]);
  const [actionItemColumns, setActionItemColumns] = useState<CustomColumn[]>([]);
  const [performanceEvaluationColumns, setPerformanceEvaluationColumns] = useState<CustomColumn[]>([]);
  const [rawAccountsConfig, setRawAccountsConfig] = useState<ColumnConfig[]>([]);
  const [rawOpportunitiesConfig, setRawOpportunitiesConfig] = useState<ColumnConfig[]>([]);
  const [rawActionItemsConfig, setRawActionItemsConfig] = useState<ColumnConfig[]>([]);
  const [rawPerformanceEvaluationConfig, setRawPerformanceEvaluationConfig] = useState<ColumnConfig[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [financialCalendar, setFinancialCalendar] = useState<FinancialCalendar | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Loads FY list, financial calendar, and admin settings.
  // Call on startup, after auth changes, and after administration changes only.
  const loadConfig = async () => {
    try {
      const [fyData, calendarData, settingsData] = await Promise.all([
        financialYearsApi.getAll(),
        administrationApi.getFinancialCalendar(),
        administrationApi.getSettings(),
      ]);
      setFinancialYears(fyData ?? []);
      setFinancialCalendar(calendarData ?? null);
      setAdminSettings(settingsData ?? null);
    } catch (err) {
      console.error('[useCRMData] Failed to load configuration:', err);
    }
  };

  // Loads operational entity data. Operational modules are never filtered by
  // the Global Period Selector — only reporting (analytics) endpoints are.
  const refreshData = async () => {
    try {
      const owner = buildOwnerFilter(currentUserId);
      const [
        accountsData, deactivatedData,
        oppsData, deactivatedOppsData,
        aiData, deactivatedAiData,
        stkData, deactivatedStkData,
        actvData, commentsData,
        customCols, configs,
        projectsData, deactivatedProjectsData,
        apprData,
      ] = await Promise.all([
        accountsApi.getAll(owner),
        accountsApi.getDeactivated(owner),
        opportunitiesApi.getAll(owner),
        opportunitiesApi.getDeactivated(owner),
        actionItemsApi.getAll(owner),
        actionItemsApi.getDeactivated(owner),
        stakeholdersApi.getAll(owner),
        stakeholdersApi.getDeactivated(owner),
        activitiesApi.getAll(owner),
        commentsApi.getAll(),
        customColumnsApi.getAll(),
        columnConfigsApi.getAll(),
        projectsApi.getAll(owner),
        projectsApi.getDeactivated(owner),
        employeeAppreciationApi.getAll(),
      ]);

      setAccounts(accountsData);
      setDeactivatedAccounts(deactivatedData);
      setOpportunities(oppsData);
      setDeactivatedOpportunities(deactivatedOppsData);
      setProjects(projectsData);
      setDeactivatedProjects(deactivatedProjectsData);
      setActionItems(aiData);
      setDeactivatedActionItems(deactivatedAiData);
      setStakeholders(stkData);
      setDeactivatedStakeholders(deactivatedStkData);
      setActivities(actvData);
      setComments(commentsData);
      setEmployeeAppreciations(apprData ?? []);
      setAccountColumns(customCols.accountColumns ?? []);
      setOpportunityColumns(customCols.opportunityColumns ?? []);
      setActionItemColumns(customCols.actionItemColumns ?? []);
      setPerformanceEvaluationColumns(customCols.performanceEvaluationColumns ?? []);
      setRawAccountsConfig(configs.rawAccountsConfig ?? []);
      setRawOpportunitiesConfig(configs.rawOpportunitiesConfig ?? []);
      setRawActionItemsConfig(configs.rawActionItemsConfig ?? []);
      setRawPerformanceEvaluationConfig(configs.rawPerformanceEvaluationConfig ?? []);
      notificationsApi.getUnreadCount().then(({ count }) => setUnreadNotificationCount(count)).catch((err) => console.error('[useCRMData] Failed to fetch unread count:', err));
    } catch (err) {
      console.error('[useCRMData] Failed to load entity data:', err);
    }
  };

  // Startup / auth change: load configuration then entity data. Operational
  // data does not depend on the Global Period Selector, so no period-change
  // refetch exists — reporting components fetch analytics themselves.
  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        await loadConfig();
        await refreshData();
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll unread count every 30s so the navbar/sidebar badge stays current on
  // all views. Skipped while the tab is hidden — the next visible tick
  // catches up, so background tabs stop hammering the API.
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      notificationsApi
        .getUnreadCount()
        .then(({ count }) => setUnreadNotificationCount(count))
        .catch((err) => console.error('[useCRMData] Poll: failed to fetch unread count:', err));
    }, 30_000);
    return () => clearInterval(id);
  }, [isAuthenticated, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const accountsColumnConfig = getMergedConfig('accounts', rawAccountsConfig, accountColumns);
  const opportunitiesColumnConfig = getMergedConfig('opportunities', rawOpportunitiesConfig, opportunityColumns);
  const actionItemsColumnConfig = getMergedConfig('actionItems', rawActionItemsConfig, actionItemColumns);
  const performanceEvaluationColumnConfig = getMergedConfig('performanceEvaluation', rawPerformanceEvaluationConfig, performanceEvaluationColumns);

  // ─── Column config actions ─────────────────────────────────────────────────

  const updateColumnConfig = async (module: CustomColumnModule, config: ColumnConfig[]) => {
    if (module === 'accounts') { setRawAccountsConfig(config); await columnConfigsApi.save({ rawAccountsConfig: config }); }
    else if (module === 'opportunities') { setRawOpportunitiesConfig(config); await columnConfigsApi.save({ rawOpportunitiesConfig: config }); }
    else if (module === 'actionItems') { setRawActionItemsConfig(config); await columnConfigsApi.save({ rawActionItemsConfig: config }); }
    else { setRawPerformanceEvaluationConfig(config); await columnConfigsApi.save({ rawPerformanceEvaluationConfig: config }); }
  };

  const resetColumnConfig = async (module: CustomColumnModule) => {
    if (module === 'accounts') { setRawAccountsConfig(DEFAULT_ACCOUNTS_COLUMNS); await columnConfigsApi.save({ rawAccountsConfig: DEFAULT_ACCOUNTS_COLUMNS }); }
    else if (module === 'opportunities') { setRawOpportunitiesConfig(DEFAULT_OPPORTUNITIES_COLUMNS); await columnConfigsApi.save({ rawOpportunitiesConfig: DEFAULT_OPPORTUNITIES_COLUMNS }); }
    else if (module === 'actionItems') { setRawActionItemsConfig(DEFAULT_ACTION_ITEMS_COLUMNS); await columnConfigsApi.save({ rawActionItemsConfig: DEFAULT_ACTION_ITEMS_COLUMNS }); }
    else { setRawPerformanceEvaluationConfig(DEFAULT_PERFORMANCE_EVALUATION_COLUMNS); await columnConfigsApi.save({ rawPerformanceEvaluationConfig: DEFAULT_PERFORMANCE_EVALUATION_COLUMNS }); }
  };

  // ─── Account actions ───────────────────────────────────────────────────────

  const addAccount = async (data: Omit<Account, 'id'>): Promise<Account> => {
    const created = await accountsApi.create({ ...data, ownerId: currentUserId });
    setAccounts((prev) => [created, ...prev]);
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
    // When the creator is an Account Manager the backend auto-registers a
    // Service Provider stakeholder for the new account. Refetch stakeholders so
    // it appears in the Service Providers tab immediately (the Client tab is
    // unaffected — its rows don't change).
    stakeholdersApi.getAll(f).then(setStakeholders);
    scheduleCountRefresh();
    return created;
  };

  const updateAccount = async (updated: Account): Promise<void> => {
    const res = await accountsApi.update(updated.id, updated);
    setAccounts((prev) => prev.map((a) => (a.id === updated.id ? res : a)));
    const f = buildOwnerFilter(currentUserId);
    opportunitiesApi.getAll(f).then(setOpportunities);
    activitiesApi.getAll(f).then(setActivities);
    // The edit form can attach/detach client stakeholders and add/remove
    // service providers, so the stakeholder lists must be refetched (removed
    // service providers are soft-deleted, hence the deactivated list too).
    if (updated.clientStakeholderIds !== undefined || updated.serviceProviderUserIds !== undefined) {
      stakeholdersApi.getAll(f).then(setStakeholders);
      stakeholdersApi.getDeactivated(f).then(setDeactivatedStakeholders);
      scheduleCountRefresh();
    }
  };

  const deleteAccount = async (id: string): Promise<void> => {
    const account = accounts.find((a) => a.id === id);
    await accountsApi.delete(id);
    if (account) setDeactivatedAccounts((prev) => [account, ...prev]);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    const cascadedOpps = opportunities.filter((o) => o.accountId === id);
    setOpportunities((prev) => prev.filter((o) => o.accountId !== id));
    if (cascadedOpps.length > 0) setDeactivatedOpportunities((prev) => [...cascadedOpps, ...prev]);
    const cascadedAIs = actionItems.filter((ai) => ai.accountId === id);
    setActionItems((prev) => prev.filter((ai) => ai.accountId !== id));
    if (cascadedAIs.length > 0) setDeactivatedActionItems((prev) => [...cascadedAIs, ...prev]);
    const cascadedStks = stakeholders.filter((s) => s.accountId === id);
    setStakeholders((prev) => prev.filter((s) => s.accountId !== id));
    if (cascadedStks.length > 0) setDeactivatedStakeholders((prev) => [...cascadedStks, ...prev]);
    const owner = buildOwnerFilter(currentUserId);
    const f = buildOwnerFilter(currentUserId);
    stakeholdersApi.getAll(owner).then(setStakeholders);
    stakeholdersApi.getDeactivated(owner).then(setDeactivatedStakeholders);
    actionItemsApi.getAll(f).then(setActionItems);
    actionItemsApi.getDeactivated(f).then(setDeactivatedActionItems);
    opportunitiesApi.getDeactivated(f).then(setDeactivatedOpportunities);
    activitiesApi.getAll(f).then(setActivities);
  };

  const restoreAccount = async (id: string): Promise<void> => {
    const restored = await accountsApi.restore(id);
    setDeactivatedAccounts((prev) => prev.filter((a) => a.id !== id));
    const f = buildOwnerFilter(currentUserId);
    await accountsApi.getAll(buildOwnerFilter(currentUserId)).then(setAccounts);
    activitiesApi.getAll(f).then(setActivities);
    return void restored;
  };

  // ─── Opportunity actions ───────────────────────────────────────────────────

  const addOpportunity = async (data: Omit<Opportunity, 'id'>): Promise<Opportunity> => {
    // The fiscal period is derived server-side from the close date — never
    // stamped by the client.
    const created = await opportunitiesApi.create(data);
    setOpportunities((prev) => [created, ...prev]);
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
    // Reaching Won no longer spawns a Project automatically — a user creates it
    // explicitly (see createProjectFromOpportunity), so no project refetch here.
    scheduleCountRefresh();
    return created;
  };

  const updateOpportunity = async (updated: Opportunity): Promise<void> => {
    await opportunitiesApi.update(updated.id, updated);
    const f = buildOwnerFilter(currentUserId);
    const fresh = await opportunitiesApi.getAll(f);
    setOpportunities(fresh);
    activitiesApi.getAll(f).then(setActivities);
    // Marking an opportunity Won no longer creates a Project — that happens only
    // via the explicit "Create Project" action (createProjectFromOpportunity).
  };

  const deleteOpportunity = async (id: string): Promise<void> => {
    const opp = opportunities.find((o) => o.id === id);
    await opportunitiesApi.delete(id);
    if (opp) setDeactivatedOpportunities((prev) => [opp, ...prev]);
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
    setActionItems((prev) => prev.filter((ai) => ai.opportunityId !== id));
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
  };

  const restoreOpportunity = async (id: string): Promise<void> => {
    const restored = await opportunitiesApi.restore(id);
    setDeactivatedOpportunities((prev) => prev.filter((o) => o.id !== id));
    const f = buildOwnerFilter(currentUserId);
    await opportunitiesApi.getAll(f).then(setOpportunities);
    activitiesApi.getAll(f).then(setActivities);
    return void restored;
  };

  // ─── Project actions ────────────────────────────────────────────────────────
  // Projects are normally derived server-side from a Won Opportunity — the UI
  // never exposes a manual "New Project" action — but addProject is still
  // provided for API completeness/consistency with every other entity.

  const addProject = async (data: Omit<Project, 'id'>): Promise<Project> => {
    const created = await projectsApi.create(data);
    setProjects((prev) => [created, ...prev]);
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
    scheduleCountRefresh();
    return created;
  };

  // User-initiated conversion of a Won opportunity into a Project. The backend
  // forces the account/opportunity/owner links; the opportunity then carries a
  // linked projectId (joined server-side), so refetch opportunities to flip the
  // "Create Project" action to "View Project" everywhere it appears.
  const createProjectFromOpportunity = async (
    opportunityId: string,
    data: Partial<Project>,
  ): Promise<Project> => {
    const created = await opportunitiesApi.createProject(opportunityId, data);
    setProjects((prev) => [created, ...prev]);
    const f = buildOwnerFilter(currentUserId);
    opportunitiesApi.getAll(f).then(setOpportunities);
    activitiesApi.getAll(f).then(setActivities);
    scheduleCountRefresh();
    return created;
  };

  const updateProject = async (updated: Project): Promise<void> => {
    const res = await projectsApi.update(updated.id, updated);
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? res : p)));
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
  };

  // Refetch a single project into local state. Used after a write that bypasses
  // updateProject — notably a Health Tracker update, which changes the project's
  // health server-side, so the header badge and Overview must pick it up without
  // a full refreshData().
  const refreshProject = async (id: string): Promise<void> => {
    const fresh = await projectsApi.getById(id);
    setProjects((prev) => prev.map((p) => (p.id === id ? fresh : p)));
  };

  const deleteProject = async (id: string): Promise<void> => {
    const project = projects.find((p) => p.id === id);
    await projectsApi.delete(id);
    if (project) setDeactivatedProjects((prev) => [project, ...prev]);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
  };

  const restoreProject = async (id: string): Promise<void> => {
    const restored = await projectsApi.restore(id);
    setDeactivatedProjects((prev) => prev.filter((p) => p.id !== id));
    const f = buildOwnerFilter(currentUserId);
    await projectsApi.getAll(buildOwnerFilter(currentUserId)).then(setProjects);
    activitiesApi.getAll(f).then(setActivities);
    return void restored;
  };

  // ─── Action item actions ───────────────────────────────────────────────────

  const addActionItem = async (data: Omit<ActionItem, 'id'>): Promise<ActionItem> => {
    // The fiscal period is derived server-side from the due date.
    const created = await actionItemsApi.create(data);
    setActionItems((prev) => [created, ...prev]);
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
    scheduleCountRefresh();
    return created;
  };

  const updateActionItem = async (updated: ActionItem): Promise<void> => {
    const res = await actionItemsApi.update(updated.id, updated);
    setActionItems((prev) => prev.map((a) => (a.id === updated.id ? res : a)));
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
    scheduleCountRefresh();
  };

  const deleteActionItem = async (id: string): Promise<void> => {
    const item = actionItems.find((a) => a.id === id);
    await actionItemsApi.delete(id);
    if (item) setDeactivatedActionItems((prev) => [item, ...prev]);
    setActionItems((prev) => prev.filter((a) => a.id !== id));
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
  };

  // ─── Stakeholder actions ───────────────────────────────────────────────────

  const addStakeholder = async (data: Omit<Stakeholder, 'id'>): Promise<Stakeholder> => {
    const created = await stakeholdersApi.create(data);
    setStakeholders((prev) => [created, ...prev]);
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
    scheduleCountRefresh();
    return created;
  };

  const updateStakeholder = async (updated: Stakeholder): Promise<void> => {
    const res = await stakeholdersApi.update(updated.id, updated);
    setStakeholders((prev) => prev.map((s) => (s.id === updated.id ? res : s)));
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
  };

  const deleteStakeholder = async (id: string): Promise<void> => {
    const stk = stakeholders.find((s) => s.id === id);
    await stakeholdersApi.delete(id);
    if (stk) setDeactivatedStakeholders((prev) => [stk, ...prev]);
    setStakeholders((prev) => prev.filter((s) => s.id !== id));
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
  };
  /**
   * Register a person from the Service Provider directory on an account. The
   * id is either a user id or — for someone still pending registration — an
   * employee_master id; the backend resolves both.
   *
   * Returns the resolved SERVICE_PROVIDER stakeholder id and awaits the
   * stakeholder refetch, so callers that need to reference the new row (e.g.
   * setting an opportunity's Service Provider) can use it immediately instead
   * of racing an in-flight refresh.
   */
  const associateServiceProvider = async (
    serviceProviderId: string, accountId: string,
  ): Promise<string | null> => {
    const stakeholderId = await serviceProvidersApi.associate(serviceProviderId, accountId);
    const f = buildOwnerFilter(currentUserId);
    const [refreshed] = await Promise.all([
      stakeholdersApi.getAll(f),
      activitiesApi.getAll(f).then(setActivities).catch(() => undefined),
    ]);
    setStakeholders(refreshed);
    return stakeholderId || null;
  };
  // ─── Comment actions ───────────────────────────────────────────────────────

  const addComment = async (targetType: Comment['targetType'], targetId: string, text: string): Promise<void> => {
    const created = await commentsApi.create({ targetType, targetId, text, user: '', userId: currentUserId });
    setComments((prev) => [created, ...prev]);
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
  };

  const deleteComment = async (id: string): Promise<void> => {
    await commentsApi.delete(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const updateComment = async (id: string, text: string): Promise<void> => {
    const updated = await commentsApi.update(id, text);
    setComments((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  // ─── Employee Appreciation actions ────────────────────────────────────────

  const addEmployeeAppreciation = async (
    data: Omit<EmployeeAppreciation, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<EmployeeAppreciation> => {
    const created = await employeeAppreciationApi.create(data);
    setEmployeeAppreciations((prev) => [created, ...prev]);
    return created;
  };

  const updateEmployeeAppreciation = async (
    id: string,
    data: Partial<EmployeeAppreciation>,
  ): Promise<void> => {
    const updated = await employeeAppreciationApi.update(id, data);
    setEmployeeAppreciations((prev) => prev.map((item) => (item.id === id ? updated : item)));
  };

  const deleteEmployeeAppreciation = async (id: string): Promise<void> => {
    await employeeAppreciationApi.delete(id);
    setEmployeeAppreciations((prev) => prev.filter((item) => item.id !== id));
  };

  // ─── Custom column actions ─────────────────────────────────────────────────

  const addCustomColumn = async (
    module: CustomColumnModule,
    name: string,
    type: 'text' | 'number' | 'date' | 'boolean',
  ): Promise<void> => {
    const created = await customColumnsApi.create({ module, name, type });
    if (module === 'accounts') setAccountColumns((prev) => [...prev, created]);
    else if (module === 'opportunities') setOpportunityColumns((prev) => [...prev, created]);
    else if (module === 'actionItems') setActionItemColumns((prev) => [...prev, created]);
    else setPerformanceEvaluationColumns((prev) => [...prev, created]);
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
  };

  const deleteCustomColumn = async (module: CustomColumnModule, id: string): Promise<void> => {
    await customColumnsApi.delete(module, id);
    if (module === 'accounts') setAccountColumns((prev) => prev.filter((c) => c.id !== id));
    else if (module === 'opportunities') setOpportunityColumns((prev) => prev.filter((c) => c.id !== id));
    else if (module === 'actionItems') setActionItemColumns((prev) => prev.filter((c) => c.id !== id));
    else setPerformanceEvaluationColumns((prev) => prev.filter((c) => c.id !== id));
    const f = buildOwnerFilter(currentUserId);
    activitiesApi.getAll(f).then(setActivities);
  };

  const scheduleCountRefresh = () => {
    setTimeout(() => {
      notificationsApi
        .getUnreadCount()
        .then(({ count }) => setUnreadNotificationCount(count))
        .catch(() => { /* polling interval will retry */ });
    }, 800);
  };

  const revenueByAccount = new Map<string, number>();
  for (const o of opportunities) {
    revenueByAccount.set(o.accountId, (revenueByAccount.get(o.accountId) ?? 0) + o.value);
  }
  const withRevenue = (accs: Account[]) =>
    accs.map((a) => ({ ...a, revenue: revenueByAccount.get(a.id) ?? a.revenue }));

  return {
    financialYears,
    financialCalendar,
    adminSettings,
    accounts: withRevenue(accounts),
    deactivatedAccounts: withRevenue(deactivatedAccounts),
    opportunities,
    deactivatedOpportunities,
    projects,
    deactivatedProjects,
    actionItems,
    deactivatedActionItems,
    stakeholders,
    deactivatedStakeholders,
    activities,
    comments,
    employeeAppreciations,
    accountColumns, opportunityColumns, actionItemColumns, performanceEvaluationColumns,
    accountsColumnConfig, opportunitiesColumnConfig, actionItemsColumnConfig, performanceEvaluationColumnConfig,
    loading,
    unreadNotificationCount,
    refreshUnreadCount: () => {
      notificationsApi.getUnreadCount().then(({ count }) => setUnreadNotificationCount(count)).catch((err) => console.error('[useCRMData] Failed to fetch unread count:', err));
    },
    loadConfig,
    refreshData,
    addAccount, updateAccount, deleteAccount, restoreAccount,
    addOpportunity, updateOpportunity, deleteOpportunity, restoreOpportunity,
    addProject, updateProject, deleteProject, restoreProject, createProjectFromOpportunity, refreshProject,
    addActionItem, updateActionItem, deleteActionItem,
    addStakeholder, updateStakeholder, deleteStakeholder, associateServiceProvider,
    addComment, updateComment, deleteComment,
    addEmployeeAppreciation, updateEmployeeAppreciation, deleteEmployeeAppreciation,
    addCustomColumn, deleteCustomColumn,
    updateColumnConfig, resetColumnConfig,
  };
};
