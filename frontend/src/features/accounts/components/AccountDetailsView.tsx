/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCRM } from '@/contexts/CRMContext';
import { usersApi } from '@/api/crm.api';
import { motion, AnimatePresence } from 'framer-motion';
import { ActionItemQuickPanel } from '@/features/action-items/components/ActionItemQuickPanel';
import { Account, Opportunity, OpportunityStage, ActionItem, Stakeholder, StakeholderType, ActionItemStatus, PriorityLevel, User as UserRecord } from '@/types';
import { AccountFormModal } from '@/features/accounts/components/AccountFormModal';
import { InlineEditModal } from '@/components/InlineEditModal';
import { DocumentsPanel } from '@/components/documents/DocumentsPanel';
import { OpportunityActionsCommentsPanel } from '@/features/opportunities/components/OpportunityActionsCommentsPanel';
import { OpportunityFormModal } from '@/features/opportunities/components/OpportunityFormModal';
import { renderOpportunityCell } from '@/features/opportunities/components/OpportunityTableCells';
import { ActionItemFormModal } from '@/features/action-items/components/ActionItemFormModal';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import {
  ACCOUNT_TYPE_COLORS,
  ACTION_STATUS_COLORS,
  BackButton,
  Button,
  Card,
  ConfirmDialog,
  DetailHeaderCard,
  DetailTabBar,
  EmptyRow,
  EmptyState,
  HEALTH_COLORS,
  InfoBlock,
  isValidPhone,
  PhoneInput,
  PRIORITY_COLORS,
  SearchableSelect,
  STAGE_COLORS,
  StatusBadge,
  SummaryCard,
  Table,
  TableActions,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
  ExpandableTextCell,
  FormModal,
  INPUT_CLS,
  SELECT_CLS,
  InlineCreateField,
} from '@/components/ui';
import { StakeholderFormModal } from '@/features/stakeholders/components/StakeholderFormModal';
import { StakeholderTabs } from '@/features/stakeholders/components/StakeholderTabs';
import { LOCATION_OPTIONS, STAGE_DEFAULT_PROBABILITY, stageChangePatch } from '@/constants';
import {
  deriveOppStatus,
  getTodayISODate,
  isOpenActionItemStatus,
  mapLocationToOption,
  serviceProviderOptionLabel,
} from '@/utils';
import {
  ArrowLeft,
  Globe,
  Phone,
  Mail,
  MapPin,
  Users,
  Briefcase,
  Building2,
  Calendar,
  Factory,
  MoreVertical,
  User,
  CheckSquare,
  MessageSquare,
  FileText,
  Plus,
  DollarSign,
  Settings2,
  Pencil,
  Navigation,
  AlertTriangle,
  Layers,
} from 'lucide-react';

/** First letters of up to the first two words of the account name, for the avatar chip. */
const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

export const AccountDetailsView: React.FC = () => {
  const {
    accounts,
    opportunities,
    actionItems,
    stakeholders,
    comments,
    selectedAccountId,
    setView,
    setSelectedAccountId,
    setSelectedOpportunityId,
    updateAccount,
    deleteAccount,
    addOpportunity,
    updateOpportunity,
    deleteOpportunity,
    addActionItem,
    updateActionItem,
    deleteActionItem,
    addStakeholder,
    updateStakeholder,
    deleteStakeholder,
    addComment,
    deleteComment,
    accountsColumnConfig,
    opportunityColumns,
    opportunitiesColumnConfig,
    actionItemColumns,
    actionItemsColumnConfig,
    setOppDetailsSourceView,
    accountDetailsActiveTab,
    setAccountDetailsActiveTab,
    cameFromDashboard,
    navSource,
    currentUser,
    can,
    serviceProviders,
    associateServiceProvider,
    projects,
    setCreateProjectIntent,
  } = useCRM();

  // Find current account
  const account = accounts.find(a => a.id === selectedAccountId);

  // Tab State
  const activeTab = accountDetailsActiveTab as 'overview' | 'opportunities' | 'stakeholders' | 'action-items' | 'comments' | 'documents';
  const setActiveTab = setAccountDetailsActiveTab;

  // Selected opportunity in opportunities tab
  const [selectedExcelOppId, setSelectedExcelOppId] = useState<string | null>(null);

  // 'Open only' status filters — activated by the overview summary cards' View details,
  // cleared when a tab is opened directly from the tab bar
  const [showOpenOppsOnly, setShowOpenOppsOnly] = useState(false);
  const [showOpenActionsOnly, setShowOpenActionsOnly] = useState(false);

  // Edit Opportunity Modal State
  const [isEditOppModalOpen, setIsEditOppModalOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [promptConvertProject, setPromptConvertProject] = useState<string | null>(null);

  // Stage change modal state
  const [closeDialog, setCloseDialog] = useState<{ outcome: 'Won' | 'Lost'; opp: Opportunity } | null>(null);
  const [closeReasonDraft, setCloseReasonDraft] = useState('');
  const [isClosingOpp, setIsClosingOpp] = useState(false);

  const [stageReasonDialog, setStageReasonDialog] = useState<{ stage: 'Blocked' | 'Delayed'; opp: Opportunity } | null>(null);
  const [stageReasonDraft, setStageReasonDraft] = useState('');
  const [isSavingStageReason, setIsSavingStageReason] = useState(false);

  // Edit Action Item Modal State
  const [isEditAiModalOpen, setIsEditAiModalOpen] = useState(false);
  const [editingAi, setEditingAi] = useState<ActionItem | null>(null);

  // Add Opportunity Modal State
  const [isAddOppModalOpen, setIsAddOppModalOpen] = useState(false);
  const [isAddOppSubmitting, setIsAddOppSubmitting] = useState(false);
  const [newOpp, setNewOpp] = useState<Omit<Opportunity, 'id'>>({
    name: '',
    accountId: '',
    stage: undefined as any,
    value: 0,
    probability: STAGE_DEFAULT_PROBABILITY.Lead ?? 0,
    description: '',
    allocationStartDate: '',
    allocationEndDate: '',
    dealStartDate: undefined,
    dealCloseDate: undefined,
    crmValue: 0,
    nextStep: '',
    risksAndDependencies: '',
    tags: [],
    team: [],
    clientStakeholderId: '',
    serviceProviderStakeholderId: '',
    serviceProviderUserId: '',
    opportunityType: undefined as any,
    aopAvailable: false,
    aopYear: null,
    serviceLine: undefined,
    opportunityHealth: undefined,
    location: undefined,
    cost: 0,
    grossMargin: undefined,
  });

  // Add Action Item Modal State
  const [isAddAiModalOpen, setIsAddAiModalOpen] = useState(false);
  const [newAi, setNewAi] = useState<Omit<ActionItem, 'id'>>({
    title: '',
    accountId: '',
    opportunityId: '',
    ownerStakeholderId: '',
    openDate: getTodayISODate(),
    dueDate: '',
    priority: 'Medium',
    status: 'To Do',
    notes: '',
    risksAndDependencies: ''
  });

  const handleEditOppClick = (opp: Opportunity) => {
    setEditingOpp({ ...opp });
    setIsEditOppModalOpen(true);
  };

  const handleUpdateOpportunityForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpp || !editingOpp.name.trim()) return;
    const original = opportunities.find(o => o.id === editingOpp.id);
    const stageBecameWon = editingOpp.stage === 'Won' && (!original || original.stage !== 'Won') && !editingOpp.projectId;
    await updateOpportunity(editingOpp);
    setIsEditOppModalOpen(false);
    setEditingOpp(null);
    if (stageBecameWon) {
      setPromptConvertProject(editingOpp.id);
    }
  };

  const handleStageChange = async (opp: Opportunity, newStage: OpportunityStage) => {
    if (newStage === 'Won' || newStage === 'Lost') {
      setCloseReasonDraft(opp.closeReason || '');
      setCloseDialog({ outcome: newStage, opp });
    } else if (newStage === 'Blocked' || newStage === 'Delayed') {
      setStageReasonDraft((newStage === 'Blocked' ? opp.blockedReason : opp.delayedReason) || '');
      setStageReasonDialog({ stage: newStage, opp });
    } else {
      try {
        await updateOpportunity({
          ...opp,
          ...stageChangePatch(newStage),
        });
      } catch {
        // Central error handling
      }
    }
  };

  const handleCloseDialogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeDialog) return;
    const { outcome, opp } = closeDialog;
    setIsClosingOpp(true);
    try {
      const stageBecameWon = outcome === 'Won' && opp.stage !== 'Won' && !opp.projectId;
      await updateOpportunity({
        ...opp,
        ...stageChangePatch(outcome),
        closeReason: closeReasonDraft.trim(),
      });
      setCloseDialog(null);
      if (stageBecameWon) {
        setPromptConvertProject(opp.id);
      }
    } catch {
      // Central error handling
    } finally {
      setIsClosingOpp(false);
    }
  };

  const handleStageReasonDialogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageReasonDialog) return;
    const { stage, opp } = stageReasonDialog;
    setIsSavingStageReason(true);
    try {
      await updateOpportunity({
        ...opp,
        ...stageChangePatch(stage),
        ...(stage === 'Blocked'
          ? { blockedReason: stageReasonDraft.trim() }
          : { delayedReason: stageReasonDraft.trim() }),
      });
      setStageReasonDialog(null);
    } catch {
      // Central error handling
    } finally {
      setIsSavingStageReason(false);
    }
  };

  const handleEditAiClick = (item: ActionItem) => {
    setEditingAi({ ...item });
    setIsEditAiModalOpen(true);
  };

  const handleUpdateActionItemForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAi || !editingAi.title.trim()) return;
    updateActionItem(editingAi);
    setIsEditAiModalOpen(false);
    setEditingAi(null);
  };

  // Column sidebars state
  const [isOppSidebarOpen, setIsOppSidebarOpen] = useState(false);
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);

  // Action item expand comments state
  const [expandedActionItemId, setExpandedActionItemId] = useState<string | null>(null);

  // Input states for new items
  const [commentText, setCommentText] = useState('');

  // Stakeholder create/edit dialog state (shared StakeholderFormModal)
  const [showAddClientStk, setShowAddClientStk] = useState(false);
  const [showAddSpStk, setShowAddSpStk] = useState(false);

  // Client stakeholder modal selection/draft state
  const [selectedClientStkId, setSelectedClientStkId] = useState('');
  const [showInnerCreateModal, setShowInnerCreateModal] = useState(false);

  // Service Provider modal selection state
  const [selectedSpUserIdInDetail, setSelectedSpUserIdInDetail] = useState('');

  const [editingStk, setEditingStk] = useState<Stakeholder | null>(null);

  // Stakeholders are split into two independent sub-tabs (Client Stakeholders /
  // Service Providers), matching the Stakeholders directory. Each sub-table owns
  // its own search / sort / pagination internally (see StakeholderTable).
  const [stkSubTab, setStkSubTab] = useState<StakeholderType>('CLIENT');

  // Edit Account modal state
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [accountDraft, setAccountDraft] = useState<Account | null>(null);

  // Users list — backs the role-filtered owner dropdowns (incl. Account Manager)
  // on the shared account edit modal, matching the List View edit experience.
  const [users, setUsers] = useState<UserRecord[]>([]);
  useEffect(() => {
    usersApi.getAll().then(setUsers).catch(() => setUsers([]));
  }, []);

  // Header overflow actions menu
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // Inline editing state — Account Summary
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');

  // Inline editing state — Contact Information
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactDraft, setContactDraft] = useState({ website: '', phone: '', email: '', address: '', location: '' });

  // Document count surfaced by the shared DocumentsPanel (for the tab label).
  const [docCount, setDocCount] = useState(0);

  if (!account) {
    return (
      <Card padding="none">
        <div className="p-8 text-center">
          <p className="text-slate-400 font-medium">No account selected.</p>
          <button onClick={() => setView('accounts')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer">
            Back to Accounts
          </button>
        </div>
      </Card>
    );
  }

  // Filter lists for current account
  const accountOpps = opportunities.filter(o => o.accountId === account.id);
  const accountActions = actionItems.filter(ai => ai.accountId === account.id);
  const accountStks = stakeholders.filter(s => s.accountId === account.id);
  const accountComments = comments.filter(c => c.targetType === 'account' && c.targetId === account.id);

  // Open subsets backing the overview summary cards: opportunities still in 'Open'
  // lifecycle status, action items not yet Completed
  const openAccountOpps = accountOpps.filter(o => deriveOppStatus(o.stage) === 'Open');
  const openAccountActions = accountActions.filter(ai => isOpenActionItemStatus(ai.status));

  // Lists actually rendered in the tab tables (respect the card-driven filters)
  const visibleOpps = showOpenOppsOnly ? openAccountOpps : accountOpps;
  const visibleActions = showOpenActionsOnly ? openAccountActions : accountActions;


  // Excel Handlers for Opportunities
  const handleOpenAddOpportunity = () => {
    setNewOpp({
      name: '',
      accountId: account.id,
      stage: undefined as any,
      value: 0,
      probability: STAGE_DEFAULT_PROBABILITY.Lead ?? 0,
      description: '',
      allocationStartDate: '',
      allocationEndDate: '',
      dealStartDate: undefined,
      dealCloseDate: undefined,
      crmValue: 0,
      nextStep: '',
      risksAndDependencies: '',
      tags: [],
      team: [],
      clientStakeholderId: '',
      serviceProviderStakeholderId: '',
      serviceProviderUserId: '',
      opportunityType: undefined as any,
      aopAvailable: false,
      aopYear: null,
      serviceLine: undefined,
      opportunityHealth: undefined,
      location: undefined,
      cost: 0,
      grossMargin: undefined,
    });
    setIsAddOppModalOpen(true);
  };

  const handleCreateOpportunityForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpp.name.trim() || isAddOppSubmitting) return;
    setIsAddOppSubmitting(true);
    try {
      await addOpportunity(newOpp);
    } finally {
      setIsAddOppSubmitting(false);
      setIsAddOppModalOpen(false);
    }
  };

  // Unified delete confirmation state (documents confirm inside DocumentsPanel)
  type DeleteType = 'opportunity' | 'actionItem' | 'stakeholder' | 'comment' | 'account';
  const [deleteTarget, setDeleteTarget] = useState<{ type: DeleteType; id: string; label: string } | null>(null);
  // Selected Action Item for Quick Panel
  const [selectedActionItemId, setSelectedActionItemId] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    if (type === 'opportunity') {
      deleteOpportunity(id);
      if (selectedExcelOppId === id) setSelectedExcelOppId(null);
    } else if (type === 'actionItem') {
      await deleteActionItem(id);
    } else if (type === 'stakeholder') {
      await deleteStakeholder(id);
    } else if (type === 'account') {
      await deleteAccount(id);
      setView('accounts');
    } else {
      await deleteComment(id);
    }
    setDeleteTarget(null);
  };

  const handleDeleteOpportunity = (oppId: string, oppName: string) => {
    setDeleteTarget({ type: 'opportunity', id: oppId, label: oppName });
  };

  // Excel Handlers for Action Items
  const handleOpenAddActionItem = () => {
    setNewAi({
      title: '',
      accountId: account.id,
      opportunityId: '',
      ownerStakeholderId: '',
      openDate: getTodayISODate(),
      dueDate: '',
      priority: 'Medium',
      status: 'To Do',
      notes: '',
      risksAndDependencies: ''
    });
    setIsAddAiModalOpen(true);
  };

  const handleCreateActionItemForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAi.title.trim() || !newAi.ownerStakeholderId) return;
    addActionItem(newAi);
    setIsAddAiModalOpen(false);
  };

  // Add Comment handler
  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment('account', account.id, commentText);
    setCommentText('');
  };

  // Stakeholders for this account, split by type for the two sub-tabs.
  const clientStks = accountStks.filter(s => s.stakeholderType === 'CLIENT');
  const serviceProviderStks = accountStks.filter(s => s.stakeholderType === 'SERVICE_PROVIDER');

  return (
    <div className="space-y-6">
      {/* Back to Dashboard (when arriving from a dashboard drill-down) */}
      {cameFromDashboard && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setView('dashboard')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold transition-all cursor-pointer bg-slate-100 hover:bg-slate-200/70 px-3 py-1.5 rounded-lg border border-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      )}

      {/* Back to Notifications / Audit Log */}
      {navSource && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setView(navSource === 'notifications' ? 'notifications' : 'audit-log')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold transition-all cursor-pointer bg-slate-100 hover:bg-slate-200/70 px-3 py-1.5 rounded-lg border border-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{navSource === 'notifications' ? 'Back to Notifications' : 'Back to Audit Log'}</span>
          </button>
        </div>
      )}

      {/* Page Header — shared with Opportunity Detail via DetailHeaderCard */}
      <DetailHeaderCard
        onBack={!navSource ? () => setView('accounts') : undefined}
        backTitle="Back to Accounts"
        avatarContent={getInitials(account.name)}
        avatarColorClass={ACCOUNT_TYPE_COLORS[account.type] ?? 'bg-slate-100 text-slate-700'}
        title={account.name}
        badges={
          <>
            <StatusBadge value={account.type} colorMap={ACCOUNT_TYPE_COLORS} shape="rounded" />
            <StatusBadge value={account.health} colorMap={HEALTH_COLORS} />
          </>
        }
        description={account.description}
        actions={
          <>
            <Button
              variant="warning"
              icon={<Pencil className="w-3.5 h-3.5" />}
              onClick={() => {
                setAccountDraft({
                  ...account,
                  location: mapLocationToOption(account.location),
                });
                setIsEditingAccount(true);
              }}
            >
              Edit Account
            </Button>
            <div className="relative">
              <button
                onClick={() => setShowAccountMenu(v => !v)}
                className="p-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors"
                title="More actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showAccountMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowAccountMenu(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                    <button
                      onClick={() => {
                        setShowAccountMenu(false);
                        setDeleteTarget({ type: 'account', id: account.id, label: account.name });
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                    >
                      Deactivate Account
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        }
        attributes={[
          { icon: <Building2 className="w-4 h-4" />, label: 'Account Type', value: account.type },
          { icon: <User className="w-4 h-4" />, label: 'Owner', value: account.owner, accent: true },
          { icon: <Factory className="w-4 h-4" />, label: 'Industry', value: account.industry },
          {
            icon: <DollarSign className="w-4 h-4" />,
            label: 'Annual Revenue',
            mono: true,
            value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(account.revenue),
          },
          { icon: <Calendar className="w-4 h-4" />, label: 'Customer Since', value: account.since },
          { icon: <Layers className="w-4 h-4" />, label: 'Tower', value: account.tower },
        ]}
      />

      {/* Navigation Tabs */}
      <DetailTabBar
        tabs={[
          { id: 'overview', label: 'Overview', icon: Briefcase, count: null },
          { id: 'stakeholders', label: 'Stakeholders', icon: Users, count: accountStks.length },
          { id: 'opportunities', label: 'Opportunities', icon: DollarSign, count: visibleOpps.length },
          { id: 'action-items', label: 'Action Items', icon: CheckSquare, count: visibleActions.length },
          { id: 'comments', label: 'Comments', icon: MessageSquare, count: accountComments.length },
          { id: 'documents', label: 'Documents', icon: FileText, count: docCount > 0 ? docCount : null },
        ]}
        activeTab={activeTab}
        onChange={(id) => {
          setShowOpenOppsOnly(false);
          setShowOpenActionsOnly(false);
          setActiveTab(id as any);
        }}
      />

      {/* Dynamic Tab Contents */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SummaryCard
                label="Open Opportunities"
                value={openAccountOpps.length}
                icon={<DollarSign className="w-4.5 h-4.5" />}
                tone="blue"
                actionLabel="View Details"
                onAction={() => {
                  setShowOpenOppsOnly(true);
                  setSelectedExcelOppId(null);
                  setActiveTab('opportunities');
                }}
              />
              <SummaryCard
                label="Open Action Items"
                value={openAccountActions.length}
                icon={<CheckSquare className="w-4.5 h-4.5" />}
                tone="emerald"
                actionLabel="View Details"
                onAction={() => {
                  setShowOpenActionsOnly(true);
                  setActiveTab('action-items');
                }}
              />
              <SummaryCard
                label="Registered Stakeholders"
                value={accountStks.length}
                icon={<Users className="w-4.5 h-4.5" />}
                tone="purple"
                actionLabel="View Details"
                onAction={() => setActiveTab('stakeholders')}
              />
            </div>

            {/* Account Summary (left) / Primary Contact (right) — balanced two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
              <div className="lg:col-span-3 space-y-6">
              <Card
                padding="none"
                title="Account Summary"
                actions={isEditingSummary ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        updateAccount({ ...account, description: summaryDraft });
                        setIsEditingSummary(false);
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingSummary(false)}
                      className="px-3 py-1 border border-slate-200 text-slate-500 hover:bg-slate-50 text-[11px] font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSummaryDraft(account.description || ''); setIsEditingSummary(true); }}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-600 font-bold transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                )}
              >
                <div className="p-5">
                  {isEditingSummary ? (
                    <textarea
                      rows={7}
                      value={summaryDraft}
                      onChange={(e) => setSummaryDraft(e.target.value)}
                      placeholder="Enter company summary, background, or profile..."
                      className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none text-slate-700 leading-relaxed"
                      autoFocus
                    />
                  ) : account.description ? (
                    <p className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">
                      {account.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-300 italic min-h-[100px]">No summary added yet. Click Edit to add one.</p>
                  )}
                </div>
              </Card>

              <Card
                padding="none"
                title="Account Leadership"
              >
                <div className="p-5 divide-y divide-slate-100">
                  {[
                    { label: 'Client Partner', name: account.clientPartnerName },
                    { label: 'Vertical Head', name: account.verticalHeadName },
                    { label: 'Account Manager', name: account.accountManagerName },
                    { label: 'Practice Lead', name: account.practiceLeadName },
                  ].map((row) => (
                    <div key={row.label} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-400 uppercase tracking-wider">{row.label}</span>
                      <span className="font-semibold text-slate-800">{row.name || <span className="text-slate-400 font-normal italic">Not assigned</span>}</span>
                    </div>
                  ))}
                </div>
              </Card>

              </div>

              <div className="lg:col-span-2">
              <Card
                padding="none"
                title="Primary Contact"
                actions={isEditingContact ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        updateAccount({ ...account, ...contactDraft });
                        setIsEditingContact(false);
                      }}
                      disabled={!isValidPhone(contactDraft.phone)}
                      title={!isValidPhone(contactDraft.phone) ? 'Fix the phone number before saving' : undefined}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingContact(false)}
                      className="px-3 py-1 border border-slate-200 text-slate-500 hover:bg-slate-50 text-[11px] font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setContactDraft({ website: account.website || '', phone: account.phone || '', email: account.email || '', address: account.address || '', location: mapLocationToOption(account.location) });
                      setIsEditingContact(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-600 font-bold transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                )}
              >
                <div className="p-5">
                  {isEditingContact ? (
                    <div className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Globe className="w-3 h-3" /> Website
                        </label>
                        <input
                          type="text"
                          value={contactDraft.website}
                          onChange={(e) => setContactDraft({ ...contactDraft, website: e.target.value })}
                          placeholder="www.example.com"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Phone className="w-3 h-3" /> Phone
                        </label>
                        <PhoneInput
                          value={contactDraft.phone}
                          onChange={(phone) => setContactDraft({ ...contactDraft, phone })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Mail className="w-3 h-3" /> Email
                        </label>
                        <input
                          type="email"
                          value={contactDraft.email}
                          onChange={(e) => setContactDraft({ ...contactDraft, email: e.target.value })}
                          placeholder="contact@example.com"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" /> Address
                        </label>
                        <input
                          type="text"
                          value={contactDraft.address}
                          onChange={(e) => setContactDraft({ ...contactDraft, address: e.target.value })}
                          placeholder="123 Business Ave, City, State"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Navigation className="w-3 h-3" /> Location
                        </label>
                        <SearchableSelect
                          value={contactDraft.location}
                          onChange={(location) => setContactDraft({ ...contactDraft, location })}
                          options={LOCATION_OPTIONS}
                          placeholder="Search countries…"
                          aria-label="Account location"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {[
                        { icon: <Globe className="w-4 h-4" />, label: 'Website', value: account.website, href: account.website ? `https://${account.website}` : undefined },
                        { icon: <Phone className="w-4 h-4" />, label: 'Phone', value: account.phone, mono: true },
                        { icon: <Mail className="w-4 h-4" />, label: 'Email', value: account.email },
                        { icon: <MapPin className="w-4 h-4" />, label: 'Address', value: account.address },
                        { icon: <Navigation className="w-4 h-4" />, label: 'Location', value: account.location },
                      ].map((item) => (
                        <InfoBlock key={item.label} icon={item.icon} label={item.label} value={item.value} href={item.href} mono={item.mono} />
                      ))}
                    </div>
                  )}
                </div>
              </Card>
              </div>
            </div>
          </div>
        )}

        {/* Opportunities Tab (Standard Design) */}
        {activeTab === 'opportunities' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-slate-800 text-sm">Account Opportunities</h4>
                  {showOpenOppsOnly && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-bold whitespace-nowrap">
                      Open only ({visibleOpps.length})
                      <button onClick={() => setShowOpenOppsOnly(false)} className="underline hover:text-blue-800 cursor-pointer">
                        Show all
                      </button>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Click on any row to focus and display corresponding action table and comments below.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  icon={<Settings2 className="w-3.5 h-3.5 text-slate-500" />}
                  onClick={() => setIsOppSidebarOpen(true)}
                >
                  Customize Columns
                </Button>
                <Button
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={handleOpenAddOpportunity}
                >
                  Add Opportunity
                </Button>
              </div>
            </div>

            <Card padding="none" clip>
              <div className="overflow-x-auto">
                <Table
                  extraColumns={opportunitiesColumnConfig.filter(c => c.isDisplayed && !c.isStandard).length}
                  resizable
                  storageKey="account-details:opportunities"
                >
                  <TableHead>
                    {opportunitiesColumnConfig.filter(c => c.isDisplayed).map(col => (
                      <TableHeadCell
                        key={col.key}
                        columnId={col.key}
                        className={col.key === 'name' ? 'px-5' : ''}
                      >
                        {col.name}
                      </TableHeadCell>
                    ))}
                    <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
                  </TableHead>
                  <tbody>
                    {visibleOpps.length === 0 ? (
                      <EmptyRow
                        colSpan={opportunitiesColumnConfig.filter(c => c.isDisplayed).length + 1}
                        message={showOpenOppsOnly
                          ? 'No open opportunities for this account.'
                          : "No opportunities linked to this account. Click 'Add Opportunity' to create one."}
                      />
                    ) : (
                      visibleOpps.map(opp => (
                        <TableRow
                          key={opp.id}
                          clickable
                          onClick={() => setSelectedExcelOppId(selectedExcelOppId === opp.id ? null : opp.id)}
                          className={selectedExcelOppId === opp.id ? 'bg-blue-50/40 border-l-4 border-l-blue-600 font-semibold' : ''}
                        >
                          {opportunitiesColumnConfig.filter(c => c.isDisplayed).map(col => (
                            <TableCell key={col.key}>
                              {renderOpportunityCell(col, opp, account.name, can('opportunities', 'update') ? handleStageChange : undefined)}
                            </TableCell>
                          ))}
                          <TableCell
                            align="center"
                            sticky="right"
                            className={selectedExcelOppId === opp.id ? 'bg-blue-50' : ''}
                            onClick={e => e.stopPropagation()}
                          >
                            <TableActions
                              entityLabel={`opportunity ${opp.name}`}
                              onView={() => {
                                setSelectedOpportunityId(opp.id);
                                setOppDetailsSourceView('account-details');
                                setView('opportunity-details');
                              }}
                              onEdit={() => handleEditOppClick(opp)}
                              onDelete={() => handleDeleteOpportunity(opp.id, opp.name)}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </Card>

            <AnimatePresence>
              {selectedExcelOppId && (
                <>
                  {/* Backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedExcelOppId(null)}
                    className="fixed inset-0 bg-slate-900/35 backdrop-blur-xs z-50 cursor-pointer"
                  />

                  {/* Sidebar Panel */}
                  <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 180 }}
                    className="fixed right-0 top-0 h-screen w-full sm:w-[650px] md:w-[750px] lg:w-[900px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 overflow-hidden"
                  >
                    <OpportunityActionsCommentsPanel
                      opportunityId={selectedExcelOppId}
                      onClose={() => setSelectedExcelOppId(null)}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <CustomizeColumnsSidebar 
              module="opportunities" 
              isOpen={isOppSidebarOpen} 
              onClose={() => setIsOppSidebarOpen(false)} 
            />
          </div>
        )}

        {/* Action Items Tab (Standard Design) */}
        {activeTab === 'action-items' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-slate-800 text-sm">Account Deliverables</h4>
                  {showOpenActionsOnly && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-bold whitespace-nowrap">
                      Open only ({visibleActions.length})
                      <button onClick={() => setShowOpenActionsOnly(false)} className="underline hover:text-blue-800 cursor-pointer">
                        Show all
                      </button>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Track operational milestones, assign owners, and manage comments per deliverable.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  icon={<Settings2 className="w-3.5 h-3.5 text-slate-500" />}
                  onClick={() => setIsAiSidebarOpen(true)}
                >
                  Customize Columns
                </Button>
                <Button
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={handleOpenAddActionItem}
                >
                  New Action Item
                </Button>
              </div>
            </div>

            <Card padding="none" clip>
              <div className="overflow-x-auto">
                <Table
                  extraColumns={actionItemsColumnConfig.filter(c => c.isDisplayed && !c.isStandard).length}
                  resizable
                  storageKey="account-details:action-items"
                >
                  <TableHead>
                    {actionItemsColumnConfig.filter(c => c.isDisplayed).map(col => (
                      <TableHeadCell
                        key={col.key}
                        columnId={col.key}
                        className={col.key === 'title' ? 'px-5' : ''}
                      >
                        {col.name}
                      </TableHeadCell>
                    ))}
                    <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
                  </TableHead>
                  <tbody>
                    {visibleActions.length === 0 ? (
                      <EmptyRow
                        colSpan={actionItemsColumnConfig.filter(c => c.isDisplayed).length + 1}
                        message={showOpenActionsOnly
                          ? 'No open action items for this account.'
                          : "No action items configured. Click 'New Task' to get started."}
                      />
                    ) : (
                      visibleActions.map(item => {
                        const itemComments = comments.filter(c => c.targetType === 'actionItem' && c.targetId === item.id);
                        return (
                          <React.Fragment key={item.id}>
                            <TableRow className="hover:bg-slate-50/50">
                              {actionItemsColumnConfig.filter(c => c.isDisplayed).map(col => {
                                if (col.key === 'title') {
                                  return (
                                    <TableCell key={col.key}>
                                      <div className="flex items-center flex-wrap gap-2">
                                        <div className="flex-1 min-w-0">
                                          <button
                                            type="button"
                                            onClick={() => setSelectedActionItemId(item.id)}
                                            className="font-bold text-slate-900 text-xs hover:text-blue-600 cursor-pointer text-left transition-colors truncate block max-w-full"
                                          >
                                            {item.title}
                                          </button>
                                        </div>
                                        {!!item.risksAndDependencies?.trim() && (
                                          <span
                                            className="shrink-0 inline-flex"
                                            title={`Risks & Dependencies: ${item.risksAndDependencies}`}
                                            aria-label={`Action item has risks or dependencies: ${item.risksAndDependencies}`}
                                            role="img"
                                          >
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                  );
                                }
                                if (col.key === 'notes') {
                                  return (
                                    <TableCell key={col.key} className="text-slate-600 font-medium text-xs">
                                      <span className="block max-w-[280px] line-clamp-2" title={item.notes || undefined}>
                                        {item.notes || <span className="text-slate-400 italic">No description</span>}
                                      </span>
                                    </TableCell>
                                  );
                                }
                                if (col.key === 'risksAndDependencies') {
                                  return (
                                    <TableCell key={col.key}>
                                      <ExpandableTextCell
                                        text={item.risksAndDependencies}
                                        label="Risks & Dependencies"
                                        emptyLabel="No Risks"
                                      />
                                    </TableCell>
                                  );
                                }
                                if (col.key === 'accountId') {
                                  return (
                                    <TableCell key={col.key} className="text-slate-600 font-semibold text-xs">
                                      {accounts.find(acc => acc.id === item.accountId)?.name || account.name}
                                    </TableCell>
                                  );
                                }
                                if (col.key === 'opportunityId') {
                                  const opp = opportunities.find(o => o.id === item.opportunityId);
                                  return (
                                    <TableCell key={col.key} className="text-slate-600 font-semibold text-xs">
                                      {opp ? opp.name : '—'}
                                    </TableCell>
                                  );
                                }
                                if (col.key === 'owner') {
                                  return (
                                    <TableCell key={col.key} className="text-slate-600 font-medium text-xs">
                                      {item.ownerName || item.owner || '—'}
                                    </TableCell>
                                  );
                                }
                                if (col.key === 'priority') {
                                  return (
                                    <TableCell key={col.key}>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                                        item.priority === 'High' ? 'bg-red-100 text-red-700' :
                                        item.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}>
                                        {item.priority}
                                      </span>
                                    </TableCell>
                                  );
                                }
                                if (col.key === 'status') {
                                  return (
                                    <TableCell key={col.key}>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                                        item.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                        item.status === 'Blocked' ? 'bg-red-100 text-red-700' :
                                        item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                        item.status === 'Cancelled' ? 'bg-zinc-200 text-zinc-500' :
                                        'bg-slate-100 text-slate-700'
                                      }`}>
                                        {item.status}
                                      </span>
                                    </TableCell>
                                  );
                                }
                                if (col.key === 'dueDate') {
                                  return (
                                    <TableCell key={col.key} className="text-slate-500 font-mono text-xs font-medium">
                                      {item.dueDate}
                                    </TableCell>
                                  );
                                }

                                // Customizable dynamic custom columns
                                const rawVal = item[col.key] ?? (col.type === 'boolean' ? false : '');
                                return (
                                  <TableCell key={col.key}>
                                    {col.type === 'boolean' ? (
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rawVal ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {rawVal ? 'Yes' : 'No'}
                                      </span>
                                    ) : col.type === 'number' ? (
                                      <span className="font-mono font-semibold text-slate-700">{rawVal}</span>
                                    ) : col.type === 'date' ? (
                                      <span className="font-mono text-slate-500">{rawVal}</span>
                                    ) : (
                                      <span className="text-slate-600">{String(rawVal)}</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                              <TableCell align="center" sticky="right">
                                <TableActions
                                  entityLabel={`action item ${item.title}`}
                                  onEdit={() => handleEditAiClick(item)}
                                  onDelete={() => setDeleteTarget({ type: 'actionItem', id: item.id, label: item.title })}
                                />
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </Table>
              </div>
            </Card>

            <CustomizeColumnsSidebar
              module="actionItems"
              isOpen={isAiSidebarOpen} 
              onClose={() => setIsAiSidebarOpen(false)} 
            />
          </div>
        )}

        {/* Stakeholders Workspace */}
        {activeTab === 'stakeholders' && (
          <div className="space-y-6">
            <StakeholderTabs
              title="Stakeholders"
              clientRows={clientStks}
              serviceProviderRows={serviceProviderStks}
              resolveAccount={() => account}
              hideAccountColumn
              storageKeyPrefix={`acct-${account.id}-stk`}
              canCreate={can('stakeholders', 'create')}
              canEdit={can('stakeholders', 'update')}
              canDelete={can('stakeholders', 'delete')}
              onAdd={(type) => {
                if (type === 'CLIENT') {
                  setSelectedClientStkId('');
                  setShowAddClientStk(true);
                } else {
                  setSelectedSpUserIdInDetail('');
                  setShowAddSpStk(true);
                }
              }}
              onEdit={setEditingStk}
              onDelete={(s) => setDeleteTarget({ type: 'stakeholder', id: s.id, label: s.name })}
              clientEmptyMessage="No Client Stakeholders found."
              serviceProviderEmptyMessage="No Service Providers found. Add one manually above."
            />

            {/* Custom Client Stakeholder Modal */}
            <FormModal
              isOpen={showAddClientStk}
              title="Add Client Stakeholder"
              icon={<Building2 className="w-5 h-5 text-blue-600" aria-hidden="true" />}
              onClose={() => setShowAddClientStk(false)}
              onSubmit={async (e: React.FormEvent) => {
                e.preventDefault();
                if (selectedClientStkId) {
                  const existing = stakeholders.find(s => s.id === selectedClientStkId);
                  if (existing) {
                    await updateStakeholder({
                      ...existing,
                      accountId: account.id,
                    });
                  }
                }
                setShowAddClientStk(false);
              }}
              submitLabel="Add Client Stakeholder"
            >
              <div className="space-y-4">
                <InlineCreateField
                  label="Select Client Stakeholder"
                  createLabel="client stakeholder"
                  onCreate={() => setShowInnerCreateModal(true)}
                >
                  <select
                    value={selectedClientStkId}
                    onChange={(e) => setSelectedClientStkId(e.target.value)}
                    className={SELECT_CLS}
                    required
                  >
                    <option value="" disabled>— Select existing Client Stakeholder —</option>
                    {stakeholders
                      .filter((s) => s.stakeholderType === 'CLIENT' && s.accountId !== account.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.designation})</option>
                      ))}
                  </select>
                </InlineCreateField>
              </div>
            </FormModal>

            {showInnerCreateModal &&
              createPortal(
                <StakeholderFormModal
                  isOpen={true}
                  mode="create"
                  accounts={accounts}
                  lockedAccount={{ id: account.id, name: account.name }}
                  lockedType="CLIENT"
                  onClose={() => setShowInnerCreateModal(false)}
                  onSubmit={async (draft) => {
                    await addStakeholder(draft);
                    setShowInnerCreateModal(false);
                    setShowAddClientStk(false);
                  }}
                />,
                document.body,
              )}

            {/* Custom Service Provider Modal */}
            <FormModal
              isOpen={showAddSpStk}
              title="Add Service Provider"
              icon={<Settings2 className="w-5 h-5 text-indigo-600" aria-hidden="true" />}
              onClose={() => setShowAddSpStk(false)}
              onSubmit={async (e: React.FormEvent) => {
                e.preventDefault();
                if (selectedSpUserIdInDetail) {
                  await associateServiceProvider(selectedSpUserIdInDetail, account.id);
                }
                setShowAddSpStk(false);
              }}
              submitLabel="Add Service Provider"
            >
              <div className="space-y-4">
                <label className="block text-xs font-semibold text-slate-600">Select Service Provider (System User)</label>
                <select
                  value={selectedSpUserIdInDetail}
                  onChange={(e) => setSelectedSpUserIdInDetail(e.target.value)}
                  className={SELECT_CLS}
                  required
                >
                  <option value="" disabled>— Select System User —</option>
                  {serviceProviders.map((sp) => (
                    <option key={sp.id} value={sp.id}>{serviceProviderOptionLabel(sp)}</option>
                  ))}
                </select>
              </div>
            </FormModal>

            {/* Edit stakeholder modal */}
            <StakeholderFormModal
              isOpen={!!editingStk}
              mode="edit"
              stakeholder={editingStk}
              accounts={accounts}
              lockedAccount={{ id: account.id, name: account.name }}
              onClose={() => setEditingStk(null)}
              onSubmit={async (draft) => {
                if (editingStk) await updateStakeholder({ ...editingStk, ...draft });
              }}
            />
          </div>
        )}

        {/* Comments Feed */}
        {activeTab === 'comments' && (
          <Card title="Corporate Governance Discussion & Updates" bodyClassName="space-y-5">
            {/* Comment Form */}
            <form onSubmit={handlePostComment} className="flex space-x-3 items-end">
              <div className="flex-1 space-y-1">
                <textarea
                  rows={2}
                  required
                  placeholder="Type an executive comment, update, or governance alert..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <Button type="submit" className="shrink-0">
                Post Comment
              </Button>
            </form>

            {/* Comment Feed Items */}
            <div className="space-y-4">
              {accountComments.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">No comments posted yet. Start the dialogue above.</p>
              ) : (
                accountComments.map(c => (
                  <div key={c.id} className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 space-y-2 relative group">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-700">{c.user}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-[10px] text-slate-400 font-mono">{c.timestamp}</span>
                      </div>
                      <button
                        onClick={() => setDeleteTarget({ type: 'comment', id: c.id, label: c.text.substring(0, 40) })}
                        className="text-slate-300 hover:text-red-500 hidden group-hover:block cursor-pointer transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{c.text}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* Documents Panel (shared with Opportunity details) */}
        {activeTab === 'documents' && (
          <DocumentsPanel
            target={{ accountId: account.id }}
            entityLabel="account"
            currentUser={currentUser}
            onCountChange={setDocCount}
          />
        )}

        {/* Edit Opportunity Modal */}
        {isEditOppModalOpen && editingOpp && (
          <InlineEditModal
            mode="opportunities"
            entity={editingOpp}
            displayedConfigs={opportunitiesColumnConfig.filter(c => c.isDisplayed)}
            accounts={accounts}
            opportunities={opportunities}
            stakeholders={stakeholders}
            onChange={(patch) => setEditingOpp({ ...editingOpp, ...patch })}
            onSave={handleUpdateOpportunityForm}
            onCancel={() => { setIsEditOppModalOpen(false); setEditingOpp(null); }}
          />
        )}

        {/* Edit Action Item Modal */}
        {isEditAiModalOpen && editingAi && (
          <InlineEditModal
            mode="actionItems"
            entity={editingAi}
            displayedConfigs={actionItemsColumnConfig.filter(c => c.isDisplayed)}
            accounts={accounts}
            opportunities={opportunities}
            projects={projects}
            stakeholders={stakeholders}
            onChange={(patch) => setEditingAi({ ...editingAi, ...patch })}
            onSave={handleUpdateActionItemForm}
            onCancel={() => { setIsEditAiModalOpen(false); setEditingAi(null); }}
          />
        )}

        {/* Add Opportunity Modal */}
        <OpportunityFormModal
          isOpen={isAddOppModalOpen}
          onClose={() => setIsAddOppModalOpen(false)}
          onSubmit={handleCreateOpportunityForm}
          submitLabel="Add Opportunity"
          isSubmitting={isAddOppSubmitting}
          value={newOpp}
          onChange={(patch) => setNewOpp({ ...newOpp, ...patch })}
          accounts={accounts}
          stakeholders={stakeholders}
          opportunityColumns={opportunityColumns}
          opportunitiesColumnConfig={opportunitiesColumnConfig}
          lockedAccount={{ id: account.id, name: account.name }}
        />

        <ConfirmDialog
          isOpen={!!promptConvertProject}
          title="Convert to Project"
          message="Opportunity stage has been set to Won. Would you like to convert this opportunity to a project now?"
          confirmLabel="Yes, Convert"
          cancelLabel="No, Later"
          onConfirm={() => {
            if (promptConvertProject) {
              setSelectedOpportunityId(promptConvertProject);
              setCreateProjectIntent(true);
              setView('opportunity-details');
              setPromptConvertProject(null);
            }
          }}
          onCancel={() => setPromptConvertProject(null)}
        />

        {/* Won/Lost Close-out Dialog */}
        <FormModal
          isOpen={!!closeDialog}
          title={closeDialog?.outcome === 'Won' ? 'Mark Opportunity as Won' : 'Mark Opportunity as Lost'}
          onClose={() => setCloseDialog(null)}
          onSubmit={handleCloseDialogSubmit}
          submitLabel={isClosingOpp ? 'Saving…' : `Mark ${closeDialog?.outcome ?? ''}`}
          submitVariant={closeDialog?.outcome === 'Won' ? 'success' : 'danger'}
          isSubmitting={isClosingOpp}
          maxWidth="max-w-md"
        >
          <div className="space-y-2">
            <label className="text-label font-semibold text-slate-600 uppercase tracking-wide block">
              {closeDialog?.outcome === 'Won' ? 'Win Reason' : 'Loss Reason'}
            </label>
            <textarea
              autoFocus
              rows={3}
              value={closeReasonDraft}
              onChange={(e) => setCloseReasonDraft(e.target.value)}
              placeholder={closeDialog?.outcome === 'Won'
                ? 'e.g., Strong technical fit and competitive pricing'
                : 'e.g., Lost to competitor on price'}
              className={`${INPUT_CLS} resize-none`}
            />
            <p className="text-[10px] text-slate-400 font-medium">
              Recorded on the opportunity for win/loss analysis.
            </p>
          </div>
        </FormModal>

        {/* Blocked/Delayed reason dialog */}
        <FormModal
          isOpen={!!stageReasonDialog}
          title={stageReasonDialog?.stage === 'Blocked' ? 'Mark Opportunity as Blocked' : 'Mark Opportunity as Delayed'}
          onClose={() => setStageReasonDialog(null)}
          onSubmit={handleStageReasonDialogSubmit}
          submitLabel={isSavingStageReason ? 'Saving…' : `Mark ${stageReasonDialog?.stage ?? ''}`}
          submitVariant="warning"
          isSubmitting={isSavingStageReason}
          maxWidth="max-w-md"
        >
          <div className="space-y-2">
            <label className="text-label font-semibold text-slate-600 uppercase tracking-wide block">
              {stageReasonDialog?.stage === 'Blocked' ? 'Blocked Reason' : 'Delayed Reason'}
            </label>
            <textarea
              autoFocus
              rows={3}
              value={stageReasonDraft}
              onChange={(e) => setStageReasonDraft(e.target.value)}
              placeholder={stageReasonDialog?.stage === 'Blocked'
                ? 'Describe why this opportunity is currently blocked...'
                : 'Describe why this opportunity has been delayed...'}
              className={`${INPUT_CLS} resize-none`}
            />
            <p className="text-[10px] text-slate-400 font-medium">
              Optional — separate from Risks &amp; Dependencies.
            </p>
          </div>
        </FormModal>

        {/* Add Action Item Modal */}
        <ActionItemFormModal
          isOpen={isAddAiModalOpen}
          onClose={() => setIsAddAiModalOpen(false)}
          onSubmit={handleCreateActionItemForm}
          submitLabel="Create Task"
          value={newAi}
          onChange={(patch) => setNewAi({ ...newAi, ...patch })}
          accounts={accounts}
          opportunities={opportunities}
          stakeholders={stakeholders}
          actionItemColumns={actionItemColumns}
          actionItemsColumnConfig={actionItemsColumnConfig}
          lockedAccount={{ id: account.id, name: account.name }}
          mode="normal"
        />
      </div>

      {/* Edit Account Modal */}
      <AccountFormModal
        isOpen={isEditingAccount && !!accountDraft}
        mode="edit"
        account={accountDraft}
        onClose={() => {
          setIsEditingAccount(false);
          setAccountDraft(null);
        }}
        onSubmit={async (draft) => {
          if (accountDraft) {
            await updateAccount({ ...accountDraft, ...draft } as Account);
            setIsEditingAccount(false);
            setAccountDraft(null);
          }
        }}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={
          deleteTarget?.type === 'opportunity' ? 'Delete Opportunity' :
          deleteTarget?.type === 'actionItem' ? 'Delete Action Item' :
          deleteTarget?.type === 'stakeholder' ? 'Delete Stakeholder' :
          deleteTarget?.type === 'account' ? 'Deactivate Account' :
          'Delete Comment'
        }
        message={
          deleteTarget?.type === 'account'
            ? <>Deactivate account <span className="font-bold">"{deleteTarget.label}"</span>? It will move to the Deactivated Accounts section.</>
            : undefined
        }
        confirmLabel={deleteTarget?.type === 'account' ? 'Deactivate' : 'Delete'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
