import {
  expenseTotalForPeriod,
  ExpenseDomain,
} from './expenses';

describe('expenseTotalForPeriod', () => {
  it('calculates single monthly expense within single month', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 1200000, // 1,200 TND rent
        periodType: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
      },
    ];

    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-31T23:59:59Z'),
    );

    expect(total).toBe(1200000);
  });

  it('multiplies monthly expense over multi-month period', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 500000,
        periodType: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
      },
    ];

    // 3 months: Jan, Feb, Mar
    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-03-31T23:59:59Z'),
    );

    expect(total).toBe(1500000);
  });

  it('respects monthly expense endDate', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 300000,
        periodType: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-02-15T00:00:00Z'), // ends in Feb
      },
    ];

    // Period is Jan through April (4 months), but expense ends in Feb (2 months active)
    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-04-30T23:59:59Z'),
    );

    // Pro-rated by day: Jan full (300000) + Feb 15/28 days (160714)
    expect(total).toBe(460714);
  });

  it('includes one-time expense falling within period', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 150000,
        periodType: 'one-time',
        startDate: new Date('2026-01-15T10:00:00Z'),
      },
    ];

    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-31T23:59:59Z'),
    );

    expect(total).toBe(150000);
  });

  it('excludes one-time expense outside period', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 150000,
        periodType: 'one-time',
        startDate: new Date('2025-12-31T23:59:59Z'),
      },
    ];

    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-31T23:59:59Z'),
    );

    expect(total).toBe(0);
  });

  it('correctly aggregates mixed monthly and one-time expenses', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 1000000, // Monthly: 1000 TND * 2 months = 2,000 TND
        periodType: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
      },
      {
        amountMillimes: 250000, // One-time inside period
        periodType: 'one-time',
        startDate: new Date('2026-02-10T12:00:00Z'),
      },
      {
        amountMillimes: 400000, // One-time outside period (March)
        periodType: 'one-time',
        startDate: new Date('2026-03-05T12:00:00Z'),
      },
    ];

    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-02-28T23:59:59Z'),
    );

    expect(total).toBe(2250000); // 2,000,000 + 250,000
  });

  it('returns 0 if periodStart is after periodEnd', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 500000,
        periodType: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
      },
    ];

    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-02-01T00:00:00Z'),
      new Date('2026-01-01T00:00:00Z'),
    );

    expect(total).toBe(0);
  });

  it('pro-rates monthly expense for partial month (window inside one month)', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 3100000, // 3,100 TND / month
        periodType: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
      },
    ];

    // 10 days of January (Jan 1-10): 3100000 * 10 / 31 = 1000000
    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-10T23:59:59Z'),
    );

    expect(total).toBe(1000000);
  });

  it('pro-rates 30-day window spanning two months to about one monthly amount', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 3150000, // 3,150 TND / month
        periodType: 'monthly',
        startDate: new Date('2025-11-01T00:00:00Z'),
      },
    ];

    // Oct 3 - Nov 2: 29 days of Oct (31 total) + 2 days of Nov (30 total)
    // Oct: Math.round(3150000 * 29 / 31) = 2946774
    // Nov: Math.round(3150000 * 2 / 30) = 210000
    // Total: 3156774
    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-10-03T00:00:00Z'),
      new Date('2026-11-02T23:59:59Z'),
    );

    expect(total).toBe(3156774);
  });

  it('charges exact monthly amount for whole calendar month', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 1234567,
        periodType: 'monthly',
        startDate: new Date('2026-01-01T00:00:00Z'),
      },
    ];

    // Entire January: 31/31 days
    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-31T23:59:59Z'),
    );

    expect(total).toBe(1234567);
  });

  it('handles expense starting mid-window', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 600000, // 600 TND / month
        periodType: 'monthly',
        startDate: new Date('2026-01-15T12:00:00Z'), // starts Jan 15
      },
    ];

    // Window Jan 1 - Jan 31, but expense starts Jan 15
    // Jan 15-31: 17 days of 31 = 600000 * 17 / 31 = 329032
    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-31T23:59:59Z'),
    );

    expect(total).toBe(329032);
  });

  it('includes one-time expense inside window, excludes outside', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 100000,
        periodType: 'one-time',
        startDate: new Date('2026-01-15T10:00:00Z'),
      },
      {
        amountMillimes: 200000,
        periodType: 'one-time',
        startDate: new Date('2026-02-15T10:00:00Z'), // outside
      },
    ];

    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-31T23:59:59Z'),
    );

    expect(total).toBe(100000);
  });

  it('returns 0 for expense with endDate before the window', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 500000,
        periodType: 'monthly',
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2025-12-31T23:59:59Z'), // ends before 2026
      },
    ];

    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-31T23:59:59Z'),
    );

    expect(total).toBe(0);
  });

  it('charges exact monthly amount for leap year February (29 days)', () => {
    const expenses: ExpenseDomain[] = [
      {
        amountMillimes: 2900000, // 2,900 TND / month
        periodType: 'monthly',
        startDate: new Date('2024-01-01T00:00:00Z'), // 2024 is leap year
      },
    ];

    // Entire February 2024: 29/29 days
    const total = expenseTotalForPeriod(
      expenses,
      new Date('2024-02-01T00:00:00Z'),
      new Date('2024-02-29T23:59:59Z'),
    );

    expect(total).toBe(2900000);
  });

  it('computes seed expenses total for default 30-day window ending 2026-11-02', () => {
    // Seed expenses: 6 monthly expenses starting 2025-11-01
    // Rent: 800,000, Salary 1: 1,200,000, Salary 2: 600,000
    // Utilities: 200,000, Logistics: 200,000, Marketing: 150,000
    // Total: 3,150,000 per month
    const expenses: ExpenseDomain[] = [
      { amountMillimes: 800000, periodType: 'monthly', startDate: new Date('2025-11-01T00:00:00Z') },
      { amountMillimes: 1200000, periodType: 'monthly', startDate: new Date('2025-11-01T00:00:00Z') },
      { amountMillimes: 600000, periodType: 'monthly', startDate: new Date('2025-11-01T00:00:00Z') },
      { amountMillimes: 200000, periodType: 'monthly', startDate: new Date('2025-11-01T00:00:00Z') },
      { amountMillimes: 200000, periodType: 'monthly', startDate: new Date('2025-11-01T00:00:00Z') },
      { amountMillimes: 150000, periodType: 'monthly', startDate: new Date('2025-11-01T00:00:00Z') },
    ];

    // 30 days back from 2026-11-02: Oct 3 - Nov 2
    // Oct: 29 days of 31 total
    // Nov: 2 days of 30 total
    const total = expenseTotalForPeriod(
      expenses,
      new Date('2026-10-03T00:00:00Z'),
      new Date('2026-11-02T23:59:59Z'),
    );

    // Oct: Math.round(3150000 * 29 / 31) = 2946774
    // Nov: Math.round(3150000 * 2 / 30) = 210000
    // Total: 3156774 (about one month's worth)
    expect(total).toBe(3156774);
  });
});

