import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { NotificationEventBus } from '../../common/events/notification-event-bus.service';
import {
  DEFAULT_QUARTERS,
  FYQuarterDef,
  QuarterRange,
  buildQuarterRanges,
  fyDateRange,
  fyLabelFor,
} from '../../common/utils/fiscal.util';

interface FinancialYear {
  id: string;
  fyLabel: string;
  startYear: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  quarters: QuarterRange[];
  calendarStartMonth: number;
  calendarQuarters: FYQuarterDef[];
}

/** Map a DB row (which must include calendar_start_month + calendar_quarters) to a FinancialYear. */
function rowToFY(row: any): FinancialYear {
  const calStartMonth: number       = row.calendar_start_month ?? 4;
  const calQuarters:   FYQuarterDef[] = row.calendar_quarters ?? DEFAULT_QUARTERS;
  return {
    id:                  row.id,
    fyLabel:             row.fy_label,
    startYear:           row.start_year,
    startDate:           row.start_date,
    endDate:             row.end_date,
    isActive:            row.is_active,
    quarters:            buildQuarterRanges(row.start_year, calStartMonth, calQuarters),
    calendarStartMonth:  calStartMonth,
    calendarQuarters:    calQuarters,
  };
}

const SELECT_COLS = `
  id, fy_label, start_year,
  start_date::TEXT         AS start_date,
  end_date::TEXT           AS end_date,
  is_active,
  calendar_start_month,
  calendar_quarters
`;

@Injectable()
export class FinancialYearsService {
  private readonly logger = new Logger(FinancialYearsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly bus: NotificationEventBus,
  ) {}

  /** Fetch current global calendar template — used only when creating a new FY. */
  private async getCalendarTemplate(): Promise<{ startMonth: number; quarters: FYQuarterDef[] }> {
    const { rows } = await this.db.query(
      `SELECT start_month, quarters FROM financial_calendar WHERE id = 'default'`,
    );
    if (!rows.length) return { startMonth: 4, quarters: DEFAULT_QUARTERS };
    return { startMonth: rows[0].start_month, quarters: rows[0].quarters as FYQuarterDef[] };
  }

  async findAll(): Promise<FinancialYear[]> {
    const { rows } = await this.db.query(
      `SELECT ${SELECT_COLS} FROM financial_years ORDER BY start_year ASC`,
    );
    return rows.map(rowToFY);
  }

  async create(data: { startYear: number }, userId?: string): Promise<FinancialYear> {
    const { startYear } = data;

    // Snapshot the current calendar template into this FY permanently.
    const { startMonth, quarters } = await this.getCalendarTemplate();

    const { startDate, endDate } = fyDateRange(startYear, startMonth);
    const fyLabel = fyLabelFor(startYear, startMonth);

    // ON CONFLICT: if the FY already exists, just re-activate it.
    // calendar_start_month and calendar_quarters are NOT updated on conflict — only new FYs
    // receive a calendar snapshot, preserving the versioning invariant.
    const { rows } = await this.db.query(
      `INSERT INTO financial_years
         (id, fy_label, start_year, start_date, end_date, is_active,
          calendar_start_month, calendar_quarters)
       VALUES
         (gen_random_uuid()::TEXT, $1, $2, $3::DATE, $4::DATE, TRUE, $5, $6::JSONB)
       ON CONFLICT (fy_label) DO UPDATE SET is_active = TRUE
       RETURNING ${SELECT_COLS}`,
      [fyLabel, startYear, startDate, endDate, startMonth, JSON.stringify(quarters)],
    );
    const fy = rowToFY(rows[0]);

    if (userId) {
      this.bus.emit({
        userId,
        type:                 'System',
        eventType:            'FYCreated',
        title:                'Financial Year Added',
        message:              `FY ${fy.fyLabel} (${fy.startDate} – ${fy.endDate}) has been added to the system.`,
        severity:             'Success',
        notificationCategory: 'SYSTEM',
      });
    } else {
      this.logger.warn(`Financial year ${fyLabel} created without userId — no notification emitted`);
    }

    return fy;
  }

  async activate(id: string): Promise<FinancialYear> {
    const { rows } = await this.db.query(
      `UPDATE financial_years SET is_active = TRUE
       WHERE id = $1
       RETURNING ${SELECT_COLS}`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Financial year "${id}" not found`);
    return rowToFY(rows[0]);
  }

  async deactivate(id: string): Promise<FinancialYear> {
    const { rows } = await this.db.query(
      `UPDATE financial_years SET is_active = FALSE
       WHERE id = $1
       RETURNING ${SELECT_COLS}`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Financial year "${id}" not found`);
    return rowToFY(rows[0]);
  }

  async updateCalendar(id: string, data: { startMonth: number; quarters: FYQuarterDef[] }): Promise<FinancialYear> {
    const { startMonth, quarters } = data;
    const { rows } = await this.db.query(
      `UPDATE financial_years
       SET calendar_start_month = $2, calendar_quarters = $3::JSONB
       WHERE id = $1
       RETURNING ${SELECT_COLS}`,
      [id, startMonth, JSON.stringify(quarters)],
    );
    if (!rows.length) throw new NotFoundException(`Financial year "${id}" not found`);
    return rowToFY(rows[0]);
  }
}
