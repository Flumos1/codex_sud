# EDRSR 2026 Schema Mapping

Source:

- data.gov.ua dataset page: https://data.gov.ua/dataset/ediniy-derzhavniy-reestr-sudovih-rishen-za-2026-rik_7636
- readme resource: `readme_2026.pdf`
- archive resource: `edrsr_data_2026.zip`

Last reviewed: 2026-06-06

## Extraction Note

The official PDF readme is encoded with embedded PDF CMaps. Local extraction was partial but enough to identify the main archive structure and field names. Before production ingestion, confirm this mapping against the PDF manually and by inspecting the real CSV archive.

## Archive Structure

The archive `edrsr_data_<year>.zip` contains CSV files encoded as UTF-8 with quoting.

Main data file:

- `documents.csv`

Dictionaries:

- `cause_categories.csv`
- `courts.csv`
- `instances.csv`
- `judgment_forms.csv`
- `justice_kinds.csv`
- `regions.csv`

## documents.csv

Fields identified from readme:

| Source Field | Meaning | Internal Field | Notes |
| --- | --- | --- | --- |
| `doc_id` | Unique EDRSR decision identifier | `decision_id` | Primary source identifier. |
| `court_code` | Court code | join to `courts.csv` -> `court_name`, `court_region`, `court_level` | Store original code too. |
| `justice_kind` | Justice/proceeding kind code | join to `justice_kinds.csv` -> `proceeding_type` | Examples need real dictionary. |
| `judgment_code` | Judgment/decision form code | join to `judgment_forms.csv` -> `decision_type` | Maps to rishennia/postanova/uhvala/vyrok/etc. |
| `category_code` | Case category code | join to `cause_categories.csv` | Useful for legal area filters. |
| `cause_num` | Case number | `case_number` | Main case identifier. |
| `adjudication_date` | Decision/adjudication date | `decision_date` | Normalize to ISO date. |
| `receipt_date` | Date received by register | `registration_date` or `receipt_date` | Keep both if later schema requires. |
| `judge` | Judge name | `judge_names` | Personal-data/privacy review needed for analytics. |
| `doc_url` | URL to EDRSR/public document page | `source_url` | Required for attribution and verification. |
| `status` | Publication/status flag | `status` | Readme indicates `1` and `0` values; exact meaning to verify. |
| `date_publ` | Publication date | `publication_date` | Especially relevant when `status=1`; exact rule to verify. |

## cause_categories.csv

| Source Field | Meaning | Internal Use |
| --- | --- | --- |
| `category_code` | Category code | Join from `documents.csv.category_code`. |
| `name` | Category name | Legal category / case category filter. |

## courts.csv

| Source Field | Meaning | Internal Use |
| --- | --- | --- |
| `court_code` | Court code | Join from `documents.csv.court_code`. |
| `name` | Court name | `court_name`. |
| `instance_code` | Instance code | Join to `instances.csv`. |
| `region_code` | Region code | Join to `regions.csv`. |

## instances.csv

| Source Field | Meaning | Internal Use |
| --- | --- | --- |
| `instance_code` | Court instance code | Join from `courts.csv.instance_code`. |
| `name` | Instance name | `court_level` / instance filter. |

## judgment_forms.csv

| Source Field | Meaning | Internal Use |
| --- | --- | --- |
| `judgment_code` | Judgment form code | Join from `documents.csv.judgment_code`. |
| `name` | Judgment form name | `decision_type`. |

## justice_kinds.csv

| Source Field | Meaning | Internal Use |
| --- | --- | --- |
| `justice_kind` | Justice kind code | Join from `documents.csv.justice_kind`. |
| `name` | Justice kind name | `proceeding_type` / proceeding filter. |

## regions.csv

| Source Field | Meaning | Internal Use |
| --- | --- | --- |
| `region_code` | Region code | Join from `courts.csv.region_code`. |
| `name` | Region name | `court_region`. |

## Internal Normalized Mapping

Minimum viable mapping:

```json
{
  "decision_id": "documents.doc_id",
  "source_url": "documents.doc_url",
  "source_dataset": "edrsr_data_2026",
  "case_number": "documents.cause_num",
  "court_name": "courts.name",
  "court_region": "regions.name",
  "court_level": "instances.name",
  "decision_date": "documents.adjudication_date",
  "registration_date": "documents.receipt_date",
  "publication_date": "documents.date_publ",
  "proceeding_type": "justice_kinds.name",
  "decision_type": "judgment_forms.name",
  "category": "cause_categories.name",
  "judge_names": "documents.judge",
  "status": "documents.status",
  "text": "fetch or parse from documents.doc_url / archive content if available",
  "cited_articles": "derived",
  "outcome_label": "derived",
  "outcome_confidence": "derived"
}
```

## Important Open Questions

1. Does `documents.csv` contain full decision text or only URL/metadata?
2. Does `doc_url` point to the text page or to a static open-data HTML document?
3. What exactly do `status=1` and `status=0` mean?
4. Is `date_publ` empty or meaningful for unpublished/removed decisions?
5. Are removed/unpublished decisions included and how should they be handled?
6. What are the real dictionary values for judgment forms and justice kinds?
7. What is the exact archive delimiter and quote behavior?
8. Can full text be downloaded in bulk from the archive, or must it be resolved by URL?

## First Real Ingestion Target

For a safe real sample:

1. Download `edrsr_data_2026.zip` outside git into `data/raw/`.
2. Inspect archive file list.
3. Read first 100 rows of `documents.csv`.
4. Read dictionary CSV files.
5. Join court, region, instance, judgment form, justice kind, and category.
6. Normalize to JSONL.
7. Do not commit raw rows until privacy and licensing are confirmed.

Real inspection on 2026-06-06 confirmed that `documents.csv` stores metadata and `doc_url` values pointing to official `.rtf` files, not full text inside the CSV. Text ingestion therefore needs a second stage that downloads/caches RTF files and extracts plain text before article extraction and outcome classification.

Local normalization command:

```bash
node scripts/normalize-edrsr.mjs --input data/raw/edrsr_2026 --output data/index/edrsr-2026.sample.jsonl --limit 100 --dataset edrsr_data_2026
```

## Mapping To Search UI

| UI Filter | Source / Derived Field |
| --- | --- |
| Article / norm | Derived from text or metadata if present. |
| Context keywords | Full text, category, court, excerpts. |
| Region | `regions.name`. |
| Court | `courts.name`. |
| Instance | `instances.name`. |
| Date range | `documents.adjudication_date`. |
| Decision type | `judgment_forms.name`. |
| Result / outcome | Derived from decision text. |
| Legal category | `cause_categories.name`. |
