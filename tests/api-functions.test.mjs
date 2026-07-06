import assert from "node:assert/strict";
import test from "node:test";
import analyzeHandler from "../api/analyze.mjs";
import decisionHandler from "../api/decisions/[id].mjs";
import healthHandler from "../api/health.mjs";
import searchHandler from "../api/search.mjs";

test("health function reports the sample size", async () => {
  const { status, body } = await invoke(healthHandler, "/api/health");
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.decisions, 5);
});

test("search function filters, limits and rejects bad limits", async () => {
  const ok = await invoke(searchHandler, "/api/search?article=625%20%D0%A6%D0%9A&limit=1");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.results.length, 1);
  assert.equal(ok.body.summary.total, 2);

  const bad = await invoke(searchHandler, "/api/search?limit=0");
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, "invalid_limit");
});

test("analyze function summarizes a filtered slice", async () => {
  const { status, body } = await invoke(analyzeHandler, "/api/analyze?region=%D0%9A%D0%B8%D1%97%D0%B2");
  assert.equal(status, 200);
  assert.equal(body.total, 2);
  assert.equal(body.source_total, 5);
});

test("decision function returns a decision by id and 404 for missing", async () => {
  const found = await invoke(decisionHandler, "/api/decisions/sample-005");
  assert.equal(found.status, 200);
  assert.equal(found.body.decision_id, "sample-005");

  const missing = await invoke(decisionHandler, "/api/decisions/missing-id");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, "decision_not_found");
});

test("functions reject non-GET methods", async () => {
  const { status, body } = await invoke(searchHandler, "/api/search", "POST");
  assert.equal(status, 405);
  assert.equal(body.error, "method_not_allowed");
});

function invoke(handler, url, method = "GET") {
  const request = { url, method, headers: {} };
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) {
        this.headers[key] = value;
      },
      end(payload) {
        try {
          resolve({ status: this.statusCode, headers: this.headers, body: JSON.parse(payload) });
        } catch (error) {
          reject(error);
        }
      },
    };
    Promise.resolve(handler(request, response)).catch(reject);
  });
}
