/**
 * Shared UI component library — the single source of truth for the app's
 * visual language. Views compose these instead of hand-rolling headers,
 * dialogs, badges, tables chrome, etc.
 */
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Modal, ModalFooter } from './Modal';
export type { ModalProps } from './Modal';

export { ConfirmDialog, RestoreDialog } from './ConfirmDialog';
export type { ConfirmDialogProps, RestoreDialogProps } from './ConfirmDialog';

export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

export { BackButton } from './BackButton';
export type { BackButtonProps } from './BackButton';

export { SearchBar } from './SearchBar';
export type { SearchBarProps } from './SearchBar';

export { FilterBar, FilterSelect, FilterChip } from './FilterBar';
export type { FilterSelectProps, FilterChipProps } from './FilterBar';

export { MultiSelectFilter } from './MultiSelectFilter';
export type { MultiSelectFilterProps, MultiSelectFilterOption } from './MultiSelectFilter';

export {
  StatusBadge,
  HEALTH_COLORS,
  ACCOUNT_TYPE_COLORS,
  STAGE_COLORS,
  PRIORITY_COLORS,
  ACTION_STATUS_COLORS,
  INFLUENCE_COLORS,
  RELATIONSHIP_COLORS,
  ALERT_SEVERITY_COLORS,
  NOTIFICATION_SEVERITY_COLORS,
  RETENTION_RISK_COLORS,
  STAKEHOLDER_TYPE_LABELS,
  STAKEHOLDER_TYPE_COLORS,
} from './StatusBadge';
export type { StatusBadgeProps } from './StatusBadge';

export { EmptyState, EmptyRow } from './EmptyState';
export type { EmptyStateProps, EmptyRowProps } from './EmptyState';

export { ErrorBanner, ErrorState } from './ErrorState';
export type { ErrorBannerProps, ErrorStateProps } from './ErrorState';

export { Skeleton, TableSkeleton, CardSkeleton } from './LoadingSkeleton';

export { RowActionButton, TableActions, RestoreButton } from './TableActions';
export type { TableActionsProps, RowActionButtonProps, RestoreButtonProps } from './TableActions';

export { FileUploadButton } from './FileUpload';
export type { FileUploadButtonProps } from './FileUpload';

export { Pagination } from './Pagination';
export type { PaginationProps } from './Pagination';

export { FormField, FormGrid, FormSection, FormModal, INPUT_CLS, SELECT_CLS, INPUT_CLS_AMBER } from './Form';
export type { FormFieldProps, FormModalProps } from './Form';

export { DeactivatedSection } from './DeactivatedSection';
export type { DeactivatedSectionProps } from './DeactivatedSection';

export { SortableHeader } from './SortableHeader';
export type { SortableHeaderProps } from './SortableHeader';

export { Card } from './Card';
export type { CardProps, CardTone } from './Card';

export { SummaryCard } from './SummaryCard';
export type { SummaryCardProps } from './SummaryCard';

export { InfoBlock } from './InfoBlock';
export type { InfoBlockProps } from './InfoBlock';

export { DetailHeaderCard } from './DetailHeaderCard';
export type { DetailHeaderCardProps } from './DetailHeaderCard';

export { DetailTabBar } from './DetailTabBar';
export type { DetailTab, DetailTabBarProps } from './DetailTabBar';

export {
  PhoneInput,
  splitPhone,
  validatePhone,
  isValidPhone,
  COUNTRY_DIAL_CODES,
  DEFAULT_DIAL_CODE,
} from './PhoneInput';
export type { PhoneInputProps, CountryDialCode } from './PhoneInput';

export { Table, TableHead, TableHeadCell, TableCell, TableRow } from './Table';
export type { TableProps, TableHeadProps, TableHeadCellProps, TableCellProps, TableRowProps } from './Table';

export { TextPreviewCell } from './TextPreviewCell';
export type { TextPreviewCellProps } from './TextPreviewCell';

export { ExpandableTextCell } from './ExpandableTextCell';
export type { ExpandableTextCellProps } from './ExpandableTextCell';

export { SearchableSelect } from './SearchableSelect';
export type { SearchableSelectProps } from './SearchableSelect';

export { InlineCreateField } from './InlineCreateField';
export type { InlineCreateFieldProps } from './InlineCreateField';

export { InlineTextEditCell, InlineSelectEditCell, InlineTextareaEditCell } from './InlineCellEdit';
