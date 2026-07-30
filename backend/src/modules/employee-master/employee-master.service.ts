import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { CreateEmployeeMasterDto, UpdateEmployeeMasterDto } from './dto/employee-master.dto';

export interface EmployeeMaster {
  id: string;
  email: string;
  /** Display name used by Performance Evaluations; falls back to '' for legacy rows. */
  name: string;
  /** Pre-assigned RBAC attributes copied onto the user record at registration. */
  roleId: string | null;
  employeeId: string | null;
  department: string | null;
  designation: string | null;
  createdAt: string;
  updatedAt: string;
}

const SELECT_COLS = `id, email, name, role_id, employee_id, department, designation,
  created_at::TEXT AS created_at, updated_at::TEXT AS updated_at`;

@Injectable()
export class EmployeeMasterService {
  constructor(private readonly db: DatabaseService) {}

  private mapRow(r: Record<string, unknown>): EmployeeMaster {
    return {
      id:          r.id as string,
      email:       r.email as string,
      name:        (r.name as string) ?? '',
      roleId:      (r.role_id as string) ?? null,
      employeeId:  (r.employee_id as string) ?? null,
      department:  (r.department as string) ?? null,
      designation: (r.designation as string) ?? null,
      createdAt:   r.created_at as string,
      updatedAt:   r.updated_at as string,
    };
  }

  async findAll(): Promise<EmployeeMaster[]> {
    const { rows } = await this.db.query(
      `SELECT ${SELECT_COLS} FROM employee_master ORDER BY email ASC`,
    );
    return rows.map(this.mapRow);
  }

  async findById(id: string): Promise<EmployeeMaster | null> {
    const { rows } = await this.db.query(
      `SELECT ${SELECT_COLS} FROM employee_master WHERE id = $1`,
      [id],
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<EmployeeMaster | null> {
    const { rows } = await this.db.query(
      `SELECT ${SELECT_COLS} FROM employee_master WHERE LOWER(email) = LOWER($1)`,
      [email],
    );
    return rows.length ? this.mapRow(rows[0]) : null;
  }

  async create(dto: CreateEmployeeMasterDto): Promise<EmployeeMaster> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('This email address is already in the employee master list');
    }
    const { rows } = await this.db.query(
      `INSERT INTO employee_master (id, email, name, role_id, employee_id, department, designation)
       VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLS}`,
      [dto.email, dto.name ?? '', dto.roleId ?? null, dto.employeeId ?? null, dto.department ?? null, dto.designation ?? null],
    );
    return this.mapRow(rows[0]);
  }

  async update(id: string, dto: UpdateEmployeeMasterDto): Promise<EmployeeMaster> {
    const { rows: existing } = await this.db.query(
      `SELECT id, email, name FROM employee_master WHERE id = $1`,
      [id],
    );
    if (!existing.length) throw new NotFoundException('Employee not found');

    // Check the new email is not taken by another record
    const { rows: conflict } = await this.db.query(
      `SELECT id FROM employee_master WHERE LOWER(email) = LOWER($1) AND id <> $2`,
      [dto.email, id],
    );
    if (conflict.length) {
      throw new ConflictException('This email address is already in the employee master list');
    }

    // If the old email belongs to a registered user, also update the user record
    const oldEmail = existing[0].email as string;
    if (oldEmail.toLowerCase() !== dto.email.toLowerCase()) {
      const { rows: userRows } = await this.db.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
        [oldEmail],
      );
      if (userRows.length) {
        throw new BadRequestException(
          'Cannot change this email — a user account is already registered with it. ' +
          'Delete the user account first, or add the new email as a separate entry.',
        );
      }
    }

    const name = dto.name !== undefined ? dto.name : (existing[0].name as string) ?? '';
    const { rows } = await this.db.query(
      `UPDATE employee_master
       SET email = $1, name = $2,
           role_id     = COALESCE($4, role_id),
           employee_id = COALESCE($5, employee_id),
           department  = COALESCE($6, department),
           designation = COALESCE($7, designation),
           updated_at = NOW()
       WHERE id = $3
       RETURNING ${SELECT_COLS}`,
      [dto.email, name, id, dto.roleId ?? null, dto.employeeId ?? null, dto.department ?? null, dto.designation ?? null],
    );

    // Keep the denormalized employee_name on evaluations in sync with the
    // canonical master name so reporting aggregates stay consistent.
    if (name && name !== existing[0].name) {
      await this.db.query(
        `UPDATE performance_evaluations SET employee_name = $1, updated_at = NOW()
         WHERE employee_id = $2 AND is_deleted = FALSE`,
        [name, id],
      );
    }
    return this.mapRow(rows[0]);
  }

  async delete(id: string): Promise<void> {
    const { rows } = await this.db.query(
      `SELECT email FROM employee_master WHERE id = $1`,
      [id],
    );
    if (!rows.length) throw new NotFoundException('Employee not found');

    const email = rows[0].email as string;

    const { rows: userRows } = await this.db.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
      [email],
    );
    if (userRows.length) {
      throw new ConflictException(
        'Cannot delete this employee — a user account is already registered with this email address.',
      );
    }

    // Evaluations keep their denormalized employee_name; the FK sets
    // employee_id to NULL so history survives whitelist removal.
    await this.db.query(`DELETE FROM employee_master WHERE id = $1`, [id]);
  }
}
