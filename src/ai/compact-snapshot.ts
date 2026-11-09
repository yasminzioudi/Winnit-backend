import type { FinancialSnapshot } from './dto/financial-snapshot.dto';

export interface CompactProduct {
  name: string;
  orders: number;
  netMillimes: number;
  roas?: number;
}

export interface CompactCourier {
  courier: string;
  totalOrders: number;
  deliveredOrders: number;
  deliveryRatePercent: number;
}

export interface CompactGovernorate {
  governorate: string;
  totalOrders: number;
  refusedOrders: number;
  refusalRatePercent: number;
}

export interface CompactSnapshot {
  period: { from: string; to: string };
  summary: {
    grossRevenueMillimes: number;
    cogsMillimes: number;
    shippingMillimes: number;
    refusalPenaltyMillimes: number;
    adSpendMillimes: number;
    netRealizedContributionMillimes: number;
    netRealizedContributionPercent: number;
    fixedExpensesMillimes: number;
    netProfitAfterExpensesMillimes: number;
    netProfitMarginPercent: number;
    totalOrdersCount: number;
    deliveredCount: number;
    refusedCount: number;
    deliveryRatePercent: number;
    refusalRatePercent: number;
  };
  topProducts: CompactProduct[];
  bottomProducts: CompactProduct[];
  couriers: CompactCourier[];
  worstGovernorates: CompactGovernorate[];
  codAging: {
    expectedCollectionsMillimes: number;
    settledMillimes: number;
    pendingPayoutsMillimes: number;
    daysOver14Count: number;
  };
  insights: Array<{
    severity: string;
    title: string;
    action: string;
  }>;
}

/**
 * Builds a highly compact, rounded version of the FinancialSnapshot
 * keeping only key decision fields to minimize LLM prompt size and token latency.
 */
export function buildCompactSnapshot(snapshot: FinancialSnapshot): CompactSnapshot {
  const s = snapshot.summary;

  // 1. Sort products by net contribution
  const sortedProducts = [...(snapshot.byProduct || [])].sort(
    (a, b) => b.netContributionMillimes - a.netContributionMillimes,
  );

  const topProducts: CompactProduct[] = sortedProducts.slice(0, 3).map((p) => ({
    name: p.productName,
    orders: p.totalOrders,
    netMillimes: Math.round(p.netContributionMillimes),
    ...(p.roas !== undefined ? { roas: Math.round(p.roas * 10) / 10 } : {}),
  }));

  // Bottom 3 products (excluding overlap if list is small)
  const remaining = sortedProducts.length > 3 ? sortedProducts.slice(3) : [];
  const bottomProducts: CompactProduct[] = remaining.slice(-3).map((p) => ({
    name: p.productName,
    orders: p.totalOrders,
    netMillimes: Math.round(p.netContributionMillimes),
    ...(p.roas !== undefined ? { roas: Math.round(p.roas * 10) / 10 } : {}),
  }));

  // 2. Couriers with rounded delivery rates
  const couriers: CompactCourier[] = (snapshot.byCourier || []).map((c) => ({
    courier: c.courier,
    totalOrders: c.totalOrders,
    deliveredOrders: c.deliveredOrders,
    deliveryRatePercent:
      c.totalOrders > 0
        ? Math.round((c.deliveredOrders / c.totalOrders) * 1000) / 10
        : 0,
  }));

  // 3. Worst 3 governorates by refusal rate
  const worstGovernorates: CompactGovernorate[] = [...(snapshot.byGovernorate || [])]
    .map((g) => ({
      governorate: g.governorate,
      totalOrders: g.totalOrders,
      refusedOrders: g.refusedOrders,
      refusalRatePercent:
        g.totalOrders > 0
          ? Math.round((g.refusedOrders / g.totalOrders) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.refusalRatePercent - a.refusalRatePercent)
    .slice(0, 3);

  // 4. COD aging (aggregating overdue > 14 days)
  const cod = snapshot.codAging;
  const daysOver14Count = (cod?.days15to30Count || 0) + (cod?.daysOver30Count || 0);

  // 5. Top 2 insights (title & action)
  const insights = (snapshot.insights || []).slice(0, 2).map((i) => ({
    severity: i.severity,
    title: i.title,
    action: i.suggestedAction,
  }));

  return {
    period: snapshot.period,
    summary: {
      grossRevenueMillimes: Math.round(s.waterfall.grossRevenueMillimes),
      cogsMillimes: Math.round(s.waterfall.productCOGSMillimes),
      shippingMillimes: Math.round(s.waterfall.outboundShippingMillimes),
      refusalPenaltyMillimes: Math.round(s.waterfall.codRefusalPenaltyMillimes),
      adSpendMillimes: Math.round(s.waterfall.paidAdSpendMillimes),
      netRealizedContributionMillimes: Math.round(s.waterfall.netRealizedContributionMillimes),
      netRealizedContributionPercent:
        Math.round(s.waterfall.netRealizedContributionPercent * 10) / 10,
      fixedExpensesMillimes: Math.round(s.expenses.fixedExpensesMillimes),
      netProfitAfterExpensesMillimes: Math.round(s.expenses.netProfitAfterExpensesMillimes),
      netProfitMarginPercent: Math.round(s.expenses.netProfitMarginPercent * 10) / 10,
      totalOrdersCount: s.kpis.totalOrdersCount,
      deliveredCount: s.kpis.deliveredCount,
      refusedCount: s.kpis.refusedCount,
      deliveryRatePercent: Math.round(s.kpis.deliveryRatePercent * 10) / 10,
      refusalRatePercent: Math.round(s.kpis.refusalRatePercent * 10) / 10,
    },
    topProducts,
    bottomProducts,
    couriers,
    worstGovernorates,
    codAging: {
      expectedCollectionsMillimes: Math.round(cod?.expectedCashCollectionsMillimes || 0),
      settledMillimes: Math.round(cod?.bankWireSettledMillimes || 0),
      pendingPayoutsMillimes: Math.round(cod?.pendingCourierPayoutsMillimes || 0),
      daysOver14Count,
    },
    insights,
  };
}
