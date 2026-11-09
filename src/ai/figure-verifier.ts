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
  unverifiedTextNumbers: number[];
  adjustedAnswer: string;
  isVerified: boolean;
}

/**
 * Recursively extracts all valid numeric values from an arbitrary object or array.
 */
export function extractNumbers(obj: unknown): number[] {
  const values: number[] = [];

  function recurse(val: unknown) {
    if (val === null || val === undefined) return;
    if (typeof val === 'number' && !isNaN(val)) {
      values.push(val);
      return;
    }
    if (Array.isArray(val)) {
      for (const item of val) {
        recurse(item);
      }
      return;
    }
    if (typeof val === 'object') {
      for (const prop of Object.values(val)) {
        recurse(prop);
      }
    }
  }

  recurse(obj);
  return values;
}

/**
 * Recursively extracts all valid numeric values from the FinancialSnapshot.
 */
export function extractValidSnapshotNumbers(snapshot: FinancialSnapshot): number[] {
  return extractNumbers(snapshot);
}

/**
 * Checks whether a candidate figure matches any snapshot number within tolerance.
 * Supports:
 * 1. Direct match (tolerance ±1% or ±0.5 for small numbers/integers).
 * 2. Dinars to Millimes (if valid is in millimes e.g. 125,000,000, model might cite 125,000 TND).
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
 * Traverses a nested object by path (e.g. 'summary.expenses.netProfitMarginPercent').
 */
function getNestedValue(root: unknown, path: string): unknown {
  if (!root || typeof root !== 'object') return undefined;
  if (!path) return root;

  const parts = path.split(/[.[\]]+/).filter(Boolean);
  let current: unknown = root;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    const record = current as Record<string, unknown>;
    if (part in record) {
      current = record[part];
    } else {
      const matchingKey = Object.keys(record).find(
        (k) => k.toLowerCase() === part.toLowerCase(),
      );
      if (matchingKey) {
        current = record[matchingKey];
      } else {
        return undefined;
      }
    }
  }

  return current;
}

/**
 * Resolves the targeted snapshot property from a claimed figure source string.
 */
export function resolveSourcePath(source: string, snapshot: FinancialSnapshot): unknown {
  const clean = source.trim().replace(/^snapshot\./i, '');

  // 1. Try directly on snapshot root
  const direct = getNestedValue(snapshot, clean);
  if (direct !== undefined) return direct;

  // 2. Try on snapshot.summary
  if (snapshot.summary) {
    const fromSummary = getNestedValue(snapshot.summary, clean);
    if (fromSummary !== undefined) return fromSummary;
  }

  // 3. Handle common aliases and shortcuts
  const lower = clean.toLowerCase();
  if (lower === 'expenses' || lower.startsWith('expenses.')) {
    return getNestedValue(snapshot.summary.expenses, clean.replace(/^expenses\.?/i, ''));
  }
  if (lower === 'waterfall' || lower.startsWith('waterfall.')) {
    return getNestedValue(snapshot.summary.waterfall, clean.replace(/^waterfall\.?/i, ''));
  }
  if (lower === 'kpis' || lower.startsWith('kpis.')) {
    return getNestedValue(snapshot.summary.kpis, clean.replace(/^kpis\.?/i, ''));
  }
  if (lower === 'cod' || lower.startsWith('cod.')) {
    return getNestedValue(snapshot.codAging, clean.replace(/^cod\.?/i, ''));
  }
  if (lower === 'products' || lower === 'byproduct') {
    return snapshot.byProduct;
  }
  if (lower === 'couriers' || lower === 'bycourier') {
    return snapshot.byCourier;
  }
  if (lower === 'governorates' || lower === 'bygovernorate') {
    return snapshot.byGovernorate;
  }
  if (lower === 'winners') {
    return snapshot.winners;
  }
  if (lower === 'insights') {
    return snapshot.insights;
  }

  return undefined;
}

/**
 * Infers target section from figure label if source is absent or unmapped.
 */
function inferSectionFromLabel(label: string, snapshot: FinancialSnapshot): unknown {
  const l = label.toLowerCase();
  if (
    l.includes('profit') ||
    l.includes('marge') ||
    l.includes('dépense') ||
    l.includes('depense')
  ) {
    return [
      snapshot.summary.expenses,
      snapshot.summary.waterfall.netRealizedContributionMillimes,
      snapshot.summary.waterfall.netRealizedContributionPercent,
    ];
  }
  if (l.includes('ca') || l.includes('chiffre d') || l.includes('revenu')) {
    return snapshot.summary.waterfall.grossRevenueMillimes;
  }
  if (l.includes('cogs') || l.includes('coût produit') || l.includes('cout produit')) {
    return snapshot.summary.waterfall.productCOGSMillimes;
  }
  if (l.includes('livraison') || l.includes('expédi') || l.includes('expedi')) {
    return [
      snapshot.summary.kpis.deliveryRatePercent,
      snapshot.summary.kpis.deliveredCount,
      snapshot.summary.waterfall.outboundShippingMillimes,
    ];
  }
  if (l.includes('refus') || l.includes('retour')) {
    return [
      snapshot.summary.kpis.refusalRatePercent,
      snapshot.summary.kpis.refusedCount,
      snapshot.summary.waterfall.codRefusalPenaltyMillimes,
    ];
  }
  if (l.includes('commande') || l.includes('orders') || l.includes('panier')) {
    return snapshot.summary.kpis;
  }
  if (
    l.includes('ad spend') ||
    l.includes('pub') ||
    l.includes('cpa') ||
    l.includes('roas')
  ) {
    return [snapshot.summary.waterfall.paidAdSpendMillimes, snapshot.byProduct];
  }
  if (l.includes('cod') || l.includes('encaissement') || l.includes('règlement')) {
    return snapshot.codAging;
  }
  return undefined;
}

/**
 * Selects candidate numbers strictly based on what the figure claims (source or label).
 */
export function selectCandidateValues(
  source: string | undefined,
  label: string | undefined,
  snapshot: FinancialSnapshot,
): number[] {
  let target: unknown;

  if (source && source.trim().length > 0) {
    target = resolveSourcePath(source, snapshot);
  }

  if (target === undefined && label && label.trim().length > 0) {
    target = inferSectionFromLabel(label, snapshot);
  }

  if (target === undefined) {
    return [];
  }

  return extractNumbers(target);
}

/**
 * Extracts free-text numbers from an answer string, ignoring dates, ordinals, and year numbers.
 */
export function extractNumbersFromText(text: string): number[] {
  // 1. Remove dates (YYYY-MM-DD or DD/MM/YYYY)
  let cleaned = text
    .replace(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g, ' ')
    .replace(/\b202[0-9]\b/g, ' '); // 4-digit calendar years

  // 2. Remove ordinals, top-k, and day periods
  cleaned = cleaned.replace(
    /\b(top\s*\d+|1er|1ère|\d+ème|\d+\s*(?:jours?|mois|semaines?))\b/gi,
    ' ',
  );

  // 3. Remove numbered list prefixes (e.g. "1. ", "2) ")
  cleaned = cleaned.replace(/^\s*\d+[.)]\s+/gm, ' ');

  // 4. Remove existing caveat text to avoid re-scanning caveat markers
  cleaned = cleaned.replace(/⚠️\s*Certains chiffres n'ont pas pu être vérifiés.*/gis, ' ');

  // 5. Match numbers with optional spaces for thousands (e.g. 32 000, 125 000 000, 25.6, 25,6)
  const regex = /\b\d{1,3}(?:[ \u00A0]\d{3})+(?:[,.]\d+)?\b|\b\d+(?:[,.]\d+)?\b/g;
  const matches = cleaned.match(regex) || [];

  const extracted: number[] = [];
  for (const m of matches) {
    const normalized = m.replace(/[ \u00A0]/g, '').replace(',', '.');
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      extracted.push(num);
    }
  }

  return extracted;
}

/**
 * Scans the free-text answer for any numbers not present in the FinancialSnapshot.
 */
export function scanTextForUnverifiedNumbers(
  text: string,
  snapshot: FinancialSnapshot,
): { unverifiedNumbers: number[]; hasUnverified: boolean } {
  const allSnapshotNumbers = extractValidSnapshotNumbers(snapshot);
  const textNumbers = extractNumbersFromText(text);
  const unverifiedNumbers: number[] = [];

  for (const num of textNumbers) {
    if (!isValueMatching(num, allSnapshotNumbers)) {
      unverifiedNumbers.push(num);
    }
  }

  return {
    unverifiedNumbers,
    hasUnverified: unverifiedNumbers.length > 0,
  };
}

/**
 * Pure domain function to verify figures extracted from LLM responses against the FinancialSnapshot.
 * 1. Checks every figure against the snapshot value it CLAIMS (via source / label).
 * 2. Scans the free-text answer for any hallucinated numbers.
 * 3. Any unverified or hallucinated figure is stripped, and a disclaimer is appended to the answer.
 */
export function verifyFigures(
  rawFigures: RawFigure[] = [],
  snapshot: FinancialSnapshot,
  originalAnswer: string,
): VerificationResult {
  const verifiedFigures: CfoFigure[] = [];
  const strippedFigures: RawFigure[] = [];

  // 1. Verify structured figures against their claimed source / label
  for (const fig of rawFigures) {
    const candidateValues = selectCandidateValues(fig.source, fig.label, snapshot);
    if (candidateValues.length > 0 && isValueMatching(fig.value, candidateValues)) {
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

  // 2. Scan free-text answer for hallucinated numbers
  const textAudit = scanTextForUnverifiedNumbers(originalAnswer, snapshot);

  let adjustedAnswer = originalAnswer;
  const isVerified = strippedFigures.length === 0 && !textAudit.hasUnverified;

  if (!isVerified) {
    const caveat = "Certains chiffres n'ont pas pu être vérifiés avec certitude.";
    if (!adjustedAnswer.includes(caveat)) {
      adjustedAnswer = `${adjustedAnswer.trim()}\n\n⚠️ ${caveat}`;
    }
  }

  return {
    verifiedFigures,
    strippedFigures,
    unverifiedTextNumbers: textAudit.unverifiedNumbers,
    adjustedAnswer,
    isVerified,
  };
}
