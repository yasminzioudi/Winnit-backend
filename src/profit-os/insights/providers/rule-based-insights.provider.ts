import { Injectable } from '@nestjs/common';
import type { InsightsProvider } from '../ports/insights-provider.port';
import type { FinancialSnapshot } from '../dto/financial-snapshot.dto';
import {
  checkRefusalRate,
  checkROASBelowBreakEven,
  checkPendingPayoutsAge,
  DEFAULT_THRESHOLDS,
  type Insight,
  type InsightThresholds,
} from '../../domain/insights';

@Injectable()
export class RuleBasedInsightsProvider implements InsightsProvider {
  private thresholds: InsightThresholds = DEFAULT_THRESHOLDS;

  setThresholds(customThresholds: Partial<InsightThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
  }

  async generateInsights(snapshot: FinancialSnapshot): Promise<Insight[]> {
    const insights: Insight[] = [];

    // 1. Courier refusal rates
    for (const courier of snapshot.courierMetrics) {
      const refusalInsight = checkRefusalRate(
        courier.delivered,
        courier.refused,
        courier.courier,
        this.thresholds.refusalRateThreshold,
      );
      if (refusalInsight) {
        insights.push(refusalInsight);
      }
    }

    // 2. Product ROAS below break-even
    for (const prod of snapshot.productMetrics) {
      const roasInsight = checkROASBelowBreakEven(
        prod.productId,
        prod.productName,
        prod.actualROAS,
        prod.breakEvenROAS,
        this.thresholds.roasBelowBreakEvenThreshold,
      );
      if (roasInsight) {
        insights.push(roasInsight);
      }
    }

    // 3. Pending payouts aging
    const payoutsInsight = checkPendingPayoutsAge(
      snapshot.pendingPayoutsMillimes,
      snapshot.oldestPendingPayoutAgeDays,
      this.thresholds.pendingPayoutsAgeDays,
    );
    if (payoutsInsight) {
      insights.push(payoutsInsight);
    }

    return insights;
  }
}
