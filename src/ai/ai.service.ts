import { Injectable, Inject, Logger } from '@nestjs/common';
import { LLM_PROVIDER, type LlmProvider } from './interfaces/llm-provider.interface';
import { FinancialSnapshotBuilder } from './financial-snapshot.builder';
import { AiCacheService } from './ai-cache.service';
import type { FinancialSnapshot } from './dto/financial-snapshot.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(LLM_PROVIDER)
    private readonly llmProvider: LlmProvider,
    private readonly snapshotBuilder: FinancialSnapshotBuilder,
    private readonly cacheService: AiCacheService,
  ) {}

  isAvailable(): boolean {
    return this.llmProvider.isAvailable();
  }

  async getFinancialSnapshot(
    workspaceId: string,
    from: string,
    to: string,
  ): Promise<FinancialSnapshot> {
    return this.snapshotBuilder.build(workspaceId, from, to);
  }

  /**
   * Generates an AI response for a prompt and snapshot with caching and throttling.
   */
  async generateWithSnapshot(
    workspaceId: string,
    prompt: string,
    snapshot: FinancialSnapshot,
    schema?: Record<string, unknown>,
  ): Promise<string> {
    // 1. Enforce rate limit (10 / min)
    this.cacheService.checkThrottle(workspaceId);

    // 2. Check 5-minute cache keyed by snapshot hash + prompt
    const snapshotHash = this.cacheService.hashSnapshot(snapshot);
    const cacheKey = this.cacheService.buildKey(workspaceId, snapshotHash, prompt);
    const cached = this.cacheService.get<string>(cacheKey);

    if (cached) {
      return cached;
    }

    // 3. Invoke LLM provider
    const result = await this.llmProvider.generate(prompt, schema);

    // 4. Cache response for 5 minutes
    this.cacheService.set(cacheKey, result);

    return result;
  }
}
