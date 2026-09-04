/**
 * Bundled tea data with urgency recomputed against the current date.
 *
 * `src/data/teas.json` freezes `urgency` at ingest time, so a Worker deployed
 * in May serves May's urgency in September. The client already recomputes on
 * render (see use-teas.ts); this is the same fix for the Worker side.
 *
 * Memoised per UTC day — computeUrgency is cheap but runs over the whole
 * collection on every request otherwise.
 */

import teasData from "../data/teas.json";
import type { Tea } from "../shared/types";
import { computeUrgency } from "../shared/urgency";

let cache: { day: string; teas: Tea[] } | null = null;

export function getTeas(): Tea[] {
  const day = new Date().toISOString().slice(0, 10);
  if (!cache || cache.day !== day) {
    cache = {
      day,
      teas: (teasData as Tea[]).map((tea) => ({ ...tea, urgency: computeUrgency(tea) })),
    };
  }
  return cache.teas;
}

/** A tea counts as in stock unless explicitly marked otherwise. */
export function isInStock(tea: Tea): boolean {
  return tea.in_stock !== false;
}

/** How many matches a stock filter can drop, so a query knows its headroom. */
export function outOfStockCount(): number {
  return getTeas().filter((t) => !isInStock(t)).length;
}

// Vectorize caps topK at 20 when metadata is returned.
export const MAX_TOP_K = 20;
