# AGENTS.md

## Project Context

We are building a Ukrainian legal technology platform that starts as a focused website and grows into a full Legal OS:

- legal research over Ukrainian court decisions;
- ECHR and Supreme Court practice;
- AI legal assistant with verifiable sources;
- document generation and document review;
- matter management, deadlines, evidence, timelines;
- registry intelligence over lawful public/open data;
- client and lawyer accounts;
- internal communication;
- future marketplace for legal help.

The main strategic source is `LEGAL_PLATFORM_ROADMAP.md`.

## Mission

Make law understandable, accessible, and practically useful: from finding judicial practice to preparing documents, managing matters, checking registries, and connecting people with legal professionals.

## Product Principles

1. Trust is more important than flash.
2. Every legal claim should be grounded in sources, quotes, or clear uncertainty.
3. AI must assist lawyers and citizens, not pretend to replace professional legal judgment.
4. For citizens, use clear human language.
5. For lawyers, keep workflows fast, dense, and precise.
6. Handle documents and personal data as sensitive data.
7. Build in stages: useful tool first, workspace second, marketplace later.
8. Do not bypass captcha, access controls, paywalls, or terms of use.
9. For registries, distinguish open data from merely public web pages.
10. Prefer official sources, official APIs, data.gov.ua, lawful datasets, and user-driven flows.

## Default Working Roles

When useful, think through tasks using these roles:

- Product Strategist: roadmap, MVP, value, monetization, market.
- Legal Data Researcher: court data, ECHR, registries, source access.
- Legal Safety Reviewer: privacy, source terms, AI risk, disclaimers.
- UX Architect: site structure, dashboards, citizen/lawyer journeys.
- Fullstack Engineer: implementation, architecture, tests, deployment.
- AI/RAG Engineer: search, embeddings, citations, source verification.
- Growth/SEO Agent: guides, landing pages, acquisition, content structure.

Do not create separate agents unless the user asks. Use these roles as a thinking and review framework.

## Source And Data Rules

- Use official sources wherever possible.
- For each registry or dataset, record source URL, owner, data type, access mode, update cadence, legal constraints, personal-data risk, storage rules, and commercial-use notes.
- Do not scrape protected searches where captcha or access controls indicate automation is not intended.
- Do not store personal data unless the product has a clear purpose, legal basis, minimization rule, retention rule, and access controls.
- Always preserve source attribution for legal and registry data.
- For uncertain legal/data rights, mark the source as "needs legal review" instead of building on it.

## Engineering Rules

- Keep changes small and tied to the roadmap.
- Prefer markdown docs for strategy, then code once scope is stable.
- Use existing repo structure before adding new patterns.
- When building the app, favor a modern web stack suitable for staged growth, likely Next.js + PostgreSQL + search/vector layer.
- Add tests as soon as behavior or data processing appears.
- Never commit secrets, tokens, credentials, downloaded private documents, or sensitive test data.

## Repository Documentation Map

- `LEGAL_PLATFORM_ROADMAP.md` - strategic roadmap and long-form project memory.
- `docs/agents.md` - working roles and how to use them.
- `docs/data-source-policy.md` - source, registry, and privacy rules.
- `docs/registry-matrix.md` - template and initial registry matrix.
- `docs/mvp-plan.md` - immediate small-start execution plan.

## Commit Style

Use concise commits that explain the product or technical change:

- `Add registry intelligence plan`
- `Create project agent guidelines`
- `Add registry matrix template`
- `Scaffold public site`

Before pushing, check `git status --short --branch`.
