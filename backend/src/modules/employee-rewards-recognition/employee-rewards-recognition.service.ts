import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateEmployeeRewardsRecognitionDto, UpdateEmployeeRewardsRecognitionDto } from './dto/employee-rewards-recognition.dto';
import { isValidTypeCategoryPair } from './rewards-recognition-categories.constant';
import { EmployeeRewardsRecognition } from '../../types';

function rowToRewardsRecognition(row: any): EmployeeRewardsRecognition {
  return {
    id: row.id,
    monthOfRr: row.month_of_rr,
    nominatedById: row.nominated_by_id ?? undefined,
    nominatedByName: row.nominated_by_name ?? '',
    type: row.type,
    category: row.category,
    teamOrIndividual: row.team_or_individual,
    employeeId: row.employee_id ?? undefined,
    employeeName: row.employee_name ?? '',
    status: row.status,
    details: row.details ?? '',
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

@Injectable()
export class EmployeeRewardsRecognitionService {
  private readonly logger = new Logger(EmployeeRewardsRecognitionService.name);

  constructor(private readonly db: DatabaseService) {}

  async findAll(params?: {
    type?: string;
    category?: string;
    teamOrIndividual?: string;
    status?: string;
    monthOfRr?: string;
    search?: string;
  }): Promise<EmployeeRewardsRecognition[]> {
    let sql = `
      SELECT r.*,
             u_nom.name AS resolved_nominated_by_name,
             u_emp.name AS resolved_employee_name
      FROM employee_rewards_recognition r
      LEFT JOIN users u_nom ON r.nominated_by_id = u_nom.id
      LEFT JOIN users u_emp ON r.employee_id = u_emp.id
      WHERE r.is_deleted = FALSE
    `;
    const values: any[] = [];

    if (params?.type) {
      values.push(params.type);
      sql += ` AND r.type = $${values.length}`;
    }
    if (params?.category) {
      values.push(params.category);
      sql += ` AND r.category = $${values.length}`;
    }
    if (params?.teamOrIndividual) {
      values.push(params.teamOrIndividual);
      sql += ` AND r.team_or_individual = $${values.length}`;
    }
    if (params?.status) {
      values.push(params.status);
      sql += ` AND r.status = $${values.length}`;
    }
    if (params?.monthOfRr) {
      values.push(params.monthOfRr);
      sql += ` AND r.month_of_rr = $${values.length}`;
    }
    if (params?.search && params.search.trim()) {
      values.push(`%${params.search.trim()}%`);
      const idx = values.length;
      sql += ` AND (
        r.nominated_by_name ILIKE $${idx} OR
        r.employee_name ILIKE $${idx} OR
        r.category ILIKE $${idx} OR
        r.type ILIKE $${idx} OR
        r.details ILIKE $${idx}
      )`;
    }

    sql += ` ORDER BY r.created_at DESC`;

    const { rows } = await this.db.query(sql, values);
    return rows.map((row) => {
      // Prefer joined display name if available, fallback to stored row name
      const mapped = rowToRewardsRecognition(row);
      if (row.resolved_nominated_by_name) mapped.nominatedByName = row.resolved_nominated_by_name;
      if (row.resolved_employee_name && mapped.teamOrIndividual === 'Individual') mapped.employeeName = row.resolved_employee_name;
      return mapped;
    });
  }

  async findOne(id: string): Promise<EmployeeRewardsRecognition> {
    const { rows } = await this.db.query(
      `SELECT r.*,
              u_nom.name AS resolved_nominated_by_name,
              u_emp.name AS resolved_employee_name
       FROM employee_rewards_recognition r
       LEFT JOIN users u_nom ON r.nominated_by_id = u_nom.id
       LEFT JOIN users u_emp ON r.employee_id = u_emp.id
       WHERE r.id = $1 AND r.is_deleted = FALSE`,
      [id],
    );
    if (!rows.length) {
      throw new NotFoundException(`Employee Rewards & Recognition nomination #${id} not found`);
    }
    const mapped = rowToRewardsRecognition(rows[0]);
    if (rows[0].resolved_nominated_by_name) mapped.nominatedByName = rows[0].resolved_nominated_by_name;
    if (rows[0].resolved_employee_name && mapped.teamOrIndividual === 'Individual') mapped.employeeName = rows[0].resolved_employee_name;
    return mapped;
  }

  async create(dto: CreateEmployeeRewardsRecognitionDto, userId?: string): Promise<EmployeeRewardsRecognition> {
    if (!isValidTypeCategoryPair(dto.type, dto.category)) {
      throw new BadRequestException(`Category '${dto.category}' is not valid for Type '${dto.type}'`);
    }

    // Resolve employee name for individual nominations if employeeId provided
    let empName = dto.employeeName ?? '';
    if (dto.teamOrIndividual === 'Individual' && dto.employeeId) {
      const { rows: empRows } = await this.db.query(`SELECT name FROM users WHERE id = $1`, [dto.employeeId]);
      if (empRows.length && empRows[0].name) {
        empName = empRows[0].name;
      }
    } else if (dto.teamOrIndividual === 'Team') {
      // For team nominations, clear individual employee reference
      dto.employeeId = undefined;
    }

    // Resolve nominated by name if nominatedById provided
    let nomName = dto.nominatedByName;
    if (dto.nominatedById) {
      const { rows: nomRows } = await this.db.query(`SELECT name FROM users WHERE id = $1`, [dto.nominatedById]);
      if (nomRows.length && nomRows[0].name) {
        nomName = nomRows[0].name;
      }
    }

    const { rows } = await this.db.query(
      `INSERT INTO employee_rewards_recognition
         (id, month_of_rr, nominated_by_id, nominated_by_name, type, category,
          team_or_individual, employee_id, employee_name, status, details, created_by)
       VALUES
         (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        dto.monthOfRr.trim(),
        dto.nominatedById ?? null,
        nomName.trim(),
        dto.type,
        dto.category.trim(),
        dto.teamOrIndividual,
        dto.employeeId ?? null,
        empName ? empName.trim() : null,
        dto.status,
        dto.details.trim(),
        userId ?? null,
      ],
    );

    this.logger.log(`Created Employee R&R nomination [id=${rows[0].id} type=${dto.type} category=${dto.category}]`);
    return this.findOne(rows[0].id);
  }

  async update(id: string, dto: UpdateEmployeeRewardsRecognitionDto): Promise<EmployeeRewardsRecognition> {
    const existing = await this.findOne(id);

    const targetType = dto.type ?? existing.type;
    const targetCategory = dto.category ?? existing.category;

    if (!isValidTypeCategoryPair(targetType, targetCategory)) {
      throw new BadRequestException(`Category '${targetCategory}' is not valid for Type '${targetType}'`);
    }

    const teamOrIndividual = dto.teamOrIndividual ?? existing.teamOrIndividual;
    let employeeId = dto.employeeId !== undefined ? dto.employeeId : existing.employeeId;
    let employeeName = dto.employeeName !== undefined ? dto.employeeName : existing.employeeName;

    if (teamOrIndividual === 'Team') {
      employeeId = undefined;
    } else if (employeeId) {
      const { rows: empRows } = await this.db.query(`SELECT name FROM users WHERE id = $1`, [employeeId]);
      if (empRows.length && empRows[0].name) {
        employeeName = empRows[0].name;
      }
    }

    let nominatedById = dto.nominatedById !== undefined ? dto.nominatedById : existing.nominatedById;
    let nominatedByName = dto.nominatedByName !== undefined ? dto.nominatedByName : existing.nominatedByName;
    if (nominatedById) {
      const { rows: nomRows } = await this.db.query(`SELECT name FROM users WHERE id = $1`, [nominatedById]);
      if (nomRows.length && nomRows[0].name) {
        nominatedByName = nomRows[0].name;
      }
    }

    await this.db.query(
      `UPDATE employee_rewards_recognition
       SET month_of_rr = $1,
           nominated_by_id = $2,
           nominated_by_name = $3,
           type = $4,
           category = $5,
           team_or_individual = $6,
           employee_id = $7,
           employee_name = $8,
           status = $9,
           details = $10,
           updated_at = NOW()
       WHERE id = $11 AND is_deleted = FALSE`,
      [
        dto.monthOfRr ? dto.monthOfRr.trim() : existing.monthOfRr,
        nominatedById ?? null,
        nominatedByName ? nominatedByName.trim() : existing.nominatedByName,
        targetType,
        targetCategory.trim(),
        teamOrIndividual,
        employeeId ?? null,
        employeeName ? employeeName.trim() : null,
        dto.status ?? existing.status,
        dto.details !== undefined ? dto.details.trim() : existing.details,
        id,
      ],
    );

    this.logger.log(`Updated Employee R&R nomination [id=${id}]`);
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id); // Ensure exists
    await this.db.query(
      `UPDATE employee_rewards_recognition SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    this.logger.log(`Soft deleted Employee R&R nomination [id=${id}]`);
    return { success: true };
  }
}
