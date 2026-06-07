import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("analysis CLI filters decisions and preserves source total", async () => {
  const { stdout } = await execFileAsync("node", [
    "scripts/analyze-decisions.mjs",
    "--input",
    "data/sample/edrsr-sample.jsonl",
    "--article",
    "625 ЦК",
    "--json",
  ]);

  const summary = JSON.parse(stdout);

  assert.equal(summary.total, 2);
  assert.equal(summary.source_total, 5);
  assert.deepEqual(summary.by_outcome, [
    { value: "partially_satisfied", count: 1 },
    { value: "satisfied", count: 1 },
  ]);
  assert.deepEqual(summary.top_article_keys, [{ value: "ЦК України:625", count: 2 }]);
});

test("analysis CLI reports outcome pivots for filtered practice", async () => {
  const { stdout } = await execFileAsync("node", [
    "scripts/analyze-decisions.mjs",
    "--input",
    "data/sample/edrsr-sample.jsonl",
    "--region",
    "Київ",
    "--json",
  ]);

  const summary = JSON.parse(stdout);

  assert.equal(summary.total, 2);
  assert.deepEqual(summary.by_year, [{ value: "2026", count: 2 }]);
  assert.deepEqual(summary.outcome_by_year, [
    {
      value: "2026",
      total: 2,
      counts: {
        partially_satisfied: 1,
        satisfied: 1,
      },
    },
  ]);
});
