/**
 * SQA (Software Quality Assurance) — project-level weekly quality tracking.
 *
 * The module owns only what nothing else does: the SQA classification, the
 * weekly narrative and remarks. Account, Project, PM, revenue, billing model,
 * tower and team size are read through the linked Project on every request, and
 * weekly health lives in the project's own Project Health history.
 */
export { SqaListView } from './components/SqaListView';
export { SqaDetailsView } from './components/SqaDetailsView';
export { SqaFormModal, emptySqaDraft, draftFromRecord, draftToInput } from './components/SqaFormModal';
export type { SqaDraft, SqaInherited, SqaFormModalProps } from './components/SqaFormModal';
export { SqaWeeklyHealthGrid, SqaWeekHealthCell, weekKey } from './components/SqaWeeklyHealthGrid';
export { useSqaRecords, useSqaRecord, useSqaAvailableProjects, sqaErrorMessage } from './hooks/useSqaRecords';
