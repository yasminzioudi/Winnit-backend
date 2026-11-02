import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'ad_spend', timestamps: true })
export class AdSpend extends Document {
  @Prop({ required: true, index: true })
  workspaceId: string;

  @Prop({ required: true })
  platform: string;

  @Prop({ required: true })
  campaignName: string;

  @Prop({ required: true })
  periodStart: Date;

  @Prop({ required: true })
  periodEnd: Date;

  @Prop({ required: true, min: 0 })
  spendMillimes: number;

  @Prop({ required: true, default: 'TND' })
  currency: string;

  @Prop({ index: true })
  productId?: string;

  @Prop()
  notes?: string;

  @Prop({ required: true, default: 1 })
  version: number;

  @Prop({ index: true })
  deletedAt?: Date;

  @Prop({ sparse: true })
  idempotencyKey?: string;

  @Prop({ sparse: true })
  bodyHash?: string;
}

export const AdSpendSchema = SchemaFactory.createForClass(AdSpend);

// Compound tenant-first indexes
AdSpendSchema.index({ workspaceId: 1, periodStart: -1 });
AdSpendSchema.index({ workspaceId: 1, productId: 1 });
AdSpendSchema.index(
  { workspaceId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

