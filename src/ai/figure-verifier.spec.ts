import { verifyFigures, isValueMatching } from './figure-verifier';
import type { FinancialSnapshot } from './dto/financial-snapshot.dto';

describe('FigureVerifier & Zero-Hallucination Guard', () => {
  const mockSnapshot: FinancialSnapshot = {
    workspaceId: 'ws_maison_ambre',
    period: { from: '2026-01-01', to: '2026-03-31' },
    summary: {
      waterfall: {
        grossRevenueMillimes: 125000000,
        productCOGSMillimes: 35000000,
        outboundShippingMillimes: 14000000,
        codRefusalPenaltyMillimes: 4000000,
        paidAdSpendMillimes: 25000000,
        netRealizedContributionMillimes: 47000000,
        netRealizedContributionPercent: 37.6,
      },
      kpis: {
        totalOrdersCount: 600,
        deliveredCount: 460,
        refusedCount: 140,
        deliveryRatePercent: 76.7,
        refusalRatePercent: 23.3,
        averageOrderValueMillimes: 208333,
      },
      expenses: {
        fixedExpensesMillimes: 15000000,
        netProfitAfterExpensesMillimes: 32000000,
        netProfitMarginPercent: 25.6,
      },
    },
    byProduct: [
      {
        productId: 'prod_ambre_extrait',
        productName: 'Aura Ambre Extrait',
        totalOrders: 220,
        deliveredOrders: 180,
        refusedOrders: 40,
        grossRevenueMillimes: 52000000,
        netContributionMillimes: 22000000,
        roas: 2.8,
      },
    ],
    byCourier: [],
    byGovernorate: [],
    codAging: {
      expectedCashCollectionsMillimes: 113000000,
      bankWireSettledMillimes: 85000000,
      pendingCourierPayoutsMillimes: 28000000,
      days0to7Count: 12,
      days8to14Count: 8,
      days15to30Count: 3,
      daysOver30Count: 1,
    },
    winners: [
      {
        rank: 1,
        productId: 'prod_ambre_extrait',
        productName: 'Aura Ambre Extrait',
        score: 88,
        label: 'Winner',
      },
    ],
    insights: [],
  };

  it('matches valid direct numbers, converted TND figures, and percentages', () => {
    const validNumbers = [125000000, 32000000, 25.6, 600];

    // Direct match
    expect(isValueMatching(125000000, validNumbers)).toBe(true);
    // Converted TND (125000 TND = 125000000 millimes)
    expect(isValueMatching(125000, validNumbers)).toBe(true);
    // Converted Net profit (32000 TND = 32000000 millimes)
    expect(isValueMatching(32000, validNumbers)).toBe(true);
    // Percentage match
    expect(isValueMatching(25.6, validNumbers)).toBe(true);
    // Order count
    expect(isValueMatching(600, validNumbers)).toBe(true);

    // Completely bogus hallucinated numbers
    expect(isValueMatching(987654321, validNumbers)).toBe(false);
    expect(isValueMatching(42.5, validNumbers)).toBe(false);
  });

  it('retains verified figures and marks isVerified=true when all figures exist in snapshot', () => {
    const figures = [
      { label: 'Net Profit', value: 32000, unit: 'TND', source: 'expenses' },
      { label: 'Taux de livraison', value: 76.7, unit: '%', source: 'kpis' },
    ];
    const answer = 'Votre profit net s élève à 32 000 TND avec un taux de livraison de 76.7%.';

    const result = verifyFigures(figures, mockSnapshot, answer);

    expect(result.isVerified).toBe(true);
    expect(result.verifiedFigures).toHaveLength(2);
    expect(result.strippedFigures).toHaveLength(0);
    expect(result.adjustedAnswer).toBe(answer);
  });

  it('STRIPS hallucinated figure and appends caveat to the answer', () => {
    const figures = [
      { label: 'Net Profit', value: 32000, unit: 'TND', source: 'expenses' },
      { label: 'Chiffre d affaires imaginaire', value: 987654321, unit: 'TND', source: 'imagination' },
    ];
    const answer = 'Votre profit net est de 32 000 TND mais vous avez réalisé 987 654 321 TND.';

    const result = verifyFigures(figures, mockSnapshot, answer);

    expect(result.isVerified).toBe(false);
    // Hallucinated figure is removed
    expect(result.verifiedFigures).toHaveLength(1);
    expect(result.verifiedFigures[0].value).toBe(32000);
    expect(result.strippedFigures).toHaveLength(1);
    expect(result.strippedFigures[0].value).toBe(987654321);
    // Caveat appended to answer
    expect(result.adjustedAnswer).toContain("Certains chiffres n'ont pas pu être vérifiés avec certitude");
  });

  it('STRIPS a figure whose value equals an unrelated snapshot value but with the wrong source', () => {
    // 25.6 is valid in snapshot.summary.expenses.netProfitMarginPercent
    // But the figure claims source 'summary.kpis' / label 'Taux de refus' (actual refusal rate is 23.3%)
    const figures = [
      {
        label: 'Taux de refus',
        value: 25.6,
        unit: '%',
        source: 'summary.kpis.refusalRatePercent',
      },
    ];
    const answer = 'Votre taux de refus calculé est de 25.6%.';

    const result = verifyFigures(figures, mockSnapshot, answer);

    // 25.6 does NOT match the claimed source kpis (23.3%), so it must be stripped
    expect(result.isVerified).toBe(false);
    expect(result.verifiedFigures).toHaveLength(0);
    expect(result.strippedFigures).toHaveLength(1);
    expect(result.strippedFigures[0].value).toBe(25.6);
    expect(result.adjustedAnswer).toContain("Certains chiffres n'ont pas pu être vérifiés avec certitude");
  });

  it('FLAGS answer as non vérifié when a hallucinated number exists ONLY in the text', () => {
    // Structured figure is completely valid and verified
    const figures = [
      { label: 'Net Profit', value: 32000, unit: 'TND', source: 'expenses' },
    ];
    // Free text introduces a hallucinated unverified cost of 888 888 TND
    const answer =
      'Votre profit net est de 32 000 TND, mais une charge fantôme de 888 888 TND a été observée.';

    const result = verifyFigures(figures, mockSnapshot, answer);

    expect(result.isVerified).toBe(false);
    expect(result.verifiedFigures).toHaveLength(1); // structured verified figure kept
    expect(result.unverifiedTextNumbers).toContain(888888);
    expect(result.adjustedAnswer).toContain("Certains chiffres n'ont pas pu être vérifiés avec certitude");
  });
});
