import { BadRequestException } from '@nestjs/common';

export function isFutureDateString(dateStr: string): boolean {
  if (!dateStr) return false;
  const rawDate = dateStr.slice(0, 10);
  const todayStr = new Date().toLocaleDateString('en-CA');
  return rawDate > todayStr;
}

export function assertNotFutureDate(dateStr?: string): void {
  if (!dateStr) return;
  if (isFutureDateString(dateStr)) {
    throw new BadRequestException('Progress date cannot be a future date');
  }
}
