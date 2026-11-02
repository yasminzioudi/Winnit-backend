import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';
import { CacheService } from '../../common/cache/cache.service';
import {
  calculateWaterfall,
  calculateAdSpendDelta,
  calculateLedgerNet,
  calculateUnitEconomics,
  type OrderFinance,
} from '../domain/finance';
import {
  calculateCODReconciliation,
  type OrderForReconciliation,
  type Settlement as ReconciliationSettlement,
} from '../domain/reconciliation';
import { expenseTotalForPeriod, type ExpenseDomain } from '../domain/expenses';
import {
  calculateWinnerScore,
  type ProductMetrics,
} from '../domain/winners';
import {
  PRODUCT_CATALOG_PORT,
  type ProductCatalogPort,
} from '../../catalog/ports/product-catalog.port';
import type {
  AnalyticsSummaryResponse,
  TimeseriesResponse,
  TimeseriesBucket,
  ProductAnalyticsItem,
  CourierAnalyticsItem,
  GovernorateAnalyticsItem,
  CODAnalyticsResponse,
  WinnerRankingItem,
} from './dto/analytics-responses.dto';

export function validateDateRange(fromStr: string, toStr: string): { from: Date; to: Date } {
  const from = new Date(fromStr);
  const to = new Date(toStr);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new BadRequestException('Invalid date format for from or to');
  }

  if (from.getTime() > to.getTime()) {
    throw new BadRequestException('Start date (from) must be before or equal to end date (to)');
  }

  return { from, to };
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly cacheService: CacheService,
    @Inject(PRODUCT_CATALOG_PORT)
    private readonly catalogPort: ProductCatalogPort,
  ) {}

  async getSummary(
    workspaceId: string,
    fromStr: string,
    toStr: string,
    compare?: string,
  ): Promise<AnalyticsSummaryResponse> {
    const { from, to } = validateDateRange(fromStr, toStr);

    const cacheKey = `${workspaceId}:analytics:summary:${fromStr}:${toStr}:${compare ?? ''}`;
    const cached = this.cacheService.get<AnalyticsSummaryResponse>(cacheKey);
    if (cached) return cached;

    const [orders, adSpends, rawExpenses, rawSettlements] = await Promise.all([
      this.analyticsRepo.findOrdersForPeriod(workspaceId, from, to),
      this.analyticsRepo.findAdSpendsForPeriod(workspaceId, from, to),
      this.analyticsRepo.findExpenses(workspaceId),
      this.analyticsRepo.findSettlements(workspaceId),
    ]);

    const totalPaidAdSpendMillimes = adSpends.reduce(
      (sum, s) => sum + s.spendMillimes,
      0,
    );

    const orderFinances: OrderFinance[] = orders.map((o) => ({
      unitPriceMillimes: o.unitPriceMillimes,
      unitCogsMillimes: o.unitCogsMillimes,
      quantity: o.quantity,
      shippingMillimes: o.shippingMillimes,
      returnShippingMillimes: o.returnShippingMillimes,
      courierFeeMillimes: o.courierFeeMillimes,
      adCpaMillimes: o.adCpaMillimes,
      status: o.status,
    }));

    const waterfall = calculateWaterfall(orderFinances, totalPaidAdSpendMillimes);
    const adSpendDeltaMillimes = calculateAdSpendDelta(
      orderFinances,
      totalPaidAdSpendMillimes,
    );
    const ledgerNetMillimes = calculateLedgerNet(orderFinances);

    let deliveredCount = 0;
    let refusedCount = 0;
    let shippedCount = 0;
    let confirmedCount = 0;
    let pendingCount = 0;

    for (const o of orders) {
      if (o.status === 'delivered') deliveredCount++;
      else if (o.status === 'refused') refusedCount++;
      else if (o.status === 'shipped') shippedCount++;
      else if (o.status === 'confirmed') confirmedCount++;
      else if (o.status === 'pending') pendingCount++;
    }

    const resolvedCount = deliveredCount + refusedCount;
    const deliveryRatePercent =
      resolvedCount > 0
        ? Math.round((deliveredCount / resolvedCount) * 1000) / 10
        : 0;
    const refusalRatePercent =
      resolvedCount > 0
        ? Math.round((refusedCount / resolvedCount) * 1000) / 10
        : 0;

    const averageOrderValueMillimes =
      deliveredCount > 0
        ? Math.round(waterfall.grossRevenueMillimes / deliveredCount)
        : 0;

    const domainExpenses: ExpenseDomain[] = rawExpenses.map((e) => ({
      amountMillimes: e.amountMillimes,
      periodType: e.periodType as 'monthly' | 'one-time',
      startDate: e.startDate,
      endDate: e.endDate,
    }));
    const fixedExpensesMillimes = expenseTotalForPeriod(domainExpenses, from, to);

    const netProfitAfterExpensesMillimes =
      waterfall.netRealizedContributionMillimes - fixedExpensesMillimes;
    const netProfitMarginPercent =
      waterfall.grossRevenueMillimes > 0
        ? Math.round(
            (netProfitAfterExpensesMillimes / waterfall.grossRevenueMillimes) *
              1000,
          ) / 10
        : 0;

    const ordersForReconcile: OrderForReconciliation[] = orders.map((o) => ({
      id: String(o._id),
      unitPriceMillimes: o.unitPriceMillimes,
      quantity: o.quantity,
      courierFeeMillimes: o.courierFeeMillimes,
      status: o.status,
      settlementId: o.settlementId,
    }));

    const settlementsForReconcile: ReconciliationSettlement[] =
      rawSettlements.map((s) => ({
        id: String(s._id),
        orderIds: s.orderIds,
        grossCollectedMillimes: s.totalAmountMillimes,
        commissionMillimes: 0,
        netMillimes: s.totalAmountMillimes,
        status: s.status,
      }));

    const cod = calculateCODReconciliation(
      ordersForReconcile,
      settlementsForReconcile,
    );

    const result: AnalyticsSummaryResponse = {
      period: {
        from: fromStr,
        to: toStr,
      },
      waterfall: {
        ...waterfall,
        adSpendDeltaMillimes,
        ledgerNetMillimes,
      },
      kpis: {
        totalOrdersCount: orders.length,
        deliveredCount,
        refusedCount,
        shippedCount,
        confirmedCount,
        pendingCount,
        deliveryRatePercent,
        refusalRatePercent,
        averageOrderValueMillimes,
      },
      expenses: {
        fixedExpensesMillimes,
        netProfitAfterExpensesMillimes,
        netProfitMarginPercent,
      },
      cod,
    };

    this.cacheService.set(cacheKey, result, 60);
    return result;
  }

  async getTimeseries(
    workspaceId: string,
    fromStr: string,
    toStr: string,
    granularity: 'daily' | 'weekly' | 'day' | 'week' | 'month' = 'daily',
  ): Promise<TimeseriesResponse> {
    const { from, to } = validateDateRange(fromStr, toStr);

    const cacheKey = `${workspaceId}:analytics:timeseries:${fromStr}:${toStr}:${granularity}`;
    const cached = this.cacheService.get<TimeseriesResponse>(cacheKey);
    if (cached) return cached;

    const [orderBuckets, adSpendBuckets] = await Promise.all([
      this.analyticsRepo.getTimeseriesOrders(
        workspaceId,
        from,
        to,
        granularity,
      ),
      this.analyticsRepo.getTimeseriesAdSpends(
        workspaceId,
        from,
        to,
        granularity,
      ),
    ]);

    const adSpendMap = new Map<string, number>();
    for (const b of adSpendBuckets) {
      adSpendMap.set(b._id, b.adSpendMillimes);
    }

    const allPeriods = new Set<string>();
    for (const b of orderBuckets) allPeriods.add(b._id);
    for (const b of adSpendBuckets) allPeriods.add(b._id);

    const sortedPeriods = Array.from(allPeriods).sort();

    const orderBucketMap = new Map<string, (typeof orderBuckets)[0]>();
    for (const b of orderBuckets) {
      orderBucketMap.set(b._id, b);
    }

    const buckets: TimeseriesBucket[] = sortedPeriods.map((period) => {
      const orderData = orderBucketMap.get(period);
      const adSpend = adSpendMap.get(period) ?? 0;

      return {
        period,
        ordersCount: orderData?.ordersCount ?? 0,
        deliveredCount: orderData?.deliveredCount ?? 0,
        refusedCount: orderData?.refusedCount ?? 0,
        grossRevenueMillimes: orderData?.grossRevenueMillimes ?? 0,
        netContributionMillimes: orderData?.netContributionMillimes ?? 0,
        adSpendMillimes: adSpend,
      };
    });

    const response: TimeseriesResponse = {
      granularity,
      buckets,
    };

    this.cacheService.set(cacheKey, response, 60);
    return response;
  }

  async getByProduct(
    workspaceId: string,
    fromStr: string,
    toStr: string,
  ): Promise<ProductAnalyticsItem[]> {
    const { from, to } = validateDateRange(fromStr, toStr);

    const cacheKey = `${workspaceId}:analytics:by-product:${fromStr}:${toStr}`;
    const cached = this.cacheService.get<ProductAnalyticsItem[]>(cacheKey);
    if (cached) return cached;

    const [productGroups, adSpends] = await Promise.all([
      this.analyticsRepo.getProductAggregation(workspaceId, from, to),
      this.analyticsRepo.findAdSpendsForPeriod(workspaceId, from, to),
    ]);

    const adSpendByProduct = new Map<string, number>();
    for (const spend of adSpends) {
      if (!spend.productId) continue;
      const prev = adSpendByProduct.get(spend.productId) ?? 0;
      adSpendByProduct.set(spend.productId, prev + spend.spendMillimes);
    }

    const items: ProductAnalyticsItem[] = productGroups.map((g) => {
      const resolved = g.deliveredOrders + g.refusedOrders;
      const deliveryRatePercent =
        resolved > 0
          ? Math.round((g.deliveredOrders / resolved) * 1000) / 10
          : 0;

      const adSpendMillimes = adSpendByProduct.get(g._id) ?? 0;
      const roas =
        adSpendMillimes > 0
          ? Math.round((g.grossRevenueMillimes / adSpendMillimes) * 100) / 100
          : 0;

      return {
        productId: g._id,
        productName: g.productName,
        totalOrders: g.totalOrders,
        deliveredOrders: g.deliveredOrders,
        refusedOrders: g.refusedOrders,
        deliveryRatePercent,
        grossRevenueMillimes: g.grossRevenueMillimes,
        netContributionMillimes: g.netContributionMillimes,
        adSpendMillimes,
        roas,
      };
    });

    this.cacheService.set(cacheKey, items, 60);
    return items;
  }

  async getByCourier(
    workspaceId: string,
    fromStr: string,
    toStr: string,
  ): Promise<CourierAnalyticsItem[]> {
    const { from, to } = validateDateRange(fromStr, toStr);

    const cacheKey = `${workspaceId}:analytics:by-courier:${fromStr}:${toStr}`;
    const cached = this.cacheService.get<CourierAnalyticsItem[]>(cacheKey);
    if (cached) return cached;

    const [courierGroups, rawSettlements] = await Promise.all([
      this.analyticsRepo.getCourierAggregation(workspaceId, from, to),
      this.analyticsRepo.findSettlements(workspaceId),
    ]);

    const settledOrderIds = new Set<string>();
    for (const s of rawSettlements) {
      if (s.status === 'settled') {
        for (const oid of s.orderIds) settledOrderIds.add(oid);
      }
    }

    const orders = await this.analyticsRepo.findOrdersForPeriod(
      workspaceId,
      from,
      to,
    );

    const pendingPayoutByCourier = new Map<string, number>();
    for (const o of orders) {
      if (o.status === 'delivered' && !settledOrderIds.has(String(o._id))) {
        const gross = o.unitPriceMillimes * o.quantity;
        const net = gross - o.courierFeeMillimes;
        const prev = pendingPayoutByCourier.get(o.courier) ?? 0;
        pendingPayoutByCourier.set(o.courier, prev + net);
      }
    }

    const items: CourierAnalyticsItem[] = courierGroups.map((g) => {
      const resolved = g.deliveredOrders + g.refusedOrders;
      const deliveryRatePercent =
        resolved > 0
          ? Math.round((g.deliveredOrders / resolved) * 1000) / 10
          : 0;
      const refusalRatePercent =
        resolved > 0
          ? Math.round((g.refusedOrders / resolved) * 1000) / 10
          : 0;

      return {
        courier: g._id,
        totalOrders: g.totalOrders,
        deliveredOrders: g.deliveredOrders,
        refusedOrders: g.refusedOrders,
        deliveryRatePercent,
        refusalRatePercent,
        grossRevenueMillimes: g.grossRevenueMillimes,
        shippingMillimes: g.shippingMillimes,
        returnShippingMillimes: g.returnShippingMillimes,
        pendingPayoutsMillimes: pendingPayoutByCourier.get(g._id) ?? 0,
      };
    });

    this.cacheService.set(cacheKey, items, 60);
    return items;
  }

  async getByGovernorate(
    workspaceId: string,
    fromStr: string,
    toStr: string,
  ): Promise<GovernorateAnalyticsItem[]> {
    const { from, to } = validateDateRange(fromStr, toStr);

    const cacheKey = `${workspaceId}:analytics:by-governorate:${fromStr}:${toStr}`;
    const cached = this.cacheService.get<GovernorateAnalyticsItem[]>(cacheKey);
    if (cached) return cached;

    const govGroups = await this.analyticsRepo.getGovernorateAggregation(
      workspaceId,
      from,
      to,
    );

    const items: GovernorateAnalyticsItem[] = govGroups.map((g) => {
      const resolved = g.deliveredOrders + g.refusedOrders;
      const deliveryRatePercent =
        resolved > 0
          ? Math.round((g.deliveredOrders / resolved) * 1000) / 10
          : 0;
      const refusalRatePercent =
        resolved > 0
          ? Math.round((g.refusedOrders / resolved) * 1000) / 10
          : 0;

      return {
        governorate: g._id || 'Autre',
        totalOrders: g.totalOrders,
        deliveredOrders: g.deliveredOrders,
        refusedOrders: g.refusedOrders,
        deliveryRatePercent,
        refusalRatePercent,
        grossRevenueMillimes: g.grossRevenueMillimes,
        netContributionMillimes: g.netContributionMillimes,
      };
    });

    this.cacheService.set(cacheKey, items, 60);
    return items;
  }

  async getCOD(workspaceId: string): Promise<CODAnalyticsResponse> {
    const cacheKey = `${workspaceId}:analytics:cod`;
    const cached = this.cacheService.get<CODAnalyticsResponse>(cacheKey);
    if (cached) return cached;

    const [allOrders, settlements] = await Promise.all([
      this.analyticsRepo.findOrdersForPeriod(
        workspaceId,
        new Date(0),
        new Date(Date.now() + 86400000),
      ),
      this.analyticsRepo.findSettlements(workspaceId),
    ]);

    const settledOrderIds = new Set<string>();
    for (const s of settlements) {
      if (s.status === 'settled') {
        for (const oid of s.orderIds) settledOrderIds.add(oid);
      }
    }

    const ordersForReconcile: OrderForReconciliation[] = allOrders.map((o) => ({
      id: String(o._id),
      unitPriceMillimes: o.unitPriceMillimes,
      quantity: o.quantity,
      courierFeeMillimes: o.courierFeeMillimes,
      status: o.status,
      settlementId: o.settlementId,
    }));

    const settlementsForReconcile: ReconciliationSettlement[] = settlements.map(
      (s) => ({
        id: String(s._id),
        orderIds: s.orderIds,
        grossCollectedMillimes: s.totalAmountMillimes,
        commissionMillimes: 0,
        netMillimes: s.totalAmountMillimes,
        status: s.status,
      }),
    );

    const summary = calculateCODReconciliation(
      ordersForReconcile,
      settlementsForReconcile,
    );

    const unsettledDelivered = allOrders.filter(
      (o) => o.status === 'delivered' && !settledOrderIds.has(String(o._id)),
    );
    const unsettledOrderIds = unsettledDelivered.map((o) => String(o._id));

    const facet = await this.analyticsRepo.getCODAgingFacet(
      workspaceId,
      unsettledOrderIds,
    );

    const agingData = facet?.aging?.[0] ?? {
      days0to7Millimes: 0,
      days8to14Millimes: 0,
      days15to30Millimes: 0,
      daysOver30Millimes: 0,
      days0to7Count: 0,
      days8to14Count: 0,
      days15to30Count: 0,
      daysOver30Count: 0,
    };

    const courierPendingMap = new Map<
      string,
      { count: number; pendingMillimes: number }
    >();
    if (facet?.byCourier) {
      for (const c of facet.byCourier as Array<{
        _id: string;
        count: number;
        pendingMillimes: number;
      }>) {
        courierPendingMap.set(c._id, {
          count: c.count,
          pendingMillimes: c.pendingMillimes,
        });
      }
    }

    const courierSettledMap = new Map<
      string,
      { count: number; netMillimes: number }
    >();
    for (const s of settlements) {
      if (s.status === 'settled') {
        const prev = courierSettledMap.get(s.courier) ?? {
          count: 0,
          netMillimes: 0,
        };
        courierSettledMap.set(s.courier, {
          count: prev.count + s.orderIds.length,
          netMillimes: prev.netMillimes + s.totalAmountMillimes,
        });
      }
    }

    const couriers = ['yalidine', 'aramex'];
    const byCourier = couriers.map((courier) => {
      const pending = courierPendingMap.get(courier) ?? {
        count: 0,
        pendingMillimes: 0,
      };
      const settled = courierSettledMap.get(courier) ?? {
        count: 0,
        netMillimes: 0,
      };

      return {
        courier,
        pendingCount: pending.count,
        pendingPayoutsMillimes: pending.pendingMillimes,
        settledCount: settled.count,
        settledNetMillimes: settled.netMillimes,
      };
    });

    const response: CODAnalyticsResponse = {
      summary,
      aging: {
        days0to7Millimes: agingData.days0to7Millimes ?? 0,
        days8to14Millimes: agingData.days8to14Millimes ?? 0,
        days15to30Millimes: agingData.days15to30Millimes ?? 0,
        daysOver30Millimes: agingData.daysOver30Millimes ?? 0,
        days0to7Count: agingData.days0to7Count ?? 0,
        days8to14Count: agingData.days8to14Count ?? 0,
        days15to30Count: agingData.days15to30Count ?? 0,
        daysOver30Count: agingData.daysOver30Count ?? 0,
      },
      byCourier,
    };

    this.cacheService.set(cacheKey, response, 60);
    return response;
  }

  async getWinners(
    workspaceId: string,
    fromStr: string,
    toStr: string,
  ): Promise<WinnerRankingItem[]> {
    const { from, to } = validateDateRange(fromStr, toStr);

    const cacheKey = `${workspaceId}:analytics:winners:${fromStr}:${toStr}`;
    const cached = this.cacheService.get<WinnerRankingItem[]>(cacheKey);
    if (cached) return cached;

    const windowDurationMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - windowDurationMs);
    const prevTo = from;

    const [productGroups, prevProductGroups, adSpends, catalogProducts] = await Promise.all([
      this.analyticsRepo.getProductAggregation(workspaceId, from, to),
      this.analyticsRepo.getProductAggregation(workspaceId, prevFrom, prevTo),
      this.analyticsRepo.findAdSpendsForPeriod(workspaceId, from, to),
      this.catalogPort.findAll(workspaceId),
    ]);

    const prevVolumeMap = new Map<string, number>();
    for (const pg of prevProductGroups) {
      prevVolumeMap.set(pg._id, pg.totalOrders);
    }

    const catalogMap = new Map<string, (typeof catalogProducts)[0]>();
    for (const p of catalogProducts) {
      catalogMap.set(p.id, p);
    }

    const adSpendByProduct = new Map<string, number>();
    for (const s of adSpends) {
      if (!s.productId) continue;
      const prev = adSpendByProduct.get(s.productId) ?? 0;
      adSpendByProduct.set(s.productId, prev + s.spendMillimes);
    }

    const items: WinnerRankingItem[] = productGroups.map((g) => {
      const catalog = catalogMap.get(g._id);
      const cogs = catalog?.cogsMillimes ?? 28000;
      const logistics =
        (catalog?.logisticsCostPerOrderMillimes ?? 7000) +
        (catalog?.returnShippingMillimes ?? 0);
      const cpa = catalog?.targetCpaMillimes ?? 22000;
      const price =
        catalog?.sellingPriceMillimes ??
        (g.deliveredOrders > 0
          ? Math.round(g.grossRevenueMillimes / g.deliveredOrders)
          : 129000);

      const resolved = g.deliveredOrders + g.refusedOrders;
      const refusalRate = resolved > 0 ? g.refusedOrders / resolved : 0.2;

      const ue = calculateUnitEconomics({
        priceMillimes: price,
        cogsMillimes: cogs,
        logisticsMillimes: logistics,
        cpaMillimes: cpa,
        refusalRate,
      });

      const adSpend = adSpendByProduct.get(g._id) ?? 0;
      const actualROAS =
        adSpend > 0 ? g.grossRevenueMillimes / adSpend : 0;

      const netMarginPercent =
        g.grossRevenueMillimes > 0
          ? Math.round(
              (g.netContributionMillimes / g.grossRevenueMillimes) * 1000,
            ) / 10
          : 0;

      const prevVolume = prevVolumeMap.get(g._id) ?? 0;
      let volumeTrend30Days = 0;
      if (prevVolume > 0) {
        volumeTrend30Days = (g.totalOrders - prevVolume) / prevVolume;
      } else if (g.totalOrders > 0) {
        volumeTrend30Days = 0.5;
      }
      volumeTrend30Days = Math.max(-1, Math.min(1, Math.round(volumeTrend30Days * 100) / 100));

      const metrics: ProductMetrics = {
        productId: g._id,
        totalOrders: g.totalOrders,
        deliveredOrders: g.deliveredOrders,
        refusedOrders: g.refusedOrders,
        netMarginPercent,
        breakEvenROAS: ue.breakEvenROAS,
        actualROAS,
        volumeTrend30Days,
      };

      const scoreResult = calculateWinnerScore(metrics);

      return {
        ...scoreResult,
        productName: g.productName || catalog?.name || g._id,
        totalOrders: g.totalOrders,
        deliveredOrders: g.deliveredOrders,
        refusedOrders: g.refusedOrders,
        grossRevenueMillimes: g.grossRevenueMillimes,
      };
    });

    items.sort((a, b) => b.score - a.score);

    this.cacheService.set(cacheKey, items, 60);
    return items;
  }
}
