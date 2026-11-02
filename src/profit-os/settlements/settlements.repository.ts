import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settlement } from './schemas/settlement.schema';
import { QuerySettlementsDto } from './dto/query-settlements.dto';
import {
  notDeletedFilter,
  softDeleteUpdate,
} from '../../common/utils/soft-delete.utils';

@Injectable()
export class SettlementsRepository {
  constructor(
    @InjectModel(Settlement.name)
    private readonly settlementModel: Model<Settlement>,
  ) {}

  async create(data: Partial<Settlement>): Promise<Settlement> {
    return this.settlementModel.create(data);
  }

  async findByIdempotencyKey(
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<Settlement | null> {
    return this.settlementModel.findOne(
      notDeletedFilter({ workspaceId, idempotencyKey }),
    );
  }

  async findById(workspaceId: string, id: string): Promise<Settlement | null> {
    return this.settlementModel.findOne(
      notDeletedFilter({ _id: id, workspaceId }),
    );
  }

  async findMany(
    workspaceId: string,
    query: QuerySettlementsDto,
  ): Promise<[Settlement[], number]> {
    const filter: Record<string, unknown> = notDeletedFilter({ workspaceId });

    if (query.courier) {
      filter.courier = query.courier;
    }
    if (query.status) {
      filter.status = query.status;
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(query.limit || 20, 100));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.settlementModel
        .find(filter)
        .sort({ settlementDate: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      this.settlementModel.countDocuments(filter),
    ]);

    return [data, total];
  }

  async update(
    workspaceId: string,
    id: string,
    version: number,
    update: Partial<Settlement>,
  ): Promise<Settlement | null> {
    return this.settlementModel.findOneAndUpdate(
      notDeletedFilter({ _id: id, workspaceId, version }),
      { $set: { ...update, version: version + 1 } },
      { returnDocument: 'after' },
    );
  }

  async markSettled(
    workspaceId: string,
    id: string,
    currentVersion: number,
  ): Promise<Settlement | null> {
    return this.settlementModel.findOneAndUpdate(
      notDeletedFilter({ _id: id, workspaceId, version: currentVersion }),
      {
        $set: {
          status: 'settled',
          reconciledAt: new Date(),
          version: currentVersion + 1,
        },
      },
      { returnDocument: 'after' },
    );
  }

  async softDelete(workspaceId: string, id: string): Promise<boolean> {
    const result = await this.settlementModel.updateOne(
      notDeletedFilter({ _id: id, workspaceId }),
      { $set: softDeleteUpdate() },
    );
    return result.modifiedCount > 0;
  }
}
