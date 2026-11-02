import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { CatalogService } from '../../catalog/catalog.service';
import { CacheService } from '../../common/cache/cache.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let repository: jest.Mocked<OrdersRepository>;
  let catalogService: jest.Mocked<CatalogService>;
  let cacheService: jest.Mocked<CacheService>;

  const mockProduct = { id: 'prod_001', name: 'Test Product' };
  const mockOrder = {
    _id: 'order_123',
    workspaceId: 'ws_test',
    orderNumber: 'ORD-1',
    productId: 'prod_001',
    productNameSnapshot: 'Test Product',
    quantity: 1,
    unitPriceMillimes: 100000,
    unitCogsMillimes: 30000,
    shippingMillimes: 5000,
    returnShippingMillimes: 0,
    courierFeeMillimes: 0,
    adCpaMillimes: 10000,
    courier: 'Aramex',
    customer: { firstName: 'Ahmed', city: 'Tunis', governorate: 'Tunis' },
    status: 'pending',
    statusHistory: [],
    placedAt: new Date(),
    netContributionMillimes: 55000,
    version: 1,
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: OrdersRepository,
          useValue: {
            getNextOrderNumber: jest.fn(),
            create: jest.fn(),
            findByIdempotencyKey: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: CatalogService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            invalidateWorkspace: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    repository = module.get(OrdersRepository) as jest.Mocked<OrdersRepository>;
    catalogService = module.get(CatalogService) as jest.Mocked<CatalogService>;
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
  });

  describe('create', () => {
    const createDto = {
      productId: 'prod_001',
      quantity: 1,
      unitPriceMillimes: 100000,
      unitCogsMillimes: 30000,
      shippingMillimes: 5000,
      adCpaMillimes: 10000,
      courier: 'Aramex',
      customer: { firstName: 'Ahmed', city: 'Tunis', governorate: 'Tunis' },
    };

    it('creates order and invalidates cache', async () => {
      catalogService.findOne.mockResolvedValue(mockProduct as any);
      repository.getNextOrderNumber.mockResolvedValue('ORD-1');
      repository.create.mockResolvedValue(mockOrder as any);

      const result = await service.create('ws_test', createDto);

      expect(result).toEqual(mockOrder);
      expect(cacheService.invalidateWorkspace).toHaveBeenCalledWith('ws_test');
    });

    it('handles idempotency replay', async () => {
      repository.findByIdempotencyKey.mockResolvedValue(mockOrder as any);

      const result = await service.create('ws_test', createDto, 'idempotency-123');

      expect(result).toEqual(mockOrder);
      expect(repository.create).not.toHaveBeenCalled();
      expect(cacheService.invalidateWorkspace).not.toHaveBeenCalled();
    });

    it('handles E11000 concurrent duplicate idempotency key', async () => {
      catalogService.findOne.mockResolvedValue(mockProduct as any);
      repository.getNextOrderNumber.mockResolvedValue('ORD-1');
      repository.findByIdempotencyKey
        .mockResolvedValueOnce(null) // First check
        .mockResolvedValueOnce(mockOrder as any); // After E11000

      const e11000Error: any = new Error('E11000 duplicate key');
      e11000Error.code = 11000;
      repository.create.mockRejectedValue(e11000Error);

      const result = await service.create('ws_test', createDto, 'idempotency-123');

      expect(result).toEqual(mockOrder);
    });
  });

  describe('update', () => {
    it('returns 409 on version conflict', async () => {
      repository.findById.mockResolvedValue(mockOrder as any);
      repository.update.mockResolvedValue(null);

      await expect(
        service.update('ws_test', 'order_123', {
          unitPriceMillimes: 110000,
          version: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates order and invalidates cache', async () => {
      const updated = { ...mockOrder, unitPriceMillimes: 110000, version: 2 };
      repository.findById.mockResolvedValue(mockOrder as any);
      repository.update.mockResolvedValue(updated as any);

      const result = await service.update('ws_test', 'order_123', {
        unitPriceMillimes: 110000,
        version: 1,
      });

      expect(result.version).toBe(2);
      expect(cacheService.invalidateWorkspace).toHaveBeenCalledWith('ws_test');
    });
  });

  describe('changeStatus', () => {
    it('returns 422 on illegal transition', async () => {
      // delivered → pending is illegal
      const mockDeliveredOrder = { ...mockOrder, status: 'delivered' };
      repository.findById.mockResolvedValue(mockDeliveredOrder as any);

      await expect(
        service.changeStatus('ws_test', 'order_123', {
          status: 'pending',
          version: 1,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('changes status and sets deliveredAt', async () => {
      // shipped → delivered is legal
      const mockShippedOrder = { ...mockOrder, status: 'shipped' };
      const updated = { ...mockOrder, status: 'delivered', deliveredAt: new Date(), version: 2 };
      repository.findById.mockResolvedValue(mockShippedOrder as any);
      repository.updateStatus.mockResolvedValue(updated as any);

      const result = await service.changeStatus('ws_test', 'order_123', {
        status: 'delivered',
        version: 1,
      });

      expect(result.status).toBe('delivered');
      expect(result.deliveredAt).toBeDefined();
      expect(cacheService.invalidateWorkspace).toHaveBeenCalledWith('ws_test');
    });
  });

  describe('bulkChangeStatus', () => {
    it('returns per-item results with partial failures', async () => {
      const order1 = { ...mockOrder, _id: 'order_1', status: 'pending' };
      const order2 = { ...mockOrder, _id: 'order_2', status: 'shipped' };

      repository.findById
        .mockResolvedValueOnce(order1 as any)
        .mockResolvedValueOnce(order2 as any);

      repository.updateStatus
        .mockResolvedValueOnce({ ...order1, status: 'confirmed', version: 2 } as any)
        .mockResolvedValueOnce({ ...order2, status: 'delivered', version: 2 } as any);

      const result = await service.bulkChangeStatus('ws_test', {
        items: [
          { orderId: 'order_1', status: 'confirmed' },
          { orderId: 'order_2', status: 'delivered' },
        ],
      });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
    });

    it('reports individual failures', async () => {
      repository.findById
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockOrder as any);

      const result = await service.bulkChangeStatus('ws_test', {
        items: [
          { orderId: 'not_found', status: 'delivered' },
          { orderId: 'order_123', status: 'pending' }, // Illegal
        ],
      });

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toContain('not found');
      expect(result.results[1].success).toBe(false);
    });
  });

  describe('reopen', () => {
    it('reopens refused order to delivered', async () => {
      const refusedOrder = { ...mockOrder, status: 'refused' };
      const reopened = { ...refusedOrder, status: 'delivered', version: 2 };
      repository.findById.mockResolvedValue(refusedOrder as any);
      repository.updateStatus.mockResolvedValue(reopened as any);

      const result = await service.reopen('ws_test', 'order_123', 'user_1');

      expect(result.status).toBe('delivered');
      expect(cacheService.invalidateWorkspace).toHaveBeenCalledWith('ws_test');
    });

    it('throws 422 if order is not refused', async () => {
      repository.findById.mockResolvedValue(mockOrder as any);

      await expect(service.reopen('ws_test', 'order_123')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('softDelete', () => {
    it('soft deletes order and invalidates cache', async () => {
      repository.softDelete.mockResolvedValue(true);

      await service.softDelete('ws_test', 'order_123');

      expect(repository.softDelete).toHaveBeenCalledWith('ws_test', 'order_123');
      expect(cacheService.invalidateWorkspace).toHaveBeenCalledWith('ws_test');
    });

    it('throws 404 if order not found', async () => {
      repository.softDelete.mockResolvedValue(false);

      await expect(service.softDelete('ws_test', 'order_123')).rejects.toThrow(NotFoundException);
    });
  });
});
