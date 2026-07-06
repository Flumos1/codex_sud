import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_LIMIT,
  handleAnalyze,
  handleDecision,
  handleSearch,
  indexById,
  queryFromSearchParams,
  resolveLimit,
} from "../scripts/api-core.mjs";
import { loadJsonl } from "../scripts/serve-search-api.mjs";

const sample = await loadJsonl("data/sample/edrsr-sample.jsonl");

test("resolveLimit rejects invalid values and caps at the maximum", () => {
  assert.equal(resolveLimit(undefined), 20);
  assert.equal(resolveLimit("5"), 5);
  assert.equal(resolveLimit("0"), null);
  assert.equal(resolveLimit("-4"), null);
  assert.equal(resolveLimit("abc"), null);
  assert.equal(resolveLimit("100000"), MAX_LIMIT);
});

test("queryFromSearchParams keeps only known filters", () => {
  const params = new URLSearchParams("article=625 ЦК&evil=<script>&limit=5");
  const query = queryFromSearchParams(params);
  assert.equal(query.article, "625 ЦК");
  assert.equal(query.limit, "5");
  assert.equal("evil" in query, false);
});

test("handleSearch returns 400 on invalid limit and hides text by default", () => {
  assert.equal(handleSearch(sample, { limit: "0" }).status, 400);

  const { status, payload } = handleSearch(sample, { article: "625 ЦК", limit: "1" });
  assert.equal(status, 200);
  assert.equal(payload.summary.total, 2);
  assert.equal(payload.results.length, 1);
  assert.equal("text" in payload.results[0], false);
});

test("handleSearch includes full text only when requested", () => {
  const { payload } = handleSearch(sample, { article: "625 ЦК", limit: "1", include_text: "1" });
  assert.match(payload.results[0].text, /Позов про стягнення боргу/);
  assert.equal("include_text" in payload.query, false);
});

test("handleAnalyze summarizes the filtered slice against the full source", () => {
  const { payload } = handleAnalyze(sample, { region: "Київ" });
  assert.equal(payload.total, 2);
  assert.equal(payload.source_total, 5);
});

test("handleDecision returns a decision by id or 404", () => {
  const byId = indexById(sample);
  assert.equal(handleDecision(byId, "sample-005").status, 200);
  assert.match(handleDecision(byId, "sample-005").payload.text, /Позов про стягнення боргу/);

  const missing = handleDecision(byId, "missing-id");
  assert.equal(missing.status, 404);
  assert.equal(missing.payload.error, "decision_not_found");
});
