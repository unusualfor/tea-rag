// Tea category enum
export type TeaCategory =
  // Japanese
  | "matcha-ceremonial"
  | "matcha-everyday"
  | "matcha-single-cultivar"
  | "matcha-culinary"
  | "gyokuro"
  | "sencha"
  | "sencha-fukamushi"
  | "sencha-asamushi"
  | "sencha-tokusen"
  | "hojicha"
  | "hojicha-from-gyokuro"
  | "tamaryokucha"
  | "genmaicha"
  | "kukicha"
  // Chinese
  | "green-chinese"
  | "oolong"
  | "black-chinese"
  | "white-chinese"
  | "puer-sheng"
  | "puer-shou"
  // South Asian / African
  | "darjeeling"
  | "assam"
  | "ceylon"
  | "kenyan"
  | "masala-chai"
  // Western blends
  | "earl-grey"
  | "english-breakfast"
  | "rooibos"
  // Other regional
  | "turkish"
  | "moroccan-mint"
  | "wakocha"
  // Non-tea
  | "tisane"
  | "herbal"
  | "fruit"
  // Fallback
  | "other";

export type TeaUrgency = "now" | "soon" | "no-rush" | "stable";

export interface Tea {
  id: string;
  name: {
    primary: string;
    alternate?: string;
    pronunciation?: string;
  };
  category: TeaCategory;
  category_label: string;
  producer: {
    name: string;
    history?: string;
  };
  origin: {
    region: string;
    country: string;
    locality?: string | null;
  };
  acquisition: {
    location?: string;
    year: number;
    month?: number;
    context?: string;
  };
  caffeine_level: 1 | 2 | 3 | 4 | 5;
  in_stock?: boolean;
  urgency: TeaUrgency;
  expiry_estimate?: string;
  brewing?: {
    vessel?: string;
    leaf_grams_per_100ml?: number;
    rounds: Array<{
      water_temp_c: number;
      steep_time_seconds: number;
      water_ml?: number;
    }>;
    simple?: {
      leaf_grams: number;
      water_temp_c: number;
      steep_time_seconds: number;
      water_ml: number;
    };
    notes?: string;
  };
  /**
   * Per-tea escape hatch for cold brewing. Parameters are normally derived from
   * the category (see shared/cold-brew.ts) — this only exists for teas whose
   * category doesn't predict them, e.g. a smoky black that shouldn't be cold
   * brewed at all.
   */
  cold_brew?: {
    eligible?: boolean;
    /** Shown to the chat assistant when eligible is false. Not rendered in the UI. */
    reason?: string;
    g_per_l?: number;
    hours?: [number, number];
    note?: string;
  };
  notes: string;
  photo?: {
    url: string;
    alt: string;
    source?: string;
    is_local?: boolean;
  };
  tags?: string[];
}

// API types
export interface SearchRequest {
  query: string;
  filters?: {
    category?: TeaCategory;
    urgency?: TeaUrgency;
    country?: string;
  };
  top_k?: number;
}

export interface SearchResult {
  tea: Tea;
  score: number;
}
