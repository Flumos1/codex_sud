const FUNCTION_PATH = "/functions/v1/search";

export async function proxyToSupabase(context, upstreamPath) {
  const { request, env } = context;
  const supabaseUrl = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }

  const requestUrl = new URL(request.url);
  const upstream = new URL(`${supabaseUrl.replace(/\/$/u, "")}${FUNCTION_PATH}${upstreamPath}`);
  upstream.search = requestUrl.search;

  const response = await fetch(upstream, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": request.headers.get("Content-Type") || "application/json",
    },
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": response.headers.get("Cache-Control") || "no-store",
      "Content-Type": response.headers.get("Content-Type") || "application/json; charset=utf-8",
    },
  });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
