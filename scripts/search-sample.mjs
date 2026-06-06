import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samplePath = path.join(root, "data", "sample", "edrsr-sample.jsonl");

const args = parseArgs(process.argv.slice(2));
const decisions = await loadJsonl(samplePath);
const results = search(decisions, args);
const summary = summarize(results);

if (args.json) {
  process.stdout.write(JSON.stringify({ query: args, summary, results }, null, 2));
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
    if (query.article && !matchesList(item.cited_articles, query.article)) return false;
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

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function countArticles(items) {
  return items.reduce((acc, item) => {
    for (const article of item.cited_articles || []) {
      acc[article] = (acc[article] || 0) + 1;
    }
    return acc;
  }, {});
}

function matchesList(values, needle) {
  return (values || []).some((value) => includesText(value, needle));
}

function includesText(value, needle) {
  return normalize(value).includes(normalize(needle));
}

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("uk-UA")
    .replace(/\s+/g, " ")
    .trim();
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
