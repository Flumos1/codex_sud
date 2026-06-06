import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

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
  const input = await loadJsonl(inputPath, { limit });
  const output = [];

  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(cacheDir, { recursive: true });

  for (let index = 0; index < input.length; index += 1) {
    const decision = input[index];
    const cachePath = path.join(cacheDir, `${safeFileName(decision.decision_id || String(index))}.rtf`);
    const rtf = await loadRtf(decision.source_url, cachePath, { offline });
    const text = rtf ? rtfToText(rtf) : "";
    const articleExtraction = extractArticles(text);
    const outcome = classifyOutcome(text);

    output.push(
      JSON.stringify({
        ...decision,
        text,
        cited_articles: articleExtraction.articles,
        cited_laws: articleExtraction.laws,
        outcome_label: outcome.label,
        outcome_confidence: outcome.confidence,
        key_excerpts: unique([...articleExtraction.excerpts, ...outcome.excerpts]).slice(0, 5),
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

async function loadJsonl(filePath, options = {}) {
  const text = await readFile(filePath, "utf8");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(0, options.limit || lines.length).map((line) => JSON.parse(line));
}

async function loadRtf(url, cachePath, options) {
  try {
    return await readFile(cachePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  if (options.offline || !url) return undefined;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "codex-sud-ingestion-prototype/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(cachePath, buffer);
  return buffer;
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

function extractArticles(text) {
  const articles = new Set();
  const laws = new Set();
  const excerpts = [];
  const normalized = clean(text);
  const lawPattern = [
    "(?:ЦК|КК|КПК|ЦПК|ГПК|КАС)\\s+України",
    "КУпАП",
    "Кодексу\\s+України\\s+про\\s+адміністративні\\s+правопорушення",
    "Кримінального\\s+кодексу\\s+України",
    "Кримінального\\s+процесуального\\s+кодексу\\s+України",
    "Цивільного\\s+кодексу\\s+України",
    "Цивільного\\s+процесуального\\s+кодексу\\s+України",
    "Господарського\\s+процесуального\\s+кодексу\\s+України",
    "Кодексу\\s+адміністративного\\s+судочинства\\s+України",
  ].join("|");
  const pattern = new RegExp(
    `(?:ст\\.?|статт(?:я|і|ею))\\s*(\\d+(?:[-–]\\d+)?(?:\\s*[\\u00b9\\u00b2\\u00b3])?)\\s*(${lawPattern})`,
    "giu",
  );

  for (const match of normalized.matchAll(pattern)) {
    const article = clean(match[1]);
    const law = normalizeLawName(match[2]);
    if (!article || !law) continue;
    articles.add(`${article} ${law}`);
    laws.add(law);
    excerpts.push(excerptAround(normalized, match.index, match[0].length));
  }

  return {
    articles: [...articles],
    laws: [...laws],
    excerpts: unique(excerpts),
  };
}

function normalizeLawName(value) {
  const text = clean(value).replace(/[.,;:)\]]+$/g, "");
  const known = [
    ["КК України", /\bКК\b|Кримінальн/iu],
    ["КПК України", /\bКПК\b|Кримінальн\w+\s+процесуальн/iu],
    ["КУпАП", /\bКУпАП\b|адміністративні правопорушення/iu],
    ["ЦК України", /\bЦК\b|Цивільн\w+\s+кодекс/iu],
    ["ЦПК України", /\bЦПК\b|Цивільн\w+\s+процесуальн/iu],
    ["ГПК України", /\bГПК\b|Господарськ\w+\s+процесуальн/iu],
    ["КАС України", /\bКАС\b|адміністративн\w+\s+судочинства/iu],
  ];
  const hit = known.find(([, pattern]) => pattern.test(text));
  return hit ? hit[0] : text.slice(0, 80);
}

function classifyOutcome(text) {
  const normalized = clean(text).toLocaleLowerCase("uk-UA");
  const rules = [
    ["partially_satisfied", 0.88, /задовольнити\s+частково|частково\s+задовольнити/u],
    ["dismissed", 0.88, /у\s+задоволенн[ія]\s+.{0,80}відмовити|відмовити\s+у\s+задоволенн[ія]/u],
    ["satisfied", 0.84, /позов\s+задовольнити|заяву\s+задовольнити|скаргу\s+задовольнити/u],
    ["remanded", 0.86, /направити\s+.{0,80}нов(ий|ий)\s+розгляд|передати\s+.{0,80}нов(ий|ий)\s+розгляд/u],
    ["cancelled", 0.82, /скасувати/u],
    ["changed", 0.82, /змінити/u],
    ["closed", 0.86, /провадження\s+.{0,80}закрити|закрити\s+провадження/u],
  ];

  for (const [label, confidence, pattern] of rules) {
    const match = normalized.match(pattern);
    if (match) {
      return {
        label,
        confidence,
        excerpts: [excerptAround(text, match.index, match[0].length)],
      };
    }
  }

  return { label: "unknown", confidence: 0, excerpts: [] };
}

function excerptAround(text, index = 0, length = 0) {
  const source = clean(text);
  const start = Math.max(0, index - 80);
  const end = Math.min(source.length, index + length + 80);
  return source.slice(start, end).trim();
}

function safeFileName(value) {
  return String(value || "decision").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function printUsage() {
  console.log(`Usage:
node scripts/enrich-edrsr-text.mjs --input data/index/edrsr-2026.first100.jsonl --output data/index/edrsr-2026.first10.text.jsonl --limit 10 --cache data/raw/edrsr-rtf-cache

Use --offline to read only cached RTF files without network requests.`);
}
