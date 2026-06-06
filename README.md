# Codex Sud

Working repository for a Ukrainian legal technology platform.

## Current Prototype

Static pages:

- `index.html` - public product start page.
- `precedent-search.html` - precedent/case-law search concept.
- `case-status.html` - user-driven case status flow for `court.gov.ua/fair/`.
- `registries.html` - registry intelligence catalog concept.

## Project Memory

- `LEGAL_PLATFORM_ROADMAP.md` - long strategic roadmap.
- `AGENTS.md` - Codex/project working rules.
- `docs/mvp-plan.md` - small-start MVP plan.
- `docs/precedent-search-design.md` - legal-practice search design.
- `docs/edrsr-ingestion-plan.md` - ingestion/search pipeline plan.
- `docs/registry-matrix.md` - registry source matrix.

## Local Sample Search

The repository contains a synthetic sample dataset only. It is not real court data.

Run:

```bash
node scripts/search-sample.mjs --article "625 ЦК" --region "Київ"
```

JSON output:

```bash
node scripts/search-sample.mjs --article "130 КУпАП" --outcome remanded --json
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
- `--json`

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
