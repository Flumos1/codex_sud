import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { summarizePractice } from "./analytics-utils.mjs";
import { parseArgs, readJsonl } from "./cli-utils.mjs";
import {
  buildRelevantExcerpts,
  filterDecisions,
  limitResults,
  sortResults,
  summarizeSearchResults,
} from "./search-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samplePath = path.join(root, "data", "sample", "edrsr-sample.jsonl");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const KNOWN_FILTERS = new Set([
  "article",
  "law",
  "region",
  "court",
  "level",
  "type",
  "outcome",
  "from",
  "to",
  "q",
  "sort",
  "limit",
  "include_text",
]);
const ALLOWED_STATIC_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".jsonl", ".md", ".svg"]);
const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1:8787",
  "http://localhost:8787",
];

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
  const decisionsById = new Map(
    decisions.map((decision) => [String(decision.decision_id || ""), decision]),
  );
  const allowedOrigins = resolveAllowedOrigins(options.allowedOrigins);

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const corsOrigin = pickAllowedOrigin(request.headers.origin, allowedOrigins);

      if (request.method === "OPTIONS") {
        sendNoContent(response, corsOrigin);
        return;
      }

      if (request.method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed" }, corsOrigin);
        return;
      }

      if (url.pathname === "/health") {
        sendJson(
          response,
          200,
          {
            ok: true,
            source: options.source || "memory",
            decisions: decisions.length,
          },
          corsOrigin,
        );
        return;
      }

      if (url.pathname === "/api/search") {
        const query = queryFromSearchParams(url.searchParams);
        const limit = resolveLimit(query.limit);
        if (limit === null) {
          sendJson(response, 400, { error: "invalid_limit", max: MAX_LIMIT }, corsOrigin);
          return;
        }
        const includeText = query.include_text === "1" || query.include_text === "true";
        delete query.include_text;
        const matchedResults = filterDecisions(decisions, query);
        const sortedResults = sortResults(matchedResults, query.sort);
        const results = limitResults(sortedResults, limit).map((decision) =>
          projectDecision(decision, { includeText, query }),
        );
        sendJson(
          response,
          200,
          {
            query,
            summary: summarizeSearchResults(matchedResults),
            results,
          },
          corsOrigin,
        );
        return;
      }

      if (url.pathname === "/api/analyze") {
        const query = queryFromSearchParams(url.searchParams);
        const filtered = filterDecisions(decisions, query);
        sendJson(response, 200, summarizePractice(filtered, decisions.length, query), corsOrigin);
        return;
      }

      const decisionMatch = url.pathname.match(/^\/api\/decisions\/([^/]+)$/u);
      if (decisionMatch) {
        const decisionId = decodeURIComponent(decisionMatch[1]);
        const decision = decisionsById.get(decisionId);
        if (!decision) {
          sendJson(response, 404, { error: "decision_not_found", decision_id: decisionId }, corsOrigin);
          return;
        }
        sendJson(response, 200, projectDecision(decision, { includeText: true }), corsOrigin);
        return;
      }

      if (options.staticRoot) {
        await sendStatic(response, options.staticRoot, url.pathname, corsOrigin);
        return;
      }

      sendJson(response, 404, { error: "not_found" }, corsOrigin);
    } catch (error) {
      console.error("Search API error:", error);
      sendJson(response, 500, { error: "internal_error" });
    }
  });
}

export async function loadJsonl(filePath) {
  return readJsonl(filePath);
}

function resolveLimit(rawLimit) {
  if (rawLimit === undefined) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.min(parsed, MAX_LIMIT);
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
    key_excerpts: options.query ? buildRelevantExcerpts(decision, options.query) : decision.key_excerpts || [],
    text_status: decision.text_status,
    text_error: decision.text_error,
  };

  if (options.includeText) projected.text = decision.text || "";
  return projected;
}

async function sendStatic(response, rootDir, pathname, corsOrigin) {
  const relativePath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);

  if (!isSafeStaticPath(relativePath)) {
    sendJson(response, 403, { error: "forbidden" }, corsOrigin);
    return;
  }

  const filePath = path.resolve(rootDir, `.${relativePath}`);
  const rootWithSeparator = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;

  if (filePath !== rootDir && !filePath.startsWith(rootWithSeparator)) {
    sendJson(response, 403, { error: "forbidden" }, corsOrigin);
    return;
  }

  if (!ALLOWED_STATIC_EXTENSIONS.has(path.extname(filePath).toLocaleLowerCase("en-US"))) {
    sendJson(response, 403, { error: "forbidden" }, corsOrigin);
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      ...securityHeaders(),
      "Content-Type": contentType(filePath),
    });
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendJson(response, 404, { error: "not_found" }, corsOrigin);
      return;
    }
    throw error;
  }
}

function isSafeStaticPath(relativePath) {
  const segments = relativePath.split(/[\\/]+/u).filter(Boolean);
  if (!segments.length) return false;
  // Block dot-directories/files (.git, .env, ...) and traversal, and raw data dumps.
  if (segments.some((segment) => segment.startsWith("."))) return false;
  if (segments[0] === "data" && segments[1] === "raw") return false;
  return true;
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
    if (value && KNOWN_FILTERS.has(key)) query[key] = value;
  }
  return query;
}

function resolveAllowedOrigins(configured) {
  const fromEnv = (process.env.SEARCH_API_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([...(configured || []), ...fromEnv, ...DEFAULT_ALLOWED_ORIGINS]);
}

function pickAllowedOrigin(requestOrigin, allowedOrigins) {
  if (!requestOrigin) return "";
  return allowedOrigins.has(requestOrigin) ? requestOrigin : "";
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

function corsHeaders(corsOrigin) {
  if (!corsOrigin) return {};
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

function sendNoContent(response, corsOrigin) {
  response.writeHead(204, { ...securityHeaders(), ...corsHeaders(corsOrigin) });
  response.end();
}

function sendJson(response, statusCode, payload, corsOrigin) {
  response.writeHead(statusCode, {
    ...securityHeaders(),
    ...corsHeaders(corsOrigin),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload, null, 2));
}
