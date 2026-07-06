import { fileURLToPath } from "node:url";
import { indexById } from "../scripts/api-core.mjs";
import { readJsonl } from "../scripts/cli-utils.mjs";

// Serverless functions stay warm between invocations, so cache the parsed sample.
let cache;

export async function getData() {
  if (!cache) {
    const samplePath = fileURLToPath(new URL("../data/sample/edrsr-sample.jsonl", import.meta.url));
    const decisions = await readJsonl(samplePath, { warn: false });
    cache = { decisions, byId: indexById(decisions) };
  }
  return cache;
}
