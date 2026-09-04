import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateNpsDto, UpdateNpsDto } from './dto/nps.dto';

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

function rowToNps(row: any) {
  return {
    id:                     row.id,
    accountId:              row.account_id,
    accountName:            row.account_name ?? '',
    projectId:              row.project_id ?? null,
    projectName:            row.project_name ?? null,
    respondentId:           row.respondent_id ?? null,
    respondentName:         row.respondent_name || row.stakeholder_name || '',
    respondentDesignation:  row.stakeholder_designation || '',
    receivedMonthYear:      row.received_month_year,
    quarter:                row.quarter,
    npsScore:               Number(row.nps_score),
    likedMost:              row.liked_most ?? '',
    improvementSuggestions: row.improvement_suggestions ?? '',
    createdAt:              row.created_at,
    updatedAt:              row.updated_at,
  };
}

@Injectable()
export class NpsService {
  private readonly logger = new Logger(NpsService.name);

  constructor(private readonly db: DatabaseService) {}

  async findAll(params: { accountId?: string; projectId?: string }): Promise<any[]> {
    const conditions: string[] = ['n.is_deleted = FALSE'];
    const qParams: any[] = [];

    if (params.accountId) {
      qParams.push(params.accountId);
      conditions.push(`n.account_id = $${qParams.length}`);
    }
    if (params.projectId) {
      qParams.push(params.projectId);
      conditions.push(`n.project_id = $${qParams.length}`);
    }

    const where = conditions.join(' AND ');
    const { rows } = await this.db.query(
      `SELECT n.*,
              a.name AS account_name,
              p.name AS project_name,
              s.name AS stakeholder_name,
              s.designation AS stakeholder_designation
       FROM nps_responses n
       INNER JOIN accounts a ON n.account_id = a.id AND a.is_deleted = FALSE
       LEFT  JOIN projects p ON n.project_id = p.id AND p.is_deleted = FALSE
       LEFT  JOIN stakeholders s ON n.respondent_id = s.id
       WHERE ${where}
       ORDER BY n.received_month_year DESC, n.created_at DESC`,
      qParams,
    );

    return rows.map(rowToNps);
  }

  async findOne(id: string): Promise<any> {
    const { rows } = await this.db.query(
      `SELECT n.*,
              a.name AS account_name,
              p.name AS project_name,
              s.name AS stakeholder_name,
              s.designation AS stakeholder_designation
       FROM nps_responses n
       INNER JOIN accounts a ON n.account_id = a.id AND a.is_deleted = FALSE
       LEFT  JOIN projects p ON n.project_id = p.id AND p.is_deleted = FALSE
       LEFT  JOIN stakeholders s ON n.respondent_id = s.id
       WHERE n.id = $1 AND n.is_deleted = FALSE`,
      [id],
    );

    if (!rows.length) {
      throw new NotFoundException(`NPS Response "${id}" not found`);
    }

    return rowToNps(rows[0]);
  }

  async create(dto: CreateNpsDto): Promise<any> {
    if (dto.npsScore < 0 || dto.npsScore > 10) {
      throw new BadRequestException('NPS score must be between 0 and 10');
    }

    const quarter = deriveQuarterFromMonthYear(dto.receivedMonthYear);

    const { rows } = await this.db.query(
      `INSERT INTO nps_responses (
         id, account_id, project_id, respondent_id, respondent_name,
         received_month_year, quarter, nps_score, liked_most, improvement_suggestions
       )
       VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        dto.accountId,
        dto.projectId || null,
        dto.respondentId || null,
        dto.respondentName || null,
        dto.receivedMonthYear,
        quarter,
        dto.npsScore,
        dto.likedMost || '',
        dto.improvementSuggestions || '',
      ],
    );

    this.logger.log(`Created NPS Response [id=${rows[0].id} accountId=${dto.accountId} score=${dto.npsScore}]`);
    return this.findOne(rows[0].id);
  }

  async update(id: string, dto: Partial<CreateNpsDto>): Promise<any> {
    const existing = await this.findOne(id);

    const npsScore = dto.npsScore !== undefined ? dto.npsScore : existing.npsScore;
    if (npsScore < 0 || npsScore > 10) {
      throw new BadRequestException('NPS score must be between 0 and 10');
    }

    const receivedMonthYear = dto.receivedMonthYear || existing.receivedMonthYear;
    const quarter = deriveQuarterFromMonthYear(receivedMonthYear);

    await this.db.query(
      `UPDATE nps_responses SET
         account_id = $1,
         project_id = $2,
         respondent_id = $3,
         respondent_name = $4,
         received_month_year = $5,
         quarter = $6,
         nps_score = $7,
         liked_most = $8,
         improvement_suggestions = $9,
         updated_at = NOW()
       WHERE id = $10 AND is_deleted = FALSE`,
      [
        dto.accountId || existing.accountId,
        dto.projectId !== undefined ? (dto.projectId || null) : existing.projectId,
        dto.respondentId !== undefined ? (dto.respondentId || null) : existing.respondentId,
        dto.respondentName !== undefined ? (dto.respondentName || null) : existing.respondentName,
        receivedMonthYear,
        quarter,
        npsScore,
        dto.likedMost !== undefined ? dto.likedMost : existing.likedMost,
        dto.improvementSuggestions !== undefined ? dto.improvementSuggestions : existing.improvementSuggestions,
        id,
      ],
    );

    return this.findOne(id);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.db.query(
      `UPDATE nps_responses SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    return { success: true };
  }
}
