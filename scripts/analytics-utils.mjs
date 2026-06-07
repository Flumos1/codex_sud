import { clean, getArticleKeys } from "./legal-text-utils.mjs";

export function summarizePractice(decisions, sourceTotal = decisions.length, query = {}) {
  const withText = decisions.filter((decision) => clean(decision.text).length > 0);
  const withArticles = decisions.filter((decision) => decision.cited_articles?.length);
  const withKnownOutcome = decisions.filter(
    (decision) => decision.outcome_label && decision.outcome_label !== "unknown",
  );
  const dates = decisions
    .map((decision) => decision.decision_date)
    .filter(Boolean)
    .sort();

  return {
    query,
    total: decisions.length,
    source_total: sourceTotal,
    text_coverage: ratio(withText.length, decisions.length),
    article_coverage: ratio(withArticles.length, decisions.length),
    outcome_coverage: ratio(withKnownOutcome.length, decisions.length),
    date_range: {
      from: dates[0] || "",
      to: dates[dates.length - 1] || "",
    },
    by_outcome: topCounts(countBy(decisions, "outcome_label"), 20),
    by_text_status: topCounts(countTextStatus(decisions), 20),
    by_year: topCounts(countByYear(decisions), 20),
    by_region: topCounts(countBy(decisions, "court_region"), 20),
    by_level: topCounts(countBy(decisions, "court_level"), 20),
    by_decision_type: topCounts(countBy(decisions, "decision_type"), 20),
    top_courts: topCounts(countBy(decisions, "court_name"), 20),
    top_categories: topCounts(countBy(decisions, "category"), 20),
    top_articles: topCounts(countList(decisions, "cited_articles"), 30),
    top_article_keys: topCounts(countArticleKeys(decisions), 30),
    top_laws: topCounts(countList(decisions, "cited_laws"), 20),
    outcome_by_year: pivotCounts(decisions, yearOf, (decision) => clean(decision.outcome_label) || "unknown"),
    outcome_by_region: pivotCounts(decisions, (decision) => clean(decision.court_region) || "unknown", (decision) =>
      clean(decision.outcome_label) || "unknown",
    ),
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = clean(item[key]) || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function countList(items, key) {
  return items.reduce((acc, item) => {
    for (const value of item[key] || []) {
      const normalized = clean(value) || "unknown";
      acc[normalized] = (acc[normalized] || 0) + 1;
    }
    return acc;
  }, {});
}

function countArticleKeys(items) {
  return items.reduce((acc, item) => {
    for (const value of getArticleKeys(item)) {
      const normalized = clean(value) || "unknown";
      acc[normalized] = (acc[normalized] || 0) + 1;
    }
    return acc;
  }, {});
}

function countByYear(items) {
  return items.reduce((acc, item) => {
    const value = yearOf(item);
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function countTextStatus(items) {
  return items.reduce((acc, item) => {
    const value = clean(item.text_status) || (clean(item.text) ? "present_without_status" : "missing_without_status");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function pivotCounts(items, rowGetter, columnGetter) {
  const rows = new Map();

  for (const item of items) {
    const rowKey = rowGetter(item);
    const columnKey = columnGetter(item);
    if (!rows.has(rowKey)) rows.set(rowKey, { total: 0, counts: {} });
    const row = rows.get(rowKey);
    row.total += 1;
    row.counts[columnKey] = (row.counts[columnKey] || 0) + 1;
  }

  return [...rows.entries()]
    .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0], "uk"))
    .slice(0, 20)
    .map(([value, row]) => ({ value, total: row.total, counts: row.counts }));
}

function yearOf(item) {
  return clean(item.decision_date).slice(0, 4) || "unknown";
}

function topCounts(counts, limit) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "uk"))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function ratio(value, total) {
  if (!total) return { count: 0, total: 0, percent: 0 };
  return {
    count: value,
    total,
    percent: Number(((value / total) * 100).toFixed(1)),
  };
}
