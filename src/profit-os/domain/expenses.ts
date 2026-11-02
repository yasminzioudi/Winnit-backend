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
 * - Pro-rated by day in Africa/Tunis timezone.
 * - For each calendar month M overlapped by [periodStart, periodEnd] and the expense's active range:
 *   charge amountMillimes × overlappingDays / daysInMonth, rounded once per month with Math.round.
 * - Full calendar months give exactly the monthly amount.
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
        // Pro-rate by day for each overlapping month
        for (let monthIdx = overlapStart; monthIdx <= overlapEnd; monthIdx++) {
          const year = Math.floor(monthIdx / 12);
          const month = monthIdx % 12;
          
          // Month boundaries in UTC
          const monthStart = new Date(Date.UTC(year, month, 1));
          const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
          const daysInMonth = monthEnd.getUTCDate();
          
          // Overlap between [periodStart, periodEnd] and this month
          const overlapStartTime = Math.max(periodStart.getTime(), monthStart.getTime());
          const overlapEndTime = Math.min(periodEnd.getTime(), monthEnd.getTime());
          
          // Overlap with expense's active range
          const expStartTime = exp.startDate.getTime();
          const expEndTime = exp.endDate ? exp.endDate.getTime() : Infinity;
          
          const effectiveStartTime = Math.max(overlapStartTime, expStartTime);
          const effectiveEndTime = Math.min(overlapEndTime, expEndTime);
          
          if (effectiveStartTime <= effectiveEndTime) {
            // Count days: convert milliseconds to days, add 1 for inclusive range
            const startDay = Math.floor((effectiveStartTime - monthStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
            const endDay = Math.floor((effectiveEndTime - monthStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
            const overlappingDays = endDay - startDay + 1;
            
            // Pro-rate and round
            const monthCharge = Math.round((exp.amountMillimes * overlappingDays) / daysInMonth);
            totalMillimes += monthCharge;
          }
        }
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

