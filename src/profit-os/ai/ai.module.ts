import { Module } from '@nestjs/common';

/**
 * AI Module Placeholder (Phase 5/6 extension point)
 * 
 * DESIGN RATIONALE:
 * - Real LLM calls (OpenAI, Anthropic, Gemini) are deferred to future phases.
 * - This module defines the architectural extension point.
 * - Future AI services will implement `InsightsProvider` (from `../insights/ports/insights-provider.port`)
 *   and consume `FinancialSnapshot` (from `../insights/dto/financial-snapshot.dto`),
 *   which contains zero Personally Identifiable Information (PII) - strictly aggregated financial numbers.
 */
@Module({})
export class AiModule {}

