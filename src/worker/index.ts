import { Hono } from "hono";
import { cors } from "hono/cors";
import { ingestApp } from "./ingest-handler";
import { chatApp } from "./chat-handler";
import { getTeas, isInStock } from "./teas";
import { refreshVectorMetadata } from "./refresh-metadata";

type Bindings = {
  VECTORIZE: VectorizeIndex;
  PHOTOS: R2Bucket;
  AI: Ai;
  ENVIRONMENT: string;
  INGEST_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/api/*", cors());

// Mount ingest routes
app.route("/", ingestApp);

// Mount chat routes
app.route("/", chatApp);

// Embedding model (must match ingest)
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

// Health check
app.get("/api/health", (c) => {
  return c.json({ status: "ok", environment: c.env.ENVIRONMENT, teas: getTeas().length });
});

// Get all teas (with optional filters)
app.get("/api/teas", async (c) => {
  let filtered = [...getTeas()];

  const category = c.req.query("category");
  const urgency = c.req.query("urgency");
  const country = c.req.query("country");

  // Out-of-stock teas are hidden unless asked for, matching the browse grid.
  if (c.req.query("include_out_of_stock") !== "true") {
    filtered = filtered.filter(isInStock);
  }

  if (category) filtered = filtered.filter((t) => t.category === category);
  if (urgency) filtered = filtered.filter((t) => t.urgency === urgency);
  if (country) filtered = filtered.filter((t) => t.origin.country === country);

  return c.json({ teas: filtered, total: filtered.length });
});

// Get single tea by ID
app.get("/api/tea/:id", async (c) => {
  const id = c.req.param("id");
  const tea = getTeas().find((t) => t.id === id);
  if (!tea) return c.json({ error: "not found" }, 404);
  return c.json(tea);
});

// Search teas via vector similarity
app.post("/api/search", async (c) => {
  const body = await c.req.json<{
    query: string;
    filters?: Record<string, string>;
    top_k?: number;
    include_out_of_stock?: boolean;
  }>();
  const { query, filters, top_k = 10, include_out_of_stock = false } = body;

  if (!query || typeof query !== "string") {
    return c.json({ error: "query is required" }, 400);
  }

  // Generate embedding for the query
  const embeddingResponse = (await c.env.AI.run(EMBEDDING_MODEL, {
    text: [query],
  })) as { data: number[][] };

  const queryVector = embeddingResponse.data[0];

  // Build metadata filter
  const metadataFilter: Record<string, string | boolean> = {};
  if (!include_out_of_stock) metadataFilter.in_stock = true;
  if (filters?.category) metadataFilter.category = filters.category;
  if (filters?.urgency) metadataFilter.urgency = filters.urgency;
  if (filters?.country) metadataFilter.country = filters.country;

  // Query Vectorize
  const vectorResults = await c.env.VECTORIZE.query(queryVector, {
    topK: top_k,
    filter: Object.keys(metadataFilter).length > 0 ? metadataFilter : undefined,
    returnMetadata: "all",
  });

  // Map results back to full tea objects
  const teas = getTeas();
  const results = vectorResults.matches
    .map((match) => {
      const tea = teas.find((t) => t.id === match.id);
      return tea ? { tea, score: match.score } : null;
    })
    // Vectors ingested before in_stock existed carry no such metadata, so the
    // filter above cannot exclude them — drop them here too.
    .filter((r) => r !== null && (include_out_of_stock || isInStock(r.tea)));

  return c.json({ results, query });
});

export default {
  fetch: app.fetch,

  // Nightly: repair urgency (and in_stock) on stored vectors, which the ingest
  // freezes at deploy time. Schedule lives in wrangler.toml.
  async scheduled(_event: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(
      refreshVectorMetadata(env).then((result) => {
        console.log(
          `metadata refresh: checked ${result.checked}, updated ${result.updated}` +
            (result.missing.length > 0 ? `, missing vectors: ${result.missing.join(", ")}` : "")
        );
      })
    );
  },
};
