import type { Tea, TeaCategory, TeaUrgency } from "./types";

/**
 * Estimated shelf life in months per category (from acquisition/production).
 * Used as fallback when no expiry_estimate is provided.
 */
const SHELF_LIFE_MONTHS: Partial<Record<TeaCategory, number>> = {
  "matcha-ceremonial": 12,
  "matcha-everyday": 12,
  "matcha-culinary": 18,
  "matcha-single-cultivar": 12,
  sencha: 12,
  "sencha-asamushi": 12,
  "sencha-fukamushi": 12,
  "sencha-tokusen": 12,
  gyokuro: 12,
  genmaicha: 12,
  hojicha: 18,
  "hojicha-from-gyokuro": 18,
  kukicha: 12,
  tamaryokucha: 12,
  wakocha: 24,
  "green-chinese": 18,
  "white-chinese": 36,
  oolong: 24,
  "black-chinese": 36,
  "english-breakfast": 36,
  ceylon: 36,
  "earl-grey": 36,
  turkish: 36,
  herbal: 24,
  "puer-shou": Infinity,
  other: 24,
};

/**
 * Compute urgency dynamically from expiry_estimate + category shelf life.
 * @param tea - The tea to compute urgency for
 * @param today - Current date (injectable for testing)
 */
export function computeUrgency(tea: Tea, today: Date = new Date()): TeaUrgency {
  const monthsRemaining = getMonthsRemaining(tea, today);

  if (monthsRemaining === Infinity) return "stable";
  if (monthsRemaining <= 3) return "now";
  if (monthsRemaining <= 9) return "soon";
  if (monthsRemaining <= 18) return "no-rush";
  return "stable";
}

function getMonthsRemaining(tea: Tea, today: Date): number {
  // 1. Use expiry_estimate if available (format: "YYYY.MM")
  if (tea.expiry_estimate) {
    const [yearStr, monthStr] = tea.expiry_estimate.split(".");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (!isNaN(year) && !isNaN(month)) {
      const expiry = new Date(year, month - 1);
      return monthsDiff(today, expiry);
    }
  }

  // 2. Estimate from acquisition date + category shelf life
  const shelfLife = SHELF_LIFE_MONTHS[tea.category] ?? 24;
  if (shelfLife === Infinity) return Infinity;

  if (tea.acquisition?.year) {
    const acqMonth = tea.acquisition.month ?? 6; // assume mid-year if unknown
    const acquired = new Date(tea.acquisition.year, acqMonth - 1);
    const estimatedExpiry = new Date(acquired);
    estimatedExpiry.setMonth(estimatedExpiry.getMonth() + shelfLife);
    return monthsDiff(today, estimatedExpiry);
  }

  // 3. No dates at all — assume "acquired 12 months ago" as conservative default
  const fallbackAcquired = new Date(today);
  fallbackAcquired.setMonth(fallbackAcquired.getMonth() - 12);
  const estimatedExpiry = new Date(fallbackAcquired);
  estimatedExpiry.setMonth(estimatedExpiry.getMonth() + shelfLife);
  return monthsDiff(today, estimatedExpiry);
}

function monthsDiff(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}
