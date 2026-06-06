# Data Source Policy

This project depends on legal data, court decisions, public registers, ECHR practice, and future user documents. Data handling must be conservative and source-aware from the beginning.

## Core Rules

1. Prefer official sources.
2. Prefer open data, official APIs, published datasets, or user-driven access.
3. Do not bypass captcha, paywalls, authentication, robots restrictions, or clear anti-automation measures.
4. Always record the source URL and access method.
5. Always record whether commercial use, storage, redistribution, and automated access appear allowed.
6. Treat personal data as sensitive even when it appears in public registers.
7. If uncertain, mark the source as `needs legal review`.

## Source Categories

### Open Data

Examples:

- data.gov.ua datasets;
- official downloadable datasets;
- official machine-readable public data.

Potential use:

- indexing;
- search;
- analytics;
- reports;
- commercial features if the dataset terms permit it.

Required checks:

- license or legal basis;
- attribution requirements;
- update cadence;
- personal-data content;
- redistribution limits.

### Official API

Potential use:

- real-time checks;
- monitoring;
- user reports;
- integrations.

Required checks:

- API terms;
- authentication;
- rate limits;
- pricing;
- data retention rules;
- allowed commercial use.

### Public Web Page

Potential use:

- manual user navigation;
- source reference;
- limited page lookup where terms permit.

Required checks:

- terms of use;
- robots policy;
- anti-automation signals;
- captcha or user verification;
- whether the page is meant for bulk access.

Important:

Public visibility does not automatically mean bulk collection, storage, or resale is allowed.

### User-Driven Flow

Potential use:

- user enters data and follows official flow;
- user passes captcha or authentication themselves;
- platform provides guidance and stores only user-approved results.

Required checks:

- consent;
- data minimization;
- secure storage;
- retention policy;
- audit log.

## Registry Source Card Fields

Every registry should eventually have:

- name;
- official URL;
- owner/maintainer;
- data type;
- jurisdiction;
- access mode;
- API or dataset URL;
- update cadence;
- license/terms;
- attribution requirement;
- commercial-use note;
- storage note;
- personal-data risk;
- captcha/auth/payment;
- allowed product scenarios;
- integration status;
- risk status;
- review date.

## AI Use Rules

- AI answers must be grounded in retrieved source material.
- Show citations or source links.
- Do not present generated text as verified legal advice.
- Mark uncertainty.
- For legal memos, separate facts, law, practice, inference, and recommendation.
- For registry checks, show source and update date.

## Initial Safe Direction

Start with:

- official court-decision open data;
- official public links to decisions;
- registry matrix;
- a public registry catalog;
- 3-5 safe checks based on sources with clear access terms.

Avoid at first:

- scraping protected searches;
- storing personal data from many registries;
- automated access to captcha-protected forms;
- claims that risk scoring is definitive.
