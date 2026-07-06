import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildRelevantExcerpts,
  filterDecisions,
  limitResults,
  sortResults,
  summarizeSearchResults,
} from "../scripts/search-utils.mjs";

const sample = await loadJsonl("data/sample/edrsr-sample.jsonl");

test("filterDecisions applies practical legal search filters", () => {
  const results = filterDecisions(sample, {
    article: "130 КУпАП",
    outcome: "remanded",
    region: "Дніпропетровська",
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].case_number, "202/4004/26");
});

test("level and type filters match the form vocabulary in the sample", () => {
  const firstInstance = filterDecisions(sample, { level: "Перша інстанція" });
  assert.equal(firstInstance.length, 4);

  const appeal = filterDecisions(sample, { level: "Апеляційна інстанція" });
  assert.deepEqual(
    appeal.map((item) => item.case_number),
    ["202/4004/26"],
  );

  const rulings = filterDecisions(sample, { type: "Рішення" });
  assert.equal(rulings.length, 3);
});

test("sortResults and limitResults prepare compact review lists", () => {
  const matches = filterDecisions(sample, { article: "625 ЦК" });
  const sorted = sortResults(matches, "date_asc");
  const limited = limitResults(sorted, 1);

  assert.deepEqual(
    sorted.map((item) => item.case_number),
    ["910/1001/26", "760/5005/26"],
  );
  assert.deepEqual(
    limited.map((item) => item.case_number),
    ["910/1001/26"],
  );
});

test("summarizeSearchResults counts normalized article keys", () => {
  const summary = summarizeSearchResults(filterDecisions(sample, { law: "ЦК" }));

  assert.equal(summary.total, 3);
  assert.deepEqual(summary.by_article, {
    "ЦК України:625": 2,
    "ЦК України:23": 1,
  });
});

test("buildRelevantExcerpts prefers query text before stored generic excerpts", () => {
  const [decision] = filterDecisions(sample, { article: "625 ЦК", q: "грошового зобов'язання" });
  const excerpts = buildRelevantExcerpts(decision, { article: "625 ЦК", q: "грошового зобов'язання" });

  assert.match(excerpts[0], /грошового зобов'язання/);
  assert.match(excerpts.join(" "), /ст\. 625 ЦК України/);
});

async function loadJsonl(filePath) {
  const text = await readFile(filePath, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
