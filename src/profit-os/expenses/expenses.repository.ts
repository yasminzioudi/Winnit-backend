import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense } from './schemas/expense.schema';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import {
  notDeletedFilter,
  softDeleteUpdate,
} from '../../common/utils/soft-delete.utils';

@Injectable()
export class ExpensesRepository {
  constructor(
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
  ) {}

  async create(data: Partial<Expense>): Promise<Expense> {
    return this.expenseModel.create(data);
  }

  async findByIdempotencyKey(
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<Expense | null> {
    return this.expenseModel.findOne(
      notDeletedFilter({ workspaceId, idempotencyKey }),
    );
  }

  async findById(workspaceId: string, id: string): Promise<Expense | null> {
    return this.expenseModel.findOne(
      notDeletedFilter({ _id: id, workspaceId }),
    );
  }

  async findMany(
    workspaceId: string,
    query: QueryExpensesDto,
  ): Promise<[Expense[], number]> {
    const filter: Record<string, unknown> = notDeletedFilter({ workspaceId });

    if (query.category) {
      filter.category = query.category;
    }
    if (query.periodType) {
      filter.periodType = query.periodType;
    }
    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) dateFilter.$gte = new Date(query.from);
      if (query.to) dateFilter.$lte = new Date(query.to);
      filter.startDate = dateFilter;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(query.limit || 20, 100));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.expenseModel
        .find(filter)
        .sort({ startDate: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      this.expenseModel.countDocuments(filter),
    ]);

    return [data, total];
  }

  async update(
    workspaceId: string,
    id: string,
    version: number,
    update: Partial<Expense>,
  ): Promise<Expense | null> {
    return this.expenseModel.findOneAndUpdate(
      notDeletedFilter({ _id: id, workspaceId, version }),
      { $set: { ...update, version: version + 1 } },
      { returnDocument: 'after' },
    );
  }

  async softDelete(workspaceId: string, id: string): Promise<boolean> {
    const result = await this.expenseModel.updateOne(
      notDeletedFilter({ _id: id, workspaceId }),
      { $set: softDeleteUpdate() },
    );
    return result.modifiedCount > 0;
  }
}

