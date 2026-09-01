import { BadRequestException } from '@nestjs/common';
import { assertNotFutureDate, isFutureDateString } from './project-progress.service';

describe('ProjectProgressService Date Validation', () => {
  const originalDate = global.Date;

  beforeAll(() => {
    // Mock date to 2026-09-01
    const mockToday = new Date('2026-09-01T12:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
      if (args.length) {
        return new (originalDate as any)(...args);
      }
      return mockToday;
    });
    Date.prototype.toLocaleDateString = jest.fn().mockImplementation(function (this: Date, locale?: string) {
      if (locale === 'en-CA') return '2026-09-01';
      return originalDate.prototype.toLocaleDateString.call(this, locale);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should identify past date (31-Aug-2026) as not a future date', () => {
    expect(isFutureDateString('2026-08-31')).toBe(false);
    expect(() => assertNotFutureDate('2026-08-31')).not.toThrow();
  });

  it('should identify today (01-Sep-2026) as allowed', () => {
    expect(isFutureDateString('2026-09-01')).toBe(false);
    expect(() => assertNotFutureDate('2026-09-01')).not.toThrow();
  });

  it('should identify future date (02-Sep-2026) as invalid and throw BadRequestException', () => {
    expect(isFutureDateString('2026-09-02')).toBe(true);
    expect(() => assertNotFutureDate('2026-09-02')).toThrow(BadRequestException);
    expect(() => assertNotFutureDate('2026-09-02')).toThrow('Progress date cannot be a future date');
  });
});
