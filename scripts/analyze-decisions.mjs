import { readFile } from "node:fs/promises";
import path from "node:path";
import { summarizePractice } from "./analytics-utils.mjs";
import { filterDecisions } from "./search-utils.mjs";

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
  const summary = summarizePractice(filtered, decisions.length, args);

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
