/**
 * Nightly Vectorize metadata sync (cron-triggered).
 *
 * Vector metadata is written at ingest time, so `urgency` — which is derived
 * from today's date — drifts as teas age, and metadata-filtered searches start
 * returning the wrong set. This re-reads the stored vectors, patches the
 * derived fields, and upserts only the ones that changed. Values are reused
 * as-is, so no re-embedding happens.
 */

import type { Tea } from "../shared/types";
import { getTeas, isInStock } from "./teas";

const BATCH_SIZE = 50;

export async function refreshVectorMetadata(env: { VECTORIZE: VectorizeIndex }): Promise<{
  checked: number;
  updated: number;
  missing: string[];
}> {
  const teas = getTeas();
  const byId = new Map<string, Tea>(teas.map((t) => [t.id, t]));
  const ids = teas.map((t) => t.id);

  let updated = 0;
  const found = new Set<string>();

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const vectors = await env.VECTORIZE.getByIds(batch);

    const stale = [];
    for (const vector of vectors) {
      found.add(vector.id);
      const tea = byId.get(vector.id);
      if (!tea) continue;

      const urgency = tea.urgency;
      const in_stock = isInStock(tea);
      const metadata = vector.metadata ?? {};

      if (metadata.urgency === urgency && metadata.in_stock === in_stock) continue;

      stale.push({ ...vector, metadata: { ...metadata, urgency, in_stock } });
    }

    if (stale.length > 0) {
      await env.VECTORIZE.upsert(stale);
      updated += stale.length;
    }
  }

  // Teas with no vector yet — they need a full ingest, which the deploy
  // workflow runs. Reported so the cron log says why the counts disagree.
  const missing = ids.filter((id) => !found.has(id));

  return { checked: ids.length, updated, missing };
}
