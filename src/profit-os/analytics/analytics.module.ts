import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { AdSpend, AdSpendSchema } from '../ad-spend/schemas/ad-spend.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Settlement, SettlementSchema } from '../settlements/schemas/settlement.schema';
import { CatalogModule } from '../../catalog/catalog.module';
import { CacheModule } from '../../common/cache/cache.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: AdSpend.name, schema: AdSpendSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Settlement.name, schema: SettlementSchema },
    ]),
    CatalogModule,
    CacheModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsRepository, AnalyticsService],
  exports: [AnalyticsService, AnalyticsRepository],
})
export class AnalyticsModule {}

