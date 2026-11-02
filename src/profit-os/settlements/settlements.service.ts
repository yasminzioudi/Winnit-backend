import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SettlementsRepository } from './settlements.repository';
import { OrdersRepository } from '../orders/orders.repository';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { UpdateSettlementDto } from './dto/update-settlement.dto';
import { QuerySettlementsDto } from './dto/query-settlements.dto';
import { Settlement } from './schemas/settlement.schema';
import { CacheService } from '../../common/cache/cache.service';
import { withIdempotency, hashPayload } from '../../common/utils/idempotency.utils';
import { assertOptimisticUpdate } from '../../common/utils/optimistic-lock.utils';
import { paginatePage } from '../../common/utils/pagination.utils';

@Injectable()
export class SettlementsService {
  constructor(
    private readonly repository: SettlementsRepository,
    private readonly ordersRepository: OrdersRepository,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    workspaceId: string,
    dto: CreateSettlementDto,
    idempotencyKey?: string,
  ): Promise<Settlement> {
    return withIdempotency(
      workspaceId,
      idempotencyKey,
      (ws, key) => this.repository.findByIdempotencyKey(ws, key),
      async () => {
        const bodyHash = idempotencyKey ? hashPayload(dto) : undefined;
        const settlement = await this.repository.create({
          workspaceId,
          courier: dto.courier,
          settlementDate: new Date(dto.settlementDate),
          totalAmountMillimes: dto.totalAmountMillimes,
          orderIds: dto.orderIds || [],
          status: 'pending',
          version: 1,
          idempotencyKey,
          bodyHash,
        });

        this.cacheService.invalidateWorkspace(workspaceId);
        return settlement;
      },
      { requestPayload: dto },
    );
  }

  async findById(workspaceId: string, id: string): Promise<Settlement> {
    const record = await this.repository.findById(workspaceId, id);
    if (!record) {
      throw new NotFoundException('Settlement not found');
    }
    return record;
  }

  async findMany(workspaceId: string, query: QuerySettlementsDto) {
    const [data, total] = await this.repository.findMany(workspaceId, query);
    return paginatePage(data, total, query.page, query.limit);
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateSettlementDto,
  ): Promise<Settlement> {
    const existing = await this.repository.findById(workspaceId, id);
    if (!existing) {
      throw new NotFoundException('Settlement not found');
    }

    const { version, settlementDate, ...rawUpdates } = dto;
    const updates: Partial<Settlement> = { ...rawUpdates };
    if (settlementDate) {
      updates.settlementDate = new Date(settlementDate);
    }

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

  /**
   * Reconciles a courier COD settlement.
   *
   * Write order (crash-recoverable without MongoDB transactions):
   * 1. Find settlement. If null, throw 404 NotFoundException('Settlement not found').
   * 2. If status is already 'settled': skip settlement update (idempotent replay).
   * 3. If 'pending': atomically update settlement to status='settled', reconciledAt=now.
   * 4. Link orders to settlement: idempotent updateMany on orders collection ($set: { settlementId }).
   *
   * Recovery Invariant:
   * Setting the settlement to 'settled' first guarantees that if a crash occurs before step 4,
   * a subsequent retry of reconcile will find status='settled', skip step 3, and retry linking orders.
   * All operations are idempotent, safe to repeat, and require no distributed transactions.
   */
  async reconcile(workspaceId: string, id: string): Promise<Settlement> {
    const settlement = await this.repository.findById(workspaceId, id);
    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }

    let updatedSettlement: Settlement = settlement;

    if (settlement.status !== 'settled') {
      const result = await this.repository.markSettled(
        workspaceId,
        id,
        settlement.version,
      );
      if (!result) {
        // Concurrent update race: reload current state
        const reloaded = await this.repository.findById(workspaceId, id);
        if (!reloaded) {
          throw new NotFoundException('Settlement not found');
        }
        updatedSettlement = reloaded;
      } else {
        updatedSettlement = result;
      }
    }

    // Step 4: Link orders (idempotent)
    if (settlement.orderIds && settlement.orderIds.length > 0) {
      await this.ordersRepository.linkOrdersToSettlement(
        workspaceId,
        settlement.orderIds,
        settlement._id.toString(),
      );
    }

    this.cacheService.invalidateWorkspace(workspaceId);
    return updatedSettlement;
  }

  async softDelete(workspaceId: string, id: string): Promise<void> {
    const deleted = await this.repository.softDelete(workspaceId, id);
    if (!deleted) {
      throw new NotFoundException('Settlement not found');
    }
    this.cacheService.invalidateWorkspace(workspaceId);
  }
}

