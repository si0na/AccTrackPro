/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Account, AccountType, AccountHealth, Opportunity, ActionItem, Stakeholder, ActionItemStatus, PriorityLevel } from '@/types';
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
  FilterBar,
  FilterSelect,
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  HEALTH_COLORS,
  InfoBlock,
  INFLUENCE_COLORS,
  INPUT_CLS_AMBER,
  isValidPhone,
  Pagination,
  PhoneInput,
  PRIORITY_COLORS,
  RELATIONSHIP_COLORS,
  SearchableSelect,
  SearchBar,
  SortableHeader,
  STAGE_COLORS,
  STAKEHOLDER_TYPE_COLORS,
  STAKEHOLDER_TYPE_LABELS,
  StatusBadge,
  SummaryCard,
  Table,
  TableActions,
  TableHead,
  TableHeadCell,
  TableCell,
  TableRow,
  ExpandableTextCell,
} from '@/components/ui';
import { StakeholderFormModal } from '@/features/stakeholders/components/StakeholderFormModal';
import { ACCOUNT_TYPE_OPTIONS, ACCOUNT_HEALTH_OPTIONS, LOCATION_OPTIONS, STAGE_DEFAULT_PROBABILITY } from '@/constants';
import {
  compareForSort,
  deriveOppStatus,
  getCustomerSinceYearOptions,
  getTodayISODate,
  isOpenActionItemStatus,
  mapLocationToOption,
  SortDirection,
} from '@/utils';
import { motion, AnimatePresence } from 'motion/react';
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
    accountColumns,
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

  // Edit Action Item Modal State
  const [isEditAiModalOpen, setIsEditAiModalOpen] = useState(false);
  const [editingAi, setEditingAi] = useState<ActionItem | null>(null);

  // Add Opportunity Modal State
  const [isAddOppModalOpen, setIsAddOppModalOpen] = useState(false);
  const [isAddOppSubmitting, setIsAddOppSubmitting] = useState(false);
  const [newOpp, setNewOpp] = useState<Omit<Opportunity, 'id'>>({
    name: '',
    accountId: '',
    stage: 'Lead',
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
    opportunityType: 'Growth',
    aopAvailable: false,
    aopYear: null,
    serviceLine: undefined,
  });

  // Add Action Item Modal State
  const [isAddAiModalOpen, setIsAddAiModalOpen] = useState(false);
  const [newAi, setNewAi] = useState<Omit<ActionItem, 'id'>>({
    title: '',
    accountId: '',
    opportunityId: '',
    owner: '',
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

  const handleUpdateOpportunityForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpp || !editingOpp.name.trim()) return;
    updateOpportunity(editingOpp);
    setIsEditOppModalOpen(false);
    setEditingOpp(null);
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
  const [showAddStakeholder, setShowAddStakeholder] = useState(false);
  const [editingStk, setEditingStk] = useState<Stakeholder | null>(null);

  // Stakeholders table controls: search / sort / pagination
  const [stkSearch, setStkSearch] = useState('');
  const [stkTypeFilter, setStkTypeFilter] = useState<string>('All');
  const [stkSortField, setStkSortField] = useState<string>('name');
  const [stkSortDirection, setStkSortDirection] = useState<SortDirection>('asc');
  const [stkPage, setStkPage] = useState(1);
  const [stkPageSize, setStkPageSize] = useState(10);
  const handleStkSort = (field: string) => {
    if (stkSortField === field) setStkSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setStkSortField(field); setStkSortDirection('asc'); }
  };

  // Edit Account modal state
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [accountDraft, setAccountDraft] = useState<Account | null>(null);

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
      stage: 'Lead',
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
      opportunityType: 'Growth',
      aopAvailable: false,
      aopYear: null,
      serviceLine: undefined,
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
      owner: '',
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
    if (!newAi.title.trim()) return;
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

  // Stakeholders table: search → sort → paginate (client-side, this account only)
  const filteredStks = accountStks.filter(s => {
    if (stkTypeFilter !== 'All' && s.stakeholderType !== stkTypeFilter) return false;
    const q = stkSearch.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) ||
      s.designation.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q);
  });
  const sortedStks = [...filteredStks].sort((a, b) =>
    compareForSort((a as any)[stkSortField], (b as any)[stkSortField], stkSortDirection),
  );
  // Clamp the page so search changes never leave the user on an empty page.
  const stkTotalPages = Math.max(1, Math.ceil(sortedStks.length / stkPageSize));
  const stkCurrentPage = Math.min(stkPage, stkTotalPages);
  const pagedStks = sortedStks.slice((stkCurrentPage - 1) * stkPageSize, stkCurrentPage * stkPageSize);

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
              onClick={() => { setAccountDraft({ ...account, location: mapLocationToOption(account.location) }); setIsEditingAccount(true); }}
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
        ]}
      />

      {/* Navigation Tabs */}
      <DetailTabBar
        tabs={[
          { id: 'overview', label: 'Overview', icon: Briefcase, count: null },
          { id: 'opportunities', label: 'Opportunities', icon: DollarSign, count: visibleOpps.length },
          { id: 'action-items', label: 'Action Items', icon: CheckSquare, count: visibleActions.length },
          { id: 'stakeholders', label: 'Stakeholders', icon: Users, count: accountStks.length },
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
                              {renderOpportunityCell(col, opp, account.name)}
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
                    <TableHeadCell align="center" sticky="right">Delete</TableHeadCell>
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
                                      <div className="flex items-center flex-wrap gap-1">
                                        <div className="flex-1">
                                          <p className="font-bold text-slate-900 text-xs">{item.title}</p>
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
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedActionItemId(expandedActionItemId === item.id ? null : item.id);
                                          }}
                                          className={`inline-flex items-center space-x-1 ml-2 px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                            expandedActionItemId === item.id 
                                              ? 'bg-blue-100 text-blue-700 font-bold' 
                                              : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'
                                          }`}
                                          title="View/Add Comments"
                                        >
                                          <MessageSquare className="w-3.5 h-3.5" />
                                          <span className="text-[10px] font-bold">{itemComments.length}</span>
                                        </button>
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
                                      {item.owner}
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

                            {expandedActionItemId === item.id && (
                              <tr className="bg-slate-50/70 border-b border-slate-200">
                                <td colSpan={actionItemsColumnConfig.filter(c => c.isDisplayed).length + 1} className="p-4">
                                  <div className="space-y-3 max-w-2xl">
                                    <div>
                                      <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Risks & Dependencies</span>
                                      <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">
                                        {item.risksAndDependencies || <span className="text-slate-400 font-medium italic">None noted</span>}
                                      </p>
                                    </div>

                                    <div className="flex items-center space-x-2 border-b border-slate-200 pb-1.5">
                                      <MessageSquare className="w-4 h-4 text-blue-600" />
                                      <h4 className="font-bold text-slate-700 text-xs">Governance Comments ({itemComments.length})</h4>
                                    </div>
                                    
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                      {itemComments.length === 0 ? (
                                        <p className="text-[11px] text-slate-400 font-medium py-1">No comments logged for this action item.</p>
                                      ) : (
                                        itemComments.map(c => (
                                          <div key={c.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-1 relative group text-xs">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center space-x-2">
                                                <span className="font-bold text-slate-700 text-[11px]">{c.user}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="text-[9px] text-slate-400 font-mono">{c.timestamp}</span>
                                              </div>
                                              <button
                                                onClick={() => setDeleteTarget({ type: 'comment', id: c.id, label: c.text.substring(0, 40) })}
                                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-[10px] font-bold cursor-pointer"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                            <p className="text-[11px] text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{c.text}</p>
                                          </div>
                                        ))
                                      )}
                                    </div>

                                    <form 
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        const input = e.currentTarget.elements.namedItem('commentText') as HTMLInputElement;
                                        if (input && input.value.trim()) {
                                          addComment('actionItem', item.id, input.value.trim());
                                          input.value = '';
                                        }
                                      }} 
                                      className="flex gap-2"
                                    >
                                      <input
                                        type="text"
                                        name="commentText"
                                        required
                                        placeholder="Add a comment or update..."
                                        className="flex-1 text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                      />
                                      <Button type="submit" size="xs" className="shrink-0">
                                        Add Comment
                                      </Button>
                                    </form>
                                  </div>
                                </td>
                              </tr>
                            )}
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
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-800 text-sm tracking-tight">Customer Stakeholders</h4>
              <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowAddStakeholder(true)}>
                Add Stakeholder
              </Button>
            </div>

            {/* Stakeholder search + type filter */}
            <FilterBar>
              <SearchBar
                value={stkSearch}
                onChange={(v) => { setStkSearch(v); setStkPage(1); }}
                placeholder="Search stakeholders by name, designation, email, or phone..."
              />
              <FilterSelect
                label="Stakeholder Type"
                hideLabel
                value={stkTypeFilter}
                onChange={(v) => { setStkTypeFilter(v); setStkPage(1); }}
                options={[
                  { value: 'All', label: 'All Stakeholders' },
                  { value: 'CLIENT', label: 'Client Stakeholders' },
                  { value: 'SERVICE_PROVIDER', label: 'Service Provider Stakeholders' },
                ]}
                className="w-56 shrink-0"
              />
            </FilterBar>

            {/* Stakeholders table */}
            <Card padding="none" clip>
              <div className="overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableHeadCell><SortableHeader label="Name" field="name" sortField={stkSortField} sortDirection={stkSortDirection} onSort={handleStkSort} /></TableHeadCell>
                    <TableHeadCell><SortableHeader label="Type" field="stakeholderType" sortField={stkSortField} sortDirection={stkSortDirection} onSort={handleStkSort} /></TableHeadCell>
                    <TableHeadCell><SortableHeader label="Department" field="department" sortField={stkSortField} sortDirection={stkSortDirection} onSort={handleStkSort} /></TableHeadCell>
                    <TableHeadCell><SortableHeader label="Designation" field="designation" sortField={stkSortField} sortDirection={stkSortDirection} onSort={handleStkSort} /></TableHeadCell>
                    <TableHeadCell align="center"><SortableHeader label="Influence" field="influence" sortField={stkSortField} sortDirection={stkSortDirection} onSort={handleStkSort} className="justify-center w-full" /></TableHeadCell>
                    <TableHeadCell align="center"><SortableHeader label="Relationship" field="relationship" sortField={stkSortField} sortDirection={stkSortDirection} onSort={handleStkSort} className="justify-center w-full" /></TableHeadCell>
                    <TableHeadCell><SortableHeader label="Email" field="email" sortField={stkSortField} sortDirection={stkSortDirection} onSort={handleStkSort} /></TableHeadCell>
                    <TableHeadCell><SortableHeader label="Phone" field="phone" sortField={stkSortField} sortDirection={stkSortDirection} onSort={handleStkSort} /></TableHeadCell>
                    <TableHeadCell align="center">Actions</TableHeadCell>
                  </TableHead>
                  <tbody>
                    {sortedStks.length === 0 ? (
                      <EmptyRow
                        colSpan={9}
                        message={accountStks.length === 0
                          ? "No stakeholders registered. Click 'Add Stakeholder' above."
                          : 'No stakeholders match your search.'}
                      />
                    ) : (
                      pagedStks.map(stk => (
                        <TableRow key={stk.id} className="hover:bg-slate-50/50">
                          <TableCell className="font-extrabold text-slate-900">{stk.name}</TableCell>
                          <TableCell>
                            <StatusBadge value={STAKEHOLDER_TYPE_LABELS[stk.stakeholderType]} colorMap={STAKEHOLDER_TYPE_COLORS} shape="rounded" />
                          </TableCell>
                          <TableCell className="text-slate-500 font-semibold">{stk.department || '—'}</TableCell>
                          <TableCell className="text-slate-500 font-semibold">{stk.designation}</TableCell>
                          <TableCell align="center">
                            {stk.stakeholderType === 'SERVICE_PROVIDER'
                              ? <span className="text-slate-300">—</span>
                              : <StatusBadge value={stk.influence} colorMap={INFLUENCE_COLORS} shape="rounded" />}
                          </TableCell>
                          <TableCell align="center">
                            {stk.stakeholderType === 'SERVICE_PROVIDER'
                              ? <span className="text-slate-300">—</span>
                              : <StatusBadge value={stk.relationship} colorMap={RELATIONSHIP_COLORS} />}
                          </TableCell>
                          <TableCell className="select-all text-slate-500 hover:text-blue-500 transition-colors">
                            <a href={`mailto:${stk.email}`} className="flex items-center space-x-1 font-semibold">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                              <span className="truncate max-w-[150px]">{stk.email}</span>
                            </a>
                          </TableCell>
                          <TableCell className="font-mono select-all text-slate-500">
                            <span className="flex items-center space-x-1">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                              <span>{stk.phone}</span>
                            </span>
                          </TableCell>
                          <TableCell align="center">
                            <TableActions
                              entityLabel={`stakeholder ${stk.name}`}
                              onEdit={() => setEditingStk(stk)}
                              onDelete={() => setDeleteTarget({ type: 'stakeholder', id: stk.id, label: stk.name })}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>

              <Pagination
                page={stkCurrentPage}
                pageSize={stkPageSize}
                totalItems={sortedStks.length}
                onPageChange={setStkPage}
                onPageSizeChange={(size) => { setStkPageSize(size); setStkPage(1); }}
                itemLabel="stakeholders"
              />
            </Card>

            {/* Add stakeholder modal (account locked to this account) */}
            <StakeholderFormModal
              isOpen={showAddStakeholder}
              mode="create"
              accounts={accounts}
              lockedAccount={{ id: account.id, name: account.name }}
              onClose={() => setShowAddStakeholder(false)}
              onSubmit={async (draft) => { await addStakeholder(draft); }}
            />

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
          actionItemColumns={actionItemColumns}
          actionItemsColumnConfig={actionItemsColumnConfig}
          lockedAccount={{ id: account.id, name: account.name }}
        />
      </div>

      {/* Edit Account Modal */}
      {accountDraft && (
        <FormModal
          isOpen={isEditingAccount}
          title={`Edit Account — ${account.name}`}
          icon={<Pencil className="w-5 h-5 text-amber-600" />}
          onClose={() => { setIsEditingAccount(false); setAccountDraft(null); }}
          onSubmit={async (e) => {
            e.preventDefault();
            if (accountDraft) {
              await updateAccount(accountDraft);
              setIsEditingAccount(false);
              setAccountDraft(null);
            }
          }}
          submitLabel="Save Changes"
          submitVariant="warning"
          maxWidth="max-w-4xl"
        >
          <div className="space-y-5">
            <FormSection title="Identity">
              <FormGrid columns={3}>
                <FormField label="Account Name" required wide>
                  <input
                    type="text"
                    required
                    value={accountDraft.name}
                    onChange={(e) => setAccountDraft({ ...accountDraft, name: e.target.value })}
                    className={INPUT_CLS_AMBER}
                  />
                </FormField>
                <FormField label="Account Type">
                  <select
                    value={accountDraft.type}
                    onChange={(e) => setAccountDraft({ ...accountDraft, type: e.target.value as AccountType })}
                    className={`${INPUT_CLS_AMBER} bg-white cursor-pointer`}
                  >
                    {ACCOUNT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="Health Status">
                  <select
                    value={accountDraft.health}
                    onChange={(e) => setAccountDraft({ ...accountDraft, health: e.target.value as AccountHealth })}
                    className={`${INPUT_CLS_AMBER} bg-white cursor-pointer`}
                  >
                    {ACCOUNT_HEALTH_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </FormField>
                <FormField label="Industry">
                  <input
                    type="text"
                    value={accountDraft.industry}
                    onChange={(e) => setAccountDraft({ ...accountDraft, industry: e.target.value })}
                    className={INPUT_CLS_AMBER}
                  />
                </FormField>
                <FormField label="Client Since">
                  <SearchableSelect
                    value={accountDraft.since || ''}
                    onChange={(since) => setAccountDraft({ ...accountDraft, since })}
                    options={getCustomerSinceYearOptions()}
                    placeholder="Select year…"
                    tone="amber"
                    aria-label="Customer since year"
                  />
                </FormField>
              </FormGrid>
            </FormSection>

            <FormSection title="Contact & Location">
              <FormGrid columns={3}>
                <FormField label="Website">
                  <input
                    type="text"
                    value={accountDraft.website || ''}
                    onChange={(e) => setAccountDraft({ ...accountDraft, website: e.target.value })}
                    placeholder="https://"
                    className={INPUT_CLS_AMBER}
                  />
                </FormField>
                <FormField label="Phone">
                  <PhoneInput
                    value={accountDraft.phone || ''}
                    onChange={(phone) => setAccountDraft({ ...accountDraft, phone })}
                    tone="amber"
                  />
                </FormField>
                <FormField label="Email">
                  <input
                    type="email"
                    value={accountDraft.email || ''}
                    onChange={(e) => setAccountDraft({ ...accountDraft, email: e.target.value })}
                    className={INPUT_CLS_AMBER}
                  />
                </FormField>
                <FormField label="Location">
                  <SearchableSelect
                    value={accountDraft.location || ''}
                    onChange={(location) => setAccountDraft({ ...accountDraft, location })}
                    options={LOCATION_OPTIONS}
                    placeholder="Search countries…"
                    tone="amber"
                    aria-label="Account location"
                  />
                </FormField>
                <FormField label="Address" wide>
                  <input
                    type="text"
                    value={accountDraft.address || ''}
                    onChange={(e) => setAccountDraft({ ...accountDraft, address: e.target.value })}
                    className={INPUT_CLS_AMBER}
                  />
                </FormField>
              </FormGrid>
            </FormSection>

            <FormSection title="Overview">
              <FormGrid columns={3}>
                <FormField label="Account Summary / Description" wide>
                  <textarea
                    value={accountDraft.description || ''}
                    onChange={(e) => setAccountDraft({ ...accountDraft, description: e.target.value })}
                    rows={3}
                    className={`${INPUT_CLS_AMBER} resize-none`}
                  />
                </FormField>
                <FormField label="Total Revenue">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                        accountOpps.reduce((sum, o) => sum + (o.value || 0), 0)
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">(auto-calculated from opportunities)</span>
                  </div>
                </FormField>
                {accountColumns.length > 0 && accountColumns.map((col) => {
                  const rawVal = accountDraft[col.key] ?? (col.type === 'boolean' ? false : '');
                  return (
                    <FormField key={col.id} label={col.name}>
                      {col.type === 'boolean' ? (
                        <div className="flex items-center h-8">
                          <input
                            type="checkbox"
                            checked={!!rawVal}
                            onChange={(e) => setAccountDraft({ ...accountDraft, [col.key]: e.target.checked })}
                            className="w-4 h-4 text-amber-600 border-slate-300 rounded cursor-pointer"
                          />
                          <span className="text-xs font-medium text-slate-500 ml-2">Active / Yes</span>
                        </div>
                      ) : col.type === 'number' ? (
                        <input
                          type="number"
                          value={rawVal}
                          onChange={(e) => setAccountDraft({ ...accountDraft, [col.key]: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="Enter number"
                          className={INPUT_CLS_AMBER}
                        />
                      ) : col.type === 'date' ? (
                        <input
                          type="date"
                          value={rawVal}
                          onChange={(e) => setAccountDraft({ ...accountDraft, [col.key]: e.target.value })}
                          className={`${INPUT_CLS_AMBER} font-mono`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={rawVal}
                          onChange={(e) => setAccountDraft({ ...accountDraft, [col.key]: e.target.value })}
                          placeholder="Enter value"
                          className={INPUT_CLS_AMBER}
                        />
                      )}
                    </FormField>
                  );
                })}
              </FormGrid>
            </FormSection>
          </div>
        </FormModal>
      )}

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
