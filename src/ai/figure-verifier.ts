import type { FinancialSnapshot } from './dto/financial-snapshot.dto';
import type { CfoFigure } from './dto/ask-cfo.dto';

export interface RawFigure {
  label: string;
  value: number;
  unit?: string;
  source?: string;
}

export interface VerificationResult {
  verifiedFigures: CfoFigure[];
  strippedFigures: RawFigure[];
  adjustedAnswer: string;
  isVerified: boolean;
}

/**
 * Recursively extracts all valid numeric values from the FinancialSnapshot.
 */
export function extractValidSnapshotNumbers(snapshot: FinancialSnapshot): number[] {
  const values: number[] = [];

  function recurse(obj: unknown) {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'number' && !isNaN(obj)) {
      values.push(obj);
      return;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        recurse(item);
      }
      return;
    }
    if (typeof obj === 'object') {
      for (const val of Object.values(obj)) {
        recurse(val);
      }
    }
  }

  recurse(snapshot);
  return values;
}

/**
 * Checks whether a candidate figure matches any snapshot number within tolerance.
 * Supports:
 * 1. Direct match (tolerance ±1% or ±0.5 for small numbers).
 * 2. Dinars to Millimes (if valid is in millimes e.g. 125,000,000, model might return 125,000 TND).
 * 3. Percentage to Ratio (scale 100, e.g. 25.6% vs 0.256).
 */
export function isValueMatching(figureValue: number, snapshotValues: number[]): boolean {
  if (typeof figureValue !== 'number' || isNaN(figureValue)) {
    return false;
  }

  for (const valid of snapshotValues) {
    // 1. Direct match (tolerance ±1% or ±0.5 for integer counts)
    const tolerance = Math.max(0.5, Math.abs(valid) * 0.01);
    if (Math.abs(figureValue - valid) <= tolerance) {
      return true;
    }

    // 2. Dinars to Millimes: snapshot has millimes (e.g. 125,000,000), figure is TND (125,000)
    // Only apply if valid is reasonably large (e.g. >= 1000 millimes)
    if (Math.abs(valid) >= 1000) {
      const dinarValue = valid / 1000;
      const dinarTolerance = Math.max(0.5, Math.abs(dinarValue) * 0.01);
      if (Math.abs(figureValue - dinarValue) <= dinarTolerance) {
        return true;
      }
    }

    // 3. Percentage ratio (e.g. valid = 25.6%, figure = 0.256 or vice-versa)
    if (Math.abs(valid) <= 100 && Math.abs(figureValue) <= 1) {
      if (Math.abs(figureValue * 100 - valid) <= 0.5) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Pure domain function to verify figures extracted from LLM responses against the FinancialSnapshot.
 * Any unverified or hallucinated figure is stripped from the returned list.
 * If any figure is stripped, a disclaimer is appended to the answer.
 */
export function verifyFigures(
  rawFigures: RawFigure[] = [],
  snapshot: FinancialSnapshot,
  originalAnswer: string,
): VerificationResult {
  const validNumbers = extractValidSnapshotNumbers(snapshot);
  const verifiedFigures: CfoFigure[] = [];
  const strippedFigures: RawFigure[] = [];

  for (const fig of rawFigures) {
    if (isValueMatching(fig.value, validNumbers)) {
      verifiedFigures.push({
        label: fig.label,
        value: fig.value,
        unit: fig.unit || '',
        source: fig.source || 'snapshot',
        verified: true,
      });
    } else {
      strippedFigures.push(fig);
    }
  }

  let adjustedAnswer = originalAnswer;
  const isVerified = strippedFigures.length === 0;

  if (!isVerified) {
    const caveat = "Certains chiffres n'ont pas pu être vérifiés avec certitude.";
    if (!adjustedAnswer.includes(caveat)) {
      adjustedAnswer = `${adjustedAnswer.trim()}\n\n⚠️ ${caveat}`;
    }
  }

  return {
    verifiedFigures,
    strippedFigures,
    adjustedAnswer,
    isVerified,
  };
}
