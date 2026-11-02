import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExpenseCategory =
  | 'rent'
  | 'salary'
  | 'utilities'
  | 'logistics'
  | 'marketing'
  | 'other';

export type ExpensePeriod = 'monthly' | 'one-time';

@Schema({ collection: 'expenses', timestamps: true })
export class Expense extends Document {
  @Prop({ required: true, index: true })
  workspaceId: string;

  @Prop({
    required: true,
    enum: ['rent', 'salary', 'utilities', 'logistics', 'marketing', 'other'],
    index: true,
  })
  category: ExpenseCategory;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, min: 0 })
  amountMillimes: number;

  @Prop({
    required: true,
    enum: ['monthly', 'one-time'],
    index: true,
  })
  periodType: ExpensePeriod;

  @Prop({ required: true })
  startDate: Date;

  @Prop()
  endDate?: Date;

  @Prop({ required: true, default: 1 })
  version: number;

  @Prop({ index: true })
  deletedAt?: Date;

  @Prop({ sparse: true })
  idempotencyKey?: string;

  @Prop({ sparse: true })
  bodyHash?: string;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);

// Compound tenant-first indexes
ExpenseSchema.index({ workspaceId: 1, periodType: 1 });
ExpenseSchema.index({ workspaceId: 1, category: 1 });
ExpenseSchema.index(
  { workspaceId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
