import { summarizePractice } from "./analytics-utils.mjs";
import {
  buildRelevantExcerpts,
  filterDecisions,
  limitResults,
  sortResults,
  summarizeSearchResults,
} from "./search-utils.mjs";

// Shared, transport-agnostic search API logic used by both the Node dev server
// (scripts/serve-search-api.mjs) and the Vercel serverless functions (api/*.mjs).

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const KNOWN_FILTERS = new Set([
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

export function queryFromSearchParams(params) {
  const query = {};
  for (const [key, value] of params.entries()) {
    if (value && KNOWN_FILTERS.has(key)) query[key] = value;
  }
  return query;
}

export function resolveLimit(rawLimit) {
  if (rawLimit === undefined) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.min(parsed, MAX_LIMIT);
}

export function indexById(decisions) {
  return new Map(decisions.map((decision) => [String(decision.decision_id || ""), decision]));
}

// Returns { status, payload } so any transport can serialize it.
export function handleSearch(decisions, query) {
  const limit = resolveLimit(query.limit);
  if (limit === null) return { status: 400, payload: { error: "invalid_limit", max: MAX_LIMIT } };

  const includeText = query.include_text === "1" || query.include_text === "true";
  const effectiveQuery = { ...query };
  delete effectiveQuery.include_text;

  const matchedResults = filterDecisions(decisions, effectiveQuery);
  const sortedResults = sortResults(matchedResults, effectiveQuery.sort);
  const results = limitResults(sortedResults, limit).map((decision) =>
    projectDecision(decision, { includeText, query: effectiveQuery }),
  );

  return {
    status: 200,
    payload: {
      query: effectiveQuery,
      summary: summarizeSearchResults(matchedResults),
      results,
    },
  };
}

export function handleAnalyze(decisions, query) {
  const filtered = filterDecisions(decisions, query);
  return { status: 200, payload: summarizePractice(filtered, decisions.length, query) };
}

export function handleDecision(decisionsById, decisionId) {
  const decision = decisionsById.get(String(decisionId));
  if (!decision) return { status: 404, payload: { error: "decision_not_found", decision_id: decisionId } };
  return { status: 200, payload: projectDecision(decision, { includeText: true }) };
}

export function projectDecision(decision, options = {}) {
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
