import { BadRequestException } from '@nestjs/common';

/**
 * Opt-in server-side pagination.
 *
 * List endpoints keep returning plain arrays when no `page` param is sent —
 * the existing API contract is unchanged. When `?page=N` (1-based) is present
 * the endpoint returns a `Paginated<T>` envelope instead.
 */
export interface Pagination {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * Parse `page` / `pageSize` query params. Returns null when `page` is absent
 * (legacy full-list behaviour); throws 400 on malformed values.
 */
export function parsePagination(page?: string, pageSize?: string): Pagination | null {
  if (page === undefined || page === '') return null;

  const p = Number(page);
  if (!Number.isInteger(p) || p < 1) {
    throw new BadRequestException('page must be a positive integer');
  }

  let size = DEFAULT_PAGE_SIZE;
  if (pageSize !== undefined && pageSize !== '') {
    size = Number(pageSize);
    if (!Number.isInteger(size) || size < 1) {
      throw new BadRequestException('pageSize must be a positive integer');
    }
    size = Math.min(size, MAX_PAGE_SIZE);
  }

  return { page: p, pageSize: size, limit: size, offset: (p - 1) * size };
}

/**
 * Extract the window-function total (`COUNT(*) OVER() AS __total`) from a
 * paginated result set and strip the helper column so row-mappers that spread
 * the row never leak it into API responses.
 */
export function extractTotal(rows: any[]): number {
  const total = rows.length ? Number(rows[0].__total) : 0;
  for (const row of rows) delete row.__total;
  return total;
}
