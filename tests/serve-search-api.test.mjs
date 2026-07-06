import assert from "node:assert/strict";
import test from "node:test";
import { createSearchApiServer, loadJsonl } from "../scripts/serve-search-api.mjs";

const sample = await loadJsonl("data/sample/edrsr-sample.jsonl");

test("search API exposes health metadata", async () => {
  await withServer(async (baseUrl) => {
    const payload = await getJson(`${baseUrl}/health`);

    assert.equal(payload.ok, true);
    assert.equal(payload.decisions, 5);
  });
});

test("search API returns filtered and limited decisions", async () => {
  await withServer(async (baseUrl) => {
    const payload = await getJson(`${baseUrl}/api/search?article=625%20%D0%A6%D0%9A&limit=1`);

    assert.equal(payload.summary.total, 2);
    assert.equal(payload.results.length, 1);
    assert.equal(payload.results[0].case_number, "760/5005/26");
    assert.equal("text" in payload.results[0], false);
  });
});

test("search API includes full text only when explicitly requested", async () => {
  await withServer(async (baseUrl) => {
    const payload = await getJson(`${baseUrl}/api/search?article=625%20%D0%A6%D0%9A&limit=1&include_text=1`);

    assert.equal(payload.query.include_text, undefined);
    assert.equal(payload.results.length, 1);
    assert.match(payload.results[0].text, /Позов про стягнення боргу/);
  });
});

test("search API returns query-relevant excerpts for decision cards", async () => {
  await withServer(async (baseUrl) => {
    const query = new URLSearchParams({
      article: "625 ЦК",
      q: "грошового зобов'язання",
      limit: "1",
    });
    const payload = await getJson(`${baseUrl}/api/search?${query}`);

    assert.equal(payload.results.length, 1);
    assert.match(payload.results[0].key_excerpts[0], /грошового зобов'язання/);
  });
});

test("search API returns a full decision by id", async () => {
  await withServer(async (baseUrl) => {
    const payload = await getJson(`${baseUrl}/api/decisions/sample-005`);

    assert.equal(payload.decision_id, "sample-005");
    assert.equal(payload.case_number, "760/5005/26");
    assert.match(payload.text, /Позов про стягнення боргу/);
  });
});

test("search API returns 404 for missing decisions", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/decisions/missing-id`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.error, "decision_not_found");
    assert.equal(payload.decision_id, "missing-id");
  });
});

test("search API returns filtered practice analytics", async () => {
  await withServer(async (baseUrl) => {
    const payload = await getJson(`${baseUrl}/api/analyze?region=%D0%9A%D0%B8%D1%97%D0%B2`);

    assert.equal(payload.total, 2);
    assert.equal(payload.source_total, 5);
    assert.deepEqual(payload.by_year, [{ value: "2026", count: 2 }]);
    assert.deepEqual(payload.outcome_groups, [{ value: "supporting_outcome", count: 2 }]);
    assert.equal(payload.review_sets.supporting_outcome.length, 2);
  });
});

test("search API can serve static prototype files in dev mode", async () => {
  await withServer(async (baseUrl) => {
    const html = await getText(`${baseUrl}/precedent-search.html`);
    const script = await getText(`${baseUrl}/assets/precedent-search.js`);
    const legalCheck = await getText(`${baseUrl}/legal-check.html`);

    assert.match(html, /Поиск судебной практики/);
    assert.match(script, /renderFromApi/);
    assert.match(legalCheck, /Legal check in 60 seconds/);
  }, { staticRoot: process.cwd() });
});

async function withServer(callback, options = {}) {
  const server = createSearchApiServer(sample, { source: "test", ...options });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function getJson(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true);
  return response.json();
}

async function getText(url) {
  const response = await fetch(url);
  assert.equal(response.ok, true);
  return response.text();
}
