import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { HealthModule } from './health/health.module';
import { CatalogModule } from './catalog/catalog.module';
import { CacheModule } from './common/cache/cache.module';
import { OrdersModule } from './profit-os/orders/orders.module';
import { AdSpendModule } from './profit-os/ad-spend/ad-spend.module';
import { ExpensesModule } from './profit-os/expenses/expenses.module';
import { ScenariosModule } from './profit-os/scenarios/scenarios.module';
import { SettlementsModule } from './profit-os/settlements/settlements.module';
import { AnalyticsModule } from './profit-os/analytics/analytics.module';
import { InsightsModule } from './profit-os/insights/insights.module';
import { PricingModule } from './profit-os/pricing/pricing.module';
import { AiModule } from './ai/ai.module';
import { ProblemJsonExceptionFilter } from './common/filters/problem-json-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120,
      },
    ]),
    CacheModule,
    TenancyModule,
    HealthModule,
    CatalogModule,
    OrdersModule,
    AdSpendModule,
    ExpensesModule,
    ScenariosModule,
    SettlementsModule,
    AnalyticsModule,
    InsightsModule,
    PricingModule,
    AiModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: ProblemJsonExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
