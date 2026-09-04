import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateEmployeeAppreciationDto, UpdateEmployeeAppreciationDto } from './dto/employee-appreciation.dto';

function rowToEmployeeAppreciation(row: any) {
  return {
    id: row.id,
    receivedDate: row.received_date ? String(row.received_date).substring(0, 10) : '',
    accountId: row.account_id,
    accountName: row.account_name ?? '',
    projectId: row.project_id ?? null,
    projectName: row.project_name ?? null,
    empId: row.emp_id ?? null,
    employeeId: row.employee_id ?? null,
    employeeName: row.employee_name ?? '',
    respondentId: row.respondent_id ?? null,
    respondentName: row.respondent_name ?? '',
    internalExternal: row.internal_external,
    feedback: row.feedback ?? '',
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class EmployeeAppreciationService {
  private readonly logger = new Logger(EmployeeAppreciationService.name);

  constructor(private readonly db: DatabaseService) {}

  async findAll(params: {
    accountId?: string;
    projectId?: string;
    internalExternal?: string;
    search?: string;
  }): Promise<any[]> {
    const conditions: string[] = ['e.is_deleted = FALSE'];
    const qParams: any[] = [];

    if (params.accountId) {
      qParams.push(params.accountId);
      conditions.push(`e.account_id = $${qParams.length}`);
    }
    if (params.projectId) {
      qParams.push(params.projectId);
      conditions.push(`e.project_id = $${qParams.length}`);
    }
    if (params.internalExternal) {
      qParams.push(params.internalExternal);
      conditions.push(`e.internal_external = $${qParams.length}`);
    }
    if (params.search?.trim()) {
      qParams.push(`%${params.search.trim()}%`);
      const idx = qParams.length;
      conditions.push(`(e.employee_name ILIKE $${idx} OR e.respondent_name ILIKE $${idx} OR e.feedback ILIKE $${idx} OR e.emp_id ILIKE $${idx})`);
    }

    const where = conditions.join(' AND ');
    const { rows } = await this.db.query(
      `SELECT e.*,
              a.name AS account_name,
              p.name AS project_name
       FROM employee_appreciation e
       INNER JOIN accounts a ON e.account_id = a.id AND a.is_deleted = FALSE
       LEFT  JOIN projects p ON e.project_id = p.id AND p.is_deleted = FALSE
       WHERE ${where}
       ORDER BY e.received_date DESC, e.created_at DESC`,
      qParams,
    );

    return rows.map(rowToEmployeeAppreciation);
  }

  async findOne(id: string): Promise<any> {
    const { rows } = await this.db.query(
      `SELECT e.*,
              a.name AS account_name,
              p.name AS project_name
       FROM employee_appreciation e
       INNER JOIN accounts a ON e.account_id = a.id AND a.is_deleted = FALSE
       LEFT  JOIN projects p ON e.project_id = p.id AND p.is_deleted = FALSE
       WHERE e.id = $1 AND e.is_deleted = FALSE`,
      [id],
    );

    if (!rows.length) {
      throw new NotFoundException(`Employee Appreciation entry "${id}" not found`);
    }

    return rowToEmployeeAppreciation(rows[0]);
  }

  async create(dto: CreateEmployeeAppreciationDto, userId?: string): Promise<any> {
    if (!dto.feedback?.trim()) {
      throw new BadRequestException('Feedback cannot be empty');
    }

    // Validate account existence
    const accRes = await this.db.query(
      `SELECT id FROM accounts WHERE id = $1 AND is_deleted = FALSE`,
      [dto.accountId],
    );
    if (!accRes.rows.length) {
      throw new BadRequestException(`Account "${dto.accountId}" does not exist`);
    }

    // Validate project existence if provided
    if (dto.projectId) {
      const projRes = await this.db.query(
        `SELECT id FROM projects WHERE id = $1 AND is_deleted = FALSE`,
        [dto.projectId],
      );
      if (!projRes.rows.length) {
        throw new BadRequestException(`Project "${dto.projectId}" does not exist`);
      }
    }

    const { rows } = await this.db.query(
      `INSERT INTO employee_appreciation (
        received_date, account_id, project_id, emp_id, employee_id,
        employee_name, respondent_id, respondent_name, internal_external,
        feedback, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        dto.receivedDate,
        dto.accountId,
        dto.projectId || null,
        dto.empId || null,
        dto.employeeId || null,
        dto.employeeName,
        dto.respondentId || null,
        dto.respondentName,
        dto.internalExternal,
        dto.feedback,
        userId || null,
      ],
    );

    return this.findOne(rows[0].id);
  }

  async update(id: string, dto: UpdateEmployeeAppreciationDto): Promise<any> {
    const existing = await this.findOne(id);
    if (!existing) {
      throw new NotFoundException(`Employee Appreciation "${id}" not found`);
    }

    const accountId = dto.accountId ?? existing.accountId;
    const projectId = dto.projectId !== undefined ? dto.projectId : existing.projectId;
    const receivedDate = dto.receivedDate ?? existing.receivedDate;
    const empId = dto.empId !== undefined ? dto.empId : existing.empId;
    const employeeId = dto.employeeId !== undefined ? dto.employeeId : existing.employeeId;
    const employeeName = dto.employeeName ?? existing.employeeName;
    const respondentId = dto.respondentId !== undefined ? dto.respondentId : existing.respondentId;
    const respondentName = dto.respondentName ?? existing.respondentName;
    const internalExternal = dto.internalExternal ?? existing.internalExternal;
    const feedback = dto.feedback ?? existing.feedback;

    await this.db.query(
      `UPDATE employee_appreciation
       SET received_date = $1,
           account_id = $2,
           project_id = $3,
           emp_id = $4,
           employee_id = $5,
           employee_name = $6,
           respondent_id = $7,
           respondent_name = $8,
           internal_external = $9,
           feedback = $10,
           updated_at = NOW()
       WHERE id = $11 AND is_deleted = FALSE`,
      [
        receivedDate,
        accountId,
        projectId || null,
        empId || null,
        employeeId || null,
        employeeName,
        respondentId || null,
        respondentName,
        internalExternal,
        feedback,
        id,
      ],
    );

    return this.findOne(id);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.db.query(
      `UPDATE employee_appreciation SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return { success: true };
  }
}
