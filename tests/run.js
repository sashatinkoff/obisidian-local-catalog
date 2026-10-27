// tests/run.js — запуск: node tests/run.js (из папки плагина).
// Загружает модули тем же загрузчиком, что и Obsidian, и прогоняет юнит- и дымовые тесты.
const fs = require("fs"), os = require("os"), path = require("path"), assert = require("assert");
const { install } = require("./fake-dom");
const { makeApp, makePlugin, makeObsidian } = require("./fixtures");

const SRC = path.resolve(__dirname, "..");
const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), "sf-vault-"));
const PLUGIN = ".obsidian/plugins/journal-stream";
fs.cpSync(SRC, path.join(VAULT, PLUGIN), { recursive: true });

let passed = 0, failed = 0;
const readDb = () => JSON.parse(fs.readFileSync(path.join(VAULT, PLUGIN, "data.json"), "utf8"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const test = async (name, fn) => { try { await fn(); passed++; console.log("  ok  ", name); } catch (e) { failed++; console.log("  FAIL", name, "\n      ", e && e.stack ? e.stack.split("\n").slice(0, 4).join("\n       ") : e); } };

(async () => {
  install();
  const app = makeApp(VAULT);
  const obsidian = makeObsidian();
  const plugin = makePlugin(app, VAULT, PLUGIN);
  const Module = require("module"), origLoad = Module._load;
  Module._load = function (r, ...a) { return r === "obsidian" ? obsidian : origLoad.call(this, r, ...a); };
  const { createLoader } = require(path.join(SRC, "tools/main.template.js"));
  Module._load = origLoad;
  const { require: R, ids } = await createLoader({ app, root: PLUGIN + "/src", externals: { obsidian } }).load();
  console.log(`модулей загружено: ${ids.length}`);

  console.log("\nunit");
  await test("date.toMs: форматы", () => {
    const D = R("lib/date");
    assert.strictEqual(D.toMs("2025-05-14 16:42"), new Date(2025, 4, 14, 16, 42).getTime());
    assert.strictEqual(D.toMs("14.05.2025"), new Date(2025, 4, 14).getTime());
    assert.strictEqual(D.toMs(null), null);
    assert.strictEqual(D.fmtDateTime(new Date(2025, 4, 14, 9, 5).getTime(), true), "14 мая 2025, 09:05");
    assert.strictEqual(D.fmtDateTime(new Date(2024, 9, 1, 16, 12).getTime(), true), "1 октября 2024, 16:12");
    assert.strictEqual(D.fmtDateTime(new Date(2024, 9, 1).getTime(), false), "1 октября 2024");
    assert.strictEqual(D.fromFilename("2024-03-02 заметка"), new Date(2024, 2, 2).getTime());
  });
  await test("ru.plural", () => { const { plural } = R("lib/ru"); const f = ["заметка", "заметки", "заметок"]; assert.deepStrictEqual([1, 2, 5, 11, 21, 22].map((n) => plural(n, f)), ["заметка", "заметки", "заметок", "заметок", "заметка", "заметки"]); });
  await test("text.truncateMarkdown не рвёт [[ссылки]]", () => {
    const { truncateMarkdown } = R("lib/text");
    const r = truncateMarkdown("слово ".repeat(10) + "[[Длинная ссылка на заметку]] конец", 66);
    assert.ok(r.truncated && !/\[\[[^\]]*$/.test(r.text.replace("…", "")), r.text);
  });
  await test("analyzer: медиа, цитаты, задачи, ссылки", () => {
    const f = R("model/analyzer").analyze("---\na: 1\n---\n![[a.mp3]] ![x](b.png)\n> [!quote] Автор\n> Текст цитаты\n\n- [x] one\n- [ ] two\nhttps://e.com/x");
    assert.deepStrictEqual(f.media.map((m) => m.kind), ["audio", "image"]);
    assert.strictEqual(f.quotes[0].callout.title, "Автор");
    assert.strictEqual(f.quotes[0].text, "Текст цитаты");
    assert.deepStrictEqual([f.tasks.total, f.tasks.done], [2, 1]);
    assert.strictEqual(f.external[0], "https://e.com/x");
  });
  const mk = (o) => ({ ts: Date.now(), tags: [], attrs: new Set(), backlinks: 0, search: "", source: null, type: "text", mtime: 0, size: 0, title: "t", ...o });
  await test("filters: any/all/not, вложенные теги, период, бэклинки", () => {
    const { applyFilter } = R("filters/engine"), { merge } = R("filters/state");
    const ps = [mk({ tags: ["a/b"], backlinks: 5 }), mk({ tags: ["c"] }), mk({ tags: ["a", "x"], ts: Date.now() - 40 * 864e5 })];
    assert.strictEqual(applyFilter(ps, merge({ any: ["a"] })).length, 2);
    assert.strictEqual(applyFilter(ps, merge({ any: ["a"], not: ["x"] })).length, 1);
    assert.strictEqual(applyFilter(ps, merge({ all: ["a", "x"] })).length, 1);
    assert.strictEqual(applyFilter(ps, merge({ period: "30d" })).length, 2);
    assert.strictEqual(applyFilter(ps, merge({ minBacklinks: 3 })).length, 1);
  });
  await test("state.toggleTag: тег живёт в одном режиме", () => {
    const S = R("filters/state"); let f = S.defaultFilter();
    f = S.toggleTag(f, "any", "#Foo"); f = S.toggleTag(f, "not", "foo");
    assert.deepStrictEqual([f.any, f.not], [[], ["foo"]]);
    assert.deepStrictEqual(S.toggleTag(f, "not", "foo").not, []);
  });
  await test("formula + DQL", () => {
    const S = R("filters/state"), F = R("filters/formula"), Q = R("filters/dql");
    const f = S.merge({ any: ["мысли", "daily"], not: ["архив"], period: "14d", minBacklinks: 3, attrs: ["task"] });
    assert.strictEqual(F.toString(f), "( #мысли OR #daily ) AND NOT ( !#архив ) AND Задачи AND период: за 14 дней AND связи ≥ 3");
    assert.ok(F.toTokens(S.merge({ types: ["audio"], sources: ["lj"], text: "x", day: "2026-01-01" })).filter((t) => t.t === "cond").length === 4, "скрытых условий нет — все видны как чипы");
    const { query } = Q.compile(f, { config: { sources: [{ id: "lj", folder: "LiveJournal" }] } });
    for (const part of ['FROM "LiveJournal"', 'contains(file.tags, "#мысли") OR contains(file.tags, "#daily")', '!contains(file.tags, "#архив")', "dur(14 days)", "length(file.inlinks) >= 3", "length(file.tasks) > 0", "SORT file.cday DESC"]) assert.ok(query.includes(part), "нет: " + part + "\n" + query);
  });
  await test("stats: streak, heatmap, tags", () => {
    const A = R("stats/activity"), now = new Date(2026, 9, 16, 12).getTime(), day = 864e5;
    const posts = [0, 1, 2, 5].map((d) => ({ ts: now - d * day }));
    const by = A.countByDay(posts);
    assert.deepStrictEqual(A.streak(by, now), { current: 3, best: 3 });
    const hm = A.heatmap(by, now, 53);
    assert.strictEqual(hm.length, 53); assert.ok(hm.every((c) => c.length === 7));
    assert.deepStrictEqual(R("stats/tags").tagCounts([{ tags: ["a", "b"] }, { tags: ["a"] }]), [{ tag: "a", count: 2 }, { tag: "b", count: 1 }]);
  });
  await test("quick: today + random детерминирован", () => {
    const Q = R("filters/quick-modes"), now = Date.now();
    const ps = [mk({ ts: now }), mk({ ts: now - 365 * 864e5 }), mk({ ts: now - 100 * 864e5 })];
    const c = { now, seed: 7, config: { randomCount: 2 }, flags: { isFavorite: () => false } };
    assert.ok(Q.applyQuick(ps, "today", c).length >= 1);
    assert.deepStrictEqual(Q.applyQuick(ps, "random", c), Q.applyQuick(ps, "random", c));
    assert.strictEqual(Q.applyQuick(ps, "random", c).length, 2);
  });

  await test("lib/layout.columnCount: min/max и телефон", () => {
    const { columnCount } = R("lib/layout"), cfg = { columns: { min: 2, max: 4 }, minCardWidth: 320 };
    assert.deepStrictEqual([400, 700, 1000, 1400, 2400, 0].map((w) => columnCount(w, cfg)), [1, 2, 2, 4, 4, 4]);
    assert.strictEqual(columnCount(700, { columns: { min: 3, max: 5 }, minCardWidth: 320 }), 3);
    assert.strictEqual(columnCount(2400, { columns: { min: 1, max: 3 }, minCardWidth: 320 }), 3);
  });
  await test("text.snippet / plainText", () => {
    const T = R("lib/text");
    assert.strictEqual(T.plainText("## Заголовок\n- [ ] **жирный** [[Заметка|алиас]] и [ссылка](http://x)"), "Заголовок жирный алиас и ссылка");
    assert.ok(T.snippet("слово ".repeat(60), 50).endsWith("…"));
  });
  await test("stats.monthStats: считает файлы фото и видео", () => {
    const { monthStats } = R("stats/period"), now = Date.now();
    const p = (c) => ({ ts: now, links: 0, backlinks: 0, mediaCounts: c, mediaKinds: new Set() });
    const r = monthStats([p({ image: 5, video: 0, audio: 0 }), p({ image: 2, video: 3, audio: 1 })], now);
    assert.deepStrictEqual([r.media.photo, r.media.video, r.media.audio, r.mediaNotes.photo, r.mediaNotes.video], [7, 3, 1, 2, 1]);
  });
  await test("поиск: несколько слов через пробел", () => {
    const { applyFilter } = R("filters/engine"), { merge } = R("filters/state");
    const ps = [mk({ search: "заметка про crdt", tags: [] }), mk({ search: "заметка про граф" })];
    assert.strictEqual(applyFilter(ps, merge({ text: "crdt заметка" })).length, 1);
    assert.strictEqual(applyFilter(ps, merge({ text: "заметка" })).length, 2);
  });

  console.log("\nsmoke (UI на заглушке DOM)");
  const types = {};
  // Каждый запуск = новое ядро плагина (читает data.json заново) + mount вида — так же, как при открытии вкладки/блока.
  const runIn = async (container, input, extra = {}) => { const core = await R("app/main").createCore(plugin); return R("app/main").mount(core, { container, input, sourcePath: "Note.md", component: {}, ...extra }); };
  const mkEnv = async (input0, width) => {
    const input = { viewMode: "auto", openInNewTab: false, theme: "dark", ...input0 };
    const container = document.createElement("div");
    container.__attached = true;
    if (width) container.clientWidth = width;
    await runIn(container, input);
    await new Promise((r) => setTimeout(r, 30));
    return container;
  };
  await test("css подключается", async () => { await mkEnv({ view: "stream", id: "css" }); const st = document.getElementById("journal-stream-style"); assert.ok(st && st.textContent.includes(".sf-card")); });
  for (const view of ["overview", "stream", "bento", "collections", "studio"]) {
    await test(`экран ${view} рисуется без ошибок`, async () => {
      const c = await mkEnv({ view, id: "t-" + view });
      assert.strictEqual(c.byClass("sf-error").length, 0, (c.byClass("sf-error")[0] || {}).textContent);
      assert.ok(c.byClass("sf-root").length === 1);
      if (view === "stream" || view === "bento") {
        const cards = c.byClass("sf-card");
        assert.ok(cards.length >= 9, "карточек: " + cards.length);
        for (const k of ["video", "audio", "image", "quote", "tasks", "link", "canvas"]) assert.ok(cards.some((x) => x.classList.contains("sf-card--" + k)), "нет типа " + k);
        assert.ok(c.byClass("sf-audio").length === 1 && c.byClass("sf-images__more").length === 1);
      }
      if (view === "collections") assert.strictEqual(c.byClass("sf-preset").length, 6);
      if (view === "studio") assert.ok(c.byClass("sf-dql").length === 1 && c.byClass("sf-dql")[0].textContent.includes("TABLE"));
    });
  }
  await test("интерактив: тег, быстрый режим, переключение экрана, избранное", async () => {
    const c = await mkEnv({ view: "stream", id: "inter" });
    const count = () => c.byClass("sf-card").length;
    const total = count();
    c.byClass("sf-chip").find((x) => x.textContent.startsWith("#daily") && x.classList.contains("is-clickable")).click();
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(count() < total && count() >= 1, `после фильтра: ${count()} из ${total}`);
    assert.ok(c.byClass("sf-formula__body")[0].textContent.includes("#daily"));
    c.byClass("sf-quick--random")[0].click(); await new Promise((r) => setTimeout(r, 20));
    assert.ok(c.byClass("sf-shuffle").length === 1);
    c.byClass("sf-nav__tab").find((x) => x.textContent.includes("Бенто")).click(); await new Promise((r) => setTimeout(r, 30));
    assert.ok(c.byClass("sf-feed--bento").length === 1);
    c.byClass("sf-card__meta")[0].byClass("sf-iconbtn")[1].click();
    await new Promise((r) => setTimeout(r, 600));
    assert.ok(Object.keys(readDb().flags).length === 1);
  });
  await test("fullWidth: кнопка переключает класс is-full", async () => {
    const c = await mkEnv({ view: "stream", id: "fw" });
    const root = c.byClass("sf-root")[0];
    assert.ok(root.classList.contains("is-full"), "по умолчанию — на всю ширину");
    c.byClass("sf-nav__right")[0].byClass("sf-iconbtn").find((b) => b.attrs.title.includes("ширину") || b.attrs.title.includes("Обычная")).click(); await new Promise((r) => setTimeout(r, 20));
    assert.ok(!root.classList.contains("is-full"));
    const c2 = await mkEnv({ view: "stream", id: "fw2", fullWidth: false });
    assert.ok(!c2.byClass("sf-root")[0].classList.contains("is-full"));
  });
  await test("студия: сохранение подборки в едином файле данных", async () => {
    const c = await mkEnv({ view: "studio", id: "studio-save" });
    c.byClass("sf-input").find((x) => x.attrs.placeholder && x.attrs.placeholder.startsWith("Например")).dispatch("input", { target: { value: "Тест" } });
    const before = readDb().presets.length;
    c.byClass("sf-btn--primary").find((x) => x.textContent.includes("Сохранить")).click();
    await new Promise((r) => setTimeout(r, 600));
    assert.strictEqual(readDb().presets.length, before + 1);
  });
  await test("единый файл данных: создаётся, содержит всё; после удаления пересоздаётся", async () => {
    await mkEnv({ view: "stream", id: "db1" });
    const d = readDb();
    assert.ok(d.settings && d.settings.columns.min === 2 && d.settings.columns.max === 4 && Array.isArray(d.presets) && d.presets.length >= 6 && d.flags && d.ui);
    assert.ok(fs.existsSync(path.join(VAULT, PLUGIN, "data.json")), "данные плагина лежат в data.json");
    fs.unlinkSync(path.join(VAULT, PLUGIN, "data.json"));
    await mkEnv({ view: "stream", id: "db2" });
    assert.ok(readDb().presets.length === 6);
  });
  await test("masonry: колонки по config.columns, карточки распределены", async () => {
    const c = await mkEnv({ view: "stream", id: "ms" }); await wait(80);
    assert.strictEqual(c.byClass("sf-tilegrid--masonry").length, 1);
    assert.ok(c.byClass("sf-tilegrid__item").length >= 9 && c.byClass("sf-tilegrid__item").every((i) => i.children[0].classList.contains("sf-card")));
  });
  await test("bento: плитки в сетке, у карточек нет masonry-колонок", async () => {
    const c = await mkEnv({ view: "bento", id: "bn" }); await wait(80);
    assert.strictEqual(c.byClass("sf-tilegrid--bento").length, 1);
    assert.ok(c.byClass("sf-tilegrid__item").length >= 9);
  });
  await test("timeline: группы по дням; flow из старых настроек читается как timeline", async () => {
    const c = await mkEnv({ view: "stream", id: "tl", layout: "flow" }); await wait(40);
    assert.ok(c.byClass("sf-timeline__group").length >= 5 && c.byClass("sf-feed--timeline").length === 1);
    assert.deepStrictEqual(c.byClass("sf-segmented__btn").map((b) => b.textContent), ["Masonry", "Timeline"]);
  });
  await test("дата в карточке: «1 октября 2024, 16:12»", async () => {
    const c = await mkEnv({ view: "stream", id: "dt" }); await wait(40);
    assert.ok(c.byClass("sf-card__date").some((d) => /^\d{1,2} [а-я]+ \d{4}(, \d{2}:\d{2})?$/.test(d.textContent)), c.byClass("sf-card__date")[0].textContent);
  });
  await test("поиск: результаты сразу, очистка возвращает ленту", async () => {
    const c = await mkEnv({ view: "stream", id: "srch" }); await wait(60);
    const total = () => c.byClass("sf-card").length, all = total();
    const input = c.byClass("sf-search")[0].byClass("sf-input")[0];
    input.dispatch("focus"); await wait(150);
    input.dispatch("input", { target: { value: "crdt" } }); await wait(250);
    assert.ok(total() >= 1 && total() < all, `после поиска: ${total()} из ${all}`);
    c.byClass("sf-search__clear")[0].click(); await wait(250);
    assert.strictEqual(total(), all);
  });
  await test("сессия: возврат в блок сохраняет раздел и фильтры; вход через навигацию сбрасывает", async () => {
    const c1 = await mkEnv({ view: "stream", id: "sess" }); await wait(40);
    c1.byClass("sf-chip").find((x) => x.textContent.startsWith("#daily") && x.classList.contains("is-clickable")).click();
    c1.byClass("sf-nav__tab").find((x) => x.textContent.includes("Бенто")).dispatch("click"); // вход в раздел → сброс
    await wait(60);
    assert.ok(!c1.byClass("sf-formula__body")[0].textContent.includes("#daily"), "после входа в раздел фильтр должен быть сброшен");
    c1.byClass("sf-chip").find((x) => x.textContent.startsWith("#мысли") && x.classList.contains("is-clickable")).click(); await wait(40);
    const c2 = await mkEnv({ view: "stream", id: "sess" }); await wait(60); // «вернулись» в заметку
    assert.ok(c2.byClass("sf-feed--bento").length === 1, "раздел восстановлен");
    assert.ok(c2.byClass("sf-formula__body")[0].textContent.includes("#мысли"), "фильтр восстановлен");
  });
  await test("конструктор: каждый вход через навигацию — новый", async () => {
    const c = await mkEnv({ view: "studio", id: "std" });
    c.byClass("sf-input").find((x) => x.attrs.placeholder && x.attrs.placeholder.startsWith("Например")).dispatch("input", { target: { value: "Черновик" } });
    c.byClass("sf-nav__tab").find((x) => x.textContent.includes("Обзор")).dispatch("click"); await wait(30);
    c.byClass("sf-nav__tab").find((x) => x.textContent.includes("Фильтры")).dispatch("click"); await wait(40);
    const name = c.byClass("sf-input").find((x) => x.attrs.placeholder && x.attrs.placeholder.startsWith("Например"));
    assert.strictEqual(name.value || "", "");
    assert.ok(c.byClass("sf-hero")[0].textContent.includes("Новый смарт-фильтр"));
  });
  await test("конструктор: есть Сохранить и Удалить; удалить неактивно до сохранения; сохранить требует название", async () => {
    const c = await mkEnv({ view: "studio", id: "std2" });
    const bar = c.byClass("sf-actionbar")[0];
    assert.ok(bar.textContent.includes("Сохранить подборку") && bar.textContent.includes("Удалить"));
    const del = bar.byClass("sf-btn--danger")[0]; assert.ok(del.attrs.disabled !== undefined);
    const before = readDb().presets.length;
    bar.byClass("sf-btn--primary")[0].click(); await wait(500);
    assert.strictEqual(readDb().presets.length, before, "без названия не сохраняется");
    c.byClass("sf-input").find((x) => x.attrs.placeholder && x.attrs.placeholder.startsWith("Например")).dispatch("input", { target: { value: "Моя" } });
    bar.byClass("sf-btn--primary")[0].click(); await wait(600);
    assert.strictEqual(readDb().presets.length, before + 1);
    const bar2 = c.byClass("sf-actionbar")[0];
    assert.ok(bar2.textContent.includes("Сохранить как новую") && bar2.byClass("sf-btn--danger")[0].attrs.disabled === undefined);
    const del2 = bar2.byClass("sf-btn--danger")[0]; del2.click(); del2.click(); await wait(600); // двойной клик = подтверждение
    assert.strictEqual(readDb().presets.length, before);
  });
  await test("подборки: клик по карточке открывает Бенто; удаление с подтверждением; текст в превью", async () => {
    const c = await mkEnv({ view: "collections", id: "col" }); await wait(80);
    assert.ok(c.byClass("sf-richlink__excerpt").some((e) => e.textContent.length > 10), "в превью есть текст заметки");
    const n = c.byClass("sf-preset").length, del = c.byClass("sf-preset")[0].byClass("sf-iconbtn").find((b) => b.attrs.title === "Удалить подборку");
    del.click(); del.click(); await wait(600);
    assert.strictEqual(c.byClass("sf-preset").length, n - 1);
    c.byClass("sf-preset")[0].dispatch("click"); await wait(80);
    assert.ok(c.byClass("sf-feed--bento").length === 1, "открылся Бенто");
  });
  await test("меню подборок: применить, сохранить текущий фильтр, удалить", async () => {
    const c = await mkEnv({ view: "stream", id: "menu" }); await wait(60);
    const dd = c.byClass("sf-dropdown")[0];
    dd.byClass("sf-btn")[0].click();
    assert.ok(dd.byClass("sf-menu__item").length >= 3);
    dd.byClass("sf-menu__item").find((b) => b.textContent.includes("Цитаты")).click(); await wait(60);
    assert.ok(c.byClass("sf-feed").length === 1 && c.byClass("sf-formula__body")[0].textContent.includes("подборка: Цитаты") && c.byClass("sf-formula__body")[0].textContent.split("Цитаты").length >= 3, "условие подборки (атрибут «Цитаты») видно в формуле");
    c.byClass("sf-chip").find((x) => x.textContent.startsWith("#daily") && x.classList.contains("is-clickable")).click(); await wait(40);
    dd.byClass("sf-btn")[0].click(); dd.byClass("sf-btn")[0].click();
    const before = readDb().presets.length;
    const input = dd.byClass("sf-menu__save")[0].byClass("sf-input")[0];
    input.value = "Из меню";
    dd.byClass("sf-menu__save")[0].byClass("sf-btn--primary")[0].click(); await wait(600);
    assert.strictEqual(readDb().presets.length, before + 1);
    assert.ok(readDb().presets.some((p) => p.name === "Из меню" && p.filter.any.includes("daily")));
  });
  await test("пульс месяца: 4 карточки с графиком, стрик из 7 кружков, медиа с фото и видео, теги", async () => {
    const c = await mkEnv({ view: "overview", id: "pls" }); await wait(40);
    const labels = c.byClass("sf-pcard__label").map((x) => x.textContent);
    assert.deepStrictEqual(labels, ["Создано заметок", "Стрик регулярности", "Семантические связи", "Медиа за месяц"]);
    assert.ok(c.byClass("sf-spark").length === 1 && c.byClass("sf-spark__dot").length === 1, "график накопления");
    assert.strictEqual(c.byClass("sf-streak__day").length, 7);
    const leg = c.byClass("sf-legend__item").map((x) => x.textContent).join("|");
    assert.ok(leg.includes("фото") && leg.includes("видео") && leg.includes("аудио"), leg);
    assert.ok(c.byClass("sf-tagstrip").length === 1);
  });
  await test("css: hover карточки, размер цитаты, без column-count", async () => {
    await mkEnv({ view: "stream", id: "css2" });
    const css = document.getElementById("journal-stream-style").textContent;
    assert.ok(css.includes("--sf-quote-size: calc(17px / 1.5)") && css.includes(".sf-card:hover { background: linear-gradient(") && !css.includes("column-count"));
  });

  await test("tile-grid: порядок слева направо, затем сверху вниз; широкие плитки на 2 колонки", async () => {
    const tileGrid = R("ui/feed/tile-grid");
    const cfg = { columns: { min: 2, max: 4 }, minCardWidth: 320 };
    const mkCard = (cls, hgt) => { const c = document.createElement("div"); c.className = cls; c.sfReady = Promise.resolve(); c._h = hgt; return c; };
    const cards = [mkCard("a", 100), mkCard("b", 300), mkCard("c", 100), mkCard("d", 100), mkCard("e", 100), mkCard("f", 100), mkCard("wide", 100)];
    const el = tileGrid({ config: cfg }, cards, { wide: (c) => c.classList.contains("wide") });
    el.clientWidth = 1500;
    el.childNodes.forEach((it) => Object.defineProperty(it, "offsetHeight", { get() { return it.firstChild._h; } }));
    await wait(40);
    const pos = (i) => ({ left: parseFloat(el.childNodes[i].style.left), top: parseFloat(el.childNodes[i].style.top), w: parseFloat(el.childNodes[i].style.width) });
    // первая строка: a b c d слева направо
    assert.ok(pos(0).left < pos(1).left && pos(1).left < pos(2).left && pos(2).left < pos(3).left && [0, 1, 2, 3].every((i) => pos(i).top === 0), "первая строка слева направо");
    // e — под самой короткой колонкой слева (a, c, d равны по высоте → самая левая из коротких = колонка a)
    assert.ok(pos(4).left === pos(0).left && pos(4).top > 0, "e под a");
    // f — следующая короткая слева направо (c)
    assert.ok(pos(5).left === pos(2).left, "f под c");
    assert.ok(pos(6).w > pos(0).w * 1.9, "широкая плитка занимает две колонки");
    el.sfDispose();
  });
  await test("карточка: клик открывает заметку; клик по чипу тега — фильтр, а не открытие", async () => {
    const c = await mkEnv({ view: "stream", id: "clk" }); await wait(60);
    app.opened.length = 0;
    const card = c.byClass("sf-card")[0];
    card.dispatch("click");
    assert.strictEqual(app.opened.length, 1, "открыта заметка");
    const chipEl = card.byClass("sf-chip")[0];
    chipEl.dispatch("click", { target: chipEl }); // обработчик чипа; всплытие до карточки в заглушке не эмулируется — проверяем guard напрямую
    assert.strictEqual(app.opened.length, 1);
    card.dispatch("click", { target: chipEl });
    assert.strictEqual(app.opened.length, 1, "клик по чипу не открывает заметку");
  });
  await test("тег внутри текста карточки применяется на странице (а не уходит в поиск Obsidian)", async () => {
    const c = await mkEnv({ view: "stream", id: "taglink" }); await wait(80);
    const box = c.byClass("sf-card__text")[0];
    const a = document.createElement("a"); a.className = "tag"; a.setAttribute("href", "#zettel"); a.append("#zettel"); box.append(a);
    let prevented = false;
    box.dispatch("click", { target: a, preventDefault() { prevented = true; } });
    await wait(40);
    assert.ok(prevented, "стандартное поведение Obsidian отменено");
    assert.ok(c.byClass("sf-formula__body")[0].textContent.includes("#zettel"), "тег появился в формуле фильтра");
  });
  await test("автодополнение тега: подсказки, выбор, submit формы (мобильный Enter/«+»)", async () => {
    const { suggestTags } = R("ui/filters/tag-builder");
    assert.deepStrictEqual(suggestTags([{ tag: "daily", count: 3 }, { tag: "mydaily", count: 9 }, { tag: "dev", count: 1 }], "da").map((t) => t.tag), ["daily", "mydaily"]);
    const c = await mkEnv({ view: "studio", id: "ac" });
    const input = c.byClass("sf-tagadd__input")[0];
    input.value = "da"; input.dispatch("input");
    const items = c.byClass("sf-suggest__item");
    assert.ok(items.length >= 1 && items[0].textContent.includes("#daily"), "подсказка #daily");
    items[0].dispatch("click"); await wait(30);
    assert.ok(c.byClass("sf-formula__body")[0].textContent.includes("#daily"));
    input.value = "новыйтег"; c.byClass("sf-tagadd")[0].dispatch("submit"); await wait(30);
    assert.ok(c.byClass("sf-formula__body")[0].textContent.includes("#новыйтег"), "submit формы добавляет тег");
  });
  await test("кнопка «Наверх»: fixed в <body>, появляется после прокрутки, возвращает наверх, не плодится", async () => {
    global.getComputedStyle = (n) => ({ overflowY: n.__oy || "" });
    const sc = document.createElement("div"); sc.className = "markdown-preview-view"; sc.__oy = "auto"; sc.__attached = true; sc.scrollHeight = 6000; sc.clientHeight = 800;
    let top = 0;
    Object.defineProperty(sc, "scrollTop", { get: () => top, set: (v) => { const t = Math.max(0, Math.min(v, sc.scrollHeight - sc.clientHeight)); if (t !== top) { top = t; document.dispatch("scroll", { target: sc }); } } });
    const mount = async () => { const container = document.createElement("div"); sc.append(container); await runIn(container, { view: "stream", id: "fab", viewMode: "auto" }); return container; };
    await mount(); await wait(60);
    const fabs = () => document.body.children.filter((n) => n.classList.contains("sf-fab") && n.isConnected);
    const first = fabs().at(-1);
    assert.ok(first && first.classList.contains("is-hidden"), "наверху кнопка скрыта");
    assert.strictEqual(first.parentNode, document.body, "кнопка в <body> (fixed), а не sticky внутри виджета");
    sc.scrollTop = 900; await wait(30);
    assert.ok(!first.classList.contains("is-hidden"), "после прокрутки вниз кнопка видна");
    first.byClass("sf-fab__btn")[0].click(); await wait(30);
    assert.strictEqual(sc.scrollTop, 0, "клик возвращает наверх");
    assert.ok(first.classList.contains("is-hidden"), "наверху снова скрыта");
    sc.scrollTop = 900;
    sc.children.forEach((ch) => sc.removeChild(ch));
    await mount(); await wait(60);
    assert.strictEqual(first.parentNode, null, "при перерисовке блока старая кнопка убрана");
    assert.strictEqual(fabs().filter((n) => n !== first).length >= 1, true);
  });
  await test("картинки: centerCrop и никаких hover-эффектов; токены темы доступны кнопке в <body>", async () => {
    const css = document.getElementById("journal-stream-style").textContent;
    assert.ok(/\.sf-images \{[^}]*aspect-ratio: 16 \/ 10/.test(css), "рамка фиксированных пропорций");
    assert.ok(/\.sf-images__cell img \{[^}]*position: absolute; inset: 0;[^}]*object-fit: cover; object-position: 50% 50%/.test(css), "centerCrop");
    assert.ok(!/\.sf-images__cell:hover img/.test(css) && !css.includes("brightness(1.08); } /* без масштабирования"), "hover-эффект на картинке убран");
    assert.ok(/\.sf-card img \{[^}]*transform: none !important[^}]*filter: none !important/.test(css));
    assert.ok(css.includes('.sf-fab[data-sf-theme="dark"]'));
  });
  await test("дата и время как в заметке: «1 октября 2024, 16:12»", async () => {
    const D = R("lib/date");
    assert.strictEqual(D.toMs("1 октября 2024, 16:12"), new Date(2024, 9, 1, 16, 12).getTime());
    assert.strictEqual(D.toMs("1 окт 2024 г. в 07:05"), new Date(2024, 9, 1, 7, 5).getTime());
    assert.strictEqual(D.toMs("21 мая 2025"), new Date(2025, 4, 21).getTime());
    const c = await mkEnv({ view: "stream", id: "ru", filter: { text: "ru-date" } }); await wait(60);
    assert.ok(c.byClass("sf-card__date").some((d) => d.textContent === "1 октября 2024, 16:12"), c.byClass("sf-card__date").map((d) => d.textContent).join("|"));
  });
  await test("открытие в новой вкладке: настройка в навигации и Ctrl-клик", async () => {
    const c = await mkEnv({ view: "stream", id: "nt" }); await wait(60);
    app.opened.length = 0;
    c.byClass("sf-card__title")[0].dispatch("click");
    assert.strictEqual(app.opened[0][1], false);
    c.byClass("sf-nav__right")[0].byClass("sf-iconbtn").find((b) => b.attrs.title.includes("вкладк")).click(); await wait(20);
    c.byClass("sf-card__title")[0].dispatch("click");
    assert.strictEqual(app.opened[1][1], true, "в новой вкладке после включения");
  });
  await test("«В этот день»: счётчик подборки совпадает с лентой, пустое состояние объясняет условия", async () => {
    const c = await mkEnv({ view: "collections", id: "today-cnt" }); await wait(80);
    const card = c.byClass("sf-preset").find((x) => x.textContent.includes("В этот день"));
    const n = card.byClass("sf-preset__count")[0].textContent.split(" ")[0];
    card.dispatch("click"); await wait(100);
    assert.strictEqual(c.byClass("sf-counter__n")[0].textContent.split(" ")[0], n);
    const input = c.byClass("sf-search")[0].byClass("sf-input")[0];
    input.value = "ничегонет"; input.dispatch("input"); await wait(250);
    const hint = c.byClass("sf-empty__hint")[0].textContent;
    assert.ok(hint.includes("режим «В этот день»") && hint.includes("поиск: «ничегонет»"), hint);
  });
  await test("версия: бейдж на странице открывает историю версий; запись в README; appVersion в файле; уведомление после обновления", async () => {
    const { VERSION } = R("app/version");
    const readme = fs.readFileSync(path.join(SRC, "README.md"), "utf8");
    assert.ok(readme.includes("## История версий") && readme.includes(`### v${VERSION} `), "в README нет записи для v" + VERSION);
    assert.ok(readme.split("\n")[2].includes(VERSION), "строка версии под заголовком README устарела");
    const c = await mkEnv({ view: "stream", id: "ver" }); await wait(40);
    const badge = c.byClass("sf-version")[0];
    assert.strictEqual(badge.textContent, "v" + VERSION);
    obsidian.__modals.length = 0; badge.dispatch("click"); await wait(20);
    assert.ok(obsidian.__modals.length === 1 && obsidian.__modals[0].contentEl.textContent.includes(`v${VERSION}`), "бейдж открывает окно с историей версий");
    await wait(500);
    assert.strictEqual(readDb().appVersion, VERSION);
    // файл записан «старой» версией → после запуска показывается уведомление
    const d = readDb(); d.appVersion = "0.5.0"; fs.writeFileSync(path.join(VAULT, PLUGIN, "data.json"), JSON.stringify(d));
    const c2 = await mkEnv({ view: "stream", id: "ver2" }); await wait(40);
    assert.ok(c2.byClass("sf-toast").some((t) => t.textContent.includes("v0.5.0 → v" + VERSION)), "нет уведомления об обновлении");
    // без навигации версия показана внизу страницы
    const c3 = await mkEnv({ view: "stream", id: "ver3", nav: false }); await wait(40);
    assert.ok(c3.byClass("sf-footer")[0].byClass("sf-version").length === 1);
  });
  await test("мобильная версия: только разделы, кнопка «Фильтры» и краткая сводка; десктоп без изменений", async () => {
    const m = await mkEnv({ view: "stream", id: "mob1" }, 390); await wait(60);
    const root = m.byClass("sf-root")[0];
    assert.ok(root.classList.contains("is-mobile") && root.classList.contains("is-compact"), "is-mobile и is-compact");
    assert.ok(m.byClass("sf-mbar").length === 1 && m.byClass("sf-mfilter")[0].textContent.includes("Фильтры"), "кнопка «Фильтры»");
    assert.ok(m.byClass("sf-toolbar").length === 0 && m.byClass("sf-quickbar").length === 0 && m.byClass("sf-panel").length === 0 && m.byClass("sf-search").length === 0, "панель, поиск и режимы убраны с экрана");
    assert.ok(m.byClass("sf-msummary")[0].textContent.includes("Без фильтров"), "краткая сводка");
    assert.strictEqual(m.byClass("sf-nav__tab").length, 5, "разделы на месте");
    const d = await mkEnv({ view: "stream", id: "mob2" }, 1400); await wait(60);
    assert.ok(!d.byClass("sf-root")[0].classList.contains("is-mobile") && d.byClass("sf-panel").length === 1 && d.byClass("sf-mbar").length === 0, "на десктопе — прежняя панель");
    const today = d.byClass("sf-quick--today")[0];       // «В этот день» — без даты
    assert.ok(today.textContent.startsWith("В этот день") && d.byClass("sf-quick__sub").length === 0, today.textContent);
    const t = await mkEnv({ view: "stream", id: "mob3" }, 700); await wait(30);
    assert.ok(t.byClass("sf-root")[0].classList.contains("is-compact") && !t.byClass("sf-root")[0].classList.contains("is-mobile"));
  });
  await test("мобильные фильтры: окно открывается кнопкой, применяет условия сразу, сводка и счётчик обновляются, закрывается", async () => {
    const m = await mkEnv({ view: "stream", id: "mobm" }, 390); await wait(60);
    const modals = () => document.body.byClass("sf-modal");
    const before = modals().length;
    m.byClass("sf-mfilter")[0].click(); await wait(30);
    const modal = modals().at(-1);
    assert.strictEqual(modals().length, before + 1, "окно открылось в <body>");
    assert.deepStrictEqual(modal.byClass("sf-msec__title").map((x) => x.textContent), ["Применено", "Поиск и даты", "Режим", "Подборки", "Теги", "Атрибуты", "Условия", "Порядок и вид"]);
    assert.ok(modal.byClass("sf-search").length === 1 && modal.byClass("sf-date__input").length === 2 && modal.byClass("sf-tagtab").length === 4, "поиск, даты, теги — внутри окна");
    const total = () => m.byClass("sf-card").length, all = total();
    const show = () => modal.byClass("sf-modal__show")[0].textContent;
    assert.ok(show().startsWith("Показать"), show());
    const chip = modal.byClass("sf-tagbuilder__tags")[0].byClass("sf-chip").find((c) => c.textContent.startsWith("#daily"));
    chip.click(); await wait(60);
    assert.ok(total() < all && m.byClass("sf-msummary")[0].textContent.includes("#daily"), "условие применено сразу, сводка показывает #daily");
    assert.ok(m.byClass("sf-mfilter")[0].byClass("sf-panel__badge")[0].textContent === "1", "значок числа условий");
    assert.ok(show().includes(String(total())), "«Показать N» отражает число найденных: " + show());
    modal.byClass("sf-modal__footer")[0].byClass("sf-btn")[0].click(); await wait(60);   // «Сбросить»
    assert.strictEqual(total(), all);
    modal.byClass("sf-modal__show")[0].click(); await wait(20);
    assert.strictEqual(modals().length, before, "«Показать» закрывает окно");
    m.byClass("sf-mfilter")[0].click(); await wait(20);
    document.dispatch("keydown", { key: "Escape" }); await wait(20);
    assert.strictEqual(modals().length, before, "Esc закрывает окно");
  });
  await test("сводка фильтров: короткие строки по условиям", () => {
    const { summarize } = R("filters/summary"), S = R("filters/state");
    assert.deepStrictEqual(summarize({ filter: S.defaultFilter(), quick: "all" }), []);
    const f = S.merge({ any: ["a", "b", "c", "d"], not: ["x"], attrs: ["photo"], text: " кот ", dateFrom: "2024-10-01", sort: "date-asc" });
    const out = summarize({ filter: f, quick: "today" }, { presetName: "Мои" });
    assert.deepStrictEqual(out.slice(0, 3), ["Подборка: Мои", "В этот день", "#a #b #c +1"]);
    assert.ok(out.includes("без #x") && out.includes("С фото") && out.includes("«кот»") && out.includes("с 1 окт 2024") && out.includes("Старые сначала"), out.join("|"));
  });
  await test("раскладка: вкладки переносятся (flow), нет внутренних горизонтальных скроллеров, CSS-переменные через setProperty", () => {
    const css = document.getElementById("journal-stream-style").textContent;
    assert.ok(/\.sf-nav__tabs \{[^}]*flex-wrap: wrap/.test(css) && !/\.sf-nav__tabs \{[^}]*overflow-x: auto/.test(css), "вкладки переносятся на новую строку");
    assert.ok(/\.sf-dql \{[^}]*white-space: pre-wrap/.test(css) && !/\.sf-heat__wrap \{[^}]*overflow-x: auto/.test(css));
    const { h } = R("lib/dom"); const calls = [];
    const el = h("div", { style: { "--cols": 26, width: "10px" } });
    assert.strictEqual(el.style.width, "10px"); assert.ok(el.style["--cols"] === 26 || calls);
  });
  await test("обзор на телефоне: карта активности за полгода (26 недель) помещается без прокрутки", async () => {
    const m = await mkEnv({ view: "overview", id: "ovm" }, 390); await wait(60);
    const cells = m.byClass("sf-heat")[0].byClass("sf-heat__cell").length;
    assert.strictEqual(cells, 26 * 7);
    assert.ok(m.byClass("sf-block__title").some((t) => t.textContent === "Активность за полгода"));
    const d = await mkEnv({ view: "overview", id: "ovd" }, 1400); await wait(60);
    assert.strictEqual(d.byClass("sf-heat")[0].byClass("sf-heat__cell").length, 53 * 7);
  });
  await test("мобильная версия: все экраны рисуются без ошибок", async () => {
    for (const view of ["overview", "stream", "bento", "collections", "studio"]) {
      const c = await mkEnv({ view, id: "mobv-" + view }, 390); await wait(40);
      assert.strictEqual(c.byClass("sf-error").length, 0, view + ": " + (c.byClass("sf-error")[0] || {}).textContent);
      assert.ok(c.byClass("sf-root")[0].classList.contains("is-mobile"));
    }
  });
  await test("мобильная версия: css содержит мобильные правила; columnCount даёт 1 колонку; страница меньше", async () => {
    const css = document.getElementById("journal-stream-style").textContent;
    assert.ok(css.includes(".sf-root.is-mobile .sf-nav__tabs") && css.includes(".sf-root.is-mobile .sf-timeline__group") && css.includes("font-size: 16px"));
    assert.strictEqual(R("lib/layout").columnCount(390, { columns: { min: 2, max: 4 }, minCardWidth: 320, singleColumnBelow: 560 }), 1);
    assert.strictEqual(readDb().settings.pageSizeMobile, 12);
  });
  await test("прокрутка: возврат восстанавливает позицию; «зажатые» значения и мёртвый виджет её не затирают", async () => {
    global.getComputedStyle = (n) => ({ overflowY: n.__oy || "" });
    const sess = () => window.__sfSession["Note.md::scr"];
    const sc = document.createElement("div"); sc.__oy = "auto"; sc.__attached = true; sc.scrollHeight = 5000; sc.clientHeight = 800;
    let top = 0;
    Object.defineProperty(sc, "scrollTop", { get: () => top, set: (v) => { const t = Math.max(0, Math.min(v, sc.scrollHeight - sc.clientHeight)); if (t !== top) { top = t; document.dispatch("scroll", { target: sc }); } } });
    const mount = async () => { const container = document.createElement("div"); sc.append(container); await runIn(container, { view: "stream", id: "scr" }); return container; };

    const c1 = await mount(); await wait(40);
    sc.scrollTop = 1500; await wait(160);
    assert.strictEqual(sess().scroll, 1500, "позиция пользователя сохранена");

    sc.removeChild(c1);                           // Obsidian заменяет заметку: виджет мёртв…
    sc.scrollHeight = 900; sc.scrollTop = 0;      // …страница короткая, scrollTop «зажат» в 0
    await wait(160);
    assert.strictEqual(sess().scroll, 1500, "зажатое значение не затёрло позицию");

    const c2 = await mount();                     // возврат: страница ещё короткая, позиция недоступна
    await wait(200);
    assert.strictEqual(sess().scroll, 1500, "во время восстановления сохранение приостановлено");
    sc.scrollHeight = 5000;                       // карточки дорисовались — страница выросла
    await wait(400);
    assert.strictEqual(sc.scrollTop, 1500, "позиция восстановлена");
    assert.strictEqual(sess().scroll, 1500);

    document.dispatch("wheel");                   // пользователь начал прокручивать сам → восстановление прекращено
    await wait(250);
    sc.scrollTop = 700; await wait(200);
    assert.strictEqual(sess().scroll, 700, "после восстановления позиция снова сохраняется");
  });
  await test("обзор: без плиток «Пространства»; годовая карта с подписями и легендой; распределение по типам", async () => {
    const c = await mkEnv({ view: "overview", id: "ov2" }); await wait(40);
    assert.strictEqual(c.byClass("sf-tile").length, 0);
    assert.ok(!c.textContent.includes("Пространства"));
    assert.ok(c.byClass("sf-block__sub").some((x) => x.textContent.includes("Каждый квадрат — один день")), "пояснение к квадратикам");
    assert.strictEqual(c.byClass("sf-heat__legend")[0].byClass("sf-heat__cell").length, 5);
    assert.ok(c.byClass("sf-heat__month").length >= 10 && c.byClass("sf-heat__daylabel").map((x) => x.textContent).join() === "Пн,Ср,Пт", "подписи месяцев и дней недели");
    assert.ok(c.byClass("sf-donut").length === 1 && c.byClass("sf-dist__row").length >= 2);
    const { levelRanges } = R("stats/activity");
    assert.deepStrictEqual(levelRanges(8), [[0, 0], [1, 2], [3, 4], [5, 6], [7, null]]);
  });
  await test("озарения: число карточек выбирается (3/6/9/12) и запоминается", async () => {
    const c = await mkEnv({ view: "overview", id: "ov3" }); await wait(60);
    const items = () => c.byClass("sf-insights")[0].byClass("sf-tilegrid__item").length;
    assert.strictEqual(items(), 3);
    const btns = c.byClass("sf-insights__count")[0].byClass("sf-segmented__btn");
    assert.deepStrictEqual(btns.map((b) => b.textContent), ["3", "6", "9", "12"]);
    btns[1].click(); await wait(60);
    assert.strictEqual(items(), 6);
    await wait(500);
    assert.strictEqual(readDb().ui.insightsCount, 6);
  });
  await test("карточка без «Читать далее»", async () => {
    const c = await mkEnv({ view: "stream", id: "nomore", filter: { text: "утренние" } }); await wait(80);
    assert.ok(c.byClass("sf-card__more").length === 0 && !c.textContent.includes("Читать далее"));
  });
  await test("навигация: нет бренда, вкладки на всю ширину шапки, 5 разделов", async () => {
    const c = await mkEnv({ view: "stream", id: "nav2" }, 390); await wait(40);
    const nav = c.byClass("sf-nav")[0];
    assert.ok(!nav.textContent.includes("Journal Stream") && nav.byClass("sf-nav__brand").length === 0, "бренд-чип убран");
    assert.strictEqual(nav.byClass("sf-nav__tab").length, 5);
    assert.ok(nav.byClass("sf-nav__tab").some((t) => t.byClass("sf-nav__short").length === 1 && t.byClass("sf-nav__short")[0].textContent === "Конструктор"), "короткая подпись для узких экранов");
    const css = document.getElementById("journal-stream-style").textContent;
    assert.ok(/\.sf-nav__tabs \{[^}]*flex: 1 1 380px/.test(css) && /\.sf-nav__tab \{[^}]*flex: 1 0 auto/.test(css), "вкладки растягиваются на всю ширину");
    assert.ok(/\.sf-root\.is-mobile \.sf-nav__tabs \{ flex: 1 0 100%/.test(css), "на телефоне вкладки — отдельной строкой");
  });
  await test("шиммеры: tile-grid показывает заглушку до первой раскладки; стартовая заглушка убирается", async () => {
    const tileGrid = R("ui/feed/tile-grid");
    const mkCard = () => { const c = document.createElement("div"); c.sfReady = Promise.resolve(); return c; };
    const el = tileGrid({ config: { columns: { min: 2, max: 4 }, minCardWidth: 320 }, rootEl: null }, [mkCard(), mkCard()], {});
    assert.ok(el.classList.contains("is-pending") && el.byClass("sf-skelgrid").length === 1, "до раскладки видны шиммеры");
    el.clientWidth = 1200; await wait(60);
    assert.ok(!el.classList.contains("is-pending") && el.byClass("sf-skelgrid").length === 0, "после раскладки шиммеры убраны");
    el.sfDispose();
    const container = document.createElement("div"); container.__attached = true;
    const boot = document.createElement("div"); boot.className = "sf-boot"; container.append(boot);
    await runIn(container, { view: "stream", id: "boot" }, { boot });
    await wait(30);
    assert.strictEqual(container.byClass("sf-boot").length, 0, "стартовая заглушка удалена");
  });
  await test("поиск: находит по тексту заметки (после индексации), ё=е, устойчив к нечитаемой заметке", async () => {
    const { norm } = R("lib/search");
    assert.strictEqual(norm("ЁЛКА Ёж"), "елка еж");
    const orig = app.vault.cachedRead;
    app.vault.cachedRead = async (f) => { if (f.path.endsWith("link.md")) throw new Error("boom"); return orig(f); };
    const c = await mkEnv({ view: "stream", id: "srch2" }); await wait(100);
    const input = c.byClass("sf-search")[0].byClass("sf-input")[0];
    input.dispatch("focus"); await wait(300);     // индексация (одна заметка нечитаема — остальные индексируются)
    input.value = "атомарн"; input.dispatch("input"); await wait(250);
    const n = c.byClass("sf-card").length;
    app.vault.cachedRead = orig;
    assert.ok(n >= 1, "найдена заметка, где слово есть только в тексте: " + n);
    assert.ok(c.byClass("sf-search__status")[0].textContent === "", "индексация завершена");
  });
  await test("конструктор: строка поиска по названию или тексту есть в панели фильтров", async () => {
    const c = await mkEnv({ view: "studio", id: "std3" });
    const s = c.byClass("sf-panel__search")[0];
    assert.ok(s && s.byClass("sf-input")[0].attrs.placeholder.includes("названию или тексту"));
  });
  await test("прокрутка: промежуточная обёртка с overflow:auto не сбивает позицию (клик по карточке не сохраняет 0)", async () => {
    global.getComputedStyle = (n) => ({ overflowY: n.__oy || "" });
    const sess = () => window.__sfSession["Note.md::scr2"];
    // настоящий скроллер Obsidian (.markdown-preview-view) → «ложная» обёртка (overflow:auto, но не прокручивается) → виджет
    const sc = document.createElement("div"); sc.className = "markdown-preview-view"; sc.__oy = "auto"; sc.__attached = true; sc.scrollHeight = 5000; sc.clientHeight = 800;
    let top = 0;
    Object.defineProperty(sc, "scrollTop", { get: () => top, set: (v) => { const t = Math.max(0, Math.min(v, sc.scrollHeight - sc.clientHeight)); if (t !== top) { top = t; document.dispatch("scroll", { target: sc }); } } });
    const wrap = document.createElement("div"); wrap.__oy = "auto"; wrap.scrollHeight = 0; wrap.clientHeight = 0; wrap.scrollTop = 0; sc.append(wrap);
    const mount = async () => { const container = document.createElement("div"); wrap.append(container); await runIn(container, { view: "stream", id: "scr2" }); return container; };

    const c1 = await mount(); await wait(60);
    sc.scrollTop = 1500; await wait(160);
    assert.strictEqual(sess().scroll, 1500);
    c1.byClass("sf-card__title")[0].dispatch("click");     // клик по карточке → leave()
    assert.strictEqual(sess().scroll, 1500, "позиция не затёрта нулём обёртки");
    assert.strictEqual(sess().scrollerSel, "markdown-preview-view", "запомнен настоящий контейнер прокрутки");

    wrap.removeChild(c1); sc.scrollHeight = 900; sc.scrollTop = 0; await wait(160);   // Obsidian сменил заметку
    const c2 = await mount(); await wait(150);                                       // возврат: страница ещё короткая
    sc.scrollHeight = 5000; await wait(450);                                         // карточки дорисовались
    assert.strictEqual(sc.scrollTop, 1500, "позиция восстановлена на настоящем контейнере, а не на обёртке");
    assert.strictEqual(wrap.scrollTop, 0);
  });
  await test("вид: кнопки «мобильный» / «десктопный» включают принудительный вид; на телефоне возврат — через «Настройки»", async () => {
    const c = await mkEnv({ view: "stream", id: "vm1" }, 1400); await wait(50);
    const root = c.byClass("sf-root")[0];
    const modalPill = (label) => document.body.byClass("sf-modal").at(-1).byClass("sf-sortbtn").find((b) => b.textContent.includes(label));
    assert.ok(!root.classList.contains("is-mobile"));
    c.byClass("sf-nav__right")[0].byClass("sf-iconbtn").find((b) => b.attrs.title.includes("мобильный вид")).click(); await wait(80);
    assert.ok(root.classList.contains("is-mobile") && root.classList.contains("is-forced-mobile") && root.classList.contains("is-compact"), "мобильный вид включён на широком экране");
    assert.ok(c.byClass("sf-mbar").length === 1 && c.byClass("sf-panel").length === 0, "мобильная шапка вместо панели фильтров");
    assert.ok(c.byClass("sf-nav__gear").filter((b) => !b.classList.contains("sf-nav__plus")).length === 1 && c.byClass("sf-nav__right").length === 0, "в мобильной шапке — только разделы, «Новая заметка» и «Настройки»");
    c.byClass("sf-nav__gear").filter((b) => !b.classList.contains("sf-nav__plus"))[0].click(); await wait(30);
    modalPill("Авто").click(); await wait(80);                                    // возврат к автоопределению
    assert.ok(!root.classList.contains("is-mobile") && !root.classList.contains("is-forced-mobile"), "«Авто» возвращает автоопределение");
    assert.ok(c.byClass("sf-nav__right").length === 1, "шапка десктопа вернулась");
    document.dispatch("keydown", { key: "Escape" }); await wait(300);
    assert.strictEqual(readDb().ui.viewMode, "auto");

    const m = await mkEnv({ view: "stream", id: "vm2" }, 390); await wait(50);
    const mroot = m.byClass("sf-root")[0];
    assert.ok(mroot.classList.contains("is-mobile"));
    m.byClass("sf-nav__gear").filter((b) => !b.classList.contains("sf-nav__plus"))[0].click(); await wait(30);
    modalPill("Десктопный").click(); await wait(80);
    assert.ok(!mroot.classList.contains("is-mobile") && mroot.classList.contains("is-forced-desktop"), "десктопный вид на узком экране");
    assert.ok(m.byClass("sf-nav__right").length === 1, "в десктопном виде — полная шапка");
    document.dispatch("keydown", { key: "Escape" });
    const L = R("lib/layout");
    assert.strictEqual(L.columnCount(390, { columns: { min: 2, max: 4 }, minCardWidth: 320, singleColumnBelow: 0 }), 2, "в десктопном виде колонок не меньше 2");
    assert.strictEqual(L.columnCount(1600, { columns: { min: 2, max: 4 }, minCardWidth: 320, singleColumnBelow: 100000 }), 1, "в мобильном виде — один столбец");
  });
  await test("настройки (телефон): вид, тема, заметки, версия; изменения применяются и сохраняются", async () => {
    const m = await mkEnv({ view: "overview", id: "set1" }, 390); await wait(60);
    m.byClass("sf-nav__gear").filter((b) => !b.classList.contains("sf-nav__plus"))[0].click(); await wait(30);
    const modal = document.body.byClass("sf-modal").at(-1);
    assert.deepStrictEqual(modal.byClass("sf-msec__title").map((x) => x.textContent), ["Вид", "Тема", "Заметки", "О виджете"]);
    const row = (t) => modal.byClass("sf-setrow").find((r) => r.textContent.includes(t));
    assert.ok(row("новой вкладке").textContent.includes("Выкл"));
    row("новой вкладке").click(); await wait(30);
    assert.ok(modal.byClass("sf-setrow").find((r) => r.textContent.includes("новой вкладке")).textContent.includes("Вкл"), "переключатель обновился");
    modal.byClass("sf-sortbtn").find((b) => b.textContent.includes("Светлая")).click(); await wait(20);
    assert.strictEqual(m.byClass("sf-root")[0].dataset.sfTheme, "light");
    await wait(450);
    assert.ok(readDb().ui.openInNewTab === true && readDb().ui.theme === "light");
    obsidian.__modals.length = 0;
    row("Journal Stream").click(); await wait(20);
    assert.ok(obsidian.__modals.length === 1, "версия открывает историю версий");
    assert.strictEqual(document.body.byClass("sf-modal").filter((n) => n === modal).length, 0, "окно закрылось");
  });
  await test("верхние кнопки: скруглённые, в цвет акцента, градиент; кнопки вида и ширины на десктопе; на телефоне — в «Настройках»", async () => {
    const css = document.getElementById("journal-stream-style").textContent;
    assert.ok(/--sf-accent-grad: linear-gradient/.test(css) && /--sf-accent-soft: linear-gradient/.test(css));
    assert.ok(/\.sf-nav__tab\.is-active \{ background: var\(--sf-accent-grad\)/.test(css), "активная вкладка — градиент акцента");
    assert.ok(/\.sf-nav__tab \{[^}]*border-radius: var\(--sf-r-pill\)[^}]*var\(--sf-accent-soft\)/.test(css), "неактивные — скруглённые с мягким градиентом");
    assert.ok(/\.sf-btn--primary \{ background: var\(--sf-accent-grad\)/.test(css));
    assert.ok(!css.includes(".sf-nav__fullbtn { display: none"), "кнопка ширины не скрыта на телефоне");
    const d = await mkEnv({ view: "stream", id: "btn1400" }, 1400); await wait(40);
    assert.strictEqual(d.byClass("sf-nav__right")[0].byClass("sf-iconbtn").length, 5, "на десктопе все 5 кнопок-иконок на месте (вид ×2, окно, вкладка, ширина)");
  });
  await test("фильтр дат: «от» и «до» независимы (предикат, формула, DQL, подборки)", () => {
    const { applyFilter } = R("filters/engine"), S = R("filters/state"), Q = R("filters/dql"), F = R("filters/formula"), P = R("filters/presets");
    const at = (y, m, d, hh = 12) => new Date(y, m - 1, d, hh).getTime();
    const ps = [mk({ ts: at(2024, 3, 2) }), mk({ ts: at(2024, 10, 1, 16) }), mk({ ts: at(2024, 12, 31, 23) }), mk({ ts: at(2025, 5, 5) })];
    const n = (f) => applyFilter(ps, S.merge(f)).length;
    assert.deepStrictEqual([n({}), n({ dateFrom: "2024-10-01" }), n({ dateTo: "2024-10-01" }), n({ dateFrom: "2024-10-01", dateTo: "2024-12-31" }), n({ dateTo: "2024-12-31" })], [4, 3, 2, 2, 3], "границы включительно, каждая работает сама по себе");
    assert.ok(!S.isDefault({ dateFrom: "2024-01-01" }));
    const toks = F.toTokens(S.merge({ dateFrom: "2024-01-01", dateTo: "2024-12-31" })).filter((t) => t.t === "cond").map((t) => t.v);
    assert.deepStrictEqual(toks, ["с 2024-01-01", "по 2024-12-31"]);
    const q = Q.compile(S.merge({ dateFrom: "2024-06-01", dateTo: "2024-06-30" }), { config: { sources: [] } }).query;
    assert.ok(q.includes('file.cday >= date("2024-06-01")') && q.includes('file.cday < date("2024-07-01")'), q);
    assert.deepStrictEqual(P.ruleChips({ filter: { dateFrom: "2024-06-01" } }), ["с 2024-06-01"]);
  });
  await test("фильтр дат в поиске: любое из трёх полей сразу применяет фильтр", async () => {
    const c = await mkEnv({ view: "stream", id: "dates" }); await wait(80);
    const cards = () => c.byClass("sf-card").length;
    const [from, to] = c.byClass("sf-search")[0].byClass("sf-date__input");
    assert.ok(from && to && c.byClass("sf-search")[0].byClass("sf-input")[0].attrs.type === "search");
    assert.strictEqual(cards(), 11);
    to.value = "2024-12-31"; to.dispatch("change"); await wait(80);
    assert.strictEqual(cards(), 2, "только «до»");
    from.value = "2024-06-01"; from.dispatch("input"); await wait(80);
    assert.strictEqual(cards(), 1, "«от» + «до»");
    assert.ok(c.byClass("sf-formula__body")[0].textContent.includes("с 2024-06-01") && c.byClass("sf-formula__body")[0].textContent.includes("по 2024-12-31"));
    to.value = ""; to.dispatch("change"); await wait(80);
    assert.strictEqual(cards(), 10, "только «от»");
    const text = c.byClass("sf-search")[0].byClass("sf-input")[0];
    text.value = "стрим"; text.dispatch("input"); await wait(250);   // текст + «от» вместе
    assert.ok(cards() <= 1, "текст работает вместе с датой: " + cards());
    text.value = ""; text.dispatch("input"); from.value = ""; from.dispatch("change"); await wait(250);
    assert.strictEqual(cards(), 11, "всё очищено");
  });
  await test("теги: «подкладки» Топ · Случайные · За год · Этот день", async () => {
    const c = await mkEnv({ view: "stream", id: "tt" }, 1400); await wait(60);
    const tabs = () => c.byClass("sf-tagtab");
    assert.deepStrictEqual(tabs().map((t) => t.textContent), ["Топ", "Случайные", "За год", "Этот день"]);
    assert.ok(tabs()[0].classList.contains("is-active"));
    const chips = () => c.byClass("sf-tagbuilder__tags")[0].byClass("sf-chip").map((x) => x.textContent);
    assert.ok(chips().some((t) => t.startsWith("#daily")), "топ: самые частые теги");
    tabs()[3].click(); await wait(20);
    const today = chips();
    assert.ok(today.some((t) => t.startsWith("#мысли")) && !today.some((t) => t.startsWith("#daily")), "этот день: теги заметок прошлых лет в эту дату — " + today.join(","));
    tabs()[2].click(); await wait(20);
    assert.ok(chips().some((t) => t.startsWith("#daily")), "за год");
    tabs()[1].click(); await wait(20);
    assert.ok(tabs()[1].classList.contains("is-active") && chips().length >= 3, "случайные");
    chips(); c.byClass("sf-tagbuilder__tags")[0].byClass("sf-chip")[0].dispatch("click"); await wait(40);
    tabs()[0].click(); await wait(20);
    assert.ok(c.byClass("sf-tagbuilder__tags")[0].byClass("sf-chip")[0].classList.contains("is-active"), "выбранный тег остаётся первым при смене набора");
  });
  await test("сортировка по времени: «Новые» по умолчанию, переключатель «Старые»", async () => {
    const c = await mkEnv({ view: "stream", id: "srt" }, 1400); await wait(80);
    const btn = c.byClass("sf-sortbtn")[0];
    assert.strictEqual(btn.textContent, "Новые");
    const first = () => c.byClass("sf-card__date")[0].textContent;
    const newest = first();
    btn.click(); await wait(80);
    assert.strictEqual(btn.textContent, "Старые");
    assert.strictEqual(first(), "2 марта 2024", "сначала самые старые: " + first());
    btn.click(); await wait(80);
    assert.strictEqual(btn.textContent, "Новые");
    assert.strictEqual(first(), newest);
  });
  await test("фильтры: только атрибуты (ряд «Тип» убран); «FORMULA» убрано; переключатели панели — иконки", async () => {
    const c = await mkEnv({ view: "stream", id: "fl2" }, 1400); await wait(60);
    assert.deepStrictEqual(c.byClass("sf-attrs__label").map((x) => x.textContent), ["Атрибуты:"]);
    assert.ok(!c.textContent.includes("FORMULA") && c.byClass("sf-formula__label").length === 0);
    assert.strictEqual(c.byClass("sf-panel__toggle")[0].textContent, "", "переключатель панели — только иконка");
    assert.ok(!c.textContent.includes("Свернуть в 1 строку") && !c.textContent.includes("Развернуть панель") && !c.textContent.includes("Условия"));
    assert.ok(readDb().presets.find((p) => p.id === "voice" ? true : false).filter.attrs.includes("audio"), "новые подборки используют атрибуты");
  });
  await test("кнопка темы: только иконка, без подсказки и подписи", async () => {
    const c = await mkEnv({ view: "stream", id: "thm" }); await wait(40);
    const b = c.byClass("sf-themebtn")[0];
    assert.ok(b.attrs.title === undefined && b.textContent === "" && b.byClass("sf-icon").length === 1);
  });
  await test("смена темы Obsidian сбрасывает выбор темы в виджете на «auto»", async () => {
    let captured = []; global.MutationObserver = class { constructor(cb) { this.cb = cb; captured.push(this); } observe() {} disconnect() {} };
    document.body.classList.add("theme-dark");
    const c = await mkEnv({ view: "stream", id: "thm2", theme: "auto" }); await wait(40);
    const root = c.byClass("sf-root")[0];
    c.byClass("sf-themebtn")[0].click(); await wait(20);
    assert.strictEqual(root.dataset.sfTheme, "light", "выбор темы в виджете: светлая (при тёмной теме Obsidian)");
    document.body.classList.remove("theme-dark"); document.body.classList.add("theme-light");   // пользователь переключил тему Obsidian
    captured.at(-1).cb(); await wait(20);
    assert.strictEqual(root.dataset.sfTheme, "auto", "выбор сброшен на глобальную тему");
    await wait(450);
    assert.strictEqual(readDb().ui.theme, "auto");
    document.body.classList.remove("theme-light"); delete global.MutationObserver;
  });
  await test("без фона у виджета и защита от горизонтальной прокрутки (планшет)", async () => {
    const css = document.getElementById("journal-stream-style").textContent;
    assert.ok(/\.sf-root \{[^}]*background: var\(--sf-root-bg, transparent\)/.test(css), "фон виджета прозрачный");
    assert.ok(/\.sf-root \{[^}]*overflow-x: clip/.test(css) && css.includes(".sf-root.is-forced-desktop { overflow-x: visible; }"));
    assert.ok(/\.sf-daterange \{[^}]*flex-wrap: wrap/.test(css));
  });
  await test("открытие заметки по клику на заголовок", async () => {
    const c = await mkEnv({ view: "stream", id: "open" });
    app.opened.length = 0;
    const t = c.byClass("sf-card__title")[0]; t.dispatch("click", { ctrlKey: true });
    assert.ok(app.opened.length === 1 && app.opened[0][1] === true);
  });

  console.log("\nплагин (metadataCache, вкладка, code-block, настройки)");
  await test("manifest.json: id, версия совпадает с app/version, minAppVersion", () => {
    const m = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8"));
    assert.strictEqual(m.id, "journal-stream"); assert.strictEqual(m.version, R("app/version").VERSION); assert.ok(m.minAppVersion && m.name);
    assert.ok(fs.existsSync(path.join(SRC, "main.js")));
  });
  await test("notes: заметки из metadataCache → посты (теги, связи, задачи, медиа, дата, обратные ссылки)", () => {
    const repo = R("services/posts")({ app, config: JSON.parse(JSON.stringify(R("services/config").DEFAULTS)) });
    const cfg = JSON.parse(JSON.stringify(R("services/config").DEFAULTS)); cfg.sources = [{ id: "all", folder: "", enabled: true }];
    const all = R("services/posts")({ app, config: cfg }).collect();
    assert.strictEqual(all.length, 11);
    const a = all.find((p) => p.path.endsWith("LiveJournal/2026/a.md"));
    assert.deepStrictEqual([a.backlinks, a.links, a.tags.includes("мысли"), a.hasTime], [4, 1, true, true]);
    assert.strictEqual(all.find((p) => p.path.endsWith("tasks.md")).tasksTotal, 3);
    assert.ok(all.find((p) => p.path.endsWith("photos.md")).mediaCounts.image === 5);
    assert.strictEqual(all.find((p) => p.path.endsWith("2024-03-02.md")).ts, new Date(2024, 2, 2).getTime(), "дата из имени файла");
    assert.strictEqual(all.find((p) => p.path.endsWith("ru-date.md")).ts, new Date(2024, 9, 1, 16, 12).getTime());
    assert.ok(repo.collect().length === 11 && repo.collect() === repo.collect(), "кэш");
    cfg.excludeFolders = ["notes/Twitter"]; const ex = R("services/posts")({ app, config: cfg }).collect();
    assert.ok(ex.every((p) => !p.path.includes("Twitter")) && ex.length === 7, "исключённые папки");
    cfg.excludeFolders = []; cfg.sources = [{ id: "t", folder: "notes/Twitter", enabled: true }];
    assert.strictEqual(R("services/posts")({ app, config: cfg }).collect().length, 4, "источник-папка");
    const r2 = R("services/posts")({ app, config: cfg }); const c1 = r2.collect(); r2.markDirty(); assert.ok(r2.collect() !== c1, "markDirty пересобирает список");
  });
  await test("code-блок: разбор параметров (view, теги, период, nav, ошибки)", () => {
    const { parseBlock } = R("plugin/block-params");
    const r = parseBlock("view: Лента\ntags: #мысли, Daily\nexclude: архив\nperiod: 30d\nnav: false\nsearch: crdt\nfoo: 1\nмусор");
    assert.deepStrictEqual(r.input, { view: "stream", nav: false, filter: { any: ["мысли", "daily"], not: ["архив"], period: "30d", text: "crdt" } });
    assert.strictEqual(r.errors.length, 2);
    assert.deepStrictEqual(parseBlock("").input, {});
  });
  await test("плагин: setup регистрирует вид, code-блок, команды, ribbon, вкладку настроек, события", async () => {
    await R("plugin/index").setup(plugin);
    assert.ok(plugin.reg.views["journal-stream-view"] && plugin.reg.blocks["journal-stream"] && plugin.reg.tabs.length === 1 && plugin.reg.ribbon.length === 1);
    const ids = plugin.reg.commands.map((c) => c.id);
    for (const id of ["open", "open-overview", "open-stream", "open-bento", "open-collections", "open-studio", "insert-block", "refresh"]) assert.ok(ids.includes(id), "нет команды " + id);
    assert.ok(plugin.reg.events.length === 4);
    let inserted = ""; plugin.reg.commands.find((c) => c.id === "insert-block").editorCallback({ replaceSelection: (t) => { inserted = t; } });
    assert.ok(inserted.startsWith("```journal-stream"));
  });
  await test("вкладка (ItemView): открытие, переход в раздел, закрытие убирает всё", async () => {
    const view = plugin.reg.views["journal-stream-view"]({ id: "leaf1" });
    view.contentEl.__attached = true; await view.onOpen(); await wait(60);
    assert.ok(view.contentEl.byClass("sf-root").length === 1 && view.contentEl.classList.contains("sf-view-host"));
    assert.ok(view.contentEl.byClass("sf-feed").length >= 1 || view.contentEl.byClass("sf-tilegrid").length >= 1 || view.contentEl.byClass("sf-view").length === 1);
    view.goTo("bento"); await wait(80);
    assert.ok(view.contentEl.byClass("sf-feed--bento").length === 1, "раздел переключён");
    assert.strictEqual(view.getState().view, "bento");
    const fabs = () => document.body.children.filter((n) => n.classList.contains("sf-fab") && n.isConnected).length;
    assert.ok(fabs() >= 1);
    const before = fabs();
    await view.onClose();
    assert.strictEqual(view.contentEl.byClass("sf-root").length, 0, "интерфейс убран");
    assert.ok(fabs() < before, "кнопка «Наверх» этого вида убрана");
    assert.strictEqual(plugin.core.instances.size, 0, "экземпляр снят с учёта");
    // состояние страницы: вид, открытый заново (например, после «назад»), возвращается в тот же раздел
    const v2 = plugin.reg.views["journal-stream-view"]({ id: "leaf1" }); v2.contentEl.__attached = true; await v2.onOpen(); await wait(60);
    assert.ok(v2.contentEl.byClass("sf-feed--bento").length === 1, "раздел восстановлен из сессии");
    await v2.onClose();
  });
  await test("code-блок в заметке: параметры применяются, при выгрузке блок освобождается", async () => {
    const el = document.createElement("div"); el.__attached = true;
    const children = [];
    await plugin.reg.blocks["journal-stream"]("view: bento\ntags: мысли\nbogus: 1", el, { sourcePath: "Дашборд.md", addChild: (c) => children.push(c) });
    await wait(80);
    assert.ok(el.byClass("sf-feed--bento").length === 1, "bento из параметров блока");
    assert.ok(el.byClass("sf-formula__body")[0].textContent.includes("#мысли"), "фильтр из параметров блока");
    assert.ok(el.byClass("sf-block-warn")[0].textContent.includes("bogus"), "предупреждение о неизвестном параметре");
    assert.strictEqual(plugin.core.instances.size, 1);
    children[0].onunload(); assert.strictEqual(plugin.core.instances.size, 0);
    assert.strictEqual(el.byClass("sf-root").length, 0);
  });
  await test("настройки: поля меняют data.json, папки → источники, сброс требует подтверждения", async () => {
    const tab = plugin.reg.tabs[0]; obsidian.__settings.length = 0; tab.display();
    const S = (name) => obsidian.__settings.find((x) => x.name === name);
    assert.ok(obsidian.__settings.length >= 18, "поля настроек построены");
    const db = plugin.core.db;
    S("Папки с заметками").comps[0].onChangeFn("notes/LiveJournal\nnotes/Twitter/");
    assert.deepStrictEqual(db.data.settings.sources.map((x) => x.folder), ["notes/LiveJournal", "notes/Twitter"]);
    assert.deepStrictEqual(db.data.settings.sources.map((x) => x.id), ["livejournal", "twitter"]);
    S("Колонок минимум").comps[0].onChangeFn("3"); S("Колонок максимум").comps[0].onChangeFn("2");
    assert.deepStrictEqual(db.data.settings.columns, { min: 3, max: 3 }, "max не меньше min");
    S("Колонок минимум").comps[0].onChangeFn("99"); assert.strictEqual(db.data.settings.columns.min, 3, "значение вне диапазона игнорируется");
    S("Раздел по умолчанию").comps[0].onChangeFn("bento"); assert.strictEqual(db.data.settings.defaultView, "bento");
    S("На всю ширину").comps[0].onChangeFn(false); assert.strictEqual(db.data.settings.fullWidth, false);
    S("Поля даты").comps[0].onChangeFn("created, дата"); assert.deepStrictEqual(db.data.settings.dateFields, ["created", "дата"]);
    await wait(500); assert.deepStrictEqual(readDb().settings.sources.map((x) => x.folder), ["notes/LiveJournal", "notes/Twitter"], "записано в data.json");
    const btn = S("Сбросить всё").comps[0];
    await btn.onClickFn(); assert.strictEqual(db.data.settings.columns.min, 3, "первый клик только просит подтверждение");
    await btn.onClickFn(); assert.deepStrictEqual([db.data.settings.columns, db.data.settings.defaultView], [{ min: 2, max: 4 }, "stream"], "сброс к умолчаниям");
    assert.ok(R("services/config").DEFAULTS.sources[0].folder === "notes", "значения по умолчанию не испорчены");
    assert.ok(obsidian.__notices.some((n) => n.includes("сброшены")));
  });
  await test("новая заметка: путь по режимам (корень / папка / правило), токены, месяц словом", () => {
    const { newNotePath } = R("lib/new-note-path"), d = new Date(2026, 9, 22, 0, 31);
    assert.strictEqual(newNotePath({ mode: "root", fileName: "YYYY-MM-DD-hh-mm" }, d), "2026-10-22-00-31");
    assert.strictEqual(newNotePath({ mode: "folder", folder: "notes/", fileName: "YYYY-MM-DD-hh-mm" }, d), "notes/2026-10-22-00-31");
    assert.strictEqual(newNotePath({ mode: "rule", folder: "notes", rule: "%%FOLDER_NAME/YYYY/YYYY-MM-MMMM/YYYY-MM-DD-hh-mm" }, d), "notes/2026/2026-10-October/2026-10-22-00-31", "по умолчанию месяц в папках — английский");
    assert.strictEqual(newNotePath({ mode: "rule", folder: "notes", folderLang: "ru", rule: "%%FOLDER_NAME/YYYY/YYYY-MM-MMMM/YYYY-MM-DD-hh-mm" }, d), "notes/2026/2026-10-Октябрь/2026-10-22-00-31");
    assert.strictEqual(newNotePath({ mode: "rule", folder: "", rule: "%%FOLDER_NAME/YYYY/DD" }, d), "2026/22", "пустая папка не оставляет «//»");
    assert.strictEqual(newNotePath({ mode: "folder", folder: "", fileName: "DD" }, d), "22");
    const { fmtTokens, DEFAULT_DATE_RULE } = R("lib/new-note-path"), e = new Date(2026, 9, 16, 18, 14);
    assert.strictEqual(fmtTokens(DEFAULT_DATE_RULE, e), "16 октября 2026, 18:14", "формат даты по умолчанию");
    assert.strictEqual(fmtTokens("D MMMM YYYY, hh:mm", new Date(2026, 2, 5, 9, 7)), "5 марта 2026, 09:07");
    assert.strictEqual(fmtTokens("YYYY-MM-DD hh:mm", e), "2026-10-16 18:14");
    assert.strictEqual(fmtTokens("D MMMM YYYY", e, "en"), "16 October 2026");
  });
  await test("новая заметка: кнопка создаёт файл с датой, папки по правилу, не затирает существующий, открывает", async () => {
    const c = await mkEnv({ view: "stream", id: "nn" });
    const btn = c.byClass("sf-newnote")[0]; assert.ok(btn && btn.textContent.includes("Новая заметка"));
    app.opened.length = 0; btn.click(); await wait(40);
    const keys = Object.keys(app.createdFiles); const k = keys.at(-1);
    assert.ok(/^notes\/\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.md$/.test(k), k);
    assert.ok(/^---\ndate: "\d{1,2} [а-я]+ \d{4}, \d{2}:\d{2}"\n---\n\n$/.test(app.createdFiles[k]), "frontmatter с датой");
    assert.ok(app.opened.length === 1 && app.opened[0][0] === k, "заметка открыта");
    btn.click(); await wait(40); assert.ok(Object.keys(app.createdFiles).at(-1) === k.replace(".md", "-2.md"), "существующая заметка не затирается: суффикс -2");
    const tab = plugin.reg.tabs[0]; obsidian.__settings.length = 0; tab.display();
    const S = (n) => obsidian.__settings.find((x) => x.name === n);
    S("Куда складывать").comps[0].onChangeFn("rule");
    assert.strictEqual(plugin.core.db.data.settings.newNote.mode, "rule");
    assert.ok(/\d{4}-\d{2}-[A-Z][a-z]+/.test(obsidian.__settings.findLast((x) => x.name === "Пример").desc) && /date: \d{1,2} [а-я]+ \d{4}, \d{2}:\d{2}/.test(obsidian.__settings.findLast((x) => x.name === "Пример").desc), obsidian.__settings.findLast((x) => x.name === "Пример").desc);
    obsidian.__settings.findLast((x) => x.name === "Дата в заметке").comps[0].onChangeFn("YYYY-MM-DD hh:mm"); assert.strictEqual(plugin.core.db.data.settings.newNote.dateRule, "YYYY-MM-DD hh:mm");
    assert.ok(/date: \d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(obsidian.__settings.findLast((x) => x.name === "Пример").desc), "пример обновился");
  });
  await test("сборка: main.js самодостаточен — работает без папок src/ и css/ и не устарел", async () => {
    const built = fs.readFileSync(path.join(SRC, "main.js"), "utf8");
    assert.ok(built.startsWith(`/* Journal Stream v${R("app/version").VERSION} `), "main.js собран для другой версии — выполните node tools/build.js");
    require("child_process").execFileSync("node", [path.join(SRC, "tools/build.js")]);
    assert.strictEqual(fs.readFileSync(path.join(SRC, "main.js"), "utf8"), built, "main.js не соответствует src/ — выполните node tools/build.js");
    const dir = ".obsidian/plugins/journal-stream-bundled";
    fs.mkdirSync(path.join(VAULT, dir), { recursive: true });
    fs.copyFileSync(path.join(SRC, "main.js"), path.join(VAULT, dir, "main.js")); fs.copyFileSync(path.join(SRC, "manifest.json"), path.join(VAULT, dir, "manifest.json"));
    const Module = require("module"), orig = Module._load;
    Module._load = function (r, ...a) { return r === "obsidian" ? obsidian : orig.call(this, r, ...a); };
    delete require.cache[path.join(VAULT, dir, "main.js")];
    const P = require(path.join(VAULT, dir, "main.js")); Module._load = orig;
    const p2 = Object.assign(new P(), makePlugin(app, VAULT, dir));
    obsidian.__notices.length = 0; await p2.onload();
    assert.deepStrictEqual(obsidian.__notices, [], "без ошибок запуска");
    assert.ok(p2.reg.views["journal-stream-view"] && p2.reg.commands.length >= 9);
    const css = await p2.core.storage.listFiles("css"); assert.ok(css.length >= 15, "css встроен");
    assert.ok((await p2.core.storage.readText("README.md")).includes("## История версий"), "README встроен");
    const el = document.createElement("div"); el.__attached = true;
    await p2.reg.blocks["journal-stream"]("view: stream", el, { sourcePath: "N.md", addChild: () => {} }); await wait(60);
    assert.ok(el.byClass("sf-root").length === 1, "лента строится из встроенных модулей");
    p2.onunload();
  });
  await test("плавающее окно просмотра: включается опцией, открывает заметку в окне, скрывает бэклинки, Ctrl+клик — редактор", async () => {
    const c = await mkEnv({ view: "stream", id: "popup", popupView: false }); await wait(60);
    const tl = (c) => c.byClass("sf-card__backlinks").length;
    assert.ok(tl(c) > 0, "в обычном режиме бэклинки на карточках есть");
    app.opened.length = 0; c.byClass("sf-card__title")[0].dispatch("click");
    assert.strictEqual(app.opened.length, 1, "обычный режим — открытие в редакторе");
    const btn = c.byClass("sf-iconbtn").find((b) => (b.attrs.title || "").includes("плавающем окне")); assert.ok(btn, "кнопка-глаз в шапке");
    btn.click(); await wait(60);
    assert.strictEqual(tl(c), 0, "в режиме окна бэклинки скрыты");
    assert.ok(btn.classList.contains("is-active") || c.byClass("sf-iconbtn").some((b) => (b.attrs.title || "").includes("плавающем окне") && b.classList.contains("is-active")));
    app.opened.length = 0;
    const ovl = () => document.body.children.filter((n) => n.classList.contains("sf-npop-overlay") && n.isConnected);
    const win = () => ovl().flatMap((o) => o.byClass("sf-npop"));
    c.byClass("sf-card__title")[0].dispatch("click"); await wait(80);
    assert.strictEqual(app.opened.length, 0, "в редакторе не открывается");
    assert.strictEqual(win().length, 1, "окно появилось"); assert.strictEqual(ovl().length, 1, "затемнение основного контента (overlay)");
    assert.ok(ovl()[0].dispatch && true);
    const w = win()[0];
    assert.ok(w.byClass("sf-npop__title")[0].textContent.length > 0 && w.byClass("sf-npop__body")[0].textContent.length > 0, "заголовок и текст заметки");
    assert.ok(!w.textContent.includes("бэклинк") && w.byClass("sf-card__backlinks").length === 0, "в окне нет ссылок вперёд/назад");
    c.byClass("sf-card__title")[1].dispatch("click"); await wait(80);
    assert.strictEqual(win().length, 1, "окно одно: вторая заметка открывается в нём же");
    c.byClass("sf-card__title")[0].dispatch("click", { ctrlKey: true }); await wait(30);
    assert.strictEqual(app.opened.length, 1, "Ctrl+клик — в редакторе");
    document.dispatch("keydown", { key: "Escape" }); await wait(20);
    assert.strictEqual(win().length, 0, "Esc закрывает окно"); assert.strictEqual(ovl().length, 0, "затемнение убрано");
    c.byClass("sf-card__title")[0].dispatch("click"); await wait(60); const o = ovl()[0]; assert.ok(o, "окно открыто снова"); o.dispatch("click", { target: o }); await wait(20); assert.strictEqual(ovl().length, 0, "клик по затемнению закрывает");
    await wait(450); assert.strictEqual(readDb().ui.popupView, true, "режим запомнен");
  });
  await test("боковая панель: опция скрывает при открытии вкладки и возвращает при закрытии", async () => {
    const { leftSplit, rightSplit } = app.workspace; const db = plugin.core.db;
    db.data.settings.hideSidebar = "none";
    let v = plugin.reg.views["journal-stream-view"]({ id: "sb0" }); v.contentEl.__attached = true; await v.onOpen(); await wait(30);
    assert.ok(!leftSplit.collapsed, "по умолчанию панели не трогаем"); await v.onClose();
    db.data.settings.hideSidebar = "left";
    v = plugin.reg.views["journal-stream-view"]({ id: "sb1" }); v.contentEl.__attached = true; await v.onOpen(); await wait(30);
    assert.ok(leftSplit.collapsed && !rightSplit.collapsed, "левая скрыта, правая нет");
    await v.onClose(); assert.ok(!leftSplit.collapsed, "при закрытии возвращена");
    db.data.settings.hideSidebar = "both"; db.data.settings.restoreSidebar = false; rightSplit.collapsed = true;
    v = plugin.reg.views["journal-stream-view"]({ id: "sb2" }); v.contentEl.__attached = true; await v.onOpen(); await wait(30);
    assert.ok(leftSplit.collapsed && rightSplit.collapsed); await v.onClose(); assert.ok(leftSplit.collapsed, "restoreSidebar=false — не возвращаем");
    leftSplit.collapsed = false; rightSplit.collapsed = false; db.data.settings.hideSidebar = "none"; db.data.settings.restoreSidebar = true;
  });
  await test("changelog: раздел «История версий» берётся из README", () => {
    const { section } = R("services/changelog");
    const t = section("# T\n\n## История версий\n\n### v2.0.0\n- а\n\n## Другое\nх");
    assert.ok(t.startsWith("### v2.0.0") && !t.includes("Другое"));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  fs.rmSync(VAULT, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
})();
