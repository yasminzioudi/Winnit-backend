import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { Order, OrderStatus } from './schemas/order.schema';
import {
  calculateOrderNetContribution,
  type OrderFinance,
} from '../domain/finance';
import {
  canReopen,
  validateTransition,
} from '../domain/order-state-machine';
import { CatalogService } from '../../catalog/catalog.service';
import { CacheService } from '../../common/cache/cache.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly catalogService: CatalogService,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    workspaceId: string,
    dto: CreateOrderDto,
    idempotencyKey?: string,
  ): Promise<Order> {
    // Check idempotency
    if (idempotencyKey) {
      const existing = await this.repository.findByIdempotencyKey(workspaceId, idempotencyKey);
      if (existing) {
        return existing; // 200/201 replay
      }
    }

    // Get product snapshot
    const product = await this.catalogService.findOne(workspaceId, dto.productId);
    if (!product) {
      throw new BadRequestException(`Product ${dto.productId} not found`);
    }

    // Generate order number
    const orderNumber = await this.repository.getNextOrderNumber(workspaceId);

    // Calculate net contribution
    const orderFinance: OrderFinance = {
      unitPriceMillimes: dto.unitPriceMillimes,
      unitCogsMillimes: dto.unitCogsMillimes,
      quantity: dto.quantity,
      shippingMillimes: dto.shippingMillimes,
      returnShippingMillimes: dto.returnShippingMillimes || 0,
      courierFeeMillimes: dto.courierFeeMillimes || 0,
      adCpaMillimes: dto.adCpaMillimes,
      status: 'pending',
    };
    const netContributionMillimes = calculateOrderNetContribution(orderFinance);

    try {
      const order = await this.repository.create({
        workspaceId,
        orderNumber,
        productId: dto.productId,
        productNameSnapshot: product.name,
        quantity: dto.quantity,
        unitPriceMillimes: dto.unitPriceMillimes,
        unitCogsMillimes: dto.unitCogsMillimes,
        shippingMillimes: dto.shippingMillimes,
        returnShippingMillimes: dto.returnShippingMillimes || 0,
        courierFeeMillimes: dto.courierFeeMillimes || 0,
        adCpaMillimes: dto.adCpaMillimes,
        courier: dto.courier,
        customer: dto.customer,
        status: 'pending',
        statusHistory: [
          {
            status: 'pending',
            changedAt: new Date(),
            changedBy: 'system',
          },
        ],
        placedAt: dto.placedAt ? new Date(dto.placedAt) : new Date(),
        netContributionMillimes,
        version: 1,
        idempotencyKey,
      });

      this.cacheService.invalidateWorkspace(workspaceId);
      return order;
    } catch (error: any) {
      // Handle E11000 duplicate key error for concurrent idempotency key
      if (error.code === 11000 && idempotencyKey) {
        const existing = await this.repository.findByIdempotencyKey(workspaceId, idempotencyKey);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  async findById(workspaceId: string, id: string): Promise<Order> {
    const order = await this.repository.findById(workspaceId, id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async findMany(workspaceId: string, query: QueryOrdersDto) {
    const orders = await this.repository.findMany(workspaceId, query);
    const nextCursor = orders.length === (query.limit || 20) && orders.length > 0
      ? Buffer.from(
          JSON.stringify({
            placedAt: orders[orders.length - 1].placedAt,
            id: orders[orders.length - 1]._id,
          }),
        ).toString('base64')
      : null;

    return {
      data: orders,
      meta: { nextCursor },
    };
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateOrderDto,
  ): Promise<Order> {
    const order = await this.repository.findById(workspaceId, id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Recompute net contribution
    const orderFinance: OrderFinance = {
      unitPriceMillimes: dto.unitPriceMillimes ?? order.unitPriceMillimes,
      unitCogsMillimes: order.unitCogsMillimes,
      quantity: order.quantity,
      shippingMillimes: dto.shippingMillimes ?? order.shippingMillimes,
      returnShippingMillimes: dto.returnShippingMillimes ?? order.returnShippingMillimes,
      courierFeeMillimes: order.courierFeeMillimes,
      adCpaMillimes: dto.adCpaMillimes ?? order.adCpaMillimes,
      status: order.status,
    };
    const netContributionMillimes = calculateOrderNetContribution(orderFinance);

    const updated = await this.repository.update(workspaceId, id, dto.version, {
      ...dto,
      netContributionMillimes,
    });

    if (!updated) {
      throw new ConflictException('Version conflict or order not found');
    }

    this.cacheService.invalidateWorkspace(workspaceId);
    return updated;
  }

  async changeStatus(
    workspaceId: string,
    id: string,
    dto: ChangeStatusDto,
  ): Promise<Order> {
    const order = await this.repository.findById(workspaceId, id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate transition
    try {
      validateTransition(order.status, dto.status as OrderStatus);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid transition';
      throw new UnprocessableEntityException(errorMessage);
    }

    // Recompute net contribution with new status
    const orderFinance: OrderFinance = {
      unitPriceMillimes: order.unitPriceMillimes,
      unitCogsMillimes: order.unitCogsMillimes,
      quantity: order.quantity,
      shippingMillimes: order.shippingMillimes,
      returnShippingMillimes: order.returnShippingMillimes,
      courierFeeMillimes: order.courierFeeMillimes,
      adCpaMillimes: order.adCpaMillimes,
      status: dto.status as OrderStatus,
    };
    const netContributionMillimes = calculateOrderNetContribution(orderFinance);

    const additionalUpdates: Record<string, unknown> = {
      netContributionMillimes,
    };
    if (dto.status === 'delivered') {
      additionalUpdates.deliveredAt = new Date();
    }

    const updated = await this.repository.updateStatus(
      workspaceId,
      id,
      dto.version,
      dto.status,
      {
        status: dto.status,
        changedAt: new Date(),
        changedBy: dto.changedBy || 'system',
      },
      additionalUpdates,
    );

    if (!updated) {
      throw new ConflictException('Version conflict or order not found');
    }

    this.cacheService.invalidateWorkspace(workspaceId);
    return updated;
  }

  async bulkChangeStatus(
    workspaceId: string,
    dto: BulkStatusDto,
  ) {
    const results = [];

    for (const item of dto.items) {
      try {
        const order = await this.repository.findById(workspaceId, item.orderId);
        if (!order) {
          results.push({
            orderId: item.orderId,
            success: false,
            error: 'Order not found',
          });
          continue;
        }

        // Validate transition
        validateTransition(order.status, item.status as OrderStatus);

        const additionalUpdates: Record<string, unknown> = {};
        if (item.status === 'delivered') {
          additionalUpdates.deliveredAt = new Date();
        }

        const updated = await this.repository.updateStatus(
          workspaceId,
          item.orderId,
          order.version,
          item.status,
          {
            status: item.status,
            changedAt: new Date(),
            changedBy: dto.changedBy || 'system',
            action: 'bulk_status_update',
          },
          additionalUpdates,
        );

        if (!updated) {
          results.push({
            orderId: item.orderId,
            success: false,
            error: 'Version conflict',
          });
        } else {
          results.push({
            orderId: item.orderId,
            success: true,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          orderId: item.orderId,
          success: false,
          error: errorMessage,
        });
      }
    }

    return { results };
  }

  async reopen(workspaceId: string, id: string, changedBy?: string): Promise<Order> {
    const order = await this.repository.findById(workspaceId, id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if reopen is allowed
    if (!canReopen(order.status)) {
      throw new UnprocessableEntityException(
        'Only refused orders can be reopened to delivered',
      );
    }

    // Recompute net contribution with delivered status
    const orderFinance: OrderFinance = {
      unitPriceMillimes: order.unitPriceMillimes,
      unitCogsMillimes: order.unitCogsMillimes,
      quantity: order.quantity,
      shippingMillimes: order.shippingMillimes,
      returnShippingMillimes: order.returnShippingMillimes,
      courierFeeMillimes: order.courierFeeMillimes,
      adCpaMillimes: order.adCpaMillimes,
      status: 'delivered',
    };
    const netContributionMillimes = calculateOrderNetContribution(orderFinance);

    const updated = await this.repository.updateStatus(
      workspaceId,
      id,
      order.version,
      'delivered',
      {
        status: 'delivered',
        changedAt: new Date(),
        changedBy: changedBy || 'system',
        action: 'reopen',
      },
      { deliveredAt: new Date(), netContributionMillimes },
    );

    if (!updated) {
      throw new ConflictException('Version conflict or order not found');
    }

    this.cacheService.invalidateWorkspace(workspaceId);
    return updated;
  }

  async softDelete(workspaceId: string, id: string): Promise<void> {
    const deleted = await this.repository.softDelete(workspaceId, id);
    if (!deleted) {
      throw new NotFoundException('Order not found');
    }
    this.cacheService.invalidateWorkspace(workspaceId);
  }
}
