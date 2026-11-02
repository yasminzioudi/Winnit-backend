import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ScenariosRepository } from './scenarios.repository';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { QueryScenariosDto } from './dto/query-scenarios.dto';
import { Scenario } from './schemas/scenario.schema';
import { CacheService } from '../../common/cache/cache.service';
import { withIdempotency, hashPayload } from '../../common/utils/idempotency.utils';
import { assertOptimisticUpdate } from '../../common/utils/optimistic-lock.utils';
import { paginatePage } from '../../common/utils/pagination.utils';

@Injectable()
export class ScenariosService {
  constructor(
    private readonly repository: ScenariosRepository,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    workspaceId: string,
    dto: CreateScenarioDto,
    idempotencyKey?: string,
  ): Promise<Scenario> {
    return withIdempotency(
      workspaceId,
      idempotencyKey,
      (ws, key) => this.repository.findByIdempotencyKey(ws, key),
      async () => {
        const bodyHash = idempotencyKey ? hashPayload(dto) : undefined;
        const scenario = await this.repository.create({
          workspaceId,
          name: dto.name,
          productId: dto.productId,
          unitPriceMillimes: dto.unitPriceMillimes,
          unitCogsMillimes: dto.unitCogsMillimes,
          shippingMillimes: dto.shippingMillimes,
          adCpaMillimes: dto.adCpaMillimes,
          targetMarginPercent: dto.targetMarginPercent,
          notes: dto.notes,
          version: 1,
          idempotencyKey,
          bodyHash,
        });

        this.cacheService.invalidateWorkspace(workspaceId);
        return scenario;
      },
      { requestPayload: dto },
    );
  }

  async findById(workspaceId: string, id: string): Promise<Scenario> {
    const record = await this.repository.findById(workspaceId, id);
    if (!record) {
      throw new NotFoundException('Scenario not found');
    }
    return record;
  }

  async findMany(workspaceId: string, query: QueryScenariosDto) {
    const [data, total] = await this.repository.findMany(workspaceId, query);
    return paginatePage(data, total, query.page, query.limit);
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateScenarioDto,
  ): Promise<Scenario> {
    const existing = await this.repository.findById(workspaceId, id);
    if (!existing) {
      throw new NotFoundException('Scenario not found');
    }

    const { version, ...rawUpdates } = dto;
    const updates: Partial<Scenario> = { ...rawUpdates };

    const updated = await this.repository.update(
      workspaceId,
      id,
      version,
      updates,
    );

    assertOptimisticUpdate(updated, 'Version conflict');
    this.cacheService.invalidateWorkspace(workspaceId);
    return updated!;
  }

  async softDelete(workspaceId: string, id: string): Promise<void> {
    const deleted = await this.repository.softDelete(workspaceId, id);
    if (!deleted) {
      throw new NotFoundException('Scenario not found');
    }
    this.cacheService.invalidateWorkspace(workspaceId);
  }
}

