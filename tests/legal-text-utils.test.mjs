import assert from "node:assert/strict";
import test from "node:test";
import {
  articleToKey,
  classifyOutcome,
  extractArticles,
  getArticleKeys,
  includesText,
  normalizeArticleKey,
  normalizeLawName,
} from "../scripts/legal-text-utils.mjs";

test("extractArticles normalizes common Ukrainian code names", () => {
  const text = [
    "Суд застосував ст. 625 ЦК України.",
    "Відповідно до частини першої статті 333 Кодексу адміністративного судочинства України,",
    "касаційний суд вирішує питання про відкриття провадження.",
  ].join(" ");

  const result = extractArticles(text);

  assert.deepEqual(result.articleKeys, ["ЦК України:625", "КАС України:333"]);
  assert.deepEqual(result.laws, ["ЦК України", "КАС України"]);
  assert.equal(result.excerpts.length, 2);
});

test("classifyOutcome reads the dispositive part, not only party requests", () => {
  const text = [
    "Позивач просив скасувати рішення та задовольнити позов.",
    "Суд, дослідивши матеріали справи, УХВАЛИВ:",
    "У задоволенні позову відмовити.",
  ].join(" ");

  assert.equal(classifyOutcome(text).label, "dismissed");
});

test("classifyOutcome detects procedural cassation outcomes", () => {
  const refused = [
    "Верховний Суд перевірив касаційну скаргу.",
    "ПОСТАНОВИВ: Відмовити у відкритті касаційного провадження.",
  ].join(" ");
  const returned = [
    "Суд встановив недоліки касаційної скарги.",
    "УХВАЛИВ: Касаційну скаргу повернути заявнику.",
  ].join(" ");

  assert.equal(classifyOutcome(refused).label, "cassation_refused_opening");
  assert.equal(classifyOutcome(returned).label, "cassation_returned");
});

test("classifyOutcome detects remand across grammatical cases", () => {
  const nominative = [
    "Суд скасував рішення суду першої інстанції.",
    "ПОСТАНОВИВ: справу направити на новий розгляд.",
  ].join(" ");
  const genitive = [
    "Апеляційний суд встановив порушення норм процесуального права.",
    "ПОСТАНОВИВ: передати справу для нового розгляду до суду першої інстанції.",
  ].join(" ");

  assert.equal(classifyOutcome(nominative).label, "remanded");
  assert.equal(classifyOutcome(genitive).label, "remanded");
});

test("article key helpers keep search filters stable", () => {
  assert.equal(normalizeLawName("Кодексу адміністративного судочинства України"), "КАС України");
  assert.equal(normalizeLawName("130 КУпАП"), "КУпАП");
  assert.equal(normalizeArticleKey("333", "Кодексу адміністративного судочинства України"), "КАС України:333");
  assert.equal(articleToKey("130 КУпАП"), "КУпАП:130");
  assert.equal(articleToKey("стаття 130 Кодексу України про адміністративні правопорушення"), "КУпАП:130");
  assert.deepEqual(getArticleKeys({ cited_articles: ["625 Цивільного кодексу України"] }), ["ЦК України:625"]);
});

test("includesText is case-insensitive and whitespace-tolerant for Ukrainian text", () => {
  assert.equal(includesText("Касаційний   адміністративний суд", "адміністративний суд"), true);
  assert.equal(includesText("КАС України:333", "кас україни:333"), true);
});
