# WINNIT OS AI Module Placeholder

## Architecture & Integration Point

This module provides the architectural extension point for AI/LLM-powered features in future phases.

### Key Principles:
1. **Zero PII Leakage**: The AI layer will only accept `FinancialSnapshot` DTOs containing purely anonymized and aggregated financial metrics. Customer names, phones, addresses, and individual order numbers are strictly excluded.
2. **Provider Port Pattern**: The AI generator will implement the `InsightsProvider` interface defined at `src/profit-os/insights/ports/insights-provider.port.ts`.
3. **Pluggable**: Can be swapped or chained with `RuleBasedInsightsProvider` via NestJS dependency injection without touching callers.

