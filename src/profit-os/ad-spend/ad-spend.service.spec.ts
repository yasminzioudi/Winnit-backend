import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AdSpendService } from './ad-spend.service';
import { AdSpendRepository } from './ad-spend.repository';
import { CacheService } from '../../common/cache/cache.service';
import { hashPayload } from '../../common/utils/idempotency.utils';

describe('AdSpendService', () => {
  let service: AdSpendService;
  let repository: jest.Mocked<AdSpendRepository>;
  let cacheService: jest.Mocked<CacheService>;

  const workspaceId = 'ws_maison_ambre';
  const mockAdSpend = {
    _id: 'spend_001',
    workspaceId,
    platform: 'facebook',
    campaignName: 'Winter Campaign',
    periodStart: new Date('2026-01-01T00:00:00Z'),
    periodEnd: new Date('2026-01-07T23:59:59Z'),
    spendMillimes: 150000,
    currency: 'TND',
    productId: 'prd_001',
    notes: 'Winter promo',
    version: 1,
    deletedAt: undefined,
    idempotencyKey: 'idem_spend_1',
    bodyHash: '',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdSpendService,
        {
          provide: AdSpendRepository,
          useValue: {
            create: jest.fn(),
            findByIdempotencyKey: jest.fn(),
            findById: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
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

    service = module.get<AdSpendService>(AdSpendService);
    repository = module.get(AdSpendRepository);
    cacheService = module.get(CacheService);
  });

  describe('create', () => {
    it('creates ad spend and invalidates workspace cache', async () => {
      const dto = {
        platform: 'facebook',
        campaignName: 'Winter Campaign',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-07T23:59:59.000Z',
        spendMillimes: 150000,
      };

      repository.create.mockResolvedValue(mockAdSpend as any);

      const result = await service.create(workspaceId, dto);

      expect(result).toEqual(mockAdSpend);
      expect(repository.create).toHaveBeenCalled();
      expect(cacheService.invalidateWorkspace).toHaveBeenCalledWith(workspaceId);
    });

    it('replays same record for idempotent request with same payload', async () => {
      const dto = {
        platform: 'facebook',
        campaignName: 'Winter Campaign',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-07T23:59:59.000Z',
        spendMillimes: 150000,
      };
      const bodyHash = hashPayload(dto);
      const existing = { ...mockAdSpend, bodyHash };

      repository.findByIdempotencyKey.mockResolvedValue(existing as any);

      const result = await service.create(workspaceId, dto, 'idem_spend_1');

      expect(result).toEqual(existing);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('throws 422 when idempotency key is reused with different payload', async () => {
      const initialDto = {
        platform: 'facebook',
        campaignName: 'Winter Campaign',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-07T23:59:59.000Z',
        spendMillimes: 150000,
      };
      const differentDto = {
        platform: 'tiktok',
        campaignName: 'Winter Campaign',
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-01-07T23:59:59.000Z',
        spendMillimes: 200000,
      };
      const bodyHash = hashPayload(initialDto);
      const existing = { ...mockAdSpend, bodyHash };

      repository.findByIdempotencyKey.mockResolvedValue(existing as any);

      await expect(
        service.create(workspaceId, differentDto, 'idem_spend_1'),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns record when found', async () => {
      repository.findById.mockResolvedValue(mockAdSpend as any);

      const result = await service.findById(workspaceId, 'spend_001');
      expect(result).toEqual(mockAdSpend);
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
      repository.findById.mockResolvedValue(mockAdSpend as any);
      const updated = { ...mockAdSpend, spendMillimes: 180000, version: 2 };
      repository.update.mockResolvedValue(updated as any);

      const result = await service.update(workspaceId, 'spend_001', {
        version: 1,
        spendMillimes: 180000,
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
      repository.findById.mockResolvedValue(mockAdSpend as any);
      repository.update.mockResolvedValue(null); // Version mismatch

      await expect(
        service.update(workspaceId, 'spend_001', { version: 1 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('softDelete', () => {
    it('deletes record and invalidates cache', async () => {
      repository.softDelete.mockResolvedValue(true);

      await service.softDelete(workspaceId, 'spend_001');
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

