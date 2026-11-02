import type { Insight } from '../../domain/insights';
import type { FinancialSnapshot } from '../dto/financial-snapshot.dto';

export interface InsightsProvider {
  generateInsights(snapshot: FinancialSnapshot): Promise<Insight[]>;
}

export const INSIGHTS_PROVIDER = Symbol('INSIGHTS_PROVIDER');

