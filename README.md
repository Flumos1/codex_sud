# Codex Sud

Working repository for a Ukrainian legal technology platform.

## Current Prototype

Static pages:

- `index.html` - public product start page.
- `precedent-search.html` - precedent/case-law search prototype with local JSONL loading.
- `case-status.html` - user-driven case status flow for `court.gov.ua/fair/`.
- `registries.html` - registry intelligence catalog concept.

## Project Memory

- `LEGAL_PLATFORM_ROADMAP.md` - long strategic roadmap.
- `AGENTS.md` - Codex/project working rules.
- `docs/mvp-plan.md` - small-start MVP plan.
- `docs/precedent-search-design.md` - legal-practice search design.
- `docs/edrsr-ingestion-plan.md` - ingestion/search pipeline plan.
- `docs/edrsr-real-smoke-test.md` - first real-data EDRSR smoke-test notes.
- `docs/registry-matrix.md` - registry source matrix.

## Local Sample Search

The repository contains a synthetic sample dataset only. It is not real court data.

Run syntax checks and regression tests:

```bash
npm run check
npm test
```

Run:

```bash
node scripts/search-sample.mjs --article "625 ЦК" --region "Київ"
```

JSON output:

```bash
node scripts/search-sample.mjs --article "130 КУпАП" --outcome remanded --json
```

Limit, sort, or export results:

```bash
node scripts/search-sample.mjs --article "625 ЦК" --sort date_desc --limit 10
node scripts/search-sample.mjs --article "130 КУпАП" --outcome remanded --csv
```

Search a normalized local JSONL file:

```bash
node scripts/search-sample.mjs --input data/index/edrsr-2026.sample.jsonl --article "625 ЦК"
```

Supported filters:

- `--article`
- `--law`
- `--region`
- `--court`
- `--level`
- `--type`
- `--outcome`
- `--from`
- `--to`
- `--q`
- `--sort date_desc|date_asc|court|outcome`
- `--limit`
- `--json`
- `--csv`

## Data Safety

Do not commit:

- full EDRSR archives;
- extracted real datasets;
- generated indexes;
- private legal documents;
- secrets or credentials.

Use `data/raw/` and `data/index/` locally; both are ignored by git.

## PDF Readme Extraction

For source readmes that are only available as PDFs:

```bash
node scripts/extract-pdf-text.mjs readme_2026.pdf readme_2026_extracted.txt
```

The extracted text is only a helper for schema review. Do not commit downloaded PDFs or extracted text dumps.

## EDRSR CSV Normalization

After downloading and extracting `edrsr_data_2026.zip` outside git, normalize a small local slice:

```bash
node scripts/normalize-edrsr.mjs --input data/raw/edrsr_2026 --output data/index/edrsr-2026.sample.jsonl --limit 100 --dataset edrsr_data_2026
```

Test the parser on the committed synthetic schema fixture:

```bash
node scripts/normalize-edrsr.mjs --input data/sample/edrsr-csv-fixture --output data/index/edrsr-fixture.jsonl --dataset synthetic-edrsr-csv-fixture
```

Enrich normalized metadata with text from official RTF URLs:

```bash
node scripts/enrich-edrsr-text.mjs --input data/index/edrsr-2026.sample.jsonl --output data/index/edrsr-2026.sample.text.jsonl --limit 10 --cache data/raw/edrsr-rtf-cache
```

The RTF cache is raw source data and must stay outside git.

Shared legal text helpers live in `scripts/legal-text-utils.mjs`. Normalization, RTF enrichment, CLI search, and analysis use the same article extraction, normalized article keys, outcome labels, and text matching rules.

Shared search helpers live in `scripts/search-utils.mjs`. CLI search and filtered analytics use the same filters, sorting, limits, and search summaries, which is the intended base for a future API endpoint.

Run a local JSON API over the synthetic sample or an ignored local index:

```bash
npm run dev
node scripts/serve-search-api.mjs --port 8787
node scripts/serve-search-api.mjs --input data/index/edrsr-2026.sample.text.jsonl --port 8787
```

`npm run dev` serves both static pages and the API at `http://127.0.0.1:8787`, so `http://127.0.0.1:8787/precedent-search.html` uses the same server for UI and data.

Useful endpoints:

- `GET /health`
- `GET /api/search?article=625%20%D0%A6%D0%9A&limit=10`
- `GET /api/analyze?article=%D0%9A%D0%90%D0%A1%20%D0%A3%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D0%B8%3A333`

`precedent-search.html` tries the API at `http://127.0.0.1:8787` first and falls back to local JSONL samples if the API is not running. You can point it to another API base with `precedent-search.html?api=http://127.0.0.1:8787`.

Analyze a normalized or text-enriched JSONL file:

```bash
node scripts/analyze-decisions.mjs --input data/index/edrsr-2026.sample.text.jsonl
node scripts/analyze-decisions.mjs --input data/index/edrsr-2026.sample.text.jsonl --article "КАС України:333" --json
```

The analysis command supports the same practical filters as search and reports distributions by outcome, year, region, court level, court, article, plus outcome pivots by year and region.

Open `precedent-search.html` through a local static server to let the browser load JSONL data. The page tries `data/index/edrsr-2026.first20.text.jsonl` first and falls back to `data/sample/edrsr-sample.jsonl`.
