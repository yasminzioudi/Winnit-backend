import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { RuleBasedInsightsProvider } from './providers/rule-based-insights.provider';
import { INSIGHTS_PROVIDER } from './ports/insights-provider.port';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  controllers: [InsightsController],
  providers: [
    InsightsService,
    {
      provide: INSIGHTS_PROVIDER,
      useClass: RuleBasedInsightsProvider,
    },
  ],
  exports: [InsightsService],
})
export class InsightsModule {}

