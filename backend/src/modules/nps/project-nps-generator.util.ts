import { BadRequestException, NotFoundException } from '@nestjs/common';

export function deriveQuarterFromMonthYear(val: string): string {
  if (!val) return 'Q1';
  const match = String(val).match(/^(\d{4})-(\d{2})/);
  if (!match) return 'Q1';
  const month = parseInt(match[2], 10);
  if (isNaN(month) || month < 1 || month > 12) return 'Q1';
  if (month >= 4 && month <= 6) return 'Q1';
  if (month >= 7 && month <= 9) return 'Q2';
  if (month >= 10 && month <= 12) return 'Q3';
  return 'Q4';
}

export interface Queryable {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
}

export async function insertInitialProjectNps(
  db: Queryable,
  projectId: string,
  accountId?: string | null,
  clientPmName?: string | null,
): Promise<any> {
  if (!projectId) {
    throw new BadRequestException('Project ID is required');
  }

  // 1. Fetch project with account info
  const { rows: projRows } = await db.query(
    `SELECT p.id, p.name, p.account_id, p.opportunity_id, p.client_pm_name,
            a.name AS account_name
     FROM projects p
     LEFT JOIN accounts a ON p.account_id = a.id AND a.is_deleted = FALSE
     WHERE p.id = $1 AND p.is_deleted = FALSE`,
    [projectId],
  );

  if (!projRows.length) {
    throw new NotFoundException(`Project "${projectId}" not found`);
  }

  const project = projRows[0];
  const effectiveAccountId = accountId || project.account_id;

  // 2. Scenario: Project with no Account -> Validation error
  if (!effectiveAccountId || !project.account_name) {
    throw new BadRequestException(
      `Project "${project.name || projectId}" must be associated with an active account to generate NPS score`,
    );
  }

  // 3. Scenario: Existing Projects with NPS scores -> Existing scores remain intact
  //    Scenario: Repeated NPS generation -> No unintended duplicate records
  const { rows: existingRows } = await db.query(
    `SELECT id, account_id, project_id, respondent_name, received_month_year, quarter, nps_score, liked_most, improvement_suggestions
     FROM nps_responses
     WHERE project_id = $1 AND is_deleted = FALSE
     ORDER BY created_at ASC
     LIMIT 1`,
    [projectId],
  );

  if (existingRows.length > 0) {
    return existingRows[0];
  }

  // 4. Resolve respondent stakeholder from the project's account
  const { rows: stks } = await db.query(
    `SELECT id, name, designation
     FROM stakeholders
     WHERE account_id = $1 AND (stakeholder_type = 'CLIENT' OR stakeholder_type IS NULL) AND is_deleted = FALSE
     ORDER BY created_at ASC
     LIMIT 1`,
    [effectiveAccountId],
  );

  let respondentId: string | null = null;
  let respondentName = 'Sarah Jenkins (VP of Technology)';

  if (stks.length > 0) {
    respondentId = stks[0].id;
    respondentName = stks[0].designation
      ? `${stks[0].name} (${stks[0].designation})`
      : stks[0].name;
  } else if (clientPmName || project.client_pm_name) {
    respondentName = (clientPmName || project.client_pm_name).trim();
  }

  const now = new Date();
  const receivedMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const quarter = deriveQuarterFromMonthYear(receivedMonthYear);
  const npsScore = 9;
  const likedMost = 'Proactive communication, deep technical domain knowledge, and transparent weekly progress reporting.';
  const improvementSuggestions = 'Accelerate onboarding for new team members during scaling phases.';

  const { rows: inserted } = await db.query(
    `INSERT INTO nps_responses (
       id, account_id, project_id, respondent_id, respondent_name,
       received_month_year, quarter, nps_score, liked_most, improvement_suggestions
     )
     VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, account_id, project_id, respondent_name, received_month_year, quarter, nps_score, liked_most, improvement_suggestions`,
    [
      effectiveAccountId,
      project.id,
      respondentId,
      respondentName,
      receivedMonthYear,
      quarter,
      npsScore,
      likedMost,
      improvementSuggestions,
    ],
  );

  return inserted[0];
}
