import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ScenariosService } from './scenarios.service';
import { ScenariosRepository } from './scenarios.repository';
import { CacheService } from '../../common/cache/cache.service';
import { hashPayload } from '../../common/utils/idempotency.utils';

describe('ScenariosService', () => {
  let service: ScenariosService;
  let repository: jest.Mocked<ScenariosRepository>;
  let cacheService: jest.Mocked<CacheService>;

  const workspaceId = 'ws_maison_ambre';
  const mockScenario = {
    _id: 'scen_001',
    workspaceId,
    name: 'Q1 Margin Push',
    productId: 'prd_001',
    unitPriceMillimes: 139000,
    unitCogsMillimes: 28000,
    shippingMillimes: 7000,
    adCpaMillimes: 22000,
    targetMarginPercent: 45.0,
    version: 1,
    deletedAt: undefined,
    idempotencyKey: 'idem_scen_1',
    bodyHash: '',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenariosService,
        {
          provide: ScenariosRepository,
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

    service = module.get<ScenariosService>(ScenariosService);
    repository = module.get(ScenariosRepository);
    cacheService = module.get(CacheService);
  });

  describe('create', () => {
    it('creates scenario and invalidates workspace cache', async () => {
      const dto = {
        name: 'Q1 Margin Push',
        productId: 'prd_001',
        unitPriceMillimes: 139000,
        unitCogsMillimes: 28000,
        shippingMillimes: 7000,
        adCpaMillimes: 22000,
      };

      repository.create.mockResolvedValue(mockScenario as any);

      const result = await service.create(workspaceId, dto);

      expect(result).toEqual(mockScenario);
      expect(repository.create).toHaveBeenCalled();
      expect(cacheService.invalidateWorkspace).toHaveBeenCalledWith(workspaceId);
    });

    it('replays same record for idempotent request with same payload', async () => {
      const dto = {
        name: 'Q1 Margin Push',
        productId: 'prd_001',
        unitPriceMillimes: 139000,
        unitCogsMillimes: 28000,
        shippingMillimes: 7000,
        adCpaMillimes: 22000,
      };
      const bodyHash = hashPayload(dto);
      const existing = { ...mockScenario, bodyHash };

      repository.findByIdempotencyKey.mockResolvedValue(existing as any);

      const result = await service.create(workspaceId, dto, 'idem_scen_1');

      expect(result).toEqual(existing);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('throws 422 when idempotency key is reused with different payload', async () => {
      const initialDto = {
        name: 'Q1 Margin Push',
        productId: 'prd_001',
        unitPriceMillimes: 139000,
        unitCogsMillimes: 28000,
        shippingMillimes: 7000,
        adCpaMillimes: 22000,
      };
      const differentDto = {
        name: 'Q1 Margin Push Modified',
        productId: 'prd_001',
        unitPriceMillimes: 149000,
        unitCogsMillimes: 28000,
        shippingMillimes: 7000,
        adCpaMillimes: 22000,
      };
      const bodyHash = hashPayload(initialDto);
      const existing = { ...mockScenario, bodyHash };

      repository.findByIdempotencyKey.mockResolvedValue(existing as any);

      await expect(
        service.create(workspaceId, differentDto, 'idem_scen_1'),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns record when found', async () => {
      repository.findById.mockResolvedValue(mockScenario as any);

      const result = await service.findById(workspaceId, 'scen_001');
      expect(result).toEqual(mockScenario);
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
      repository.findById.mockResolvedValue(mockScenario as any);
      const updated = { ...mockScenario, unitPriceMillimes: 145000, version: 2 };
      repository.update.mockResolvedValue(updated as any);

      const result = await service.update(workspaceId, 'scen_001', {
        version: 1,
        unitPriceMillimes: 145000,
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
      repository.findById.mockResolvedValue(mockScenario as any);
      repository.update.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, 'scen_001', { version: 1 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('softDelete', () => {
    it('deletes record and invalidates cache', async () => {
      repository.softDelete.mockResolvedValue(true);

      await service.softDelete(workspaceId, 'scen_001');
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

