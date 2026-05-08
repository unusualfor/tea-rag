/**
 * Ingest script for tea-rag.
 *
 * Reads YAML files from content/teas/, generates embeddings via Workers AI,
 * and upserts them into Cloudflare Vectorize.
 *
 * Usage:
 *   npx tsx scripts/ingest.ts              # dry-run (local parse + validate)
 *   npx wrangler vectorize ... (see below) # actual ingest via wrangler
 *
 * For actual embedding + upsert, this script is designed to run inside a Worker
 * (see src/worker/ingest-handler.ts) since Vectorize and Workers AI are only
 * accessible from within the Cloudflare runtime.
 *
 * This local script handles: parsing, validation, composite text generation,
 * and producing a JSON payload that the worker-side handler can consume.
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import crypto from "crypto";
import type { Tea } from "../src/shared/types";

const TEAS_DIR = path.resolve(process.cwd(), "content/teas");
const OUTPUT_FILE = path.resolve(process.cwd(), "dist/ingest-payload.json");
const TEAS_JSON_FILE = path.resolve(process.cwd(), "src/data/teas.json");

interface IngestRecord {
  id: string;
  tea: Tea;
  compositeText: string;
  contentHash: string;
}

function buildCompositeText(tea: Tea): string {
  const parts: string[] = [
    tea.name.primary,
    tea.category_label,
    tea.producer.name,
    tea.producer.history || "",
    tea.origin.region,
    tea.origin.country,
    tea.notes,
    tea.brewing?.notes || "",
    (tea.tags || []).join(" "),
  ];
  return parts.filter(Boolean).join("\n");
}

function contentHash(tea: Tea): string {
  const content = JSON.stringify(tea);
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function validateTea(tea: unknown, filename: string): Tea {
  const t = tea as Record<string, unknown>;
  const errors: string[] = [];

  if (!t.id || typeof t.id !== "string") errors.push("missing or invalid 'id'");
  if (!t.name || typeof (t.name as Record<string, unknown>).primary !== "string")
    errors.push("missing 'name.primary'");
  if (!t.category) errors.push("missing 'category'");
  if (!t.category_label) errors.push("missing 'category_label'");
  if (!t.producer || typeof (t.producer as Record<string, unknown>).name !== "string")
    errors.push("missing 'producer.name'");
  if (!t.origin || !(t.origin as Record<string, unknown>).country)
    errors.push("missing 'origin.country'");
  if (!t.caffeine_level || typeof t.caffeine_level !== "number" || t.caffeine_level < 1 || t.caffeine_level > 5)
    errors.push("missing or invalid 'caffeine_level' (must be 1-5)");
  if (!t.urgency) errors.push("missing 'urgency'");
  if (!t.notes) errors.push("missing 'notes'");

  if (errors.length > 0) {
    throw new Error(`Validation failed for ${filename}: ${errors.join(", ")}`);
  }

  return tea as Tea;
}

function loadTeas(): IngestRecord[] {
  const files = fs.readdirSync(TEAS_DIR).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  console.log(`Found ${files.length} tea files in ${TEAS_DIR}`);

  const records: IngestRecord[] = [];

  for (const file of files) {
    const filePath = path.join(TEAS_DIR, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = yaml.load(raw);
    const tea = validateTea(parsed, file);
    const compositeText = buildCompositeText(tea);
    const hash = contentHash(tea);

    records.push({ id: tea.id, tea, compositeText, contentHash: hash });
    console.log(`  ✓ ${tea.id} (${tea.name.primary}) — ${hash}`);
  }

  return records;
}

function main() {
  console.log("=== tea-rag ingest ===\n");

  const records = loadTeas();

  console.log(`\nParsed ${records.length} teas successfully.\n`);

  // Write payload for worker-side ingest
  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(records, null, 2));
  console.log(`Payload written to ${OUTPUT_FILE}`);

  // Write teas.json to src/data/ for bundling with the worker and client
  const dataDir = path.dirname(TEAS_JSON_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const teasJson = records.map((r) => r.tea);
  fs.writeFileSync(TEAS_JSON_FILE, JSON.stringify(teasJson, null, 2));
  console.log(`Tea data written to ${TEAS_JSON_FILE}`);

  // Summary
  console.log("\n--- Summary ---");
  console.log(`Total teas: ${records.length}`);
  const byCountry = records.reduce(
    (acc, r) => {
      const c = r.tea.origin.country;
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log("By country:", byCountry);

  const byUrgency = records.reduce(
    (acc, r) => {
      acc[r.tea.urgency] = (acc[r.tea.urgency] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  console.log("By urgency:", byUrgency);
}

main();
