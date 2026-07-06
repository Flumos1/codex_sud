// Shared helpers for the Vercel serverless functions (same-origin, so no CORS needed).

export function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload, null, 2));
}

export function getSearchParams(request) {
  return new URL(request.url || "/", "http://localhost").searchParams;
}

export function methodNotAllowed(request, response) {
  if (request.method && request.method !== "GET") {
    sendJson(response, 405, { error: "method_not_allowed" });
    return true;
  }
  return false;
}
