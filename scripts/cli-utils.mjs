import { readFile } from "node:fs/promises";

// Minimal `--key value` / boolean-flag parser shared by all CLI scripts.
export function parseArgs(raw) {
  const parsed = {};
  for (let index = 0; index < raw.length; index += 1) {
    const token = raw[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = raw[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

// Resilient JSONL reader: skips (and reports) malformed lines instead of aborting.
export async function readJsonl(filePath, options = {}) {
  const text = await readFile(filePath, "utf8");
  const decisions = [];
  let lineNumber = 0;
  let skipped = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    lineNumber += 1;
    const line = rawLine.trim();
    if (!line) continue;
    try {
      decisions.push(JSON.parse(line));
    } catch (error) {
      skipped += 1;
      if (options.warn !== false) {
        console.warn(`Skipping malformed JSONL line ${lineNumber} in ${filePath}: ${error.message}`);
      }
    }
    if (options.limit && decisions.length >= options.limit) break;
  }

  if (skipped && options.warn !== false) {
    console.warn(`Loaded ${decisions.length} decisions, skipped ${skipped} malformed line(s).`);
  }
  return decisions;
}
