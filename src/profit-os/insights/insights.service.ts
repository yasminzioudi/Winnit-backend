import { Injectable, Inject } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  INSIGHTS_PROVIDER,
  type InsightsProvider,
} from './ports/insights-provider.port';
import type {
  FinancialSnapshot,
  CourierSnapshotMetric,
  ProductSnapshotMetric,
} from './dto/financial-snapshot.dto';
import type { Insight } from '../domain/insights';

@Injectable()
export class InsightsService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    @Inject(INSIGHTS_PROVIDER)
    private readonly insightsProvider: InsightsProvider,
  ) {}

  async getInsights(
    workspaceId: string,
    fromStr: string,
    toStr: string,
  ): Promise<Insight[]> {
    const [summary, couriers, products, cod] = await Promise.all([
      this.analyticsService.getSummary(workspaceId, fromStr, toStr),
      this.analyticsService.getByCourier(workspaceId, fromStr, toStr),
      this.analyticsService.getByProduct(workspaceId, fromStr, toStr),
      this.analyticsService.getCOD(workspaceId),
    ]);

    const courierMetrics: CourierSnapshotMetric[] = couriers.map((c) => ({
      courier: c.courier,
      delivered: c.deliveredOrders,
      refused: c.refusedOrders,
      pendingPayoutsMillimes: c.pendingPayoutsMillimes,
    }));

    const productMetrics: ProductSnapshotMetric[] = products.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      actualROAS: typeof p.roas === 'number' ? p.roas : 1.8,
      breakEvenROAS: 1.5,
    }));

    let oldestPendingPayoutAgeDays = 0;
    if (cod.aging.daysOver30Count > 0) {
      oldestPendingPayoutAgeDays = 35;
    } else if (cod.aging.days15to30Count > 0) {
      oldestPendingPayoutAgeDays = 20;
    } else if (cod.aging.days8to14Count > 0) {
      oldestPendingPayoutAgeDays = 10;
    } else if (cod.aging.days0to7Count > 0) {
      oldestPendingPayoutAgeDays = 3;
    }

    const snapshot: FinancialSnapshot = {
      workspaceId,
      periodStart: new Date(fromStr),
      periodEnd: new Date(toStr),
      grossRevenueMillimes: summary.waterfall.grossRevenueMillimes,
      netRealizedContributionMillimes:
        summary.waterfall.netRealizedContributionMillimes,
      deliveredOrdersCount: summary.kpis.deliveredCount,
      refusedOrdersCount: summary.kpis.refusedCount,
      courierMetrics,
      productMetrics,
      pendingPayoutsMillimes: cod.summary.pendingCourierPayoutsMillimes,
      oldestPendingPayoutAgeDays,
    };

    return this.insightsProvider.generateInsights(snapshot);
  }
}

