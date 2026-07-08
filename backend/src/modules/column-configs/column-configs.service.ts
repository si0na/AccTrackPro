import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ColumnConfig } from '../../types';

@Injectable()
export class ColumnConfigsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(userId: string): Promise<{ rawAccountsConfig: ColumnConfig[]; rawOpportunitiesConfig: ColumnConfig[]; rawActionItemsConfig: ColumnConfig[]; rawPerformanceEvaluationConfig: ColumnConfig[] }> {
    const { rows } = await this.db.query(
      `SELECT module, config FROM column_configs WHERE user_id = $1`,
      [userId],
    );
    const get = (mod: string): ColumnConfig[] =>
      (rows.find((r: any) => r.module === mod)?.config ?? []) as ColumnConfig[];
    return {
      rawAccountsConfig: get('accounts'),
      rawOpportunitiesConfig: get('opportunities'),
      rawActionItemsConfig: get('actionItems'),
      rawPerformanceEvaluationConfig: get('performanceEvaluation'),
    };
  }

  async save(userId: string, body: {
    rawAccountsConfig?: ColumnConfig[];
    rawOpportunitiesConfig?: ColumnConfig[];
    rawActionItemsConfig?: ColumnConfig[];
    rawPerformanceEvaluationConfig?: ColumnConfig[];
  }): Promise<{ success: boolean }> {
    const upsert = async (module: string, config: ColumnConfig[]) => {
      await this.db.query(
        `INSERT INTO column_configs (user_id, module, config, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, module) DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()`,
        [userId, module, JSON.stringify(config)],
      );
    };
    if (body.rawAccountsConfig) await upsert('accounts', body.rawAccountsConfig);
    if (body.rawOpportunitiesConfig) await upsert('opportunities', body.rawOpportunitiesConfig);
    if (body.rawActionItemsConfig) await upsert('actionItems', body.rawActionItemsConfig);
    if (body.rawPerformanceEvaluationConfig) await upsert('performanceEvaluation', body.rawPerformanceEvaluationConfig);
    return { success: true };
  }
}
