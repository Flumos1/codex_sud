import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "missing_supabase_env" }, 500);

  try {
    const url = new URL(request.url);
    const pathname = routePath(url.pathname);

    if (pathname === "/health") {
      const { count, error } = await supabase
        .from("legal_decisions")
        .select("decision_id", { count: "exact", head: true });
      if (error) throw error;
      return json({ ok: true, source: "supabase", decisions: count || 0 });
    }

    if (pathname === "/api/search") {
      const query = queryFromSearchParams(url.searchParams);
      const includeText = query.include_text === "1" || query.include_text === "true";
      delete query.include_text;
      const decisions = await fetchDecisions(query);
      const matchedResults = filterDecisions(decisions, query);
      const sortedResults = sortResults(matchedResults, query.sort);
      const results = limitResults(sortedResults, query.limit || 20).map((decision) =>
        projectDecision(decision, { includeText }),
      );
      return json({
        query,
        summary: summarizeSearchResults(matchedResults),
        results,
      });
    }

    if (pathname === "/api/analyze") {
      const query = queryFromSearchParams(url.searchParams);
      const decisions = await fetchDecisions(query);
      const sourceTotal = await countDecisions();
      return json(summarizePractice(filterDecisions(decisions, query), sourceTotal, query));
    }

    const decisionMatch = pathname.match(/^\/api\/decisions\/([^/]+)$/u);
    if (decisionMatch) {
      const decisionId = decodeURIComponent(decisionMatch[1]);
      const { data, error } = await supabase
        .from("legal_decisions")
        .select("*")
        .eq("decision_id", decisionId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "decision_not_found", decision_id: decisionId }, 404);
      return json(projectDecision(data, { includeText: true }));
    }

    return json({ error: "not_found" }, 404);
  } catch (error) {
    return json({ error: "internal_error", message: error instanceof Error ? error.message : String(error) }, 500);
  }
});

async function fetchDecisions(query: Record<string, string>) {
  let request = supabase.from("legal_decisions").select("*").limit(5000);

  if (query.region) request = request.ilike("court_region", `%${escapeLike(query.region)}%`);
  if (query.court) request = request.ilike("court_name", `%${escapeLike(query.court)}%`);
  if (query.level) request = request.ilike("court_level", `%${escapeLike(query.level)}%`);
  if (query.type) request = request.eq("decision_type", query.type);
  if (query.outcome) request = request.eq("outcome_label", query.outcome);
  if (query.from) request = request.gte("decision_date", query.from);
  if (query.to) request = request.lte("decision_date", query.to);

  const { data, error } = await request;
  if (error) throw error;
  return data || [];
}

async function countDecisions() {
  const { count, error } = await supabase.from("legal_decisions").select("decision_id", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
}

function routePath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const index = parts.lastIndexOf("search");
  const route = index >= 0 ? parts.slice(index + 1) : parts;
  return `/${route.join("/")}`.replace(/\/$/u, "") || "/health";
}

function queryFromSearchParams(params: URLSearchParams) {
  const query: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (value) query[key] = value;
  }
  return query;
}

function projectDecision(decision: Record<string, unknown>, options: { includeText?: boolean } = {}) {
  const projected: Record<string, unknown> = {
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
    judge_names: decision.judge_names || [],
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

function filterDecisions(items: Record<string, unknown>[], query: Record<string, string>) {
  return items.filter((item) => {
    if (query.article && !matchesArticle(item, query.article)) return false;
    if (query.q && !includesText([item.text, item.case_number, item.court_name, item.category].join(" "), query.q)) {
      return false;
    }
    if (query.region && !includesText(item.court_region, query.region)) return false;
    if (query.court && !includesText(item.court_name, query.court)) return false;
    if (query.level && !includesText(item.court_level, query.level)) return false;
    if (query.from && String(item.decision_date || "") < query.from) return false;
    if (query.to && String(item.decision_date || "") > query.to) return false;
    if (query.type && item.decision_type !== query.type) return false;
    if (query.outcome && item.outcome_label !== query.outcome) return false;
    return true;
  });
}

function sortResults(items: Record<string, unknown>[], sort = "date_desc") {
  const sorted = [...items];
  const direction = sort === "date_asc" ? 1 : -1;
  if (sort === "court") return sorted.sort((a, b) => compareText(a.court_name, b.court_name));
  if (sort === "outcome") return sorted.sort((a, b) => compareText(a.outcome_label, b.outcome_label));
  return sorted.sort((a, b) => direction * compareText(a.decision_date, b.decision_date));
}

function limitResults(items: Record<string, unknown>[], limit: string | number) {
  const parsed = Number.parseInt(String(limit), 10);
  const normalized = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 100)) : 20;
  return items.slice(0, normalized);
}

function summarizeSearchResults(items: Record<string, unknown>[]) {
  return {
    total: items.length,
    by_outcome: topCounts(countBy(items, "outcome_label"), 5),
    by_region: topCounts(countBy(items, "court_region"), 5),
  };
}

function summarizePractice(items: Record<string, unknown>[], sourceTotal: number, query: Record<string, string>) {
  const withText = items.filter((item) => clean(item.text));
  const knownOutcome = items.filter((item) => item.outcome_label && item.outcome_label !== "unknown");
  return {
    query,
    source_total: sourceTotal,
    total: items.length,
    text_coverage: { count: withText.length },
    outcome_coverage: { count: knownOutcome.length },
    by_year: topCounts(countBy(items.map((item) => ({ year: String(item.decision_date || "").slice(0, 4) })), "year"), 10),
    by_outcome: topCounts(countBy(items, "outcome_label"), 10),
    by_region: topCounts(countBy(items, "court_region"), 10),
    by_court_level: topCounts(countBy(items, "court_level"), 10),
    by_court: topCounts(countBy(items, "court_name"), 10),
    top_article_keys: topCounts(countList(items, "cited_article_keys"), 15),
  };
}

function matchesArticle(item: Record<string, unknown>, needle: string) {
  return [...asArray(item.cited_article_keys), ...asArray(item.cited_articles)].some((value) => includesText(value, needle));
}

function countBy(items: Record<string, unknown>[], key: string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = clean(item[key]) || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function countList(items: Record<string, unknown>[], key: string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    for (const value of asArray(item[key])) {
      const normalized = clean(value) || "unknown";
      acc[normalized] = (acc[normalized] || 0) + 1;
    }
    return acc;
  }, {});
}

function topCounts(counts: Record<string, number>, limit: number) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "uk"))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "")) : [];
}

function includesText(value: unknown, needle: string) {
  return normalize(value).includes(normalize(needle));
}

function compareText(left: unknown, right: unknown) {
  return String(left || "").localeCompare(String(right || ""), "uk");
}

function normalize(value: unknown) {
  return String(value || "").toLocaleLowerCase("uk-UA").replace(/\s+/g, " ").trim();
}

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeLike(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), { status, headers: corsHeaders });
}
