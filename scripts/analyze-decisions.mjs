import { readFile } from "node:fs/promises";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));

if (!args.input) {
  printUsage();
  process.exitCode = 1;
} else {
  const inputPath = path.resolve(args.input);
  const decisions = await loadJsonl(inputPath);
  const summary = summarize(decisions);

  if (args.json) {
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

function summarize(decisions) {
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
    total: decisions.length,
    text_coverage: ratio(withText.length, decisions.length),
    article_coverage: ratio(withArticles.length, decisions.length),
    outcome_coverage: ratio(withKnownOutcome.length, decisions.length),
    date_range: {
      from: dates[0] || "",
      to: dates[dates.length - 1] || "",
    },
    by_outcome: topCounts(countBy(decisions, "outcome_label"), 20),
    by_text_status: topCounts(countTextStatus(decisions), 20),
    by_region: topCounts(countBy(decisions, "court_region"), 20),
    by_level: topCounts(countBy(decisions, "court_level"), 20),
    by_decision_type: topCounts(countBy(decisions, "decision_type"), 20),
    top_courts: topCounts(countBy(decisions, "court_name"), 20),
    top_categories: topCounts(countBy(decisions, "category"), 20),
    top_articles: topCounts(countList(decisions, "cited_articles"), 30),
    top_laws: topCounts(countList(decisions, "cited_laws"), 20),
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

function countTextStatus(items) {
  return items.reduce((acc, item) => {
    const value = clean(item.text_status) || (clean(item.text) ? "present_without_status" : "missing_without_status");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
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
  console.log(`Total decisions: ${summary.total}`);
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
  printSection("Regions", summary.by_region);
  printSection("Court levels", summary.by_level);
  printSection("Decision types", summary.by_decision_type);
  printSection("Top articles", summary.top_articles);
  printSection("Top courts", summary.top_courts);
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

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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
node scripts/analyze-decisions.mjs --input data/index/edrsr-2026.first20.text.jsonl --json`);
}
