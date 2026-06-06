# EDRSR Real Data Smoke Test

Last run: 2026-06-06

This document records the first local check against real EDRSR 2026 data. It intentionally does not include raw court-decision text or generated indexes.

## Source

- Dataset: `edrsr_data_2026.zip` from data.gov.ua.
- ZIP size observed locally: 170,926,557 bytes.
- Extracted `documents.csv` size observed locally: 889,217,403 bytes.

Archive files observed:

- `documents.csv`
- `courts.csv`
- `regions.csv`
- `instances.csv`
- `judgment_forms.csv`
- `justice_kinds.csv`
- `cause_categories.csv`

## Commands Used

Normalize first 100 metadata rows:

```bash
node scripts/normalize-edrsr.mjs --input data/raw/edrsr_2026 --output data/index/edrsr-2026.first100.jsonl --limit 100 --dataset edrsr_data_2026
```

Enrich first 20 rows with official RTF text:

```bash
node scripts/enrich-edrsr-text.mjs --input data/index/edrsr-2026.first100.jsonl --output data/index/edrsr-2026.first20.text.jsonl --limit 20 --cache data/raw/edrsr-rtf-cache --delay-ms 300
```

Analyze the enriched sample:

```bash
node scripts/analyze-decisions.mjs --input data/index/edrsr-2026.first20.text.jsonl
```

Search by article and outcome:

```bash
node scripts/search-sample.mjs --input data/index/edrsr-2026.first20.text.jsonl --article "311 КАС" --outcome appeal_dismissed --json
```

Search by normalized article key:

```bash
node scripts/search-sample.mjs --input data/index/edrsr-2026.first20.text.jsonl --article "КАС України:311" --outcome appeal_dismissed --json
```

## Observed Results

For the first 20 metadata rows:

- text coverage: 17/20, or 85%;
- article extraction coverage: 17/20, or 85%;
- outcome coverage after conservative dispositive-part rules: 2/20, or 10%;
- text status after local cached rerun: 17 `cached`, 3 `missing_url`;
- date range: 2025-12-30 to 2025-12-31;
- regions: `м. Київ` and `Житомирська область`;
- court levels: `Касаційна`, `Апеляційна`, `Перша`;
- decision types: mostly `Ухвала`, with 2 `Постанова`.

Top extracted articles in this small administrative-law slice included:

- `328 КАС України`;
- `333 КАС України`;
- `13 КАС України`;
- `311 КАС України`;
- `330 КАС України`;
- `332 КАС України`;
- `341 КАС України`.

The article/outcome search found 2 real decisions for:

- article: `КАС України:311`;
- outcome: `appeal_dismissed`.

The local UI prototype at `precedent-search.html` can load `data/index/edrsr-2026.first20.text.jsonl` when served through a local HTTP server. The same filter found case numbers `320/5009/25` and `320/3913/24`.

## Important Findings

`documents.csv` contains metadata and official `doc_url` values, not full decision text.

For `status=1` rows, `doc_url` can point to an official `.rtf` file that is downloadable without the `court.gov.ua/fair/` captcha flow.

In this sample, 3 rows had `status=0` and empty `doc_url`, so no text could be fetched. The product should preserve these rows as metadata-only records and exclude them from text/article/outcome analytics unless text becomes available.

Outcome classification must be based primarily on the dispositive/resolution part of the decision (`ПОСТАНОВИЛА`, `УХВАЛИЛА`, etc.). Searching the whole text can misclassify party requests such as "скасувати рішення" as the court's actual outcome.

## Next Engineering Steps

1. Split article extraction into normalized law/article fields, so `328 КАС України` and `328 Кодексу адміністративного судочинства України` are treated as the same norm.
2. Expand outcome rules by decision type and court level.
3. Add a small UI/data bridge so `precedent-search.html` can load a local JSONL/JSON sample during development.
4. Move duplicated article/outcome helpers from scripts into a shared local module.
