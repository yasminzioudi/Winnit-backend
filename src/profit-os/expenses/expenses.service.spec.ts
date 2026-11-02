import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesRepository } from './expenses.repository';
import { CacheService } from '../../common/cache/cache.service';
import { hashPayload } from '../../common/utils/idempotency.utils';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let repository: jest.Mocked<ExpensesRepository>;
  let cacheService: jest.Mocked<CacheService>;

  const workspaceId = 'ws_maison_ambre';
  const mockExpense = {
    _id: 'exp_001',
    workspaceId,
    category: 'rent' as const,
    description: 'Bureau Tunis',
    amountMillimes: 1200000,
    periodType: 'monthly' as const,
    startDate: new Date('2026-01-01T00:00:00Z'),
    version: 1,
    deletedAt: undefined,
    idempotencyKey: 'idem_exp_1',
    bodyHash: '',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: ExpensesRepository,
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

    service = module.get<ExpensesService>(ExpensesService);
    repository = module.get(ExpensesRepository);
    cacheService = module.get(CacheService);
  });

  describe('create', () => {
    it('creates expense and invalidates workspace cache', async () => {
      const dto = {
        category: 'rent' as const,
        description: 'Bureau Tunis',
        amountMillimes: 1200000,
        periodType: 'monthly' as const,
        startDate: '2026-01-01T00:00:00.000Z',
      };

      repository.create.mockResolvedValue(mockExpense as any);

      const result = await service.create(workspaceId, dto);

      expect(result).toEqual(mockExpense);
      expect(repository.create).toHaveBeenCalled();
      expect(cacheService.invalidateWorkspace).toHaveBeenCalledWith(workspaceId);
    });

    it('replays same record for idempotent request with same payload', async () => {
      const dto = {
        category: 'rent' as const,
        description: 'Bureau Tunis',
        amountMillimes: 1200000,
        periodType: 'monthly' as const,
        startDate: '2026-01-01T00:00:00.000Z',
      };
      const bodyHash = hashPayload(dto);
      const existing = { ...mockExpense, bodyHash };

      repository.findByIdempotencyKey.mockResolvedValue(existing as any);

      const result = await service.create(workspaceId, dto, 'idem_exp_1');

      expect(result).toEqual(existing);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('throws 422 when idempotency key is reused with different payload', async () => {
      const initialDto = {
        category: 'rent' as const,
        description: 'Bureau Tunis',
        amountMillimes: 1200000,
        periodType: 'monthly' as const,
        startDate: '2026-01-01T00:00:00.000Z',
      };
      const differentDto = {
        category: 'rent' as const,
        description: 'Bureau Sousse',
        amountMillimes: 1500000,
        periodType: 'monthly' as const,
        startDate: '2026-01-01T00:00:00.000Z',
      };
      const bodyHash = hashPayload(initialDto);
      const existing = { ...mockExpense, bodyHash };

      repository.findByIdempotencyKey.mockResolvedValue(existing as any);

      await expect(
        service.create(workspaceId, differentDto, 'idem_exp_1'),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns record when found', async () => {
      repository.findById.mockResolvedValue(mockExpense as any);

      const result = await service.findById(workspaceId, 'exp_001');
      expect(result).toEqual(mockExpense);
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
      repository.findById.mockResolvedValue(mockExpense as any);
      const updated = { ...mockExpense, amountMillimes: 1300000, version: 2 };
      repository.update.mockResolvedValue(updated as any);

      const result = await service.update(workspaceId, 'exp_001', {
        version: 1,
        amountMillimes: 1300000,
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
      repository.findById.mockResolvedValue(mockExpense as any);
      repository.update.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, 'exp_001', { version: 1 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('softDelete', () => {
    it('deletes record and invalidates cache', async () => {
      repository.softDelete.mockResolvedValue(true);

      await service.softDelete(workspaceId, 'exp_001');
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
