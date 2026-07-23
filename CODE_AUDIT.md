# Технический аудит Codex Sud (Legal OS Ukraine)

Дата аудита: 2026-07-06.
Статус: **исправления НЕ внесены** — это список того, что нужно сделать. Все тесты на момент аудита проходят (23/23), `npm run check` чистый.

```text
Общий уровень качества: 6.5 / 10
Готовность к продакшену: нет (как прототип для статичного демо на Vercel — да, после пунктов P0)
Главные риски:
  1. XSS через параметр ?api= — страница рендерит ответы произвольного стороннего API через innerHTML.
  2. javascript:-ссылки из данных попадают в href без проверки схемы.
  3. Dev-сервер со --static отдает весь корень репозитория (включая .git/ и data/raw/).
  4. /api/search не имеет верхнего лимита и rate limiting — можно выкачать весь корпус (limit=0 + include_text=1).
  5. Отсутствие обработки ошибок на submit — UI молча зависает при падении API.
  6. Search API не будет работать на Vercel как есть (это Node-процесс, а не serverless-функция).
Что исправить в первую очередь:
  1. Валидировать ?api= (разрешить только localhost) и экранировать/приводить к Number все поля из API.
  2. Проверять схему source_url (только http/https) перед вставкой в href.
  3. Добавить верхний предел limit (например, 100) и запрет include_text без явного флага сервера.
  4. try/catch вокруг renderFromApi + видимое сообщение об ошибке + disabled-состояние кнопки.
  5. Убрать раздачу скрытых каталогов (.git, data/raw) в sendStatic.
  6. Портировать поиск в /api как Vercel serverless functions (или оставить только статик + sample).
```

---

## 1. Безопасность

### S1. XSS через недоверенный API (`?api=`) — **High**
- Где: [assets/precedent-search.js:4](assets/precedent-search.js) (`apiParam`), `detectApiBase()` (строки 61–77), `renderMetricsFromAnalysis()` (183–188), `renderFacetGroup()` (209–217).
- Проблема: любой посетитель может открыть `precedent-search.html?api=https://attacker.example`. Страница сделает fetch к этому серверу и вставит ответ в DOM. Поля `summary.total`, `text_coverage.count`, `outcome_coverage.count`, `row.count` вставляются в `innerHTML` **без экранирования** (экранируется только `row.value`). Вредоносный API может вернуть `{"total": "<img src=x onerror=alert(document.cookie)>"}` — исполнится скрипт.
- Сценарий: фишинговая ссылка на ваш легитимный домен с параметром `?api=` → кража localStorage (карточки дел юристов из case-status), подмена содержимого «официальных» ссылок.
- Критичность: High (после деплоя на публичный домен).
- Исправление:
  1. Валидировать `apiParam`: разрешать только `http://127.0.0.1:*` / `http://localhost:*`, иначе игнорировать.
  2. Все числовые поля прогонять через `Number(...) || 0`, все строковые — через `escapeHtml` (включая `row.count`).
  ```js
  function safeApiBase(raw) {
    try {
      const url = new URL(raw);
      const isLocal = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
      return isLocal && (url.protocol === "http:" || url.protocol === "https:")
        ? url.origin
        : "";
    } catch { return ""; }
  }
  // в рендере:
  const total = Number(summary.total) || 0;
  ```
- Проверить вручную: открыть страницу с `?api=` на посторонний хост и убедиться, что источник отвергнут.

### S2. `javascript:` в `source_url` — **Medium/High**
- Где: [assets/precedent-search.js:229-231](assets/precedent-search.js) (`renderResults`), 374–376 (`renderDecisionDetail`).
- Проблема: `escapeAttribute()` экранирует кавычки, но не проверяет схему URL. Запись JSONL или ответ API с `"source_url": "javascript:..."` даст исполняемую ссылку «Официальный текст».
- Исправление: допускать только `http:`/`https:`:
  ```js
  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
  }
  ```

### S3. Статик-сервер отдает весь корень репозитория — **Medium**
- Где: [scripts/serve-search-api.mjs:148-171](scripts/serve-search-api.mjs) (`sendStatic`), запускается как `npm run dev` со `--static .`.
- Проблема: защита от path traversal есть (проверка префикса после `path.resolve` — корректная), но раздается ВСЁ под корнем: `/.git/config` (история, remote URL), `/data/raw/edrsr_2026/documents.csv` (889 МБ реальных данных), будущий `/.env`. Один запрос к `/data/raw/...` — и dev-сервер отдаёт весь массив.
- Критичность: Medium локально; Critical, если такой сервер когда-либо окажется публичным.
- Исправление: денай-лист в `sendStatic`:
  ```js
  const forbidden = /^[\\/](\.git|\.env|data[\\/]raw|Claude_sud|node_modules)([\\/]|$)/;
  if (forbidden.test(relativePath)) { sendJson(response, 403, { error: "forbidden" }); return; }
  ```
  Либо раздавать только явный allow-лист каталогов (`assets/`, `data/sample/`, `data/index/`, `*.html`).

### S4. Нет верхнего лимита и rate limiting на API — **Medium**
- Где: [scripts/search-utils.mjs:62-67](scripts/search-utils.mjs) (`limitResults`), [scripts/serve-search-api.mjs:58-73](scripts/serve-search-api.mjs).
- Проблема: `limitResults("0")` и `limitResults(-1)` возвращают **все** результаты (`parsed < 1 → return items`). `GET /api/search?limit=0&include_text=1` выгружает весь корпус с полными текстами одним запросом. Rate limiting отсутствует полностью.
- Исправление: `const parsed = Math.min(Math.max(Number.parseInt(limit,10) || 20, 1), 100);` + на публичном API — rate limit (на Vercel: middleware / upstash-ratelimit).

### S5. CORS `Access-Control-Allow-Origin: *` — **Low/Medium**
- Где: [scripts/serve-search-api.mjs:195-201](scripts/serve-search-api.mjs) (`sendJson`).
- Проблема: любой сайт в интернете может дергать API из браузера пользователя. Для локального dev терпимо, для продакшена — сузить до собственного origin.
- Исправление: список разрешенных origin через env, echo только совпавшего.

### S6. Утечка внутренних ошибок клиенту — **Low**
- Где: [scripts/serve-search-api.mjs:100-102](scripts/serve-search-api.mjs).
- Проблема: `message: error.message` в 500-ответе может раскрывать пути файловой системы и детали реализации.
- Исправление: логировать полную ошибку в консоль сервера, клиенту отдавать generic `{"error":"internal_error"}`.

### S7. Отсутствуют security-заголовки — **Medium**
- Где: dev-сервер и (до этого аудита) деплой.
- Что нужно: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy`, и — после исправления S1/S2 — строгий CSP (`default-src 'self'; connect-src 'self' http://127.0.0.1:8787`).
- Статус: базовые заголовки добавлены в `vercel.json` в рамках подготовки деплоя (см. раздел 8). CSP оставлен на этап после исправления S1 — иначе он частично