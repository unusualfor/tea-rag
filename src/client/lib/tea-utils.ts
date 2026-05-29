import type { Tea, TeaUrgency, TeaCategory } from "@shared/types";

export const urgencyConfig: Record<
  TeaUrgency,
  { label: string; color: string; dotColor: string }
> = {
  now: { label: "Drink now", color: "text-red-700 bg-red-50", dotColor: "bg-red-500" },
  soon: { label: "Soon", color: "text-amber-700 bg-amber-50", dotColor: "bg-amber-500" },
  "no-rush": { label: "No rush", color: "text-emerald-700 bg-emerald-50", dotColor: "bg-emerald-500" },
  stable: { label: "Stable", color: "text-slate-600 bg-slate-50", dotColor: "bg-slate-400" },
};

export function caffeineLabel(level: 1 | 2 | 3 | 4 | 5): string {
  const labels: Record<number, string> = {
    1: "☕ Very low caffeine",
    2: "☕ Low caffeine",
    3: "☕ Moderate caffeine",
    4: "☕ High caffeine",
    5: "☕ Very high caffeine",
  };
  return labels[level];
}

// Map categories to broad "tradition" for color coding the placeholder
const categoryColors: Record<string, string> = {
  // Japanese greens
  "matcha-ceremonial": "from-emerald-800 to-emerald-600",
  "matcha-everyday": "from-emerald-700 to-emerald-500",
  "matcha-single-cultivar": "from-emerald-800 to-emerald-500",
  "matcha-culinary": "from-emerald-600 to-emerald-400",
  gyokuro: "from-green-800 to-green-600",
  sencha: "from-green-700 to-green-500",
  "sencha-fukamushi": "from-green-700 to-green-500",
  "sencha-asamushi": "from-green-600 to-green-400",
  "sencha-tokusen": "from-green-800 to-green-600",
  hojicha: "from-amber-800 to-amber-600",
  "hojicha-from-gyokuro": "from-amber-700 to-amber-500",
  tamaryokucha: "from-green-600 to-teal-500",
  genmaicha: "from-lime-700 to-amber-500",
  kukicha: "from-lime-600 to-lime-400",
  // Chinese
  "green-chinese": "from-emerald-600 to-teal-500",
  oolong: "from-amber-700 to-yellow-600",
  "black-chinese": "from-stone-800 to-stone-600",
  "white-chinese": "from-stone-300 to-amber-200",
  "puer-sheng": "from-stone-700 to-green-700",
  "puer-shou": "from-stone-900 to-stone-700",
  // South Asian
  darjeeling: "from-amber-600 to-orange-500",
  assam: "from-red-900 to-red-700",
  ceylon: "from-orange-700 to-amber-600",
  kenyan: "from-red-800 to-orange-600",
  "masala-chai": "from-orange-800 to-red-700",
  // Western
  "earl-grey": "from-slate-700 to-indigo-600",
  "english-breakfast": "from-red-800 to-stone-700",
  rooibos: "from-red-600 to-orange-500",
  // Regional
  turkish: "from-red-900 to-red-700",
  "moroccan-mint": "from-emerald-600 to-lime-500",
  // Non-tea
  tisane: "from-pink-500 to-rose-400",
  herbal: "from-green-500 to-lime-400",
  fruit: "from-pink-500 to-orange-400",
  other: "from-slate-600 to-slate-400",
};

export function getCategoryGradient(category: TeaCategory): string {
  return categoryColors[category] || categoryColors.other;
}

export function formatBrewingTemp(temp: number): string {
  return `${temp}°C`;
}

export function formatBrewingTime(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  return `${seconds}s`;
}

export function getCountryFlag(country: string): string {
  const flags: Record<string, string> = {
    Japan: "🇯🇵",
    China: "🇨🇳",
    India: "🇮🇳",
    "Sri Lanka": "🇱🇰",
    Turkey: "🇹🇷",
    Morocco: "🇲🇦",
    Kenya: "🇰🇪",
    Taiwan: "🇹🇼",
    UK: "🇬🇧",
  };
  return flags[country] || "🌍";
}
