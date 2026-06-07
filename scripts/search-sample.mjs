import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getArticleKeys, includesText } from "./legal-text-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samplePath = path.join(root, "data", "sample", "edrsr-sample.jsonl");

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input ? path.resolve(args.input) : samplePath;
delete args.input;

const decisions = await loadJsonl(inputPath);
const matchedResults = search(decisions, args);
const sortedResults = sortResults(matchedResults, args.sort);
const results = limitResults(sortedResults, args.limit);
const summary = summarize(matchedResults);
const output = { query: args, summary, results };

if (args.csv) {
  process.stdout.write(toCsv(results));
} else if (args.json) {
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

function search(items, query) {
  return items.filter((item) => {
    if (query.article && !matchesArticle(item, query.article)) return false;
    if (query.law && !matchesList(item.cited_laws, query.law)) return false;
    if (query.region && !includesText(item.court_region, query.region)) return false;
    if (query.court && !includesText(item.court_name, query.court)) return false;
    if (query.level && item.court_level !== query.level) return false;
    if (query.type && item.decision_type !== query.type) return false;
    if (query.outcome && item.outcome_label !== query.outcome) return false;
    if (query.from && item.decision_date < query.from) return false;
    if (query.to && item.decision_date > query.to) return false;
    if (query.q && !includesText([item.text, item.case_number, item.court_name].join(" "), query.q)) return false;
    return true;
  });
}

function summarize(items) {
  return {
    total: items.length,
    by_outcome: countBy(items, "outcome_label"),
    by_region: countBy(items, "court_region"),
    by_level: countBy(items, "court_level"),
    by_article: countArticles(items),
  };
}

function sortResults(items, sortMode = "date_desc") {
  const copy = [...items];
  const mode = String(sortMode || "date_desc");

  if (mode === "date_asc") {
    return copy.sort((a, b) => compareDates(a, b) || compareText(a.case_number, b.case_number));
  }

  if (mode === "court") {
    return copy.sort((a, b) => compareText(a.court_name, b.court_name) || compareDatesDesc(a, b));
  }

  if (mode === "outcome") {
    return copy.sort((a, b) => compareText(a.outcome_label, b.outcome_label) || compareDatesDesc(a, b));
  }

  return copy.sort((a, b) => compareDatesDesc(a, b) || compareText(a.case_number, b.case_number));
}

function limitResults(items, limit) {
  if (!limit) return items;
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return items;
  return items.slice(0, parsed);
}

function compareDates(a, b) {
  return String(a.decision_date || "").localeCompare(String(b.decision_date || ""));
}

function compareDatesDesc(a, b) {
  return compareDates(b, a);
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "uk");
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function countArticles(items) {
  return items.reduce((acc, item) => {
    for (const article of getArticleKeys(item)) {
      acc[article] = (acc[article] || 0) + 1;
    }
    return acc;
  }, {});
}

function matchesArticle(item, needle) {
  return [...getArticleKeys(item), ...(item.cited_articles || [])].some((value) => includesText(value, needle));
}

function matchesList(values, needle) {
  return (values || []).some((value) => includesText(value, needle));
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
