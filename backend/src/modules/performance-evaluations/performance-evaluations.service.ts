import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { EmployeeMasterService, EmployeeMaster } from '../employee-master/employee-master.service';
import { extractCustomData } from '../../common/utils/db-mapping.util';

// Fixed schema fields — anything else in the request body is a dynamic
// custom-column value and gets routed into custom_data.
const KNOWN = new Set([
  'account', 'project', 'accountId', 'projectId', 'employeeId', 'employeeName', 'manager', 'month', 'hasReportees',
  'deliveryExcellence', 'qualityStandards', 'technicalCapability', 'communication', 'sla',
  'teamCollaboration', 'reliability', 'innovation', 'ideation', 'behavioural', 'leadership',
  'customerFeedback', 'employeeFeedback', 'trainingRequired', 'strength', 'improvementArea',
  'keyContributionDetails', 'ideaDetails', 'overallComment', 'actionItemNextMonth', 'retentionRisk',
]);

function rowToEval(row: any) {
  return {
    id: row.id,
    account: row.account,
    project: row.project,
    accountId: row.account_id ?? undefined,
    projectId: row.project_id ?? undefined,
    employeeId: row.employee_id ?? undefined,
    employeeName: row.employee_name,
    manager: row.manager,
    month: row.month,
    hasReportees: row.has_reportees,
    deliveryExcellence: Number(row.delivery_excellence),
    qualityStandards: Number(row.quality_standards),
    technicalCapability: Number(row.technical_capability),
    communication: Number(row.communication),
    sla: Number(row.sla),
    teamCollaboration: Number(row.team_collaboration),
    reliability: Number(row.reliability),
    innovation: Number(row.innovation),
    ideation: Number(row.ideation),
    behavioural: Number(row.behavioural),
    leadership: row.leadership !== null && row.leadership !== undefined ? Number(row.leadership) : undefined,
    customerFeedback: row.customer_feedback,
    employeeFeedback: row.employee_feedback,
    trainingRequired: row.training_required,
    strength: row.strength,
    improvementArea: row.improvement_area,
    keyContributionDetails: row.key_contribution_details,
    ideaDetails: row.idea_details,
    overallComment: row.overall_comment,
    actionItemNextMonth: row.action_item_next_month,
    retentionRisk: row.retention_risk,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.custom_data || {}),
  };
}

@Injectable()
export class PerformanceEvaluationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly employeeMaster: EmployeeMasterService,
  ) {}

  /** Only employees in the Employee Master can be evaluated. */
  private async resolveEmployee(employeeId: string): Promise<EmployeeMaster> {
    const employee = await this.employeeMaster.findById(employeeId);
    if (!employee) {
      throw new BadRequestException(
        'The selected employee is not in the Employee Master. Please pick a valid employee.',
      );
    }
    return employee;
  }

  /** Integrity rule: one evaluation per employee per month. */
  private async assertNoDuplicatePeriod(employeeId: string, month: string, excludeId?: string): Promise<void> {
    const { rows } = await this.db.query(
      `SELECT id FROM performance_evaluations
       WHERE employee_id = $1 AND LOWER(TRIM(month)) = LOWER(TRIM($2))
         AND is_deleted = FALSE AND ($3::TEXT IS NULL OR id <> $3)`,
      [employeeId, month, excludeId ?? null],
    );
    if (rows.length) {
      throw new ConflictException('An evaluation for this employee and month already exists');
    }
  }

  /** Maps a uq_pe_employee_month race (concurrent writes) to the same 409 as the explicit check. */
  private mapDuplicatePeriod(err: any): any {
    if (err?.code === '23505' && String(err?.constraint ?? '').includes('uq_pe_employee_month')) {
      return new ConflictException('An evaluation for this employee and month already exists');
    }
    return err;
  }

  async findAll(userId?: string): Promise<any[]> {
    const { rows } = userId
      ? await this.db.query(
          'SELECT * FROM performance_evaluations WHERE is_deleted = FALSE AND created_by = $1 ORDER BY created_at DESC',
          [userId],
        )
      : await this.db.query(
          'SELECT * FROM performance_evaluations WHERE is_deleted = FALSE ORDER BY created_at DESC',
        );
    return rows.map(rowToEval);
  }

  async findOne(id: string, userId?: string): Promise<any> {
    const { rows } = await this.db.query(
      `SELECT * FROM performance_evaluations
       WHERE id = $1 AND is_deleted = FALSE
       AND ($2::TEXT IS NULL OR created_by = $2)`,
      [id, userId ?? null],
    );
    if (!rows.length) throw new NotFoundException(`Performance evaluation "${id}" not found`);
    return rowToEval(rows[0]);
  }

  async create(data: any, userId: string): Promise<any> {
    const employee = await this.resolveEmployee(data.employeeId);
    await this.assertNoDuplicatePeriod(employee.id, data.month);
    const employeeName = employee.name || employee.email;

    let accountName = data.account ?? '';
    let projectName = data.project ?? '';

    if (data.accountId && !accountName) {
      const { rows: aRows } = await this.db.query('SELECT name FROM accounts WHERE id = $1', [data.accountId]);
      if (aRows.length) accountName = aRows[0].name;
    }
    if (data.projectId && !projectName) {
      const { rows: pRows } = await this.db.query('SELECT name FROM projects WHERE id = $1', [data.projectId]);
      if (pRows.length) projectName = pRows[0].name;
    }

    const cd = extractCustomData(data, KNOWN);

    const { rows } = await this.db.query(
      `INSERT INTO performance_evaluations (
        account, project, account_id, project_id, employee_id, employee_name, manager, month, has_reportees,
        delivery_excellence, quality_standards, technical_capability, communication, sla,
        team_collaboration, reliability, innovation, ideation, behavioural, leadership,
        customer_feedback, employee_feedback, training_required, strength, improvement_area,
        key_contribution_details, idea_details, overall_comment, action_item_next_month,
        retention_risk, created_by, custom_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28, $29,
        $30, $31, $32
      ) RETURNING *`,
      [
        accountName, projectName, data.accountId ?? null, data.projectId ?? null,
        employee.id, employeeName, data.manager, data.month, data.hasReportees,
        data.deliveryExcellence, data.qualityStandards, data.technicalCapability, data.communication, data.sla,
        data.teamCollaboration, data.reliability, data.innovation, data.ideation, data.behavioural,
        data.hasReportees ? (data.leadership ?? null) : null,
        data.customerFeedback ?? '', data.employeeFeedback ?? '', data.trainingRequired ?? '',
        data.strength ?? '', data.improvementArea ?? '', data.keyContributionDetails ?? '',
        data.ideaDetails ?? '', data.overallComment ?? '', data.actionItemNextMonth ?? '',
        data.retentionRisk, userId, JSON.stringify(cd),
      ],
    ).catch((err) => { throw this.mapDuplicatePeriod(err); });
    return rowToEval(rows[0]);
  }

  async update(id: string, data: any, userId?: string): Promise<any> {
    await this.findOne(id, userId);
    const employee = await this.resolveEmployee(data.employeeId);
    await this.assertNoDuplicatePeriod(employee.id, data.month, id);
    const employeeName = employee.name || employee.email;

    let accountName = data.account ?? '';
    let projectName = data.project ?? '';

    if (data.accountId && !accountName) {
      const { rows: aRows } = await this.db.query('SELECT name FROM accounts WHERE id = $1', [data.accountId]);
      if (aRows.length) accountName = aRows[0].name;
    }
    if (data.projectId && !projectName) {
      const { rows: pRows } = await this.db.query('SELECT name FROM projects WHERE id = $1', [data.projectId]);
      if (pRows.length) projectName = pRows[0].name;
    }

    const cd = extractCustomData(data, KNOWN);

    const { rows } = await this.db.query(
      `UPDATE performance_evaluations SET
        account = $1, project = $2, account_id = $3, project_id = $4, employee_id = $5, employee_name = $6, manager = $7, month = $8, has_reportees = $9,
        delivery_excellence = $10, quality_standards = $11, technical_capability = $12,
        communication = $13, sla = $14, team_collaboration = $15, reliability = $16,
        innovation = $17, ideation = $18, behavioural = $19, leadership = $20,
        customer_feedback = $21, employee_feedback = $22, training_required = $23,
        strength = $24, improvement_area = $25, key_contribution_details = $26,
        idea_details = $27, overall_comment = $28, action_item_next_month = $29,
        retention_risk = $30, custom_data = $31, updated_at = NOW()
      WHERE id = $32 AND is_deleted = FALSE
      RETURNING *`,
      [
        accountName, projectName, data.accountId ?? null, data.projectId ?? null,
        employee.id, employeeName, data.manager, data.month, data.hasReportees,
        data.deliveryExcellence, data.qualityStandards, data.technicalCapability, data.communication, data.sla,
        data.teamCollaboration, data.reliability, data.innovation, data.ideation, data.behavioural,
        data.hasReportees ? (data.leadership ?? null) : null,
        data.customerFeedback ?? '', data.employeeFeedback ?? '', data.trainingRequired ?? '',
        data.strength ?? '', data.improvementArea ?? '', data.keyContributionDetails ?? '',
        data.ideaDetails ?? '', data.overallComment ?? '', data.actionItemNextMonth ?? '',
        data.retentionRisk, JSON.stringify(cd), id,
      ],
    ).catch((err) => { throw this.mapDuplicatePeriod(err); });
    if (!rows.length) throw new NotFoundException(`Performance evaluation "${id}" not found`);
    return rowToEval(rows[0]);
  }

  /**
   * Per-employee reporting aggregates (server-side, over the evaluator's own
   * records): evaluation count, average overall score, latest month evaluated
   * and the most recent retention-risk rating.
   */
  async summary(userId: string): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT
         employee_id,
         employee_name,
         COUNT(*)::INTEGER AS evaluations,
         ROUND(AVG(
           (delivery_excellence + quality_standards + technical_capability + communication + sla
            + team_collaboration + reliability + innovation + ideation + behavioural
            + COALESCE(leadership, 0))
           / (CASE WHEN leadership IS NOT NULL THEN 11 ELSE 10 END)
         ), 2)::FLOAT AS average_score,
         (ARRAY_AGG(month          ORDER BY created_at DESC))[1] AS latest_month,
         (ARRAY_AGG(retention_risk ORDER BY created_at DESC))[1] AS latest_retention_risk
       FROM performance_evaluations
       WHERE is_deleted = FALSE AND created_by = $1
       GROUP BY employee_id, employee_name
       ORDER BY LOWER(employee_name) ASC`,
      [userId],
    );
    return rows.map((r: any) => ({
      employeeId:          r.employee_id ?? undefined,
      employeeName:        r.employee_name,
      evaluations:         r.evaluations,
      averageScore:        Number(r.average_score),
      latestMonth:         r.latest_month,
      latestRetentionRisk: r.latest_retention_risk,
    }));
  }

  async remove(id: string, userId?: string): Promise<{ success: boolean }> {
    const { rowCount } = await this.db.query(
      `UPDATE performance_evaluations SET is_deleted = TRUE, updated_at = NOW()
       WHERE id = $1 AND is_deleted = FALSE
       AND ($2::TEXT IS NULL OR created_by = $2)`,
      [id, userId ?? null],
    );
    if (!rowCount) throw new NotFoundException(`Performance evaluation "${id}" not found`);
    return { success: true };
  }
}
