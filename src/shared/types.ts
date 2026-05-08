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
  // Non-tea
  | "tisane"
  | "herbal"
  | "fruit"
  // Fallback
  | "other";

export type TeaUrgency = "now" | "soon" | "summer" | "calm" | "stable";

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
  urgency: TeaUrgency;
  expiry_estimate?: string;
  brewing?: {
    water_temp_c: number;
    steep_time_seconds: number;
    leaf_grams_per_100ml?: number;
    vessel?: string;
    rounds?: number;
    notes?: string;
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
