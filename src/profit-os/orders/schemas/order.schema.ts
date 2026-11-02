import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'refused'
  | 'cancelled';

export interface StatusHistoryEntry {
  status: OrderStatus;
  changedAt: Date;
  changedBy: string; // User ID or system
  action?: string; // e.g., "reopen", "bulk_status_update"
}

export interface CustomerInfo {
  firstName: string;
  city: string;
  governorate: string;
}

@Schema({ collection: 'orders', timestamps: true })
export class Order extends Document {
  @Prop({ required: true, index: true })
  workspaceId: string;

  @Prop({ required: true, unique: true })
  orderNumber: string; // ORD-<n>

  @Prop({ required: true, index: true })
  productId: string;

  @Prop({ required: true })
  productNameSnapshot: string; // Product name at time of order

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true })
  unitPriceMillimes: number;

  @Prop({ required: true })
  unitCogsMillimes: number;

  @Prop({ required: true })
  shippingMillimes: number;

  @Prop({ required: true, default: 0 })
  returnShippingMillimes: number;

  @Prop({ required: true, default: 0 })
  courierFeeMillimes: number;

  @Prop({ required: true })
  adCpaMillimes: number;

  @Prop({ required: true })
  courier: string; // e.g., "Aramex", "CTM", "DHL"

  @Prop({ type: Object, required: true })
  customer: CustomerInfo;

  @Prop({ required: true, enum: ['pending', 'confirmed', 'shipped', 'delivered', 'refused', 'cancelled'], index: true })
  status: OrderStatus;

  @Prop({ type: [Object], default: [] })
  statusHistory: StatusHistoryEntry[];

  @Prop({ required: true })
  placedAt: Date;

  @Prop({ index: true })
  deliveredAt?: Date;

  @Prop({ index: true })
  settlementId?: string;

  @Prop({ required: true })
  netContributionMillimes: number; // Computed from domain function

  @Prop({ required: true, default: 1 })
  version: number;

  @Prop({ index: true })
  deletedAt?: Date;

  @Prop({ sparse: true })
  idempotencyKey?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Indexes: tenant-first, unique workspaceId+orderNumber, unique workspaceId+idempotencyKey
OrderSchema.index({ workspaceId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ workspaceId: 1, status: 1 });
OrderSchema.index({ workspaceId: 1, courier: 1 });
OrderSchema.index({ workspaceId: 1, 'customer.governorate': 1 });
OrderSchema.index({ workspaceId: 1, productId: 1 });
OrderSchema.index({ workspaceId: 1, placedAt: -1 });
OrderSchema.index(
  { workspaceId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
