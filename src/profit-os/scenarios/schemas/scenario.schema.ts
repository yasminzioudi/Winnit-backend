import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'scenarios', timestamps: true })
export class Scenario extends Document {
  @Prop({ required: true, index: true })
  workspaceId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  productId: string;

  @Prop({ required: true, min: 0 })
  unitPriceMillimes: number;

  @Prop({ required: true, min: 0 })
  unitCogsMillimes: number;

  @Prop({ required: true, min: 0 })
  shippingMillimes: number;

  @Prop({ required: true, min: 0 })
  adCpaMillimes: number;

  @Prop()
  targetMarginPercent?: number;

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

export const ScenarioSchema = SchemaFactory.createForClass(Scenario);

// Compound tenant-first indexes
ScenarioSchema.index({ workspaceId: 1, productId: 1 });
ScenarioSchema.index(
  { workspaceId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

