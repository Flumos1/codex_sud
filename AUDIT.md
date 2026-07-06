# Технический аудит Codex Sud (Legal OS Ukraine)

Дата аудита: 2026-07-06.
Статус: **только фиксация проблем — исправления НЕ внесены** (по решению владельца проекта, правки будут делаться позже).
Проверено: все HTML-страницы, `assets/*.js`, `assets/styles.css`, `scripts/*.mjs`, `tests/*.test.mjs`, `package.json`, `.gitignore`.
Тесты на момент аудита: **23/23 проходят** (`npm test`), `npm run check` — синтаксис чистый.

---

## Краткое резюме

```text
Общий уровень качества: 7 / 10
Готовность к продакшену: частично (как статический прототип на Vercel — да; как рабочий сервис с API — нет)
Главные риски:
  1. XSS через параметр ?api= — страница доверяет произвольному внешнему API и вставляет числовые поля в innerHTML без экранирования.
  2. source_url вставляется в href без проверки схемы (javascript: URL из данных = XSS).
  3. Dev-сервер со --static . раздает ВЕСЬ репозиторий: .git/, data/raw/ (889 МБ CSV), .gitignore и т.д.
  4. Нет верхнего лимита выдачи API: limit=0 или отсутствие limit отдает весь датасет (+ include_text=1 = полный дамп текстов).
  5. CORS: Access-Control-Allow-Origin: * на всех ответах API.
  6. Нет обработки ошибок при сабмите формы поиска — при падении API интерфейс молча зависает.
  7. Дублирование доменной логики между assets/precedent-search.js и scripts/*.mjs уже привело к расхождению поведения.
Что исправить в первую очередь:
  1. Валидировать параметр ?api= (разрешить только localhost/127.0.0.1) и экранировать/приводить к Number все поля из ответов API.
  2. Проверять схему source_url (только http/https) перед вставкой в href.
  3. В dev-сервере запретить выдачу .git/, data/raw/, скрытых файлов; whitelist расширений.
  4. Ввести жесткий максимум limit (например 100) на /api/search и /api/analyze.
  5. Обернуть submit-обработчик поиска в try/catch с сообщением об ошибке пользователю.
  6. Добавить security-заголовки (готово в vercel.json для деплоя; для dev-сервера — сделать).
  7. Свести дублированную логику к одному источнику (ES-модули, используемые и сервером, и браузером).
```

---

## 1. Безопасность

### SEC-1. XSS через параметр `?api=` + неэкранированные поля из API — **High**
- **Где:** [assets/precedent-search.js:4](assets/precedent-search.js) (чтение `api` из query string), [assets/precedent-search.js:182-188](assets/precedent-search.js) (`renderMetricsFromAnalysis`), [assets/precedent-search.js:214](assets/precedent-search.js) (`row.count` в `renderFacetGroup`).
- **Суть:** страница позволяет любой ссылкой (`precedent-search.html?api=https://evil.example`) подключить произвольный «API». Ответы этого API затем рендерятся. Строковые поля экранируются через `escapeHtml`, но `summary.total`, `text_coverage.count`, `outcome_coverage.count` и `row.count` вставляются в `innerHTML` без экранирования. Вредоносный API может вернуть `total: "<img src=x onerror=...>"` — код выполнится в контексте страницы.
- **Сценарий риска:** атакующий рассылает ссылку на ваш сайт с `?api=` на свой сервер → у жертвы выполняется произвольный JS (кража localStorage с карточками дел, дефейс, фишинг).
- **Исправление:**
  1. Валидировать `api`: принимать только `http://127.0.0.1:*` / `http://localhost:*` (или явный whitelist).
  2. Все «числовые» поля приводить через `Number(...) || 0` перед вставкой.
  3. Экранировать `row.count` так же, как `row.value`.
- **Пример безопасного кода:**
  ```js
  function safeCount(value) { return Number(value) || 0; }
  function isAllowedApiBase(value) {
    try {
      const url = new URL(value);
      return ["127.0.0.1", "localhost"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol);
    } catch { return false; }
  }
  const apiParam = isAllowedApiBase(rawApiParam) ? rawApiParam : "";
  ```

### SEC-2. `source_url` без проверки схемы → XSS через данные — **Medium**
- **Где:** [assets/precedent-search.js:229-231](assets/precedent-search.js) и [assets/precedent-search.js:374-376](assets/precedent-search.js) — `href="${escapeAttribute(item.source_url)}"`.
- **Суть:** `escapeHtml/escapeAttribute` не защищают от `javascript:alert(1)` в качестве URL. Если в JSONL/ответ API попадет такая «ссылка», клик по «Официальный текст» выполнит скрипт.
- **Исправление:** пропускать URL через `new URL(...)` и разрешать только `http:`/`https:`; иначе показывать «Текст недоступен».
  ```js
  function safeHttpUrl(value) {
    try { const u = new URL(value); return ["http:", "https:"].includes(u.protocol) ? u.href : ""; }
    catch { return ""; }
  }
  ```

### SEC-3. Static-режим dev-сервера раздает весь репозиторий — **Medium (локально) / Critical (если задеплоить как есть)**
- **Где:** [scripts/serve-search-api.mjs:148-171](scripts/serve-search-api.mjs) (`sendStatic`).
- **Суть:** защита от path traversal есть (проверка префикса после `path.resolve`) и работает, но никакого списка разрешенных путей нет. При `npm run dev` доступны: `/.git/config`, `/.gitignore`, `/data/raw/edrsr_2026/documents.csv` (889 МБ!), `/data/index/*.jsonl`, любые локальные файлы в корне.
- **Сценарий риска:** если этот сервер когда-либо окажется доступен извне (проброс порта, деплой на VPS), утекут git-история, сырые датасеты и служебные файлы.
- **Исправление:** запретить сегменты, начинающиеся с точки (`.git`, `.env`...), запретить `data/raw/`, ввести whitelist расширений (`.html .css .js .json .jsonl .md .svg`), отдавать `X-Content-Type-Options: nosniff`.

### SEC-4. Нет верхнего предела `limit` → дамп всего датасета — **Medium**
- **Где:** [scripts/search-utils.mjs:62-67](scripts/search-utils.mjs) (`limitResults`: `if (!limit) return items`; `parsed < 1` → тоже все), [scripts/serve-search-api.mjs:64](scripts/serve-search-api.mjs) (`query.limit || 20`).
- **Суть:** `GET /api/search?limit=0` (или `limit=-1`, `limit=abc`) возвращает **все** записи; вместе с `include_text=1` — полный дамп всех текстов. Плюс нет rate limiting вообще.
- **Сценарий риска:** автоматизированный парсинг всего корпуса одним запросом; DoS большими ответами.
- **Исправление:** `const MAX_LIMIT = 100; const effective = Math.min(Math.max(parsed || 20, 1), MAX_LIMIT);` — и вернуть 400 на невалидный limit. Для публичного API добавить rate limiting (на Vercel — middleware/upstash, на Node — token bucket).

### SEC-5. `Access-Control-Allow-Origin: *` — **Low/Medium**
- **Где:** [scripts/serve-search-api.mjs:195-201](scripts/serve-search-api.mjs) (`sendJson`).
- **Суть:** для локального прототипа приемлемо (данные открытые), но при выходе в прод любой сайт сможет дергать API от имени посетителей.
- **Исправление:** whitelist origin'ов (localhost + прод-домен) через переменную окружения.

### SEC-6. Утечка внутренних ошибок клиенту — **Low**
- **Где:** [scripts/serve-search-api.mjs:100-102](scripts/serve-search-api.mjs) — `message: error.message` в ответе 500.
- **Суть:** сообщения ошибок Node (пути файлов, детали парсинга) уходят наружу.
- **Исправление:** логировать `error` на сервере, клиенту отдавать только `{ error: "internal_error" }`.

### SEC-7. Заголовки безопасности отсутствуют — **Medium для прода**
- **Где:** dev-сервер и деплой.
- **Исправление:** `Content-Security-Policy` (script-src 'self'), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`. Для Vercel уже добавлены в `vercel.json` (см. раздел 8). Для dev-сервера — добавить в `sendJson`/`sendStatic`.

### SEC-8. localStorage: данные клиентов юриста без шифрования — **Low (осознанный дизайн)**
- **Где:** [assets/app.js:19-21](assets/app.js).
- **Суть:** карточки дел (номер дела, клиент, заметки) лежат в открытом виде в localStorage. Для прототипа задокументировано на странице («данные сохраняются только в браузере»), но любой XSS (см. SEC-1) их читает. Дополнительный аргумент закрыть SEC-1/SEC-2.

### Что проверить вручную/инструментами
- Зависимостей в `package.json` нет вообще (zero-dependency) — `npm audit` не требуется, это сильная сторона проекта. При добавлении зависимостей включить Dependabot на GitHub.
- Проверить на GitHub, что в истории коммитов никогда не были закоммичены реальные датасеты/PDF (сейчас в HEAD их нет; `git log --all --stat -- data/raw` для верификации).

---

## 2. Функциональные баги

### BUG-1. Сабмит формы поиска не обрабатывает ошибки API — **High (UX-критично)**
- **Где:** [assets/precedent-search.js:23-30](assets/precedent-search.js) (submit-обработчик), [assets/precedent-search.js:79-91](assets/precedent-search.js) (`renderFromApi` без try/catch).
- **Как проявляется:** API определился на старте, затем упал/перезапустился → `fetchJson` бросает исключение → unhandled promise rejection, пользователь видит старые результаты без какого-либо сообщения. Кнопка не блокируется, состояние загрузки отсутствует.
- **Исправление:** обернуть в try/catch, показывать сообщение в `sourceNote`/`results`, при недоступности API переключаться на локальный fallback; блокировать кнопку на время запроса.

### BUG-2. Гонка запросов при повторных сабмитах — **Medium**
- **Где:** [assets/precedent-search.js:79-91](assets/precedent-search.js).
- **Как проявляется:** два быстрых сабмита → два параллельных `Promise.all`; ответ первого может прийти позже второго и перезаписать актуальные результаты устаревшими.
- **Исправление:** `AbortController` — отменять предыдущий запрос перед новым, либо номер поколения запроса.

### BUG-3. `readCards()` не проверяет тип — падение при испорченном localStorage — **Medium**
- **Где:** [assets/app.js:11-17](assets/app.js).
- **Как проявляется:** если в `legal-os.case-cards` лежит `{}` или `"text"` (старые версии, ручное редактирование, другой скрипт) — `JSON.parse` успешен, `|| []` не срабатывает, дальше `cards.map is not a function` → страница карточек полностью ломается.
- **Исправление:** `const parsed = JSON.parse(...); return Array.isArray(parsed) ? parsed : [];`

### BUG-4. `writeCards` не защищен от QuotaExceededError — **Low**
- **Где:** [assets/app.js:19-21](assets/app.js).
- **Как проявляется:** Safari private mode / переполненное хранилище → исключение при сохранении карточки, форма «молча» не работает.
- **Исправление:** try/catch с сообщением пользователю.

### BUG-5. Регулярка `remanded` содержит бессмысленную альтернативу — **Low (латентный баг)**
- **Где:** [scripts/legal-text-utils.mjs:59](scripts/legal-text-utils.mjs) — `/направити\s+.{0,80}нов(ий|ий)\s+розгляд/`.
- **Суть:** `(ий|ий)` — дубль одной и той же ветки; форма «нове розглядання»/«новий розгляд» в другом падеже («нового розгляду») не матчится. Вероятно, задумывалось `нов(ий|ого|е)`.
- **Исправление:** уточнить паттерн и добавить тест на «направити справу на новий розгляд» / «для нового розгляду».

### BUG-6. Порядок правил `classifyOutcome`: широкое `скасувати` перекрывает составные исходы — **Medium (качество данных)**
- **Где:** [scripts/legal-text-utils.mjs:44-77](scripts/legal-text-utils.mjs).
- **Суть:** резолютивная часть «рішення скасувати, справу направити на новий розгляд» корректно даст `remanded` (он раньше `cancelled`), но «рішення скасувати та ухвалити нове» даст `cancelled`, хотя по сути это `changed`. Порядок и жадность правил не покрыты тестами на комбинированные резолюции.
- **Исправление:** тесты на составные резолютивы; возможно, возвращать несколько меток или приоритезировать более специфичные правила.

### BUG-7. Клиентская фильтрация расходится с серверной — **Medium**
- **Где:** [assets/precedent-search.js:149-163](assets/precedent-search.js) vs [scripts/search-utils.mjs:3-17](scripts/search-utils.mjs).
- **Суть:** локальный режим: `level` ищется как подстрока (`includesText`), серверный — строгое равенство (`decision.court_level !== query.level`); `q` на клиенте ищет еще и по `category`, на сервере — нет. Один и тот же запрос дает разные результаты в API-режиме и в fallback-режиме.
- **Исправление:** см. ARCH-1 — единый модуль фильтрации.

### BUG-8. `detectApiBase` без таймаута — **Low/Medium**
- **Где:** [assets/precedent-search.js:61-77](assets/precedent-search.js).
- **Как проявляется:** до 3 последовательных `fetch(...)/health` без `AbortSignal.timeout` — на хостинге (https) запрос к `http://127.0.0.1:8787` блокируется как mixed content (шум в консоли), а в отдельных сетях висит до системного таймаута → страница долго «Загрузка локального индекса...».
- **Исправление:** `fetch(url, { signal: AbortSignal.timeout(1500) })`; на https-странице вообще пропускать http-кандидаты.

### BUG-9. CSV-парсер: строки из полностью пустых полей отбрасываются — **Low**
- **Где:** [scripts/normalize-edrsr.mjs:194](scripts/normalize-edrsr.mjs) — `if (record.some((value) => value.length > 0))`.
- **Суть:** легитимная запись, где все поля пустые строки, молча теряется; также кавычка в середине незакавыченного поля обрабатывается нестандартно. Для реального EDRSR-CSV пока не проявлялось, но парсер самописный и не покрыт негативными тестами.
- **Исправление:** негативные тесты на edge cases CSV (пустые строки, кавычки внутри поля, `\r` без `\n`, поле с переводом строки).

### BUG-10. `rtfToText` не поддерживает `\uN` unicode-escape — **Low**
- **Где:** [scripts/enrich-edrsr-text.mjs:100-164](scripts/enrich-edrsr-text.mjs).
- **Суть:** RTF с `ၱ?`-нотацией (встречается в выгрузках) потеряет символы: контрольное слово пропускается, fallback-символ не выводится. Для cp1251-файлов ЕДРСР пока работает, но это тихая потеря данных на другом источнике.
- **Исправление:** обработать `\uN` (+ `\ucN` skip count) в парсере, добавить тест.

### BUG-11. `/api/decisions/:id` — линейный поиск по массиву — **Low (пока)**
- **Где:** [scripts/serve-search-api.mjs:85](scripts/serve-search-api.mjs).
- **Суть:** `decisions.find(...)` на каждый запрос; на 100 записях незаметно, на реальном корпусе — деградация. Построить `Map<decision_id, decision>` один раз при старте.

---

## 3. Архитектура и структура

### ARCH-1. Дублирование доменной логики клиент/сервер — **главный архитектурный долг**
- **Где:** [assets/precedent-search.js](assets/precedent-search.js) дублирует из `scripts/*.mjs`: `outcomeGroup` + список меток (три копии: клиент, [scripts/analytics-utils.mjs:45-90](scripts/analytics-utils.mjs)), `buildReviewSets`, `articleToKey`, `normalizeLawName` (клиентская версия уже отстала — нет чистки пунктуации из [scripts/legal-text-utils.mjs:91-105](scripts/legal-text-utils.mjs)), `countBy`, `topCounts`, `filterDecisions` (уже разошелся — BUG-7), `includesText`, `clean`.
- **Почему это проблема:** каждое изменение правил классификации нужно вносить в 2-3 места; расхождения уже есть.
- **Исправление:** страницы уже могут использовать `<script type="module">` — вынести общую логику в `assets/shared/` (или отдавать `scripts/*.mjs` как модули) и импортировать одни и те же функции на клиенте и сервере.

### ARCH-2. `parseArgs` скопирован в 5 файлов, `loadJsonl` — в 4
- **Где:** serve-search-api.mjs, normalize-edrsr.mjs, enrich-edrsr-text.mjs, search-sample.mjs, analyze-decisions.mjs.
- **Исправление:** `scripts/cli-utils.mjs` с общими `parseArgs`/`loadJsonl` (в Node 18+ можно перейти на встроенный `util.parseArgs`).

### ARCH-3. `extract-pdf-text.mjs` захардкожен под один конкретный PDF
- **Где:** [scripts/extract-pdf-text.mjs:35](scripts/extract-pdf-text.mjs) — `getObject(pdfSource, "9")` (номер объекта ресурсов), `currentFont = "R10"`.
- **Суть:** скрипт-однодневка, сработает только на readme_2026.pdf. Это нормально для helper'а, но должно быть явно написано в шапке файла, иначе следующий разработчик потратит время на «почему не работает».

### ARCH-4. Структура в целом хорошая
- Разделение `assets/` (клиент), `scripts/` (пайплайн+сервер), `tests/`, `docs/`, `data/sample` (синтетика в git) vs `data/raw|index` (вне git) — грамотное. Zero-dependency подход осознанный. Тестовое покрытие для прототипа хорошее (23 теста, покрыты CLI, API, UI-happy-path).

---

## 4. Чистота кода

- **CLEAN-1.** Магические числа разбросаны: лимиты 5/8/20/30 (фасеты, review sets, топы), порог уверенности `0.65` продублирован в [assets/precedent-search.js:324](assets/precedent-search.js) и [scripts/analytics-utils.mjs:48](scripts/analytics-utils.mjs), длина excerpt 80/260. Вынести в именованные константы одного модуля.
- **CLEAN-2.** `sendJson(response, 204, undefined)` для OPTIONS ([scripts/serve-search-api.mjs:39-42](scripts/serve-search-api.mjs)) — семантически это не JSON-ответ; выделить `sendNoContent`.
- **CLEAN-3.** `queryFromSearchParams` копирует в `query` вообще все параметры и echo'ит их обратно в ответе — стоит whitelist'ить известные фильтры (заодно уменьшит поверхность SEC-4-подобных сюрпризов).
- **CLEAN-4.** В [assets/precedent-search.js:210](assets/precedent-search.js) `renderFacetGroup` вставляет `title` без экранирования — сейчас все вызовы с константами, но функция небезопасна по контракту.
- **CLEAN-5.** Смесь языков интерфейса: `lang="uk"` на `<html>`, контент на русском, данные на украинском. Для скринридеров и SEO это некорректно (см. UX-2).

---

## 5. Производительность

- **PERF-1.** [assets/precedent-search.js:100-103](assets/precedent-search.js) — при первом же заходе без API скачивается `edrsr-2026.first20.text.jsonl` (~440 КБ) целиком до рендера. Приемлемо для прототипа; для прода — компактный индекс без полных текстов + подгрузка текста по клику (эта модель уже реализована в API через `include_text` — применить и к статическому fallback).
- **PERF-2.** `detectApiBase` — до 3 последовательных сетевых проверок до первого рендера (см. BUG-8): параллелить через `Promise.any` + таймаут.
- **PERF-3.** `filterDecisions` на клиенте вызывает `normalize()` (toLocaleLowerCase uk-UA) на каждое поле каждой записи при каждом сабмите — на 20-100 записях ок; при росте — предвычислить нормализованные поля один раз при загрузке.
- **PERF-4.** Статика без кеш-заголовков: dev-сервер не отдает `Cache-Control`/`ETag`. Для Vercel это решается платформой; для собственного сервера — добавить.
- **PERF-5.** Хорошее: нет тяжелых зависимостей, нет фреймворка, один CSS-файл ~11 КБ, JS ~20 КБ без минификации — бандл-проблем нет. `/api/decisions/:id` → Map (BUG-11).

---

## 6. Адаптивность, доступность, UX

- **UX-1.** Диалог решения ([precedent-search.html:185-196](precedent-search.html)): закрытие только кнопкой «Закрыть» и Esc (нативный `<dialog>`). Нет закрытия по клику на backdrop; фокус после `close()` не возвращается на кнопку «Открыть решение». Кнопки `data-open-decision` — обычные `<button>`, это хорошо (клавиатура работает).
- **UX-2.** `lang="uk"` при русском тексте страниц — скринридеры будут читать русский текст украинским синтезом. Либо `lang="ru"` (с `lang="uk"` на украинских цитатах), либо перевести интерфейс на украинский (для украинского юр-продукта логичнее).
- **UX-3.** «Очистить» ([case-status.html:111](case-status.html), [assets/app.js:91-96](assets/app.js)) стирает ВСЕ карточки без подтверждения и без возможности отмены — деструктивное действие в один клик.
- **UX-4.** Нет loading/disabled состояния на кнопке «Показать практику» во время запроса (см. BUG-1/BUG-2); нет сообщений об ошибке сети.
- **UX-5.** Ссылка «Roadmap» в навигации ведет на `.md`-файл — браузер покажет сырой markdown или скачает файл. На проде убрать из пользовательской навигации или конвертировать в HTML.
- **UX-6.** Пустое значение фасета показывается как «unknown» (англ.) среди русского/украинского текста — локализовать.
- **UX-7.** Формы поиска: `articleInput` и др. имеют `<label>` — хорошо; в [legal-check.html:41-55](legal-check.html) поля с `value` захардкожены и `aria-label` дублирует видимый текст label — привести к единому паттерну `<label>` как на других страницах.
- **UX-8.** Адаптивность: styles.css использует grid с медиазапросами — на мобильных страницы работоспособны; отдельных проблем при беглой проверке не выявлено, но нет ни одного автотеста/скриншот-теста на мобильную верстку.

---

## 7. Данные и API

- **DATA-1.** `loadJsonl` падает на первой же битой строке JSONL ([scripts/serve-search-api.mjs:106-113](scripts/serve-search-api.mjs)) — сервер вообще не стартует из-за одной поврежденной записи. Логировать и пропускать битые строки (с счетчиком).
- **DATA-2.** Ответы API не валидируются на клиенте: `renderFromApi` слепо доверяет структуре (`summary.review_sets`, `by_outcome`...). При эволюции формата API старый клиент упадет молча. Минимальная схема-проверка или optional chaining везде + дефолты (частично есть).
- **DATA-3.** `enrich-edrsr-text.mjs` — нет retry на сетевые сбои и нет таймаута fetch; при обрыве соединения запись получает `fetch_error` и никогда не переигрывается автоматически (только повторным запуском). Задокументированное поведение, но добавить `--retry` и `AbortSignal.timeout`.
- **DATA-4.** Хорошее: `include_text` по умолчанию выключен, атрибуция источника (`source_attribution`) присутствует в каждой записи, кэш RTF вне git, минимизация ПД продумана.

---

## 8. Зависимости, конфиги, сборка, деплой

- **DEV-1.** `package.json`: нет поля `engines`. Код требует Node ≥ 18 (fetch, `node --test`), реально разрабатывается на 24. Добавить `"engines": { "node": ">=20" }`.
- **DEV-2.** Нет ESLint/Prettier — при zero-dependency подходе можно хотя бы `node --run` + editorconfig, либо принять осознанно.
- **DEV-3.** Нет CI: GitHub Actions на `npm run check && npm test` — 10 строк, поймает регрессии в PR.
- **DEV-4.** `.gitignore` не покрывал `Claude_sud/` (локальный portable Node.js, ~3700 файлов) — **добавлено в этом коммите**, иначе он улетел бы в GitHub.
- **DEV-5.** Крупные файлы (`data/raw/documents.csv` 889 МБ, `edrsr_data_2026.zip` 170 МБ) корректно игнорируются — в git-историю не попадали. Не снимать эти правила: GitHub жестко режет файлы >100 МБ.
- **DEV-6.** Деплой на Vercel — **подготовлено в этом коммите**:
  - `vercel.json`: security-заголовки (CSP, nosniff, frame-deny, referrer-policy) для статики.
  - `.vercelignore`: исключены `Claude_sud/`, `data/raw/`, `data/index/`, PDF, тесты и скрипты пайплайна — на хостинг уходит только статический сайт + `data/sample/`.
  - Поведение на Vercel: страницы работают как статический прототип; `precedent-search.html` не найдет локальный API и возьмет `data/sample/edrsr-sample.jsonl` (синтетика) — это ожидаемо.
  - **Ограничение:** Node-API (`scripts/serve-search-api.mjs`) на Vercel в таком виде не работает. Для живого API нужно переоформить обработчики в serverless-функции `api/search.mjs`, `api/analyze.mjs`, `api/decisions/[id].mjs` (логика уже отделена в `search-utils.mjs`/`analytics-utils.mjs`, перенос несложный) — пункт в план исправлений.
  - Подключение: импортировать репозиторий `Flumos1/codex_sud` в Vercel (Add New Project → Import), Framework Preset: **Other**, Build Command: пусто, Output Directory: корень.

---

## Приоритетный план исправлений (чеклист)

> **Статус на 2026-07-06 (ветка `audit-fixes`):** выполнены все P0 и P1, большая часть P2 и P3. Тесты: **40/40**.
>
> **Второй заход (те же ветка/сессия):** реализованы serverless-функции API для Vercel (общее ядро `scripts/api-core.mjs`, функции `api/*.mjs`), устранён BUG-7 (клиентский фильтр сведён к серверной семантике), попутно исправлен обнаруженный баг несоответствия словаря формы и данных (фильтры «Инстанция»/«Тип решения» молча возвращали пусто), сделан UX-2 (`lang="ru"`). E2E-проверка в браузере: страница подключается к API, фильтры и диалог решения работают, ошибок в консоли нет. Остаётся отложенным только полный ARCH-1 (браузер по-прежнему держит свою копию форматирования, хотя поведение уже сведено к серверу) и PERF-1 (не нужен при текущем размере данных — см. ниже).

**P0 — до любого публичного деплоя с API:**
- [x] SEC-1: валидация `?api=` (только localhost) + приведение числовых полей к `Number` (`safeCount`).
- [x] SEC-2: проверка схемы `source_url` (`safeHttpUrl`, только http/https).
- [x] SEC-4: `MAX_LIMIT=100` + `resolveLimit` возвращает 400 на невалидный limit; whitelist параметров запроса.
- [x] SEC-3: dev-сервер запрещает dot-файлы (`.git`, `.env`), `data/raw/`, ограничивает whitelist расширений.

**P1 — стабильность UX:**
- [x] BUG-1: try/catch + `showSearchError` + `setLoading` (disabled/aria-busy) на сабмите поиска.
- [x] BUG-2: `AbortController` — отмена предыдущего запроса.
- [x] BUG-3: `Array.isArray` в `readCards()`; BUG-4: try/catch в `writeCards()`.
- [x] BUG-8: `AbortSignal.timeout(1500)` в `detectApiBase`, пропуск http-кандидатов на https.
- [x] UX-3: `window.confirm` перед «Очистить».

**BUG-7 — расхождение фильтров клиент/сервер:**
- [x] Клиентский `filterDecisions` сведён к серверной семантике (точное сравнение `level`, `q` без `category`), с комментарием-ссылкой на `scripts/search-utils.mjs`.
- [x] Попутно: значения `court_level`/`decision_type` в синтетическом сэмпле приведены к украинской канонической лексике пайплайна, а `value` опций «Инстанция» в форме — к ним же; иначе фильтры молча возвращали пусто на деплое. Добавлен регресс-тест.

**P2 — архитектура и качество:**
- [~] ARCH-1: **частично.** Общее ядро API (`resolveLimit`, `projectDecision`, `handleSearch/Analyze/Decision`, whitelist) вынесено в `scripts/api-core.mjs` и используется и Node-сервером, и serverless-функциями. Браузер поведенчески сведён к серверу (BUG-7), но всё ещё держит свою копию форматирования/группировки — полное объединение браузера с сервером требует смены модели теста (vm → ESM) и отложено.
- [x] ARCH-2: общий `scripts/cli-utils.mjs` (`parseArgs`, `readJsonl`) вместо 5 копий.
- [x] SEC-5/SEC-6/SEC-7: CORS whitelist (env `SEARCH_API_ALLOWED_ORIGINS`), скрытие `error.message`, security-заголовки в dev-сервере.
- [x] DATA-1: `readJsonl` пропускает битые строки с предупреждением.
- [x] BUG-5/BUG-6: регулярка `remanded` по падежам + приоритет над `transferred`; тесты добавлены.
- [x] DEV-1: `engines: node>=20` в package.json; DEV-3: GitHub Actions CI (`.github/workflows/ci.yml`).

**P3 — продуктовые улучшения:**
- [x] Serverless-функции API для Vercel (`api/health`, `api/search`, `api/analyze`, `api/decisions/[id]`), общий загрузчик `api/_data.mjs`, конфиг `vercel.json` (`functions.includeFiles`) и `.vercelignore` (scripts/ теперь деплоится). Браузер определяет same-origin API через `/api/health`.
- [x] UX-1: фокус-менеджмент диалога (возврат фокуса на триггер) + закрытие по клику на backdrop.
- [x] UX-2: `lang="ru"` на всех страницах (интерфейс преимущественно на русском; данные/термины на украинском сохранены).
- [x] UX-5: ссылка Roadmap убрана из пользовательской навигации на всех страницах.
- [~] PERF-1: **не требуется при текущих данных.** На Vercel деплоится только 5-записный сэмпл (~6 КБ), крупный `first20`-индекс git-игнорируется и не публикуется; карточки списка и так рендерят только excerpt, а полный текст берётся по клику через `/api/decisions/:id`. Отдельный генератор компактного индекса был бы преждевременной оптимизацией.
- [x] BUG-11: `Map<decision_id, decision>` для `/api/decisions/:id`.
