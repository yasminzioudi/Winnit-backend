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

    expect(total).toBe(600000);
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
});
