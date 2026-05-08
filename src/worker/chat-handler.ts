/**
 * Chat handler for Phase B.
 *
 * Uses Workers AI with traditional function calling.
 * Tool-use loop: non-streaming tool calls → streamed final response.
 * Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast (function calling support).
 */

import { Hono } from "hono";
import type { Tea } from "../shared/types";
import teasData from "../data/teas.json";

const teas: Tea[] = teasData as Tea[];

// Best available Workers AI model with function calling
const CHAT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

type Bindings = {
  VECTORIZE: VectorizeIndex;
  AI: Ai;
};

const chatApp = new Hono<{ Bindings: Bindings }>();

// --- System prompt ---

const SYSTEM_PROMPT = `You are an assistant that helps Francesco and his guests explore a curated tea collection. The collection includes Japanese, Chinese, and other world teas, each with detailed origin, producer, brewing, and tasting information.

Your tools let you query the collection. Use them — do not invent teas, producers, or histories. If a question has no answer in the data, say so plainly.

When the user asks open-ended questions like "what should I drink?" or "what's good right now?", consider the urgency field (teas marked 'now' or 'soon' should be drunk before they fade), time of day, season, and mood implied by the question. Recommend specific teas and briefly explain why.

When the user asks about similarities ("like that gyokuro from Uji"), use search_teas with a descriptive query.

When the user asks about the collection structure ("how many matchas", "what countries"), use list_categories or list_teas_by_filter.

When recommending a specific tea, reference it by ID using this exact syntax in your response: [tea:tea-id-here]. The frontend will render this as a clickable card. Use the syntax inline naturally, e.g.: "For this afternoon I'd suggest [tea:gyokuro-zuigyoku-kanbayashi] — a deeply umami gyokuro that..."

Always use the [tea:id] syntax when mentioning a specific tea you've looked up. The id is the exact id field from the tool results.

Tone: warm, knowledgeable, concise. You're talking with someone who also knows tea. Don't lecture about basics. Don't use marketing language. Default to short paragraphs. Mention specific brewing parameters (temperature, time) when recommending — they matter.

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
      "List teas matching structured filters: category, country, urgency, or status. Returns a summary of each matching tea (id, name, category, country, urgency). Use this for specific structured queries like 'all Japanese teas', 'what's urgent right now', 'show me oolongs'. Do NOT use this for semantic/mood-based queries — use search_teas instead.",
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
            "Filter by urgency level: 'now' (drink immediately), 'soon', 'summer', 'calm' (no rush), 'stable'.",
        },
        status: {
          type: "string",
          description:
            "Filter by status: 'keeper' (permanent collection), 'tasting' (evaluating), 'maybe-gift', 'gift'.",
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
    alternate_name: tea.name.alternate || null,
    category: tea.category,
    category_label: tea.category_label,
    country: tea.origin.country,
    region: tea.origin.region,
    urgency: tea.urgency,
    status: tea.status,
    producer: tea.producer.name,
    brief: tea.notes.split("\n")[0].trim(),
  };
}

function executeListCategories() {
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

function executeListTeasByFilter(args: Record<string, string>) {
  let filtered = [...teas];
  if (args.category) filtered = filtered.filter((t) => t.category === args.category);
  if (args.country) filtered = filtered.filter((t) => t.origin.country === args.country);
  if (args.urgency) filtered = filtered.filter((t) => t.urgency === args.urgency);
  if (args.status) filtered = filtered.filter((t) => t.status === args.status);
  return { count: filtered.length, teas: filtered.map(teaSummary) };
}

async function executeSearchTeas(
  args: { query: string; top_k?: number },
  env: Bindings
) {
  const topK = args.top_k || 5;

  // Generate embedding for the query
  const embeddingResponse = (await env.AI.run(EMBEDDING_MODEL, {
    text: [args.query],
  })) as { data: number[][] };
  const queryVector = embeddingResponse.data[0];

  // Query Vectorize
  const vectorResults = await env.VECTORIZE.query(queryVector, {
    topK,
    returnMetadata: "all",
  });

  const results = vectorResults.matches
    .map((match) => {
      const tea = teas.find((t) => t.id === match.id);
      return tea ? { ...teaSummary(tea), relevance_score: match.score } : null;
    })
    .filter(Boolean);

  return { query: args.query, count: results.length, results };
}

function executeGetTea(args: { id: string }) {
  const tea = teas.find((t) => t.id === args.id);
  if (!tea) return { error: `Tea with id '${args.id}' not found in the collection.` };
  return tea;
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

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
}

interface ChatRequest {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}

chatApp.post("/api/chat", async (c) => {
  const body = await c.req.json<ChatRequest>();
  const { message, history } = body;

  if (!message || typeof message !== "string") {
    return c.json({ error: "message is required" }, 400);
  }

  // Build message list
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let iterations = 0;
        const MAX_ITERATIONS = 5; // Safety limit on tool-use loops

        while (iterations < MAX_ITERATIONS) {
          iterations++;

          // Call model (non-streaming for tool calls)
          const response = (await c.env.AI.run(CHAT_MODEL, {
            messages: messages as Array<{ role: string; content: string }>,
            tools: TOOL_DEFINITIONS,
          })) as {
            response?: string;
            tool_calls?: Array<{
              name: string;
              arguments: Record<string, unknown>;
            }>;
          };

          // If there are tool calls, execute them and loop
          if (response.tool_calls && response.tool_calls.length > 0) {
            for (const toolCall of response.tool_calls) {
              // Emit tool_call event
              controller.enqueue(
                encoder.encode(
                  sseEvent("tool_call", {
                    tool: toolCall.name,
                    status: "running",
                  })
                )
              );

              const result = await executeTool(
                toolCall.name,
                toolCall.arguments,
                c.env
              );

              // Push assistant message with tool call, then tool result
              messages.push({
                role: "assistant",
                content: "",
                // Workers AI expects tool calls in the message flow
              });
              messages.push({
                role: "tool",
                name: toolCall.name,
                content: JSON.stringify(result),
              });

              controller.enqueue(
                encoder.encode(
                  sseEvent("tool_result", {
                    tool: toolCall.name,
                    status: "done",
                  })
                )
              );
            }
            // Continue loop — model needs to produce final response with tool results
            continue;
          }

          // No tool calls — we have a text response
          if (response.response) {
            // Stream the final response in chunks for perceived speed
            const text = response.response;
            const chunkSize = 12; // characters per chunk for smooth streaming feel
            for (let i = 0; i < text.length; i += chunkSize) {
              const chunk = text.slice(i, i + chunkSize);
              controller.enqueue(
                encoder.encode(sseEvent("text", { delta: chunk }))
              );
            }
          }
          break;
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
