import { readFile } from "node:fs/promises";
import path from "node:path";
import { clean, getArticleKeys, includesText } from "./legal-text-utils.mjs";

const args = parseArgs(process.argv.slice(2));

if (!args.input) {
  printUsage();
  process.exitCode = 1;
} else {
  const inputPath = path.resolve(args.input);
  const outputJson = Boolean(args.json);
  delete args.input;
  delete args.json;
  const decisions = await loadJsonl(inputPath);
  const filtered = filterDecisions(decisions, args);
  const summary = summarize(filtered, decisions.length, args);

  if (outputJson) {
    process.stdout.write(JSON.stringify(summary, null, 2));
  } else {
    printHuman(summary);
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

function filterDecisions(decisions, query) {
  return decisions.filter((decision) => {
    if (query.article && !matchesArticle(decision, query.article)) return false;
    if (query.law && !matchesList(decision.cited_laws, query.law)) return false;
    if (query.region && !includesText(decision.court_region, query.region)) return false;
    if (query.court && !includesText(decision.court_name, query.court)) return false;
    if (query.level && decision.court_level !== query.level) return false;
    if (query.type && decision.decision_type !== query.type) return false;
    if (query.outcome && decision.outcome_label !== query.outcome) return false;
    if (query.from && decision.decision_date < query.from) return false;
    if (query.to && decision.decision_date > query.to) return false;
    if (query.q && !includesText([decision.text, decision.case_number, decision.court_name].join(" "), query.q)) return false;
    return true;
  });
}

function summarize(decisions, sourceTotal = decisions.length, query = {}) {
  const withText = decisions.filter((decision) => clean(decision.text).length > 0);
  const withArticles = decisions.filter((decision) => decision.cited_articles?.length);
  const withKnownOutcome = decisions.filter(
    (decision) => decision.outcome_label && decision.outcome_label !== "unknown",
  );
  const dates = decisions
    .map((decision) => decision.decision_date)
    .filter(Boolean)
    .sort();

  return {
    query,
    total: decisions.length,
    source_total: sourceTotal,
    text_coverage: ratio(withText.length, decisions.length),
    article_coverage: ratio(withArticles.length, decisions.length),
    outcome_coverage: ratio(withKnownOutcome.length, decisions.length),
    date_range: {
      from: dates[0] || "",
      to: dates[dates.length - 1] || "",
    },
    by_outcome: topCounts(countBy(decisions, "outcome_label"), 20),
    by_text_status: topCounts(countTextStatus(decisions), 20),
    by_year: topCounts(countByYear(decisions), 20),
    by_region: topCounts(countBy(decisions, "court_region"), 20),
    by_level: topCounts(countBy(decisions, "court_level"), 20),
    by_decision_type: topCounts(countBy(decisions, "decision_type"), 20),
    top_courts: topCounts(countBy(decisions, "court_name"), 20),
    top_categories: topCounts(countBy(decisions, "category"), 20),
    top_articles: topCounts(countList(decisions, "cited_articles"), 30),
    top_article_keys: topCounts(countArticleKeys(decisions), 30),
    top_laws: topCounts(countList(decisions, "cited_laws"), 20),
    outcome_by_year: pivotCounts(decisions, yearOf, (decision) => clean(decision.outcome_label) || "unknown"),
    outcome_by_region: pivotCounts(decisions, (decision) => clean(decision.court_region) || "unknown", (decision) =>
      clean(decision.outcome_label) || "unknown",
    ),
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = clean(item[key]) || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function countList(items, key) {
  return items.reduce((acc, item) => {
    for (const value of item[key] || []) {
      const normalized = clean(value) || "unknown";
      acc[normalized] = (acc[normalized] || 0) + 1;
    }
    return acc;
  }, {});
}

function countArticleKeys(items) {
  return items.reduce((acc, item) => {
    for (const value of getArticleKeys(item)) {
      const normalized = clean(value) || "unknown";
      acc[normalized] = (acc[normalized] || 0) + 1;
    }
    return acc;
  }, {});
}

function countByYear(items) {
  return items.reduce((acc, item) => {
    const value = yearOf(item);
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function countTextStatus(items) {
  return items.reduce((acc, item) => {
    const value = clean(item.text_status) || (clean(item.text) ? "present_without_status" : "missing_without_status");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function pivotCounts(items, rowGetter, columnGetter) {
  const rows = new Map();

  for (const item of items) {
    const rowKey = rowGetter(item);
    const columnKey = columnGetter(item);
    if (!rows.has(rowKey)) rows.set(rowKey, { total: 0, counts: {} });
    const row = rows.get(rowKey);
    row.total += 1;
    row.counts[columnKey] = (row.counts[columnKey] || 0) + 1;
  }

  return [...rows.entries()]
    .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0], "uk"))
    .slice(0, 20)
    .map(([value, row]) => ({ value, total: row.total, counts: row.counts }));
}

function yearOf(item) {
  return clean(item.decision_date).slice(0, 4) || "unknown";
}

function matchesArticle(item, needle) {
  return [...getArticleKeys(item), ...(item.cited_articles || [])].some((value) => includesText(value, needle));
}

function matchesList(values, needle) {
  return (values || []).some((value) => includesText(value, needle));
}

function topCounts(counts, limit) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "uk"))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function ratio(value, total) {
  if (!total) return { count: 0, total: 0, percent: 0 };
  return {
    count: value,
    total,
    percent: Number(((value / total) * 100).toFixed(1)),
  };
}

function printHuman(summary) {
  if (Object.keys(summary.query).length) {
    console.log("Query:");
    console.log(JSON.stringify(summary.query, null, 2));
    console.log("");
  }
  console.log(`Total decisions: ${summary.total}`);
  if (summary.source_total !== summary.total) console.log(`Source total: ${summary.source_total}`);
  console.log(
    `Text coverage: ${summary.text_coverage.count}/${summary.text_coverage.total} (${summary.text_coverage.percent}%)`,
  );
  console.log(
    `Article coverage: ${summary.article_coverage.count}/${summary.article_coverage.total} (${summary.article_coverage.percent}%)`,
  );
  console.log(
    `Outcome coverage: ${summary.outcome_coverage.count}/${summary.outcome_coverage.total} (${summary.outcome_coverage.percent}%)`,
  );
  console.log(`Date range: ${summary.date_range.from || "unknown"} - ${summary.date_range.to || "unknown"}`);
  printSection("Outcomes", summary.by_outcome);
  printSection("Text status", summary.by_text_status);
  printSection("Years", summary.by_year);
  printSection("Regions", summary.by_region);
  printSection("Court levels", summary.by_level);
  printSection("Decision types", summary.by_decision_type);
  printSection("Top normalized article keys", summary.top_article_keys);
  printSection("Top articles", summary.top_articles);
  printSection("Top courts", summary.top_courts);
  printPivot("Outcome by year", summary.outcome_by_year);
  printPivot("Outcome by region", summary.outcome_by_region);
}

function printSection(title, rows) {
  console.log("");
  console.log(`${title}:`);
  if (!rows.length) {
    console.log("- none");
    return;
  }
  for (const row of rows.slice(0, 10)) {
    console.log(`- ${row.value}: ${row.count}`);
  }
}

function printPivot(title, rows) {
  console.log("");
  console.log(`${title}:`);
  if (!rows.length) {
    console.log("- none");
    return;
  }
  for (const row of rows.slice(0, 10)) {
    console.log(`- ${row.value}: ${row.total} ${JSON.stringify(row.counts)}`);
  }
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

function printUsage() {
  console.log(`Usage:
node scripts/analyze-decisions.mjs --input data/index/edrsr-2026.first20.text.jsonl
node scripts/analyze-decisions.mjs --input data/index/edrsr-2026.first20.text.jsonl --article "КАС України:333" --json

Supported filters: --article --law --region --court --level --type --outcome --from --to --q --json`);
}
