# Source Card: court.gov.ua/fair

Source URL: https://court.gov.ua/fair/

Working name: Case Status / Стан розгляду справ

Status: `manual-link-only` for search, `researching` for supporting directories.

Last reviewed: 2026-06-06

## What This Source Provides

The page provides public information about the status and stages of court cases in Ukraine.

Visible search fields:

- case number;
- proceeding number;
- quick court search by name;
- region;
- court;
- incoming date range;
- party name;
- reCAPTCHA;
- search button.

Potential result fields from the table structure:

- court name;
- unified unique case number;
- proceeding number;
- incoming date;
- court composition;
- parties;
- claim subject;
- review stage date;
- review stage name;
- related actions, including court decisions and distribution reports where available.

## Technical Findings

The page uses a server-side DataTables flow.

Main search endpoint found in frontend JavaScript:

```text
POST https://court.gov.ua/fair.php
```

Search parameters observed in the JavaScript:

```text
q_ver=arbitr
date={sdate}~{edate}
grecap={g-recaptcha-response}
sSearch={party_name}
region={region_id}
court={court_id}
n_case={case_number}
n_proc={proceeding_number}
a={additional_a}
b={additional_b}
c={additional_c}
```

Supporting endpoints:

```text
POST https://court.gov.ua/catalog_fair.php
action=getCourtbyRegion&rid={region_id}
```

Purpose: returns courts by region as JSON.

```text
POST https://court.gov.ua/search_fair.php
q_court_search={query}
```

Purpose: quick court search by name, returns HTML.

## Access And Automation Assessment

The main search flow is protected by Google reCAPTCHA.

Important rule:

- do not bypass captcha;
- do not automate protected search as a backend scraper;
- do not build bulk search against `/fair.php` without official permission or a lawful access channel.

The safe product approach is a user-driven flow:

- guide the user to the official page;
- let the user enter search data and pass reCAPTCHA themselves;
- optionally store user-provided case metadata in their cabinet;
- optionally store a link, timestamp, and user-entered notes;
- do not store more personal data than necessary.

Supporting directories such as court-by-region may be useful, but each endpoint still needs legal and terms review before product integration.

## Product Use Cases

### Citizen Flow

User asks:

> I have a case number. What should I check?

Platform can:

- explain where to check case status;
- open the official page;
- show what fields to enter;
- explain the result in simple language after the user provides it;
- calculate next steps and deadlines if the user enters dates.

### Lawyer Flow

Lawyer asks:

> Track this case in my workspace.

Platform can:

- create a matter card;
- store case number, court, parties, and notes;
- link to the official status page;
- remind the lawyer to check status;
- later integrate official notifications only if lawful access exists.

### Registry Intelligence Flow

The source can contribute to a report as:

- official link for manual verification;
- case metadata entered by user;
- supporting source for court/case tracking.

It should not be treated as an automated bulk registry integration at this stage.

## First Mini-MVP

Build a small page or module:

Title:

> Проверить состояние судебного дела

Features:

1. Explain what the official source checks.
2. Provide the official link.
3. Show a checklist of fields the user may need:
   - case number;
   - proceeding number;
   - court;
   - party name;
   - date range.
4. Let the user save a case card manually:
   - case number;
   - court;
   - party/client;
   - notes;
   - official source link;
   - last checked date.
5. Add a reminder:
   - check again in 7 days;
   - check before a hearing;
   - custom date.
6. Add a disclaimer:
   - source is official;
   - data must be verified on the official website;
   - platform does not bypass captcha or guarantee live status.

## Data Handling

Allowed for first version:

- store user-entered case metadata;
- store official URL;
- store user notes;
- store reminder dates.

Avoid for first version:

- automated search through `/fair.php`;
- storing complete search results from protected flow;
- storing unnecessary personal data;
- scraping party lists at scale.

## Risk Level

Overall: Medium/High for automation, Low/Medium for manual-link workflow.

Reason:

- official public source;
- useful for users;
- main search is captcha-protected;
- likely contains personal data and case-sensitive information;
- safe only as user-driven flow until official access is clarified.

## Next Research Tasks

1. Locate official terms of use for court.gov.ua and related systems.
2. Check whether there is any official API, notification service, or open dataset for case status.
3. Review whether court directories can be used in a product UI.
4. Define exact fields for the first manual case card.
5. Decide how much case data can be stored under the privacy policy.
