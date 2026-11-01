/**
 * Money utilities: all money is stored as integer millimes (1 TND = 1000 millimes)
 */

export function tndToMillimes(tnd: number): number {
  return Math.round(tnd * 1000);
}

export function millimesToTnd(millimes: number): number {
  return millimes / 1000;
}

/**
 * Safe addition of millimes (avoids floating point issues)
 */
export function addMillimes(...amounts: number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}

/**
 * Format millimes for display (16420 -> "16 420 TND")
 * Only used in logs/debugging, NOT for API responses (clients format)
 */
export function formatMillimes(millimes: number): string {
  const tnd = millimesToTnd(millimes);
  const isNegative = tnd < 0;
  const abs = Math.abs(tnd);
  const formatted = abs.toLocaleString('fr-TN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  return `${isNegative ? '-' : ''}${formatted} TND`;
}
