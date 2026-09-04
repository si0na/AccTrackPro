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
    roleIds:     row.role_ids ?? [],
    roleKeys:    row.role_keys ?? [],
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
      `SELECT 
         COALESCE(u.id, em.id) AS id,
         COALESCE(NULLIF(u.name, ''), NULLIF(em.name, ''), u.email, em.email) AS name,
         COALESCE(u.email, em.email) AS email,
         COALESCE(u.role, r.name, '') AS role,
         COALESCE(u.role_id, em.role_id) AS role_id,
         r.key AS role_key,
         COALESCE(u.employee_id, em.employee_id) AS employee_id,
         COALESCE(u.department, em.department) AS department,
         COALESCE(u.designation, em.designation) AS designation,
         COALESCE(u.avatar_data, '') AS avatar_data,
         COALESCE(u.is_active, TRUE) AS is_active,
         u.last_login,
         COALESCE(u.created_at, em.created_at) AS created_at,
         u.updated_at,
         COALESCE(ur.role_ids, er.role_ids, CASE WHEN em.role_id IS NOT NULL THEN ARRAY[em.role_id] ELSE ARRAY[]::TEXT[] END) AS role_ids,
         COALESCE(ur.role_keys, er.role_keys, CASE WHEN r.key IS NOT NULL THEN ARRAY[r.key] ELSE ARRAY[]::TEXT[] END) AS role_keys
       FROM employee_master em
       FULL OUTER JOIN users u ON LOWER(u.email) = LOWER(em.email)
       LEFT JOIN roles r ON r.id = COALESCE(u.role_id, em.role_id)
       LEFT JOIN LATERAL (
         SELECT array_agg(rr.id ORDER BY rr.is_system DESC, rr.name ASC) AS role_ids,
                array_agg(rr.key ORDER BY rr.is_system DESC, rr.name ASC) AS role_keys
         FROM user_roles x
         JOIN roles rr ON rr.id = x.role_id
         WHERE x.user_id = u.id
       ) ur ON TRUE
       LEFT JOIN LATERAL (
         SELECT array_agg(rr.id ORDER BY rr.is_system DESC, rr.name ASC) AS role_ids,
                array_agg(rr.key ORDER BY rr.is_system DESC, rr.name ASC) AS role_keys
         FROM employee_roles x
         JOIN roles rr ON rr.id = x.role_id
         WHERE x.employee_id = em.id
       ) er ON TRUE
       WHERE COALESCE(u.is_active, TRUE) = TRUE
       ORDER BY COALESCE(u.name, em.name) ASC`,
    );
    return rows.map(rowToUser);
  }

  /**
   * All system users as Service Provider options — no is_active filter.
   * Every person who exists as a System User is available as a Service Provider,
   * regardless of registration or active status.
   */
  async findAllAsServiceProviders(): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT u.id, u.name, u.email, u.department, u.designation, u.is_active,
              (u.name IS NULL OR u.name = '') AS is_pending
       FROM users u
       ORDER BY u.name ASC NULLS LAST, u.email ASC`,
    );
    return rows.map((r) => ({
      id:          r.id,
      name:        r.name ?? '',
      email:       r.email ?? '',
      department:  r.department ?? '',
      designation: r.designation ?? '',
      isActive:    r.is_active,
      isPending:   r.is_pending,
    }));
  }


  /**
   * All active users (registered System Users + pending registration employees)
   * who hold the given role key (e.g. 'practice-lead', 'client-partner', 'vertical-head', 'project-manager').
   * Used by role-filtered pickers.
   */
  async findByRole(roleKey: string): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT DISTINCT
         COALESCE(u.id, em.id) AS id,
         COALESCE(NULLIF(u.name, ''), NULLIF(em.name, ''), u.email, em.email) AS name,
         COALESCE(u.email, em.email) AS email,
         COALESCE(u.department, em.department) AS department,
         COALESCE(u.designation, em.designation) AS designation,
         COALESCE(u.is_active, TRUE) AS is_active,
         (u.id IS NULL OR u.name IS NULL OR u.name = '') AS is_pending
       FROM employee_master em
       FULL OUTER JOIN users u ON LOWER(u.email) = LOWER(em.email)
       LEFT JOIN roles r ON r.id = COALESCE(u.role_id, em.role_id)
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles ur_r ON ur_r.id = ur.role_id
       LEFT JOIN employee_roles er ON er.employee_id = em.id
       LEFT JOIN roles er_r ON er_r.id = er.role_id
       WHERE COALESCE(u.is_active, TRUE) = TRUE
         AND (
           r.key = $1 OR ur_r.key = $1 OR er_r.key = $1
           OR ($1 = 'project-manager' AND (LOWER(COALESCE(u.designation, em.designation, '')) LIKE '%project manager%' OR LOWER(COALESCE(u.role, r.name, '')) LIKE '%project manager%'))
           OR ($1 = 'practice-lead' AND (LOWER(COALESCE(u.designation, em.designation, '')) LIKE '%practice lead%' OR LOWER(COALESCE(u.role, r.name, '')) LIKE '%practice lead%'))
           OR ($1 = 'client-partner' AND (LOWER(COALESCE(u.designation, em.designation, '')) LIKE '%client partner%' OR LOWER(COALESCE(u.role, r.name, '')) LIKE '%client partner%'))
           OR ($1 = 'vertical-head' AND (LOWER(COALESCE(u.designation, em.designation, '')) LIKE '%vertical head%' OR LOWER(COALESCE(u.role, r.name, '')) LIKE '%vertical head%'))
           OR ($1 = 'account-manager' AND (LOWER(COALESCE(u.designation, em.designation, '')) LIKE '%account manager%' OR LOWER(COALESCE(u.role, r.name, '')) LIKE '%account manager%'))
         )
       ORDER BY COALESCE(NULLIF(u.name, ''), NULLIF(em.name, ''), u.email, em.email) ASC NULLS LAST`,
      [roleKey],
    );
    return rows.map((r) => ({
      id:          r.id,
      name:        r.name ?? '',
      email:       r.email ?? '',
      department:  r.department ?? '',
      designation: r.designation ?? '',
      isActive:    r.is_active,
      isPending:   Boolean(r.is_pending),
    }));
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
    name?: string | null;
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
         name        = COALESCE($8, name),
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
        data.name ?? null,
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
