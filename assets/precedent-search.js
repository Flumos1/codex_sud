(function () {
  const localRealSample = "data/index/edrsr-2026.first20.text.jsonl";
  const fallbackSample = "data/sample/edrsr-sample.jsonl";
  const HEALTH_TIMEOUT_MS = 1500;
  const apiParam = sanitizeApiBase(new URLSearchParams(window.location.search).get("api"));
  const form = document.querySelector("#precedentForm");
  const metrics = document.querySelector("#practiceMetrics");
  const facets = document.querySelector("#practiceFacets");
  const results = document.querySelector("#precedentResults");
  const reviewSets = document.querySelector("#practiceReviewSets");
  const sourceNote = document.querySelector("#dataSourceNote");
  const decisionDialog = document.querySelector("#decisionDialog");
  const decisionDialogTitle = document.querySelector("#decisionDialogTitle");
  const decisionDialogClose = document.querySelector("#decisionDialogClose");
  const decisionDetail = document.querySelector("#decisionDetail");
  let decisions = [];
  let activeSource = "";
  let apiBase = "";
  let inFlightController = null;
  const submitButton =
    typeof form?.querySelector === "function" ? form.querySelector('button[type="submit"]') : null;

  if (!form || !metrics || !facets || !results || !reviewSets) return;

  initialize();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!apiBase) {
      renderLocal(filterDecisions(decisions, new FormData(form)));
      return;
    }

    setLoading(true);
    try {
      await renderFromApi(new FormData(form));
    } catch (error) {
      if (error.name === "AbortError") return;
      showSearchError(error);
    } finally {
      setLoading(false);
    }
  });

  let lastFocusedTrigger = null;

  results.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-open-decision]");
    if (!button) return;
    lastFocusedTrigger = button;
    await openDecision(button.dataset.openDecision);
  });

  decisionDialogClose?.addEventListener("click", () => {
    decisionDialog?.close();
  });

  // Close the modal when clicking the backdrop (clicks on the dialog element itself, outside its content).
  decisionDialog?.addEventListener("click", (event) => {
    if (event.target === decisionDialog) decisionDialog.close();
  });

  // Restore focus to the trigger button after the dialog closes (keyboard accessibility).
  decisionDialog?.addEventListener("close", () => {
    if (lastFocusedTrigger && typeof lastFocusedTrigger.focus === "function") {
      lastFocusedTrigger.focus();
      lastFocusedTrigger = null;
    }
  });

  async function initialize() {
    apiBase = await detectApiBase();
    if (apiBase) {
      activeSource = apiBase;
      sourceNote.textContent = `Подключен локальный Search API: ${apiBase}.`;
      try {
        await renderFromApi(new FormData(form));
        return;
      } catch (error) {
        apiBase = "";
        sourceNote.textContent = "Search API недоступен, переключаемся на локальный sample.";
      }
    }

    const loaded = await loadData();
    decisions = loaded.items;
    activeSource = loaded.source;
    sourceNote.textContent =
      activeSource === localRealSample
        ? "Подключен локальный real-data sample EDRSR из data/index."
        : "Подключен synthetic sample. Для real-data sample запустите ingestion локально или Search API.";
    renderLocal(decisions);
  }

  async function detectApiBase() {
    const onHttps = window.location.protocol === "https:";
    const candidates = [
      apiParam,
      `${window.location.protocol}//${window.location.hostname || "127.0.0.1"}:8787`,
      "http://127.0.0.1:8787",
    ]
      .filter(Boolean)
      .map((candidate) => candidate.replace(/\/$/u, ""))
      // On an https page an http://127.0.0.1 request is blocked as mixed content; skip it.
      .filter((candidate) => !(onHttps && candidate.startsWith("http://")));

    for (const candidate of [...new Set(candidates)]) {
      try {
        const response = await fetch(`${candidate}/health`, {
          cache: "no-store",
          signal: timeoutSignal(HEALTH_TIMEOUT_MS),
        });
        if (response.ok) return candidate;
      } catch (error) {
        // Local fallback is expected when the API server is not running.
      }
    }
    return "";
  }

  async function renderFromApi(data) {
    inFlightController?.abort();
    inFlightController = typeof AbortController === "function" ? new AbortController() : null;
    const signal = inFlightController?.signal;

    const filters = queryFromFormData(data);
    const searchQuery = { ...filters, sort: "date_desc", limit: "20" };
    const [searchPayload, analysisPayload] = await Promise.all([
      fetchJson(`${apiBase}/api/search?${toQueryString(searchQuery)}`, signal),
      fetchJson(`${apiBase}/api/analyze?${toQueryString(filters)}`, signal),
    ]);

    renderMetricsFromAnalysis(analysisPayload);
    renderFacetsFromAnalysis(analysisPayload);
    renderReviewSets(analysisPayload.review_sets || {});
    renderResults((searchPayload.results || []).map(normalizeDecision));
  }

  async function fetchJson(url, signal) {
    const response = await fetch(url, { cache: "no-store", signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function setLoading(isLoading) {
    if (!submitButton) return;
    submitButton.disabled = isLoading;
    submitButton.setAttribute("aria-busy", String(isLoading));
  }

  function showSearchError(error) {
    const message = error?.message ? `Ошибка запроса: ${escapeHtml(error.message)}.` : "Не удалось получить данные.";
    results.innerHTML = `<p class="empty-state">${message} Проверьте, запущен ли Search API, и повторите поиск.</p>`;
  }

  function timeoutSignal(ms) {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return AbortSignal.timeout(ms);
    }
    if (typeof AbortController === "function" && typeof setTimeout === "function") {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    }
    return undefined;
  }

  async function loadData() {
    const real = await tryLoadJsonl(localRealSample);
    if (real.length) return { items: real, source: localRealSample };
    return { items: await tryLoadJsonl(fallbackSample), source: fallbackSample };
  }

  async function tryLoadJsonl(url) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return [];
      const text = await response.text();
      return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => normalizeDecision(JSON.parse(line)));
    } catch (error) {
      return [];
    }
  }

  function normalizeDecision(decision) {
    return {
      ...decision,
      cited_article_keys:
        decision.cited_article_keys?.length ? decision.cited_article_keys : (decision.cited_articles || []).map(articleToKey),
    };
  }

  function queryFromFormData(data) {
    return {
      article: clean(data.get("article")),
      q: clean(data.get("q")),
      region: clean(data.get("region")),
      level: clean(data.get("level")),
      from: clean(data.get("from")),
      to: clean(data.get("to")),
      type: clean(data.get("type")),
      outcome: clean(data.get("outcome")),
    };
  }

  function toQueryString(query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    return params.toString();
  }

  function filterDecisions(items, data) {
    const query = queryFromFormData(data);

    return items.filter((item) => {
      if (query.article && !matchesArticle(item, query.article)) return false;
      if (query.q && !includesText([item.text, item.case_number, item.court_name, item.category].join(" "), query.q)) return false;
      if (query.region && !includesText(item.court_region, query.region)) return false;
      if (query.level && !includesText(item.court_level, query.level)) return false;
      if (query.from && item.decision_date < query.from) return false;
      if (query.to && item.decision_date > query.to) return false;
      if (query.type && item.decision_type !== query.type) return false;
      if (query.outcome && item.outcome_label !== query.outcome) return false;
      return true;
    });
  }

  function renderLocal(items) {
    renderMetrics(items);
    renderFacets(items);
    renderReviewSets(buildReviewSets(items));
    renderResults(items.slice(0, 20));
  }

  function renderMetrics(items) {
    const withText = items.filter((item) => clean(item.text));
    const knownOutcome = items.filter((item) => item.outcome_label && item.outcome_label !== "unknown");
    metrics.innerHTML = `
      <div><strong>${items.length}</strong><span>найденных решений</span></div>
      <div><strong>${withText.length}</strong><span>с текстом решения</span></div>
      <div><strong>${knownOutcome.length}</strong><span>с определенным исходом</span></div>
    `;
  }

  function renderMetricsFromAnalysis(summary) {
    metrics.innerHTML = `
      <div><strong>${safeCount(summary.total)}</strong><span>найденных решений</span></div>
      <div><strong>${safeCount(summary.text_coverage?.count)}</strong><span>с текстом решения</span></div>
      <div><strong>${safeCount(summary.outcome_coverage?.count)}</strong><span>с определенным исходом</span></div>
    `;
  }

  function renderFacets(items) {
    const outcomes = topCounts(countBy(items, "outcome_label"), 5);
    const regions = topCounts(countBy(items, "court_region"), 5);
    const articles = topCounts(countList(items, "cited_article_keys"), 8);
    facets.innerHTML = `
      ${renderFacetGroup("Исходы", outcomes)}
      ${renderFacetGroup("Регионы", regions)}
      ${renderFacetGroup("Нормы", articles)}
    `;
  }

  function renderFacetsFromAnalysis(summary) {
    facets.innerHTML = `
      ${renderFacetGroup("Исходы", summary.by_outcome || [])}
      ${renderFacetGroup("Регионы", summary.by_region || [])}
      ${renderFacetGroup("Нормы", summary.top_article_keys || [])}
    `;
  }

  function renderFacetGroup(title, rows) {
    if (!rows.length) return `<div class="facet-group"><h3>${escapeHtml(title)}</h3><p class="empty-state">нет данных</p></div>`;
    return `
      <div class="facet-group">
        <h3>${escapeHtml(title)}</h3>
        ${rows
          .map((row) => `<div class="facet-row"><span>${escapeHtml(row.value)}</span><strong>${safeCount(row.count)}</strong></div>`)
          .join("")}
      </div>
    `;
  }

  function renderResults(items) {
    if (!items.length) {
      results.innerHTML = '<p class="empty-state">Нет решений по выбранным критериям.</p>';
      return;
    }

    results.innerHTML = items
      .map((item) => {
        const articles = [...(item.cited_article_keys || []), ...(item.cited_articles || [])].slice(0, 6);
        const excerpt = item.key_excerpts?.[0] || firstTextExcerpt(item.text);
        const sourceUrl = safeHttpUrl(item.source_url);
        const source = sourceUrl
          ? `<a href="${escapeAttribute(sourceUrl)}" target="_blank" rel="noreferrer">Официальный текст</a>`
          : '<span>Текст недоступен</span>';
        const detailButton = item.decision_id
          ? `<button class="link-button" type="button" data-open-decision="${escapeAttribute(item.decision_id)}">Открыть решение</button>`
          : "";
        return `
          <article class="case-item precedent-item">
            <div class="result-head">
              <h3>${escapeHtml(item.case_number || item.decision_id || "Без номера")}</h3>
              <span class="badge">${escapeHtml(formatOutcome(item.outcome_label))}</span>
            </div>
            <div class="case-meta">
              <span>${escapeHtml(item.court_name || "Суд не указан")}</span>
              <span>${escapeHtml([item.court_region, item.court_level, item.decision_type].filter(Boolean).join(" · "))}</span>
              <span>${escapeHtml(item.decision_date || "дата не указана")}</span>
            </div>
            <div class="tag-list">${articles.map((article) => `<span>${escapeHtml(article)}</span>`).join("")}</div>
            <p>${escapeHtml(excerpt || "Фрагмент пока не извлечен.")}</p>
            <div class="result-actions">${detailButton}${source}</div>
          </article>
        `;
      })
      .join("");
  }

  function renderReviewSets(sets) {
    const groups = [
      ["supporting_outcome", "Поддерживающие исходы"],
      ["opposing_outcome", "Противоположная практика"],
      ["procedural_turn", "Процедурные повороты"],
      ["needs_manual_review", "Нужно проверить вручную"],
    ];

    reviewSets.innerHTML = groups
      .map(([key, title]) => {
        const rows = sets[key] || [];
        if (!rows.length) {
          return `
            <article class="review-column">
              <h3>${title}</h3>
              <p class="empty-state">нет решений</p>
            </article>
          `;
        }

        return `
          <article class="review-column">
            <h3>${title}</h3>
            ${rows
              .slice(0, 5)
              .map(
                (item) => `
                  <div class="review-item">
                    <strong>${escapeHtml(item.case_number || item.decision_id || "Без номера")}</strong>
                    <span>${escapeHtml([item.court_name, item.decision_date].filter(Boolean).join(" · "))}</span>
                    <span>${escapeHtml(formatOutcome(item.outcome_label))}</span>
                  </div>
                `,
              )
              .join("")}
          </article>
        `;
      })
      .join("");
  }

  function buildReviewSets(items) {
    const sets = {
      supporting_outcome: [],
      opposing_outcome: [],
      procedural_turn: [],
      needs_manual_review: [],
    };

    for (const item of [...items].sort(compareForReview)) {
      const group = outcomeGroup(item);
      if (sets[group].length >= 5) continue;
      sets[group].push(item);
    }

    return sets;
  }

  function compareForReview(a, b) {
    return (
      Number(b.outcome_confidence || 0) - Number(a.outcome_confidence || 0) ||
      clean(b.decision_date).localeCompare(clean(a.decision_date)) ||
      clean(a.case_number).localeCompare(clean(b.case_number), "uk")
    );
  }

  function outcomeGroup(item) {
    const label = clean(item.outcome_label);
    const confidence = Number(item.outcome_confidence || 0);
    if (!label || label === "unknown" || confidence < 0.65) return "needs_manual_review";
    if (["satisfied", "partially_satisfied", "appeal_granted", "cassation_granted", "left_unchanged"].includes(label)) {
      return "supporting_outcome";
    }
    if (
      ["dismissed", "appeal_dismissed", "cassation_dismissed", "cassation_refused_opening", "motion_denied", "closed"].includes(
        label,
      )
    ) {
      return "opposing_outcome";
    }
    if (
      ["cancelled", "changed", "remanded", "case_scheduled", "cassation_opened", "cassation_returned", "transferred"].includes(
        label,
      )
    ) {
      return "procedural_turn";
    }
    return "needs_manual_review";
  }

  async function openDecision(decisionId) {
    if (!decisionDialog || !decisionDetail || !decisionDialogTitle) return;

    decisionDialogTitle.textContent = "Загрузка решения...";
    decisionDetail.innerHTML = '<p class="empty-state">Получаем полный текст решения.</p>';
    showDialog(decisionDialog);

    try {
      const decision = await loadDecisionDetail(decisionId);
      renderDecisionDetail(normalizeDecision(decision));
    } catch (error) {
      decisionDialogTitle.textContent = "Решение недоступно";
      decisionDetail.innerHTML = `<p class="empty-state">${escapeHtml(error.message || "Не удалось открыть решение.")}</p>`;
    }
  }

  async function loadDecisionDetail(decisionId) {
    if (apiBase) {
      return fetchJson(`${apiBase}/api/decisions/${encodeURIComponent(decisionId)}`);
    }

    const local = decisions.find((item) => String(item.decision_id || "") === String(decisionId));
    if (!local) throw new Error("Решение не найдено в локальном sample.");
    return local;
  }

  function renderDecisionDetail(decision) {
    const title = decision.case_number || decision.decision_id || "Решение";
    const articles = [...(decision.cited_article_keys || []), ...(decision.cited_articles || [])].slice(0, 10);
    const sourceUrl = safeHttpUrl(decision.source_url);
    const source = sourceUrl
      ? `<a href="${escapeAttribute(sourceUrl)}" target="_blank" rel="noreferrer">Открыть официальный источник</a>`
      : '<span>Официальная ссылка отсутствует</span>';

    decisionDialogTitle.textContent = title;
    decisionDetail.innerHTML = `
      <div class="case-meta">
        <span>${escapeHtml(decision.court_name || "Суд не указан")}</span>
        <span>${escapeHtml([decision.court_region, decision.court_level, decision.decision_type].filter(Boolean).join(" · "))}</span>
        <span>${escapeHtml(decision.decision_date || "дата не указана")}</span>
        <span>${escapeHtml(formatOutcome(decision.outcome_label))}</span>
      </div>
      <div class="tag-list">${articles.map((article) => `<span>${escapeHtml(article)}</span>`).join("")}</div>
      <div class="result-actions">${source}</div>
      <div class="decision-text">${escapeHtml(decision.text || "Полный текст недоступен. Проверьте официальный источник.")}</div>
      <div class="disclaimer"><strong>Важно.</strong> Используйте этот текст как рабочую копию и проверяйте по официальному источнику.</div>
    `;
  }

  function showDialog(dialog) {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return;
    }
    dialog.setAttribute("open", "");
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

  function topCounts(counts, limit) {
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "uk"))
      .slice(0, limit)
      .map(([value, count]) => ({ value, count }));
  }

  function matchesArticle(item, needle) {
    return [...(item.cited_article_keys || []), ...(item.cited_articles || [])].some((value) => includesText(value, needle));
  }

  function articleToKey(value) {
    const text = String(value || "");
    const article = text.match(/\d+(?:[-–]\d+)?/)?.[0] || "";
    const law = normalizeLawName(text);
    return article && law ? `${law}:${article}` : text;
  }

  function normalizeLawName(value) {
    const text = String(value || "");
    const known = [
      ["КК України", /\bКК\b|Кримінальн/iu],
      ["КПК України", /\bКПК\b|Кримінальн[а-яіїєґa-z]*\s+процесуальн/iu],
      ["КУпАП", /\bКУпАП\b|адміністративні правопорушення/iu],
      ["ЦК України", /\bЦК\b|Цивільн[а-яіїєґa-z]*\s+кодекс/iu],
      ["ЦПК України", /\bЦПК\b|Цивільн[а-яіїєґa-z]*\s+процесуальн/iu],
      ["ГПК України", /\bГПК\b|Господарськ[а-яіїєґa-z]*\s+процесуальн/iu],
      ["КАС України", /\bКАС\b|адміністративн[а-яіїєґa-z]*\s+судочинства/iu],
    ];
    return known.find(([, pattern]) => pattern.test(text))?.[0] || "";
  }

  function firstTextExcerpt(text) {
    return clean(text).slice(0, 260);
  }

  function formatOutcome(value) {
    const labels = {
      appeal_dismissed: "апелляция отклонена",
      cassation_dismissed: "кассация отклонена",
      cassation_refused_opening: "отказ в открытии кассации",
      cassation_opened: "кассация открыта",
      cassation_returned: "кассация возвращена",
      appeal_granted: "апелляция удовлетворена",
      cassation_granted: "кассация удовлетворена",
      case_scheduled: "назначено к рассмотрению",
      motion_denied: "в заявлении отказано",
      transferred: "передано",
      left_unchanged: "оставлено без изменений",
      satisfied: "удовлетворено",
      dismissed: "отказано",
      partially_satisfied: "частично удовлетворено",
      cancelled: "отменено",
      remanded: "новое рассмотрение",
      closed: "закрыто",
      unknown: "не определено",
    };
    return labels[value] || value || "не определено";
  }

  function includesText(value, needle) {
    return normalize(value).includes(normalize(needle));
  }

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase("uk-UA")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
  }

  function safeCount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function sanitizeApiBase(value) {
    if (!value) return "";
    try {
      const url = new URL(value);
      const isLocalHost = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
      if (!isLocalHost) return "";
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      return "";
    }
  }
})();
