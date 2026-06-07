import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getArticleKeys } from "./legal-text-utils.mjs";
import { filterDecisions, limitResults, sortResults, summarizeSearchResults } from "./search-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samplePath = path.join(root, "data", "sample", "edrsr-sample.jsonl");

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input ? path.resolve(args.input) : samplePath;
const outputJson = Boolean(args.json);
const outputCsv = Boolean(args.csv);
delete args.input;
delete args.json;
delete args.csv;

const decisions = await loadJsonl(inputPath);
const matchedResults = filterDecisions(decisions, args);
const sortedResults = sortResults(matchedResults, args.sort);
const results = limitResults(sortedResults, args.limit);
const summary = summarizeSearchResults(matchedResults);
const output = { query: args, summary, results };

if (outputCsv) {
  process.stdout.write(toCsv(results));
} else if (outputJson) {
  process.stdout.write(JSON.stringify(output, null, 2));
} else {
  printHuman(args, summary, results);
}

async function loadJsonl(file) {
  const text = await readFile(file, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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

function printHuman(query, summary, results) {
  console.log("Query:");
  console.log(JSON.stringify(query, null, 2));
  console.log("");
  console.log(`Found: ${summary.total}`);
  if (query.limit && results.length < summary.total) console.log(`Showing: ${results.length}`);
  console.log(`By outcome: ${JSON.stringify(summary.by_outcome)}`);
  console.log(`By region: ${JSON.stringify(summary.by_region)}`);
  console.log(`By level: ${JSON.stringify(summary.by_level)}`);
  console.log("");

  for (const item of results) {
    console.log(`${item.case_number} | ${item.court_name} | ${item.decision_date}`);
    console.log(`Outcome: ${item.outcome_label} (${item.outcome_confidence})`);
    console.log(`Articles: ${(item.cited_articles || []).join(", ")}`);
    console.log(`Excerpts: ${(item.key_excerpts || []).join(" | ")}`);
    console.log(`Source: ${item.source_url}`);
    console.log("");
  }
}

function toCsv(items) {
  const headers = [
    "case_number",
    "decision_date",
    "court_name",
    "court_region",
    "court_level",
    "decision_type",
    "outcome_label",
    "cited_article_keys",
    "source_url",
  ];
  const rows = items.map((item) => [
    item.case_number,
    item.decision_date,
    item.court_name,
    item.court_region,
    item.court_level,
    item.decision_type,
    item.outcome_label,
    getArticleKeys(item).join("; "),
    item.source_url,
  ]);
  return `${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value || "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
