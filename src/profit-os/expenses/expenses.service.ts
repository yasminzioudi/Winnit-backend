import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExpensesRepository } from './expenses.repository';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { Expense } from './schemas/expense.schema';
import { CacheService } from '../../common/cache/cache.service';
import { withIdempotency, hashPayload } from '../../common/utils/idempotency.utils';
import { assertOptimisticUpdate } from '../../common/utils/optimistic-lock.utils';
import { paginatePage } from '../../common/utils/pagination.utils';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly repository: ExpensesRepository,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    workspaceId: string,
    dto: CreateExpenseDto,
    idempotencyKey?: string,
  ): Promise<Expense> {
    return withIdempotency(
      workspaceId,
      idempotencyKey,
      (ws, key) => this.repository.findByIdempotencyKey(ws, key),
      async () => {
        const bodyHash = idempotencyKey ? hashPayload(dto) : undefined;
        const expense = await this.repository.create({
          workspaceId,
          category: dto.category,
          description: dto.description,
          amountMillimes: dto.amountMillimes,
          periodType: dto.periodType,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          version: 1,
          idempotencyKey,
          bodyHash,
        });

        this.cacheService.invalidateWorkspace(workspaceId);
        return expense;
      },
      { requestPayload: dto },
    );
  }

  async findById(workspaceId: string, id: string): Promise<Expense> {
    const record = await this.repository.findById(workspaceId, id);
    if (!record) {
      throw new NotFoundException('Expense record not found');
    }
    return record;
  }

  async findMany(workspaceId: string, query: QueryExpensesDto) {
    const [data, total] = await this.repository.findMany(workspaceId, query);
    return paginatePage(data, total, query.page, query.limit);
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    const existing = await this.repository.findById(workspaceId, id);
    if (!existing) {
      throw new NotFoundException('Expense record not found');
    }

    const { version, startDate, endDate, ...rawUpdates } = dto;
    const updates: Partial<Expense> = { ...rawUpdates };
    if (startDate) updates.startDate = new Date(startDate);
    if (endDate !== undefined) {
      updates.endDate = endDate ? new Date(endDate) : undefined;
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

  async softDelete(workspaceId: string, id: string): Promise<void> {
    const deleted = await this.repository.softDelete(workspaceId, id);
    if (!deleted) {
      throw new NotFoundException('Expense record not found');
    }
    this.cacheService.invalidateWorkspace(workspaceId);
  }
}
