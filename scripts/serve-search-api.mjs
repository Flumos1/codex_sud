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
  const staticRoot = args.static ? path.resolve(args.static === true ? "." : args.static) : "";
  const decisions = await loadJsonl(inputPath);
  const server = createSearchApiServer(decisions, { source: inputPath, staticRoot });

  server.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`Search API listening on http://127.0.0.1:${actualPort}`);
    if (staticRoot) console.log(`Static files: ${staticRoot}`);
    console.log(`Source: ${inputPath}`);
  });
}

export function createSearchApiServer(decisions, options = {}) {
  return createServer(async (request, response) => {
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
        const includeText = query.include_text === "1" || query.include_text === "true";
        delete query.include_text;
        const matchedResults = filterDecisions(decisions, query);
        const sortedResults = sortResults(matchedResults, query.sort);
        const results = limitResults(sortedResults, query.limit || 20).map((decision) =>
          projectDecision(decision, { includeText }),
        );
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

      const decisionMatch = url.pathname.match(/^\/api\/decisions\/([^/]+)$/u);
      if (decisionMatch) {
        const decisionId = decodeURIComponent(decisionMatch[1]);
        const decision = decisions.find((item) => String(item.decision_id || "") === decisionId);
        if (!decision) {
          sendJson(response, 404, { error: "decision_not_found", decision_id: decisionId });
          return;
        }
        sendJson(response, 200, projectDecision(decision, { includeText: true }));
        return;
      }

      if (options.staticRoot) {
        await sendStatic(response, options.staticRoot, url.pathname);
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

function projectDecision(decision, options = {}) {
  const projected = {
    decision_id: decision.decision_id,
    source_url: decision.source_url,
    source_dataset: decision.source_dataset,
    source_attribution: decision.source_attribution,
    case_number: decision.case_number,
    proceeding_number: decision.proceeding_number,
    court_name: decision.court_name,
    court_region: decision.court_region,
    court_level: decision.court_level,
    court_code: decision.court_code,
    decision_date: decision.decision_date,
    registration_date: decision.registration_date,
    publication_date: decision.publication_date,
    proceeding_type: decision.proceeding_type,
    decision_type: decision.decision_type,
    category: decision.category,
    judge_names: decision.judge_names,
    cited_articles: decision.cited_articles || [],
    cited_article_keys: decision.cited_article_keys || [],
    cited_laws: decision.cited_laws || [],
    outcome_label: decision.outcome_label,
    outcome_confidence: decision.outcome_confidence,
    key_excerpts: decision.key_excerpts || [],
    text_status: decision.text_status,
    text_error: decision.text_error,
  };

  if (options.includeText) projected.text = decision.text || "";
  return projected;
}

async function sendStatic(response, rootDir, pathname) {
  const relativePath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const filePath = path.resolve(rootDir, `.${relativePath}`);
  const rootWithSeparator = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;

  if (filePath !== rootDir && !filePath.startsWith(rootWithSeparator)) {
    sendJson(response, 403, { error: "forbidden" });
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentType(filePath),
    });
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendJson(response, 404, { error: "not_found" });
      return;
    }
    throw error;
  }
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLocaleLowerCase("en-US");
  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jsonl": "application/x-ndjson; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".svg": "image/svg+xml",
  };
  return types[extension] || "application/octet-stream";
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
