import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("search CLI limits JSON results while summarizing all matches", async () => {
  const { stdout } = await execFileAsync("node", [
    "scripts/search-sample.mjs",
    "--article",
    "625 ЦК",
    "--limit",
    "1",
    "--json",
  ]);

  const payload = JSON.parse(stdout);

  assert.equal(payload.summary.total, 2);
  assert.equal(payload.results.length, 1);
  assert.equal(payload.results[0].case_number, "760/5005/26");
});

test("search CLI can export compact CSV rows", async () => {
  const { stdout } = await execFileAsync("node", [
    "scripts/search-sample.mjs",
    "--article",
    "130 КУпАП",
    "--outcome",
    "remanded",
    "--csv",
  ]);

  const lines = stdout.trim().split(/\r?\n/);

  assert.equal(lines[0], "case_number,decision_date,court_name,court_region,court_level,decision_type,outcome_label,cited_article_keys,source_url");
  assert.match(lines[1], /^202\/4004\/26,2026-04-10,/);
  assert.match(lines[1], /КУпАП:130/);
});
