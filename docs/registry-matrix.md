# Registry Matrix

This document tracks candidate registries and data sources for the future `Registry Intelligence` module.

Last reviewed: 2026-06-11

## Status Values

- `candidate` - identified but not reviewed deeply.
- `researching` - source is being checked.
- `safe-open-data` - likely suitable for first integration if attribution and data-minimization rules are kept.
- `manual-link-only` - useful as an official link/instruction, not automated.
- `official-api-needed` - integration requires official API/access or a signed agreement.
- `needs-legal-review` - uncertain terms, sensitive personal data, or commercial-use/storage questions.
- `blocked` - unsuitable for now.

## Access Rules

- Prefer official open data, official APIs, or user-driven flows.
- Do not bypass captcha, access controls, login, paywalls, or anti-automation signals.
- Store only the fields needed for the product purpose.
- Preserve source attribution and source update dates in every report.
- For uncertain terms or personal-data exposure, keep the source as `needs-legal-review`.

## Matrix

| Source | Official URL | Owner | Data Type | Access Mode | API/Dataset | Personal Data Risk | Commercial Use | Storage | Status | Product Use |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ЄДР юридичних осіб, ФОП та громадських формувань | https://data.gov.ua/dataset/a1799820-195b-4982-8141-6e84f58103e7 | Ministry of Justice / NAIS | Companies, FOP, public organizations | Open data dataset | data.gov.ua dataset | Medium | Likely open-data reuse with attribution; verify dataset terms per resource | Store company snapshots with source date; avoid unnecessary personal data | safe-open-data | Company/FOP profile, counterparty identity check |
| Єдиний державний реєстр судових рішень | https://reyestr.court.gov.ua/ and data.gov.ua yearly datasets | Judiciary / DSA-related source | Court decisions | Official open-data datasets plus official review pages | Yearly ZIP datasets | Medium | Open-data reuse appears possible with attribution; verify per dataset | Store indexed decisions and excerpts with official links | researching | Precedent search, article-based practice analysis |
| Стан розгляду справ | https://court.gov.ua/fair/ | Judiciary | Case status | Captcha-protected web search | No backend automation for main search | High | Manual user flow only until official access is clarified | Store only user-entered case card fields | manual-link-only | User-driven case status check and reminders |
| Єдиний реєстр боржників | https://erb.minjust.gov.ua/ | Ministry of Justice | Debtor records | Public web search / open-data signals to verify | data.gov.ua listing exists; official access terms need review | High | Needs legal review due personal data and enforcement context | Prefer live lookup or minimal report reference; avoid bulk profiles at first | needs-legal-review | Debt/enforcement risk flag |
| Автоматизована система виконавчого провадження | https://asvpweb.minjust.gov.ua/ | Ministry of Justice | Enforcement proceedings | Public access with identifiers and protected flows | Official web access; API unclear | High | Needs legal review; individual access identifiers may be required | Store only user-provided proceeding metadata and links | manual-link-only | Enforcement status for a known proceeding |
| ProZorro public procurement | https://prozorro.gov.ua/openprocurement | Prozorro / public procurement ecosystem | Tenders, awards, contracts | Open data/API | OpenProcurement API/docs | Low/Medium | Official page says free reuse, including commercial use, with source attribution | Store procurement facts with tender IDs and source links | safe-open-data | Procurement history and supplier risk |
| ProZorro.Sale | https://prozorro.sale/opendata/ | Prozorro.Sale | Public auctions and sale contracts | Open data | Official open-data exports | Low/Medium | Official page allows reuse with source attribution | Store auction references and contract facts | safe-open-data | Asset sale participation and counterparty signals |
| Державний реєстр санкцій | https://drs.nsdc.gov.ua/ | NSDC Apparatus | Sanctioned persons/entities/assets | Public official register | Public search/extract; API unclear | Medium/High | Public register; commercial reuse needs terms review | Store match result, source URL, extraction date, match confidence | researching | Sanctions screening |
| ДПС open datasets | https://tax.gov.ua/datasets.php | State Tax Service | Tax datasets and public tax registers | Official datasets and web services | Official datasets list | Medium | Verify per dataset/service | Store only business tax status facts needed for report | researching | VAT/single-tax/tax status checks |
| Реєстр платників ПДВ | https://tax.gov.ua/datasets.php | State Tax Service | VAT payer data | Official dataset/service | Dataset/service listed by STS | Medium | Verify terms and update cadence | Store payer status with check date | researching | VAT status check |
| Реєстр платників єдиного податку | https://tax.gov.ua/datasets.php | State Tax Service | Single-tax payer data | Official dataset/service | Dataset/service listed by STS | Medium | Verify terms and update cadence | Store payer status with check date | researching | FOP/company tax regime check |
| Єдиний державний реєстр декларацій | https://public.nazk.gov.ua/ and https://public.nazk.gov.ua/public_api | NACP / НАЗК | Public official declarations | Public web plus official JSON API | public-api.nazk.gov.ua | High | Needs legal/privacy review before commercial screening | Avoid bulk storage; link and summarize only when user has lawful purpose | needs-legal-review | PEP/public official due-diligence context |
| Державний реєстр санкцій extract | https://drs.nsdc.gov.ua/extract | NSDC Apparatus | Official sanctions extract | User-generated extract | Public web extract flow | Medium/High | Terms need review | Store extract metadata only with user consent | manual-link-only | Manual sanctions verification |
| АМКУ: зведені відомості щодо спотворення результатів торгів | https://amcu.gov.ua/napryami/oskarzhennya-publichnih-zakupivel/zvedeni-vidomosti-shchodo-spotvorennya-rezultativ-torgiv | Antimonopoly Committee of Ukraine | Tender-collusion violators | Official files/pages | XLS/XLSX files and data.gov.ua resources | Medium | Likely public information; verify terms and update cadence | Store entity, decision reference, period, source file date | researching | Procurement debarment/collusion risk |
| Державний реєстр атестованих судових експертів | https://data.gov.ua/dataset/0a556891-d6ef-4a5f-a182-caac2f7aa9c9 | Ministry of Justice / NAIS | Court experts | Open data dataset | data.gov.ua ZIP/XML | Medium | Verify dataset terms; public professional data | Store expert profile fields and source date | safe-open-data | Expert verification |
| Єдиний реєстр арбітражних керуючих | https://asbn.minjust.gov.ua/ak/list and https://data.gov.ua/dataset/yedinij-reyestr-arbitrazhnih-keruyuchih | Ministry of Justice | Insolvency professionals | Public web plus open-data dataset | data.gov.ua resource | Medium/High | Verify terms; contains professional and identity fields | Store minimal professional fields; avoid sensitive identifiers | researching | Insolvency professional verification |
| Єдиний реєстр підприємств щодо яких порушено провадження у справі про банкрутство | https://nais.gov.ua/pass_opendata | Ministry of Justice / NAIS | Bankruptcy-related companies | Open data listing via NAIS/data.gov.ua | Dataset to resolve | Medium | Verify dataset terms and completeness | Store company, proceeding status, source date | researching | Bankruptcy/insolvency risk |
| Єдиний реєстр нотаріусів | https://nais.gov.ua/m/ediniy-reestr-notariusiv-188 | Ministry of Justice / NAIS | Notaries | Official register/open-data listing | NAIS open-data page lists register | Medium | Verify terms; professional public data | Store minimal professional profile and source date | researching | Notary verification |
| Єдиний реєстр спеціальних бланків нотаріальних документів | https://nais.gov.ua/pass_opendata | Ministry of Justice / NAIS | Notarial forms | Official register/open data to verify | Dataset to resolve | Medium | Needs terms review | Prefer manual source link until fields verified | candidate | Notarial document/form authenticity signal |
| Державний реєстр обтяжень рухомого майна | https://centraljust.gov.ua/derjavni_reestru | Ministry of Justice / NAIS | Movable property encumbrances | Official register, access terms unclear | API/dataset unclear | High | Needs legal review | Do not store bulk data; user-driven checks only | needs-legal-review | Collateral/encumbrance check |
| Спадковий реєстр | https://centraljust.gov.ua/derjavni_reestru | Ministry of Justice / NAIS | Inheritance records | Restricted/official register | No open integration identified | High | Not suitable for first MVP | Do not integrate without official legal access | blocked | Not first MVP |
| Єдина державна електронна система у сфері будівництва | https://e-construction.gov.ua/ | Ministry / DIAM ecosystem | Construction permits, participants, licenses | Public portal | Public registry; API/dataset to verify | Medium | Needs terms review | Store official permit/license references only | researching | Construction license/permit check |
| НКРЕКП ліцензійний реєстр | https://www.nerc.gov.ua/reyestri-nkrekp/licenzijnij-reyestr-nkrekp | NEURC / НКРЕКП | Energy/utilities licenses | Public official registry | Web/files | Low/Medium | Verify terms | Store license status and source date | candidate | Sector license verification |
| Портал відкритих даних України | https://data.gov.ua/ | Ministry of Digital Transformation / data portal | Dataset catalog | Open data portal | CKAN-style portal resources | Varies by dataset | Open-data rules vary by dataset/resource | Store metadata and source links; do not assume all datasets are low-risk | safe-open-data | Source discovery and lawful dataset tracking |
| Рада: законодавство України | https://zakon.rada.gov.ua/ | Verkhovna Rada of Ukraine | Laws and regulations | Public official legal texts | Public web; API unclear | Low | Terms/citation rules need review | Store citations, law IDs, URLs, version dates | researching | Legal source citation for AI answers |

## First Safe Prototype Sources

These are the best first sources for a useful public catalog and early registry reports:

| Priority | Source | Why First | First Product Mode |
| --- | --- | --- | --- |
| 1 | ЄДР юридичних осіб, ФОП та громадських формувань | Core company/FOP identity source; official open-data dataset exists | Company/FOP profile with source date and attribution |
| 2 | ЄДРСР open-data datasets | Already aligned with precedent search roadmap | Court-practice links and decision-search entry point |
| 3 | ProZorro | Clear open-data/API ecosystem and useful business signal | Procurement history and tender links |
| 4 | Державний реєстр атестованих судових експертів | Official open-data dataset; lower risk than debtor/enforcement data | Expert verification |
| 5 | Стан розгляду справ | High user value, but captcha-protected | Manual official-link flow and saved case card |

## Useful But Needs Legal Review Before Automation

- Єдиний реєстр боржників.
- Автоматизована система виконавчого провадження.
- Державний реєстр обтяжень рухомого майна.
- Єдиний державний реєстр декларацій.
- Спадковий реєстр.

## Public Catalog Fields

The public `registries.html` page should show only user-safe fields:

- source name;
- what it checks;
- official link;
- first product mode;
- risk/access status;
- whether the result is automated, open-data based, or manual verification.

Avoid showing internal guesses as promises. Use "needs legal review" when terms, personal-data rights, or storage are uncertain.

## First Prototype Report

Working name:

> Legal check in 60 seconds

Report sections:

- searched entity;
- matched official sources;
- source links and source update/check dates;
- identity/company status;
- court-practice links;
- procurement participation;
- professional registry matches;
- debt/enforcement/sanctions signals only when lawful and verified;
- risk notes;
- "needs manual verification" flags.
