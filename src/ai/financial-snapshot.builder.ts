import { Injectable } from '@nestjs/common';
import { AnalyticsService } from '../profit-os/analytics/analytics.service';
import { InsightsService } from '../profit-os/insights/insights.service';
import type {
  FinancialSnapshot,
  SnapshotProductItem,
  SnapshotCourierItem,
  SnapshotGovernorateItem,
  SnapshotCodAging,
  SnapshotWinnerItem,
  SnapshotInsightItem,
} from './dto/financial-snapshot.dto';

@Injectable()
export class FinancialSnapshotBuilder {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly insightsService: InsightsService,
  ) {}

  /**
   * Assembles an aggregated, strictly anonymized FinancialSnapshot for a given tenant workspace and period.
   * Guaranteed to contain zero customer PII (no names, phones, addresses) and zero order identifiers.
   */
  async build(workspaceId: string, from: string, to: string): Promise<FinancialSnapshot> {
    const [summary, products, couriers, governorates, cod, winners, rawInsights] =
      await Promise.all([
        this.analyticsService.getSummary(workspaceId, from, to),
        this.analyticsService.getByProduct(workspaceId, from, to),
        this.analyticsService.getByCourier(workspaceId, from, to),
        this.analyticsService.getByGovernorate(workspaceId, from, to),
        this.analyticsService.getCOD(workspaceId),
        this.analyticsService.getWinners(workspaceId, from, to),
        this.insightsService.getInsights(workspaceId, from, to),
      ]);

    const byProduct: SnapshotProductItem[] = products.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      totalOrders: p.totalOrders,
      deliveredOrders: p.deliveredOrders,
      refusedOrders: p.refusedOrders,
      grossRevenueMillimes: p.grossRevenueMillimes,
      netContributionMillimes: p.netContributionMillimes,
      roas: typeof p.roas === 'number' ? p.roas : undefined,
    }));

    const byCourier: SnapshotCourierItem[] = couriers.map((c) => ({
      courier: c.courier,
      totalOrders: c.totalOrders,
      deliveredOrders: c.deliveredOrders,
      refusedOrders: c.refusedOrders,
      grossRevenueMillimes: c.grossRevenueMillimes,
      pendingPayoutsMillimes: c.pendingPayoutsMillimes,
    }));

    const byGovernorate: SnapshotGovernorateItem[] = governorates.map((g) => ({
      governorate: g.governorate,
      totalOrders: g.totalOrders,
      deliveredOrders: g.deliveredOrders,
      refusedOrders: g.refusedOrders,
      grossRevenueMillimes: g.grossRevenueMillimes,
    }));

    const codAging: SnapshotCodAging = {
      expectedCashCollectionsMillimes: cod.summary.expectedCashCollectionsMillimes,
      bankWireSettledMillimes: cod.summary.bankWireSettledMillimes,
      pendingCourierPayoutsMillimes: cod.summary.pendingCourierPayoutsMillimes,
      days0to7Count: cod.aging.days0to7Count,
      days8to14Count: cod.aging.days8to14Count,
      days15to30Count: cod.aging.days15to30Count,
      daysOver30Count: cod.aging.daysOver30Count,
    };

    const winnerItems: SnapshotWinnerItem[] = winners.map((w, index) => ({
      rank: index + 1,
      productId: w.productId,
      productName: w.productName,
      score: w.score,
      label: w.label,
    }));

    const insightItems: SnapshotInsightItem[] = rawInsights.map((ins) => ({
      id: ins.id,
      severity: ins.severity,
      title: ins.title,
      evidence: ins.evidence,
      suggestedAction: ins.suggestedAction,
    }));

    return {
      workspaceId,
      period: { from, to },
      summary: {
        waterfall: {
          grossRevenueMillimes: summary.waterfall.grossRevenueMillimes,
          productCOGSMillimes: summary.waterfall.productCOGSMillimes,
          outboundShippingMillimes: summary.waterfall.outboundShippingMillimes,
          codRefusalPenaltyMillimes: summary.waterfall.codRefusalPenaltyMillimes,
          paidAdSpendMillimes: summary.waterfall.paidAdSpendMillimes,
          netRealizedContributionMillimes: summary.waterfall.netRealizedContributionMillimes,
          netRealizedContributionPercent: summary.waterfall.netRealizedContributionPercent,
        },
        kpis: {
          totalOrdersCount: summary.kpis.totalOrdersCount,
          deliveredCount: summary.kpis.deliveredCount,
          refusedCount: summary.kpis.refusedCount,
          deliveryRatePercent: summary.kpis.deliveryRatePercent,
          refusalRatePercent: summary.kpis.refusalRatePercent,
          averageOrderValueMillimes: summary.kpis.averageOrderValueMillimes,
        },
        expenses: {
          fixedExpensesMillimes: summary.expenses.fixedExpensesMillimes,
          netProfitAfterExpensesMillimes: summary.expenses.netProfitAfterExpensesMillimes,
          netProfitMarginPercent: summary.expenses.netProfitMarginPercent,
        },
      },
      byProduct,
      byCourier,
      byGovernorate,
      codAging,
      winners: winnerItems,
      insights: insightItems,
    };
  }
}
