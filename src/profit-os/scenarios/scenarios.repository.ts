import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Scenario } from './schemas/scenario.schema';
import { QueryScenariosDto } from './dto/query-scenarios.dto';
import {
  notDeletedFilter,
  softDeleteUpdate,
} from '../../common/utils/soft-delete.utils';

@Injectable()
export class ScenariosRepository {
  constructor(
    @InjectModel(Scenario.name) private readonly scenarioModel: Model<Scenario>,
  ) {}

  async create(data: Partial<Scenario>): Promise<Scenario> {
    return this.scenarioModel.create(data);
  }

  async findByIdempotencyKey(
    workspaceId: string,
    idempotencyKey: string,
  ): Promise<Scenario | null> {
    return this.scenarioModel.findOne(
      notDeletedFilter({ workspaceId, idempotencyKey }),
    );
  }

  async findById(workspaceId: string, id: string): Promise<Scenario | null> {
    return this.scenarioModel.findOne(
      notDeletedFilter({ _id: id, workspaceId }),
    );
  }

  async findMany(
    workspaceId: string,
    query: QueryScenariosDto,
  ): Promise<[Scenario[], number]> {
    const filter: Record<string, unknown> = notDeletedFilter({ workspaceId });

    if (query.productId) {
      filter.productId = query.productId;
    }
    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(query.limit || 20, 100));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.scenarioModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      this.scenarioModel.countDocuments(filter),
    ]);

    return [data, total];
  }

  async update(
    workspaceId: string,
    id: string,
    version: number,
    update: Partial<Scenario>,
  ): Promise<Scenario | null> {
    return this.scenarioModel.findOneAndUpdate(
      notDeletedFilter({ _id: id, workspaceId, version }),
      { $set: { ...update, version: version + 1 } },
      { returnDocument: 'after' },
    );
  }

  async softDelete(workspaceId: string, id: string): Promise<boolean> {
    const result = await this.scenarioModel.updateOne(
      notDeletedFilter({ _id: id, workspaceId }),
      { $set: softDeleteUpdate() },
    );
    return result.modifiedCount > 0;
  }
}

