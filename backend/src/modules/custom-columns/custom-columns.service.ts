import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CustomColumn } from '../../types';

function rowToColumn(row: any): CustomColumn {
  const { created_at, module, user_id, ...base } = row;
  return base as CustomColumn;
}

@Injectable()
export class CustomColumnsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(userId: string): Promise<{ accountColumns: CustomColumn[]; opportunityColumns: CustomColumn[]; actionItemColumns: CustomColumn[]; performanceEvaluationColumns: CustomColumn[] }> {
    const { rows } = await this.db.query(
      `SELECT * FROM custom_columns WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
    );
    return {
      accountColumns: rows.filter((r: any) => r.module === 'accounts').map(rowToColumn),
      opportunityColumns: rows.filter((r: any) => r.module === 'opportunities').map(rowToColumn),
      actionItemColumns: rows.filter((r: any) => r.module === 'actionItems').map(rowToColumn),
      performanceEvaluationColumns: rows.filter((r: any) => r.module === 'performanceEvaluation').map(rowToColumn),
    };
  }

  async create(userId: string, body: { module: 'accounts' | 'opportunities' | 'actionItems' | 'performanceEvaluation'; name: string; type: 'text' | 'number' | 'date' | 'boolean' }): Promise<CustomColumn> {
    // Business rule: column names are unique per module for each user.
    const { rows: dup } = await this.db.query(
      `SELECT id FROM custom_columns
       WHERE user_id = $1 AND module = $2 AND LOWER(name) = LOWER($3)`,
      [userId, body.module, body.name.trim()],
    );
    if (dup.length) {
      throw new ConflictException(`A column named "${body.name.trim()}" already exists in this module`);
    }

    const key = `custom_${body.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const { rows } = await this.db.query(
      `INSERT INTO custom_columns (id, user_id, module, key, name, type)
       VALUES (gen_random_uuid()::TEXT, $1,$2,$3,$4,$5)
       RETURNING *`,
      [userId, body.module, key, body.name, body.type],
    );
    return rowToColumn(rows[0]);
  }

  async remove(userId: string, module: string, id: string): Promise<{ success: boolean }> {
    const { rowCount } = await this.db.query(
      `DELETE FROM custom_columns WHERE id = $1 AND module = $2 AND user_id = $3`,
      [id, module, userId],
    );
    if (!rowCount) throw new NotFoundException(`Custom column "${id}" not found`);
    return { success: true };
  }
}
