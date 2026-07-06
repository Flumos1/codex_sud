import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";
import { parseArgs, readJsonl } from "./cli-utils.mjs";
import { classifyOutcome, clean, extractArticles, unique } from "./legal-text-utils.mjs";

const args = parseArgs(process.argv.slice(2));

if (!args.input || !args.output) {
  printUsage();
  process.exitCode = 1;
} else {
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const cacheDir = path.resolve(args.cache || "data/raw/edrsr-rtf-cache");
  const limit = args.limit ? Number.parseInt(args.limit, 10) : undefined;
  const delayMs = args["delay-ms"] ? Number.parseInt(args["delay-ms"], 10) : 250;
  const offline = Boolean(args.offline);
  const input = await readJsonl(inputPath, { limit });
  const output = [];

  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(cacheDir, { recursive: true });

  for (let index = 0; index < input.length; index += 1) {
    const decision = input[index];
    const cachePath = path.join(cacheDir, `${safeFileName(decision.decision_id || String(index))}.rtf`);
    const rtf = await loadRtf(decision.source_url, cachePath, { offline });
    const text = rtf.buffer ? rtfToText(rtf.buffer) : "";
    const articleExtraction = extractArticles(text);
    const outcome = classifyOutcome(text);

    output.push(
      JSON.stringify({
        ...decision,
        text,
        cited_articles: articleExtraction.articles,
        cited_article_keys: articleExtraction.articleKeys,
        cited_laws: articleExtraction.laws,
        outcome_label: outcome.label,
        outcome_confidence: outcome.confidence,
        key_excerpts: unique([...articleExtraction.excerpts, ...outcome.excerpts]).slice(0, 5),
        text_status: rtf.status,
        text_error: rtf.error,
        text_fetched_at: text ? new Date().toISOString() : "",
      }),
    );

    if (!offline && index < input.length - 1) await sleep(delayMs);
  }

  await writeFile(outputPath, `${output.join("\n")}${output.length ? "\n" : ""}`, "utf8");
  console.log(`Enriched ${output.length} decisions`);
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`RTF cache: ${cacheDir}`);
}

async function loadRtf(url, cachePath, options) {
  try {
    return { buffer: await readFile(cachePath), status: "cached", error: "" };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (!url) return { buffer: undefined, status: "missing_url", error: "" };
  if (options.offline) return { buffer: undefined, status: "missing_cache_offline", error: "" };

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "codex-sud-ingestion-prototype/0.1",
      },
    });

    if (!response.ok) {
      return {
        buffer: undefined,
        status: "fetch_error",
        error: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(cachePath, buffer);
    return { buffer, status: "fetched", error: "" };
  } catch (error) {
    return { buffer: undefined, status: "fetch_error", error: error.message };
  }
}

function rtfToText(buffer) {
  const raw = buffer.toString("latin1");
  const codepage = detectCodepage(raw);
  const decoder = new TextDecoder(codepage);
  const output = [];
  const skipStack = [];

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const skipping = skipStack[skipStack.length - 1] || false;

    if (char === "{") {
      skipStack.push(skipping || isSkippedGroup(raw, index));
      continue;
    }

    if (char === "}") {
      skipStack.pop();
      continue;
    }

    if (skipping) continue;

    if (char === "\\") {
      const next = raw[index + 1];

      if (next === "'") {
        const hex = raw.slice(index + 2, index + 4);
        if (/^[0-9a-f]{2}$/i.test(hex)) {
          output.push(decoder.decode(Buffer.from([Number.parseInt(hex, 16)])));
          index += 3;
          continue;
        }
      }

      if (next === "\\" || next === "{" || next === "}") {
        output.push(next);
        index += 1;
        continue;
      }

      const control = raw.slice(index + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (control) {
        const word = control[1];
        if (word === "par" || word === "line" || word === "cell" || word === "row") output.push("\n");
        if (word === "tab") output.push("\t");
        index += control[0].length;
        continue;
      }

      index += 1;
      continue;
    }

    if (char !== "\r" && char !== "\n") output.push(char);
  }

  return output
    .join("")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function detectCodepage(raw) {
  const codepage = raw.match(/\\ansicpg(\d+)/)?.[1];
  if (codepage === "1251") return "windows-1251";
  if (codepage === "1252") return "windows-1252";
  return "windows-1251";
}

function isSkippedGroup(raw, index) {
  return (
    raw.startsWith("{\\fonttbl", index) ||
    raw.startsWith("{\\colortbl", index) ||
    raw.startsWith("{\\stylesheet", index) ||
    raw.startsWith("{\\info", index) ||
    raw.startsWith("{\\pict", index) ||
    raw.startsWith("{\\*", index)
  );
}

function safeFileName(value) {
  return String(value || "decision").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printUsage() {
  console.log(`Usage:
node scripts/enrich-edrsr-text.mjs --input data/index/edrsr-2026.first100.jsonl --output data/index/edrsr-2026.first10.text.jsonl --limit 10 --cache data/raw/edrsr-rtf-cache

Use --offline to read only cached RTF files without network requests.`);
}
