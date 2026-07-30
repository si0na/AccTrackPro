import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ServiceProviderService } from '../service-provider/service-provider.service';

function rowToUser(row: any) {
  return {
    id:          row.id,
    name:        row.name,
    email:       row.email,
    role:        row.role,
    roleId:      row.role_id ?? null,
    roleKey:     row.role_key ?? null,
    employeeId:  row.employee_id ?? null,
    department:  row.department ?? null,
    designation: row.designation ?? null,
    avatarData:  row.avatar_data || '',
    isActive:    row.is_active,
    lastLogin:   row.last_login ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

function rowToUserFull(row: any) {
  return {
    ...rowToUser(row),
    passwordHash:   row.password_hash,
    failedAttempts: row.failed_attempts ?? 0,
    lockedUntil:    row.locked_until    ?? null,
  };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly serviceProvider: ServiceProviderService,
  ) {}

  async findAll(): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT u.id, u.name, u.email, u.role, u.role_id, r.key AS role_key,
              u.employee_id, u.department, u.designation,
              u.avatar_data, u.is_active, u.last_login, u.created_at, u.updated_at
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.is_active = TRUE ORDER BY u.created_at DESC`,
    );
    return rows.map(rowToUser);
  }

  async findById(id: string): Promise<any | null> {
    const { rows } = await this.db.query(
      `SELECT * FROM users WHERE id = $1`,
      [id],
    );
    if (!rows.length) return null;
    return rowToUserFull(rows[0]);
  }

  async findByEmail(email: string): Promise<any | null> {
    const { rows } = await this.db.query(
      `SELECT * FROM users WHERE LOWER(email) = LOWER($1)`,
      [email],
    );
    if (!rows.length) return null;
    return rowToUserFull(rows[0]);
  }

  async create(data: {
    name: string; email: string; passwordHash: string; avatarData?: string;
    role?: string; roleId?: string | null;
    employeeId?: string | null; department?: string | null; designation?: string | null;
  }): Promise<any> {
    // role text defaults to the DB default ('Account Manager') when not provided,
    // and is kept in sync with role_id (used as the JWT display claim).
    const { rows } = await this.db.query(
      `INSERT INTO users
         (id, name, email, password_hash, avatar_data,
          role, role_id, employee_id, department, designation)
       VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4,
               COALESCE($5, 'Account Manager'), $6, $7, $8, $9)
       RETURNING *`,
      [
        data.name, data.email, data.passwordHash, data.avatarData ?? '',
        data.role ?? null, data.roleId ?? null,
        data.employeeId ?? null, data.department ?? null, data.designation ?? null,
      ],
    );
    return rowToUserFull(rows[0]);
  }

  /**
   * Administrator edit of a user's role / profile / active status. Only provided
   * fields change. When roleId is set, the denormalised role text is kept in
   * sync (it backs the JWT display claim). Returns the updated user.
   */
  async adminUpdate(id: string, data: {
    roleId?: string | null; roleName?: string | null;
    department?: string | null; designation?: string | null;
    employeeId?: string | null; isActive?: boolean;
  }): Promise<any> {
    const { rows: existingRows } = await this.db.query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (!existingRows.length) throw new NotFoundException('User not found');

    const { rows } = await this.db.query(
      `UPDATE users SET
         role_id     = COALESCE($2, role_id),
         role        = COALESCE($3, role),
         department  = COALESCE($4, department),
         designation = COALESCE($5, designation),
         employee_id = COALESCE($6, employee_id),
         is_active   = COALESCE($7, is_active),
         updated_at  = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.roleId ?? null,
        data.roleId ? (data.roleName ?? null) : null,
        data.department ?? null,
        data.designation ?? null,
        data.employeeId ?? null,
        typeof data.isActive === 'boolean' ? data.isActive : null,
      ],
    );

    // Keep the user's Service Provider stakeholders in sync with their identity
    // fields (name/department/designation/email). Never fails the user update.
    try {
      await this.serviceProvider.syncFromUser(id);
    } catch (err) {
      this.logger.error(
        `Service Provider sync after user update failed [userId=${id}]`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    return rowToUser(rows[0]);
  }

  async updateAvatar(id: string, avatarData: string): Promise<any> {
    const { rows } = await this.db.query(
      `UPDATE users SET avatar_data = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [avatarData, id],
    );
    if (!rows.length) throw new NotFoundException('User not found');
    return rowToUser(rows[0]);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, id],
    );
  }

  async incrementFailedAttempts(id: string, count: number): Promise<void> {
    await this.db.query(
      `UPDATE users SET failed_attempts = $1, updated_at = NOW() WHERE id = $2`,
      [count, id],
    );
  }

  async lockAccount(id: string, lockedUntil: Date, failedAttempts: number): Promise<void> {
    await this.db.query(
      `UPDATE users SET locked_until = $1, failed_attempts = $2, updated_at = NOW() WHERE id = $3`,
      [lockedUntil, failedAttempts, id],
    );
  }

  async onLoginSuccess(id: string): Promise<void> {
    await this.db.query(
      `UPDATE users
       SET failed_attempts = 0, locked_until = NULL, last_login = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
  }
}
