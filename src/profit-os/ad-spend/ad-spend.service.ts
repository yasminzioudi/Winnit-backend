import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdSpendRepository } from './ad-spend.repository';
import { CreateAdSpendDto } from './dto/create-ad-spend.dto';
import { UpdateAdSpendDto } from './dto/update-ad-spend.dto';
import { QueryAdSpendDto } from './dto/query-ad-spend.dto';
import { AdSpend } from './schemas/ad-spend.schema';
import { CacheService } from '../../common/cache/cache.service';
import { withIdempotency, hashPayload } from '../../common/utils/idempotency.utils';
import { assertOptimisticUpdate } from '../../common/utils/optimistic-lock.utils';
import { paginatePage } from '../../common/utils/pagination.utils';

@Injectable()
export class AdSpendService {
  constructor(
    private readonly repository: AdSpendRepository,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    workspaceId: string,
    dto: CreateAdSpendDto,
    idempotencyKey?: string,
  ): Promise<AdSpend> {
    return withIdempotency(
      workspaceId,
      idempotencyKey,
      (ws, key) => this.repository.findByIdempotencyKey(ws, key),
      async () => {
        const bodyHash = idempotencyKey ? hashPayload(dto) : undefined;
        const adSpend = await this.repository.create({
          workspaceId,
          platform: dto.platform,
          campaignName: dto.campaignName,
          periodStart: new Date(dto.periodStart),
          periodEnd: new Date(dto.periodEnd),
          spendMillimes: dto.spendMillimes,
          currency: dto.currency || 'TND',
          productId: dto.productId,
          notes: dto.notes,
          version: 1,
          idempotencyKey,
          bodyHash,
        });

        this.cacheService.invalidateWorkspace(workspaceId);
        return adSpend;
      },
      { requestPayload: dto },
    );
  }

  async findById(workspaceId: string, id: string): Promise<AdSpend> {
    const record = await this.repository.findById(workspaceId, id);
    if (!record) {
      throw new NotFoundException('Ad spend record not found');
    }
    return record;
  }

  async findMany(workspaceId: string, query: QueryAdSpendDto) {
    const [data, total] = await this.repository.findMany(workspaceId, query);
    return paginatePage(data, total, query.page, query.limit);
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateAdSpendDto,
  ): Promise<AdSpend> {
    const existing = await this.repository.findById(workspaceId, id);
    if (!existing) {
      throw new NotFoundException('Ad spend record not found');
    }

    const { version, periodStart, periodEnd, ...rawUpdates } = dto;
    const updates: Partial<AdSpend> = { ...rawUpdates };
    if (periodStart) updates.periodStart = new Date(periodStart);
    if (periodEnd) updates.periodEnd = new Date(periodEnd);

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
      throw new NotFoundException('Ad spend record not found');
    }
    this.cacheService.invalidateWorkspace(workspaceId);
  }
}
