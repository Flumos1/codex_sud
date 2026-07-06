import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { createSearchApiServer, loadJsonl } from "../scripts/serve-search-api.mjs";

const sample = await loadJsonl("data/sample/edrsr-sample.jsonl");

test("precedent search UI uses the local API when available", async () => {
  const server = createSearchApiServer(sample, { source: "test" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const apiBase = `http://127.0.0.1:${address.port}`;

  try {
    const elements = createElements();
    const context = {
      FormData: MockFormData,
      URLSearchParams,
      console,
      document: {
        querySelector(selector) {
          return elements[selector] || null;
        },
      },
      fetch,
      window: {
        location: {
          hostname: "127.0.0.1",
          protocol: "http:",
          search: `?api=${encodeURIComponent(apiBase)}`,
        },
      },
    };

    const code = await readFile("assets/precedent-search.js", "utf8");
    vm.runInNewContext(code, context);
    await waitFor(() => elements["#practiceMetrics"].innerHTML.includes("<strong>5</strong>"));

    assert.match(elements["#dataSourceNote"].textContent, /Search API/);
    assert.match(elements["#practiceMetrics"].innerHTML, /<strong>5<\/strong>/);
    assert.match(elements["#practiceReviewSets"].innerHTML, /Поддерживающие исходы/);
    assert.match(elements["#precedentResults"].innerHTML, /760\/5005\/26/);

    await elements["#precedentResults"].dispatch("click", {
      target: {
        closest(selector) {
          if (selector !== "[data-open-decision]") return null;
          return { dataset: { openDecision: "sample-005" } };
        },
      },
    });

    assert.equal(elements["#decisionDialog"].open, true);
    assert.match(elements["#decisionDialogTitle"].textContent, /760\/5005\/26/);
    assert.match(elements["#decisionDetail"].innerHTML, /Позов про стягнення боргу/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

function createElements() {
  return {
    "#precedentForm": {
      addEventListener() {},
    },
    "#decisionDialog": createDialogElement(),
    "#decisionDialogClose": createElement(),
    "#decisionDialogTitle": createElement(),
    "#decisionDetail": createElement(),
    "#practiceMetrics": createElement(),
    "#practiceFacets": createElement(),
    "#practiceReviewSets": createElement(),
    "#precedentResults": createElement(),
    "#dataSourceNote": createElement(),
  };
}

function createElement() {
  const listeners = {};
  return {
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    async dispatch(type, event) {
      if (listeners[type]) await listeners[type](event);
    },
    innerHTML: "",
    textContent: "",
  };
}

function createDialogElement() {
  return {
    open: false,
    close() {
      this.open = false;
    },
    showModal() {
      this.open = true;
    },
  };
}

class MockFormData {
  get() {
    return "";
  }
}

async function waitFor(predicate) {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("Timed out waiting for UI state");
}
