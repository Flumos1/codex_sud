import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { summarizePractice } from "./analytics-utils.mjs";
import { filterDecisions, limitResults, sortResults, summarizeSearchResults } from "./search-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samplePath = path.join(root, "data", "sample", "edrsr-sample.jsonl");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input || samplePath);
  const port = Number.parseInt(args.port || "8787", 10);
  const decisions = await loadJsonl(inputPath);
  const server = createSearchApiServer(decisions, { source: inputPath });

  server.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`Search API listening on http://127.0.0.1:${actualPort}`);
    console.log(`Source: ${inputPath}`);
  });
}

export function createSearchApiServer(decisions, options = {}) {
  return createServer((request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");

      if (request.method === "OPTIONS") {
        sendJson(response, 204, undefined);
        return;
      }

      if (request.method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed" });
        return;
      }

      if (url.pathname === "/health") {
        sendJson(response, 200, {
          ok: true,
          source: options.source || "memory",
          decisions: decisions.length,
        });
        return;
      }

      if (url.pathname === "/api/search") {
        const query = queryFromSearchParams(url.searchParams);
        const matchedResults = filterDecisions(decisions, query);
        const sortedResults = sortResults(matchedResults, query.sort);
        const results = limitResults(sortedResults, query.limit || 20);
        sendJson(response, 200, {
          query,
          summary: summarizeSearchResults(matchedResults),
          results,
        });
        return;
      }

      if (url.pathname === "/api/analyze") {
        const query = queryFromSearchParams(url.searchParams);
        const filtered = filterDecisions(decisions, query);
        sendJson(response, 200, summarizePractice(filtered, decisions.length, query));
        return;
      }

      sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      sendJson(response, 500, { error: "internal_error", message: error.message });
    }
  });
}

export async function loadJsonl(filePath) {
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function queryFromSearchParams(params) {
  const query = {};
  for (const [key, value] of params.entries()) {
    if (value) query[key] = value;
  }
  return query;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  if (statusCode === 204) {
    response.end();
    return;
  }
  response.end(JSON.stringify(payload, null, 2));
}

function parseArgs(raw) {
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
