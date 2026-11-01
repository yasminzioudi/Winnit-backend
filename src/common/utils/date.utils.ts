/**
 * Date utilities for analytics (Africa/Tunis timezone)
 */

export const TUNIS_TIMEZONE = 'Africa/Tunis';

/**
 * Returns ISO string for start of day in Tunis timezone
 */
export function startOfDayTunis(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Returns ISO string for end of day in Tunis timezone
 */
export function endOfDayTunis(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/**
 * Parse ISO date string to Date
 */
export function parseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateString}`);
  }
  return date;
}
