/**
 * Pure domain functions for fixed and one-time expenses.
 * Zero NestJS / Mongoose imports.
 */

export type ExpensePeriodType = 'monthly' | 'one-time';

export interface ExpenseDomain {
  amountMillimes: number;
  periodType: ExpensePeriodType;
  startDate: Date;
  endDate?: Date;
}

/**
 * Calculates total expenses (in integer millimes) active during the period [periodStart, periodEnd].
 *
 * For 'monthly' expenses:
 * - A calendar month M is counted if it falls within [periodStart, periodEnd].
 * - The expense is charged in month M if M >= expense.startDate's month
 *   and (expense.endDate is undefined OR M <= expense.endDate's month).
 * - Multiplies amountMillimes by the number of active overlapping calendar months.
 *
 * For 'one-time' expenses:
 * - Included if expense.startDate falls within [periodStart, periodEnd].
 */
export function expenseTotalForPeriod(
  expenses: ExpenseDomain[],
  periodStart: Date,
  periodEnd: Date,
): number {
  if (periodStart.getTime() > periodEnd.getTime()) {
    return 0;
  }

  const startMonthIdx =
    periodStart.getUTCFullYear() * 12 + periodStart.getUTCMonth();
  const endMonthIdx =
    periodEnd.getUTCFullYear() * 12 + periodEnd.getUTCMonth();

  let totalMillimes = 0;

  for (const exp of expenses) {
    if (exp.periodType === 'monthly') {
      const expStartMonthIdx =
        exp.startDate.getUTCFullYear() * 12 + exp.startDate.getUTCMonth();
      const expEndMonthIdx = exp.endDate
        ? exp.endDate.getUTCFullYear() * 12 + exp.endDate.getUTCMonth()
        : Infinity;

      const overlapStart = Math.max(startMonthIdx, expStartMonthIdx);
      const overlapEnd = Math.min(endMonthIdx, expEndMonthIdx);

      if (overlapStart <= overlapEnd) {
        const monthCount = overlapEnd - overlapStart + 1;
        totalMillimes += exp.amountMillimes * monthCount;
      }
    } else if (exp.periodType === 'one-time') {
      const time = exp.startDate.getTime();
      if (time >= periodStart.getTime() && time <= periodEnd.getTime()) {
        totalMillimes += exp.amountMillimes;
      }
    }
  }

  return totalMillimes;
}

