# EDRSR Ingestion Plan

This document turns the precedent-search concept into a technical pipeline.

## Current Source Signals

Official data.gov.ua pages exist for yearly EDRSR datasets, including 2026:

- dataset page: `https://data.gov.ua/dataset/ediniy-derzhavniy-reestr-sudovih-rishen-za-2026-rik_7636`
- resource: `edrsr_data_2026.zip`
- resource: `readme_2026.pdf`

The dataset description says it contains information about court decisions received by the Unified State Register of Court Decisions during the year.

The open-data description states that open data may be copied, published, distributed, used commercially, combined with other information, or included in a product, with mandatory source attribution. We still verify terms per dataset before production ingestion.

## Goal

Build a pipeline that supports:

- article/norm search;
- keyword search;
- region and court filters;
- date filters;
- decision type filters;
- outcome/result filters;
- official source links;
- analytics over result distribution.

## Dataset Shape

The initial schema mapping is now captured in `docs/edrsr-schema-mapping.md`.

The archive appears to contain:

- `documents.csv` as the main decision metadata file;
- `cause_categories.csv`;
- `courts.csv`;
- `instances.csv`;
- `judgment_forms.csv`;
- `justice_kinds.csv`;
- `regions.csv`.

Key `documents.csv` fields identified from the readme:

- `doc_id`;
- `court_code`;
- `justice_kind`;
- `judgment_code`;
- `category_code`;
- `cause_num`;
- `adjudication_date`;
- `receipt_date`;
- `judge`;
- `doc_url`;
- `status`;
- `date_publ`.

## Normalized Decision Record

Use this internal shape:

```json
{
  "decision_id": "string",
  "source_url": "string",
  "source_dataset": "edrsr_data_2026",
  "case_number": "string",
  "proceeding_number": "string",
  "court_name": "string",
  "court_region": "string",
  "court_level": "string",
  "decision_date": "YYYY-MM-DD",
  "registration_date": "YYYY-MM-DD",
  "proceeding_type": "civil|criminal|commercial|administrative|administrative-offense|unknown",
  "decision_type": "rishennia|postanova|uhvala|vyrok|unknown",
  "text": "string",
  "cited_articles": ["string"],
  "cited_laws": ["string"],
  "outcome_label": "satisfied|dismissed|partially_satisfied|cancelled|changed|remanded|closed|unknown",
  "outcome_confidence": 0.0,
  "key_excerpts": ["string"],
  "source_attribution": "string",
  "indexed_at": "ISO datetime"
}
```

## Pipeline

### 1. Source Audit

Tasks:

- read dataset page;
- download/read readme;
- record license and attribution;
- record file size;
- record schema;
- record update cadence;
- flag personal-data concerns.

Output:

- updated `docs/source-cards/edrsr-open-data.md`;
- updated `docs/registry-matrix.md`.

### 2. Sample Load

Tasks:

- load 100-1000 decisions from the dataset;
- convert to normalized JSONL;
- store only safe test samples or synthetic samples in repo;
- keep real bulk data outside git.

Output:

- local `data/raw/` ignored in future;
- sample JSONL for development if non-sensitive or synthetic.

### 3. Text And Metadata Normalization

Tasks:

- normalize dates;
- normalize court names;
- map regions;
- normalize decision types;
- clean HTML/text;
- preserve official source URL.

### 4. Legal Norm Extraction

Tasks:

- detect patterns such as `ст. 625 ЦК`, `статті 130 КУпАП`, `ч. 1 ст. 286 КК`;
- normalize code/law names;
- store extracted articles;
- keep text excerpts around matches.

### 5. Outcome Labeling

Start rule-based:

- "позов задовольнити" -> `satisfied`;
- "у задоволенні позову відмовити" -> `dismissed`;
- "задовольнити частково" -> `partially_satisfied`;
- "скасувати" -> `cancelled`;
- "змінити" -> `changed`;
- "направити на новий розгляд" -> `remanded`;
- "провадження закрити" -> `closed`.

Then validate and improve with model-assisted classification.

Every label gets:

- confidence;
- matching excerpt;
- manual-verification flag when uncertain.

### 6. Search Index

First local prototype:

- JSONL load;
- in-memory filtering;
- keyword matching;
- article matching;
- outcome and region filters;
- summary counts.

Production direction:

- PostgreSQL for metadata;
- OpenSearch/Meilisearch/Postgres FTS for text search;
- embeddings/vector search for semantic similarity;
- reranking for legal relevance.

### 7. UI Integration

Use `precedent-search.html` as first interface model:

- article input;
- keyword input;
- region;
- court level;
- date range;
- decision type;
- outcome;
- analytics summary;
- decision cards.

## Local Prototype

Use:

```bash
node scripts/search-sample.mjs --article "625 ЦК" --region "Київ" --outcome satisfied
```

This uses synthetic sample data in `data/sample/edrsr-sample.jsonl`.

Normalize a small extracted EDRSR directory:

```bash
node scripts/normalize-edrsr.mjs --input data/raw/edrsr_2026 --output data/index/edrsr-2026.sample.jsonl --limit 100 --dataset edrsr_data_2026
```

Then search the normalized JSONL:

```bash
node scripts/search-sample.mjs --input data/index/edrsr-2026.sample.jsonl --article "625 ЦК"
```

The repository also contains a synthetic CSV fixture in `data/sample/edrsr-csv-fixture/` that follows the real open-data schema but does not contain real court decisions.

## Do Not Commit

- downloaded full archives;
- extracted full datasets;
- personal-data-heavy raw data;
- private user documents;
- generated indexes larger than small development samples.

## Next Steps

1. Verify `readme_2026.pdf`.
2. Add `.gitignore` for raw data and indexes.
3. Create real schema mapping from readme.
4. Download a small sample outside git.
5. Convert sample to normalized JSONL with `scripts/normalize-edrsr.mjs`.
6. Compare synthetic prototype with real sample.
