# Source Card: EDRSR Open Data

Source examples:

- https://dsa.court.gov.ua/dsa/inshe/oddata/7636/
- https://data.gov.ua/dataset/ediniy-derzhavniy-reestr-sudovih-rishen-za-2026-rik_7636
- https://reyestr.court.gov.ua/

Working name: Court Decision Corpus / Єдиний державний реєстр судових рішень

Status: `researching` for ingestion, likely primary source for precedent search if dataset terms are confirmed.

Last reviewed: 2026-06-06

Related technical mapping:

- `docs/edrsr-schema-mapping.md`
- `docs/edrsr-ingestion-plan.md`

## Why This Source Matters

This is the source for the real precedent-search feature:

- search many decisions by article, legal issue, region, court, date, decision type, and result;
- compare judicial reactions across regions and courts;
- find positive and negative practice;
- build legal arguments from similar cases;
- generate legal memo with citations.

`court.gov.ua/fair/` is useful for a specific case status, but it is not the right source for bulk precedent analysis because the search flow is protected by reCAPTCHA and is designed as a user-facing official lookup.

## Confirmed Public Signals

Official open-data pages for EDRSR yearly datasets describe the dataset as containing court decisions received by EDRSR during the year.

The 2026 dataset page states that the current-year dataset is updated once per day. On 2026-06-06, the data.gov.ua resource page showed `edrsr_data_2026.zip` as a ZIP resource last updated on 2026-06-06.

The 2026 dataset pages state that open data may be copied, published, distributed, used commercially, combined with other information, or included in a product, with mandatory source attribution. This must still be checked per dataset and preserved in the product.

## Product Use Cases

### Article-Based Search

User selects or types:

- legal article;
- code/law;
- keywords;
- date range;
- region or all Ukraine;
- court level;
- decision type;
- desired result.

The system returns:

- matching decisions;
- result distribution;
- courts and regions where similar arguments worked or failed;
- relevant excerpts;
- links to official sources;
- similar and opposite practice.

### Strategy Analysis

For a legal position, the system should answer:

- how courts usually react;
- what facts mattered;
- what evidence was decisive;
- which arguments were rejected;
- where practice differs by region or instance;
- which decisions are strongest for citation.

### Outcome Classification

The system should classify or assist classification:

- claim satisfied;
- claim dismissed;
- partially satisfied;
- appeal granted;
- appeal dismissed;
- judgment cancelled;
- sentence upheld;
- sentence changed;
- sentence cancelled;
- remanded for new trial;
- proceeding closed;
- other/uncertain.

Classification must be auditable and source-grounded.

## Proposed Data Model

Decision:

- decision_id;
- source_url;
- source_dataset;
- case_number;
- proceeding_number;
- court_name;
- court_region;
- court_level;
- judge_names, if available and lawful;
- decision_date;
- registration_date;
- legal_area;
- proceeding_type;
- decision_type;
- text;
- anonymized_parties_text;
- cited_articles;
- cited_laws;
- outcome_label;
- outcome_confidence;
- key_excerpts;
- source_attribution;
- indexed_at.

Search facets:

- article;
- law/code;
- region;
- court;
- court level;
- date range;
- proceeding type;
- decision type;
- outcome;
- keywords;
- semantic query.

## Technical Approach

1. Confirm lawful dataset source and download method.
2. Confirm schema from `readme_2026.pdf`.
3. Parse a small sample first.
4. Normalize metadata from `documents.csv` and dictionaries.
5. Confirm how full text is obtained: directly from archive or through `doc_url`.
6. Build keyword search.
7. Add article extraction.
8. Add outcome classification.
9. Add semantic search.
10. Add legal memo generation only after retrieval quality is acceptable.

Recommended search approach:

- PostgreSQL for structured metadata;
- full-text search or OpenSearch/Meilisearch for keyword and filters;
- embeddings/vector search for semantic similarity;
- reranking for legal relevance;
- citations and excerpts stored with decision references.

## First Mini-MVP

Build a prototype page:

> Search judicial practice / Поиск судебной практики

Fields:

- article or legal norm;
- keywords;
- region;
- court;
- date range;
- decision type;
- outcome/result.

Output mock:

- result count;
- top matching decisions;
- outcome distribution;
- suggested legal arguments;
- official source links;
- "needs verification" note.

No need to ingest full data yet. First step is to define the interface and one small sample ingestion.

## Risks

- decisions are anonymized but may still contain sensitive context;
- article extraction may be noisy;
- outcome classification can be wrong without careful validation;
- regional analytics may be misunderstood as prediction;
- source terms must be checked per dataset;
- results must show uncertainty and source links.

## Next Research Tasks

1. Download/read the official readme for the selected dataset.
2. Inspect file format and fields.
3. Build a 100-1000 decision sample.
4. Test article extraction.
5. Test basic outcome labeling.
6. Define citation and excerpt display rules.
7. Decide which legal area to use first.
