/**
 * Chat handler for Phase B.
 *
 * Uses Workers AI with traditional function calling.
 * Tool-use loop: non-streaming tool calls → streamed final response.
 * Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast (function calling support).
 */

import { Hono } from "hono";
import type { Tea } from "../shared/types";
import { getColdBrew, coldBrewIneligibleReason } from "../shared/cold-brew";
import { getTeas, isInStock, outOfStockCount, MAX_TOP_K } from "./teas";

// Best available Workers AI model with function calling
const CHAT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

type Bindings = {
  VECTORIZE: VectorizeIndex;
  AI: Ai;
};

const chatApp = new Hono<{ Bindings: Bindings }>();

// --- Rate limiting ---
// Simple per-IP rate limiter: 5 requests per 60 seconds on /api/chat.
// Uses in-memory Map — resets on Worker restart, which is fine for this scale.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

// --- System prompt ---

const SYSTEM_PROMPT = `You are an assistant that helps Francesco and his guests explore a curated tea collection. The collection includes Japanese, Chinese, and other world teas, each with detailed origin, producer, brewing, and tasting information.

Your tools let you query the collection. Use them — do not invent teas, producers, or histories. If a question has no answer in the data, say so plainly.

IMPORTANT: Call each tool at most ONCE per question. After receiving the tool result, respond immediately using the data you got. Do not call the same tool twice.

The urgency field indicates freshness priority, computed from expiry dates and category shelf life. The levels from most to least urgent are: 'now' (drink immediately — expired or within 3 months), 'soon' (3-9 months remaining), 'no-rush' (9-18 months remaining), 'stable' (>18 months or aging teas like pu-erh). When the user asks about urgency, expiration, or what to drink first, use list_teas_by_filter with urgency='now' to find the most time-sensitive teas. Remember: tool results are FILTERED subsets, not the full collection — never say "all teas" when you only queried a filter.

When the user asks open-ended questions like "what should I drink?" or "what's good right now?", consider urgency (prefer 'now' and 'soon' teas), caffeine_level (1=very low, 5=very high — important for afternoon/evening), time of day, season, and mood. Recommend specific teas and briefly explain why.

Teas that have been finished are excluded from tool results by default, so anything you see can actually be brewed. If the user asks specifically about teas they have run out of, call list_teas_by_filter with include_out_of_stock=true; the in_stock field marks which ones are gone.

When the user asks about similarities ("like that gyokuro from Uji"), use search_teas with a descriptive query.

When the user asks about the collection structure ("how many matchas", "what countries"), use list_categories or list_teas_by_filter.

When the user asks to list all teas, show everything, or asks about the full collection, use list_teas_by_filter with no filters — it will return all teas.

When recommending a specific tea, ALWAYS reference it by ID using this exact syntax in your response: [tea:tea-id-here]. The frontend will render this as a clickable card. Use the syntax inline naturally, e.g.: "For this afternoon I'd suggest [tea:gyokuro-zuigyoku-kanbayashi] — a deeply umami gyokuro that..."

ALWAYS use the [tea:id] syntax when mentioning a specific tea. The id is the exact id field from the tool results. Never mention a tea by name without also including its [tea:id] reference.

Brewing data has up to three modes. (1) A 'rounds' array — each round has its own water_temp_c and steep_time_seconds. For multi-round teas (Japanese, oolong, puer), mention the first round's parameters and how many rounds are recommended. (2) An optional 'simple' block — a single Western-style infusion, given as leaf_grams in water_ml. (3) An optional 'cold_brew' block returned by get_tea, giving g_per_l, an hours range, and overnight advice. Cold brew means leaf left in fridge-cold water for hours — there is no temperature to state, just the fridge. Because cold water extracts amino acids readily but barely touches catechins and caffeine, a long steep does NOT turn bitter the way a long hot steep does; the same dose works for a short steep or overnight. The exception is broken or fine-cut leaf (deep-steamed sencha, CTC blends), where the overnight advice will say to reduce the dose. Not every tea can be cold brewed: matcha is whisked into suspension rather than steeped, smoky teas turn ashy, and masala chai needs heat for the spices. When get_tea reports a tea is ineligible it also gives the reason — use it rather than inventing one.

Tone: warm, knowledgeable, concise. You're talking with someone who also knows tea. Don't lecture about basics. Don't use marketing language. Default to short paragraphs. Mention specific brewing parameters (temperature, time) when recommending — they matter. Use Celsius for temperature.

Language: English.`;

// --- Tool definitions ---

const TOOL_DEFINITIONS = [
  {
    name: "list_categories",
    description:
      "List all tea categories present in the collection, with the count of teas in each. Use this when the user asks about what types of tea are available, how many of a certain kind exist, or wants an overview of the collection structure.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "list_teas_by_filter",
    description:
      "List teas matching structured filters: category, country, urgency, or cold_brew. Returns a summary of each matching tea (id, name, category, country, urgency, caffeine level, in_stock). Finished teas are excluded unless include_out_of_stock is true. Call with no filters to list ALL teas. Use this for specific structured queries like 'all Japanese teas', 'what's urgent right now', 'show me oolongs', 'what can I cold brew', or 'list everything'. Do NOT use this for semantic/mood-based queries — use search_teas instead.",
    parameters: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description: "Filter by tea category (e.g. 'gyokuro', 'oolong', 'matcha-ceremonial').",
        },
        country: {
          type: "string",
          description: "Filter by country of origin (e.g. 'Japan', 'China', 'India').",
        },
        urgency: {
          type: "string",
          description:
            "Filter by urgency level. From most to least urgent: 'now' (expired or <3 months), 'soon' (3-9 months), 'no-rush' (9-18 months), 'stable' (>18 months or aging). Results are a filtered subset — not all teas.",
        },
        cold_brew: {
          type: "boolean",
          description:
            "Filter by cold brew suitability. true returns only teas that can be cold brewed; false returns only those that cannot (matcha, smoky teas, masala chai). Use for questions like 'what can I cold brew?'.",
        },
        include_out_of_stock: {
          type: "boolean",
          description:
            "Include teas that have been finished. Defaults to false — finished teas are hidden. Set true only when the user explicitly asks about teas they have run out of or the full historical collection.",
        },
      },
      required: [] as string[],
    },
  },
  {
    name: "search_teas",
    description:
      "Search for teas using natural language similarity. Use this when the user describes a mood, characteristic, flavor profile, or asks for something 'like X'. Returns ranked matches by relevance. For specific structured queries (all teas of a category, urgent teas), prefer list_teas_by_filter.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Natural language search query describing what the user wants. E.g. 'earthy and warming', 'something like gyokuro from Uji', 'delicate afternoon tea'.",
        },
        top_k: {
          type: "number",
          description: "Number of results to return. Default 5.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_tea",
    description:
      "Get the full detailed record of a single tea by its ID, including brewing parameters, producer history, full notes, and all metadata. Use this when you want to give the user detailed information about a specific tea, or when you need brewing parameters for a recommendation.",
    parameters: {
      type: "object" as const,
      properties: {
        id: {
          type: "string",
          description: "The unique ID of the tea (kebab-case, e.g. 'gyokuro-zuigyoku-kanbayashi').",
        },
      },
      required: ["id"],
    },
  },
];

// --- Tool execution ---

function teaSummary(tea: Tea) {
  return {
    id: tea.id,
    name: tea.name.primary,
    category_label: tea.category_label,
    country: tea.origin.country,
    urgency: tea.urgency,
    caffeine_level: tea.caffeine_level,
    in_stock: isInStock(tea),
  };
}

function executeListCategories() {
  const teas = getTeas().filter(isInStock);
  const counts: Record<string, { category: string; label: string; count: number }> = {};
  for (const tea of teas) {
    if (!counts[tea.category]) {
      counts[tea.category] = { category: tea.category, label: tea.category_label, count: 0 };
    }
    counts[tea.category].count++;
  }
  const categories = Object.values(counts).sort((a, b) => b.count - a.count);
  return { total_teas: teas.length, categories };
}

function executeListTeasByFilter(args: Record<string, unknown>) {
  let filtered = [...getTeas()];

  // Finished teas are excluded unless the model explicitly asks for them, so
  // recommendations never point at something that is gone.
  if (coerceBoolean(args.include_out_of_stock) !== true) {
    filtered = filtered.filter(isInStock);
  }

  if (args.category) filtered = filtered.filter((t) => t.category === args.category);
  if (args.country) filtered = filtered.filter((t) => t.origin.country === args.country);
  if (args.urgency) filtered = filtered.filter((t) => t.urgency === args.urgency);

  // The LLM sometimes sends booleans as strings — same coercion the top_k arg needs.
  const coldBrew = coerceBoolean(args.cold_brew);
  if (coldBrew !== undefined) {
    filtered = filtered.filter((t) => (getColdBrew(t) !== null) === coldBrew);
  }

  return { count: filtered.length, teas: filtered.map(teaSummary) };
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

async function executeSearchTeas(
  args: { query: string; top_k?: number },
  env: Bindings
) {
  const topK = Math.min(Number(args.top_k) || 5, MAX_TOP_K);

  // Generate embedding for the query
  const embeddingResponse = (await env.AI.run(EMBEDDING_MODEL, {
    text: [args.query],
  })) as { data: number[][] };
  const queryVector = embeddingResponse.data[0];

  // Query Vectorize
  // Ask for exactly as many extra matches as the stock filter below can drop.
  const vectorResults = await env.VECTORIZE.query(queryVector, {
    topK: Math.min(topK + outOfStockCount(), MAX_TOP_K),
    returnMetadata: "all",
  });

  const teas = getTeas();
  const results = vectorResults.matches
    .map((match) => {
      const tea = teas.find((t) => t.id === match.id);
      return tea ? { ...teaSummary(tea), relevance_score: match.score } : null;
    })
    .filter((r) => r !== null && r.in_stock !== false)
    .slice(0, topK);

  return { query: args.query, count: results.length, results };
}

function executeGetTea(args: { id: string }) {
  const tea = getTeas().find((t) => t.id === args.id);
  if (!tea) return { error: `Tea with id '${args.id}' not found in the collection.` };

  // Cold brew params are derived from category, not stored — resolve them here so
  // the model can answer "can I cold brew this?" without guessing.
  const rule = getColdBrew(tea);
  return {
    ...tea,
    cold_brew: rule
      ? { eligible: true, ...rule }
      : { eligible: false, reason: coldBrewIneligibleReason(tea) },
  };
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  env: Bindings
): Promise<unknown> {
  switch (name) {
    case "list_categories":
      return executeListCategories();
    case "list_teas_by_filter":
      return executeListTeasByFilter(args as Record<string, string>);
    case "search_teas":
      return executeSearchTeas(args as { query: string; top_k?: number }, env);
    case "get_tea":
      return executeGetTea(args as { id: string });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// --- SSE helpers ---

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// --- Chat endpoint ---

// Workers AI message types — the tool role messages need a name field.
interface AiMessage {
  role: string;
  content: string;
  name?: string;
}

interface ChatRequest {
  message: string;
  /** Optional — the UI always sends it, but direct API callers may not. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

// Reference fixup covers the whole collection, finished teas included — the
// model may legitimately mention one, and a broken [tea:id] is worse than a
// reference to something out of stock.
const ALL_TEAS = getTeas();

// All known tea IDs for reference fixup
const TEA_IDS = new Set(ALL_TEAS.map((t) => t.id));

// Build a name→id lookup (primary and alternate names, lowercased)
const TEA_NAME_MAP = new Map<string, string>();
for (const t of ALL_TEAS) {
  TEA_NAME_MAP.set(t.name.primary.toLowerCase(), t.id);
  if (t.name.alternate) TEA_NAME_MAP.set(t.name.alternate.toLowerCase(), t.id);
}
// Sort by name length descending so longer names match first
const TEA_NAMES_SORTED = [...TEA_NAME_MAP.keys()].sort((a, b) => b.length - a.length);

/**
 * Fix broken [tea:id] references and auto-link tea names.
 */
function fixTeaReferences(text: string): string {
  // 1. Remove unclosed [tea:... at end of text
  text = text.replace(/\[tea[.:][a-z0-9-]*$/gi, "");

  // 2. Normalize [tea.id] and [tea: id] to [tea:id]
  text = text.replace(/\[tea[.:]\s*([a-z0-9-]+)\]/gi, (_, id) => `[tea:${id.toLowerCase()}]`);

  // 3. Fix broken IDs in existing [tea:id] references
  text = text.replace(/\[tea:([a-z0-9-]+)\]/g, (_match, id: string) => {
    if (TEA_IDS.has(id)) return `[tea:${id}]`;

    // Best prefix match
    let bestMatch = "";
    let bestScore = 0;
    for (const t of ALL_TEAS) {
      let shared = 0;
      for (let i = 0; i < Math.min(id.length, t.id.length); i++) {
        if (id[i] === t.id[i]) shared++;
        else break;
      }
      if (shared > bestScore) {
        bestScore = shared;
        bestMatch = t.id;
      }
    }
    if (bestScore >= 8) return `[tea:${bestMatch}]`;
    return `[tea:${id}]`;
  });

  // 4. Auto-link tea names that aren't already inside a [tea:...] reference
  //    Only match names that appear as standalone words (not inside existing refs)
  for (const name of TEA_NAMES_SORTED) {
    if (name.length < 4) continue; // skip very short names to avoid false positives
    const id = TEA_NAME_MAP.get(name)!;
    // Skip if this tea is already referenced
    if (text.includes(`[tea:${id}]`)) continue;

    // Case-insensitive match, word-boundary-ish (not inside brackets)
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<!\\[tea:[a-z0-9-]*)\\b(${escaped})\\b(?![^\\[]*\\])`, "i");
    const match = text.match(re);
    if (match) {
      text = text.replace(re, `[tea:${id}]`);
    }
  }

  return text;
}

/**
 * Detect when the model outputs a tool call as plain text instead of using
 * the tool_calls mechanism. Returns parsed tool call or null.
 */
function extractToolCallFromText(
  text: string
): { name: string; arguments: Record<string, unknown> } | null {
  // Match patterns like: {"type": "function", "name": "...", "parameters": {...}}
  // or: {"name": "...", "parameters": {...}}
  const jsonMatch = text.match(/\{[^{}]*"name"\s*:\s*"([^"]+)"[^{}]*"(?:parameters|arguments)"\s*:\s*(\{[^}]*\})/s);
  if (jsonMatch) {
    const name = jsonMatch[1];
    try {
      const args = JSON.parse(jsonMatch[2]);
      if (TOOL_DEFINITIONS.some((t) => t.name === name)) {
        return { name, arguments: args };
      }
    } catch {
      // ignore parse errors
    }
  }

  // Match patterns like: function call should be... list_teas_by_filter({"urgency": "calm"})
  const funcCallMatch = text.match(/\b(list_categories|list_teas_by_filter|search_teas|get_tea)\s*\((\{[^)]*\})\)/);
  if (funcCallMatch) {
    try {
      return { name: funcCallMatch[1], arguments: JSON.parse(funcCallMatch[2]) };
    } catch {
      // ignore
    }
  }

  return null;
}

function streamText(
  text: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  const chunkSize = 12;
  for (let i = 0; i < text.length; i += chunkSize) {
    controller.enqueue(
      encoder.encode(sseEvent("text", { delta: text.slice(i, i + chunkSize) }))
    );
  }
}

chatApp.post("/api/chat", async (c) => {
  // Rate limit
  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(ip)) {
    return c.json({ error: "Too many requests. Please wait a moment." }, 429);
  }

  const body = await c.req.json<ChatRequest>();
  const { message, history } = body;

  if (!message || typeof message !== "string") {
    return c.json({ error: "message is required" }, 400);
  }

  // Build message list. `history` is optional and this runs outside the stream's
  // try/catch, so an unguarded .map here surfaces as an opaque 500.
  const priorTurns = Array.isArray(history) ? history : [];

  const messages: AiMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...priorTurns
      .filter((h) => h && typeof h.content === "string" && (h.role === "user" || h.role === "assistant"))
      .map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // === Two-pass approach ===
        // Pass 1: Call model WITH tools. If it returns tool_calls, execute them.
        //         Allow up to 2 rounds of tool calls (for cases like
        //         search → get_tea follow-up).
        // Pass 2: Call model WITHOUT tools to force a text response,
        //         now that tool results are in context.

        const MAX_TOOL_ROUNDS = 1;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = (await c.env.AI.run(CHAT_MODEL, {
            messages,
            tools: TOOL_DEFINITIONS,
            max_tokens: 4096,
          })) as {
            response?: string;
            tool_calls?: Array<{
              name?: string;
              arguments?: Record<string, unknown>;
              function?: { name: string; arguments: Record<string, unknown> | string };
            }>;
          };

          // If the model chose to respond with text directly, check if it's
          // actually a tool call dumped as text (common 70B quirk)
          if (!response.tool_calls || response.tool_calls.length === 0) {
            if (response.response) {
              const extractedCall = extractToolCallFromText(response.response);
              if (extractedCall) {
                // Model tried to call a tool via text — execute it properly
                controller.enqueue(
                  encoder.encode(
                    sseEvent("tool_call", { tool: extractedCall.name, status: "running" })
                  )
                );
                const result = await executeTool(extractedCall.name, extractedCall.arguments, c.env);
                messages.push({
                  role: "tool",
                  name: extractedCall.name,
                  content: JSON.stringify(result),
                });
                controller.enqueue(
                  encoder.encode(
                    sseEvent("tool_result", { tool: extractedCall.name, status: "done" })
                  )
                );
                // Continue to pass 2 (text response with tool results in context)
                break;
              }

              streamText(fixTeaReferences(response.response), controller, encoder);
            }
            controller.enqueue(encoder.encode(sseEvent("done", {})));
            controller.close();
            return;
          }

          // Execute all tool calls from this round
          for (const rawCall of response.tool_calls) {
            // Normalize: some models return {name, arguments}, others {function: {name, arguments}}
            const toolName = rawCall.name ?? rawCall.function?.name ?? "";
            let toolArgs: Record<string, unknown> =
              rawCall.arguments ?? (typeof rawCall.function?.arguments === "string"
                ? JSON.parse(rawCall.function.arguments)
                : rawCall.function?.arguments) ?? {};

            controller.enqueue(
              encoder.encode(
                sseEvent("tool_call", { tool: toolName, status: "running" })
              )
            );

            const result = await executeTool(toolName, toolArgs, c.env);

            messages.push({
              role: "tool",
              name: toolName,
              content: JSON.stringify(result),
            });

            controller.enqueue(
              encoder.encode(
                sseEvent("tool_result", { tool: toolName, status: "done" })
              )
            );
          }
        }

        // Pass 2: Force a text response by calling WITHOUT tools
        const finalResponse = (await c.env.AI.run(CHAT_MODEL, {
          messages,
          max_tokens: 4096,
        })) as { response?: string };

        if (finalResponse.response) {
          streamText(fixTeaReferences(finalResponse.response), controller, encoder);
        }

        controller.enqueue(encoder.encode(sseEvent("done", {})));
        controller.close();
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "An error occurred";
        controller.enqueue(
          encoder.encode(sseEvent("error", { message: errorMsg }))
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

export { chatApp };
