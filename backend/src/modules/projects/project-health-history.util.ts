/**
 * Single write path for the `project_health_updates` audit trail.
 *
 * Every health change — whether it comes from the Health Tracker's own "Update
 * Health" form, from Create Project, or from Edit Project — inserts through
 * here, so the history table has exactly one producer and the tracker keeps a
 * complete, gap-free record. Callers own the `projects.health` column itself:
 * ProjectHealthService updates it explicitly, while ProjectsService writes it as
 * part of its own INSERT/UPDATE.
 *
 * `statusSummary` is never synthesised: entries written by Create/Edit Project
 * carry an empty summary and the Health Tracker renders them as health-only
 * entries. Only text a user typed into the Update Health form is stored.
 */

/** Accepts either the pooled DatabaseService or a transaction's PoolClient. */
export interface Queryable {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
}

export interface HealthHistoryInsert {
  projectId: string;
  health: string;
  statusSummary: string;
  keyAchievements?: string;
  currentChallenges?: string;
  risksImpactingHealth?: string;
  mitigationPlan?: string;
  supportRequired?: string;
  nextReviewDate?: string | null;
  overallConfidencePct?: number | null;
  reviewedById?: string | null;
  /** User the entry is attributed to — surfaces as "Last Updated By". */
  updatedById?: string | null;
  /**
   * Explicit entry timestamp, ISO. Omitted (the normal case) the entry is
   * stamped NOW(). Set only when an entry is being recorded *for a past
   * period* — SQA's weekly health grid writes a health value into the ISO week
   * it belongs to, which would otherwise land in the current week and make the
   * trail disagree with the week it describes.
   */
  createdAt?: string | null;
}

/** Inserts one history entry and returns its id. */
export async function insertHealthHistory(db: Queryable, data: HealthHistoryInsert): Promise<string> {
  const { rows } = await db.query(
    `INSERT INTO project_health_updates (
       project_id, health, status_summary, key_achievements, current_challenges,
       risks_impacting_health, mitigation_plan, support_required, next_review_date,
       overall_confidence_pct, reviewed_by_id, updated_by_id, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13::TIMESTAMPTZ, NOW()))
     RETURNING id`,
    [
      data.projectId,
      data.health,
      data.statusSummary,
      data.keyAchievements ?? '',
      data.currentChallenges ?? '',
      data.risksImpactingHealth ?? '',
      data.mitigationPlan ?? '',
      data.supportRequired ?? '',
      data.nextReviewDate || null,
      data.overallConfidencePct ?? null,
      data.reviewedById || null,
      data.updatedById || null,
      data.createdAt || null,
    ],
  );
  return rows[0].id;
}
