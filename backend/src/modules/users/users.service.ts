import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

function rowToUser(row: any) {
  return {
    id:         row.id,
    name:       row.name,
    email:      row.email,
    role:       row.role,
    avatarData: row.avatar_data || '',
    isActive:   row.is_active,
    lastLogin:  row.last_login ?? null,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
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
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<any[]> {
    const { rows } = await this.db.query(
      `SELECT id, name, email, role, avatar_data, is_active, last_login, created_at, updated_at
       FROM users WHERE is_active = TRUE ORDER BY created_at DESC`,
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
  }): Promise<any> {
    const { rows } = await this.db.query(
      `INSERT INTO users (id, name, email, password_hash, avatar_data)
       VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.email, data.passwordHash, data.avatarData ?? ''],
    );
    return rowToUserFull(rows[0]);
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
