import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'counters' })
export class Counter extends Document {
  @Prop({ required: true })
  workspaceId: string;

  @Prop({ required: true })
  name: string; // e.g., "order"

  @Prop({ required: true, default: 0 })
  value: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);

// Unique index per workspace+name
CounterSchema.index({ workspaceId: 1, name: 1 }, { unique: true });
