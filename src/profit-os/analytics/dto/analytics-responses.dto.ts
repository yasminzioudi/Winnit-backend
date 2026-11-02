import type { WaterfallResult } from '../../domain/finance';
import type { CODReconciliationResult } from '../../domain/reconciliation';
import type { WinnerScore } from '../../domain/winners';

export interface AnalyticsSummaryResponse {
  period: {
    from: string;
    to: string;
  };
  waterfall: WaterfallResult & {
    adSpendDeltaMillimes: number;
    ledgerNetMillimes: number;
  };
  kpis: {
    totalOrdersCount: number;
    deliveredCount: number;
    refusedCount: number;
    shippedCount: number;
    confirmedCount: number;
    pendingCount: number;
    deliveryRatePercent: number;
    refusalRatePercent: number;
    averageOrderValueMillimes: number;
  };
  expenses: {
    fixedExpensesMillimes: number;
    netProfitAfterExpensesMillimes: number;
    netProfitMarginPercent: number;
  };
  cod: CODReconciliationResult;
}

export interface TimeseriesBucket {
  period: string;
  ordersCount: number;
  deliveredCount: number;
  refusedCount: number;
  grossRevenueMillimes: number;
  netContributionMillimes: number;
  adSpendMillimes: number;
}

export interface TimeseriesResponse {
  granularity: 'daily' | 'weekly' | 'day' | 'week' | 'month';
  buckets: TimeseriesBucket[];
}

export interface ProductAnalyticsItem {
  productId: string;
  productName: string;
  totalOrders: number;
  deliveredOrders: number;
  refusedOrders: number;
  deliveryRatePercent: number;
  grossRevenueMillimes: number;
  netContributionMillimes: number;
  adSpendMillimes: number;
  roas: number;
}

export interface CourierAnalyticsItem {
  courier: string;
  totalOrders: number;
  deliveredOrders: number;
  refusedOrders: number;
  deliveryRatePercent: number;
  refusalRatePercent: number;
  grossRevenueMillimes: number;
  shippingMillimes: number;
  returnShippingMillimes: number;
  pendingPayoutsMillimes: number;
}

export interface GovernorateAnalyticsItem {
  governorate: string;
  totalOrders: number;
  deliveredOrders: number;
  refusedOrders: number;
  deliveryRatePercent: number;
  refusalRatePercent: number;
  grossRevenueMillimes: number;
  netContributionMillimes: number;
}

export interface CODAnalyticsResponse {
  summary: CODReconciliationResult;
  aging: {
    days0to7Millimes: number;
    days8to14Millimes: number;
    days15to30Millimes: number;
    daysOver30Millimes: number;
    days0to7Count: number;
    days8to14Count: number;
    days15to30Count: number;
    daysOver30Count: number;
  };
  byCourier: Array<{
    courier: string;
    pendingCount: number;
    pendingPayoutsMillimes: number;
    settledCount: number;
    settledNetMillimes: number;
  }>;
}

export interface WinnerRankingItem extends WinnerScore {
  productName: string;
  totalOrders: number;
  deliveredOrders: number;
  refusedOrders: number;
  grossRevenueMillimes: number;
}

