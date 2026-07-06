import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  handleAnalyze,
  handleDecision,
  handleSearch,
  indexById,
  queryFromSearchParams,
} from "./api-core.mjs";
import { parseArgs, readJsonl } from "./cli-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samplePath = path.join(root, "data", "sample", "edrsr-sample.jsonl");

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
  const decisionsById = indexById(decisions);
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

      if (url.pathname === "/health" || url.pathname === "/api/health") {
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
        const { status, payload } = handleSearch(decisions, query);
        sendJson(response, status, payload, corsOrigin);
        return;
      }

      if (url.pathname === "/api/analyze") {
        const query = queryFromSearchParams(url.searchParams);
        const { status, payload } = handleAnalyze(decisions, query);
        sendJson(response, status, payload, corsOrigin);
        return;
      }

      const decisionMatch = url.pathname.match(/^\/api\/decisions\/([^/]+)$/u);
      if (decisionMatch) {
        const decisionId = decodeURIComponent(decisionMatch[1]);
        const { status, payload } = handleDecision(decisionsById, decisionId);
        sendJson(response, status, payload, corsOrigin);
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
