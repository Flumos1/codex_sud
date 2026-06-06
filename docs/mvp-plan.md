# MVP Plan

This document translates the long roadmap into a small, practical start.

## Goal

Build the first useful public version of the legal platform without overbuilding:

- explain the product vision;
- collect demand from citizens, lawyers, and businesses;
- create a foundation for legal research;
- add a small registry intelligence layer;
- prepare for the first working MVP.

## Phase 1: Public Site Foundation

Deliverables:

- home page;
- page for citizens;
- page for lawyers;
- page for business;
- court-practice page;
- AI assistant concept page;
- documents concept page;
- state registries/checks page;
- early access form;
- lawyer partner form;
- registry-check request form;
- privacy policy draft;
- terms/disclaimer draft.

Success signals:

- people submit legal problems;
- lawyers ask for access;
- users request registry checks;
- clear topics emerge from demand.

## Phase 2: Registry Matrix And Public Catalog

Deliverables:

- fill 20-30 registry rows in `docs/registry-matrix.md`;
- mark each source by access mode and risk;
- publish a user-friendly catalog page;
- choose 3-5 safe first checks.
- create the first detailed source card for `court.gov.ua/fair/`.

First likely checks:

- court case status via `court.gov.ua/fair/` as a manual user-driven flow;
- company/FOP;
- court decisions and case links;
- debt/enforcement;
- sanctions;
- public procurement.

Success signals:

- users understand where to check legal risk;
- we know which sources are safe to integrate;
- we identify which checks users value most.

## Phase 3: Court Practice Search Prototype

Deliverables:

- confirm lawful court-decision data source;
- ingest a small sample;
- build keyword search;
- build article/legal-norm search;
- add region, court, date, decision type, and outcome filters;
- build decision card;
- add outcome/result labels with confidence and manual verification;
- add practice analytics summary;
- show official source link;
- save selected decisions.

Success signals:

- a lawyer finds useful decisions faster than manual search;
- result relevance is acceptable;
- source links are trusted.
- a lawyer can compare positive and negative practice by criteria.

## Phase 4: AI Summary And Legal Memo Prototype

Deliverables:

- summary of a court decision;
- facts, court position, result, norms;
- citations/source references;
- simple legal memo from selected decisions;
- uncertainty and source warnings.

Success signals:

- lawyers say the memo saves time;
- citations are verifiable;
- hallucinations are caught or reduced.

## Phase 5: First Document Tools

Deliverables:

- one citizen-friendly document flow;
- one lawyer-oriented document flow;
- structured questionnaire;
- generated DOCX/PDF export;
- basic document checklist.

Candidate documents:

- debt claim/pre-claim notice;
- motion;
- attorney request;
- simple statement/complaint.

## Not In The First MVP

- full marketplace;
- payments;
- complex subscriptions;
- complete registry integrations;
- automated access to protected searches;
- deep judge analytics;
- full personal cabinet;
- sensitive document storage at scale.

## Immediate Next Steps

1. Choose working name.
2. Choose first language strategy: Ukrainian-first, with Russian support if needed.
3. Create first site structure.
4. Fill registry matrix with official URLs.
5. Pick the first 3-5 legal topics.
6. Pick first data source for court decisions.
7. Decide the stack for the first website.
