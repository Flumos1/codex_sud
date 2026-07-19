import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const {
  values: { input, "batch-size": batchSize },
} = parseArgs({
  options: {
    input: { type: "string", short: "i", default: "data/sample/edrsr-sample.jsonl" },
    "batch-size": { type: "string", default: "500" },
  },
});

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing.");
  process.exitCode = 1;
} else {
  const decisions = await loadJsonl(input);
  const size = Number.parseInt(batchSize, 10) || 500;

  for (let index = 0; index < decisions.length; index += size) {
    const batch = decisions.slice(index, index + size).map(normalizeDecision);
    await upsertBatch(batch);
    console.log(`Imported ${Math.min(index + batch.length, decisions.length)} / ${decisions.length}`);
  }
}

async function loadJsonl(filePath) {
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function upsertBatch(batch) {
  const endpoint = `${supabaseUrl.replace(/\/$/u, "")}/rest/v1/legal_decisions?on_conflict=decision_id`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: "resolution=merge-duplicates",
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(batch),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase import failed with HTTP ${response.status}: ${body}`);
  }
}

function normalizeDecision(decision) {
  return {
    decision_id: decision.decision_id,
    source_url: decision.source_url || null,
    source_dataset: decision.source_dataset || null,
    source_attribution: decision.source_attribution || null,
    case_number: decision.case_number || null,
    proceeding_number: decision.proceeding_number || null,
    court_name: decision.court_name || null,
    court_region: decision.court_region || null,
    court_level: decision.court_level || null,
    court_code: decision.court_code || null,
    decision_date: decision.decision_date || null,
    registration_date: decision.registration_date || null,
    publication_date: decision.publication_date || null,
    proceeding_type: decision.proceeding_type || null,
    decision_type: decision.decision_type || null,
    category: decision.category || null,
    judge_names: decision.judge_names || [],
    cited_articles: decision.cited_articles || [],
    cited_article_keys: decision.cited_article_keys?.length
      ? decision.cited_article_keys
      : (decision.cited_articles || []).map(articleToKey).filter(Boolean),
    cited_laws: decision.cited_laws || [],
    outcome_label: decision.outcome_label || null,
    outcome_confidence: decision.outcome_confidence || null,
    key_excerpts: decision.key_excerpts || [],
    text: decision.text || null,
    text_status: decision.text_status || null,
    text_error: decision.text_error || null,
    indexed_at: decision.indexed_at || null,
  };
}

function articleToKey(value) {
  const text = String(value || "");
  const article = text.match(/\d+(?:[-–]\d+)?/)?.[0] || "";
  const law = normalizeLawName(text);
  return article && law ? `${law}:${article}` : text;
}

function normalizeLawName(value) {
  const text = String(value || "");
  const known = [
    ["КК України", /\bКК\b|Кримінальн/iu],
    ["КПК України", /\bКПК\b|Кримінальн[а-яіїєґa-z]*\s+процесуальн/iu],
    ["КУпАП", /\bКУпАП\b|адміністративні правопорушення/iu],
    ["ЦК України", /\bЦК\b|Цивільн[а-яіїєґa-z]*\s+кодекс/iu],
    ["ЦПК України", /\bЦПК\b|Цивільн[а-яіїєґa-z]*\s+процесуальн/iu],
    ["ГПК України", /\bГПК\b|Господарськ[а-яіїєґa-z]*\s+процесуальн/iu],
    ["КАС України", /\bКАС\b|адміністративн[а-яіїєґa-z]*\s+судочинства/iu],
  ];
  return known.find(([, pattern]) => pattern.test(text))?.[0] || "";
}
