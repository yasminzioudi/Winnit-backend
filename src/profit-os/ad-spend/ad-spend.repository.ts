import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdSpend } from './schemas/ad-spend.schema';
import { QueryAdSpendDto } from './dto/query-ad-spend.dto';
import {
  notDeletedFilter,
  softDeleteUpdate,
} from '../../common/utils/soft-delete.utils';

@Injectable()
export class AdSpendRepository {
  constructor(
    @InjectModel(AdSpend.name) private readonly adSpendModel: Model<AdSpend>,
  ) {}

  async create(data: Partial<AdSpend>): Promise<AdSpend> {
    return this.adSpendModel.create(data);
  }

  async findByIdempotencyKey(
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<AdSpend | null> {
    return this.adSpendModel.findOne(
      notDeletedFilter({ workspaceId, idempotencyKey }),
    );
  }

  async findById(workspaceId: string, id: string): Promise<AdSpend | null> {
    return this.adSpendModel.findOne(
      notDeletedFilter({ _id: id, workspaceId }),
    );
  }

  async findMany(
    workspaceId: string,
    query: QueryAdSpendDto,
  ): Promise<[AdSpend[], number]> {
    const filter: Record<string, unknown> = notDeletedFilter({ workspaceId });

    if (query.platform) {
      filter.platform = query.platform;
    }
    if (query.productId) {
      filter.productId = query.productId;
    }
    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) dateFilter.$gte = new Date(query.from);
      if (query.to) dateFilter.$lte = new Date(query.to);
      filter.periodStart = dateFilter;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(query.limit || 20, 100));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.adSpendModel
        .find(filter)
        .sort({ periodStart: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      this.adSpendModel.countDocuments(filter),
    ]);

    return [data, total];
  }

  async update(
    workspaceId: string,
    id: string,
    version: number,
    update: Partial<AdSpend>,
  ): Promise<AdSpend | null> {
    return this.adSpendModel.findOneAndUpdate(
      notDeletedFilter({ _id: id, workspaceId, version }),
      { $set: { ...update, version: version + 1 } },
      { returnDocument: 'after' },
    );
  }

  async softDelete(workspaceId: string, id: string): Promise<boolean> {
    const result = await this.adSpendModel.updateOne(
      notDeletedFilter({ _id: id, workspaceId }),
      { $set: softDeleteUpdate() },
    );
    return result.modifiedCount > 0;
  }
}
