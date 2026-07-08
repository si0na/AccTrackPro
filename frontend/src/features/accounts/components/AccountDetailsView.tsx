/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Account, AccountType, AccountHealth, Opportunity, ActionItem, OpportunityStage, ActionItemStatus, PriorityLevel } from '@/types';
import { InlineEditModal } from '@/components/InlineEditModal';
import { NumberInput } from '@/components/NumberInput';
import { CustomColumnFields } from '@/components/CustomColumnFields';
import { DocumentsPanel } from '@/components/documents/DocumentsPanel';
import { OpportunityActionsCommentsPanel } from '@/features/opportunities/components/OpportunityActionsCommentsPanel';
import { CustomizeColumnsSidebar } from '@/components/table/CustomizeColumnsSidebar';
import {
  ACTION_STATUS_COLORS,
  BackButton,
  Button,
  ConfirmDialog,
  EmptyRow,
  EmptyState,
  FormField,
  FormGrid,
  FormModal,
  HEALTH_COLORS,
  INFLUENCE_COLORS,
  INPUT_CLS,
  INPUT_CLS_AMBER,
  PRIORITY_COLORS,
  RELATIONSHIP_COLORS,
  RowActionButton,
  SELECT_CLS,
  STAGE_COLORS,
  StatusBadge,
  TableActions,
} from '@/components/ui';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Globe,
  Phone,
  Mail,
  MapPin,
  Users,
  Briefcase,
  CheckSquare,
  MessageSquare,
  FileText,
  Plus,
  Trash2,
  DollarSign,
  Settings2,
  TrendingUp,
  Pencil,
  Eye,
  X,
} from 'lucide-react';

export const AccountDetailsView: React.FC = () => {
  const {
    accounts,
    opportunities,
    actionItems,
    stakeholders,
    activities,
    comments,
    selectedAccountId,
    setView,
    setSelectedAccountId,
    setSelectedOpportunityId,
    updateAccount,
    addOpportunity,
    updateOpportunity,
    deleteOpportunity,
    addActionItem,
    updateActionItem,
    deleteActionItem,
    addStakeholder,
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
    probability: 0,
    owner: '',
    closeDate: '',
    description: '',
    startDate: '',
    endDate: '',
    crmValue: 0,
    nextStep: '',
    tags: [],
    team: []
  });

  // Add Action Item Modal State
  const [isAddAiModalOpen, setIsAddAiModalOpen] = useState(false);
  const [newAi, setNewAi] = useState<Omit<ActionItem, 'id'>>({
    title: '',
    accountId: '',
    opportunityId: '',
    owner: '',
    dueDate: '',
    priority: 'Medium',
    status: 'Not Started',
    notes: ''
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
  const [showAddStakeholder, setShowAddStakeholder] = useState(false);
  const [newStk, setNewStk] = useState({
    name: '',
    designation: '',
    influence: 'Medium' as const,
    relationship: 'Neutral' as const,
    email: '',
    phone: ''
  });

  // Edit Account modal state
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [accountDraft, setAccountDraft] = useState<Account | null>(null);

  // Inline editing state — Account Summary
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');

  // Inline editing state — Contact Information
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactDraft, setContactDraft] = useState({ website: '', phone: '', email: '', address: '' });

  // Document count surfaced by the shared DocumentsPanel (for the tab label).
  const [docCount, setDocCount] = useState(0);

  if (!account) {
    return (
      <div className="bg-white p-8 text-center rounded-xl border border-slate-200">
        <p className="text-slate-400 font-medium">No account selected.</p>
        <button onClick={() => setView('accounts')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer">
          Back to Accounts
        </button>
      </div>
    );
  }

  // Filter lists for current account
  const accountOpps = opportunities.filter(o => o.accountId === account.id);
  const accountActions = actionItems.filter(ai => ai.accountId === account.id);
  const accountStks = stakeholders.filter(s => s.accountId === account.id);
  const accountActivities = activities.filter(actv => actv.accountId === account.id);
  const accountComments = comments.filter(c => c.targetType === 'account' && c.targetId === account.id);


  // Excel Handlers for Opportunities
  const handleOpenAddOpportunity = () => {
    setNewOpp({
      name: '',
      accountId: account.id,
      stage: 'Lead',
      value: 0,
      probability: 0,
      owner: '',
      closeDate: '',
      description: '',
      startDate: '',
      endDate: '',
      crmValue: 0,
      nextStep: '',
      tags: [],
      team: []
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
  type DeleteType = 'opportunity' | 'actionItem' | 'stakeholder' | 'comment';
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
      dueDate: '',
      priority: 'Medium',
      status: 'Not Started',
      notes: ''
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

  // Add Stakeholder handler
  const handleCreateStakeholder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStk.name.trim()) return;
    addStakeholder({
      ...newStk,
      accountId: account.id
    });
    setNewStk({
      name: '',
      designation: '',
      influence: 'Medium',
      relationship: 'Neutral',
      email: '',
      phone: ''
    });
    setShowAddStakeholder(false);
  };

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

      {/* Breadcrumbs and Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          {!navSource && (
            <button
              onClick={() => setView('accounts')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight border-l-4 border-blue-600 pl-3">{account.name}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide ${
                account.health === 'Healthy' ? 'bg-green-100 text-green-700' :
                account.health === 'At Risk' ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700'
              }`}>
                {account.health}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => { setAccountDraft({ ...account }); setIsEditingAccount(true); }}
            className="flex items-center space-x-1.5 px-3.5 py-2 border border-amber-200 bg-amber-50 text-amber-700 font-semibold rounded-lg text-xs hover:bg-amber-100 cursor-pointer transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit Account</span>
          </button>
        </div>
      </div>

      {/* Account Attributes Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60 shadow-inner">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account Type</p>
          <p className="text-xs font-extrabold text-slate-800">{account.type}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Owner</p>
          <p className="text-xs font-extrabold text-blue-600">{account.owner}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Industry</p>
          <p className="text-xs font-extrabold text-slate-800">{account.industry}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Annual Revenue</p>
          <p className="text-xs font-extrabold text-slate-900 font-mono">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(account.revenue)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Since</p>
          <p className="text-xs font-extrabold text-slate-800">{account.since}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center overflow-x-auto select-none space-x-1">
        {[
          { id: 'overview', label: 'Overview', icon: Briefcase },
          { id: 'opportunities', label: `Opportunities (${accountOpps.length})`, icon: DollarSign },
          { id: 'action-items', label: `Action Items (${accountActions.length})`, icon: CheckSquare },
          { id: 'stakeholders', label: `Stakeholders (${accountStks.length})`, icon: Users },
          { id: 'comments', label: `Comments (${accountComments.length})`, icon: MessageSquare },
          { id: 'documents', label: docCount > 0 ? `Documents (${docCount})` : 'Documents', icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600 font-extrabold'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Tab Contents */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Summary details */}
            <div className="lg:col-span-3 space-y-6">
              {/* Account Summary Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="font-extrabold text-slate-800 text-sm tracking-tight">Account Summary</h4>
                  {isEditingSummary ? (
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
                </div>
                {isEditingSummary ? (
                  <textarea
                    rows={5}
                    value={summaryDraft}
                    onChange={(e) => setSummaryDraft(e.target.value)}
                    placeholder="Enter company summary, background, or profile..."
                    className="w-full text-xs p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none text-slate-700 leading-relaxed"
                    autoFocus
                  />
                ) : (
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100 text-xs text-slate-600 font-medium leading-relaxed min-h-[72px]">
                    {account.description || <span className="text-slate-300 italic">No summary added yet. Click Edit to add one.</span>}
                  </div>
                )}
              </div>

              {/* Contact Information Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="font-extrabold text-slate-800 text-sm tracking-tight">Contact Information</h4>
                  {isEditingContact ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          updateAccount({ ...account, ...contactDraft });
                          setIsEditingContact(false);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
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
                        setContactDraft({ website: account.website || '', phone: account.phone || '', email: account.email || '', address: account.address || '' });
                        setIsEditingContact(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-600 font-bold transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                  )}
                </div>
                {isEditingContact ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
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
                      <input
                        type="text"
                        value={contactDraft.phone}
                        onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })}
                        placeholder="+1 (555) 000-0000"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-slate-800"
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
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-start gap-2.5 text-slate-600">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Website</p>
                        {account.website
                          ? <a href={`https://${account.website}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-bold">{account.website}</a>
                          : <span className="text-slate-300 italic">Not set</span>}
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Phone</p>
                        <span className="font-mono text-slate-800">{account.phone || <span className="text-slate-300 italic">Not set</span>}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email</p>
                        <span className="text-slate-800 font-medium">{account.email || <span className="text-slate-300 italic">Not set</span>}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Address</p>
                        <span className="text-slate-800 font-medium">{account.address || <span className="text-slate-300 italic">Not set</span>}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Three Widget boxes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Box 1 */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1 hover:border-slate-300 transition-all">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Open Opportunities</p>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-extrabold text-slate-800">{accountOpps.length}</p>
                    <button onClick={() => setActiveTab('opportunities')} className="text-[11px] text-blue-500 hover:underline font-bold cursor-pointer">
                      View details
                    </button>
                  </div>
                </div>
                {/* Box 2 */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1 hover:border-slate-300 transition-all">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Open Action Items</p>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-extrabold text-slate-800">{accountActions.filter(a => a.status !== 'Completed').length}</p>
                    <button onClick={() => setActiveTab('action-items')} className="text-[11px] text-blue-500 hover:underline font-bold cursor-pointer">
                      View details
                    </button>
                  </div>
                </div>
                {/* Box 3 */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1 hover:border-slate-300 transition-all">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Stakeholders Registered</p>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-extrabold text-slate-800">{accountStks.length}</p>
                    <button onClick={() => setActiveTab('stakeholders')} className="text-[11px] text-blue-500 hover:underline font-bold cursor-pointer">
                      View details
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline Column */}
            <div className="lg:col-span-2">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-full space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm tracking-tight border-b border-slate-100 pb-2">
                    Timeline & Activity
                  </h4>

                  <div className="space-y-4 mt-4 overflow-y-auto max-h-[300px] pr-1">
                    {accountActivities.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium">No recent operations logged for this account.</p>
                    ) : (
                      accountActivities.map((actv) => (
                        <div key={actv.id} className="flex items-start space-x-3 text-xs group">
                          <div className="mt-1 relative shrink-0">
                            <div className="w-2.5 h-2.5 rounded-full border-2 bg-blue-500 border-blue-200" />
                          </div>
                          <div className="flex-1 space-y-0.5">
                            <p className="text-slate-700 font-semibold">
                              {actv.text}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">{actv.timestamp}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Opportunities Tab (Standard Design) */}
        {activeTab === 'opportunities' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">Account Opportunities</h4>
                <p className="text-[11px] text-slate-500 font-medium">Click on any row to focus and display corresponding action table and comments below.</p>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setIsOppSidebarOpen(true)}
                  className="flex items-center justify-center space-x-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold transition-all shadow-xs cursor-pointer text-xs"
                >
                  <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Customize Columns</span>
                </button>
                <button
                  onClick={handleOpenAddOpportunity}
                  className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-bold shadow-xs cursor-pointer transition-all text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Opportunity</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider select-none">
                      {opportunitiesColumnConfig.filter(c => c.isDisplayed).map(col => (
                        <th 
                          key={col.key} 
                          className={`py-3 px-4 font-bold uppercase tracking-wider ${
                            col.key === 'name' ? 'px-5' : ''
                          }`}
                        >
                          {col.name}
                        </th>
                      ))}
                      <th className="py-3 px-5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountOpps.length === 0 ? (
                      <tr>
                        <td colSpan={opportunitiesColumnConfig.filter(c => c.isDisplayed).length + 1} className="text-center py-8 text-slate-400 font-medium italic">
                          No opportunities linked to this account. Click 'Add Opportunity' to create one.
                        </td>
                      </tr>
                    ) : (
                      accountOpps.map(opp => (
                        <tr 
                          key={opp.id} 
                          onClick={() => setSelectedExcelOppId(selectedExcelOppId === opp.id ? null : opp.id)}
                          className={`border-b last:border-0 hover:bg-slate-50/50 cursor-pointer text-slate-800 font-medium transition-all ${
                            selectedExcelOppId === opp.id ? 'bg-blue-50/40 border-l-4 border-l-blue-600 font-semibold' : ''
                          }`}
                        >
                          {opportunitiesColumnConfig.filter(c => c.isDisplayed).map(col => {
                             if (col.key === 'name') {
                               return (
                                 <td key={col.key} className="py-3 px-5 font-bold text-slate-900">
                                   <div className="flex items-center space-x-2">
                                     <TrendingUp className="w-4 h-4 text-indigo-500 shrink-0" />
                                     <div>
                                       <p className="font-bold text-slate-900 text-xs hover:text-indigo-600 transition-colors">
                                         {opp.name}
                                       </p>
                                     </div>
                                   </div>
                                 </td>
                               );
                             }
                            if (col.key === 'accountId') {
                              return (
                                <td key={col.key} className="py-3 px-4 text-slate-600 font-semibold">
                                  {account.name}
                                </td>
                              );
                            }
                            if (col.key === 'stage') {
                              return (
                                <td key={col.key} className="py-3 px-4">
                                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                                    opp.stage === 'Won' ? 'bg-green-100 text-green-700' :
                                    opp.stage === 'Negotiation' ? 'bg-blue-100 text-blue-700' :
                                    opp.stage === 'Proposal' ? 'bg-purple-100 text-purple-700' :
                                    opp.stage === 'Qualified' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-slate-100 text-slate-700'
                                  }`}>
                                    {opp.stage}
                                  </span>
                                </td>
                              );
                            }
                            if (col.key === 'value') {
                              return (
                                <td key={col.key} className="py-3 px-4 font-bold font-mono text-xs text-slate-700">
                                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(opp.value)}
                                </td>
                              );
                            }
                            if (col.key === 'probability') {
                              return (
                                <td key={col.key} className="py-3 px-4">
                                  <div className="flex items-center space-x-2">
                                    <div className="w-10 bg-slate-100 h-1.5 rounded-full overflow-hidden shrink-0">
                                      <div 
                                        className={`h-full ${
                                          opp.probability >= 80 ? 'bg-green-500' :
                                          opp.probability >= 50 ? 'bg-blue-500' :
                                          'bg-yellow-500'
                                        }`}
                                        style={{ width: `${opp.probability}%` }}
                                      />
                                    </div>
                                    <span className="font-bold text-slate-700 font-mono text-[10px]">{opp.probability}%</span>
                                  </div>
                                </td>
                              );
                            }
                            if (col.key === 'owner') {
                              return (
                                <td key={col.key} className="py-3 px-4 text-slate-600 font-semibold">
                                  {opp.owner}
                                </td>
                              );
                            }
                            if (col.key === 'closeDate') {
                              return (
                                <td key={col.key} className="py-3 px-4 text-slate-500 font-mono font-medium">
                                  {opp.closeDate}
                                </td>
                              );
                            }

                            // Customizable dynamic custom columns
                            const rawVal = opp[col.key] ?? (col.type === 'boolean' ? false : '');
                            return (
                              <td key={col.key} className="py-3 px-4">
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
                              </td>
                            );
                          })}
                          <td className="py-3 px-5 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedOpportunityId(opp.id);
                                  setOppDetailsSourceView('account-details');
                                  setView('opportunity-details');
                                }}
                                className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                                title="View Opportunity Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleEditOppClick(opp)}
                                className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit Opportunity"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteOpportunity(opp.id, opp.name)}
                                className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                                title="Delete Opportunity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

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
                <h4 className="font-extrabold text-slate-800 text-sm">Account Deliverables</h4>
                <p className="text-[11px] text-slate-500 font-medium">Track operational milestones, assign owners, and manage comments per deliverable.</p>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => setIsAiSidebarOpen(true)}
                  className="flex items-center justify-center space-x-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold transition-all shadow-xs cursor-pointer text-xs"
                >
                  <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Customize Columns</span>
                </button>
                <button
                  onClick={handleOpenAddActionItem}
                  className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-bold shadow-xs cursor-pointer transition-all text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Action Item</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider select-none">
                      {actionItemsColumnConfig.filter(c => c.isDisplayed).map(col => (
                        <th 
                          key={col.key} 
                          className={`py-3 px-4 font-bold uppercase tracking-wider ${
                            col.key === 'title' ? 'px-5' : ''
                          }`}
                        >
                          {col.name}
                        </th>
                      ))}
                      <th className="py-3 px-5 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountActions.length === 0 ? (
                      <tr>
                        <td colSpan={actionItemsColumnConfig.filter(c => c.isDisplayed).length + 1} className="text-center py-8 text-slate-400 font-medium italic">
                          No action items configured. Click 'New Task' to get started.
                        </td>
                      </tr>
                    ) : (
                      accountActions.map(item => {
                        const itemComments = comments.filter(c => c.targetType === 'actionItem' && c.targetId === item.id);
                        return (
                          <React.Fragment key={item.id}>
                            <tr className="border-b last:border-0 hover:bg-slate-50/50 text-slate-800 font-medium transition-colors">
                              {actionItemsColumnConfig.filter(c => c.isDisplayed).map(col => {
                                if (col.key === 'title') {
                                  return (
                                    <td key={col.key} className="py-3.5 px-5">
                                      <div className="flex items-center flex-wrap gap-1">
                                        <div className="flex-1">
                                          <p className="font-bold text-slate-900 text-xs">{item.title}</p>
                                        </div>
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
                                    </td>
                                  );
                                }
                                if (col.key === 'notes') {
                                  return (
                                    <td key={col.key} className="py-3.5 px-4 text-slate-600 font-medium text-xs">
                                      {item.notes || <span className="text-slate-400 italic">No description</span>}
                                    </td>
                                  );
                                }
                                if (col.key === 'accountId') {
                                  return (
                                    <td key={col.key} className="py-3.5 px-4 text-slate-600 font-semibold text-xs">
                                      {accounts.find(acc => acc.id === item.accountId)?.name || account.name}
                                    </td>
                                  );
                                }
                                if (col.key === 'opportunityId') {
                                  const opp = opportunities.find(o => o.id === item.opportunityId);
                                  return (
                                    <td key={col.key} className="py-3.5 px-4 text-slate-600 font-semibold text-xs">
                                      {opp ? opp.name : '—'}
                                    </td>
                                  );
                                }
                                if (col.key === 'owner') {
                                  return (
                                    <td key={col.key} className="py-3.5 px-4 text-slate-600 font-medium text-xs">
                                      {item.owner}
                                    </td>
                                  );
                                }
                                if (col.key === 'priority') {
                                  return (
                                    <td key={col.key} className="py-3.5 px-4">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                                        item.priority === 'High' ? 'bg-red-100 text-red-700' :
                                        item.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}>
                                        {item.priority}
                                      </span>
                                    </td>
                                  );
                                }
                                if (col.key === 'status') {
                                  return (
                                    <td key={col.key} className="py-3.5 px-4">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                                        item.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                        item.status === 'Blocked' ? 'bg-red-100 text-red-700' :
                                        item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                        'bg-slate-100 text-slate-700'
                                      }`}>
                                        {item.status}
                                      </span>
                                    </td>
                                  );
                                }
                                if (col.key === 'dueDate') {
                                  return (
                                    <td key={col.key} className="py-3.5 px-4 text-slate-500 font-mono text-xs font-medium">
                                      {item.dueDate}
                                    </td>
                                  );
                                }

                                // Customizable dynamic custom columns
                                const rawVal = item[col.key] ?? (col.type === 'boolean' ? false : '');
                                return (
                                  <td key={col.key} className="py-3.5 px-4">
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
                                  </td>
                                );
                              })}
                              <td className="py-3.5 px-5 text-center">
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button
                                    onClick={() => handleEditAiClick(item)}
                                    className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Action Item"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setDeleteTarget({ type: 'actionItem', id: item.id, label: item.title })} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {expandedActionItemId === item.id && (
                              <tr className="bg-slate-50/70 border-b border-slate-200">
                                <td colSpan={actionItemsColumnConfig.filter(c => c.isDisplayed).length + 1} className="p-4">
                                  <div className="space-y-3 max-w-2xl">
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
                                      <button
                                        type="submit"
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors shrink-0 shadow-sm"
                                      >
                                        Add Comment
                                      </button>
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
                </table>
              </div>
            </div>

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
              <button
                onClick={() => setShowAddStakeholder(true)}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stakeholder</span>
              </button>
            </div>

            {/* Stakeholders Directory Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {accountStks.length === 0 ? (
                <div className="col-span-full bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-xs text-slate-400 font-medium">
                  No stakeholders registered. Click 'Add Stakeholder' above.
                </div>
              ) : (
                accountStks.map(stk => (
                  <div key={stk.id} className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-all">
                    <div className="space-y-3.5">
                      {/* Name & Title */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h5 className="font-extrabold text-slate-900 text-sm leading-none">{stk.name}</h5>
                          <p className="text-xs text-slate-400 mt-1">{stk.designation}</p>
                        </div>
                        <button
                          onClick={() => setDeleteTarget({ type: 'stakeholder', id: stk.id, label: stk.name })}
                          className="text-slate-300 hover:text-red-500 p-1 rounded-md hover:bg-red-50 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Contact items */}
                      <div className="space-y-1.5 text-xs text-slate-500 font-medium">
                        <p className="flex items-center space-x-2 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{stk.email}</span>
                        </p>
                        <p className="flex items-center space-x-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono">{stk.phone}</span>
                        </p>
                      </div>
                    </div>

                    {/* Attribute tags */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3.5 mt-4">
                      <div className="space-y-0.5">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">Influence</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          stk.influence === 'High' ? 'bg-red-50 text-red-600' :
                          stk.influence === 'Medium' ? 'bg-orange-50 text-orange-600' :
                          'bg-green-50 text-green-600'
                        }`}>{stk.influence}</span>
                      </div>
                      <div className="space-y-0.5 text-right">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block">Relationship</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          stk.relationship === 'Strong' ? 'bg-green-100 text-green-700' :
                          stk.relationship === 'Neutral' ? 'bg-slate-100 text-slate-600' :
                          'bg-red-100 text-red-700'
                        }`}>{stk.relationship}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Inline dialog overlay for Stakeholder Creation */}
            {showAddStakeholder && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                <form onSubmit={handleCreateStakeholder} className="bg-white rounded-xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4">
                  <h4 className="font-extrabold text-slate-800 text-sm tracking-tight border-b pb-2">
                    Register Client Stakeholder
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Full Name</label>
                        <input
                          type="text"
                          required
                          value={newStk.name}
                          onChange={(e) => setNewStk({ ...newStk, name: e.target.value })}
                          className="w-full text-xs px-2.5 py-2 border rounded-md"
                          placeholder="David Miller"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Designation</label>
                        <input
                          type="text"
                          required
                          value={newStk.designation}
                          onChange={(e) => setNewStk({ ...newStk, designation: e.target.value })}
                          className="w-full text-xs px-2.5 py-2 border rounded-md"
                          placeholder="CIO"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Influence</label>
                        <select
                          value={newStk.influence}
                          onChange={(e) => setNewStk({ ...newStk, influence: e.target.value as any })}
                          className="w-full text-xs px-2.5 py-2 border rounded-md bg-white"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Relationship</label>
                        <select
                          value={newStk.relationship}
                          onChange={(e) => setNewStk({ ...newStk, relationship: e.target.value as any })}
                          className="w-full text-xs px-2.5 py-2 border rounded-md bg-white"
                        >
                          <option value="Strong">Strong</option>
                          <option value="Neutral">Neutral</option>
                          <option value="Weak">Weak</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Email</label>
                        <input
                          type="email"
                          required
                          value={newStk.email}
                          onChange={(e) => setNewStk({ ...newStk, email: e.target.value })}
                          className="w-full text-xs px-2.5 py-2 border rounded-md"
                          placeholder="email@company.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Phone Number</label>
                        <input
                          type="text"
                          value={newStk.phone}
                          onChange={(e) => setNewStk({ ...newStk, phone: e.target.value })}
                          className="w-full text-xs px-2.5 py-2 border rounded-md font-mono"
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 border-t pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddStakeholder(false)}
                      className="px-4 py-1.5 border rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Register Stakeholder
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Comments Feed */}
        {activeTab === 'comments' && (
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-5">
            <h4 className="font-extrabold text-slate-800 text-sm tracking-tight border-b border-slate-100 pb-2">
              Corporate Governance Discussion & Updates
            </h4>

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
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold cursor-pointer shrink-0 transition-colors shadow-md shadow-blue-500/5"
              >
                Post Comment
              </button>
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
          </div>
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
            onChange={(patch) => setEditingAi({ ...editingAi, ...patch })}
            onSave={handleUpdateActionItemForm}
            onCancel={() => { setIsEditAiModalOpen(false); setEditingAi(null); }}
          />
        )}

        {/* Add Opportunity Modal */}
        {isAddOppModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2.5">
                  <Plus className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 tracking-tight">Add New Opportunity</h3>
                </div>
                <button
                  onClick={() => setIsAddOppModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateOpportunityForm} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {/* Opportunity Name */}
                  <div className="col-span-2 space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Opportunity Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Enterprise SLA Renewal"
                      value={newOpp.name}
                      onChange={(e) => setNewOpp({ ...newOpp, name: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* Value */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Deal Value ($)</label>
                    <NumberInput
                      required
                      min={0}
                      value={newOpp.value}
                      onValueChange={(v) => setNewOpp({ ...newOpp, value: v, crmValue: Math.round(v * 0.9) })}
                      placeholder="e.g. 50000"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* Close Date */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Expected Close Date</label>
                    <input
                      type="date"
                      required
                      value={newOpp.closeDate}
                      onChange={(e) => setNewOpp({ ...newOpp, closeDate: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                    />
                  </div>

                  {/* Start Date */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Start Date</label>
                    <input
                      type="date"
                      value={newOpp.startDate}
                      onChange={(e) => setNewOpp({ ...newOpp, startDate: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                    />
                  </div>

                  {/* Stage */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Pipeline Stage</label>
                    <select
                      value={newOpp.stage}
                      onChange={(e) => setNewOpp({ ...newOpp, stage: e.target.value as any })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="Lead">Lead</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Proposal">Proposal</option>
                      <option value="Negotiation">Negotiation</option>
                      <option value="Won">Won</option>
                    </select>
                  </div>

                  {/* Probability */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Probability (%)</label>
                    <NumberInput
                      min={0}
                      max={100}
                      required
                      value={newOpp.probability}
                      onValueChange={(v) => setNewOpp({ ...newOpp, probability: v })}
                      placeholder="0–100"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* Owner */}
                  <div className="col-span-2 space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Opportunity Owner</label>
                    <input
                      type="text"
                      value={newOpp.owner}
                      onChange={(e) => setNewOpp({ ...newOpp, owner: e.target.value })}
                      placeholder="e.g., John Smith"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-600 uppercase tracking-wide">Description / Scope</label>
                  <textarea
                    rows={2}
                    placeholder="Provide details about the deal..."
                    value={newOpp.description || ''}
                    onChange={(e) => setNewOpp({ ...newOpp, description: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Active custom columns (hidden ones excluded) */}
                <CustomColumnFields
                  columns={opportunityColumns}
                  config={opportunitiesColumnConfig}
                  values={newOpp}
                  onChange={(key, value) => setNewOpp({ ...newOpp, [key]: value })}
                />

                </div>{/* end scrollable body */}
                {/* Actions Footer */}
                <div className="flex items-center justify-end space-x-2.5 px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAddOppModalOpen(false)}
                    className="px-4 py-2 text-xs border border-slate-200 rounded-lg font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddOppSubmitting}
                    className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold text-white shadow-md shadow-indigo-600/10 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isAddOppSubmitting ? 'Adding…' : 'Add Opportunity'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Action Item Modal */}
        {isAddAiModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2.5">
                  <Plus className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 tracking-tight">Create Action Item</h3>
                </div>
                <button
                  onClick={() => setIsAddAiModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 cursor-pointer transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateActionItemForm} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {/* Task Title */}
                  <div className="col-span-2 space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Task Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Set up kick-off meeting"
                      value={newAi.title}
                      onChange={(e) => setNewAi({ ...newAi, title: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* Owner */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Assigned Owner</label>
                    <input
                      type="text"
                      value={newAi.owner}
                      onChange={(e) => setNewAi({ ...newAi, owner: e.target.value })}
                      placeholder="e.g., John Smith"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* Priority Selection */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Priority Level</label>
                    <select
                      value={newAi.priority}
                      onChange={(e) => setNewAi({ ...newAi, priority: e.target.value as any })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="Low">Low Priority</option>
                      <option value="Medium">Medium Priority</option>
                      <option value="High">High Priority</option>
                    </select>
                  </div>

                  {/* Due Date */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Due Date</label>
                    <input
                      type="date"
                      required
                      value={newAi.dueDate}
                      onChange={(e) => setNewAi({ ...newAi, dueDate: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Status</label>
                    <select
                      value={newAi.status}
                      onChange={(e) => setNewAi({ ...newAi, status: e.target.value as any })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Blocked">Blocked</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  {/* Associated Opportunity */}
                  <div className="col-span-2 space-y-1">
                    <label className="font-bold text-slate-600 uppercase tracking-wide">Associated Opportunity</label>
                    <select
                      value={newAi.opportunityId || ''}
                      onChange={(e) => setNewAi({ ...newAi, opportunityId: e.target.value || undefined })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">None (General Account Task)</option>
                      {accountOpps.map(opp => (
                        <option key={opp.id} value={opp.id}>{opp.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1 text-xs">
                  <label className="font-bold text-slate-600 uppercase tracking-wide">Detailed Scope / Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Enter description of deliverable task..."
                    value={newAi.notes || ''}
                    onChange={(e) => setNewAi({ ...newAi, notes: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Active custom columns (hidden ones excluded) */}
                <CustomColumnFields
                  columns={actionItemColumns}
                  config={actionItemsColumnConfig}
                  values={newAi}
                  onChange={(key, value) => setNewAi({ ...newAi, [key]: value })}
                />

                </div>{/* end scrollable body */}
                {/* Actions Footer */}
                <div className="flex items-center justify-end space-x-2.5 px-6 py-4 border-t border-slate-100 bg-white shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAddAiModalOpen(false)}
                    className="px-4 py-2 text-xs border border-slate-200 rounded-lg font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold text-white shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    Create Action Item
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Edit Account Modal */}
      {isEditingAccount && accountDraft && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-fade-in">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Pencil className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-slate-800 tracking-tight">Edit Account — {account.name}</h3>
              </div>
              <button
                onClick={() => { setIsEditingAccount(false); setAccountDraft(null); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/60 cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (accountDraft) {
                  await updateAccount(accountDraft);
                  setIsEditingAccount(false);
                  setAccountDraft(null);
                }
              }}
              className="flex flex-col overflow-hidden"
            >
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Account Name</label>
                    <input
                      type="text"
                      required
                      value={accountDraft.name}
                      onChange={(e) => setAccountDraft({ ...accountDraft, name: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Account Type</label>
                    <select
                      value={accountDraft.type}
                      onChange={(e) => setAccountDraft({ ...accountDraft, type: e.target.value as AccountType })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      <option value="Growth">Growth</option>
                      <option value="Pursuit">Pursuit</option>
                      <option value="Project">Project</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Health Status</label>
                    <select
                      value={accountDraft.health}
                      onChange={(e) => setAccountDraft({ ...accountDraft, health: e.target.value as AccountHealth })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      <option value="Healthy">Healthy</option>
                      <option value="At Risk">At Risk</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Industry</label>
                    <input
                      type="text"
                      value={accountDraft.industry}
                      onChange={(e) => setAccountDraft({ ...accountDraft, industry: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Client Since</label>
                    <input
                      type="text"
                      value={accountDraft.since || ''}
                      onChange={(e) => setAccountDraft({ ...accountDraft, since: e.target.value })}
                      placeholder="e.g., 2020"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Website</label>
                    <input
                      type="text"
                      value={accountDraft.website || ''}
                      onChange={(e) => setAccountDraft({ ...accountDraft, website: e.target.value })}
                      placeholder="https://"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Phone</label>
                    <input
                      type="text"
                      value={accountDraft.phone || ''}
                      onChange={(e) => setAccountDraft({ ...accountDraft, phone: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Email</label>
                    <input
                      type="email"
                      value={accountDraft.email || ''}
                      onChange={(e) => setAccountDraft({ ...accountDraft, email: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Address</label>
                    <input
                      type="text"
                      value={accountDraft.address || ''}
                      onChange={(e) => setAccountDraft({ ...accountDraft, address: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Account Summary / Description</label>
                    <textarea
                      value={accountDraft.description || ''}
                      onChange={(e) => setAccountDraft({ ...accountDraft, description: e.target.value })}
                      rows={3}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Total Revenue</label>
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                          accountOpps.reduce((sum, o) => sum + (o.value || 0), 0)
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">(auto-calculated from opportunities)</span>
                    </div>
                  </div>
                  {accountColumns.length > 0 && accountColumns.map((col) => {
                    const rawVal = accountDraft[col.key] ?? (col.type === 'boolean' ? false : '');
                    return (
                      <div key={col.id} className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">{col.name}</label>
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
                            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                        ) : col.type === 'date' ? (
                          <input
                            type="date"
                            value={rawVal}
                            onChange={(e) => setAccountDraft({ ...accountDraft, [col.key]: e.target.value })}
                            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                          />
                        ) : (
                          <input
                            type="text"
                            value={rawVal}
                            onChange={(e) => setAccountDraft({ ...accountDraft, [col.key]: e.target.value })}
                            placeholder="Enter value"
                            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-end space-x-2.5 px-6 py-4 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => { setIsEditingAccount(false); setAccountDraft(null); }}
                  className="px-4 py-2 text-xs border border-slate-200 rounded-lg font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-amber-500 hover:bg-amber-600 rounded-lg font-bold text-white shadow-md shadow-amber-500/10 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={
          deleteTarget?.type === 'opportunity' ? 'Delete Opportunity' :
          deleteTarget?.type === 'actionItem' ? 'Delete Action Item' :
          deleteTarget?.type === 'stakeholder' ? 'Delete Stakeholder' :
          'Delete Comment'
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
