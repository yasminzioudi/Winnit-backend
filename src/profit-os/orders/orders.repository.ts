import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from './schemas/order.schema';
import { Counter } from './schemas/counter.schema';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { notDeletedFilter, softDeleteUpdate } from '../../common/utils/soft-delete.utils';

@Injectable()
export class OrdersRepository {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Counter.name) private counterModel: Model<Counter>,
  ) {}

  async getNextOrderNumber(workspaceId: string): Promise<string> {
    const counter = await this.counterModel.findOneAndUpdate(
      { workspaceId, name: 'order' },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    return `ORD-${counter.value}`;
  }

  async create(order: Partial<Order>): Promise<Order> {
    return this.orderModel.create(order);
  }

  async findByIdempotencyKey(
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<Order | null> {
    return this.orderModel.findOne(notDeletedFilter({ workspaceId, idempotencyKey }));
  }

  async findById(workspaceId: string, id: string): Promise<Order | null> {
    return this.orderModel.findOne(notDeletedFilter({ _id: id, workspaceId }));
  }

  async findByIds(workspaceId: string, ids: string[]): Promise<Order[]> {
    return this.orderModel.find(notDeletedFilter({ _id: { $in: ids }, workspaceId }));
  }

  async findMany(workspaceId: string, query: QueryOrdersDto): Promise<Order[]> {
    const filter: Record<string, unknown> = notDeletedFilter({ workspaceId });

    // Apply filters
    if (query.status) filter.status = query.status;
    if (query.courier) filter.courier = query.courier;
    if (query.governorate) filter['customer.governorate'] = query.governorate;
    if (query.productId) filter.productId = query.productId;

    // Date range
    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) dateFilter.$gte = new Date(query.from);
      if (query.to) dateFilter.$lte = new Date(query.to);
      filter.placedAt = dateFilter;
    }

    // Search by orderNumber or city
    if (query.search) {
      filter.$or = [
        { orderNumber: { $regex: query.search, $options: 'i' } },
        { 'customer.city': { $regex: query.search, $options: 'i' } },
      ];
    }

    // Cursor pagination
    if (query.cursor) {
      const decoded = JSON.parse(Buffer.from(query.cursor, 'base64').toString('utf8'));
      filter.$or = [
        { placedAt: { $lt: new Date(decoded.placedAt) } },
        {
          placedAt: decoded.placedAt,
          _id: { $lt: decoded.id },
        },
      ];
    }

    return this.orderModel
      .find(filter)
      .sort({ placedAt: -1, _id: -1 })
      .limit(query.limit || 20);
  }

  async update(
    workspaceId: string,
    id: string,
    version: number,
    update: Partial<Order>,
  ): Promise<Order | null> {
    return this.orderModel.findOneAndUpdate(
      notDeletedFilter({ _id: id, workspaceId, version }),
      { $set: { ...update, version: version + 1 } },
      { returnDocument: 'after' },
    );
  }

  async updateStatus(
    workspaceId: string,
    id: string,
    version: number,
    status: string,
    statusHistoryEntry: Record<string, unknown>,
    additionalUpdates?: Record<string, unknown>,
  ): Promise<Order | null> {
    const update: Record<string, unknown> = {
      status,
      version: version + 1,
      ...additionalUpdates,
    };

    return this.orderModel.findOneAndUpdate(
      notDeletedFilter({ _id: id, workspaceId, version }),
      {
        $set: update,
        $push: { statusHistory: statusHistoryEntry },
      },
      { returnDocument: 'after' },
    );
  }

  async softDelete(workspaceId: string, id: string): Promise<boolean> {
    const result = await this.orderModel.updateOne(
      notDeletedFilter({ _id: id, workspaceId }),
      { $set: softDeleteUpdate() },
    );
    return result.modifiedCount > 0;
  }

  async findDeliveredOrders(workspaceId: string, orderIds: string[]): Promise<Order[]> {
    return this.orderModel.find(
      notDeletedFilter({
        _id: { $in: orderIds },
        workspaceId,
        status: 'delivered' as const,
      }),
    );
  }

  async linkOrdersToSettlement(
    workspaceId: string,
    orderIds: string[],
    settlementId: string,
  ): Promise<void> {
    await this.orderModel.updateMany(
      { _id: { $in: orderIds }, workspaceId },
      { $set: { settlementId } },
    );
  }
}
