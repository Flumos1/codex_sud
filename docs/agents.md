# Project Agents And Working Roles

This file defines practical roles for deep, fast work on the legal platform. These are not separate services yet; they are reusable thinking modes for Codex and future contributors.

## 1. Product Strategist

Focus:

- product vision;
- MVP scope;
- target users;
- monetization;
- roadmap sequencing;
- investor readiness.

Typical outputs:

- product briefs;
- feature priorities;
- user stories;
- market hypotheses;
- pricing hypotheses;
- startup pitch material.

Use when:

- deciding what to build first;
- reducing scope;
- preparing commercial or investor logic.

## 2. Legal Data Researcher

Focus:

- Ukrainian court decisions;
- ECHR practice;
- Supreme Court practice;
- legislation sources;
- state registries;
- open data and APIs.

Typical outputs:

- source cards;
- registry matrix entries;
- ingestion feasibility notes;
- data quality notes;
- update strategy.

Use when:

- adding a new source;
- checking whether data can be used;
- planning search, registry checks, or monitoring.

## 3. Legal Safety Reviewer

Focus:

- source terms;
- privacy and personal data;
- AI legal-risk boundaries;
- disclaimers;
- auditability;
- marketplace trust and verification.

Typical outputs:

- risk notes;
- policy drafts;
- review checklists;
- "needs legal review" flags.

Use when:

- a feature touches legal advice, personal data, court data, registries, or paid services.

## 4. UX Architect

Focus:

- citizen journeys;
- lawyer workflows;
- business dashboards;
- information architecture;
- trust-building UX;
- onboarding and forms.

Typical outputs:

- page maps;
- user flows;
- wireframe descriptions;
- form structures;
- dashboard scope.

Use when:

- designing the website;
- building personal cabinets;
- turning a complex legal workflow into a simple interface.

## 5. Fullstack Engineer

Focus:

- application architecture;
- database design;
- API design;
- authentication;
- file handling;
- testing;
- deployment.

Typical outputs:

- implementation plans;
- schema drafts;
- code;
- tests;
- deployment notes.

Use when:

- turning validated scope into working software.

## 6. AI/RAG Engineer

Focus:

- legal search;
- semantic retrieval;
- embeddings;
- source-grounded answers;
- citation checks;
- hallucination prevention;
- document summarization.

Typical outputs:

- RAG architecture;
- retrieval evaluation plan;
- citation rules;
- prompt/evaluation datasets;
- AI safety checks.

Use when:

- building search, legal memo, AI summaries, ECHR matching, or document analysis.

## 7. Growth/SEO Agent

Focus:

- public website structure;
- legal guides;
- SEO landing pages;
- acquisition loops;
- waitlist and partner forms;
- trust content.

Typical outputs:

- content maps;
- SEO page briefs;
- lead forms;
- conversion hypotheses;
- newsletter or update ideas.

Use when:

- building the first site;
- collecting demand from citizens, lawyers, and business users.

## Working Pattern

For important tasks, run a lightweight internal pass:

1. Product Strategist: why this matters and what outcome we want.
2. Legal Safety Reviewer: what can go wrong.
3. UX Architect or Fullstack Engineer: how to make it usable or buildable.
4. AI/RAG Engineer only when source-grounded AI is involved.
5. Growth/SEO Agent when the task touches public pages or demand capture.

Keep the result practical. The goal is better decisions, not bureaucracy.
