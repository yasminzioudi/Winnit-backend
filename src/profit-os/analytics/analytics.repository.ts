import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from '../orders/schemas/order.schema';
import { AdSpend } from '../ad-spend/schemas/ad-spend.schema';
import { Expense } from '../expenses/schemas/expense.schema';
import { Settlement } from '../settlements/schemas/settlement.schema';
import { TUNIS_TIMEZONE } from '../../common/utils/date.utils';

export interface RawProductGroup {
  _id: string;
  productName: string;
  totalOrders: number;
  deliveredOrders: number;
  refusedOrders: number;
  grossRevenueMillimes: number;
  netContributionMillimes: number;
}

export interface RawCourierGroup {
  _id: string;
  totalOrders: number;
  deliveredOrders: number;
  refusedOrders: number;
  grossRevenueMillimes: number;
  shippingMillimes: number;
  returnShippingMillimes: number;
}

export interface RawGovernorateGroup {
  _id: string;
  totalOrders: number;
  deliveredOrders: number;
  refusedOrders: number;
  grossRevenueMillimes: number;
  netContributionMillimes: number;
}

export interface RawTimeseriesOrderBucket {
  _id: string;
  ordersCount: number;
  deliveredCount: number;
  refusedCount: number;
  grossRevenueMillimes: number;
  netContributionMillimes: number;
}

export interface RawTimeseriesAdSpendBucket {
  _id: string;
  adSpendMillimes: number;
}

@Injectable()
export class AnalyticsRepository {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
    @InjectModel(AdSpend.name) private readonly adSpendModel: Model<AdSpend>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    @InjectModel(Settlement.name) private readonly settlementModel: Model<Settlement>,
  ) {}

  async findOrdersForPeriod(
    workspaceId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<Order[]> {
    return this.orderModel
      .find(
        {
          workspaceId,
          deletedAt: null,
          placedAt: { $gte: fromDate, $lte: toDate },
        },
        {
          _id: 1,
          orderNumber: 1,
          productId: 1,
          productNameSnapshot: 1,
          quantity: 1,
          unitPriceMillimes: 1,
          unitCogsMillimes: 1,
          shippingMillimes: 1,
          returnShippingMillimes: 1,
          courierFeeMillimes: 1,
          adCpaMillimes: 1,
          status: 1,
          courier: 1,
          customer: 1,
          placedAt: 1,
          deliveredAt: 1,
          settlementId: 1,
          netContributionMillimes: 1,
        },
      )
      .lean()
      .exec() as unknown as Promise<Order[]>;
  }

  async findAdSpendsForPeriod(
    workspaceId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<AdSpend[]> {
    return this.adSpendModel
      .find({
        workspaceId,
        deletedAt: null,
        periodStart: { $gte: fromDate, $lte: toDate },
      })
      .lean()
      .exec() as unknown as Promise<AdSpend[]>;
  }

  async findExpenses(workspaceId: string): Promise<Expense[]> {
    return this.expenseModel
      .find({
        workspaceId,
        deletedAt: null,
      })
      .lean()
      .exec() as unknown as Promise<Expense[]>;
  }

  async findSettlements(workspaceId: string): Promise<Settlement[]> {
    return this.settlementModel
      .find({
        workspaceId,
        deletedAt: null,
      })
      .lean()
      .exec() as unknown as Promise<Settlement[]>;
  }

  async getTimeseriesOrders(
    workspaceId: string,
    fromDate: Date,
    toDate: Date,
    granularity: 'daily' | 'weekly' | 'monthly' | 'day' | 'week' | 'month' = 'daily',
  ): Promise<RawTimeseriesOrderBucket[]> {
    const dateFormat =
      granularity === 'month' || granularity === 'monthly'
        ? '%Y-%m'
        : granularity === 'week' || granularity === 'weekly'
          ? '%Y-W%V'
          : '%Y-%m-%d';

    return this.orderModel.aggregate<RawTimeseriesOrderBucket>([
      {
        $match: {
          workspaceId,
          deletedAt: null,
          placedAt: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: '$placedAt',
              timezone: TUNIS_TIMEZONE,
            },
          },
          ordersCount: { $sum: 1 },
          deliveredCount: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          refusedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'refused'] }, 1, 0] },
          },
          grossRevenueMillimes: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'delivered'] },
                { $multiply: ['$unitPriceMillimes', '$quantity'] },
                0,
              ],
            },
          },
          netContributionMillimes: { $sum: '$netContributionMillimes' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  async getTimeseriesAdSpends(
    workspaceId: string,
    fromDate: Date,
    toDate: Date,
    granularity: 'daily' | 'weekly' | 'monthly' | 'day' | 'week' | 'month' = 'daily',
  ): Promise<RawTimeseriesAdSpendBucket[]> {
    const dateFormat =
      granularity === 'month' || granularity === 'monthly'
        ? '%Y-%m'
        : granularity === 'week' || granularity === 'weekly'
          ? '%Y-W%V'
          : '%Y-%m-%d';

    return this.adSpendModel.aggregate<RawTimeseriesAdSpendBucket>([
      {
        $match: {
          workspaceId,
          deletedAt: null,
          periodStart: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: '$periodStart',
              timezone: TUNIS_TIMEZONE,
            },
          },
          adSpendMillimes: { $sum: '$spendMillimes' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  async getProductAggregation(
    workspaceId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<RawProductGroup[]> {
    return this.orderModel.aggregate<RawProductGroup>([
      {
        $match: {
          workspaceId,
          deletedAt: null,
          placedAt: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: '$productId',
          productName: { $first: '$productNameSnapshot' },
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          refusedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'refused'] }, 1, 0] },
          },
          grossRevenueMillimes: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'delivered'] },
                { $multiply: ['$unitPriceMillimes', '$quantity'] },
                0,
              ],
            },
          },
          netContributionMillimes: { $sum: '$netContributionMillimes' },
        },
      },
      { $sort: { grossRevenueMillimes: -1 } },
    ]);
  }

  async getCourierAggregation(
    workspaceId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<RawCourierGroup[]> {
    return this.orderModel.aggregate<RawCourierGroup>([
      {
        $match: {
          workspaceId,
          deletedAt: null,
          placedAt: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: '$courier',
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          refusedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'refused'] }, 1, 0] },
          },
          grossRevenueMillimes: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'delivered'] },
                { $multiply: ['$unitPriceMillimes', '$quantity'] },
                0,
              ],
            },
          },
          shippingMillimes: { $sum: '$shippingMillimes' },
          returnShippingMillimes: { $sum: '$returnShippingMillimes' },
        },
      },
      { $sort: { totalOrders: -1 } },
    ]);
  }

  async getGovernorateAggregation(
    workspaceId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<RawGovernorateGroup[]> {
    return this.orderModel.aggregate<RawGovernorateGroup>([
      {
        $match: {
          workspaceId,
          deletedAt: null,
          placedAt: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: '$customer.governorate',
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          refusedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'refused'] }, 1, 0] },
          },
          grossRevenueMillimes: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'delivered'] },
                { $multiply: ['$unitPriceMillimes', '$quantity'] },
                0,
              ],
            },
          },
          netContributionMillimes: { $sum: '$netContributionMillimes' },
        },
      },
      { $sort: { totalOrders: -1 } },
    ]);
  }

  async getCODAgingFacet(
    workspaceId: string,
    unsettledOrderIds: string[],
    referenceDate = new Date(),
  ) {
    const d7 = new Date(referenceDate.getTime() - 7 * 86400000);
    const d14 = new Date(referenceDate.getTime() - 14 * 86400000);
    const d30 = new Date(referenceDate.getTime() - 30 * 86400000);

    const matchQuery: Record<string, unknown> = {
      workspaceId,
      deletedAt: null,
      status: 'delivered',
    };

    if (unsettledOrderIds.length > 0) {
      matchQuery._id = { $in: unsettledOrderIds };
    }

    const facetResults = await this.orderModel.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          aging: [
            {
              $project: {
                placedAt: 1,
                pendingAmount: {
                  $subtract: [
                    { $multiply: ['$unitPriceMillimes', '$quantity'] },
                    '$courierFeeMillimes',
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                days0to7Millimes: {
                  $sum: {
                    $cond: [{ $gte: ['$placedAt', d7] }, '$pendingAmount', 0],
                  },
                },
                days0to7Count: {
                  $sum: {
                    $cond: [{ $gte: ['$placedAt', d7] }, 1, 0],
                  },
                },
                days8to14Millimes: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $lt: ['$placedAt', d7] },
                          { $gte: ['$placedAt', d14] },
                        ],
                      },
                      '$pendingAmount',
                      0,
                    ],
                  },
                },
                days8to14Count: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $lt: ['$placedAt', d7] },
                          { $gte: ['$placedAt', d14] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                days15to30Millimes: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $lt: ['$placedAt', d14] },
                          { $gte: ['$placedAt', d30] },
                        ],
                      },
                      '$pendingAmount',
                      0,
                    ],
                  },
                },
                days15to30Count: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $lt: ['$placedAt', d14] },
                          { $gte: ['$placedAt', d30] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                daysOver30Millimes: {
                  $sum: {
                    $cond: [{ $lt: ['$placedAt', d30] }, '$pendingAmount', 0],
                  },
                },
                daysOver30Count: {
                  $sum: {
                    $cond: [{ $lt: ['$placedAt', d30] }, 1, 0],
                  },
                },
              },
            },
          ],
          byCourier: [
            {
              $group: {
                _id: '$courier',
                count: { $sum: 1 },
                pendingMillimes: {
                  $sum: {
                    $subtract: [
                      { $multiply: ['$unitPriceMillimes', '$quantity'] },
                      '$courierFeeMillimes',
                    ],
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    return facetResults[0];
  }

  async explainSummary(workspaceId: string, fromDate: Date, toDate: Date) {
    return this.orderModel
      .find({
        workspaceId,
        deletedAt: null,
        placedAt: { $gte: fromDate, $lte: toDate },
      })
      .explain('executionStats');
  }
}
