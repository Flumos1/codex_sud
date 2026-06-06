# Registry Matrix

This document tracks candidate registries and data sources for the future `Registry Intelligence` module.

Status values:

- `candidate` - identified but not reviewed.
- `researching` - source is being checked.
- `safe-open-data` - likely suitable for first integration.
- `manual-link-only` - useful as a link/instruction, not automated.
- `official-api-needed` - integration requires official API/access.
- `needs-legal-review` - uncertain terms, personal data, or sensitive use.
- `blocked` - unsuitable for now.

## Matrix Template

| Source | Official URL | Owner | Data Type | Access Mode | API/Dataset | Personal Data Risk | Commercial Use | Storage | Status | Product Use |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Example | https://example.gov.ua | Authority | Companies | Open data/API/manual | TBD | Low/Medium/High | TBD | TBD | candidate | Counterparty check |

## Initial Candidate Sources

| Source | Official URL | Owner | Data Type | Access Mode | API/Dataset | Personal Data Risk | Commercial Use | Storage | Status | Product Use |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ЄДР юридичних осіб, ФОП та громадських формувань | TBD | Ministry of Justice / official holder | Companies and FOP | TBD | TBD | Medium | TBD | TBD | candidate | Company/FOP profile, counterparty check |
| Єдиний реєстр боржників | TBD | Ministry of Justice / official holder | Debtors | TBD | TBD | High | TBD | TBD | needs-legal-review | Debt and enforcement risk |
| Автоматизована система виконавчого провадження | TBD | Ministry of Justice / official holder | Enforcement proceedings | TBD | TBD | High | TBD | TBD | needs-legal-review | Enforcement status |
| Єдиний державний реєстр судових рішень | https://reyestr.court.gov.ua/ / data.gov.ua yearly datasets | Judiciary / DSA-related source | Court decisions | Official open-data datasets plus official review pages | Yearly datasets to verify per year | Medium | Open-data terms indicate commercial use with attribution; verify per dataset | Store indexed decisions with source attribution if terms confirmed | researching | Precedent search, article-based practice analysis, case-law search |
| Стан розгляду справ | https://court.gov.ua/fair/ | Judiciary | Case status | Captcha-protected web search; supporting court-directory endpoints found | No direct automation for main search | High | Limited / needs terms review | Store only user-entered metadata in first version | manual-link-only | User-driven case status check; manual case card; reminders |
| ProZorro | TBD | Public procurement ecosystem | Procurement | TBD | TBD | Low/Medium | TBD | TBD | candidate | Procurement participation and risk |
| Sanctions lists | TBD | Official sanctions source | Sanctions | TBD | TBD | Medium | TBD | TBD | candidate | Sanction screening |
| Bankruptcy / insolvency data | TBD | Official source | Insolvency | TBD | TBD | Medium/High | TBD | TBD | candidate | Counterparty risk |
| License and permit registries | TBD | Multiple authorities | Licenses | TBD | TBD | Low/Medium | TBD | TBD | candidate | Business compliance check |
| Notary registry | TBD | Official source | Professionals | TBD | TBD | Medium | TBD | TBD | candidate | Professional verification |
| Court expert registry | TBD | Official source | Professionals | TBD | TBD | Medium | TBD | TBD | candidate | Expert verification |

## First Small Goal

Create a public page that lists useful official registries with:

- what it checks;
- who owns it;
- official link;
- whether it is free;
- whether it appears automatable;
- whether we need legal review before integration.

Then choose 3-5 sources for a first safe prototype.

## First Prototype Report

Working name:

> Legal check in 60 seconds

Possible report sections:

- searched entity;
- matched sources;
- court-practice links;
- debt/enforcement signals;
- sanctions/procurement signals;
- source links;
- update dates;
- risk notes;
- "needs manual verification" flags.
