import { clean, getArticleKeys, includesText } from "./legal-text-utils.mjs";

export function filterDecisions(decisions, query = {}) {
  return decisions.filter((decision) => {
    if (query.article && !matchesArticle(decision, query.article)) return false;
    if (query.law && !matchesList(decision.cited_laws, query.law)) return false;
    if (query.region && !includesText(decision.court_region, query.region)) return false;
    if (query.court && !includesText(decision.court_name, query.court)) return false;
    if (query.level && decision.court_level !== query.level) return false;
    if (query.type && decision.decision_type !== query.type) return false;
    if (query.outcome && decision.outcome_label !== query.outcome) return false;
    if (query.from && decision.decision_date < query.from) return false;
    if (query.to && decision.decision_date > query.to) return false;
    if (query.q && !includesText(searchableText(decision), query.q)) return false;
    return true;
  });
}

export function summarizeSearchResults(items) {
  return {
    total: items.length,
    by_outcome: countBy(items, "outcome_label"),
    by_region: countBy(items, "court_region"),
    by_level: countBy(items, "court_level"),
    by_article: countArticles(items),
  };
}

export function sortResults(items, sortMode = "date_desc") {
  const copy = [...items];
  const mode = String(sortMode || "date_desc");

  if (mode === "date_asc") {
    return copy.sort((a, b) => compareDates(a, b) || compareText(a.case_number, b.case_number));
  }

  if (mode === "court") {
    return copy.sort((a, b) => compareText(a.court_name, b.court_name) || compareDatesDesc(a, b));
  }

  if (mode === "outcome") {
    return copy.sort((a, b) => compareText(a.outcome_label, b.outcome_label) || compareDatesDesc(a, b));
  }

  return copy.sort((a, b) => compareDatesDesc(a, b) || compareText(a.case_number, b.case_number));
}

export function limitResults(items, limit) {
  if (!limit) return items;
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return items;
  return items.slice(0, parsed);
}

export function matchesArticle(item, needle) {
  return [...getArticleKeys(item), ...(item.cited_articles || [])].some((value) => includesText(value, needle));
}

export function matchesList(values, needle) {
  return (values || []).some((value) => includesText(value, needle));
}

function searchableText(decision) {
  return [decision.text, decision.case_number, decision.court_name].join(" ");
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = clean(item[key]) || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function countArticles(items) {
  return items.reduce((acc, item) => {
    for (const article of getArticleKeys(item)) {
      acc[article] = (acc[article] || 0) + 1;
    }
    return acc;
  }, {});
}

function compareDates(a, b) {
  return String(a.decision_date || "").localeCompare(String(b.decision_date || ""));
}

function compareDatesDesc(a, b) {
  return compareDates(b, a);
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "uk");
}
