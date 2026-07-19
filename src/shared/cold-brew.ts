import type { Tea, TeaCategory } from "./types";

/**
 * What happens if the brew is left in the fridge overnight (8-12h).
 *
 * Cold water extracts selectively: amino acids (theanine, sweetness) dissolve
 * readily at 4°C, catechins and caffeine barely move without heat. So a long
 * steep usually does NOT over-extract the way a long hot steep does — the same
 * ratio works for 3h or 12h. The exception is leaf surface area: deep-steamed
 * sencha, CTC/broken black and fine-cut leaf extract fast even cold.
 */
export type OvernightAdvice =
  | { kind: "ok" }
  | { kind: "reduce"; g_per_l: number }
  | { kind: "avoid"; reason: string };

export interface ColdBrewRule {
  g_per_l: number;
  /** Recommended steep window at fridge temperature, [min, max] hours. */
  hours: [number, number];
  overnight: OvernightAdvice;
  /** One short line of category-specific guidance. */
  note?: string;
}

/** Fridge temperature the whole model assumes. */
export const COLD_BREW_TEMP_C = 4;

const OK: OvernightAdvice = { kind: "ok" };

const MATCHA_REASON =
  "Matcha is whisked into suspension, not steeped — the powder is already the drink. Cold water leaves it gritty and flat. Shake it cold instead if you want it iced.";

/**
 * Per-category cold brew parameters.
 *
 * Baseline is 1:100 — 10 g per litre — which is where most published guidance
 * converges (the Japanese "911" formula is 9 g / 1 L / 1 night; hojicha and
 * black tea guides both state 1 g per 100 ml). Deviations from 10 are
 * deliberate and noted:
 *   - gyokuro is roughly double, because the style is meant to be thick
 *   - fukamushi and turkish sit under it, because broken/fine-cut leaf extracts
 *     faster and would turn muddy at the full dose
 *   - herbals take more, having no tannins to over-extract
 *
 * Published numbers vary widely (white tea alone spans 8–30 g/L). Two things
 * explain most of that spread: recipes that are secretly *concentrates* meant
 * to be poured over ice, and doses given in teaspoons, which is meaningless
 * across leaf densities — a teaspoon of fluffy hojicha and one of dense gyokuro
 * differ by more than 2×. Everything here is grams, ready-to-drink strength.
 *
 * `null` means the category must not be cold brewed at all — the UI hides the
 * mode entirely. Categories absent from the table fall back to DEFAULT_RULE.
 */
const COLD_BREW_RULES: Partial<Record<TeaCategory, ColdBrewRule | null>> = {
  // Matcha is a whisked suspension, not an infusion — there is nothing to steep.
  "matcha-ceremonial": null,
  "matcha-everyday": null,
  "matcha-single-cultivar": null,
  "matcha-culinary": null,
  // Spices need heat (and usually milk) to release; cold steeping gives dusty water.
  "masala-chai": null,

  // Japanese greens — the classic mizudashi range, around the 1:100 baseline.
  gyokuro: {
    g_per_l: 18,
    hours: [4, 8],
    overnight: OK,
    note: "Roughly double the usual dose — gyokuro cold brew is meant to be thick and sweet, and cold water favours theanine over catechins.",
  },
  sencha: { g_per_l: 10, hours: [3, 6], overnight: OK },
  "sencha-tokusen": { g_per_l: 10, hours: [3, 6], overnight: OK },
  "sencha-asamushi": {
    g_per_l: 10,
    hours: [4, 7],
    overnight: OK,
    note: "Lightly steamed, mostly intact leaf — needs a little longer to open.",
  },
  "sencha-fukamushi": {
    g_per_l: 8,
    hours: [2, 4],
    overnight: { kind: "reduce", g_per_l: 6 },
    note: "Deep-steamed leaf is already broken, so it extracts fast even cold.",
  },
  tamaryokucha: { g_per_l: 10, hours: [3, 6], overnight: OK },
  kukicha: {
    g_per_l: 10,
    hours: [4, 8],
    overnight: OK,
    note: "Stems carry most of the sweetness — very forgiving cold.",
  },
  genmaicha: { g_per_l: 10, hours: [4, 6], overnight: OK, note: "Toasted rice gives body without bitterness." },
  hojicha: {
    g_per_l: 12,
    hours: [4, 8],
    overnight: OK,
    note: "Roasting already burned off what would turn bitter — takes more leaf, and stays low in caffeine.",
  },
  "hojicha-from-gyokuro": { g_per_l: 12, hours: [4, 8], overnight: OK },

  // Chinese
  "green-chinese": { g_per_l: 10, hours: [3, 6], overnight: OK },
  "white-chinese": {
    g_per_l: 10,
    hours: [6, 10],
    overnight: OK,
    note: "Unrolled, barely processed leaf needs hours to give anything up. Published doses range wildly (8–30 g/L) — this is the light end; push it up if it reads thin.",
  },
  oolong: {
    g_per_l: 10,
    hours: [6, 10],
    overnight: OK,
    note: "Tightly rolled leaf needs the full window just to unfurl in cold water. Darker roasts take 12 g/L happily.",
  },
  "black-chinese": { g_per_l: 10, hours: [5, 8], overnight: OK },
  "puer-shou": { g_per_l: 8, hours: [8, 12], overnight: OK, note: "Little leaf, long soak — it gives up plenty." },
  "puer-sheng": { g_per_l: 8, hours: [8, 12], overnight: OK },

  // South Asian / African
  darjeeling: { g_per_l: 10, hours: [5, 8], overnight: OK },
  ceylon: { g_per_l: 10, hours: [5, 8], overnight: OK },
  assam: {
    g_per_l: 10,
    hours: [5, 8],
    overnight: { kind: "reduce", g_per_l: 8 },
    note: "Often CTC — broken leaf extracts fast, so ease off for a long soak.",
  },
  kenyan: {
    g_per_l: 10,
    hours: [5, 8],
    overnight: { kind: "reduce", g_per_l: 8 },
    note: "Usually CTC — broken leaf extracts fast, so ease off for a long soak.",
  },

  // Western blends
  "earl-grey": { g_per_l: 10, hours: [4, 6], overnight: OK, note: "Bergamot oil comes through cleanly cold." },
  "english-breakfast": {
    g_per_l: 10,
    hours: [5, 8],
    overnight: { kind: "reduce", g_per_l: 8 },
    note: "Blends lean on broken leaf — ease off for a long soak.",
  },
  rooibos: {
    g_per_l: 12,
    hours: [8, 12],
    overnight: OK,
    note: "No tannins to over-extract — it will not turn bitter however long it sits.",
  },

  // Other regional
  wakocha: { g_per_l: 10, hours: [5, 8], overnight: OK },
  turkish: {
    g_per_l: 8,
    hours: [3, 5],
    overnight: {
      kind: "avoid",
      reason: "Fine-cut leaf keeps extracting — a long soak turns it thin and tannic.",
    },
    note: "Built for the çaydanlık, not the fridge. Short and light, or brew it hot.",
  },
  "moroccan-mint": { g_per_l: 10, hours: [4, 6], overnight: OK },

  // Non-tea
  tisane: { g_per_l: 12, hours: [8, 12], overnight: OK },
  herbal: { g_per_l: 12, hours: [8, 12], overnight: OK },
  fruit: { g_per_l: 12, hours: [8, 12], overnight: OK },

  other: { g_per_l: 10, hours: [4, 8], overnight: OK },
};

const DEFAULT_RULE: ColdBrewRule = { g_per_l: 10, hours: [4, 8], overnight: OK };

/**
 * Resolve cold brew parameters for a tea.
 *
 * Order: per-tea override → category table → default. Returns null when the tea
 * should not be cold brewed at all, in which case the UI hides the mode.
 *
 * Pure and derived from category alone (unlike computeUrgency, which depends on
 * today's date), so it runs at read time rather than being stamped into
 * teas.json — tuning a rule needs no re-ingest.
 */
export function getColdBrew(tea: Tea): ColdBrewRule | null {
  const override = tea.cold_brew;
  if (override?.eligible === false) return null;

  const base = COLD_BREW_RULES[tea.category];
  if (base === null) {
    // Category is ineligible. Only an explicit `eligible: true` overrides that.
    if (override?.eligible !== true) return null;
    return { ...DEFAULT_RULE, ...pickOverrides(override) };
  }

  return { ...(base ?? DEFAULT_RULE), ...pickOverrides(override) };
}

/** Why a category is off-limits. Used by the chat assistant; the UI just hides the mode. */
const INELIGIBLE_REASONS: Partial<Record<TeaCategory, string>> = {
  "matcha-ceremonial": MATCHA_REASON,
  "matcha-everyday": MATCHA_REASON,
  "matcha-single-cultivar": MATCHA_REASON,
  "matcha-culinary": MATCHA_REASON,
  "masala-chai":
    "Chai is an extraction of spices, which need heat — and usually milk — to open up. Cold steeping gives dusty water.",
};

/**
 * Explanation for why a tea cannot be cold brewed, or null if it can.
 * Prefers the per-tea override's reason over the category default.
 */
export function coldBrewIneligibleReason(tea: Tea): string | null {
  if (getColdBrew(tea) !== null) return null;
  return tea.cold_brew?.reason ?? INELIGIBLE_REASONS[tea.category] ?? "Not suited to cold brewing.";
}

function pickOverrides(override: Tea["cold_brew"]): Partial<ColdBrewRule> {
  if (!override) return {};
  const out: Partial<ColdBrewRule> = {};
  if (override.g_per_l !== undefined) out.g_per_l = override.g_per_l;
  if (override.hours !== undefined) out.hours = override.hours;
  if (override.note !== undefined) out.note = override.note;
  return out;
}

/** Leaf needed for a given volume, rounded to one decimal. */
export function coldBrewGrams(g_per_l: number, water_ml: number): number {
  return Math.round((g_per_l * water_ml) / 100) / 10;
}
