# Precedent Search Design

This module is the heart of the future legal-research product.

It answers the user's correction:

> Not just check one case, but find all relevant cases by criteria, read them, compare outcomes, and understand how courts react.

## Core Distinction

`court.gov.ua/fair/`:

- best for checking the status of a known case;
- user-driven flow;
- captcha-protected;
- not suitable for automated precedent search.

EDRSR open data / court-decision corpus:

- best for precedent search;
- suitable for indexing if dataset terms allow;
- supports analytics, comparisons, legal memo, and AI summaries.

## Main User Story

As a lawyer, I want to select a legal article or describe a legal issue, filter by region/court/date/result, and see all relevant decisions, so that I can evaluate judicial practice and choose litigation strategy.

## Search Inputs

Required or primary:

- article / legal norm;
- keywords or legal issue;
- date range;
- region: all Ukraine or selected oblast;
- court level;
- decision type;
- result/outcome.

Advanced:

- court name;
- judge;
- proceeding type;
- party role;
- claim subject;
- amount range;
- cited law;
- semantic query;
- "find similar to this decision".

## Result Views

### List View

Each decision card should show:

- case number;
- court;
- date;
- decision type;
- outcome label;
- matching article/norm;
- relevant excerpt;
- official source link;
- save button.

Development prototype:

- `precedent-search.html` tries to load local real-data JSONL from `data/index/edrsr-2026.first20.text.jsonl`;
- if the local real-data file is absent, it falls back to `data/sample/edrsr-sample.jsonl`;
- article filters can use normalized keys such as `КАС України:311`.

### Analytics View

Show:

- total matches;
- outcome distribution;
- region distribution;
- court-level distribution;
- timeline trend;
- top cited norms;
- common arguments accepted/rejected.

### Strategy View

Show:

- strongest supporting decisions;
- contrary practice;
- factual patterns that mattered;
- evidence that mattered;
- risks and uncertainty;
- suggested argument structure.

## Outcome Labels

Civil/commercial/admin examples:

- satisfied;
- dismissed;
- partially satisfied;
- returned/left without movement;
- proceeding closed;
- appeal granted;
- appeal dismissed;
- decision left unchanged;
- cassation granted;
- cassation dismissed;
- remanded.

Criminal examples:

- conviction upheld;
- acquittal;
- sentence changed;
- sentence cancelled;
- remanded;
- proceeding closed.

All labels need confidence scores and manual verification.

## Retrieval Pipeline

1. Ingest official open-data decisions.
2. Normalize metadata.
3. Extract full text.
4. Extract legal norms/articles.
5. Detect decision type and proceeding type.
6. Classify outcome.
7. Generate embeddings.
8. Index structured fields and text.
9. Return keyword + semantic matches.
10. Rerank results by legal relevance.
11. Display excerpts and official links.

## MVP Scope

Start with one legal area and one year/sample.

MVP features:

- article input;
- keyword input;
- region selector;
- date range;
- decision type;
- result/outcome selector;
- mock analytics summary;
- saved decisions;
- official source links;
- warning about verification.

Avoid at first:

- predicting case outcome as a promise;
- full judge scoring;
- hidden scraping;
- storing unnecessary personal data;
- unsupported legal conclusions.

## Product Value

This is the feature that can make lawyers pay:

- faster precedent discovery;
- less manual reading;
- better argument selection;
- ability to see positive and negative practice;
- better client expectation management;
- stronger legal memo and document drafting.
