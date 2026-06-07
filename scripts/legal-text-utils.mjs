export function extractArticles(text) {
  const articles = new Set();
  const articleKeys = new Set();
  const laws = new Set();
  const excerpts = [];
  const normalized = clean(text);
  const lawPattern = [
    "(?:ЦК|КК|КПК|ЦПК|ГПК|КАС)\\s+України",
    "КУпАП",
    "Кодексу\\s+України\\s+про\\s+адміністративні\\s+правопорушення",
    "Кримінального\\s+кодексу\\s+України",
    "Кримінального\\s+процесуального\\s+кодексу\\s+України",
    "Цивільного\\s+кодексу\\s+України",
    "Цивільного\\s+процесуального\\s+кодексу\\s+України",
    "Господарського\\s+процесуального\\s+кодексу\\s+України",
    "Кодексу\\s+адміністративного\\s+судочинства\\s+України",
  ].join("|");
  const pattern = new RegExp(
    `(?:ст\\.?|статт(?:я|і|ею))\\s*(\\d+(?:[-–]\\d+)?(?:\\s*[\\u00b9\\u00b2\\u00b3])?)\\s*(${lawPattern})`,
    "giu",
  );

  for (const match of normalized.matchAll(pattern)) {
    const article = clean(match[1]);
    const law = normalizeLawName(match[2]);
    if (!article || !law) continue;
    articles.add(`${article} ${law}`);
    articleKeys.add(normalizeArticleKey(article, law));
    laws.add(law);
    excerpts.push(excerptAround(normalized, match.index, match[0].length));
  }

  return {
    articles: [...articles],
    articleKeys: [...articleKeys],
    laws: [...laws],
    excerpts: unique(excerpts),
  };
}

export function classifyOutcome(text) {
  const decisionPart = getDispositivePart(text);
  const normalized = normalizeText(decisionPart || text);
  const rules = [
    ["appeal_dismissed", 0.9, /апеляційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*\s+.{0,120}залишити\s+без\s+задоволення/u],
    ["cassation_dismissed", 0.9, /касаційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*\s+.{0,120}залишити\s+без\s+задоволення/u],
    ["appeal_granted", 0.9, /апеляційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*\s+.{0,120}задовольнити/u],
    ["cassation_granted", 0.9, /касаційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*\s+.{0,120}задовольнити/u],
    ["left_unchanged", 0.88, /рішенн[а-яіїєґa-z_]*\s+.{0,120}залишити\s+без\s+змін/u],
    ["cassation_refused_opening", 0.92, /відмовити\s+у\s+відкритті\s+касаційн[а-яіїєґa-z_]*\s+провадження/u],
    ["cassation_opened", 0.9, /відкрити\s+касаційн[а-яіїєґa-z_]*\s+провадження/u],
    ["cassation_returned", 0.9, /касаційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*\s+.{0,120}повернути|повернути\s+.{0,120}касаційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*/u],
    ["case_scheduled", 0.84, /призначити\s+справ[а-яіїєґa-z_]*\s+.{0,160}до\s+.{0,80}розгляду/u],
    ["motion_denied", 0.86, /у\s+задоволенн[ія]\s+заяв[а-яіїєґa-z_]*\s+.{0,160}відмовити/u],
    ["transferred", 0.82, /передати\s+.{0,120}(касаційн[а-яіїєґa-z_]*\s+скарг[а-яіїєґa-z_]*|справ[а-яіїєґa-z_]*)/u],
    ["partially_satisfied", 0.88, /задовольнити\s+частково|частково\s+задовольнити/u],
    ["dismissed", 0.88, /у\s+задоволенн[ія]\s+.{0,80}відмовити|відмовити\s+у\s+задоволенн[ія]/u],
    ["satisfied", 0.84, /позов\s+задовольнити|заяву\s+задовольнити|скаргу\s+задовольнити/u],
    ["remanded", 0.86, /направити\s+.{0,80}нов(ий|ий)\s+розгляд|передати\s+.{0,80}нов(ий|ий)\s+розгляд/u],
    ["cancelled", 0.82, /скасувати/u],
    ["changed", 0.82, /змінити/u],
    ["closed", 0.86, /провадження\s+.{0,80}закрити|закрити\s+провадження/u],
  ];

  for (const [label, confidence, pattern] of rules) {
    const match = normalized.match(pattern);
    if (match) {
      return {
        label,
        confidence,
        excerpts: [excerptAround(text, match.index, match[0].length)],
      };
    }
  }

  return { label: "unknown", confidence: 0, excerpts: [] };
}

export function getArticleKeys(item) {
  if (item.cited_article_keys?.length) return item.cited_article_keys;
  return (item.cited_articles || []).map(articleToKey);
}

export function articleToKey(value) {
  const text = String(value || "");
  const article = text.match(/\d+(?:[-–]\d+)?/)?.[0] || "";
  const law = normalizeLawName(text);
  return article && law ? `${law}:${article}` : text;
}

export function normalizeLawName(value) {
  const text = clean(value)
    .replace(/[.,;:)\]]+$/g, "")
    .replace(/\s+/g, " ");
  const known = [
    ["КК України", /(^|[^а-яіїєґa-z])КК($|[^а-яіїєґa-z])|Кримінальн/iu],
    ["КПК України", /(^|[^а-яіїєґa-z])КПК($|[^а-яіїєґa-z])|Кримінальн[а-яіїєґa-z]*\s+процесуальн/iu],
    ["КУпАП", /(^|[^а-яіїєґa-z])КУпАП($|[^а-яіїєґa-z])|адміністративні правопорушення/iu],
    ["ЦК України", /(^|[^а-яіїєґa-z])ЦК($|[^а-яіїєґa-z])|Цивільн[а-яіїєґa-z]*\s+кодекс/iu],
    ["ЦПК України", /(^|[^а-яіїєґa-z])ЦПК($|[^а-яіїєґa-z])|Цивільн[а-яіїєґa-z]*\s+процесуальн/iu],
    ["ГПК України", /(^|[^а-яіїєґa-z])ГПК($|[^а-яіїєґa-z])|Господарськ[а-яіїєґa-z]*\s+процесуальн/iu],
    ["КАС України", /(^|[^а-яіїєґa-z])КАС($|[^а-яіїєґa-z])|адміністративн[а-яіїєґa-z]*\s+судочинства/iu],
  ];
  return known.find(([, pattern]) => pattern.test(text))?.[0] || text.slice(0, 80);
}

export function normalizeArticleKey(article, law) {
  return `${normalizeLawName(law)}:${clean(article).replace(/\s+/g, "")}`;
}

export function includesText(value, needle) {
  return normalizeText(value).includes(normalizeText(needle));
}

export function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function excerptAround(text, index = 0, length = 0) {
  const source = clean(text);
  const start = Math.max(0, index - 80);
  const end = Math.min(source.length, index + length + 80);
  return source.slice(start, end).trim();
}

function getDispositivePart(text) {
  const source = clean(text);
  const markers = [
    /п\s*о\s*с\s*т\s*а\s*н\s*о\s*в\s*и\s*(в|л\s*а|л\s*и)\s*[:\-]?/giu,
    /у\s*х\s*в\s*а\s*л\s*и\s*(в|л\s*а|л\s*и)\s*[:\-]?/giu,
    /в\s*и\s*р\s*і\s*ш\s*и\s*(в|л\s*а|л\s*и)\s*[:\-]?/giu,
  ];
  let lastIndex = -1;

  for (const pattern of markers) {
    for (const match of source.matchAll(pattern)) {
      lastIndex = Math.max(lastIndex, match.index + match[0].length);
    }
  }

  return lastIndex >= 0 ? source.slice(lastIndex) : source;
}

function normalizeText(value) {
  return clean(value).toLocaleLowerCase("uk-UA");
}
