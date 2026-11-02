/**
 * FinancialSnapshot DTO: Aggregated financial data without any personal customer information (no PII).
 * Designed for rule-based insights and future AI/LLM analysis.
 */
export interface CourierSnapshotMetric {
  courier: string;
  delivered: number;
  refused: number;
  pendingPayoutsMillimes: number;
}

export interface ProductSnapshotMetric {
  productId: string;
  productName: string;
  actualROAS: number;
  breakEvenROAS: number;
}

export interface FinancialSnapshot {
  workspaceId: string;
  periodStart: Date;
  periodEnd: Date;
  grossRevenueMillimes: number;
  netRealizedContributionMillimes: number;
  deliveredOrdersCount: number;
  refusedOrdersCount: number;
  courierMetrics: CourierSnapshotMetric[];
  productMetrics: ProductSnapshotMetric[];
  pendingPayoutsMillimes: number;
  oldestPendingPayoutAgeDays: number;
}

