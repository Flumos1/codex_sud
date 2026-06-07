import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { classifyOutcome, clean, extractArticles, unique } from "./legal-text-utils.mjs";

const args = parseArgs(process.argv.slice(2));

if (!args.input || !args.output) {
  printUsage();
  process.exitCode = 1;
} else {
  const inputDir = path.resolve(args.input);
  const outputPath = path.resolve(args.output);
  const dataset = args.dataset || inferDatasetName(inputDir);
  const limit = args.limit ? Number.parseInt(args.limit, 10) : undefined;

  const dictionaries = await loadDictionaries(inputDir);
  const documentsPath = path.join(inputDir, "documents.csv");
  const indexedAt = new Date().toISOString();
  let count = 0;
  const output = [];

  for await (const row of readCsvRecords(documentsPath, { limit })) {
    output.push(JSON.stringify(normalizeDecision(row, dictionaries, dataset, indexedAt)));
    count += 1;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${output.join("\n")}${output.length ? "\n" : ""}`, "utf8");

  console.log(`Normalized ${count} EDRSR rows`);
  console.log(`Input: ${inputDir}`);
  console.log(`Output: ${outputPath}`);
}

async function loadDictionaries(inputDir) {
  const causeCategories = await loadDictionary(inputDir, "cause_categories.csv", "category_code");
  const courts = await loadDictionary(inputDir, "courts.csv", "court_code");
  const instances = await loadDictionary(inputDir, "instances.csv", "instance_code");
  const judgmentForms = await loadDictionary(inputDir, "judgment_forms.csv", "judgment_code");
  const justiceKinds = await loadDictionary(inputDir, "justice_kinds.csv", "justice_kind");
  const regions = await loadDictionary(inputDir, "regions.csv", "region_code");

  return {
    causeCategories,
    courts,
    instances,
    judgmentForms,
    justiceKinds,
    regions,
  };
}

async function loadDictionary(inputDir, fileName, keyField) {
  const filePath = path.join(inputDir, fileName);
  const records = new Map();

  try {
    for await (const row of readCsvRecords(filePath)) {
      const key = clean(row[keyField]);
      if (key) records.set(key, row);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  return records;
}

function normalizeDecision(row, dictionaries, dataset, indexedAt) {
  const court = dictionaries.courts.get(clean(row.court_code)) || {};
  const region = dictionaries.regions.get(clean(court.region_code)) || {};
  const instance = dictionaries.instances.get(clean(court.instance_code)) || {};
  const justiceKind = dictionaries.justiceKinds.get(clean(row.justice_kind)) || {};
  const judgmentForm = dictionaries.judgmentForms.get(clean(row.judgment_code)) || {};
  const category = dictionaries.causeCategories.get(clean(row.category_code)) || {};
  const text = clean(row.text || row.full_text || row.doc_text || row.document_text);
  const articleExtraction = extractArticles(text);
  const outcome = classifyOutcome(text);

  return {
    decision_id: clean(row.doc_id),
    source_url: clean(row.doc_url),
    source_dataset: dataset,
    case_number: clean(row.cause_num),
    proceeding_number: "",
    court_name: clean(court.name),
    court_region: clean(region.name),
    court_level: clean(instance.name),
    court_code: clean(row.court_code),
    decision_date: normalizeDate(row.adjudication_date),
    registration_date: normalizeDate(row.receipt_date),
    publication_date: normalizeDate(row.date_publ),
    proceeding_type: clean(justiceKind.name),
    proceeding_type_code: clean(row.justice_kind),
    decision_type: clean(judgmentForm.name),
    decision_type_code: clean(row.judgment_code),
    category: clean(category.name),
    category_code: clean(row.category_code),
    judge_names: clean(row.judge),
    status: clean(row.status),
    text,
    cited_articles: articleExtraction.articles,
    cited_article_keys: articleExtraction.articleKeys,
    cited_laws: articleExtraction.laws,
    outcome_label: outcome.label,
    outcome_confidence: outcome.confidence,
    key_excerpts: unique([...articleExtraction.excerpts, ...outcome.excerpts]).slice(0, 5),
    source_attribution: "Official EDRSR open data via data.gov.ua; verify against source_url.",
    indexed_at: indexedAt,
  };
}

async function* readCsvRecords(filePath, options = {}) {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const parser = createCsvStreamParser();
  let headers;
  let count = 0;

  for await (const chunk of stream) {
    for (const record of parser.write(chunk)) {
      if (!headers) {
        headers = record.map((value) => value.replace(/^\uFEFF/, "").trim());
      } else {
        yield toObject(headers, record);
        count += 1;
        if (options.limit && count >= options.limit) {
          stream.destroy();
          return;
        }
      }
    }
  }

  for (const record of parser.end()) {
    if (!headers) {
      headers = record.map((value) => value.replace(/^\uFEFF/, "").trim());
    } else {
      yield toObject(headers, record);
      count += 1;
      if (options.limit && count >= options.limit) return;
    }
  }
}

function createCsvStreamParser() {
  let delimiter;
  let field = "";
  let record = [];
  let inQuotes = false;
  let previousWasQuote = false;

  return {
    write(chunk) {
      const records = [];

      for (let index = 0; index < chunk.length; index += 1) {
        const char = chunk[index];

        if (!delimiter && !inQuotes && (char === "," || char === ";" || char === "\t")) {
          delimiter = char;
        }

        if (char === '"') {
          if (inQuotes && previousWasQuote) {
            field += '"';
            previousWasQuote = false;
          } else if (inQuotes) {
            previousWasQuote = true;
          } else if (field.length === 0) {
            inQuotes = true;
          } else {
            field += char;
          }
          continue;
        }

        if (previousWasQuote) {
          inQuotes = false;
          previousWasQuote = false;
        }

        const activeDelimiter = delimiter || ",";
        if (!inQuotes && char === activeDelimiter) {
          record.push(field);
          field = "";
          continue;
        }

        if (!inQuotes && (char === "\n" || char === "\r")) {
          if (char === "\r" && chunk[index + 1] === "\n") index += 1;
          record.push(field);
          field = "";
          if (record.some((value) => value.length > 0)) records.push(record);
          record = [];
          continue;
        }

        field += char;
      }

      return records;
    },
    end() {
      if (previousWasQuote) {
        inQuotes = false;
        previousWasQuote = false;
      }

      if (field.length > 0 || record.length > 0) {
        record.push(field);
        const finalRecord = record;
        field = "";
        record = [];
        return [finalRecord];
      }

      return [];
    },
  };
}

function toObject(headers, record) {
  return headers.reduce((acc, header, index) => {
    acc[header] = record[index] === undefined ? "" : record[index];
    return acc;
  }, {});
}

function normalizeDate(value) {
  const text = clean(value);
  if (!text) return "";

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dotted = text.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (dotted) return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;

  return text;
}

function inferDatasetName(inputDir) {
  const baseName = path.basename(inputDir).toLocaleLowerCase("uk-UA");
  const year = baseName.match(/20\d{2}/)?.[0] || "unknown";
  return `edrsr_data_${year}`;
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
node scripts/normalize-edrsr.mjs --input data/raw/edrsr_2026 --output data/index/edrsr-2026.sample.jsonl --limit 100 --dataset edrsr_data_2026

The input directory must contain documents.csv and may contain:
cause_categories.csv, courts.csv, instances.csv, judgment_forms.csv, justice_kinds.csv, regions.csv`);
}
