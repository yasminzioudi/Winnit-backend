import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettlementStatus = 'pending' | 'settled';
export type CourierType = 'aramex' | 'yalidine';

@Schema({ collection: 'settlements', timestamps: true })
export class Settlement extends Document {
  @Prop({ required: true, index: true })
  workspaceId: string;

  @Prop({ required: true, enum: ['aramex', 'yalidine'] })
  courier: CourierType;

  @Prop({ required: true })
  settlementDate: Date;

  @Prop({ required: true, min: 0 })
  totalAmountMillimes: number;

  @Prop({ type: [String], default: [] })
  orderIds: string[];

  @Prop({
    required: true,
    enum: ['pending', 'settled'],
    default: 'pending',
    index: true,
  })
  status: SettlementStatus;

  @Prop()
  reconciledAt?: Date;

  @Prop({ required: true, default: 1 })
  version: number;

  @Prop({ index: true })
  deletedAt?: Date;

  @Prop({ sparse: true })
  idempotencyKey?: string;

  @Prop({ sparse: true })
  bodyHash?: string;
}

export const SettlementSchema = SchemaFactory.createForClass(Settlement);

// Compound tenant-first indexes
SettlementSchema.index({ workspaceId: 1, status: 1 });
SettlementSchema.index({ workspaceId: 1, settlementDate: -1 });
SettlementSchema.index({ workspaceId: 1, courier: 1 });
SettlementSchema.index(
  { workspaceId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

