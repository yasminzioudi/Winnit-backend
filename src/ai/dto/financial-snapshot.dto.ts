export interface SnapshotSummary {
  waterfall: {
    grossRevenueMillimes: number;
    productCOGSMillimes: number;
    outboundShippingMillimes: number;
    codRefusalPenaltyMillimes: number;
    paidAdSpendMillimes: number;
    netRealizedContributionMillimes: number;
    netRealizedContributionPercent: number;
  };
  kpis: {
    totalOrdersCount: number;
    deliveredCount: number;
    refusedCount: number;
    deliveryRatePercent: number;
    refusalRatePercent: number;
    averageOrderValueMillimes: number;
  };
  expenses: {
    fixedExpensesMillimes: number;
    netProfitAfterExpensesMillimes: number;
    netProfitMarginPercent: number;
  };
}

export interface SnapshotProductItem {
  productId: string;
  productName: string;
  totalOrders: number;
  deliveredOrders: number;
  refusedOrders: number;
  grossRevenueMillimes: number;
  netContributionMillimes: number;
  roas?: number;
}

export interface SnapshotCourierItem {
  courier: string;
  totalOrders: number;
  deliveredOrders: number;
  refusedOrders: number;
  grossRevenueMillimes: number;
  pendingPayoutsMillimes: number;
}

export interface SnapshotGovernorateItem {
  governorate: string;
  totalOrders: number;
  deliveredOrders: number;
  refusedOrders: number;
  grossRevenueMillimes: number;
}

export interface SnapshotCodAging {
  expectedCashCollectionsMillimes: number;
  bankWireSettledMillimes: number;
  pendingCourierPayoutsMillimes: number;
  days0to7Count: number;
  days8to14Count: number;
  days15to30Count: number;
  daysOver30Count: number;
}

export interface SnapshotWinnerItem {
  rank: number;
  productId: string;
  productName: string;
  score: number;
  label: string;
}

export interface SnapshotInsightItem {
  id: string;
  severity: string;
  title: string;
  evidence: string;
  suggestedAction: string;
}

/**
 * Anonymized Financial Snapshot DTO.
 * Strictly contains NO personal customer data (names, phones, emails, addresses)
 * and NO order IDs or internal sequence numbers.
 */
export interface FinancialSnapshot {
  workspaceId: string;
  period: {
    from: string;
    to: string;
  };
  summary: SnapshotSummary;
  byProduct: SnapshotProductItem[];
  byCourier: SnapshotCourierItem[];
  byGovernorate: SnapshotGovernorateItem[];
  codAging: SnapshotCodAging;
  winners: SnapshotWinnerItem[];
  insights: SnapshotInsightItem[];
}
