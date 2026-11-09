import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from '../profit-os/analytics/analytics.module';
import { InsightsModule } from '../profit-os/insights/insights.module';
import { LLM_PROVIDER } from './interfaces/llm-provider.interface';
import { GeminiClient } from './gemini-client';
import { FinancialSnapshotBuilder } from './financial-snapshot.builder';
import { AiCacheService } from './ai-cache.service';
import { AiService } from './ai.service';

@Module({
  imports: [ConfigModule, AnalyticsModule, InsightsModule],
  providers: [
    GeminiClient,
    {
      provide: LLM_PROVIDER,
      useClass: GeminiClient,
    },
    FinancialSnapshotBuilder,
    AiCacheService,
    AiService,
  ],
  exports: [AiService, FinancialSnapshotBuilder, AiCacheService, LLM_PROVIDER],
})
export class AiModule {}
