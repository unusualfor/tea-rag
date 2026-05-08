/**
 * Worker-side ingest handler.
 * Receives the parsed tea records from the local ingest script,
 * generates embeddings via Workers AI, and upserts to Vectorize.
 *
 * Invoked via: POST /api/ingest (protected, requires admin secret)
 */

import { Hono } from "hono";
import type { Tea } from "../shared/types";

interface IngestRecord {
  id: string;
  tea: Tea;
  compositeText: string;
  contentHash: string;
}

type Bindings = {
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  INGEST_SECRET: string;
};

const ingestApp = new Hono<{ Bindings: Bindings }>();

// Embedding model — Cloudflare Workers AI BGE-base (768 dimensions)
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

ingestApp.post("/api/ingest", async (c) => {
  // Auth check
  const authHeader = c.req.header("Authorization");
  if (!authHeader || authHeader !== `Bearer ${c.env.INGEST_SECRET}`) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const records: IngestRecord[] = await c.req.json();

  if (!Array.isArray(records) || records.length === 0) {
    return c.json({ error: "empty payload" }, 400);
  }

  console.log(`Ingesting ${records.length} teas...`);

  // Generate embeddings in batches (Workers AI limit: 100 per call)
  const BATCH_SIZE = 50;
  const results: { id: string; status: string }[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const texts = batch.map((r) => r.compositeText);

    // Generate embeddings
    const embeddingResponse = (await c.env.AI.run(EMBEDDING_MODEL, {
      text: texts,
    })) as { data: number[][] };

    const embeddings = embeddingResponse.data;

    // Prepare vectors for Vectorize
    const vectors = batch.map((record, idx) => ({
      id: record.id,
      values: embeddings[idx],
      metadata: {
        category: record.tea.category,
        country: record.tea.origin.country,
        region: record.tea.origin.region,
        urgency: record.tea.urgency,
        caffeine_level: String(record.tea.caffeine_level),
        contentHash: record.contentHash,
        name: record.tea.name.primary,
        embeddingModel: EMBEDDING_MODEL,
      },
    }));

    // Upsert to Vectorize
    await c.env.VECTORIZE.upsert(vectors);

    for (const record of batch) {
      results.push({ id: record.id, status: "upserted" });
    }

    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} vectors upserted`);
  }

  return c.json({
    success: true,
    total: results.length,
    results,
  });
});

// Delete vectors for removed teas
ingestApp.post("/api/ingest/delete", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || authHeader !== `Bearer ${c.env.INGEST_SECRET}`) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const { ids }: { ids: string[] } = await c.req.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ error: "no ids provided" }, 400);
  }

  await c.env.VECTORIZE.deleteByIds(ids);

  return c.json({ success: true, deleted: ids.length });
});

export { ingestApp };
