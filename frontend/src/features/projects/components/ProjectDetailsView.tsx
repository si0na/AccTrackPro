/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import {
  ActionItem, ActionItemStatus, AdminUser, PriorityLevel, ProjectHealth, ProjectTeamMember,
  ProjectMilestone, ProjectRisk, ProjectAssumption, ProjectIssue, ProjectDependency,
} from '@/types';
import {
  AlertOctagon,
  Briefcase,
  DollarSign,
  Calendar,
  CheckSquare,
  Edit2,
  Flag,
  FolderKanban,
  Gauge,
  HelpCircle,
  Link2,
  MessageSquare,
  MoreVertical,
  Pencil,
  Plus,
  Settings2,
  ShieldAlert,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  administrationApi,
  projectTeamApi,
  projectMilestonesApi,
  projectRisksApi,
  projectAssumptionsApi,
  projectIssuesApi,
  projectDependenciesApi,
} from '@/api/crm.api';
import { NumberInput } from '@/components/NumberInput';
import { InlineEditModal } from '@/components/InlineEditModal';
import { ActionItemFormModal } from '@/features/action-items/components/ActionItemFormModal';
import { ProjectFormModal } from './ProjectFormModal';
import { SimpleCrudTab } from './SimpleCrudTab';
import { MilestoneFormModal, MilestoneDraft, emptyMilestoneDraft } from './MilestoneFormModal';
import { MilestoneDetailsModal } from './MilestoneDetailsModal';
import { ProjectHealthTab } from './ProjectHealthTab';
import { ProjectProgressTab } from './ProjectProgressTab';
import { ProjectHealthDetailsSection } from './ProjectHealthDetailsSection';
import { RiskFormModal, RiskDraft, emptyRiskDraft } from './RiskFormModal';
import { AssumptionFormModal, AssumptionDraft, emptyAssumptionDraft } from './AssumptionFormModal';
import { IssueFormModal, IssueDraft, emptyIssueDraft } from './IssueFormModal';
import { DependencyFormModal, DependencyDraft, emptyDependencyDraft } from './DependencyFormModal';
import { ACTION_ITEM_STATUS_OPTIONS, LOCATION_OPTIONS, PROJECT_HEALTH_OPTIONS } from '@/constants';
import {
  ACTION_STATUS_COLORS,
  BackButton,
  Button,
  Card,
  ConfirmDialog,
  DetailHeaderCard,
  DetailTabBar,
  EmptyRow,
  FilterBar,
  FilterSelect,
  FormField,
  FormGrid,
  FormModal,
  FormSection,
  HEALTH_COLORS,
  INPUT_CLS,
  Pagination,
  PRIORITY_COLORS,
  RowActionButton,
  SearchableSelect,
  SearchBar,
  SELECT_CLS,
  SortableHeader,
  StatusBadge,
  Table,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from '@/components/ui';
import { compareForSort, getTodayISODate, SortDirection } from '@/utils';

type ProjectTab =
  | 'overview' | 'progress' | 'team'
  | 'milestones' | 'risks' | 'assumptions' | 'issues' | 'dependencies'
  | 'action-items' | 'health';

const SORTABLE_AI_FIELDS = new Set(['title', 'owner', 'priority', 'status', 'dueDate']);

const SENIORITY_OPTIONS = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal'] as const;

/** Local color maps for the child-table status enums — not shared elsewhere
 *  in the app, unlike PRIORITY_COLORS/ACTION_STATUS_COLORS which every one
 *  of these tabs' Priority columns reuses as-is. */
const RISK_STATUS_COLORS: Record<string, string> = {
  Open: 'bg-red-100 text-red-700',
  Mitigated: 'bg-blue-100 text-blue-700',
  Closed: 'bg-green-100 text-green-700',
  Accepted: 'bg-slate-100 text-slate-600',
};
const ASSUMPTION_VALIDATION_COLORS: Record<string, string> = {
  Unvalidated: 'bg-slate-100 text-slate-600',
  Validated: 'bg-green-100 text-green-700',
  Invalidated: 'bg-red-100 text-red-700',
};
const ISSUE_STATUS_COLORS: Record<string, string> = {
  Open: 'bg-red-100 text-red-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-slate-100 text-slate-600',
};
const DEPENDENCY_STATUS_COLORS: Record<string, string> = ISSUE_STATUS_COLORS;

/**
 * Project Details — modeled on OpportunityDetailsView.tsx: DetailHeaderCard +
 * DetailTabBar. Nine tabs: Overview, Overall Progress, Team, Milestones,
 * Risks, Assumptions, Issues, Dependencies, Action Items. The five child-table
 * tabs (Milestones/Risks/Assumptions/Issues/Dependencies) share the
 * <SimpleCrudTab> table/pagination-less/delete-confirm shell; each has its own
 * small form modal since fields differ per entity.
 */
export const ProjectDetailsView: React.FC = () => {
  const {
    projects,
    accounts,
    stakeholders,
    actionItems,
    comments,
    selectedProjectId,
    setView,
    setSelectedAccountId,
    setSelectedOpportunityId,
    updateProject,
    refreshProject,
    deleteProject,
    actionItemColumns,
    actionItemsColumnConfig,
    addActionItem,
    updateActionItem,
    deleteActionItem,
    addComment,
    deleteComment,
    opportunities,
    cameFromDashboard,
    navSource,
    can,
  } = useCRM();

  // Single RBAC gate for every delete surface on this page — the project itself
  // and its child records (team, milestones, risks, assumptions, issues,
  // dependencies), all of which the backend guards with `projects:delete`.
  const canDeleteProject = can('projects', 'delete');

  const project = projects.find((p) => p.id === selectedProjectId);
  const account = project ? accounts.find((a) => a.id === project.accountId) : null;

  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [openHealthModalTrigger, setOpenHealthModalTrigger] = useState(0);

  // Users list (Administration) backs the Service Provider PM / Practice Lead
  // selects — not fetched in useCRMData today, so this view fetches it
  // directly, same as PerformanceEvaluationView does for its own employee
  // lookups.
  const [users, setUsers] = useState<AdminUser[]>([]);
  useEffect(() => {
    administrationApi.getUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  // ── Edit Project modal ──────────────────────────────────────────────────────
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState(project ?? null);
  const openProjectEdit = () => {
    if (!project) return;
    setProjectDraft({ ...project });
    setIsEditModalOpen(true);
  };
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectDraft || !projectDraft.name.trim()) return;
    await updateProject(projectDraft);
    setIsEditModalOpen(false);
    setProjectDraft(null);
  };

  // Header overflow menu (deactivate)
  const [showMenu, setShowMenu] = useState(false);
  const [deleteProjectTarget, setDeleteProjectTarget] = useState(false);

  // ── Team tab: backend-wired CRUD (project_team_members, migration 042) ─────
  const [team, setTeam] = useState<ProjectTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const loadTeam = () => {
    if (!project) return;
    setTeamLoading(true);
    projectTeamApi.getAll(project.id).then(setTeam).catch(() => setTeam([])).finally(() => setTeamLoading(false));
  };
  useEffect(loadTeam, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const emptyTeamDraft = { role: '', employeeName: '', seniorityLevel: '', location: '' };
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingTeamMember, setEditingTeamMember] = useState<ProjectTeamMember | null>(null);
  const [teamDraft, setTeamDraft] = useState(emptyTeamDraft);
  const [teamDeleteTarget, setTeamDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [isSavingTeamMember, setIsSavingTeamMember] = useState(false);

  const openAddTeamMember = () => {
    setEditingTeamMember(null);
    setTeamDraft(emptyTeamDraft);
    setIsTeamModalOpen(true);
  };
  const openEditTeamMember = (m: ProjectTeamMember) => {
    setEditingTeamMember(m);
    setTeamDraft({ role: m.role, employeeName: m.employeeName, seniorityLevel: m.seniorityLevel ?? '', location: m.location ?? '' });
    setIsTeamModalOpen(true);
  };
  const handleSaveTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !teamDraft.role.trim() || !teamDraft.employeeName.trim()) return;
    setIsSavingTeamMember(true);
    try {
      if (editingTeamMember) {
        await projectTeamApi.update(project.id, editingTeamMember.id, teamDraft);
      } else {
        await projectTeamApi.create(project.id, teamDraft);
      }
      setIsTeamModalOpen(false);
      setEditingTeamMember(null);
      setTeamDraft(emptyTeamDraft);
      loadTeam();
    } finally {
      setIsSavingTeamMember(false);
    }
  };
  const handleDeleteTeamMember = async () => {
    if (!project || !teamDeleteTarget) return;
    await projectTeamApi.delete(project.id, teamDeleteTarget.id);
    setTeamDeleteTarget(null);
    loadTeam();
  };

  // ── Milestones tab: backend-wired CRUD ──────────────────────────────────────
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const loadMilestones = () => {
    if (!project) return;
    setMilestonesLoading(true);
    projectMilestonesApi.getAllForProject(project.id).then(setMilestones).catch(() => setMilestones([])).finally(() => setMilestonesLoading(false));
  };
  useEffect(loadMilestones, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [milestoneDraft, setMilestoneDraft] = useState<MilestoneDraft>(emptyMilestoneDraft);
  const [isSavingMilestone, setIsSavingMilestone] = useState(false);

  // Read-only detail view opened by selecting a milestone row. Editing is
  // delegated back to the form modal (edit mode) via openEditMilestone.
  const [viewingMilestone, setViewingMilestone] = useState<ProjectMilestone | null>(null);

  const openAddMilestone = () => {
    setEditingMilestone(null);
    setMilestoneDraft(emptyMilestoneDraft);
    setIsMilestoneModalOpen(true);
  };
  const openMilestoneDetails = (m: ProjectMilestone) => {
    setViewingMilestone(m);
  };
  const openEditMilestone = (m: ProjectMilestone) => {
    setViewingMilestone(null);
    setEditingMilestone(m);
    setMilestoneDraft({ ...m });
    setIsMilestoneModalOpen(true);
  };
  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !milestoneDraft.name.trim()) return;
    setIsSavingMilestone(true);
    try {
      if (editingMilestone) {
        await projectMilestonesApi.update(project.id, editingMilestone.id, milestoneDraft);
      } else {
        await projectMilestonesApi.create(project.id, milestoneDraft);
      }
      setIsMilestoneModalOpen(false);
      setEditingMilestone(null);
      setMilestoneDraft(emptyMilestoneDraft);
      loadMilestones();
    } finally {
      setIsSavingMilestone(false);
    }
  };
  const handleDeleteMilestone = async (m: ProjectMilestone) => {
    if (!project) return;
    await projectMilestonesApi.delete(project.id, m.id);
    loadMilestones();
  };

  // ── Risks tab: backend-wired CRUD ───────────────────────────────────────────
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [risksLoading, setRisksLoading] = useState(false);
  const loadRisks = () => {
    if (!project) return;
    setRisksLoading(true);
    projectRisksApi.getAllForProject(project.id).then(setRisks).catch(() => setRisks([])).finally(() => setRisksLoading(false));
  };
  useEffect(loadRisks, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<ProjectRisk | null>(null);
  const [riskDraft, setRiskDraft] = useState<RiskDraft>(emptyRiskDraft);
  const [isSavingRisk, setIsSavingRisk] = useState(false);

  const openAddRisk = () => {
    setEditingRisk(null);
    setRiskDraft(emptyRiskDraft);
    setIsRiskModalOpen(true);
  };
  const openEditRisk = (r: ProjectRisk) => {
    setEditingRisk(r);
    setRiskDraft({ ...r });
    setIsRiskModalOpen(true);
  };
  const handleSaveRisk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !riskDraft.description.trim()) return;
    setIsSavingRisk(true);
    try {
      if (editingRisk) {
        await projectRisksApi.update(project.id, editingRisk.id, riskDraft);
      } else {
        await projectRisksApi.create(project.id, riskDraft);
      }
      setIsRiskModalOpen(false);
      setEditingRisk(null);
      setRiskDraft(emptyRiskDraft);
      loadRisks();
    } finally {
      setIsSavingRisk(false);
    }
  };
  const handleDeleteRisk = async (r: ProjectRisk) => {
    if (!project) return;
    await projectRisksApi.delete(project.id, r.id);
    loadRisks();
  };

  // ── Assumptions tab: backend-wired CRUD ─────────────────────────────────────
  const [assumptions, setAssumptions] = useState<ProjectAssumption[]>([]);
  const [assumptionsLoading, setAssumptionsLoading] = useState(false);
  const loadAssumptions = () => {
    if (!project) return;
    setAssumptionsLoading(true);
    projectAssumptionsApi.getAllForProject(project.id).then(setAssumptions).catch(() => setAssumptions([])).finally(() => setAssumptionsLoading(false));
  };
  useEffect(loadAssumptions, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isAssumptionModalOpen, setIsAssumptionModalOpen] = useState(false);
  const [editingAssumption, setEditingAssumption] = useState<ProjectAssumption | null>(null);
  const [assumptionDraft, setAssumptionDraft] = useState<AssumptionDraft>(emptyAssumptionDraft);
  const [isSavingAssumption, setIsSavingAssumption] = useState(false);

  const openAddAssumption = () => {
    setEditingAssumption(null);
    setAssumptionDraft(emptyAssumptionDraft);
    setIsAssumptionModalOpen(true);
  };
  const openEditAssumption = (a: ProjectAssumption) => {
    setEditingAssumption(a);
    setAssumptionDraft({ ...a });
    setIsAssumptionModalOpen(true);
  };
  const handleSaveAssumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !assumptionDraft.description.trim()) return;
    setIsSavingAssumption(true);
    try {
      if (editingAssumption) {
        await projectAssumptionsApi.update(project.id, editingAssumption.id, assumptionDraft);
      } else {
        await projectAssumptionsApi.create(project.id, assumptionDraft);
      }
      setIsAssumptionModalOpen(false);
      setEditingAssumption(null);
      setAssumptionDraft(emptyAssumptionDraft);
      loadAssumptions();
    } finally {
      setIsSavingAssumption(false);
    }
  };
  const handleDeleteAssumption = async (a: ProjectAssumption) => {
    if (!project) return;
    await projectAssumptionsApi.delete(project.id, a.id);
    loadAssumptions();
  };

  // ── Issues tab: backend-wired CRUD ──────────────────────────────────────────
  const [issues, setIssues] = useState<ProjectIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const loadIssues = () => {
    if (!project) return;
    setIssuesLoading(true);
    projectIssuesApi.getAllForProject(project.id).then(setIssues).catch(() => setIssues([])).finally(() => setIssuesLoading(false));
  };
  useEffect(loadIssues, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<ProjectIssue | null>(null);
  const [issueDraft, setIssueDraft] = useState<IssueDraft>(emptyIssueDraft);
  const [isSavingIssue, setIsSavingIssue] = useState(false);

  const openAddIssue = () => {
    setEditingIssue(null);
    setIssueDraft(emptyIssueDraft);
    setIsIssueModalOpen(true);
  };
  const openEditIssue = (i: ProjectIssue) => {
    setEditingIssue(i);
    setIssueDraft({ ...i });
    setIsIssueModalOpen(true);
  };
  const handleSaveIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !issueDraft.description.trim()) return;
    setIsSavingIssue(true);
    try {
      if (editingIssue) {
        await projectIssuesApi.update(project.id, editingIssue.id, issueDraft);
      } else {
        await projectIssuesApi.create(project.id, issueDraft);
      }
      setIsIssueModalOpen(false);
      setEditingIssue(null);
      setIssueDraft(emptyIssueDraft);
      loadIssues();
    } finally {
      setIsSavingIssue(false);
    }
  };
  const handleDeleteIssue = async (i: ProjectIssue) => {
    if (!project) return;
    await projectIssuesApi.delete(project.id, i.id);
    loadIssues();
  };

  // ── Dependencies tab: backend-wired CRUD ────────────────────────────────────
  const [dependencies, setDependencies] = useState<ProjectDependency[]>([]);
  const [dependenciesLoading, setDependenciesLoading] = useState(false);
  const loadDependencies = () => {
    if (!project) return;
    setDependenciesLoading(true);
    projectDependenciesApi.getAllForProject(project.id).then(setDependencies).catch(() => setDependencies([])).finally(() => setDependenciesLoading(false));
  };
  useEffect(loadDependencies, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [isDependencyModalOpen, setIsDependencyModalOpen] = useState(false);
  const [editingDependency, setEditingDependency] = useState<ProjectDependency | null>(null);
  const [dependencyDraft, setDependencyDraft] = useState<DependencyDraft>(emptyDependencyDraft);
  const [isSavingDependency, setIsSavingDependency] = useState(false);

  const openAddDependency = () => {
    setEditingDependency(null);
    setDependencyDraft(emptyDependencyDraft);
    setIsDependencyModalOpen(true);
  };
  const openEditDependency = (d: ProjectDependency) => {
    setEditingDependency(d);
    setDependencyDraft({ ...d });
    setIsDependencyModalOpen(true);
  };
  const handleSaveDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !dependencyDraft.description.trim()) return;
    setIsSavingDependency(true);
    try {
      if (editingDependency) {
        await projectDependenciesApi.update(project.id, editingDependency.id, dependencyDraft);
      } else {
        await projectDependenciesApi.create(project.id, dependencyDraft);
      }
      setIsDependencyModalOpen(false);
      setEditingDependency(null);
      setDependencyDraft(emptyDependencyDraft);
      loadDependencies();
    } finally {
      setIsSavingDependency(false);
    }
  };
  const handleDeleteDependency = async (d: ProjectDependency) => {
    if (!project) return;
    await projectDependenciesApi.delete(project.id, d.id);
    loadDependencies();
  };

  // ── Action Items tab state (mirrors OpportunityDetailsView's) ──────────────
  const [aiSearch, setAiSearch] = useState('');
  const [aiStatusFilter, setAiStatusFilter] = useState('all');
  const [aiPriorityFilter, setAiPriorityFilter] = useState('all');
  const [aiSortField, setAiSortField] = useState<string | null>(null);
  const [aiSortDirection, setAiSortDirection] = useState<SortDirection>('asc');
  const [aiPage, setAiPage] = useState(1);
  const [aiPageSize, setAiPageSize] = useState(10);
  const [selectedActionItemId, setSelectedActionItemId] = useState<string | null>(null);

  const handleAiSort = (field: string) => {
    if (aiSortField === field) setAiSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setAiSortField(field); setAiSortDirection('asc'); }
  };

  const [isEditAiModalOpen, setIsEditAiModalOpen] = useState(false);
  const [editingAi, setEditingAi] = useState<ActionItem | null>(null);
  const handleEditAiClick = (item: ActionItem) => {
    setEditingAi({ ...item });
    setIsEditAiModalOpen(true);
  };
  const handleUpdateAi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAi || !editingAi.title.trim()) return;
    updateActionItem(editingAi);
    setIsEditAiModalOpen(false);
    setEditingAi(null);
  };

  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const emptyTask: Omit<ActionItem, 'id'> = {
    title: '',
    accountId: '',
    opportunityId: '',
    projectId: '',
    ownerStakeholderId: '',
    openDate: getTodayISODate(),
    dueDate: '',
    priority: 'Medium' as PriorityLevel,
    status: 'To Do' as ActionItemStatus,
    notes: '',
    risksAndDependencies: '',
  };
  const [newAi, setNewAi] = useState<Omit<ActionItem, 'id'>>(emptyTask);
  const handleOpenAddTask = () => {
    if (!project) return;
    setNewAi({ ...emptyTask, accountId: project.accountId, projectId: project.id });
    setIsAddTaskOpen(true);
  };
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAi.title.trim() || !newAi.ownerStakeholderId || !project) return;
    await addActionItem({ ...newAi, accountId: project.accountId, projectId: project.id });
    setIsAddTaskOpen(false);
    setNewAi({ ...emptyTask, accountId: project.accountId, projectId: project.id });
  };

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'actionItem' | 'comment' | 'risk' | 'dependency'; id: string; label: string } | null>(null);

  const goBack = () => setView('projects');

  if (!project || !account) {
    return (
      <Card padding="none">
        <div className="p-8 text-center">
          <p className="text-slate-400 font-medium">No project selected.</p>
          <button
            onClick={goBack}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Back
          </button>
        </div>
      </Card>
    );
  }

  const projectActions = actionItems.filter((ai) => ai.projectId === project.id);

  const formatCur = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const displayedActionCols = useMemo(() => {
    return actionItemsColumnConfig.filter((col) => col.isDisplayed && col.key !== 'opportunityId' && col.key !== 'projectId');
  }, [actionItemsColumnConfig]);
  const extraActionColCount = displayedActionCols.filter((col) => !col.isStandard).length;
  const filteredActions = projectActions.filter((item) => {
    const q = aiSearch.trim().toLowerCase();
    const matchesSearch = !q
      || item.title.toLowerCase().includes(q)
      || (item.ownerName || item.owner || '').toLowerCase().includes(q)
      || (item.notes ?? '').toLowerCase().includes(q);
    const matchesStatus = aiStatusFilter === 'all' || item.status === aiStatusFilter;
    const matchesPriority = aiPriorityFilter === 'all' || item.priority === aiPriorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });
  const getAiSortValue = (item: ActionItem, key: string) =>
    key === 'owner' ? (item.ownerName || item.owner || '') : (item as any)[key];
  const sortedActions = aiSortField
    ? [...filteredActions].sort((a, b) => compareForSort(getAiSortValue(a, aiSortField), getAiSortValue(b, aiSortField), aiSortDirection))
    : filteredActions;
  const totalActions = sortedActions.length;
  const pagedActions = sortedActions.slice((aiPage - 1) * aiPageSize, aiPage * aiPageSize);

  const lockedAccount = { id: project.accountId, name: account.name };
  const lockedProject = { id: project.id, name: project.name };

  return (
    <div className="space-y-6">
      {cameFromDashboard && <BackButton label="Back to Dashboard" onClick={() => setView('dashboard')} />}
      {navSource && (
        <BackButton
          label={navSource === 'notifications' ? 'Back to Notifications' : 'Back to Audit Log'}
          onClick={() => setView(navSource === 'notifications' ? 'notifications' : 'audit-log')}
        />
      )}

      <DetailHeaderCard
        onBack={!navSource ? goBack : undefined}
        backTitle="Back to Projects"
        avatarContent={<FolderKanban className="w-6 h-6" aria-hidden="true" />}
        avatarColorClass="bg-indigo-50 text-indigo-600"
        title={project.name}
        badges={
          <>
            <StatusBadge value={project.health} colorMap={HEALTH_COLORS} />
            <StatusBadge value={project.status} colorMap={{ Active: 'bg-blue-100 text-blue-700', 'On Hold': 'bg-amber-100 text-amber-700', Completed: 'bg-green-100 text-green-700', Cancelled: 'bg-slate-200 text-slate-600' }} />
          </>
        }
        actions={
          <>
            <Button variant="primary" icon={<Edit2 className="w-3.5 h-3.5" aria-hidden="true" />} onClick={openProjectEdit}>
              Edit Project
            </Button>
            {/* Deactivate is the only entry in this menu, so the whole overflow
                button is hidden when the user cannot delete projects. */}
            {canDeleteProject && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu((v) => !v)}
                  className="p-2.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                      <button
                        onClick={() => { setShowMenu(false); setDeleteProjectTarget(true); }}
                        className="w-full text-left px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                      >
                        Deactivate Project
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        }
        attributes={[
          {
            icon: <Briefcase className="w-4 h-4" />,
            label: 'Account',
            value: (
              <button
                type="button"
                onClick={() => { setSelectedAccountId(project.accountId); setView('account-details'); }}
                title={`View account ${account.name}`}
                className="text-blue-600 hover:underline font-bold cursor-pointer truncate max-w-full text-left"
              >
                {account.name}
              </button>
            ),
          },
          { icon: <Users className="w-4 h-4" />, label: 'Client Partner Name', value: project.clientPartnerName || 'Not assigned' },
          { icon: <DollarSign className="w-4 h-4" />, label: 'Deal Value', mono: true, value: formatCur(project.dealValue ?? 0) },
          { icon: <Settings2 className="w-4 h-4" />, label: 'Methodology', value: project.methodology },
          {
            icon: <Calendar className="w-4 h-4" />,
            label: 'Timeline',
            mono: true,
            value: `${project.startDate || 'N/A'} → ${project.endDate || 'N/A'}`,
          },
        ]}
        attributesClassName="grid-cols-2 lg:grid-cols-5"
      />

      <DetailTabBar
        tabs={[
          { id: 'overview', label: 'Overview', icon: Briefcase, count: null },
          { id: 'progress', label: 'Overall Progress', icon: Gauge, count: null },
          { id: 'team', label: 'Team', icon: Users, count: team.length > 0 ? team.length : null },
          { id: 'milestones', label: 'Milestones', icon: Flag, count: milestones.length > 0 ? milestones.length : null },
          { id: 'risks', label: 'Risks', icon: ShieldAlert, count: risks.length > 0 ? risks.length : null },
          { id: 'assumptions', label: 'Assumptions', icon: HelpCircle, count: assumptions.length > 0 ? assumptions.length : null },
          { id: 'issues', label: 'Issues', icon: AlertOctagon, count: issues.length > 0 ? issues.length : null },
          { id: 'dependencies', label: 'Dependencies', icon: Link2, count: dependencies.length > 0 ? dependencies.length : null },
          { id: 'action-items', label: 'Action Items', icon: CheckSquare, count: projectActions.length },
          { id: 'health', label: 'Health Tracker', icon: Gauge, count: null },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as ProjectTab)}
      />

      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
          <Card title="Project Details" bodyClassName="space-y-6">
            <FormSection title="Linked Opportunity">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3.5">
                <div className="min-w-0">
                  <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Originating Opportunity</span>
                  <p className="text-sm text-slate-800 font-semibold truncate">{project.opportunityName || 'Unknown'}</p>
                </div>
                <Button
                  variant="secondary"
                  className="shrink-0"
                  icon={<TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />}
                  onClick={() => { setSelectedOpportunityId(project.opportunityId); setView('opportunity-details'); }}
                >
                  Open Opportunity
                </Button>
              </div>
            </FormSection>

            <FormSection title="Assignments">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  { label: 'Service Provider Project Manager', name: project.serviceProviderPmName },
                  { label: 'Practice Lead', name: project.practiceLeadName },
                  { label: 'Client Partner Name', name: project.clientPartnerName },
                  { label: 'Client Project Manager', name: project.clientPmName },
                ]).map((row) => (
                  <div key={row.label} className="rounded-lg border border-slate-100 p-3.5">
                    <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">{row.label}</span>
                    {row.name ? (
                        <p className="text-sm text-slate-800 font-semibold">{row.name}</p>
                    ) : (
                      <p className="text-sm text-slate-400 font-medium italic">Not assigned</p>
                    )}
                  </div>
                ))}
              </div>
            </FormSection>

            <FormSection title="Timeline & Methodology">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Start Date</span>
                  <span className="text-sm text-slate-800 font-mono font-semibold">{project.startDate || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">End Date</span>
                  <span className="text-sm text-slate-800 font-mono font-semibold">{project.endDate || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1">Methodology</span>
                  <span className="text-sm text-slate-800 font-semibold">{project.methodology}</span>
                </div>
              </div>
            </FormSection>

            <FormSection title="Business Information">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-slate-100 p-3.5">
                  <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Priority</span>
                  {project.priority ? (
                    <StatusBadge value={project.priority} colorMap={PRIORITY_COLORS} />
                  ) : (
                    <p className="text-sm text-slate-400 font-medium italic">Not set</p>
                  )}
                </div>
                <div className="rounded-lg border border-slate-100 p-3.5">
                  <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Delivery Model</span>
                  <p className="text-sm text-slate-800 font-semibold">{project.deliveryModel || <span className="text-slate-400 font-medium italic">Not set</span>}</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3.5">
                  <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Billing Model</span>
                  <p className="text-sm text-slate-800 font-semibold">{project.billingModel || <span className="text-slate-400 font-medium italic">Not set</span>}</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3.5">
                  <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Tower</span>
                  <p className="text-sm text-slate-800 font-semibold">{project.tower || <span className="text-slate-400 font-medium italic">Not set</span>}</p>
                </div>
                <div className="rounded-lg border border-slate-100 p-3.5">
                  <span className="text-label font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Service Line</span>
                  <p className="text-sm text-slate-800 font-semibold">{project.serviceLine || <span className="text-slate-400 font-medium italic">Not set</span>}</p>
                </div>
              </div>
            </FormSection>

            {/* Health status fields, straight from the latest Health Tracker
                entry — the standalone health card no longer sits on Overview. */}
            <ProjectHealthDetailsSection
              projectId={project.id}
              fallbackHealth={project.health}
            />

            <FormSection title="Project Description">
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                {project.description || <span className="text-slate-400 font-medium italic">No description provided.</span>}
              </p>
            </FormSection>
          </Card>
          </>
        )}

        {activeTab === 'progress' && (
          <ProjectProgressTab
            projectId={project.id}
            onProjectUpdated={() => refreshProject(project.id)}
          />
        )}

        {activeTab === 'team' && (
          <Card
            padding="none"
            clip
            title={
              <span className="inline-flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
                <span className="text-sm font-bold text-slate-800 tracking-tight truncate">Team Members ({team.length})</span>
              </span>
            }
            actions={
              <Button icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />} onClick={openAddTeamMember}>
                Add Team Member
              </Button>
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableHeadCell>Role</TableHeadCell>
                  <TableHeadCell>Employee Name</TableHeadCell>
                  <TableHeadCell>Seniority Level</TableHeadCell>
                  <TableHeadCell>Location</TableHeadCell>
                  <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
                </TableHead>
                <tbody>
                  {teamLoading ? (
                    <EmptyRow colSpan={5} message="Loading team members…" />
                  ) : team.length === 0 ? (
                    <EmptyRow colSpan={5} message='No team members yet. Click "Add Team Member" to assign one.' />
                  ) : (
                    team.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-semibold text-slate-800">{m.role}</TableCell>
                        <TableCell className="text-slate-600 font-semibold">{m.employeeName || '—'}</TableCell>
                        <TableCell className="text-slate-600">{m.seniorityLevel || '—'}</TableCell>
                        <TableCell className="text-slate-600">{m.location || '—'}</TableCell>
                        <TableCell align="center" sticky="right">
                          <div className="flex items-center justify-center gap-1.5">
                            <RowActionButton
                              intent="edit"
                              label={`Edit team member ${m.role}`}
                              icon={<Pencil className="w-3.5 h-3.5" />}
                              onClick={() => openEditTeamMember(m)}
                            />
                            {canDeleteProject && (
                              <RowActionButton
                                intent="delete"
                                label={`Remove team member ${m.role}`}
                                icon={<Trash2 className="w-3.5 h-3.5" />}
                                onClick={() => setTeamDeleteTarget({ id: m.id, label: `${m.role} — ${m.employeeName || 'Unknown'}` })}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        )}

        {activeTab === 'milestones' && (
          <SimpleCrudTab<ProjectMilestone>
            icon={<Flag className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />}
            title="Milestones"
            entityLabel="Milestone"
            rows={milestones}
            loading={milestonesLoading}
            emptyMessage='No milestones yet. Click "Add Milestone" to create one.'
            onAddClick={openAddMilestone}
            onEditClick={openEditMilestone}
            onRowClick={openMilestoneDetails}
            onViewClick={openMilestoneDetails}
            getRowLabel={(m) => m.name}
            onDelete={canDeleteProject ? handleDeleteMilestone : undefined}
            columns={[
              { key: 'milestoneNo', label: 'Milestone No.', render: (m) => <span className="font-mono text-slate-500">{m.milestoneNo || '—'}</span> },
              { key: 'name', label: 'Milestone Name', render: (m) => <span className="font-semibold text-slate-800">{m.name}</span> },
              { key: 'activities', label: 'Activities', render: (m) => <span className="block max-w-[240px] line-clamp-2 text-slate-600" title={m.activities || ''}>{m.activities || '—'}</span> },
              { key: 'deliverables', label: 'Deliverables', render: (m) => <span className="block max-w-[240px] line-clamp-2 text-slate-600" title={m.deliverables || ''}>{m.deliverables || '—'}</span> },
              { key: 'acceptanceCriteria', label: 'Acceptance Criteria', render: (m) => <span className="block max-w-[240px] line-clamp-2 text-slate-600" title={m.acceptanceCriteria || ''}>{m.acceptanceCriteria || '—'}</span> },
              { key: 'paymentTrigger', label: 'Payment Trigger', render: (m) => <span className="text-slate-600">{m.paymentTrigger || '—'}</span> },
              { key: 'paymentPct', label: 'Payment %', align: 'right', render: (m) => <span className="font-mono text-slate-600">{m.paymentPct ? `${m.paymentPct}%` : '—'}</span> },
              { key: 'paymentAmount', label: 'Payment Amount', align: 'right', render: (m) => <span className="font-mono text-slate-600">{m.paymentAmount ? `$${m.paymentAmount.toLocaleString()}` : '—'}</span> },
              { key: 'targetDate', label: 'Target Date', render: (m) => <span className="font-mono text-slate-500">{m.targetDate || '—'}</span> },
            ]}
          />
        )}

        {activeTab === 'risks' && (
          <SimpleCrudTab<ProjectRisk>
            icon={<ShieldAlert className="w-5 h-5 text-red-600 shrink-0" aria-hidden="true" />}
            title="Risks"
            entityLabel="Risk"
            rows={risks}
            loading={risksLoading}
            emptyMessage='No risks yet. Click "Add Risk" to log one.'
            onAddClick={openAddRisk}
            onEditClick={openEditRisk}
            getRowLabel={(r) => r.description.substring(0, 40)}
            onDelete={canDeleteProject ? handleDeleteRisk : undefined}
            columns={[
              { key: 'rag', label: 'RAG', render: (r) => r.rag ? <StatusBadge value={r.rag} colorMap={HEALTH_COLORS} shape="rounded" /> : <span className="text-slate-400 font-medium italic">—</span> },
              { key: 'description', label: 'Description', render: (r) => <span className="block max-w-[240px] line-clamp-2 font-semibold text-slate-800" title={r.description}>{r.description}</span> },
              { key: 'classification', label: 'Classification', render: (r) => <span className="text-slate-600 font-semibold">{r.classification || '—'}</span> },
              { key: 'priority', label: 'Priority', render: (r) => <StatusBadge value={r.priority} colorMap={PRIORITY_COLORS} shape="rounded" /> },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} colorMap={RISK_STATUS_COLORS} shape="rounded" /> },
              { key: 'impactDescription', label: 'Impact Description', render: (r) => <span className="block max-w-[200px] line-clamp-2 text-slate-600" title={r.impactDescription || ''}>{r.impactDescription || '—'}</span> },
              { key: 'contingencyPlan', label: 'Contingency Plan', render: (r) => <span className="block max-w-[200px] line-clamp-2 text-slate-600" title={r.contingencyPlan || ''}>{r.contingencyPlan || '—'}</span> },
              { key: 'owner', label: 'Owner', render: (r) => <span className="text-slate-600 font-semibold">{r.ownerName || '—'}</span> },
              { key: 'riskOpenDate', label: 'Risk Open Date', render: (r) => <span className="font-mono text-slate-500">{r.riskOpenDate || '—'}</span> },
              { key: 'targetResolutionDate', label: 'Target Resolution', render: (r) => <span className="font-mono text-slate-500">{r.targetResolutionDate || '—'}</span> },
            ]}
          />
        )}

        {activeTab === 'assumptions' && (
          <SimpleCrudTab<ProjectAssumption>
            icon={<HelpCircle className="w-5 h-5 text-purple-600 shrink-0" aria-hidden="true" />}
            title="Assumptions"
            entityLabel="Assumption"
            rows={assumptions}
            loading={assumptionsLoading}
            emptyMessage='No assumptions yet. Click "Add Assumption" to log one.'
            onAddClick={openAddAssumption}
            onEditClick={openEditAssumption}
            getRowLabel={(a) => a.description.substring(0, 40)}
            onDelete={canDeleteProject ? handleDeleteAssumption : undefined}
            columns={[
              { key: 'description', label: 'Description', render: (a) => <span className="block max-w-[320px] line-clamp-2 font-semibold text-slate-800" title={a.description}>{a.description}</span> },
              { key: 'priority', label: 'Priority', render: (a) => <StatusBadge value={a.priority} colorMap={PRIORITY_COLORS} shape="rounded" /> },
              { key: 'validationStatus', label: 'Validation Status', render: (a) => <StatusBadge value={a.validationStatus} colorMap={ASSUMPTION_VALIDATION_COLORS} shape="rounded" /> },
              { key: 'owner', label: 'Owner', render: (a) => <span className="text-slate-600 font-semibold">{a.ownerName || '—'}</span> },
              { key: 'targetValidationDate', label: 'Target Validation', render: (a) => <span className="font-mono text-slate-500">{a.targetValidationDate || '—'}</span> },
            ]}
          />
        )}

        {activeTab === 'issues' && (
          <SimpleCrudTab<ProjectIssue>
            icon={<AlertOctagon className="w-5 h-5 text-amber-600 shrink-0" aria-hidden="true" />}
            title="Issues"
            entityLabel="Issue"
            rows={issues}
            loading={issuesLoading}
            emptyMessage='No issues yet. Click "Add Issue" to log one.'
            onAddClick={openAddIssue}
            onEditClick={openEditIssue}
            getRowLabel={(i) => i.description.substring(0, 40)}
            onDelete={canDeleteProject ? handleDeleteIssue : undefined}
            columns={[
              { key: 'description', label: 'Description', render: (i) => <span className="block max-w-[320px] line-clamp-2 font-semibold text-slate-800" title={i.description}>{i.description}</span> },
              { key: 'priority', label: 'Priority', render: (i) => <StatusBadge value={i.priority} colorMap={PRIORITY_COLORS} shape="rounded" /> },
              { key: 'status', label: 'Status', render: (i) => <StatusBadge value={i.status} colorMap={ISSUE_STATUS_COLORS} shape="rounded" /> },
              { key: 'owner', label: 'Owner', render: (i) => <span className="text-slate-600 font-semibold">{i.ownerName || '—'}</span> },
              { key: 'targetResolutionDate', label: 'Target Resolution', render: (i) => <span className="font-mono text-slate-500">{i.targetResolutionDate || '—'}</span> },
            ]}
          />
        )}

        {activeTab === 'dependencies' && (
          <SimpleCrudTab<ProjectDependency>
            icon={<Link2 className="w-5 h-5 text-teal-600 shrink-0" aria-hidden="true" />}
            title="Dependencies"
            entityLabel="Dependency"
            rows={dependencies}
            loading={dependenciesLoading}
            emptyMessage='No dependencies yet. Click "Add Dependency" to log one.'
            onAddClick={openAddDependency}
            onEditClick={openEditDependency}
            getRowLabel={(d) => d.description.substring(0, 40)}
            onDelete={canDeleteProject ? handleDeleteDependency : undefined}
            columns={[
              { key: 'description', label: 'Description', render: (d) => <span className="block max-w-[280px] line-clamp-2 font-semibold text-slate-800" title={d.description}>{d.description}</span> },
              { key: 'priority', label: 'Priority', render: (d) => <StatusBadge value={d.priority} colorMap={PRIORITY_COLORS} shape="rounded" /> },
              { key: 'status', label: 'Status', render: (d) => <StatusBadge value={d.status} colorMap={DEPENDENCY_STATUS_COLORS} shape="rounded" /> },
              { key: 'dependencyType', label: 'Type', render: (d) => <span className="text-slate-600">{d.dependencyType || '—'}</span> },
              { key: 'owner', label: 'Owner', render: (d) => <span className="text-slate-600 font-semibold">{d.ownerName || '—'}</span> },
              { key: 'targetResolutionDate', label: 'Target Resolution', render: (d) => <span className="font-mono text-slate-500">{d.targetResolutionDate || '—'}</span> },
            ]}
          />
        )}

        {activeTab === 'action-items' && (
          <div className="space-y-4">
            <FilterBar>
              <SearchBar
                value={aiSearch}
                onChange={(v) => { setAiSearch(v); setAiPage(1); }}
                placeholder="Search action items by title, owner, or notes..."
              />
              <FilterSelect
                label="Status"
                value={aiStatusFilter}
                onChange={(v) => { setAiStatusFilter(v); setAiPage(1); }}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  ...ACTION_ITEM_STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
                ]}
              />
              <FilterSelect
                label="Priority"
                value={aiPriorityFilter}
                onChange={(v) => { setAiPriorityFilter(v); setAiPage(1); }}
                options={[
                  { value: 'all', label: 'All Priorities' },
                  { value: 'High', label: 'High' },
                  { value: 'Medium', label: 'Medium' },
                  { value: 'Low', label: 'Low' },
                ]}
              />
            </FilterBar>

            <Card
              padding="none"
              clip
              title={
                <span className="inline-flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
                  <span className="text-sm font-bold text-slate-800 tracking-tight truncate">
                    Action Items ({projectActions.length})
                  </span>
                </span>
              }
              actions={
                <Button icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />} onClick={handleOpenAddTask}>
                  Add Task
                </Button>
              }
            >
              <div className="overflow-x-auto">
                <Table extraColumns={extraActionColCount} resizable storageKey="project-details:action-items">
                  <TableHead>
                    {displayedActionCols.map((col) => (
                      <TableHeadCell key={col.key} columnId={col.key} className={col.key === 'title' ? 'px-5' : ''}>
                        {SORTABLE_AI_FIELDS.has(col.key) ? (
                          <SortableHeader
                            label={col.name}
                            field={col.key}
                            sortField={aiSortField}
                            sortDirection={aiSortDirection}
                            onSort={handleAiSort}
                          />
                        ) : (
                          col.name
                        )}
                      </TableHeadCell>
                    ))}
                    <TableHeadCell align="center" sticky="right">Actions</TableHeadCell>
                  </TableHead>
                  <tbody>
                    {pagedActions.length === 0 ? (
                      <EmptyRow
                        colSpan={displayedActionCols.length + 1}
                        message={projectActions.length === 0
                          ? 'No action items linked to this project. Click "Add Task" to create one.'
                          : 'No action items match your search or filters.'}
                      />
                    ) : (
                      pagedActions.map((item) => {
                        const itemComments = comments.filter((c) => c.targetType === 'actionItem' && c.targetId === item.id);
                        return (
                          <TableRow key={item.id} className="hover:bg-slate-50/50">
                            {displayedActionCols.map((col) => {
                              if (col.key === 'title') {
                                return (
                                  <TableCell key={col.key}>
                                    <div className="flex items-center flex-wrap gap-2">
                                      <div className="flex-1 min-w-0">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedActionItemId(item.id)}
                                          className="font-extrabold text-slate-900 text-sm hover:text-blue-600 cursor-pointer text-left transition-colors truncate block max-w-full"
                                        >
                                          {item.title}
                                        </button>
                                      </div>
                                    </div>
                                  </TableCell>
                                );
                              }
                              if (col.key === 'notes') {
                                return (
                                  <TableCell key={col.key} className="text-slate-600 font-medium">
                                    <span className="block max-w-[280px] line-clamp-2" title={item.notes || undefined}>
                                      {item.notes || '—'}
                                    </span>
                                  </TableCell>
                                );
                              }
                              if (col.key === 'accountId') {
                                return (
                                  <TableCell key={col.key} className="text-slate-600 font-bold">
                                    {account ? account.name : 'Unknown Account'}
                                  </TableCell>
                                );
                              }
                              if (col.key === 'owner') {
                                return (
                                  <TableCell key={col.key} className="text-slate-600 font-semibold">
                                    {item.ownerName || item.owner || '—'}
                                  </TableCell>
                                );
                              }
                              if (col.key === 'priority') {
                                return (
                                  <TableCell key={col.key}>
                                    <StatusBadge value={item.priority} colorMap={PRIORITY_COLORS} shape="rounded" />
                                  </TableCell>
                                );
                              }
                              if (col.key === 'status') {
                                return (
                                  <TableCell key={col.key}>
                                    <StatusBadge value={item.status} colorMap={ACTION_STATUS_COLORS} shape="rounded" />
                                  </TableCell>
                                );
                              }
                              if (col.key === 'openDate') {
                                return <TableCell key={col.key} className="font-mono font-medium text-slate-500">{item.openDate}</TableCell>;
                              }
                              if (col.key === 'dueDate') {
                                return <TableCell key={col.key} className="font-mono font-medium text-slate-500">{item.dueDate}</TableCell>;
                              }
                              const rawVal = item[col.key] ?? (col.type === 'boolean' ? false : '');
                              return (
                                <TableCell key={col.key}>
                                  {col.type === 'boolean' ? (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rawVal ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                      {rawVal ? 'Yes' : 'No'}
                                    </span>
                                  ) : col.type === 'number' ? (
                                    <span className="font-mono font-semibold text-slate-700">{rawVal}</span>
                                  ) : (
                                    <span className="text-slate-600">{String(rawVal)}</span>
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell align="center" sticky="right">
                              <div className="flex items-center justify-center space-x-1">
                                <RowActionButton
                                  intent="edit"
                                  label={`Edit action item ${item.title}`}
                                  icon={<Pencil className="w-3.5 h-3.5" />}
                                  onClick={() => handleEditAiClick(item)}
                                />
                                <RowActionButton
                                  intent="delete"
                                  label={`Delete action item ${item.title}`}
                                  icon={<Trash2 className="w-3.5 h-3.5" />}
                                  onClick={() => setDeleteTarget({ type: 'actionItem', id: item.id, label: item.title })}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </tbody>
                </Table>
              </div>
              <Pagination
                page={aiPage}
                pageSize={aiPageSize}
                totalItems={totalActions}
                onPageChange={setAiPage}
                onPageSizeChange={(size) => { setAiPageSize(size); setAiPage(1); }}
                itemLabel="action items"
              />
            </Card>
          </div>
        )}

        {activeTab === 'health' && (
          <ProjectHealthTab
            projectId={project.id}
            users={users}
            openModalTrigger={openHealthModalTrigger}
          />
        )}
      </div>

      {/* Edit Project Modal — Overview + Overall Progress fields */}
      {isEditModalOpen && projectDraft && (
        <ProjectFormModal
          isOpen={isEditModalOpen}
          onClose={() => { setIsEditModalOpen(false); setProjectDraft(null); }}
          onSubmit={handleSaveProject}
          value={projectDraft}
          onChange={(patch) => setProjectDraft({ ...projectDraft, ...patch })}
          users={users}
          stakeholders={stakeholders}
        />
      )}

      {/* Add/Edit Team Member Modal */}
      <FormModal
        isOpen={isTeamModalOpen}
        title={editingTeamMember ? 'Edit Team Member' : 'Add Team Member'}
        icon={<Users className="w-5 h-5 text-blue-600" aria-hidden="true" />}
        onClose={() => { setIsTeamModalOpen(false); setEditingTeamMember(null); }}
        onSubmit={handleSaveTeamMember}
        submitLabel={editingTeamMember ? 'Save Changes' : 'Add Member'}
        submitVariant={editingTeamMember ? 'warning' : 'primary'}
        isSubmitting={isSavingTeamMember}
        maxWidth="max-w-lg"
      >
        <FormGrid>
          <FormField label="Role" required>
            <input
              type="text"
              required
              value={teamDraft.role}
              onChange={(e) => setTeamDraft({ ...teamDraft, role: e.target.value })}
              placeholder="e.g., Delivery Lead"
              className={INPUT_CLS}
            />
          </FormField>
          <FormField label="Employee Name" required>
            <input
              type="text"
              required
              value={teamDraft.employeeName}
              onChange={(e) => setTeamDraft({ ...teamDraft, employeeName: e.target.value })}
              placeholder="e.g., Jane Doe, or an external consultant's name"
              className={INPUT_CLS}
            />
          </FormField>
          <FormField label="Seniority Level">
            <select
              value={teamDraft.seniorityLevel}
              onChange={(e) => setTeamDraft({ ...teamDraft, seniorityLevel: e.target.value })}
              className={SELECT_CLS}
            >
              <option value="">Not set</option>
              {SENIORITY_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Location">
            <SearchableSelect
              value={teamDraft.location}
              onChange={(location) => setTeamDraft({ ...teamDraft, location })}
              options={LOCATION_OPTIONS}
              placeholder="Search countries…"
              aria-label="Team member location"
            />
          </FormField>
        </FormGrid>
      </FormModal>

      {/* Add/Edit Milestone Modal */}
      <MilestoneFormModal
        isOpen={isMilestoneModalOpen}
        onClose={() => { setIsMilestoneModalOpen(false); setEditingMilestone(null); }}
        onSubmit={handleSaveMilestone}
        isSubmitting={isSavingMilestone}
        submitLabel={editingMilestone ? 'Save Changes' : 'Add Milestone'}
        submitVariant={editingMilestone ? 'warning' : 'primary'}
        mode={editingMilestone ? 'edit' : 'create'}
        value={milestoneDraft}
        onChange={(patch) => setMilestoneDraft({ ...milestoneDraft, ...patch })}
      />

      {/* Milestone Details (read-only) — opened by selecting a milestone row */}
      <MilestoneDetailsModal
        isOpen={!!viewingMilestone}
        milestone={viewingMilestone}
        onClose={() => setViewingMilestone(null)}
        onEdit={viewingMilestone ? () => openEditMilestone(viewingMilestone) : undefined}
      />

      {/* Add/Edit Risk Modal */}
      <RiskFormModal
        isOpen={isRiskModalOpen}
        onClose={() => { setIsRiskModalOpen(false); setEditingRisk(null); }}
        onSubmit={handleSaveRisk}
        isSubmitting={isSavingRisk}
        submitLabel={editingRisk ? 'Save Changes' : 'Add Risk'}
        submitVariant={editingRisk ? 'warning' : 'primary'}
        value={riskDraft}
        onChange={(patch) => setRiskDraft({ ...riskDraft, ...patch })}
        users={users}
      />

      {/* Add/Edit Assumption Modal */}
      <AssumptionFormModal
        isOpen={isAssumptionModalOpen}
        onClose={() => { setIsAssumptionModalOpen(false); setEditingAssumption(null); }}
        onSubmit={handleSaveAssumption}
        isSubmitting={isSavingAssumption}
        submitLabel={editingAssumption ? 'Save Changes' : 'Add Assumption'}
        submitVariant={editingAssumption ? 'warning' : 'primary'}
        value={assumptionDraft}
        onChange={(patch) => setAssumptionDraft({ ...assumptionDraft, ...patch })}
        users={users}
      />

      {/* Add/Edit Issue Modal */}
      <IssueFormModal
        isOpen={isIssueModalOpen}
        onClose={() => { setIsIssueModalOpen(false); setEditingIssue(null); }}
        onSubmit={handleSaveIssue}
        isSubmitting={isSavingIssue}
        submitLabel={editingIssue ? 'Save Changes' : 'Add Issue'}
        submitVariant={editingIssue ? 'warning' : 'primary'}
        value={issueDraft}
        onChange={(patch) => setIssueDraft({ ...issueDraft, ...patch })}
        users={users}
      />

      {/* Add/Edit Dependency Modal */}
      <DependencyFormModal
        isOpen={isDependencyModalOpen}
        onClose={() => { setIsDependencyModalOpen(false); setEditingDependency(null); }}
        onSubmit={handleSaveDependency}
        isSubmitting={isSavingDependency}
        submitLabel={editingDependency ? 'Save Changes' : 'Add Dependency'}
        submitVariant={editingDependency ? 'warning' : 'primary'}
        value={dependencyDraft}
        onChange={(patch) => setDependencyDraft({ ...dependencyDraft, ...patch })}
        users={users}
      />

      {/* Add Action Item Modal — locked to this project + its account */}
      <ActionItemFormModal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        onSubmit={handleCreateTask}
        submitLabel="Create Task"
        value={newAi}
        onChange={(patch) => setNewAi({ ...newAi, ...patch })}
        accounts={accounts}
        opportunities={opportunities}
        stakeholders={stakeholders}
        actionItemColumns={actionItemColumns}
        actionItemsColumnConfig={actionItemsColumnConfig}
        lockedAccount={lockedAccount}
        lockedProject={lockedProject}
        mode="project"
      />

      {/* Edit Action Item Modal */}
      {isEditAiModalOpen && editingAi && (
        <InlineEditModal
          mode="actionItems"
          entity={editingAi}
          displayedConfigs={actionItemsColumnConfig.filter((c) => c.isDisplayed)}
          accounts={accounts}
          opportunities={opportunities}
          projects={projects}
          stakeholders={stakeholders}
          onChange={(patch) => setEditingAi({ ...editingAi, ...patch })}
          onSave={handleUpdateAi}
          onCancel={() => { setIsEditAiModalOpen(false); setEditingAi(null); }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === 'comment' ? 'Delete Comment' : 'Delete Action Item'}
        message={deleteTarget ? <>Delete <span className="font-bold">"{deleteTarget.label}"</span>? This cannot be undone.</> : undefined}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'actionItem') await deleteActionItem(deleteTarget.id);
          else await deleteComment(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!teamDeleteTarget}
        title="Remove Team Member"
        message={teamDeleteTarget ? <>Remove <span className="font-bold">"{teamDeleteTarget.label}"</span> from this project's team?</> : undefined}
        onConfirm={async () => { await handleDeleteTeamMember(); }}
        onCancel={() => setTeamDeleteTarget(null)}
      />

      <ConfirmDialog
        isOpen={deleteProjectTarget}
        title="Delete Project"
        message={<>Deactivate project <span className="font-bold">"{project.name}"</span>? It will move to the Deactivated section.</>}
        confirmLabel="Deactivate"
        onConfirm={async () => {
          await deleteProject(project.id);
          setDeleteProjectTarget(false);
          goBack();
        }}
        onCancel={() => setDeleteProjectTarget(false)}
      />
    </div>
  );
};
