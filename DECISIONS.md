# DECISIONS.md

Architectural and design decisions for tea-rag. Updated as the project evolves.

---

## 2025-05 — Project template: Hono + Vite (React) monorepo

**Choice**: Single repo with Hono for the Worker API and Vite + React for the frontend, deployed via Cloudflare Workers with static assets.

**Why**: Clean separation of concerns without the overhead of managing two repos or two deploy pipelines. Hono is lightweight, typed, and designed for edge runtimes. Vite gives fast HMR in dev and efficient production builds. The Cloudflare `[assets]` directive in wrangler.toml serves the built React app directly from the CDN, with the Worker handling only `/api/*` routes.

**Alternatives considered**:
- Separate Workers + Pages projects: more isolation but double the config for a personal project.
- Full-stack Cloudflare template: less control over structure, and the available templates change frequently.
- Next.js: heavier, SSR not needed for a browsable collection. The data is static enough that CSR is fine.

---

## 2025-05 — Embedding model: Workers AI BGE-base-en-v1.5

**Choice**: `@cf/baai/bge-base-en-v1.5` (768 dimensions).

**Why**: Free on Workers AI, runs at the edge, no external API calls needed. BGE-base is a solid general-purpose English embedding model. 768-dim vectors are a good balance between quality and storage/query cost for a ~40 item collection.

**Trade-offs**: If retrieval quality is insufficient for nuanced queries (Phase B chat mode), we can switch to OpenAI `text-embedding-3-small` (1536-dim) or Voyage. The ingest script tracks which model was used per vector, so migration is straightforward via a full re-index.

---

## 2025-05 — Data source: YAML files in repo

**Choice**: Each tea is a single YAML file in `content/teas/{id}.yaml`. The ingest script compiles these into `src/data/teas.json` for bundling.

**Why**: Files in the repo are the simplest possible source of truth. Diffs are readable, PRs show exactly what changed, and there's no database to manage for the canonical data. The collection is small enough (~40 items) that this approach scales fine for years.

**Workflow**: Add a YAML file → run `npm run ingest` → commit both the YAML and the updated `teas.json` → deploy.

---

## 2025-05 — UI framework: shadcn/ui + Tailwind CSS

**Choice**: shadcn/ui component library with Tailwind CSS for styling.

**Why**: Modern, minimal aesthetic. Ships fast because components are copy-pasted into the project (no runtime dependency). Looks like Linear/Cal.com out of the box. The muted green accent color (HSL 142 40% 30%) evokes tea without being literal.

---

## 2025-05 — Vectorize metadata filters vs. embedding

**Choice**: Structured fields (`urgency`, `category`, `status`, `country`) are metadata filters in Vectorize. Free-text fields (`notes`, `producer.history`, `brewing.notes`) are embedded.

**Why**: Hybrid search. Vector similarity handles semantic queries ("something earthy for a cold evening") while metadata filters handle categorical queries ("show me all Japanese teas" or "what's urgent"). Composing both gives the best UX for the browse + search interface.
