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

---

## 2025-05 — Chat LLM: Workers AI (Llama 3.3 70B)

**Choice**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via Cloudflare Workers AI.

**Why**: All-Cloudflare stack, free tier. This is the highest-quality model on Workers AI with explicit function calling support. The `fp8-fast` variant is quantized for speed while retaining strong instruction-following. No external API keys needed — the `AI` binding handles everything.

**Alternatives considered**:
- Anthropic Claude: best tool-calling quality, but adds a paid external dependency and API key management. Kept out to stay fully on Cloudflare's free tier.
- Llama 3.1 8B: faster but weaker at multi-tool reasoning and following the bracket reference syntax consistently.
- Hermes 2 Pro Mistral 7B: the original Workers AI function-calling model, but smaller and older.

**Fallback**: If Llama 3.3 70B proves too slow for the UX or has availability issues, drop to `@cf/meta/llama-3.1-8b-instruct-fast` — same API, just change the model constant.

---

## 2025-05 — Tool design: four tools, clear boundaries

**Choice**: Four tools for the chat assistant:
1. `list_categories()` — collection overview (no args)
2. `list_teas_by_filter({category?, country?, urgency?, status?})` — structured filtering
3. `search_teas({query, top_k?})` — vector similarity search
4. `get_tea({id})` — full record of one tea

**Why**: Clear separation between semantic queries (search_teas) and structured queries (list_teas_by_filter) helps the model choose the right tool. `get_tea` exists so the model can fetch brewing parameters and detailed notes after an initial search narrows down candidates. `list_categories` answers meta-questions about the collection without loading all data.

**Why not more tools?** Simplicity. The model has to reason about tool selection — more tools means more potential for wrong choices. Four covers every query pattern we've tested. If a new pattern emerges, we add a tool then.

---

## 2025-05 — Inline tea references: bracket syntax `[tea:id]`

**Choice**: The assistant uses `[tea:gyokuro-zuigyoku-kanbayashi]` syntax in its responses. The frontend parses these with a regex and renders inline tea cards.

**Why**: This connects chat output to the browse UI — clicking a reference opens the same detail modal. The bracket syntax is simple for the model to produce (it's a common pattern in LLM outputs) and unambiguous for the parser.

**Implementation**: A regex `/\[tea:([a-z0-9-]+)\]/g` splits streamed text into text segments and tea reference segments. Each reference resolves against the bundled `teas.json` data — no additional API call needed.

---

## 2025-05 — Chat streaming: tool loop non-streaming, final response chunked

**Choice**: The tool-use loop calls Workers AI without streaming. Tool calls are collected, executed, and results fed back. Only the final text response is chunked into SSE events for the frontend.

**Why**: Workers AI's streaming + tool calling don't compose reliably in a single call. The pragmatic pattern: non-streaming for the agentic loop (where we need complete tool call JSON), then simulate streaming by chunking the final text response into small SSE deltas. The user sees tool-call status indicators ("Searching...") while tools execute, then sees text appear progressively.

---

## 2025-05 — Chat persistence: session-only, client-side

**Choice**: Chat history lives in React state. Persists across Browse ↔ Ask mode toggles. Lost on page reload.

**Why**: Simplest possible approach for v1. No server-side storage, no cookies, no localStorage. The chat is ephemeral — this matches the use case (quick queries about what to drink, not long research sessions). If persistence is needed later, localStorage is the obvious next step.

---

## 2025-05 — Tool-use loop: two-pass pattern (not iterative)

**Choice**: Instead of an open-ended "call model → execute tools → call model → repeat until text" loop, we use a fixed two-pass approach: up to 2 rounds WITH tools, then 1 final call WITHOUT tools.

**Why**: Llama 3.3 70B on Workers AI tends to keep requesting tool calls even after receiving results. The standard iterative loop (as shown in Cloudflare's own demo) caused the model to call the same tool 5+ times before producing text. The two-pass approach guarantees at most 3 model invocations (2 with tools, 1 without) and always produces a text response.

**Discovery**: The official Cloudflare function calling demo does NOT include an assistant message with `tool_calls` in the history — it just appends `{role: "tool", name, content}` directly. Adding an explicit assistant message with `tool_calls` (as other providers expect) confused Llama 3.3 and caused infinite tool-call loops.

**Also fixed**: Workers AI's LLM returns `top_k` as a string even though the tool schema declares it as `number`. Added `Number()` coercion before passing to Vectorize.

---

## 2025-05 — Phase B test results (8 queries)

All 8 test queries from the Phase B spec were run against `wrangler dev --experimental-vectorize-bind-to-prod` with Workers AI (Llama 3.3 70B) and the production Vectorize index.

| # | Query | Tool(s) used | Bracket syntax | Correct? | Notes |
|---|-------|-------------|----------------|----------|-------|
| 1 | "What should I drink this afternoon?" | search_teas ×2 | ✅ `[tea:hojicha-kanbayashi]` | ✅ | Good recommendation, brewing params in °C |
| 2 | "Find me something similar to the Kanbayashi gyokuro" | search_teas ×2 | ✅ both teas | ✅ | Suggested hojicha-from-gyokuro + hikari matcha (same producer) |
| 3 | "Which teas are urgent right now?" | list_teas_by_filter ×2 | ✅ all 4 teas | ✅ | Correct count, individual brewing params |
| 4 | "How many Chinese teas do I have?" | list_teas_by_filter ×2 | — (count only) | ✅ | Concise "You have 7 Chinese teas" |
| 5 | "Recommend something for a guest who's never had matcha" | search_teas + get_tea | ✅ `[tea:matcha-uji-hikari-kanbayashi]` | ✅ | Good pick, preparation instructions |
| 6 | "Tell me about Tie Luo Han from Wuyi" | search_teas + get_tea | ✅ suggested Da Hong Pao | ✅ | Honest "not in our collection", proactively suggested related Wuyi tea |
| 7 | "something earthy" | search_teas ×2 | ✅ `[tea:da-hong-pao-wuyi]` | ✅ | Appropriate pick for vague query |
| 8 | Multi-turn: "What gyokuro?" → "how do I brew it?" | list_teas_by_filter ×2, then get_tea ×2 | ✅ both turns | ✅ | Context preserved, detailed brewing (60°C, 5g/100ml, 120s, 3 rounds) |

**Remaining pattern**: The model consistently uses 2 tool calls per query (one per round in the two-pass loop) even when 1 would suffice. This costs extra neurons but doesn't affect UX noticeably — total latency is acceptable. Could be reduced to `MAX_TOOL_ROUNDS = 1` if neuron budget becomes a concern, at the cost of queries that genuinely need two tools (like search → get_tea).
