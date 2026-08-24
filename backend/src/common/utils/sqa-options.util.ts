import { SERVICE_LINE_OPTIONS } from './dto-transforms.util';

/**
 * SQA master lists — the single source of truth backing the SQA DTO validation
 * and the `SqaRecord` field types. Mirrors the same constants in
 * `frontend/src/constants/index.ts`; keep both in sync when adding values.
 *
 * Follows the SERVICE_LINE_OPTIONS pattern (a shared constant validated by
 * @IsIn) rather than a DB CHECK constraint, so a list can grow without a
 * schema migration.
 *
 * Two of the four lists are NOT new master data — they are the application's
 * existing lists reused verbatim, because SQA's "Billing Model" and "Tower" are
 * the same domains as an opportunity's Revenue Model and Service Line:
 *
 *   SQA_BILLING_MODEL_OPTIONS ← opportunities.revenue_model
 *   SQA_TOWER_OPTIONS         ← opportunities.service_line
 */

/** Reused verbatim from the opportunity Revenue Model list. */
export const SQA_BILLING_MODEL_OPTIONS = [
  'T&E', 'Fixed Bid', 'Fixed Capacity', 'Managed Services',
] as const;

/** Tower options — Tower 1 and Tower 2. */
export const SQA_TOWER_OPTIONS = ['Tower 1', 'Tower 2'] as const;

/** SQA/project importance — same High/Medium/Low scale the app uses for priority. */
export const SQA_IMPORTANCE_OPTIONS = ['High', 'Medium', 'Low'] as const;

/**
 * Engagement delivery shape. No existing field in the application carries this
 * (accounts/opportunities `location` is a country, not a delivery model), so
 * SQA owns it outright.
 */
export const SQA_DELIVERY_MODEL_OPTIONS = [
  'Onsite', 'Offshore', 'Onsite-Offshore', 'Nearshore', 'Hybrid',
] as const;

/** Resource health for the engagement. */
export const SQA_RESOURCING_STATUS_OPTIONS = [
  'Fully Staffed', 'Partially Staffed', 'Open Positions', 'Attrition Risk', 'Ramp Down',
] as const;

/** Current development lifecycle phase. */
export const SQA_SDLC_PHASE_OPTIONS = [
  'Requirements', 'Design', 'Development', 'Testing', 'UAT',
  'Deployment', 'Hypercare', 'Maintenance', 'Closure',
] as const;

/** RAG values — the existing Project Health scale, which SQA reuses as-is. */
export const SQA_HEALTH_OPTIONS = ['Green', 'Amber', 'Red'] as const;
