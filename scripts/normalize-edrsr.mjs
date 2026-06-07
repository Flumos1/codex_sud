import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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

function extractArticles(text) {
  const articles = new Set();
  const articleKeys = new Set();
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
    articleKeys.add(normalizeArticleKey(article, law));
    laws.add(law);
    excerpts.push(excerptAround(normalized, match.index, match[0].length));
  }

  return {
    articles: [...articles],
    articleKeys: [...articleKeys],
    laws: [...laws],
    excerpts: unique(excerpts),
  };
}

function normalizeLawName(value) {
  const text = clean(value)
    .replace(/[.,;:)\]]+$/g, "")
    .replace(/\s+/g, " ");

  const known = [
    ["КК України", /\bКК\b|Кримінальн/iu],
    ["КПК України", /\bКПК\b|Кримінальн[а-яіїєґa-z]*\s+процесуальн/iu],
    ["КУпАП", /\bКУпАП\b|адміністративні правопорушення/iu],
    ["ЦК України", /\bЦК\b|Цивільн[а-яіїєґa-z]*\s+кодекс/iu],
    ["ЦПК України", /\bЦПК\b|Цивільн[а-яіїєґa-z]*\s+процесуальн/iu],
    ["ГПК України", /\bГПК\b|Господарськ[а-яіїєґa-z]*\s+процесуальн/iu],
    ["КАС України", /\bКАС\b|адміністративн[а-яіїєґa-z]*\s+судочинства/iu],
  ];

  const hit = known.find(([, pattern]) => pattern.test(text));
  return hit ? hit[0] : text.slice(0, 80);
}

function normalizeArticleKey(article, law) {
  return `${normalizeLawName(law)}:${clean(article).replace(/\s+/g, "")}`;
}

function classifyOutcome(text) {
  const decisionPart = getDispositivePart(text);
  const normalized = normalizeText(decisionPart || text);
  const rules = [
    ["appeal_dismissed", 0.9, /апеляційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*\s+.{0,120}залишити\s+без\s+задоволення/u],
    ["cassation_dismissed", 0.9, /касаційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*\s+.{0,120}залишити\s+без\s+задоволення/u],
    ["appeal_granted", 0.9, /апеляційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*\s+.{0,120}задовольнити/u],
    ["cassation_granted", 0.9, /касаційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*\s+.{0,120}задовольнити/u],
    ["left_unchanged", 0.88, /рішенн[а-яіїєґa-z_]*\s+.{0,120}залишити\s+без\s+змін/u],
    ["cassation_refused_opening", 0.92, /відмовити\s+у\s+відкритті\s+касаційн[а-яіїєґa-z_]*\s+провадження/u],
    ["cassation_opened", 0.9, /відкрити\s+касаційн[а-яіїєґa-z_]*\s+провадження/u],
    ["cassation_returned", 0.9, /касаційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*\s+.{0,120}повернути|повернути\s+.{0,120}касаційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*/u],
    ["case_scheduled", 0.84, /призначити\s+справ[а-яіїєґa-z_]*\s+.{0,160}до\s+.{0,80}розгляду/u],
    ["motion_denied", 0.86, /у\s+задоволенн[ія]\s+заяв[а-яіїєґa-z_]*\s+.{0,160}відмовити/u],
    ["transferred", 0.82, /передати\s+.{0,120}(касаційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*|справ[а-яіїєґa-z_]*)/u],
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

function getDispositivePart(text) {
  const source = clean(text);
  const markers = [
    /п\s*о\s*с\s*т\s*а\s*н\s*о\s*в\s*и\s*(в|л\s*а|л\s*и)\s*[:\-]?/giu,
    /у\s*х\s*в\s*а\s*л\s*и\s*(в|л\s*а|л\s*и)\s*[:\-]?/giu,
    /в\s*и\s*р\s*і\s*ш\s*и\s*(в|л\s*а|л\s*и)\s*[:\-]?/giu,
  ];
  let lastIndex = -1;

  for (const pattern of markers) {
    for (const match of source.matchAll(pattern)) {
      lastIndex = Math.max(lastIndex, match.index + match[0].length);
    }
  }

  return lastIndex >= 0 ? source.slice(lastIndex) : source;
}

function excerptAround(text, index = 0, length = 0) {
  const source = clean(text);
  const start = Math.max(0, index - 80);
  const end = Math.min(source.length, index + length + 80);
  return source.slice(start, end).trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeText(value) {
  return clean(value).toLocaleLowerCase("uk-UA");
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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
