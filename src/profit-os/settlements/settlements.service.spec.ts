import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { SettlementsRepository } from './settlements.repository';
import { OrdersRepository } from '../orders/orders.repository';
import { CacheService } from '../../common/cache/cache.service';
import { hashPayload } from '../../common/utils/idempotency.utils';

describe('SettlementsService', () => {
  let service: SettlementsService;
  let repository: jest.Mocked<SettlementsRepository>;
  let ordersRepository: jest.Mocked<OrdersRepository>;
  let cacheService: jest.Mocked<CacheService>;

  const workspaceId = 'ws_maison_ambre';
  const mockSettlement = {
    _id: 'settle_001',
    workspaceId,
    courier: 'aramex' as const,
    settlementDate: new Date('2026-01-15T00:00:00Z'),
    totalAmountMillimes: 500000,
    orderIds: ['ord_001', 'ord_002'],
    status: 'pending' as const,
    version: 1,
    deletedAt: undefined,
    idempotencyKey: 'idem_settle_1',
    bodyHash: '',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementsService,
        {
          provide: SettlementsRepository,
          useValue: {
            create: jest.fn(),
            findByIdempotencyKey: jest.fn(),
            findById: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            markSettled: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: OrdersRepository,
          useValue: {
            linkOrdersToSettlement: jest.fn(),
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

    service = module.get<SettlementsService>(SettlementsService);
    repository = module.get(SettlementsRepository);
    ordersRepository = module.get(OrdersRepository);
    cacheService = module.get(CacheService);
  });

  describe('create', () => {
    it('creates settlement and invalidates workspace cache', async () => {
      const dto = {
        courier: 'aramex' as const,
        settlementDate: '2026-01-15T00:00:00.000Z',
        totalAmountMillimes: 500000,
        orderIds: ['ord_001', 'ord_002'],
      };

      repository.create.mockResolvedValue(mockSettlement as any);

      const result = await service.create(workspaceId, dto);

      expect(result).toEqual(mockSettlement);
      expect(repository.create).toHaveBeenCalled();
      expect(cacheService.invalidateWorkspace).toHaveBeenCalledWith(workspaceId);
    });

    it('replays same record for idempotent request with same payload', async () => {
      const dto = {
        courier: 'aramex' as const,
        settlementDate: '2026-01-15T00:00:00.000Z',
        totalAmountMillimes: 500000,
        orderIds: ['ord_001', 'ord_002'],
      };
      const bodyHash = hashPayload(dto);
      const existing = { ...mockSettlement, bodyHash };

      repository.findByIdempotencyKey.mockResolvedValue(existing as any);

      const result = await service.create(workspaceId, dto, 'idem_settle_1');

      expect(result).toEqual(existing);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('throws 422 when idempotency key is reused with different payload', async () => {
      const initialDto = {
        courier: 'aramex' as const,
        settlementDate: '2026-01-15T00:00:00.000Z',
        totalAmountMillimes: 500000,
        orderIds: ['ord_001'],
      };
      const differentDto = {
        courier: 'yalidine' as const,
        settlementDate: '2026-01-15T00:00:00.000Z',
        totalAmountMillimes: 600000,
        orderIds: ['ord_001', 'ord_002'],
      };
      const bodyHash = hashPayload(initialDto);
      const existing = { ...mockSettlement, bodyHash };

      repository.findByIdempotencyKey.mockResolvedValue(existing as any);

      await expect(
        service.create(workspaceId, differentDto, 'idem_settle_1'),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns record when found', async () => {
      repository.findById.mockResolvedValue(mockSettlement as any);

      const result = await service.findById(workspaceId, 'settle_001');
      expect(result).toEqual(mockSettlement);
    });

    it('throws 404 when record not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById(workspaceId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates record when version matches', async () => {
      repository.findById.mockResolvedValue(mockSettlement as any);
      const updated = { ...mockSettlement, totalAmountMillimes: 550000, version: 2 };
      repository.update.mockResolvedValue(updated as any);

      const result = await service.update(workspaceId, 'settle_001', {
        version: 1,
        totalAmountMillimes: 550000,
      });

      expect(result).toEqual(updated);
      expect(cacheService.invalidateWorkspace).toHaveBeenCalledWith(workspaceId);
    });

    it('throws 404 when updating non-existent record', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, 'nonexistent', { version: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 409 when version is stale', async () => {
      repository.findById.mockResolvedValue(mockSettlement as any);
      repository.update.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, 'settle_001', { version: 1 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('reconcile (crash-recoverable without transactions)', () => {
    it('marks pending settlement settled and links orders', async () => {
      repository.findById.mockResolvedValue(mockSettlement as any);
      const settledDoc = {
        ...mockSettlement,
        status: 'settled' as const,
        reconciledAt: new Date(),
        version: 2,
      };
      repository.markSettled.mockResolvedValue(settledDoc as any);

      const result = await service.reconcile(workspaceId, 'settle_001');

      expect(result.status).toBe('settled');
      expect(repository.markSettled).toHaveBeenCalledWith(workspaceId, 'settle_001', 1);
      expect(ordersRepository.linkOrdersToSettlement).toHaveBeenCalledWith(
        workspaceId,
        mockSettlement.orderIds,
        mockSettlement._id,
      );
      expect(cacheService.invalidateWorkspace).toHaveBeenCalledWith(workspaceId);
    });

    it('is idempotent: re-reconciling already settled settlement skips markSettled and safely re-links orders', async () => {
      const alreadySettled = {
        ...mockSettlement,
        status: 'settled' as const,
        reconciledAt: new Date('2026-01-16T10:00:00Z'),
        version: 2,
      };
      repository.findById.mockResolvedValue(alreadySettled as any);

      const result = await service.reconcile(workspaceId, 'settle_001');

      expect(result.status).toBe('settled');
      expect(repository.markSettled).not.toHaveBeenCalled();
      expect(ordersRepository.linkOrdersToSettlement).toHaveBeenCalledWith(
        workspaceId,
        mockSettlement.orderIds,
        mockSettlement._id,
      );
    });

    it('throws 404 if settlement not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.reconcile(workspaceId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('softDelete', () => {
    it('deletes record and invalidates cache', async () => {
      repository.softDelete.mockResolvedValue(true);

      await service.softDelete(workspaceId, 'settle_001');
      expect(cacheService.invalidateWorkspace).toHaveBeenCalledWith(workspaceId);
    });

    it('throws 404 when deleting non-existent record', async () => {
      repository.softDelete.mockResolvedValue(false);

      await expect(
        service.softDelete(workspaceId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

