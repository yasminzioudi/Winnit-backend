import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { SettlementsRepository } from './settlements.repository';
import { Settlement, SettlementSchema } from './schemas/settlement.schema';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Settlement.name, schema: SettlementSchema },
    ]),
    OrdersModule,
  ],
  controllers: [SettlementsController],
  providers: [SettlementsService, SettlementsRepository],
  exports: [SettlementsService, SettlementsRepository],
})
export class SettlementsModule {}
