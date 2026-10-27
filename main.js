/* Journal Stream v2.3.5 — собранный файл (tools/build.js). Не редактируйте: правьте src/ и пересобирайте. */
const __JS_BUNDLE__ = {
  modules: {
"app/actions": function (module, exports, require) {
// app/actions.js — все изменения состояния в одном месте (UI вызывает только их).
const { toggleTag, removeTag, merge, defaultFilter, toggleIn } = require("filters/state");
const { newSeed } = require("lib/random");
const { toState } = require("filters/presets");

const newDraft = () => ({ id: null, name: "", description: "", icon: "star" });
const draftOf = (p) => ({ id: p.id, name: p.name || "", description: p.description || "", icon: p.icon || "star" });

module.exports = function createActions(ctx) {
  const { store } = ctx;
  const filter = () => store.get().filter;
  const setFilter = (patch) => store.set({ filter: merge(filter(), patch), page: 1 });
  // Состояние «с чистого листа» — применяется при входе в раздел.
  const clean = () => ({ filter: defaultFilter(), quick: "all", page: 1, seed: newSeed(), presetId: null, collapsed: null, draft: null });

  return {
    setFilter,
    newDraft,
    resetFilter: () => store.set({ filter: defaultFilter(), page: 1, quick: "all", presetId: null }),
    setQuick: (quick) => store.set({ quick, page: 1, presetId: null }),
    shuffle: () => store.set({ seed: newSeed(), page: 1 }),
    toggleTag: (mode, tag) => store.set({ filter: toggleTag(filter(), mode, tag), page: 1 }),
    removeTag: (tag) => store.set({ filter: removeTag(filter(), tag), page: 1 }),
    toggleAttr: (a) => setFilter({ attrs: toggleIn(filter().attrs, a) }),
    toggleType: (t) => setFilter({ types: toggleIn(filter().types, t) }),
    toggleSource: (s) => setFilter({ sources: toggleIn(filter().sources, s) }),
    // Направление сортировки по времени: по умолчанию «сначала новые» (date-desc); любая другая сортировка → сначала новые
    toggleSortDir: () => setFilter({ sort: filter().sort === "date-desc" ? "date-asc" : "date-desc" }),
    setFullWidth: (fullWidth) => store.set({ fullWidth }),
    setPopupView: (popupView) => store.set({ popupView }),
    setOpenInNewTab: (openInNewTab) => store.set({ openInNewTab }),
    setTheme: (theme) => store.set({ theme }),
    // Повторный клик по активной кнопке возвращает автоопределение по ширине
    setViewModeTo: (viewMode) => store.set({ viewMode }),
    setViewMode: (mode) => store.set({ viewMode: store.get().viewMode === mode ? "auto" : mode }),
    setInsightsCount: (insightsCount) => store.set({ insightsCount }),
    setLayout: (layout) => store.set({ layout }),
    setCollapsed: (collapsed) => store.set({ collapsed }),
    nextPage: () => store.set({ page: store.get().page + 1 }),

    // Вход в раздел через навигацию: ВСЕГДА чистое состояние (фильтры, режим, страница, черновик конструктора).
    enterView(view) { store.set({ ...clean(), view }); if (ctx.scroll) ctx.scroll.toBlockTop(); },
    // Переход с переносом состояния (подборка, тег, день…) — без сброса.
    openPreset(preset, view = "stream") { store.set({ ...toState(preset), page: 1, presetId: preset.id || null, draft: null, view }); },
    applyPreset(preset) { store.set({ ...toState(preset), page: 1, presetId: preset.id || null }); },
    editPreset(preset) { store.set({ ...toState(preset), page: 1, presetId: preset.id, draft: draftOf(preset), view: "studio" }); },
    newPreset() { store.set({ ...clean(), draft: newDraft(), view: "studio" }); },
    // Клик по тегу в карточке: в Ленте/Бенто — переключить тег в фильтре; в других разделах — перейти в ленту с этим тегом.
    tagClick(tag) {
      const v = store.get().view;
      if (v === "stream" || v === "bento") store.set({ filter: toggleTag(filter(), "any", tag), page: 1 });
      else store.set({ ...clean(), filter: toggleTag(defaultFilter(), "any", tag), view: "stream" });
    },
    jumpToTag(tag) { store.set({ ...clean(), filter: toggleTag(defaultFilter(), "any", tag), view: "stream" }); },
    // Клик по типу в диаграмме обзора: в фильтрах остались только атрибуты — ставим соответствующий атрибут (иначе, для «текста» и canvas, — тип)
    jumpToType(type) {
      const attr = { image: "photo", video: "video", audio: "audio", quote: "quote", tasks: "task", link: "link" }[type];
      store.set({ ...clean(), filter: merge(null, attr ? { attrs: [attr] } : { types: [type] }), view: "stream" });
    },
    jumpToDay(day) { store.set({ ...clean(), filter: merge(null, { day }), view: "stream" }); },
  };
};

},
"app/main": function (module, exports, require) {
// app/main.js — композиция. Два уровня:
//  • createCore(plugin) — один раз на плагин: хранилище, общая база данных (data.json), CSS;
//  • mount(core, opts)   — на каждый вид (вкладка / code-block): настройки → сессия → состояние → контекст → оболочка.
const createStorage = require("services/storage");
const createDb = require("services/db");
const { DEFAULTS } = require("services/config");
const { DEFAULT_PRESETS, createPresets } = require("services/presets");
const loadCss = require("services/css-loader");
const createMarkdown = require("services/md");
const createMedia = require("services/media");
const createContent = require("services/content");
const createFlags = require("services/flags");
const createPostsRepo = require("services/posts");
const createSession = require("services/session");
const createIndexer = require("services/indexer");
const createScroll = require("services/scroll");
const createChangelog = require("services/changelog");
const createNewNote = require("services/new-note");
const createNotePopup = require("ui/common/note-popup");
const { Notice } = require("obsidian");
const createAppState = require("app/state");
const createActions = require("app/actions");
const createOpenNote = require("app/open-note");
const { mountShell } = require("app/shell");
const { VERSION } = require("app/version");

async function createCore(plugin) {
  const storage = createStorage(plugin);
  const db = await createDb(storage, { settings: DEFAULTS, presets: DEFAULT_PRESETS });
  await loadCss(storage);
  return { plugin, app: plugin.app, storage, db, instances: new Set(), defaults: DEFAULTS };
}

// opts: { container, input, sourcePath, component, boot }
async function mount(core, { container, input = {}, sourcePath = "", component = {}, boot = null }) {
  const { app, storage, db } = core;
  const config = JSON.parse(JSON.stringify(db.data.settings)); // копия: параметры вызова не пишутся обратно в данные
  if (input.nav === false) config.nav = false;

  // Ключ сессии: место, где живёт вид (заметка / вкладка) + id блока. Позволяет вернуться на то же место после перехода в заметку.
  const key = (sourcePath || "journal-stream") + "::" + (input.id || "default");
  const session = createSession(key);
  const { store, restored } = createAppState({ db, config, input, session });

  const disposers = [];
  const ctx = { app, plugin: core.plugin, component, sourcePath, input, config, storage, db, session, store, restored, boot, destroyed: false };
  ctx.onDispose = (fn) => { disposers.push(fn); };
  ctx.flags = createFlags({ db });
  ctx.presets = createPresets({ db });
  ctx.md = createMarkdown({ app, component });
  ctx.media = createMedia(app);
  ctx.content = createContent({ app, config });
  ctx.repo = createPostsRepo({ app, config });
  const popup = createNotePopup(ctx);
  ctx.openPreview = (link, source) => popup.open(link, source);
  ctx.closePreview = popup.close;
  Object.assign(ctx, createOpenNote(ctx));
  ctx.scrollKey = key;
  ctx.scroll = createScroll({ session, key, log: config.debug ? (...a) => console.log("[journal-stream:scroll]", ...a) : undefined });
  ctx.onDispose(() => ctx.scroll.destroy());
  ctx.actions = createActions(ctx);
  ctx.indexer = createIndexer(ctx);
  const makeNote = createNewNote(ctx);
  ctx.createNote = async () => { try { await makeNote(); } catch (e) { console.error("[journal-stream] новая заметка", e); new Notice("Journal Stream: не удалось создать заметку — " + (e && e.message ? e.message : e)); } };
  ctx.openChangelog = createChangelog({ app, storage, md: ctx.md, component });

  const inst = {
    ctx,
    // Изменились заметки vault: следующий рендер перечитает список (без лишней работы на каждое событие)
    markDirty() { ctx.repo.markDirty(); },
    destroy() {
      if (ctx.destroyed) return;
      ctx.destroyed = true;
      for (const fn of disposers.splice(0).reverse()) { try { fn(); } catch (e) { console.warn("[journal-stream] dispose", e); } }
      db.flush();
      core.instances.delete(inst);
    },
  };
  core.instances.add(inst);
  await mountShell(ctx, container);

  // Версия, которой записаны данные: после обновления плагина показываем одно уведомление со ссылкой на историю версий.
  const prev = db.data.appVersion;
  if (prev !== VERSION) {
    db.data.appVersion = VERSION; db.save();
    if (!db.fresh) ctx.toast(`Journal Stream обновлён${prev ? `: v${prev} → v${VERSION}` : ` до v${VERSION}`}. Что нового — по ссылке v${VERSION} в навигации`);
  }
  return inst;
}
module.exports = { createCore, mount };

},
"app/open-note": function (module, exports, require) {
// app/open-note.js — открытие заметок из виджета.
// Вкладка: настройка openInNewTab (кнопка в навигации) или Ctrl/Cmd/средняя кнопка — всегда в новой.
// Если заметка открывается в этой же вкладке — фиксируем прокрутку и снимаем «полную ширину» со страницы (для code-block),
// чтобы открытая заметка отображалась с обычными отступами.
module.exports = function createOpenNote(ctx) {
  const wantsNewTab = (evt) => !!(ctx.store.get().openInNewTab || (evt && (evt.ctrlKey || evt.metaKey || evt.button === 1)));
  // Режим «плавающее окно»: клик по карточке показывает заметку в окне просмотра. Ctrl/Cmd/средняя кнопка — как обычно, в редакторе.
  const wantsPopup = (evt) => !!(ctx.store.get().popupView && ctx.openPreview && !(evt && (evt.ctrlKey || evt.metaKey || evt.button === 1)));
  const open = (linktext, source, evt) => {
    if (wantsPopup(evt)) return ctx.openPreview(linktext, source);
    const newTab = wantsNewTab(evt);
    if (!newTab && ctx.leavePage) ctx.leavePage();
    return ctx.app.workspace.openLinkText(linktext, source || "", newTab);
  };
  return { openNote: (path, evt) => open(path, "", evt), openLink: (link, source, evt) => open(link, source, evt) };
};

},
"app/shell": function (module, exports, require) {
// app/shell.js — корневой контейнер: тема, ширина, навигация, переключение экранов, восстановление прокрутки.
const { h, clear } = require("lib/dom");
const nav = require("ui/common/nav");
const scrollTopButton = require("ui/common/scroll-top");
const versionBadge = require("ui/common/version-badge");
const skeletonGrid = require("ui/common/skeleton");
const watchObsidianTheme = require("services/theme-watch");
const views = require("views");

async function mountShell(ctx, container) {
  const { store, config } = ctx;
  let dispose = null, token = 0;
  const root = h("div", { class: "sf-root", dataset: { sfTheme: store.get().theme, sfView: store.get().view } });
  const region = h("div", { class: "sf-view" });
  container.appendChild(root);
  ctx.rootEl = root;
  ctx.scroll.setRoot(root);

  // Размер блока → классы: is-compact (< 900px), is-mobile (< singleColumnBelow, по умолчанию 560px — один столбец).
  // Считаем по ширине самого блока, а не окна: так работает и в узкой боковой панели.
  // Принудительный вид (кнопки в навигации): mobile — как на телефоне (один столбец, узкая «рамка»), desktop — как на компьютере
  // даже на узком экране (колонки по config.columns, блок не уже 760px). auto — по ширине блока.
  const baseSingle = config.singleColumnBelow ?? 560;
  const sizeOf = () => root.clientWidth || container.clientWidth || 0;
  function applySize() {
    const mode = store.get().viewMode || "auto", w = sizeOf();
    const mobile = mode === "mobile" ? true : mode === "desktop" ? false : w > 0 && w < baseSingle;
    const compact = mode === "mobile" ? true : mode === "desktop" ? false : w > 0 && w < 900;
    config.singleColumnBelow = mode === "mobile" ? 100000 : mode === "desktop" ? 0 : baseSingle; // читает раскладка плиток
    root.classList.toggle("is-compact", compact);
    root.classList.toggle("is-mobile", mobile);
    root.classList.toggle("is-forced-mobile", mode === "mobile");
    root.classList.toggle("is-forced-desktop", mode === "desktop");
    return mobile;
  }
  let wasMobile = applySize();

  // Возврат на страницу: позицию читаем ДО построения интерфейса, высоту резервируем, сохранение позиции приостанавливаем.
  const s0 = ctx.restored ? ctx.session.get() : null;
  const targetScroll = (s0 && s0.scroll) || 0;
  if (targetScroll) {
    if (s0.height) root.style.minHeight = s0.height + "px";
    ctx.scroll.hold();
  }
  root.append(...(config.nav ? [nav(ctx)] : []), region, ...(config.nav ? [] : [h("div", { class: "sf-footer" }, "Journal Stream ", versionBadge(ctx))]));
  scrollTopButton(ctx); // самостоятельная fixed-кнопка в <body>

  // Область заметки (в ней живёт «полная ширина»). Класс снимается при уходе со страницы.
  const host = container.closest ? container.closest(".markdown-preview-view, .markdown-source-view, .view-content") : null;
  const setHostFull = (on) => { if (host) host.classList.toggle("sf-page-full", !!on); };
  function applyLook() {
    const s = store.get();
    root.classList.toggle("is-full", !!s.fullWidth);
    root.dataset.sfTheme = s.theme;
    setHostFull(s.fullWidth);
  }
  applyLook();
  store.subscribe(applyLook, ["fullWidth", "theme"]);
  ctx.onDispose(watchObsidianTheme(ctx));
  store.subscribe(() => { wasMobile = applySize(); if (ctx.refreshNav) ctx.refreshNav(); show(); }, ["viewMode"]);

  // Obsidian переиспользует контейнер заметки при навигации: если виджет исчез (ушли в другую заметку любым способом) —
  // снимаем с контейнера класс полной ширины, чтобы новая заметка отображалась как обычно.
  ctx.leavePage = () => { ctx.scroll.leave(); setHostFull(false); };
  if (host && typeof setInterval === "function") {
    const timer = setInterval(() => { if (root.isConnected === false) { setHostFull(false); clearInterval(timer); } }, 800);
    ctx.onDispose(() => clearInterval(timer));
  }
  ctx.onDispose(() => setHostFull(false));

  if (typeof ResizeObserver !== "undefined") {
    let t = null;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { if (ctx.destroyed) return; const m = applySize(); if (m !== wasMobile) { wasMobile = m; if (ctx.refreshNav) ctx.refreshNav(); show(); } }, 120); });
    ro.observe(root);
    ctx.onDispose(() => { clearTimeout(t); ro.disconnect(); });
  }
  ctx.onDispose(() => { token++; if (dispose) { try { dispose(); } catch (e) {} dispose = null; } root.remove(); });
  async function show() {
    const my = ++token;
    if (dispose) { try { dispose(); } catch (e) {} dispose = null; }
    clear(region);
    const view = views.get(store.get().view);
    root.dataset.sfView = view.id;
    // Пока экран строится — шиммеры карточек; стартовую заглушку из view.js убираем, как только появились эти
    region.append(skeletonGrid(ctx, { count: 6 }));
    if (ctx.boot && ctx.boot.remove) { ctx.boot.remove(); ctx.boot = null; }
    await new Promise((r) => setTimeout(r, 0)); // отдать кадр браузеру, чтобы шиммеры успели отрисоваться до тяжёлой работы
    if (my !== token || ctx.destroyed) return;
    clear(region);
    try {
      const d = await view.render(ctx, region);
      if (my === token) dispose = d; else if (d) d();
    } catch (e) {
      console.error(e);
      region.append(h("pre", { class: "sf-error" }, `[journal-stream] ошибка экрана «${view.id}»:\n${e && e.stack ? e.stack : e}`));
    }
  }
  ctx.reload = show;
  ctx.toast = (text) => { const t = h("div", { class: "sf-toast" }, text); root.append(t); setTimeout(() => t.remove(), 2200); };
  store.subscribe(show, ["view", "popupView"]); // смена режима окна перерисовывает карточки (бэклинки скрываются)
  await show();
  // Вернулись на страницу — возвращаем прокрутку (карточки дорисовываются, поэтому восстановление с повторами).
  if (targetScroll) ctx.scroll.restore(targetScroll, () => { root.style.minHeight = ""; });
}
module.exports = { mountShell };

},
"app/state": function (module, exports, require) {
// app/state.js — реактивное состояние экрана.
// • Между перерисовками блока (переход в другую заметку и назад) состояние берётся из session — в памяти.
// • Предпочтения UI (раскладка, полная ширина) сохраняются в едином файле данных.
const { createStore } = require("lib/store");
const { newSeed } = require("lib/random");
const { merge } = require("filters/state");

const normLayout = (l) => (l === "timeline" || l === "masonry" ? l : l === "flow" ? "timeline" : "masonry");

module.exports = function createAppState({ db, config, input, session }) {
  const ui = db.data.ui || {};
  const saved = session.get() && session.get().state;
  const fresh = {
    view: input.view || config.defaultView,
    layout: normLayout(input.layout || ui.layout || config.layout),
    fullWidth: !!(input.fullWidth ?? ui.fullWidth ?? config.fullWidth),
    openInNewTab: !!(input.openInNewTab ?? ui.openInNewTab ?? config.openInNewTab),
    popupView: !!(input.popupView ?? ui.popupView ?? config.popupView),
    theme: input.theme || ui.theme || config.theme,
    viewMode: input.viewMode || ui.viewMode || "auto",   // auto | mobile | desktop — принудительный вид
    insightsCount: Number(input.insightsCount ?? ui.insightsCount ?? config.insightsCount) || 3,
    quick: "all", filter: merge(input.filter), seed: newSeed(), page: 1, collapsed: null, presetId: null, draft: null,
  };
  const store = createStore(saved ? { ...fresh, ...saved, layout: normLayout(saved.layout) } : fresh);
  const restored = !!saved;

  store.subscribe((s) => session.patch({ state: s }));
  store.subscribe((s) => { db.data.ui = { ...db.data.ui, layout: s.layout, fullWidth: s.fullWidth, openInNewTab: s.openInNewTab, popupView: s.popupView, theme: s.theme, insightsCount: s.insightsCount, viewMode: s.viewMode }; db.save(); }, ["layout", "fullWidth", "openInNewTab", "popupView", "theme", "insightsCount", "viewMode"]);
  session.patch({ state: store.get() });
  return { store, restored };
};

},
"app/version": function (module, exports, require) {
// app/version.js — ЕДИНСТВЕННЫЙ источник версии кода. При выпуске: поднять VERSION здесь и в manifest.json и добавить запись
// в README → «История версий» (тест tests/run.js проверяет, что версии совпадают и запись есть).
module.exports = {
  VERSION: "2.3.5",
  RELEASED: "2026-10-27",
};

},
"filters/attrs": function (module, exports, require) {
// filters/attrs.js — атрибуты-переключатели («С медиа», «Цитаты», «Задачи» …).
const ATTRS = [
  { id: "media", label: "С медиа", icon: "image" },
  { id: "photo", label: "С фото", icon: "image" },
  { id: "video", label: "Видеозаписи", icon: "video" },
  { id: "audio", label: "Аудио", icon: "mic" },
  { id: "quote", label: "Цитаты", icon: "quote" },
  { id: "task", label: "Задачи", icon: "tasks" },
  { id: "link", label: "Со ссылками", icon: "link" },
];
const label = (id) => (ATTRS.find((a) => a.id === id) || { label: id }).label;
module.exports = { ATTRS, label };

},
"filters/dql": function (module, exports, require) {
// filters/dql.js — компиляция состояния фильтра в Dataview DQL (TABLE).
const { dqlEscape } = require("lib/text");
const { byId: periods } = require("filters/periods");
const { merge } = require("filters/state");
const { toMs, DAY } = require("lib/date");

const EXT = { photo: "png|jpe?g|gif|webp|svg|avif", video: "mp4|mov|mkv|webm|m4v", audio: "mp3|wav|m4a|ogg|flac|aac", media: "png|jpe?g|gif|webp|svg|avif|mp4|mov|mkv|webm|m4v|mp3|wav|m4a|ogg|flac|aac" };
const outlinkMedia = (ext) => `length(filter(file.outlinks, (l) => regexmatch("(?i).*\\\\.(${ext})$", string(l.path)))) > 0`;
const tag = (t) => `contains(file.tags, "#${dqlEscape(t)}")`;

function compile(filter, opts = {}) {
  const f = merge(filter), cfg = opts.config || {}, notes = [];
  const dateExpr = (cfg.dql && cfg.dql.dateExpr) || "file.cday";
  const folders = f.sources.length
    ? (cfg.sources || []).filter((s) => f.sources.includes(s.id)).map((s) => s.folder)
    : (cfg.sources || []).filter((s) => s.enabled !== false && s.folder).map((s) => s.folder);
  const where = [];

  if (f.any.length) where.push("(" + f.any.map(tag).join(" OR ") + ")");
  for (const t of f.all) where.push(tag(t));
  for (const t of f.not) where.push("!" + tag(t));
  for (const a of f.attrs) {
    if (EXT[a]) where.push("(" + outlinkMedia(EXT[a]) + ")");
    else if (a === "task") where.push("length(file.tasks) > 0");
    else { where.push(`contains(file.tags, "#${a === "quote" ? "цитата" : a}")`); notes.push(`Атрибут «${a}» в DQL приблизительный (по тегу): точное определение делает движок ленты.`); }
  }
  if (f.types.length) notes.push("Типы карточек определяются движком ленты и в DQL не выражаются.");
  const p = periods[f.period];
  if (p && p.days) where.push(`${dateExpr} >= date(today) - dur(${p.days} days)`);
  const nextDay = (s) => { const d = new Date(toMs(s) + DAY); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  if (f.dateFrom && toMs(f.dateFrom) != null) where.push(`${dateExpr} >= date("${f.dateFrom}")`);
  if (f.dateTo && toMs(f.dateTo) != null) where.push(`${dateExpr} < date("${nextDay(f.dateTo)}")`);
  if (f.day) where.push(`${dateExpr} = date("${f.day}")`);
  if (f.minBacklinks > 0) where.push(`length(file.inlinks) >= ${f.minBacklinks}`);
  if (f.text.trim()) where.push(`contains(lower(file.name), "${dqlEscape(f.text.trim().toLowerCase())}")`);
  if (opts.quick === "today") where.push(`dateformat(${dateExpr}, "MM-dd") = dateformat(date(today), "MM-dd")`);
  if (opts.quick === "favorites") where.push(`${cfg.favoriteField || "favorite"} = true`);
  if (opts.quick === "random") notes.push("«Рандомные» — перемешивание выполняет движок ленты (DQL не умеет random).");

  const sort = { "date-desc": `${dateExpr} DESC`, "date-asc": `${dateExpr} ASC`, "mtime-desc": "file.mtime DESC", "backlinks-desc": "length(file.inlinks) DESC", "length-desc": "file.size DESC", "alpha-asc": "file.name ASC" }[f.sort] || `${dateExpr} DESC`;
  const lines = [`TABLE WITHOUT ID file.link AS "Заметка", ${dateExpr} AS "Дата", length(file.inlinks) AS "Связи"`];
  if (folders.length) lines.push("FROM " + folders.map((x) => `"${dqlEscape(x)}"`).join(" OR "));
  if (where.length) lines.push("WHERE " + where.join("\n  AND "));
  lines.push("SORT " + sort);
  return { query: lines.join("\n"), notes };
}
module.exports = { compile };

},
"filters/engine": function (module, exports, require) {
// filters/engine.js — применение фильтра к списку постов.
const { predicates } = require("filters/predicates");
const { merge } = require("filters/state");
const { get: sorter } = require("filters/sorters");

function matches(post, filter, now) {
  for (const key of Object.keys(predicates)) if (!predicates[key](post, filter, now)) return false;
  return true;
}
function applyFilter(posts, filter, now = Date.now()) {
  const f = merge(filter);
  return posts.filter((p) => matches(p, f, now));
}
function sortPosts(posts, key) { return posts.slice().sort(sorter(key)); }
module.exports = { matches, applyFilter, sortPosts };

},
"filters/formula": function (module, exports, require) {
// filters/formula.js — человекочитаемая формула фильтра. Показывает ВСЕ активные условия
// (теги, атрибуты, тип, источник, период, связи, день, текст) — скрытых условий не бывает.
const { label } = require("filters/attrs");
const { byId: periods } = require("filters/periods");

function toTokens(f) {
  const groups = [];
  if (f.any.length) groups.push({ mode: "any", op: "OR", tags: f.any });
  if (f.all.length) groups.push({ mode: "all", op: "AND", tags: f.all });
  const out = [];
  const sep = () => { if (out.length) out.push({ t: "op", v: "AND" }); };
  for (const g of groups) {
    sep(); out.push({ t: "paren", v: "(" });
    g.tags.forEach((tag, i) => { if (i) out.push({ t: "op", v: g.op }); out.push({ t: "tag", v: "#" + tag, tag, mode: g.mode }); });
    out.push({ t: "paren", v: ")" });
  }
  if (f.not.length) {
    sep(); out.push({ t: "op", v: "NOT", neg: true }, { t: "paren", v: "(" });
    f.not.forEach((tag, i) => { if (i) out.push({ t: "op", v: "OR" }); out.push({ t: "tag", v: "!#" + tag, tag, mode: "not" }); });
    out.push({ t: "paren", v: ")" });
  }
  for (const a of f.attrs) { sep(); out.push({ t: "attr", v: label(a), attr: a }); }
  // прочие условия — отдельными удаляемыми чипами
  const cond = (v, key, item) => { sep(); out.push({ t: "cond", v, key, item }); };
  for (const t of f.types) cond("тип: " + t, "types", t);
  for (const s of f.sources) cond("источник: " + s, "sources", s);
  if (f.period && f.period !== "all") cond("период: " + (periods[f.period] ? periods[f.period].label.toLowerCase() : f.period), "period");
  if (f.minBacklinks > 0) cond("связи ≥ " + f.minBacklinks, "minBacklinks");
  if (f.dateFrom) cond("с " + f.dateFrom, "dateFrom");
  if (f.dateTo) cond("по " + f.dateTo, "dateTo");
  if (f.day) cond("день: " + f.day, "day");
  if ((f.text || "").trim()) cond("поиск: «" + f.text.trim() + "»", "text");
  return out;
}
const toString = (f) => toTokens(f).map((t) => t.v).join(" ");
module.exports = { toTokens, toString };

},
"filters/periods": function (module, exports, require) {
// filters/periods.js — относительные периоды для фильтра.
const DAY = 86400000;
const PERIODS = [
  { id: "all", label: "Весь архив", days: null },
  { id: "7d", label: "За 7 дней", days: 7 },
  { id: "14d", label: "За 14 дней", days: 14 },
  { id: "30d", label: "За 30 дней", days: 30 },
  { id: "3m", label: "За 3 месяца", days: 90 },
  { id: "1y", label: "За год", days: 365 },
];
const byId = Object.fromEntries(PERIODS.map((p) => [p.id, p]));
const inPeriod = (ts, period, now) => { const p = byId[period]; return !p || !p.days || ts >= now - p.days * DAY; };
module.exports = { PERIODS, byId, inPeriod };

},
"filters/pipeline": function (module, exports, require) {
// filters/pipeline.js — полный путь: все посты → фильтр → быстрый режим → сортировка/закрепы.
const { applyFilter, sortPosts } = require("filters/engine");
const { applyQuick } = require("filters/quick-modes");

function run(posts, state, env) {
  const c = { now: env.now || Date.now(), seed: state.seed, config: env.config, flags: env.flags };
  const filtered = applyFilter(posts, state.filter, c.now);
  let list = applyQuick(filtered, state.quick, c);
  list = sortPosts(list, state.quick === "random" ? "date-desc" : state.filter.sort);
  const pinned = list.filter((p) => env.flags.isPinned(p));
  return { filtered, list: pinned.length ? [...pinned, ...list.filter((p) => !env.flags.isPinned(p))] : list };
}
module.exports = { run };

},
"filters/predicates": function (module, exports, require) {
// filters/predicates.js — отдельные условия фильтра (каждое — чистая функция).
const { inPeriod } = require("filters/periods");
const { dayKey, toMs, startOfDay, DAY } = require("lib/date");
const { norm } = require("lib/search");
const tagHit = (postTags, wanted) => postTags.some((t) => t === wanted || t.startsWith(wanted + "/"));

const predicates = {
  any: (p, f) => !f.any.length || f.any.some((t) => tagHit(p.tags, t)),
  all: (p, f) => f.all.every((t) => tagHit(p.tags, t)),
  not: (p, f) => !f.not.some((t) => tagHit(p.tags, t)),
  attrs: (p, f) => f.attrs.every((a) => p.attrs.has(a)),
  types: (p, f) => !f.types.length || f.types.includes(p.type),
  sources: (p, f) => !f.sources.length || f.sources.includes(p.source),
  period: (p, f, now) => inPeriod(p.ts, f.period, now),
  day: (p, f) => !f.day || dayKey(p.ts) === f.day,
  // Диапазон дат: «от» и «до» независимы — можно задать любой из них, оба или ни одного; границы включительно.
  range: (p, f) => {
    const from = f.dateFrom ? toMs(f.dateFrom) : null, to = f.dateTo ? toMs(f.dateTo) : null;
    if (from != null && p.ts < startOfDay(from)) return false;
    if (to != null && p.ts >= startOfDay(to) + DAY) return false;
    return true;
  },
  backlinks: (p, f) => p.backlinks >= (f.minBacklinks || 0),
  text: (p, f) => {
    const words = norm((f.text || "").trim()).split(/\s+/).filter(Boolean);
    return words.every((w) => p.search.includes(w) || (p.searchBody || "").includes(w));
  },
};
module.exports = { predicates, tagHit };

},
"filters/presets": function (module, exports, require) {
// filters/presets.js — сохранённые подборки: сводка правил (чипы) и применение к состоянию ленты.
const { merge } = require("filters/state");
const { byId: periods } = require("filters/periods");
const { label: attrLabel } = require("filters/attrs");

function ruleChips(preset) {
  const f = merge(preset.filter), chips = [];
  if (f.any.length) chips.push("теги: " + f.any.map((t) => "#" + t).join(" OR "));
  if (f.all.length) chips.push("все: " + f.all.map((t) => "#" + t).join(" AND "));
  if (f.not.length) chips.push("без: " + f.not.map((t) => "#" + t).join(", "));
  if (f.attrs.length) chips.push(f.attrs.map(attrLabel).join(", "));
  if (f.types.length) chips.push("тип: " + f.types.join(", "));
  if (f.minBacklinks > 0) chips.push("связи: > " + (f.minBacklinks - 1));
  if (periods[f.period] && f.period !== "all") chips.push("период: " + periods[f.period].label.toLowerCase());
  if (f.dateFrom) chips.push("с " + f.dateFrom);
  if (f.dateTo) chips.push("по " + f.dateTo);
  if (preset.quick === "today") chips.push("в этот день");
  if (preset.quick === "random") chips.push("рандом");
  if (preset.quick === "favorites") chips.push("избранное");
  return chips;
}
const toState = (preset) => ({ quick: preset.quick || "all", filter: merge(preset.filter) });
module.exports = { ruleChips, toState };

},
"filters/quick-modes": function (module, exports, require) {
// filters/quick-modes.js — быстрые режимы ленты: Все / В этот день / Рандомные / Избранное.
const { sameMonthDay } = require("lib/date");
const { shuffle } = require("lib/random");

const MODES = [
  { id: "all", icon: "infinity", label: () => "Все записи", test: () => true },
  { id: "today", icon: "history", label: () => "В этот день", test: (p, c) => sameMonthDay(p.ts, c.now) },
  { id: "random", icon: "dice", label: () => "Рандомные", pick: (list, c) => shuffle(list, c.seed).slice(0, c.config.randomCount || 12) },
  { id: "favorites", icon: "star", label: () => "Избранное", test: (p, c) => c.flags.isFavorite(p) },
];
const byId = Object.fromEntries(MODES.map((m) => [m.id, m]));

// c = { now, seed, config, flags }
function applyQuick(posts, quick, c) {
  const m = byId[quick] || byId.all;
  let out = m.test ? posts.filter((p) => m.test(p, c)) : posts;
  if (m.pick) out = m.pick(out, c);
  return out;
}
const count = (posts, id, c) => { const m = byId[id]; return m && m.test ? posts.filter((p) => m.test(p, c)).length : posts.length; };
module.exports = { MODES, byId, applyQuick, count };

},
"filters/sorters": function (module, exports, require) {
// filters/sorters.js — варианты сортировки ленты.
const SORTS = [
  { id: "date-desc", label: "Сначала новые", cmp: (a, b) => b.ts - a.ts },
  { id: "date-asc", label: "Сначала старые", cmp: (a, b) => a.ts - b.ts },
  { id: "mtime-desc", label: "Дата изменения", cmp: (a, b) => b.mtime - a.mtime },
  { id: "backlinks-desc", label: "Плотность связей", cmp: (a, b) => b.backlinks - a.backlinks || b.ts - a.ts },
  { id: "length-desc", label: "Длина текста", cmp: (a, b) => b.size - a.size },
  { id: "alpha-asc", label: "Алфавит", cmp: (a, b) => a.title.localeCompare(b.title, "ru") },
];
const get = (id) => (SORTS.find((s) => s.id === id) || SORTS[0]).cmp;
module.exports = { SORTS, get };

},
"filters/state": function (module, exports, require) {
// filters/state.js — модель состояния фильтра и неизменяемые операции над ним.
const MODES = ["any", "all", "not"];
const defaultFilter = () => ({ any: [], all: [], not: [], attrs: [], types: [], sources: [], period: "all", day: "", dateFrom: "", dateTo: "", minBacklinks: 0, text: "", sort: "date-desc" });
const normTag = (t) => String(t || "").trim().replace(/^#+/, "").toLowerCase();
const merge = (base, patch) => ({ ...defaultFilter(), ...(base || {}), ...(patch || {}) });
const isDefault = (f) => JSON.stringify(merge(f)) === JSON.stringify(defaultFilter());
const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// Тег живёт ровно в одном режиме: повторный клик по тому же режиму снимает его.
function toggleTag(filter, mode, tag) {
  const t = normTag(tag), had = filter[mode].includes(t), next = { ...filter };
  for (const m of MODES) next[m] = filter[m].filter((x) => x !== t);
  if (!had) next[mode] = [...next[mode], t];
  return next;
}
const removeTag = (filter, tag) => { const t = normTag(tag), n = { ...filter }; for (const m of MODES) n[m] = filter[m].filter((x) => x !== t); return n; };
const tagMode = (filter, tag) => MODES.find((m) => filter[m].includes(normTag(tag))) || null;

module.exports = { MODES, defaultFilter, normTag, merge, isDefault, toggleIn, toggleTag, removeTag, tagMode };

},
"filters/summary": function (module, exports, require) {
// filters/summary.js — краткая сводка применённых условий для мобильной панели: ["Подборка: …", "В этот день", "#a #b", "с 1 окт", …].
const { label: attrLabel } = require("filters/attrs");
const { byId: periods } = require("filters/periods");
const { MONTHS_GEN, toMs } = require("lib/date");

const QUICK = { today: "В этот день", random: "Рандом", favorites: "Избранное" };
function shortDate(s) {
  const ms = toMs(s);
  if (ms == null) return s;
  const d = new Date(ms), cur = new Date().getFullYear();
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()].slice(0, 3)}${d.getFullYear() === cur ? "" : " " + d.getFullYear()}`;
}
const tagList = (arr, max = 3) => arr.slice(0, max).map((t) => "#" + t).join(" ") + (arr.length > max ? ` +${arr.length - max}` : "");

// presetName — имя активной подборки (если есть). Возвращает массив коротких строк в порядке важности.
function summarize(state, { presetName } = {}) {
  const f = state.filter, out = [];
  if (presetName) out.push("Подборка: " + presetName);
  if (QUICK[state.quick]) out.push(QUICK[state.quick]);
  if (f.any.length) out.push(tagList(f.any));
  if (f.all.length) out.push("все: " + tagList(f.all));
  if (f.not.length) out.push("без " + tagList(f.not));
  if (f.attrs.length) out.push(f.attrs.map(attrLabel).join(", "));
  if ((f.text || "").trim()) out.push("«" + f.text.trim() + "»");
  if (f.dateFrom || f.dateTo) out.push(f.dateFrom && f.dateTo ? `${shortDate(f.dateFrom)} – ${shortDate(f.dateTo)}` : f.dateFrom ? "с " + shortDate(f.dateFrom) : "по " + shortDate(f.dateTo));
  if (f.day) out.push("день " + shortDate(f.day));
  if (f.period && f.period !== "all" && periods[f.period]) out.push(periods[f.period].label.toLowerCase());
  if (f.minBacklinks > 0) out.push("связи ≥ " + f.minBacklinks);
  if (f.sources.length) out.push("источник: " + f.sources.join(", "));
  if (f.types.length) out.push("тип: " + f.types.join(", "));
  if (f.sort === "date-asc") out.push("Старые сначала");
  else if (f.sort !== "date-desc") out.push("сортировка: " + f.sort.replace(/-.*/, ""));
  return out;
}
module.exports = { summarize, shortDate };

},
"lib/async": function (module, exports, require) {
// lib/async.js — debounce, пул задач с ограничением параллелизма, мьютекс.
function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); return fn(...a); };
  return d;
}
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
function createMutex() {
  let tail = Promise.resolve();
  return (task) => { const run = tail.then(task, task); tail = run.catch(() => {}); return run; };
}
module.exports = { debounce, mapPool, createMutex };

},
"lib/date": function (module, exports, require) {
// lib/date.js — разбор и форматирование дат (всё в локальном времени).
const DAY = 86400000;
const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const MONTHS_NOM = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const RU_MONTH = { янв: 0, фев: 1, мар: 2, апр: 3, мая: 4, май: 4, июн: 5, июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11 };
const pad = (n) => String(n).padStart(2, "0");

// Числа меньше 1e11 — это секунды (иначе 1 200 000 000 превращается в 14 января 1970).
const unixMs = (n) => (Math.abs(n) < 1e11 ? n * 1000 : n);
// Всё, что раньше 1980 года, считается ошибкой данных, а не датой записи.
const MIN_TS = Date.UTC(1980, 0, 1);
const plausible = (ms) => ms != null && ms >= MIN_TS;

function toMs(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? unixMs(v) : null;
  if (v instanceof Date) return isNaN(v) ? null : v.getTime();
  if (typeof v.toMillis === "function") return v.toMillis(); // luxon DateTime (Dataview)
  if (typeof v === "object" && v.path) return fromFilename(v.path); // [[2024-10-01]] — дата из имени заметки
  const s = String(v).trim();
  if (/^\d{9,10}$/.test(s)) return +s * 1000;   // Unix-время в секундах
  if (/^\d{12,13}$/.test(s)) return +s;          // Unix-время в миллисекундах
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
  // «1 октября 2024, 16:12» · «1 окт 2024 г. в 16:12» · «1 октября 2024»
  m = s.toLowerCase().match(/^(\d{1,2})\s+([а-яё]+)\.?\s+(\d{4})(?:\s*г\.?)?(?:[,\sв]+(\d{1,2}):(\d{2}))?/);
  if (m && RU_MONTH[m[2].slice(0, 3)] !== undefined) return new Date(+m[3], RU_MONTH[m[2].slice(0, 3)], +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
  const t = Date.parse(s);
  return isNaN(t) ? null : t;
}

function hasTime(v, ms) {
  if (v == null) return false;
  if (typeof v === "string") return /\d{1,2}:\d{2}/.test(v);
  if (typeof v.hour === "number") return v.hour !== 0 || v.minute !== 0;
  if (ms != null) { const d = new Date(ms); return d.getHours() !== 0 || d.getMinutes() !== 0; }
  return false;
}

function fromFilename(name) {
  const m = String(name || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null;
}

const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthKey = (ms) => dayKey(ms).slice(0, 7);
const fmtDate = (ms) => dayKey(ms);
const fmtTime = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// «1 октября 2024» и «1 октября 2024, 16:12» — как в самих заметках
const fmtDateLong = (ms) => { const d = new Date(ms); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDateTime = (ms, withTime) => (withTime ? `${fmtDateLong(ms)}, ${fmtTime(ms)}` : fmtDateLong(ms));
const fmtDayMonth = (ms) => { const d = new Date(ms); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };
const sameMonthDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };

function relativeLabel(ms, now = Date.now(), withTime = true) {
  const diff = Math.round((startOfDay(now) - startOfDay(ms)) / DAY);
  const t = withTime ? `, ${fmtTime(ms)}` : "";
  if (diff === 0) return "Сегодня" + t;
  if (diff === 1) return "Вчера" + t;
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  return sameYear ? fmtDayMonth(ms) + t : `${fmtDayMonth(ms)} ${new Date(ms).getFullYear()}`;
}

module.exports = { DAY, MONTHS_GEN, MONTHS_NOM, toMs, plausible, hasTime, fromFilename, startOfDay, dayKey, monthKey, fmtDate, fmtDateLong, fmtTime, fmtDateTime, fmtDayMonth, sameMonthDay, relativeLabel };

},
"lib/dom": function (module, exports, require) {
// lib/dom.js — маленький хелпер для сборки DOM без фреймворков.
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = Array.isArray(v) ? v.filter(Boolean).join(" ") : v;
      else if (k === "style" && typeof v === "object") { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith("--") && el.style.setProperty) el.style.setProperty(sk, sv); else el.style[sk] = sv; } } // CSS-переменные (--x) задаются через setProperty
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
  }
  return append(el, children);
}

function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

module.exports = { h, append, clear };

},
"lib/icons": function (module, exports, require) {
// lib/icons.js — inline SVG-иконки (24x24, stroke). Не зависит от внешних шрифтов.
const P = {
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  infinity: '<path d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  video: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .01-1 1.03V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>',
  tasks: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  hash: '<path d="M4 9h16"/><path d="M4 15h16"/><path d="M10 3 8 21"/><path d="m16 3-2 18"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  rows: '<rect x="3" y="3" width="18" height="7" rx="1"/><rect x="3" y="14" width="18" height="7" rx="1"/>',
  timeline: '<path d="M12 3v18"/><circle cx="12" cy="8" r="2"/><path d="M14 8h6"/><circle cx="12" cy="16" r="2"/><path d="M4 16h6"/>',
  bento: '<rect x="3" y="3" width="8" height="12" rx="1"/><rect x="13" y="3" width="8" height="6" rx="1"/><rect x="13" y="11" width="8" height="10" rx="1"/><rect x="3" y="17" width="8" height="4" rx="1"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  expand: '<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/>',
  shrink: '<path d="m14 10 7-7"/><path d="M20 10h-6V4"/><path d="m3 21 7-7"/><path d="M4 14h6v6"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  newtab: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  unfold: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
};

function icon(name, opts = {}) {
  const size = opts.size || 16;
  const span = document.createElement("span");
  span.className = "sf-icon" + (opts.cls ? " " + opts.cls : "");
  span.innerHTML =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `fill="${opts.fill ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.file}</svg>`;
  return span;
}

module.exports = { icon, names: Object.keys(P) };

},
"lib/layout": function (module, exports, require) {
// lib/layout.js — сколько колонок помещается в ширину (config.columns.min/max + minCardWidth).
// Узкий контейнер (< singleColumnBelow, по умолчанию 560px — телефон) всегда даёт 1 колонку.
function columnCount(width, cfg, gap = 24) {
  let { min = 2, max = 4 } = cfg.columns || {};
  if (min > max) [min, max] = [max, min];
  min = Math.max(1, min); max = Math.max(min, max);
  if (!width) return max;
  if (width < (cfg.singleColumnBelow ?? 560)) return 1;
  const fit = Math.floor((width + gap) / ((cfg.minCardWidth || 320) + gap));
  return Math.max(min, Math.min(max, fit));
}
module.exports = { columnCount };

},
"lib/misc": function (module, exports, require) {
// lib/misc.js — мелкие утилиты: хэш, глубокий merge, копирование, приведение Dataview-массивов.
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

function deepMerge(base, over) {
  if (Array.isArray(base) || Array.isArray(over) || typeof base !== "object" || typeof over !== "object" || !base || !over) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
  return out;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
    ta.remove(); return ok;
  }
}

const toArray = (x) => (x == null ? [] : Array.isArray(x) ? x : typeof x[Symbol.iterator] === "function" && typeof x !== "string" ? Array.from(x) : [x]);
function pageField(page, names) {
  for (const n of names) { const v = page[n]; if (v !== undefined && v !== null && v !== "") return v; }
  return undefined;
}
const uid = (p = "id") => p + "-" + Math.random().toString(36).slice(2, 8);

module.exports = { hash, deepMerge, copyText, toArray, pageField, uid };

},
"lib/new-note-path": function (module, exports, require) {
// lib/new-note-path.js — путь новой заметки по настройке (чистая функция).
// Язык названий месяцев в путях — newNote.folderLang (по умолчанию en: 2026-10-October), в дате заметки — newNote.dateLang (по умолчанию ru).
// Токены (регистр важен): YYYY — год, MM — месяц числом, MMMM — месяц словом (Октябрь; после «D »/«DD » — «октября»), DD — день с нулём, D — день без нуля, hh — часы, mm — минуты.
// %%FOLDER_NAME в правиле заменяется на папку из настроек.
const { MONTHS_NOM, MONTHS_GEN } = require("lib/date");
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n) => String(n).padStart(2, "0");

// Месяц словом (токен MMMM) зависит от языка lang: "en" — October; "ru" — Октябрь, а после «D »/«DD » — родительный («16 октября»).
function fmtTokens(pattern, d, lang = "ru") {
  return String(pattern).replace(/(DD? )?(MMMM)|YYYY|MM|DD|D|hh|mm/g, (t, dayBefore, mmmm) => {
    if (mmmm) {
      const day = dayBefore ? dayBefore.replace(/^DD?/, (x) => (x === "DD" ? pad(d.getDate()) : String(d.getDate()))) : "";
      const names = lang === "en" ? MONTHS_EN : dayBefore ? MONTHS_GEN : MONTHS_NOM;
      return day + names[d.getMonth()];
    }
    return ({ YYYY: String(d.getFullYear()), MM: pad(d.getMonth() + 1), DD: pad(d.getDate()), D: String(d.getDate()), hh: pad(d.getHours()), mm: pad(d.getMinutes()) })[t];
  });
}
const DEFAULT_DATE_RULE = "D MMMM YYYY, hh:mm";
const clean = (p) => String(p).split("/").map((s) => s.trim().replace(/[\\:*?"<>|#^\[\]]/g, "-")).filter(Boolean).join("/");

// → путь без расширения, например "notes/2026/2026-10-Октябрь/2026-10-22-00-31"
function newNotePath(cfg, date = new Date()) {
  const n = cfg || {}, folder = String(n.folder || "").replace(/^\/+|\/+$/g, "");
  const file = n.fileName || "YYYY-MM-DD-hh-mm";
  let raw;
  if (n.mode === "rule") raw = fmtTokens(String(n.rule || file).replace(/%%FOLDER_NAME/g, folder), date, n.folderLang || "en");
  else if (n.mode === "root" || !folder) raw = fmtTokens(file, date, n.folderLang || "en");
  else raw = folder + "/" + fmtTokens(file, date, n.folderLang || "en");
  return clean(raw);
}
module.exports = { newNotePath, fmtTokens, DEFAULT_DATE_RULE };

},
"lib/random": function (module, exports, require) {
// lib/random.js — детерминированный рандом: «Перемешать» меняет seed, а не условия фильтра.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, seed) {
  const rnd = mulberry32(seed), a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const newSeed = () => Math.floor(Math.random() * 2 ** 31);
module.exports = { mulberry32, shuffle, newSeed };

},
"lib/ru": function (module, exports, require) {
// lib/ru.js — русские числа и склонения.
function plural(n, forms) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
const fmtNum = (n) => Number(n).toLocaleString("ru-RU");
const withUnit = (n, forms) => `${fmtNum(n)} ${plural(n, forms)}`;
module.exports = { plural, fmtNum, withUnit };

},
"lib/search": function (module, exports, require) {
// lib/search.js — нормализация текста для поиска: регистр, ё→е, неразрывные пробелы.
const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/\u00a0/g, " ");
module.exports = { norm };

},
"lib/store": function (module, exports, require) {
// lib/store.js — крошечный реактивный стор: set(patch) уведомляет подписчиков об изменённых ключах.
function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      const changed = Object.keys(patch).filter((k) => state[k] !== patch[k]);
      if (!changed.length) return;
      state = { ...state, ...patch };
      for (const l of [...listeners]) if (!l.keys || changed.some((k) => l.keys.includes(k))) l.fn(state, changed);
    },
    subscribe(fn, keys) {
      const l = { fn, keys };
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
module.exports = { createStore };

},
"lib/text": function (module, exports, require) {
// lib/text.js — чистые функции для работы с markdown-текстом заметок.
function stripFrontmatter(raw) {
  return String(raw || "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

// Убирает то, что не должно попадать в превью: встраивания, комментарии, dataview-блоки.
function cleanForExcerpt(md) {
  return String(md || "")
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```(?:dataview|dataviewjs)[\s\S]*?```/g, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Обрезает markdown по границе абзаца/предложения/слова, не разрывая [[вики-ссылки]].
function truncateMarkdown(md, max) {
  const text = String(md || "");
  if (text.length <= max) return { text, truncated: false };
  let cut = text.lastIndexOf("\n\n", max);
  if (cut < max * 0.5) {
    const m = text.slice(0, max).match(/[\s\S]*[.!?…»)]\s/);
    cut = m ? m[0].length : -1;
  }
  if (cut < max * 0.5) cut = text.lastIndexOf(" ", max);
  if (cut <= 0) cut = max;
  let out = text.slice(0, cut);
  const open = out.lastIndexOf("[[");
  if (open > out.lastIndexOf("]]")) out = out.slice(0, open);
  if ((out.match(/```/g) || []).length % 2 === 1) out += "\n```";
  return { text: out.trimEnd() + "…", truncated: true };
}

// Markdown → простой текст для коротких превью (подборки, поиск).
function plainText(md) {
  return String(md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/\[\[([^\]#|]*)(?:#[^\]|]*)?\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/gm, "")
    .replace(/[*_~`=]{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
// Короткий фрагмент по границе слова.
function snippet(text, max) {
  const t = plainText(text);
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(" ", max);
  return t.slice(0, cut > max * 0.6 ? cut : max).trimEnd() + "…";
}

const wordCount = (md) => (String(md || "").match(/[\p{L}\p{N}'’-]+/gu) || []).length;
const readMinutes = (words, wpm = 180) => Math.max(1, Math.ceil(words / wpm));
const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const dqlEscape = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

module.exports = { plainText, snippet, stripFrontmatter, cleanForExcerpt, truncateMarkdown, wordCount, readMinutes, escapeRegExp, dqlEscape };

},
"model/analyzer": function (module, exports, require) {
// model/analyzer.js — чистый разбор тела заметки: медиа, цитаты, задачи, ссылки, слова.
const { kindOf } = require("model/media-kinds");
const { stripFrontmatter, cleanForExcerpt, wordCount, readMinutes } = require("lib/text");

const WIKI_EMBED = /!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;
const MD_EMBED = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const WIKI_LINK = /(?<!!)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const URL_RE = /https?:\/\/[^\s)>\]]+/g;

function collectQuotes(lines) {
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    if (/^\s*>/.test(line)) {
      const t = line.replace(/^\s*>\s?/, "");
      if (!cur) cur = [];
      cur.push(t);
    } else if (cur) { blocks.push(cur); cur = null; }
  }
  if (cur) blocks.push(cur);
  return blocks
    .map((b) => {
      let callout = null;
      if (/^\[!(\w+)\][+-]?\s*(.*)$/.test(b[0])) {
        const m = b[0].match(/^\[!(\w+)\][+-]?\s*(.*)$/);
        callout = { kind: m[1].toLowerCase(), title: m[2] };
        b = b.slice(1);
      }
      return { callout, text: b.join("\n").trim() };
    })
    .filter((q) => q.text && (!q.callout || ["quote", "cite"].includes(q.callout.kind)));
}

function analyze(rawOrBody) {
  const body = stripFrontmatter(rawOrBody);
  const media = [];
  let m;
  WIKI_EMBED.lastIndex = 0;
  while ((m = WIKI_EMBED.exec(body))) media.push({ kind: kindOf(m[1]), target: m[1].trim(), alt: m[2] || "", remote: false });
  MD_EMBED.lastIndex = 0;
  while ((m = MD_EMBED.exec(body))) {
    const target = decodeURI(m[2]);
    media.push({ kind: kindOf(target) || (/^https?:/.test(target) ? "image" : null), target, alt: m[1], remote: /^https?:/.test(target) });
  }
  const known = media.filter((x) => x.kind);

  const lines = body.split(/\r?\n/);
  const tasks = [];
  for (const l of lines) { const t = l.match(TASK); if (t) tasks.push({ done: t[1] !== " ", text: t[2] }); }

  const quotes = collectQuotes(lines);
  const text = cleanForExcerpt(body);
  const words = wordCount(text);
  const quoteChars = quotes.reduce((s, q) => s + q.text.length, 0);

  const links = [];
  WIKI_LINK.lastIndex = 0;
  while ((m = WIKI_LINK.exec(body))) links.push(m[1].trim());
  const external = [...new Set(body.replace(WIKI_EMBED, "").match(URL_RE) || [])];
  const heading = (body.match(/^#{1,3}\s+(.+)$/m) || [])[1] || "";

  return {
    body, text, words, readMin: readMinutes(words),
    media: known,
    byKind: (k) => known.filter((x) => x.kind === k),
    tasks: { total: tasks.length, done: tasks.filter((t) => t.done).length, items: tasks },
    quotes, quoteRatio: text.length ? quoteChars / text.length : 0,
    links, external, heading,
  };
}

module.exports = { analyze };

},
"model/media-kinds": function (module, exports, require) {
// model/media-kinds.js — определение типа медиа по расширению.
const EXT = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"],
  audio: ["mp3", "wav", "m4a", "ogg", "oga", "flac", "aac", "opus"],
  video: ["mp4", "mov", "mkv", "webm", "m4v", "ogv"],
  canvas: ["canvas"],
  pdf: ["pdf"],
};
const MAP = {};
for (const [kind, list] of Object.entries(EXT)) for (const e of list) MAP[e] = kind;

function extOf(path) {
  const m = String(path || "").split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}
const kindOf = (path) => MAP[extOf(path)] || null;
module.exports = { EXT, extOf, kindOf };

},
"model/post": function (module, exports, require) {
// model/post.js — нормализация страницы Dataview в «пост» ленты (без чтения тела заметки).
const { toMs, hasTime, fromFilename, plausible } = require("lib/date");
const { toArray, pageField } = require("lib/misc");
const { kindOf } = require("model/media-kinds");
const { norm } = require("lib/search");

const normTag = (t) => String(t || "").trim().replace(/^#+/, "").toLowerCase();

function matchSource(path, sources) {
  for (const s of sources || []) {
    if (s.enabled === false) continue;
    const f = String(s.folder || "").replace(/^\/+|\/+$/g, "");
    if (!f || path === f || path.startsWith(f + "/")) return s.id;
  }
  return null;
}

function createPost(page, config) {
  const F = page.file;
  const raw = pageField(page, config.dateFields);
  let ts = toMs(raw); if (!plausible(ts)) ts = null; let timed = ts != null && hasTime(raw, ts);
  if (ts == null) ts = fromFilename(F.name);
  if (!plausible(ts)) ts = null;
  // Время: из отдельного поля (time / время) или — если включено в настройках — из времени создания/изменения файла.
  if (ts != null && !timed) {
    const tf = pageField(page, ["time", "Time", "время", "Время"]);
    const tm = tf != null && String(tf).match(/(\d{1,2}):(\d{2})/);
    let hm = tm ? [+tm[1], +tm[2]] : null;
    if (!hm && (config.timeFallback === "ctime" || config.timeFallback === "mtime")) {
      const src = toMs(config.timeFallback === "ctime" ? F.ctime : F.mtime);
      if (src != null) { const d = new Date(src); hm = [d.getHours(), d.getMinutes()]; }
    }
    if (hm) { const d = new Date(ts); d.setHours(hm[0], hm[1], 0, 0); ts = d.getTime(); timed = true; }
  }
  if (ts == null) { const c = toMs(F.cday), c2 = toMs(F.ctime); ts = plausible(c) ? c : plausible(c2) ? c2 : 0; }

  const tags = [...new Set(toArray(F.tags).map(normTag).filter(Boolean))];
  const outPaths = toArray(F.outlinks).map((l) => String((l && l.path) || "")).filter(Boolean);
  const kinds = outPaths.map(kindOf).filter(Boolean);
  const mediaKinds = new Set(kinds);
  const mediaCounts = { image: 0, video: 0, audio: 0 };
  for (const k of kinds) if (k in mediaCounts) mediaCounts[k]++;
  const explicitTitle = page.title || page.Title;
  const type = String(pageField(page, ["type", "тип", "kind"]) || "").toLowerCase();

  const post = {
    id: F.path, path: F.path, name: F.name,
    title: String(explicitTitle || F.name),
    hasOwnTitle: !!explicitTitle || !/^\d{4}-\d{2}-\d{2}/.test(F.name),
    ts, hasTime: timed, tags,
    source: matchSource(F.path, config.sources),
    backlinks: toArray(F.inlinks).length,
    links: outPaths.length,
    size: F.size || 0,
    mtime: toMs(F.mtime) || 0,
    mediaKinds, mediaCounts,
    typeHint: type,
    favoriteMeta: pageField(page, [config.favoriteField]) === true || tags.some((t) => (config.favoriteTags || []).includes(t)),
    cover: pageField(page, ["cover", "image", "обложка"]) || null,
    tasksTotal: toArray(F.tasks).length,
    attrs: new Set(),
    search: norm(String(explicitTitle || "") + " " + F.name + " " + tags.join(" ")),
    feats: null, // заполняется после чтения тела (services/content)
  };
  refreshAttrs(post, config);
  return post;
}

// Пересчёт «атрибутов» (media/photo/audio/video/task/quote/link) — дешёвые признаки + признаки из тела.
function refreshAttrs(post, config) {
  const a = new Set();
  const mk = post.mediaKinds;
  if (mk.has("image")) { a.add("photo"); a.add("media"); }
  if (mk.has("video")) { a.add("video"); a.add("media"); }
  if (mk.has("audio")) { a.add("audio"); a.add("media"); }
  if (post.tasksTotal > 0) a.add("task");
  if (post.tags.some((t) => (config.quoteTags || []).includes(t))) a.add("quote");
  const f = post.feats;
  if (f) {
    for (const m of f.media) { a.add("media"); if (m.kind === "image") a.add("photo"); if (m.kind === "video") a.add("video"); if (m.kind === "audio") a.add("audio"); }
    if (f.tasks.total > 0) a.add("task");
    if (f.quotes.length) a.add("quote");
    if (f.external.length) a.add("link");
  }
  post.attrs = a;
}

function enrichPost(post, feats, config) {
  post.feats = feats;
  post.words = feats.words;
  post.searchBody = norm(feats.body); // весь текст заметки (без frontmatter), а не только превью
  refreshAttrs(post, config);
  return post;
}

module.exports = { createPost, enrichPost, refreshAttrs, normTag, matchSource };

},
"plugin/block-params": function (module, exports, require) {
// plugin/block-params.js — разбор параметров code-блока ```journal-stream (строки «ключ: значение») в input для app/main.mount.
// Пример:
//   ```journal-stream
//   view: stream
//   tags: мысли, daily
//   period: 30d
//   nav: false
//   ```
const BOOL = new Set(["true", "yes", "да", "on"]), NOBOOL = new Set(["false", "no", "нет", "off"]);
const val = (v) => { const s = String(v).trim(), l = s.toLowerCase(); return BOOL.has(l) ? true : NOBOOL.has(l) ? false : s; };
const list = (v) => String(v).split(/[,;]+/).map((t) => t.trim().replace(/^#/, "")).filter(Boolean);

const FLAT = ["view", "layout", "theme", "id"];
const BOOLS = ["nav", "fullWidth", "openInNewTab", "popupView"];
const ALIASES = { tags: "any", любой: "any", теги: "any", alltags: "all", все: "all", exclude: "not", not: "not", исключить: "not", search: "text", text: "text", поиск: "text", period: "period", период: "period", sort: "sort", сортировка: "sort", from: "dateFrom", to: "dateTo", day: "day" };
const VIEW_ALIAS = { обзор: "overview", лента: "stream", бенто: "bento", подборки: "collections", статистика: "stats", конструктор: "studio" };

function parseBlock(source) {
  const input = {}, filter = {}, errors = [];
  for (const raw of String(source || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (!m) { errors.push(`Не понял строку: «${line}»`); continue; }
    const key = m[1].trim(), k = key.toLowerCase(), v = m[2].trim();
    if (FLAT.includes(key)) input[key] = key === "view" ? (VIEW_ALIAS[v.toLowerCase()] || v) : v;
    else if (BOOLS.includes(key)) input[key] = val(v) === true;
    else if (k === "viewmode") input.viewMode = v;
    else if (ALIASES[k] === "any" || ALIASES[k] === "all" || ALIASES[k] === "not") filter[ALIASES[k]] = list(v).map((t) => t.toLowerCase());
    else if (ALIASES[k]) filter[ALIASES[k]] = v;
    else errors.push(`Неизвестный параметр: «${key}»`);
  }
  if (Object.keys(filter).length) input.filter = filter;
  return { input, errors };
}
module.exports = { parseBlock };

},
"plugin/code-block": function (module, exports, require) {
// plugin/code-block.js — встраивание ленты в заметку: ```journal-stream (параметры — в блоке, см. block-params.js).
const { MarkdownRenderChild } = require("obsidian");
const { mount } = require("app/main");
const { parseBlock } = require("plugin/block-params");

module.exports = function registerCodeBlock(plugin, core) {
  plugin.registerMarkdownCodeBlockProcessor("journal-stream", async (source, el, mdCtx) => {
    const { input, errors } = parseBlock(source);
    const child = new MarkdownRenderChild(el);
    mdCtx.addChild(child);
    el.classList.add("sf-codeblock");
    if (errors.length) el.createEl("div", { cls: "sf-block-warn", text: errors.join(" · ") });
    const host = el.createEl("div");
    try {
      const inst = await mount(core, { container: host, input: { id: "block", ...input }, sourcePath: mdCtx.sourcePath, component: child });
      child.onunload = () => inst.destroy();
    } catch (e) {
      console.error("[journal-stream]", e);
      host.createEl("pre", { text: "[journal-stream] ошибка запуска:\n" + (e && e.stack ? e.stack : e) });
    }
  });
};

},
"plugin/commands": function (module, exports, require) {
// plugin/commands.js — ribbon-иконка и команды палитры.
const { Notice } = require("obsidian");
const { VIEW_TYPE } = require("plugin/view");

const SECTIONS = [["overview", "Обзор"], ["stream", "Лента"], ["bento", "Бенто"], ["collections", "Подборки"], ["studio", "Конструктор"]];
const BLOCK = "```journal-stream\nview: stream\n```\n";

module.exports = function registerCommands(plugin, core) {
  async function open(view) {
    const ws = plugin.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (leaf) { if (view && leaf.view && leaf.view.goTo) leaf.view.goTo(view); }
    else { leaf = ws.getLeaf(true); await leaf.setViewState({ type: VIEW_TYPE, active: true, state: view ? { view } : {} }); }
    ws.revealLeaf(leaf);
  }
  plugin.openFeed = open;
  plugin.addRibbonIcon("layout-grid", "Journal Stream", () => open());
  plugin.addCommand({ id: "open", name: "Открыть ленту", callback: () => open() });
  for (const [id, label] of SECTIONS) plugin.addCommand({ id: "open-" + id, name: "Открыть раздел: " + label, callback: () => open(id) });
  plugin.addCommand({ id: "new-note", name: "Новая заметка (по правилам Journal Stream)", callback: () => plugin.createNote() });
  plugin.addCommand({ id: "insert-block", name: "Вставить блок journal-stream в заметку", editorCallback: (editor) => editor.replaceSelection(BLOCK) });
  plugin.addCommand({ id: "refresh", name: "Перечитать хранилище", callback: () => { for (const i of core.instances) { i.markDirty(); i.ctx.reload && i.ctx.reload(); } new Notice("Journal Stream: список заметок обновлён"); } });
};

},
"plugin/index": function (module, exports, require) {
// plugin/index.js — точка сборки плагина: общее ядро, вид-вкладка, code-block, настройки, команды, обновление при изменениях vault.
const { createCore } = require("app/main");
const { JournalStreamView, VIEW_TYPE } = require("plugin/view");
const { JournalStreamSettingTab } = require("plugin/settings-tab");
const registerCodeBlock = require("plugin/code-block");
const registerCommands = require("plugin/commands");
const { debounce } = require("lib/async");

async function setup(plugin) {
  const core = await createCore(plugin);
  plugin.core = core;

  // Изменения в настройках применяем «мягко»: перерисовываем открытые вкладки (code-block'и обновятся при следующем рендере заметки).
  const remount = debounce(async (hard) => {
    await require("services/css-loader")(core.storage);
    if (hard) window.__sfSession = {};
    for (const leaf of plugin.app.workspace.getLeavesOfType(VIEW_TYPE)) if (leaf.view && leaf.view.remount) await leaf.view.remount();
    if (hard) { window.__sfSession = {}; for (const i of [...core.instances]) i.markDirty(); }
  }, 600);
  plugin.scheduleRemount = (hard) => remount(hard);

  // Создание заметки без открытой ленты (команда палитры): минимальный контекст поверх общих настроек
  plugin.createNote = async () => {
    const { Notice } = require("obsidian");
    try {
      const ctx = { app: plugin.app, config: core.db.data.settings, store: { get: () => ({}) }, openNote: (p) => plugin.app.workspace.openLinkText(p, "", false) };
      await require("services/new-note")(ctx)();
    } catch (e) { console.error("[journal-stream] новая заметка", e); new Notice("Journal Stream: не удалось создать заметку — " + (e && e.message ? e.message : e)); }
  };
  plugin.registerView(VIEW_TYPE, (leaf) => new JournalStreamView(leaf, core));
  registerCodeBlock(plugin, core);
  registerCommands(plugin, core);
  plugin.addSettingTab(new JournalStreamSettingTab(plugin.app, plugin, core));

  // Заметки изменились/появились/удалены: помечаем списки устаревшими — следующий рендер/«Перечитать» подхватит.
  const dirty = debounce(() => { for (const i of core.instances) i.markDirty(); }, 1500);
  plugin.registerEvent(plugin.app.metadataCache.on("resolved", dirty));
  plugin.registerEvent(plugin.app.vault.on("create", dirty));
  plugin.registerEvent(plugin.app.vault.on("delete", dirty));
  plugin.registerEvent(plugin.app.vault.on("rename", dirty));
}

function teardown(plugin) {
  const core = plugin.core;
  if (!core) return;
  for (const i of [...core.instances]) i.destroy();
  core.db.flush();
  const st = document.getElementById(require("services/css-loader").STYLE_ID);
  if (st) st.remove();
}
module.exports = { setup, teardown };

},
"plugin/settings-tab": function (module, exports, require) {
// plugin/settings-tab.js — вкладка «Journal Stream» в настройках Obsidian. Правит тот же data.json, что и интерфейс ленты.
const { PluginSettingTab, Setting, Notice } = require("obsidian");

const csv = (a) => (a || []).join(", ");
const parseCsv = (s) => String(s || "").split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
const slug = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "src";

const exampleText = (nn) => { const { newNotePath, fmtTokens, DEFAULT_DATE_RULE } = require("lib/new-note-path"), d = new Date(); return `${newNotePath(nn, d)}.md · date: ${fmtTokens(nn.dateRule || DEFAULT_DATE_RULE, d, nn.dateLang || "ru")}`; };

class JournalStreamSettingTab extends PluginSettingTab {
  constructor(app, plugin, core) { super(app, plugin); this.plugin = plugin; this.core = core; }

  display() {
    const { containerEl: el } = this, db = this.core.db, s = db.data.settings;
    el.empty();
    const changed = () => { db.save(); this.plugin.scheduleRemount(); if (this.example) this.example.setDesc(exampleText(s.newNote)); };
    const text = (name, desc, get, set, opts = {}) => new Setting(el).setName(name).setDesc(desc).addText((t) => { t.setPlaceholder(opts.placeholder || "").setValue(get()).onChange((v) => { set(v); changed(); }); });
    const area = (name, desc, get, set, placeholder) => new Setting(el).setName(name).setDesc(desc).addTextArea((t) => { t.setPlaceholder(placeholder || "").setValue(get()).onChange((v) => { set(v); changed(); }); t.inputEl.rows = 3; });
    const toggle = (name, desc, key) => new Setting(el).setName(name).setDesc(desc).addToggle((t) => t.setValue(!!s[key]).onChange((v) => { s[key] = v; changed(); }));
    const drop = (name, desc, key, options) => new Setting(el).setName(name).setDesc(desc).addDropdown((d) => { for (const [v, l] of options) d.addOption(v, l); d.setValue(String(s[key])).onChange((v) => { s[key] = v; changed(); }); });
    const drop2 = (name, desc, get, set, options, redraw) => new Setting(el).setName(name).setDesc(desc).addDropdown((d) => { for (const [v, l] of options) d.addOption(v, l); d.setValue(get()).onChange((v) => { set(v); changed(); if (redraw) this.display(); }); });
    const num = (name, desc, get, set, min, max) => text(name, desc, () => String(get()), (v) => { const n = Number(v); if (isFinite(n) && n >= min && n <= max) set(n); });

    el.createEl("h2", { text: "Источники заметок" });
    area("Папки с заметками", "По одной в строке. Пусто — весь vault. Несколько папок → в карточках можно показывать бейдж источника.",
      () => (s.sources || []).filter((x) => x.folder).map((x) => x.folder).join("\n"),
      (v) => { const folders = v.split("\n").map((x) => x.trim().replace(/^\/+|\/+$/g, "")).filter(Boolean); const old = s.sources || [];
        s.sources = folders.length ? folders.map((f) => { const o = old.find((x) => x.folder === f); return o || { id: slug(f.split("/").pop()), label: f.split("/").pop(), folder: f, enabled: true }; }) : [{ id: "all", label: "Vault", folder: "", enabled: true }]; }, "notes");
    area("Исключить папки", "По одной в строке: заметки из них не попадут в ленту.", () => (s.excludeFolders || []).join("\n"), (v) => { s.excludeFolders = v.split("\n").map((x) => x.trim()).filter(Boolean); }, "templates");
    text("Исключить теги", "Через запятую, без #.", () => csv(s.excludeTags), (v) => { s.excludeTags = parseCsv(v).map((t) => t.replace(/^#/, "").toLowerCase()); });
    text("Поля даты", "Поля frontmatter, откуда брать дату записи (по порядку). Если их нет — дата из имени файла (2024-10-01) или дата создания.", () => csv(s.dateFields), (v) => { const l = parseCsv(v); if (l.length) s.dateFields = l; });
    drop("Время, если его нет в дате", "Откуда брать время записи, если в дате его нет.", "timeFallback", [["none", "Не показывать"], ["ctime", "Время создания файла"], ["mtime", "Время изменения файла"]]);
    text("Теги избранного", "Через запятую.", () => csv(s.favoriteTags), (v) => { s.favoriteTags = parseCsv(v).map((t) => t.replace(/^#/, "").toLowerCase()); });
    text("Теги цитат", "Через запятую.", () => csv(s.quoteTags), (v) => { s.quoteTags = parseCsv(v).map((t) => t.replace(/^#/, "").toLowerCase()); });

    el.createEl("h2", { text: "Новая заметка" });
    const nn = s.newNote;
    drop2("Куда складывать", "Корень vault, одна папка или правило с датой.", () => nn.mode, (v) => { nn.mode = v; }, [["root", "В корень vault"], ["folder", "В папку"], ["rule", "По правилу"]], true);
    text("Папка", "Для режима «В папку» и для %%FOLDER_NAME в правиле. Например: notes", () => nn.folder, (v) => { nn.folder = v.trim().replace(/^\/+|\/+$/g, ""); });
    text("Правило", "Папки и имя файла одной строкой. %%FOLDER_NAME — папка из поля выше; YYYY год, MM месяц числом, MMMM месяц словом, DD день, hh часы, mm минуты.", () => nn.rule, (v) => { nn.rule = v.trim(); }, { placeholder: "%%FOLDER_NAME/YYYY/YYYY-MM-MMMM/YYYY-MM-DD-hh-mm" });
    drop2("Месяц в названиях папок", "Язык токена MMMM в пути: English → 2026-10-October, Русский → 2026-10-Октябрь.", () => nn.folderLang || "en", (v) => { nn.folderLang = v; }, [["en", "English (October)"], ["ru", "Русский (Октябрь)"]]);
    text("Имя файла", "Для режимов «В корень» и «В папку».", () => nn.fileName, (v) => { nn.fileName = v.trim() || "YYYY-MM-DD-hh-mm"; });
    text("Дата в заметке", "Как записать дату во frontmatter (поле из «Полей даты»). Токены: YYYY, MM, MMMM (месяц словом; после «D » — «октября»), DD и D (день), hh, mm. По умолчанию: D MMMM YYYY, hh:mm", () => nn.dateRule, (v) => { nn.dateRule = v.trim() || "D MMMM YYYY, hh:mm"; }, { placeholder: "D MMMM YYYY, hh:mm" });
    drop2("Месяц в дате заметки", "Язык токена MMMM в дате: Русский → 16 октября 2026, English → 16 October 2026.", () => nn.dateLang || "ru", (v) => { nn.dateLang = v; }, [["ru", "Русский (октября)"], ["en", "English (October)"]]);
    this.example = new Setting(el).setName("Пример").setDesc(exampleText(nn));
    new Setting(el).setName("Открывать после создания").addToggle((t) => t.setValue(nn.open !== false).onChange((v) => { nn.open = v; changed(); }));

    el.createEl("h2", { text: "Вид" });
    drop("Раздел по умолчанию", "С какого экрана открывается лента.", "defaultView", [["overview", "Обзор"], ["stream", "Лента"], ["bento", "Бенто"], ["collections", "Подборки"], ["studio", "Конструктор"]]);
    drop("Тема", "«Как в Obsidian» — следовать теме приложения.", "theme", [["auto", "Как в Obsidian"], ["light", "Светлая"], ["dark", "Тёмная"]]);
    toggle("На всю ширину", "Растянуть ленту на всю ширину заметки/вкладки.", "fullWidth");
    drop("Скрывать боковую панель", "При открытии вкладки с лентой (не код-блока) сворачивать боковые панели Obsidian — больше места для карточек.", "hideSidebar", [["none", "Не скрывать"], ["left", "Левую"], ["right", "Правую"], ["both", "Обе"]]);
    toggle("Возвращать панель при закрытии", "Раскрыть скрытые панели обратно, когда вкладка с лентой закрыта.", "restoreSidebar");
    toggle("Открывать заметки в плавающем окне", "Клик по карточке показывает заметку в окне просмотра (не в редакторе); на карточках скрыты ссылки вперёд/назад (бэклинки). Ctrl/Cmd+клик — открыть в редакторе. Кнопка-глаз в шапке ленты переключает режим на лету.", "popupView");
    toggle("Открывать заметки в новой вкладке", "Иначе — в текущей (Ctrl/Cmd+клик всегда в новой).", "openInNewTab");
    num("Колонок минимум", "На десктопе (1–6).", () => s.columns.min, (n) => { s.columns.min = n; if (s.columns.max < n) s.columns.max = n; }, 1, 6);
    num("Колонок максимум", "На десктопе (1–8).", () => s.columns.max, (n) => { s.columns.max = Math.max(n, s.columns.min); }, 1, 8);
    num("Минимальная ширина карточки, px", "По ней считается, сколько колонок помещается (200–800).", () => s.minCardWidth, (n) => { s.minCardWidth = n; }, 200, 800);
    num("Мобильный вид уже, px", "Ниже этой ширины блока лента — в один столбец с мобильным интерфейсом.", () => s.singleColumnBelow, (n) => { s.singleColumnBelow = n; }, 300, 1200);
    num("Карточек за раз (десктоп)", "Размер «страницы» ленты.", () => s.pageSize, (n) => { s.pageSize = n; }, 6, 200);
    num("Карточек за раз (телефон)", "", () => s.pageSizeMobile, (n) => { s.pageSizeMobile = n; }, 4, 100);
    toggle("Бейдж источника на карточках", "Имеет смысл при нескольких папках.", "showSourceBadge");

    el.createEl("h2", { text: "Поиск и диагностика" });
    toggle("Фоновая индексация текстов", "После открытия ленты читает тела заметок в фоне — поиск находит и по тексту, не только по заголовкам.", "autoIndex");
    toggle("Подробный лог (debug)", "Пишет в консоль (Ctrl+Shift+I) ход восстановления прокрутки.", "debug");

    el.createEl("h2", { text: "Данные" });
    new Setting(el).setName("Сбросить всё").setDesc("Настройки, подборки, избранное и предпочтения интерфейса вернутся к значениям по умолчанию. Файл data.json в папке плагина можно также просто удалить.")
      .addButton((b) => b.setButtonText("Сбросить").setWarning().onClick(async () => {
        if (!b.__armed) { b.__armed = true; b.setButtonText("Точно сбросить?"); setTimeout(() => { b.__armed = false; b.setButtonText("Сбросить"); }, 4000); return; }
        await this.core.db.reset(); new Notice("Journal Stream: данные сброшены"); this.plugin.scheduleRemount(true); this.display();
      }));
  }
}
module.exports = { JournalStreamSettingTab };

},
"plugin/sidebar": function (module, exports, require) {
// plugin/sidebar.js — скрытие боковых панелей Obsidian при открытии ленты (опция hideSidebar: none | left | right | both).
// Возвращает функцию, которая раскрывает обратно ровно те панели, что были раскрыты до нас.
function hideSidebars(app, mode) {
  const ws = app.workspace, targets = [];
  if (mode === "left" || mode === "both") targets.push(ws.leftSplit);
  if (mode === "right" || mode === "both") targets.push(ws.rightSplit);
  const hidden = [];
  for (const sp of targets) if (sp && !sp.collapsed && typeof sp.collapse === "function") { sp.collapse(); hidden.push(sp); }
  return () => { for (const sp of hidden) if (sp.collapsed && typeof sp.expand === "function") sp.expand(); };
}
module.exports = { hideSidebars };

},
"plugin/view": function (module, exports, require) {
// plugin/view.js — отдельная вкладка Obsidian с лентой (ItemView). Сохраняет состояние и прокрутку между открытиями заметок.
const { ItemView } = require("obsidian");
const { mount } = require("app/main");
const { hideSidebars } = require("plugin/sidebar");

const VIEW_TYPE = "journal-stream-view";
let counter = 0;

class JournalStreamView extends ItemView {
  constructor(leaf, core) {
    super(leaf);
    this.core = core;
    this.input = {};
    this.uid = "tab-" + (leaf && leaf.id ? leaf.id : ++counter);
    this.inst = null;
    this.mounting = null;
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Journal Stream"; }
  getIcon() { return "layout-grid"; }

  async onOpen() { await this.ensure(); }
  async onClose() { this.unmount(); }

  getState() { return { view: this.inst ? this.inst.ctx.store.get().view : this.input.view }; }
  async setState(state, result) {
    if (state && state.view) {
      if (this.inst) this.inst.ctx.actions.enterView(state.view);
      else this.input.view = state.view;
    }
    if (super.setState) await super.setState(state, result);
  }

  // Открыть нужный раздел (команды плагина)
  goTo(view) { if (this.inst) this.inst.ctx.actions.enterView(view); else this.input.view = view; }

  ensure() {
    if (this.inst || this.mounting) return this.mounting;
    const container = this.contentEl;
    container.empty && container.empty();
    container.classList.add("sf-view-host");
    this.mounting = mount(this.core, { container, input: { ...this.input, id: this.uid }, sourcePath: "", component: this })
      .then((inst) => { this.inst = inst; this.hideSidebar(); })
      .catch((e) => { console.error("[journal-stream]", e); container.createEl("pre", { text: "[journal-stream] ошибка запуска:\n" + (e && e.stack ? e.stack : e) }); })
      .finally(() => { this.mounting = null; });
    return this.mounting;
  }
  // Опция «Скрывать боковую панель при открытии ленты»: прячем панели, при закрытии вкладки (если включено) — возвращаем.
  hideSidebar() {
    const s = this.core.db.data.settings;
    if (!s.hideSidebar || s.hideSidebar === "none" || this.restoreSidebar) return;
    const restore = hideSidebars(this.core.app, s.hideSidebar);
    this.restoreSidebar = s.restoreSidebar === false ? () => {} : restore;
  }
  unmount() {
    if (this.restoreSidebar) { try { this.restoreSidebar(); } catch (e) {} this.restoreSidebar = null; }
    if (this.inst) { this.input.view = this.inst.ctx.store.get().view; this.inst.destroy(); this.inst = null; }
    this.contentEl.empty && this.contentEl.empty();
  }
  async remount() { this.unmount(); await this.ensure(); }
}
module.exports = { JournalStreamView, VIEW_TYPE };

},
"services/changelog": function (module, exports, require) {
// services/changelog.js — окно «История версий»: берёт раздел «## История версий» из README плагина и рисует его через MarkdownRenderer.
const { Modal } = require("obsidian");

function section(readme) {
  const m = readme.match(/^## История версий[^\n]*\n([\s\S]*?)(?=^## |\s*$(?![\s\S]))/m);
  return m ? m[1].trim() : "";
}

module.exports = function createChangelog({ app, storage, md, component }) {
  return async function open() {
    const text = section(await storage.readText("README.md")) || "История версий не найдена: проверьте README.md в папке плагина.";
    const modal = new Modal(app);
    modal.titleEl.setText("Journal Stream — история версий");
    modal.modalEl.classList.add("sf-changelog");
    await md.render(text, modal.contentEl, "");
    modal.open();
  };
};
module.exports.section = section;

},
"services/config": function (module, exports, require) {
// services/config.js — настройки: значения по умолчанию + data/config.json (если файла нет — создаётся).

const DEFAULTS = {
  // Источники заметок. folder "" = весь vault (кроме excludeFolders). Можно добавить несколько источников,
  // например { id: "lj", label: "LiveJournal", folder: "notes/LiveJournal" } — тогда в карточках появятся бейджи источников.
  sources: [{ id: "notes", label: "Заметки", folder: "notes", enabled: true }],
  excludeFolders: ["scripts", ".obsidian", "templates"],
  excludeTags: [],
  dateFields: ["date", "Date", "created", "Created", "дата", "Дата", "datetime", "Дата и время", "published"],
  timeFallback: "none",       // none | ctime | mtime — откуда брать время, если в дате заметки его нет
  openInNewTab: false,        // открывать заметку по клику на карточку в новой вкладке (Ctrl/Cmd+клик — всегда в новой)
  favoriteField: "favorite",
  favoriteTags: ["избранное", "favorite"],
  quoteTags: ["цитата", "цитаты", "quote", "quotes"],
  // Кнопка «Новая заметка»: куда складывать. mode: root — в корень vault; folder — в папку `folder`; rule — по правилу `rule`
  // (папки и имя файла одной строкой; %%FOLDER_NAME — это `folder`; токены: YYYY, MM, MMMM (месяц словом), DD, D, hh, mm).
  // dateRule — как записать дату в frontmatter новой заметки (по умолчанию «16 октября 2026, 18:14»).
  newNote: { mode: "folder", folder: "notes", rule: "%%FOLDER_NAME/YYYY/YYYY-MM-MMMM/YYYY-MM-DD-hh-mm", fileName: "YYYY-MM-DD-hh-mm", dateRule: "D MMMM YYYY, hh:mm", folderLang: "en", dateLang: "ru", open: true },
  hideSidebar: "none",       // none | left | right | both — скрывать боковые панели Obsidian при открытии вкладки с лентой
  restoreSidebar: true,       // возвращать скрытые панели при закрытии вкладки с лентой
  popupView: false,           // true: клик по карточке открывает заметку в плавающем окне просмотра (не в редакторе); Ctrl/Cmd+клик — в редакторе
  theme: "auto",              // auto | dark | light
  fullWidth: true,            // true: растянуть блок и заметку на всю ширину окна (можно переключать кнопкой в навигации)
  nav: true,                  // верхняя навигация между экранами
  defaultView: "stream",      // overview | stream | bento | collections | studio
  layout: "masonry",          // masonry | flow | timeline (для вида stream)
  columns: { min: 2, max: 4 }, // колонки карточек на десктопе (masonry и бенто); на телефоне всегда 1
  minCardWidth: 320,          // минимальная ширина карточки в px — по ней считается, сколько колонок помещается
  pageSize: 24,
  pageSizeMobile: 12,         // сколько карточек за раз на телефоне (одна колонка)
  singleColumnBelow: 560,     // ширина блока (px), ниже которой лента — в один столбец и включается мобильный интерфейс
  excerptChars: 420,
  randomCount: 12,
  insightsCount: 3,           // сколько карточек в «Случайных озарениях» по умолчанию (переключатель на обзоре запоминается)
  insightsOptions: [3, 6, 9, 12],
  topTags: 24,
  concurrency: 8,             // параллельное чтение заметок
  debug: false,               // true: подробный лог восстановления прокрутки в консоль (Ctrl+Shift+I)
  autoIndex: true,            // после открытия ленты в фоне индексировать тексты заметок — поиск находит и по тексту, не только по заголовкам
  deepScan: false,            // true: прочитать тела всех заметок (точные «Цитаты/Ссылки» в фильтре, но медленнее)
  showSourceBadge: false,   // бейдж источника на карточке (имеет смысл при нескольких источниках)
  dql: { dateExpr: "file.cday" },
};

module.exports = { DEFAULTS };

},
"services/content": function (module, exports, require) {
// services/content.js — ленивое чтение тела заметок с кэшем по mtime.
const { analyze } = require("model/analyzer");
const { enrichPost } = require("model/post");
const types = require("types");
const { mapPool } = require("lib/async");

module.exports = function createContent({ app, config }) {
  const cache = new Map(); // path -> { mtime, feats }

  async function load(post) {
    const file = app.vault.getAbstractFileByPath(post.path);
    if (!file) return null;
    const mtime = file.stat ? file.stat.mtime : 0;
    let hit = cache.get(post.path);
    if (!hit || hit.mtime !== mtime) {
      const raw = await app.vault.cachedRead(file);
      hit = { mtime, feats: analyze(raw) };
      cache.set(post.path, hit);
    }
    if (post.feats !== hit.feats) {
      enrichPost(post, hit.feats, config);
      post.type = types.resolve(post, hit.feats).id;
    }
    return hit.feats;
  }
  // Одна нечитаемая заметка не должна прерывать индексацию остальных.
  const preload = (posts, onProgress) => mapPool(posts, config.concurrency || 8, async (p, i) => {
    try { await load(p); } catch (e) { console.warn("[journal-stream] не удалось прочитать", p.path, e); }
    if (onProgress) onProgress(i + 1, posts.length);
  });
  return { load, preload, clear: () => cache.clear() };
};

},
"services/css-loader": function (module, exports, require) {
// services/css-loader.js — подключает все css/*.css плагина (по порядку имён) одним <style> в документ.
// Свои правки — в css/90-custom.css (он подключается последним). Повторный вызов обновляет содержимое.
const ID = "journal-stream-style";
module.exports = async function loadCss(storage) {
  const files = (await storage.listFiles("css")).filter((f) => f.endsWith(".css")).sort((a, b) => a.split("/").pop().localeCompare(b.split("/").pop()));
  const parts = [];
  for (const f of files) parts.push(`/* ${f.split("/").pop()} */\n` + (await storage.readText("css/" + f.split("/").pop())));
  let el = document.getElementById(ID);
  if (!el) { el = document.createElement("style"); el.id = ID; document.head.appendChild(el); }
  el.textContent = parts.join("\n\n");
  return files.length;
};
module.exports.STYLE_ID = ID;

},
"services/db": function (module, exports, require) {
// services/db.js — ЕДИНЫЙ файл данных плагина (data.json): настройки, подборки, избранное/закрепы, UI-предпочтения.
// Удалите data.json (или нажмите «Сбросить» в настройках плагина) — при следующем запуске всё пересоздастся по умолчанию.
// База одна на плагин: её делят все открытые виды (вкладка и code-block'и), а также вкладка настроек.
const { deepMerge } = require("lib/misc");
const { debounce } = require("lib/async");

module.exports = async function createDb(storage, defaults) {
  const raw = await storage.load();
  const fresh = !raw;
  const src = raw || {};
  const data = {
    version: 3,
    appVersion: src.appVersion,
    settings: deepMerge(defaults.settings, src.settings || {}),
    ui: src.ui || {},
    presets: Array.isArray(src.presets) ? src.presets : defaults.presets,
    flags: src.flags || {},
  };
  const save = debounce(() => storage.save(data), 400);
  if (fresh) await storage.save(data);
  // Сброс: всё возвращается к значениям по умолчанию, объект data остаётся тем же (на него ссылаются открытые виды).
  async function reset() {
    data.settings = deepMerge(defaults.settings, {});
    data.ui = {}; data.flags = {}; data.presets = JSON.parse(JSON.stringify(defaults.presets));
    data.appVersion = undefined;
    await storage.save(data);
  }
  return { data, save, flush: () => save.flush(), reset, fresh };
};

},
"services/flags": function (module, exports, require) {
// services/flags.js — избранное и закрепы (хранятся в едином файле данных; файлы заметок не изменяются).
module.exports = function createFlags({ db }) {
  const data = db.data.flags;
  const get = (p) => data[p.path] || {};
  function toggle(p, key) {
    const cur = { ...get(p) };
    if (cur[key]) delete cur[key]; else cur[key] = true;
    if (Object.keys(cur).length) data[p.path] = cur; else delete data[p.path];
    db.save();
    return !!cur[key];
  }
  return {
    isFavorite: (p) => !!get(p).favorite || p.favoriteMeta,
    isPinned: (p) => !!get(p).pinned,
    toggleFavorite: (p) => toggle(p, "favorite"),
    togglePin: (p) => toggle(p, "pinned"),
  };
};

},
"services/indexer": function (module, exports, require) {
// services/indexer.js — фоновая индексация текстов заметок для поиска (один раз за сеанс, прогресс доступен подписчикам).
// Пока индекс не готов, поиск работает по заголовкам и тегам; по завершении результаты пересчитываются автоматически.
module.exports = function createIndexer(ctx) {
  let state = { running: false, done: false, i: 0, n: 0 };
  const subs = new Set();
  const emit = () => subs.forEach((cb) => cb({ ...state }));
  return {
    status: () => ({ ...state }),
    onChange(cb) { subs.add(cb); return () => subs.delete(cb); },
    reset() { state = { running: false, done: false, i: 0, n: 0 }; emit(); },
    async ensure(posts) {
      if (state.running || state.done) return;
      state = { running: true, done: false, i: 0, n: posts.length }; emit();
      await ctx.content.preload(posts, (i, n) => { state.i = i; if (i % 20 === 0 || i === n) emit(); });
      state = { running: false, done: true, i: posts.length, n: posts.length }; emit();
      ctx.actions.setFilter({}); // пересчитать ленту уже с поиском по тексту
    },
  };
};

},
"services/md": function (module, exports, require) {
// services/md.js — рендер markdown внутрь элемента через MarkdownRenderer Obsidian (с запасным вариантом — простой текст).
const { MarkdownRenderer } = require("obsidian");

module.exports = function createMarkdown({ app, component }) {
  async function render(md, el, path) {
    try {
      if (typeof MarkdownRenderer.render === "function") await MarkdownRenderer.render(app, md, el, path || "", component);
      else await MarkdownRenderer.renderMarkdown(md, el, path || "", component);
    } catch (e) {
      console.warn("[journal-stream] markdown fallback", e);
      el.textContent = md;
    }
  }
  return { render };
};

},
"services/media": function (module, exports, require) {
// services/media.js — ссылка на медиафайл → URL ресурса Obsidian.
module.exports = function createMedia(app) {
  return {
    resolveFile(target, sourcePath) {
      return app.metadataCache.getFirstLinkpathDest(decodeURIComponent(target), sourcePath);
    },
    resolve(target, sourcePath) {
      if (/^https?:\/\//i.test(target)) return target;
      const f = app.metadataCache.getFirstLinkpathDest(decodeURIComponent(target), sourcePath);
      return f ? app.vault.getResourcePath(f) : null;
    },
  };
};

},
"services/new-note": function (module, exports, require) {
// services/new-note.js — создание новой заметки по настройке `newNote` и открытие её.
const { newNotePath } = require("lib/new-note-path");
const { fmtTokens, DEFAULT_DATE_RULE } = require("lib/new-note-path");

module.exports = function createNewNote(ctx) {
  const { app, config } = ctx;
  async function ensureFolders(path) {
    const parts = path.split("/").slice(0, -1);
    let cur = "";
    for (const p of parts) {
      cur = cur ? cur + "/" + p : p;
      if (!app.vault.getAbstractFileByPath(cur)) { try { await app.vault.createFolder(cur); } catch (e) { if (!app.vault.getAbstractFileByPath(cur)) throw e; } }
    }
  }
  return async function create() {
    const now = new Date(), base = newNotePath(config.newNote, now);
    let path = base + ".md", i = 1;
    while (app.vault.getAbstractFileByPath(path)) path = `${base}-${++i}.md`;
    await ensureFolders(path);
    const field = (config.dateFields && config.dateFields[0]) || "date";
    const file = await app.vault.create(path, `---\n${field}: "${fmtTokens((config.newNote && config.newNote.dateRule) || DEFAULT_DATE_RULE, now, (config.newNote && config.newNote.dateLang) || "ru")}"\n---\n\n`);
    if (ctx.repo) ctx.repo.markDirty();
    if (!config.newNote || config.newNote.open !== false) ctx.openNote(file.path || path);
    return file;
  };
};

},
"services/notes": function (module, exports, require) {
// services/notes.js — чтение заметок через metadataCache Obsidian (без Dataview) и приведение к «странице» для model/post.
// Страница: { file: { path, name, tags, inlinks, outlinks, tasks, size, ctime, mtime, cday }, ...frontmatter, title }.
// Всё берётся из кэша метаданных — тела заметок здесь не читаются.
const normFmTags = (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,\s]+/) : []).map((t) => String(t).trim()).filter(Boolean);

function backlinkMap(app) {
  const res = (app.metadataCache && app.metadataCache.resolvedLinks) || {};
  const back = new Map();
  for (const from of Object.keys(res)) for (const to of Object.keys(res[from] || {})) {
    if (to === from) continue;
    let a = back.get(to); if (!a) back.set(to, (a = [])); a.push(from);
  }
  return back;
}

function toPage(app, file, back) {
  const cache = (app.metadataCache.getFileCache && app.metadataCache.getFileCache(file)) || {};
  const fm = cache.frontmatter || {};
  const res = (app.metadataCache.resolvedLinks && app.metadataCache.resolvedLinks[file.path]) || {};
  const tags = [...(cache.tags || []).map((t) => t.tag), ...normFmTags(fm.tags), ...normFmTags(fm.tag)];
  const tasks = (cache.listItems || []).filter((li) => li.task !== undefined && li.task !== null);
  const st = file.stat || {};
  const cday = st.ctime ? new Date(new Date(st.ctime).setHours(0, 0, 0, 0)).getTime() : 0;
  const page = {
    ...fm,
    file: {
      path: file.path, name: file.basename || file.name.replace(/\.md$/, ""), tags,
      outlinks: Object.keys(res).map((p) => ({ path: p })),
      inlinks: (back.get(file.path) || []).map((p) => ({ path: p })),
      tasks, size: st.size || 0, ctime: st.ctime || 0, mtime: st.mtime || 0, cday,
    },
  };
  return page;
}

module.exports = { toPage, backlinkMap };

},
"services/posts": function (module, exports, require) {
// services/posts.js — репозиторий постов: заметки vault (metadataCache) → нормализованные посты (тела не читаются).
const { createPost } = require("model/post");
const { toPage, backlinkMap } = require("services/notes");
const types = require("types");

module.exports = function createPostsRepo({ app, config }) {
  let cache = null;

  const folderOf = (s) => String(s.folder || "").replace(/^\/+|\/+$/g, "");
  function inSources(path) {
    const act = (config.sources || []).filter((s) => s.enabled !== false);
    if (!act.length) return true;
    return act.some((s) => { const f = folderOf(s); return !f || path === f || path.startsWith(f + "/"); });
  }
  const excluded = (path) => (config.excludeFolders || []).some((f) => { f = String(f).replace(/^\/+|\/+$/g, ""); return f && (path === f || path.startsWith(f + "/")); });

  function collect(force = false) {
    if (cache && !force) return cache;
    const back = backlinkMap(app);
    const posts = [];
    for (const file of app.vault.getMarkdownFiles()) {
      if (!inSources(file.path) || excluded(file.path)) continue;
      const post = createPost(toPage(app, file, back), config);
      if ((config.excludeTags || []).some((t) => post.tags.includes(t))) continue;
      post.type = types.resolve(post, null).id;
      posts.push(post);
    }
    cache = posts;
    return posts;
  }
  return { collect, refresh: () => collect(true), markDirty: () => { cache = null; } };
};

},
"services/presets": function (module, exports, require) {
// services/presets.js — смарт-подборки в data/presets.json.
const { uid } = require("lib/misc");

const DEFAULT_PRESETS = [
  { id: "atomic", name: "Атомарные озарения недели", icon: "bolt", description: "Записи с высокой плотностью связей за последние 7 дней", quick: "all", filter: { any: ["мысли", "zettel"], minBacklinks: 3, period: "7d" } },
  { id: "voice", name: "Голосовые черновики", icon: "mic", description: "Аудио-заметки без обработки", quick: "all", filter: { attrs: ["audio"], not: ["архив"] } },
  { id: "video", name: "Видео-конспекты", icon: "video", description: "Заметки с видео", quick: "all", filter: { attrs: ["video"] } },
  { id: "quotes", name: "Цитаты", icon: "quote", description: "Выписки и цитаты", quick: "all", filter: { attrs: ["quote"] } },
  { id: "today", name: "В этот день", icon: "history", description: "Что вы писали в этот день в прошлые годы", quick: "today", filter: {} },
  { id: "random30", name: "Случайная выборка за период", icon: "dice", description: "Рандом из заметок за последние 30 дней — 🎲 перемешивает", quick: "random", filter: { period: "30d" } },
];

function createPresets({ db }) {
  const get = () => db.data.presets;
  return {
    list: () => get(),
    get: (id) => get().find((p) => p.id === id),
    save(preset) {
      const p = { ...preset, id: preset.id || uid("flt") };
      const list = get(), i = list.findIndex((x) => x.id === p.id);
      db.data.presets = i >= 0 ? list.map((x, j) => (j === i ? p : x)) : [...list, p];
      db.save();
      return p;
    },
    remove(id) { db.data.presets = get().filter((p) => p.id !== id); db.save(); },
  };
}
module.exports = { DEFAULT_PRESETS, createPresets };

},
"services/scroll": function (module, exports, require) {
// services/scroll.js — запоминание и восстановление прокрутки заметки с виджетом.
//
// Главное: прокручиваемый контейнер определяется НАДЁЖНО.
//  • сначала — элемент, на котором реально происходили события scroll (last): он гарантированно настоящий;
//  • затем — подсказка из прошлого сеанса (scrollerSel) и известные контейнеры Obsidian (.markdown-preview-view, .cm-scroller);
//  • и только потом — эвристика по overflow, причём ТОЛЬКО для элементов, которые действительно прокручиваются
//    (у промежуточных обёрток computed overflow-y бывает "auto" без прокрутки: из-за них раньше сохранялся scrollTop = 0).
//
// Остальные меры: позиция и высота фиксируются при клике по карточке (leave); пока идёт восстановление (hold), новые значения
// не сохраняются; высота виджета резервируется; восстановление «удерживается» 3 с (Obsidian может сам сдвинуть прокрутку после
// рендера); события от «мёртвого» виджета (заметку уже сменили) игнорируются. config.debug = true пишет ход дел в консоль.
const { debounce } = require("lib/async");

const KNOWN = ".markdown-preview-view, .cm-scroller";
const HINTS = ["markdown-preview-view", "cm-scroller", "view-content"];

module.exports = function createScroll({ session, key, log = () => {} }) {
  let rootEl = null, last = null, cancelled = false, frozen = false, held = false, holdTimer = null;
  const listeners = new Set();
  const alive = () => !!rootEl && rootEl.isConnected !== false && (rootEl.offsetHeight === undefined || rootEl.offsetHeight > 0);
  const scrollable = (n) => n.scrollHeight - n.clientHeight > 1;
  const hintOf = (t) => HINTS.find((c) => t.classList && t.classList.contains(c));

  function findScroller() {
    if (!rootEl) return null;
    if (last && last.isConnected !== false && last.contains && last.contains(rootEl)) return last;
    if (rootEl.closest) {
      const hint = (session.get() || {}).scrollerSel;
      const byHint = hint && rootEl.closest("." + hint);
      if (byHint) return byHint;
      const known = rootEl.closest(KNOWN);
      if (known) return known;
    }
    for (let n = rootEl.parentElement || rootEl.parentNode; n && n.nodeType === 1; n = n.parentElement || n.parentNode) {
      const oy = typeof getComputedStyle === "function" ? getComputedStyle(n).overflowY : "";
      if ((oy === "auto" || oy === "scroll" || oy === "overlay") && scrollable(n)) return n;
    }
    return rootEl.closest ? rootEl.closest(".view-content") : null;
  }
  const snapshot = (sc) => { session.patch({ scroll: sc.scrollTop, height: rootEl.offsetHeight || undefined, scrollerSel: hintOf(sc) }); log("save", sc.scrollTop, hintOf(sc) || sc.className); };

  const save = debounce((t) => { if (!frozen && !held && alive()) snapshot(t); }, 80);
  const onScroll = (e) => {
    const t = e.target;
    if (!(rootEl && t && t.nodeType === 1 && t.contains && t.contains(rootEl))) return;
    last = t;
    listeners.forEach((cb) => cb(t.scrollTop));
    save(t);
  };
  const onUser = () => { cancelled = true; };
  const USER = ["wheel", "touchmove", "keydown"];

  const g = (window.__sfScrollOff = window.__sfScrollOff || {});
  if (g[key]) g[key]();               // не копим слушатели при повторных перерисовках блока
  if (document.addEventListener) {
    document.addEventListener("scroll", onScroll, true);
    USER.forEach((e) => document.addEventListener(e, onUser, true));
    g[key] = () => { document.removeEventListener("scroll", onScroll, true); USER.forEach((e) => document.removeEventListener(e, onUser, true)); };
  }

  const release = () => { held = false; clearTimeout(holdTimer); };
  return {
    setRoot(el) { rootEl = el; },
    destroy() { if (g[key]) { g[key](); delete g[key]; } listeners.clear(); clearTimeout(holdTimer); cancelled = true; },
    scroller: () => findScroller(),
    onScroll(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    toTop() { const sc = findScroller(); if (!sc) return; if (sc.scrollTo) sc.scrollTo({ top: 0, behavior: "smooth" }); else sc.scrollTop = 0; },

    // Приостановить сохранение позиции (вызывается до построения интерфейса, если предстоит восстановление).
    hold() { held = true; clearTimeout(holdTimer); holdTimer = setTimeout(release, 16000); },

    // Восстановить позицию: повторяем, пока страница не станет достаточно высокой, затем удерживаем 3 с.
    restore(top, onDone) {
      held = true; cancelled = false; frozen = false;
      clearTimeout(holdTimer); holdTimer = setTimeout(release, 16000);
      const t0 = Date.now(); let okSince = 0;
      const finish = (why) => { log("restore done:", why); release(); if (onDone) onDone(); };
      const tick = () => {
        if (!top) return finish("нет позиции");
        if (cancelled) return finish("пользователь прокручивает сам");
        const sc = findScroller();
        if (sc) {
          if (Math.abs(sc.scrollTop - top) >= 2) { sc.scrollTop = top; okSince = 0; log("restore set", top, "→", sc.scrollTop, "высота", sc.scrollHeight, hintOf(sc) || sc.className); }
          else if (!okSince) okSince = Date.now();
        } else log("restore: контейнер прокрутки не найден");
        if (okSince && Date.now() - okSince > 3000) return finish("позиция удержана");
        if (Date.now() - t0 > 12000) return finish("таймаут");
        setTimeout(tick, 120);
      };
      tick();
    },

    // Уходим со страницы (клик по карточке): зафиксировать позицию и высоту и больше их не менять.
    leave() {
      const sc = findScroller(), saved = (session.get() || {}).scroll || 0;
      // не затираем верную позицию нулём от элемента, который на самом деле не прокручивается
      if (sc && alive() && !held && !(sc.scrollTop === 0 && saved > 0 && sc !== last)) snapshot(sc);
      frozen = true;
    },

    // Вход в раздел: показать верх блока.
    toBlockTop() {
      const sc = findScroller();
      if (!sc || !rootEl.getBoundingClientRect) return;
      const delta = rootEl.getBoundingClientRect().top - sc.getBoundingClientRect().top;
      if (delta < 0) sc.scrollTop += delta - 8;
      snapshot(sc);
    },
  };
};

},
"services/session": function (module, exports, require) {
// services/session.js — состояние экрана в памяти окна Obsidian (переживает перерисовку блока при переходах
// «заметка → назад»). Намеренно НЕ пишется на диск: после перезапуска Obsidian лента стартует с чистого листа.
module.exports = function createSession(key) {
  const g = (window.__sfSession = window.__sfSession || {});
  return {
    get: () => g[key] || null,
    patch: (p) => { g[key] = { ...(g[key] || {}), ...p }; },
  };
};

},
"services/storage": function (module, exports, require) {
// services/storage.js — доступ к данным и ресурсам плагина.
//  • данные пользователя (настройки, подборки, избранное, UI) — один файл data.json через plugin.loadData/saveData;
//  • ресурсы (css/*.css, README) — из папки плагина (vault adapter) либо, в собранном main.js, из встроенного bundle.
module.exports = function createStorage(plugin) {
  const adapter = plugin.app.vault.adapter;
  const dir = plugin.manifest.dir;
  const full = (rel) => `${dir}/${rel}`;
  const bundle = plugin.__bundle || null; // в собранном main.js css и README лежат внутри
  return {
    dir,
    async load() { try { return (await plugin.loadData()) || null; } catch (e) { console.warn("[journal-stream] не удалось прочитать data.json", e); return null; } },
    async save(data) { try { await plugin.saveData(data); return true; } catch (e) { console.warn("[journal-stream] не удалось записать data.json", e); return false; } },
    async readText(rel) {
      if (bundle && rel !== "css/90-custom.css") { const r = rel.startsWith("css/") ? bundle.css[rel.slice(4)] : rel === "README.md" ? bundle.readme : undefined; if (r !== undefined) return r; }
      const p = full(rel); return (await adapter.exists(p)) ? adapter.read(p) : "";
    },
    // css/90-custom.css на диске (если есть) важнее встроенного: пользовательские правки не теряются
    async listFiles(rel) {
      const p = full(rel), disk = (await adapter.exists(p)) ? (await adapter.list(p)).files : [];
      if (bundle && rel === "css") { const names = new Set(Object.keys(bundle.css)); disk.forEach((f) => names.add(f.split("/").pop())); return [...names].filter((n) => n.endsWith(".css")).map((n) => rel + "/" + n); }
      return disk;
    },
  };
};

},
"services/theme-watch": function (module, exports, require) {
// services/theme-watch.js — следит за темой Obsidian (класс theme-dark / theme-light на <body>).
// Когда пользователь переключает тему Obsidian, выбор темы в виджете сбрасывается на «auto» (следовать глобальной теме).
module.exports = function watchObsidianTheme(ctx) {
  if (typeof MutationObserver === "undefined" || !document.body) return () => {};
  const isDark = () => document.body.classList.contains("theme-dark");
  let was = isDark();
  const mo = new MutationObserver(() => {
    if (ctx.rootEl && ctx.rootEl.isConnected === false) { mo.disconnect(); return; } // виджет исчез
    const now = isDark();
    if (now !== was) { was = now; if (ctx.store.get().theme !== "auto") ctx.actions.setTheme("auto"); }
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
};

},
"stats/activity": function (module, exports, require) {
// stats/activity.js — активность по дням, матрица-тепловая карта и стрик.
const { dayKey, DAY, startOfDay } = require("lib/date");

function countByDay(posts) {
  const m = new Map();
  for (const p of posts) { const k = dayKey(p.ts); m.set(k, (m.get(k) || 0) + 1); }
  return m;
}
const level = (n, max) => (n <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((n / Math.max(max, 1)) * 4))));

// weeks столбцов × 7 строк (пн..вс); последняя колонка — текущая неделя.
function heatmap(byDay, now, weeks = 53) {
  const today = startOfDay(now), dow = (new Date(today).getDay() + 6) % 7;
  const start = today - (dow + (weeks - 1) * 7) * DAY;
  const max = Math.max(0, ...byDay.values());
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const ts = start + (w * 7 + d) * DAY, key = dayKey(ts), n = byDay.get(key) || 0;
      col.push({ key, ts, n, level: ts > today ? -1 : level(n, max) });
    }
    cols.push(col);
  }
  return cols;
}

function streak(byDay, now) {
  let cur = 0, d = startOfDay(now);
  if (!byDay.get(dayKey(d))) d -= DAY;
  while (byDay.get(dayKey(d))) { cur++; d -= DAY; }
  const keys = [...byDay.keys()].sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    const t = new Date(k + "T00:00:00").getTime();
    run = prev !== null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = t;
  }
  return { current: cur, best };
}
// Диапазоны числа заметок за день для каждого уровня цвета (для легенды): [от, до], до=null — «и больше».
function levelRanges(max) {
  if (max <= 0) return [[0, 0], [1, 1], [2, 2], [3, 3], [4, null]];
  const edges = [1, 2, 3, 4].map((l) => Math.max(1, Math.floor((max * l) / 4)));
  const out = [[0, 0]]; let from = 1;
  for (let l = 1; l <= 4; l++) { const to = l === 4 ? null : Math.max(from, edges[l - 1]); out.push([from, to]); if (to !== null) from = to + 1; }
  return out;
}
function summary(byDay) {
  let total = 0, best = null;
  for (const [key, n] of byDay) { total += n; if (!best || n > best.n) best = { key, n }; }
  return { total, activeDays: byDay.size, best };
}
module.exports = { countByDay, heatmap, streak, levelRanges, summary };

},
"stats/author": function (module, exports, require) {
// stats/author.js — «мини-статистика по автору»: когда вы пишете, рекорды серий, самые длинные записи. Чистые функции.
const { dayKey, DAY, startOfDay } = require("lib/date");

const keyTs = (k) => new Date(k + "T00:00:00").getTime();

// Часы суток: учитываются только записи с указанным временем (hasTime) — иначе всё упадёт в 00:00.
function byHour(posts) {
  const counts = Array(24).fill(0); let timed = 0;
  for (const p of posts) { if (!p.hasTime) continue; counts[new Date(p.ts).getHours()]++; timed++; }
  return { counts, timed, total: posts.length };
}
// Дни недели (пн..вс).
function byWeekday(posts) {
  const counts = Array(7).fill(0);
  for (const p of posts) counts[(new Date(p.ts).getDay() + 6) % 7]++;
  return counts;
}
// По годам (по возрастанию) и по месяцам года (янв..дек, суммарно за все годы).
function byYear(posts) {
  const m = new Map();
  for (const p of posts) { const y = new Date(p.ts).getFullYear(); m.set(y, (m.get(y) || 0) + 1); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count }));
}
const peak = (counts) => { let i = 0; counts.forEach((v, k) => { if (v > counts[i]) i = k; }); return counts[i] > 0 ? i : -1; };

// Серии подряд идущих дней с записями: лучшая за всё время, текущая; самая долгая пауза между записями.
function streakRecords(byDay, now) {
  const keys = [...byDay.keys()].sort();
  let best = { len: 0, from: null, to: null }, run = 0, runFrom = null, prev = null, gap = { days: 0, from: null, to: null };
  for (const k of keys) {
    const t = keyTs(k);
    if (prev !== null && Math.round((t - prev) / DAY) === 1) run++; else { run = 1; runFrom = k; }
    if (prev !== null) { const g = Math.round((t - prev) / DAY) - 1; if (g > gap.days) gap = { days: g, from: dayKey(prev + DAY), to: dayKey(t - DAY) }; }
    if (run > best.len) best = { len: run, from: runFrom, to: k };
    prev = t;
  }
  let cur = { len: 0, from: null, to: null }, d = startOfDay(now);
  if (!byDay.get(dayKey(d))) d -= DAY;
  const to = dayKey(d);
  while (byDay.get(dayKey(d))) { cur.len++; cur.from = dayKey(d); d -= DAY; }
  if (cur.len) cur.to = to;
  return { best, current: cur, gap };
}
// Самый плодотворный день и месяц.
function busiest(byDay) {
  let day = null; const months = new Map();
  for (const [k, n] of byDay) { if (!day || n > day.n) day = { key: k, n }; const mk = k.slice(0, 7); months.set(mk, (months.get(mk) || 0) + n); }
  let month = null; for (const [key, n] of months) if (!month || n > month.n) month = { key, n };
  return { day, month };
}
// Кандидаты в «самые длинные»: быстрый отбор по размеру файла (точные слова считаются позже, по прочитанному телу).
const longestCandidates = (posts, n = 24) => posts.slice().sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, n);

// Сводка: активные дни, среднее за активный день, диапазон дат, «заметок в неделю».
function overall(posts, byDay) {
  if (!posts.length) return { total: 0, activeDays: 0, perActiveDay: 0, perWeek: 0, first: null, last: null, spanDays: 0 };
  let first = Infinity, last = -Infinity;
  for (const p of posts) { if (p.ts < first) first = p.ts; if (p.ts > last) last = p.ts; }
  const spanDays = Math.max(1, Math.round((startOfDay(last) - startOfDay(first)) / DAY) + 1);
  return { total: posts.length, activeDays: byDay.size, perActiveDay: Math.round((posts.length / byDay.size) * 10) / 10, perWeek: Math.round((posts.length / (spanDays / 7)) * 10) / 10, first, last, spanDays };
}
// Период: all | year (с 1 января) | 12m (последние 365 дней)
function inPeriod(posts, period, now) {
  if (period === "year") { const s = new Date(new Date(now).getFullYear(), 0, 1).getTime(); return posts.filter((p) => p.ts >= s); }
  if (period === "12m") return posts.filter((p) => p.ts >= now - 365 * DAY);
  return posts;
}
module.exports = { byHour, byWeekday, byYear, peak, streakRecords, busiest, longestCandidates, overall, inPeriod };

},
"stats/period": function (module, exports, require) {
// stats/period.js — «Пульс месяца»: заметки, дельта, связи, медиа, плотность графа.
const { monthKey } = require("lib/date");

function monthStats(posts, now) {
  const d = new Date(now), cur = monthKey(now), prev = monthKey(new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime());
  const inCur = posts.filter((p) => monthKey(p.ts) === cur), inPrev = posts.filter((p) => monthKey(p.ts) === prev);
  const links = inCur.reduce((s, p) => s + p.links, 0);
  // files — сколько файлов добавлено (по встроенным вложениям), notes — в скольких заметках они встречаются
  const files = { photo: 0, video: 0, audio: 0 }, notes = { photo: 0, video: 0, audio: 0 };
  for (const p of inCur) {
    const c = p.mediaCounts || { image: 0, video: 0, audio: 0 };
    files.photo += c.image; files.video += c.video; files.audio += c.audio;
    if (c.image) notes.photo++; if (c.video) notes.video++; if (c.audio) notes.audio++;
  }
  const isolated = inCur.filter((p) => p.links + p.backlinks === 0).length;
  // накопительная динамика по дням текущего месяца (до сегодняшнего дня) и «консистентность»
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), elapsed = Math.min(dim, d.getDate());
  const daily = new Array(dim).fill(0);
  for (const p of inCur) daily[new Date(p.ts).getDate() - 1]++;
  let acc = 0;
  const cumulative = daily.slice(0, elapsed).map((n) => (acc += n));
  const activeDays = daily.slice(0, elapsed).filter((n) => n > 0).length;
  return {
    daysInMonth: dim, elapsed, daily, cumulative, activeDays,
    consistencyPct: elapsed ? Math.round((activeDays / elapsed) * 100) : 0,
    count: inCur.length, prevCount: inPrev.length,
    deltaPct: inPrev.length ? Math.round(((inCur.length - inPrev.length) / inPrev.length) * 100) : null,
    links, density: inCur.length ? Math.round((links / inCur.length) * 10) / 10 : 0,
    isolatedPct: inCur.length ? Math.round((isolated / inCur.length) * 100) : 0,
    media: files, mediaNotes: notes, mediaTotal: files.photo + files.video + files.audio, posts: inCur,
  };
}
module.exports = { monthStats };

},
"stats/tags": function (module, exports, require) {
// stats/tags.js — частоты тегов.
function tagCounts(posts, { limit = 30, exclude = [] } = {}) {
  const m = new Map(), ex = new Set(exclude);
  for (const p of posts) for (const t of p.tags) if (!ex.has(t)) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, limit);
}
module.exports = { tagCounts };

},
"stats/types": function (module, exports, require) {
// stats/types.js — распределение заметок по типам карточек.
function typeCounts(posts) {
  const m = new Map();
  for (const p of posts) m.set(p.type || "text", (m.get(p.type || "text") || 0) + 1);
  const total = posts.length || 1;
  return [...m.entries()].map(([id, count]) => ({ id, count, pct: Math.round((count / total) * 100) })).sort((a, b) => b.count - a.count);
}
module.exports = { typeCounts };

},
"types/audio": function (module, exports, require) {
module.exports = { id: "audio", label: "Voice", icon: "mic", match: (p, f) => p.mediaKinds.has("audio") || !!(f && f.byKind("audio").length) };

},
"types/canvas": function (module, exports, require) {
module.exports = { id: "canvas", label: "Canvas", icon: "share", match: (p, f) => p.mediaKinds.has("canvas") || !!(f && f.byKind("canvas").length) };

},
"types/image": function (module, exports, require) {
module.exports = { id: "image", label: "Photo", icon: "image", match: (p, f) => p.mediaKinds.has("image") || !!(f && f.byKind("image").length) };

},
"types/index": function (module, exports, require) {
// types/index.js — реестр типов карточек. Порядок = приоритет автоопределения.
const list = ["video", "audio", "canvas", "image", "quote", "tasks", "link", "text"].map((n) => require("types/" + n));
const byId = Object.fromEntries(list.map((t) => [t.id, t]));
const ALIASES = { voice: "audio", photo: "image", todo: "tasks", task: "tasks", citation: "quote", цитата: "quote", аудио: "audio", видео: "video", фото: "image", задачи: "tasks" };

// frontmatter `type` (если известен) важнее автоопределения; f (анализ тела) может быть null.
function resolve(post, f) {
  const hint = ALIASES[post.typeHint] || post.typeHint;
  if (hint && byId[hint]) return byId[hint];
  return list.find((t) => t.match(post, f)) || byId.text;
}
const get = (id) => byId[id] || byId.text;
module.exports = { list, get, resolve };

},
"types/link": function (module, exports, require) {
// Короткая заметка-ссылка: есть внешний URL и мало текста.
module.exports = { id: "link", label: "Link", icon: "link", match: (p, f) => !!f && f.external.length > 0 && f.words < 45 };

},
"types/quote": function (module, exports, require) {
// Цитата: тег из config.quoteTags/«цитата» или тело, где цитаты занимают заметную часть текста.
module.exports = {
  id: "quote", label: "Quote", icon: "quote",
  match: (p, f) => p.tags.some((t) => /цитат|quote/.test(t)) || (!!f && f.quotes.length > 0 && f.quoteRatio > 0.4),
};

},
"types/tasks": function (module, exports, require) {
module.exports = { id: "tasks", label: "Tasks", icon: "tasks", match: (p, f) => (f ? f.tasks.total : p.tasksTotal) >= 2 };

},
"types/text": function (module, exports, require) {
module.exports = { id: "text", label: "Note", icon: "file", match: () => true };

},
"types/video": function (module, exports, require) {
module.exports = { id: "video", label: "Video", icon: "video", match: (p, f) => p.mediaKinds.has("video") || !!(f && f.byKind("video").length) };

},
"ui/card/bodies/_excerpt": function (module, exports, require) {
// ui/card/bodies/_excerpt.js — общий рендер текстового превью (markdown, с обрезкой и «Читать далее»).
const { h } = require("lib/dom");
const hookLinks = require("ui/card/links");
const { cleanForExcerpt, truncateMarkdown } = require("lib/text");

// Тело заметки без цитат/задач — чтобы не дублировать то, что уже показано отдельным блоком.
function bodyWithout(body, { quotes = false, tasks = false } = {}) {
  const lines = String(body || "").split(/\r?\n/).filter((l) => !(quotes && /^\s*>/.test(l)) && !(tasks && /^\s*[-*+]\s+\[[ xX]\]/.test(l)));
  return cleanForExcerpt(lines.join("\n"));
}

async function renderExcerpt(ctx, post, feats, parent, opts = {}) {
  const src = opts.quotes || opts.tasks ? bodyWithout(feats.body, opts) : feats.text;
  if (!src) return null;
  const max = opts.max || ctx.config.excerptChars;
  const { text } = truncateMarkdown(src, max);
  const box = h("div", { class: "sf-card__text markdown-rendered" });
  parent.append(box);
  await ctx.md.render(text, box, post.path);
  hookLinks(ctx, box, post);
  return box;
}
module.exports = { renderExcerpt, bodyWithout };

},
"ui/card/bodies/audio": function (module, exports, require) {
// Аудио-заметка: плеер с «волной» (декоративной) и прогрессом.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { mulberry32 } = require("lib/random");
const { hash } = require("lib/misc");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");

const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

async function render(ctx, post, feats, el) {
  const m = feats.byKind("audio")[0];
  const src = m && ctx.media.resolve(m.target, post.path);
  if (src) {
    const audio = h("audio", { preload: "metadata", src });
    const time = h("span", { class: "sf-audio__time" }, "0:00");
    const rnd = mulberry32(parseInt(hash(post.path), 36));
    const bars = Array.from({ length: 40 }, () => h("span", { class: "sf-audio__bar", style: { height: 20 + Math.round(rnd() * 80) + "%" } }));
    const btn = h("button", { type: "button", class: "sf-audio__btn", title: "Воспроизвести", onClick: () => (audio.paused ? audio.play() : audio.pause()) }, icon("play", { size: 16, fill: true }));
    const wave = h("div", { class: "sf-audio__wave", onClick: (e) => { const r = wave.getBoundingClientRect(); if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; } }, bars);
    audio.addEventListener("loadedmetadata", () => (time.textContent = fmt(audio.duration)));
    audio.addEventListener("play", () => btn.classList.add("is-playing"));
    audio.addEventListener("pause", () => btn.classList.remove("is-playing"));
    audio.addEventListener("timeupdate", () => {
      const p = audio.duration ? audio.currentTime / audio.duration : 0;
      bars.forEach((b, i) => b.classList.toggle("is-played", i / bars.length < p));
      time.textContent = fmt(audio.currentTime) + " / " + fmt(audio.duration);
    });
    el.append(h("div", { class: "sf-audio" }, btn, wave, time, audio));
  } else el.append(h("div", { class: "sf-media-missing" }, "Аудиофайл не найден: " + (m ? m.target : "—")));
  await renderExcerpt(ctx, post, feats, el, { max: 260 });
}
module.exports = { render };

},
"ui/card/bodies/canvas": function (module, exports, require) {
// Canvas: плитка-ссылка на .canvas + текст.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");

async function render(ctx, post, feats, el) {
  const m = feats.byKind("canvas")[0];
  if (m) {
    const f = ctx.media.resolveFile(m.target, post.path);
    el.append(h("a", { class: "sf-canvas", href: "#", onClick: (e) => { e.preventDefault(); ctx.openNote(f ? f.path : post.path, e); } },
      icon("share", { size: 18 }), h("span", { class: "sf-canvas__name" }, m.target.split("/").pop()), h("span", { class: "sf-canvas__open" }, "Открыть в Canvas", icon("arrowUpRight", { size: 13 }))));
  }
  await renderExcerpt(ctx, post, feats, el, { max: 260 });
}
module.exports = { render };

},
"ui/card/bodies/image": function (module, exports, require) {
// Фото: сетка до 4 изображений с «+N».
const { h } = require("lib/dom");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");

async function render(ctx, post, feats, el) {
  const imgs = feats.byKind("image");
  const shown = imgs.slice(0, 4);
  const grid = h("div", { class: ["sf-images", `sf-images--${shown.length}`] });
  shown.forEach((m, i) => {
    const src = ctx.media.resolve(m.target, post.path);
    if (!src) return;
    const cell = h("a", { class: "sf-images__cell", href: "#", onClick: (e) => { e.preventDefault(); ctx.openNote(post.path, e); } }, h("img", { src, loading: "lazy", alt: m.alt || m.target }));
    if (i === 3 && imgs.length > 4) cell.append(h("span", { class: "sf-images__more" }, `+${imgs.length - 4}`));
    grid.append(cell);
  });
  if (grid.children.length) el.append(grid);
  await renderExcerpt(ctx, post, feats, el, { max: 300 });
}
module.exports = { render };

},
"ui/card/bodies/index": function (module, exports, require) {
// ui/card/bodies/index.js — тип карточки → рендер тела.
const map = {};
for (const id of ["text", "quote", "audio", "video", "image", "canvas", "tasks", "link"]) map[id] = require("ui/card/bodies/" + id);
module.exports = { get: (id) => map[id] || map.text };

},
"ui/card/bodies/link": function (module, exports, require) {
// Ссылка: превью внешнего URL (домен + адрес) + текст.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");

async function render(ctx, post, feats, el) {
  const url = feats.external[0];
  if (url) {
    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) {}
    el.append(h("a", { class: "sf-extlink", href: url, target: "_blank", rel: "noopener" }, icon("link", { size: 16 }), h("span", { class: "sf-extlink__main" }, h("span", { class: "sf-extlink__host" }, host), h("span", { class: "sf-extlink__url" }, url)), icon("arrowUpRight", { size: 14 })));
  }
  await renderExcerpt(ctx, post, feats, el, { max: 220 });
}
module.exports = { render };

},
"ui/card/bodies/quote": function (module, exports, require) {
// Цитата: крупный блок-цитата + остальной текст.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");
const { truncateMarkdown } = require("lib/text");
const hookLinks = require("ui/card/links");

async function render(ctx, post, feats, el) {
  const q = feats.quotes[0];
  if (q) {
    const box = h("blockquote", { class: "sf-quote" }, icon("quote", { size: 18, cls: "sf-quote__mark" }));
    const txt = h("div", { class: "sf-quote__text markdown-rendered" });
    box.append(txt);
    el.append(box);
    await ctx.md.render(truncateMarkdown(q.text, 320).text, txt, post.path);
    hookLinks(ctx, txt, post);
    if (q.callout && q.callout.title) box.append(h("cite", { class: "sf-quote__cite" }, q.callout.title));
  }
  await renderExcerpt(ctx, post, feats, el, { quotes: true, max: 220 });
}
module.exports = { render };

},
"ui/card/bodies/tasks": function (module, exports, require) {
// Задачи: прогресс + первые пункты (только чтение).
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");

async function render(ctx, post, feats, el) {
  const { total, done, items } = feats.tasks;
  el.append(h("div", { class: "sf-progress", title: `${done} из ${total}` }, h("div", { class: "sf-progress__bar", style: { width: (total ? (done / total) * 100 : 0) + "%" } })));
  el.append(h("ul", { class: "sf-tasks" }, items.slice(0, 6).map((t) =>
    h("li", { class: ["sf-tasks__item", t.done && "is-done"] }, h("span", { class: "sf-tasks__box" }, t.done && icon("check", { size: 11 })), h("span", null, t.text)))));
  if (total > 6) el.append(h("div", { class: "sf-tasks__more" }, `ещё ${total - 6}…`));
  await renderExcerpt(ctx, post, feats, el, { tasks: true, max: 220 });
}
module.exports = { render };

},
"ui/card/bodies/text": function (module, exports, require) {
const { renderExcerpt } = require("ui/card/bodies/_excerpt");
module.exports = { render: (ctx, post, feats, el) => renderExcerpt(ctx, post, feats, el) };

},
"ui/card/bodies/video": function (module, exports, require) {
// Видео-заметка: нативный <video> + превью текста.
const { h } = require("lib/dom");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");

async function render(ctx, post, feats, el) {
  const m = feats.byKind("video")[0];
  const src = m && ctx.media.resolve(m.target, post.path);
  if (src) el.append(h("div", { class: "sf-video" }, h("video", { src, controls: true, preload: "metadata", playsinline: true }), h("span", { class: "sf-video__badge" }, m.target.split("/").pop())));
  else el.append(h("div", { class: "sf-media-missing" }, "Видеофайл не найден: " + (m ? m.target : "—")));
  await renderExcerpt(ctx, post, feats, el, { max: 280 });
}
module.exports = { render };

},
"ui/card/card": function (module, exports, require) {
// ui/card/card.js — карточка поста: скелетон сразу, тело — после чтения заметки.
const { h, clear } = require("lib/dom");
const types = require("types");
const header = require("ui/card/header");
const footer = require("ui/card/footer");
const bodies = require("ui/card/bodies");

const INTERACTIVE = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "VIDEO", "AUDIO", "LABEL"]);
// Клик по ссылке/кнопке/плееру/чипу обрабатывается самим элементом; по «пустому» месту карточки — открывает заметку.
function isInteractive(target, root) {
  for (let n = target; n && n !== root; n = n.parentNode) {
    if (INTERACTIVE.has(n.tagName) || (n.classList && (n.classList.contains("sf-chip") || n.classList.contains("sf-audio__wave")))) return true;
  }
  return false;
}
const hasSelection = () => { try { const s = window.getSelection && window.getSelection(); return !!s && String(s).length > 0; } catch (e) { return false; } };

module.exports = function createCard(ctx, post) {
  const el = h("article", { class: "sf-card", dataset: { path: post.path } });
  let loaded = false;
  el.addEventListener("click", (e) => { if (!isInteractive(e.target, el) && !hasSelection()) ctx.openNote(post.path, e); });

  function frame() {
    clear(el);
    el.className = ["sf-card", "is-clickable", `sf-card--${post.type}`, ctx.flags.isPinned(post) && "is-pinned", ctx.flags.isFavorite(post) && "is-fav"].filter(Boolean).join(" ");
    const body = h("div", { class: "sf-card__body" });
    el.append(header(ctx, post, frame));
    if (post.hasOwnTitle) el.append(h("a", { class: "sf-card__title", href: "#", "data-href": post.path, onClick: (e) => { e.preventDefault(); ctx.openNote(post.path, e); } }, post.title));
    el.append(body, footer(ctx, post));
    return body;
  }

  async function hydrate() {
    let body = frame();
    if (!loaded) body.append(h("div", { class: "sf-skeleton" }, h("i"), h("i"), h("i")));
    try {
      const feats = await ctx.content.load(post);
      if (!feats) return;
      const before = post.type;
      post.type = types.resolve(post, feats).id;
      loaded = true;
      body = frame(); // тип мог измениться — перерисовываем рамку
      await bodies.get(post.type).render(ctx, post, feats, body);
      if (before !== post.type) el.dataset.retyped = before;
    } catch (e) {
      console.error("[journal-stream] карточка", post.path, e);
      body.append(h("div", { class: "sf-media-missing" }, "Не удалось прочитать заметку"));
    }
  }
  el.sfReady = hydrate();
  return el;
};

},
"ui/card/footer": function (module, exports, require) {
// ui/card/footer.js — теги (пиллы), счётчик бэклинков (кроме режима плавающего окна), время чтения, «открыть».
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const chip = require("ui/common/chip");
const iconButton = require("ui/common/icon-button");
const { plural } = require("lib/ru");

module.exports = function cardFooter(ctx, post) {
  const active = new Set([...ctx.store.get().filter.any, ...ctx.store.get().filter.all]);
  const tags = post.tags.slice(0, 6);
  // В режиме плавающего окна ссылки вперёд/назад (бэклинки) на карточке скрыты
  const bl = ctx.store.get().popupView ? 0 : post.backlinks;
  return h("footer", { class: "sf-card__footer" },
    h("div", { class: "sf-card__tags" }, tags.map((t) => chip({ text: "#" + t, active: active.has(t), onClick: () => ctx.actions.tagClick(t), title: "Фильтр по тегу на этой странице" })), post.tags.length > 6 && h("span", { class: "sf-card__tagmore" }, `+${post.tags.length - 6}`)),
    h("div", { class: "sf-card__stats" },
      bl > 0 && h("span", { class: "sf-card__backlinks", title: "Входящие ссылки" }, icon("back", { size: 12 }), `${bl} ${plural(bl, ["бэклинк", "бэклинка", "бэклинков"])}`),
      post.feats && h("span", { class: "sf-card__read" }, `${post.feats.readMin} мин`),
      iconButton({ name: "arrowUpRight", title: "Открыть заметку", onClick: (e) => ctx.openNote(post.path, e) })));
};

},
"ui/card/header": function (module, exports, require) {
// ui/card/header.js — шапка: дата (mono) слева; тип, источник, закреп/избранное справа.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const types = require("types");
const { fmtDateTime } = require("lib/date");
const iconButton = require("ui/common/icon-button");

module.exports = function cardHeader(ctx, post, rerender) {
  const t = types.get(post.type);
  const src = ctx.config.showSourceBadge && ctx.config.sources.find((s) => s.id === post.source);
  const fav = ctx.flags.isFavorite(post), pin = ctx.flags.isPinned(post);
  return h("header", { class: "sf-card__header" },
    h("time", { class: "sf-card__date" }, fmtDateTime(post.ts, post.hasTime)),
    h("div", { class: "sf-card__meta" },
      src && h("span", { class: "sf-badge sf-badge--source" }, src.label),
      h("span", { class: ["sf-badge", `sf-badge--${t.id}`] }, icon(t.icon, { size: 12 }), t.label),
      iconButton({ name: "pin", title: pin ? "Открепить" : "Закрепить", active: pin, onClick: () => { ctx.flags.togglePin(post); rerender(); } }),
      iconButton({ name: "star", title: fav ? "Убрать из избранного" : "В избранное", active: fav, fill: fav, onClick: () => { ctx.flags.toggleFavorite(post); rerender(); } })));
};

},
"ui/card/links": function (module, exports, require) {
// ui/card/links.js — клики по ссылкам внутри отрисованного markdown карточки:
// • #тег → фильтр на этой странице (а не глобальный поиск Obsidian);
// • [[заметка]] → открытие по правилам виджета (вкладка из настройки, Ctrl/Cmd — новая).
module.exports = function hookLinks(ctx, root, post) {
  root.addEventListener("click", (e) => {
    let a = e.target;
    while (a && a !== root && a.tagName !== "A") a = a.parentNode;
    if (!a || a === root) return;
    const cls = a.classList;
    if (cls.contains("tag")) {
      e.preventDefault(); e.stopPropagation();
      ctx.actions.tagClick((a.getAttribute("href") || a.textContent || "").replace(/^#/, ""));
    } else if (cls.contains("internal-link")) {
      e.preventDefault(); e.stopPropagation();
      ctx.openLink(a.getAttribute("data-href") || a.getAttribute("href") || a.textContent, post.path, e);
    }
  }, true);
};

},
"ui/collections/preset-card": function (module, exports, require) {
// ui/collections/preset-card.js — карточка смарт-подборки. Клик по карточке открывает подборку в Бенто.
// Показывает правила, счётчик и мини-превью заметок с парой строк текста.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const chip = require("ui/common/chip");
const richLink = require("ui/common/rich-link");
const confirmButton = require("ui/common/confirm-button");
const toast = require("ui/common/toast");
const pipeline = require("filters/pipeline");
const { ruleChips } = require("filters/presets");
const { merge } = require("filters/state");
const { newSeed } = require("lib/random");
const { fmtNum, plural } = require("lib/ru");
const { snippet } = require("lib/text");

const stop = (fn) => (e) => { e.stopPropagation(); fn(e); };

module.exports = function presetCard(ctx, preset, posts, { hero = false } = {}) {
  const el = h("article", { class: ["sf-preset", "is-clickable", hero && "sf-preset--hero"], title: "Открыть подборку в Бенто", onClick: () => ctx.actions.openPreset(preset, "bento") });
  let seed = newSeed(), expanded = false;

  function draw() {
    clear(el);
    if (hero) el.append(h("span", { class: "sf-preset__glow" }));
    const { list } = pipeline.run(posts, { filter: merge(preset.filter), quick: preset.quick || "all", seed }, { config: ctx.config, flags: ctx.flags });
    const preview = list.slice(0, expanded ? 8 : 3);
    const rows = preview.map((p) => {
      const r = richLink(ctx, p);
      ctx.content.load(p).then((feats) => feats && r.setExcerpt(snippet(feats.text, 170))).catch(() => {});
      return r;
    });
    el.append(
      h("header", { class: "sf-preset__head" }, h("span", { class: "sf-preset__icon" }, icon(preset.icon || "star", { size: 18 })),
        h("div", { class: "sf-preset__titles" }, h("h3", null, preset.name), h("span", { class: "sf-preset__count" }, `${fmtNum(list.length)} ${plural(list.length, ["заметка", "заметки", "заметок"])}`)),
        h("div", { class: "sf-preset__tools" },
          preset.quick === "random" && h("button", { type: "button", class: "sf-iconbtn", title: "Перемешать", onClick: stop(() => { seed = newSeed(); draw(); }) }, icon("dice", { size: 15 })),
          h("button", { type: "button", class: "sf-iconbtn", title: "Редактировать в конструкторе", onClick: stop(() => ctx.actions.editPreset(preset)) }, icon("sliders", { size: 15 })),
          confirmButton({ title: "Удалить подборку", onConfirm: () => { ctx.presets.remove(preset.id); toast(ctx, "Подборка удалена"); ctx.reload(); } }))),
      preset.description && h("p", { class: "sf-preset__desc" }, preset.description),
      h("div", { class: "sf-preset__rules" }, ruleChips(preset).map((t) => chip({ text: t, kind: "rule" }))),
      h("div", { class: "sf-preset__preview" }, rows.length ? rows : h("span", { class: "sf-muted" }, "Нет подходящих заметок")),
      h("footer", { class: "sf-preset__foot" },
        list.length > 3 && h("button", { type: "button", class: "sf-link", onClick: stop(() => { expanded = !expanded; draw(); }) }, expanded ? "Свернуть" : `Показать ещё ${Math.min(5, list.length - 3)}`),
        h("span", { class: "sf-toolbar__spacer" }),
        h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-btn--sm", onClick: stop(() => ctx.actions.openPreset(preset, "stream")) }, "Лента"),
        h("span", { class: "sf-preset__open" }, "Открыть в Бенто", icon("arrowUpRight", { size: 13 }))));
  }
  draw();
  el.sfReady = Promise.resolve();
  return el;
};

},
"ui/common/chip": function (module, exports, require) {
// ui/common/chip.js — чип: тег, режим, фильтр. kind: tag | not | attr | rule.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");

module.exports = function chip({ text, kind = "tag", active = false, count, onClick, onRemove, title, iconName }) {
  const el = h("span", { class: ["sf-chip", `sf-chip--${kind}`, active && "is-active", onClick && "is-clickable"], title, onClick, role: onClick ? "button" : null });
  if (iconName) el.append(icon(iconName, { size: 12 }));
  el.append(h("span", { class: "sf-chip__text" }, text));
  if (count != null) el.append(h("span", { class: "sf-chip__count" }, count));
  if (onRemove) el.append(h("span", { class: "sf-chip__x", onClick: (e) => { e.stopPropagation(); onRemove(e); } }, icon("x", { size: 11 })));
  return el;
};

},
"ui/common/confirm-button": function (module, exports, require) {
// ui/common/confirm-button.js — кнопка опасного действия с подтверждением вторым кликом («Удалить?»).
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");

module.exports = function confirmButton({ title = "Удалить", confirmText = "Удалить?", label, onConfirm, disabled = false, cls = "sf-iconbtn" }) {
  let armed = false, timer = null;
  const b = h("button", { type: "button", class: [cls, disabled && "is-disabled"], title, disabled: disabled || null });
  function draw() {
    clear(b);
    b.classList.toggle("is-armed", armed);
    if (armed) b.append(h("span", { class: "sf-confirm__text" }, confirmText));
    else { b.append(icon("trash", { size: 14 })); if (label) b.append(h("span", null, label)); }
  }
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (!armed) { armed = true; draw(); timer = setTimeout(() => { armed = false; draw(); }, 2500); return; }
    clearTimeout(timer); armed = false; draw(); onConfirm(e);
  });
  draw();
  return b;
};

},
"ui/common/dropdown": function (module, exports, require) {
// ui/common/dropdown.js — выпадающее меню. render(panel, close) вызывается при каждом открытии.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");

module.exports = function dropdown({ label, iconName, title, render, align = "right" }) {
  const panel = h("div", { class: ["sf-menu", `sf-menu--${align}`], style: { display: "none" } });
  const btn = h("button", { type: "button", class: "sf-btn sf-btn--ghost", title, onClick: () => (open ? close() : show()) }, iconName && icon(iconName, { size: 14 }), label && h("span", null, label), icon("chevron", { size: 13 }));
  const el = h("div", { class: "sf-dropdown" }, btn, panel);
  let open = false;
  const onDoc = (e) => { if (!el.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };

  function show() { open = true; clear(panel); render(panel, close, show); panel.style.display = ""; if (document.addEventListener) { document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey); } }
  function close() { open = false; panel.style.display = "none"; if (document.removeEventListener) { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); } }
  // redraw — перерисовать содержимое открытого меню
  return { el, close, redraw: () => { if (open) { clear(panel); render(panel, close, show); } } };
};

},
"ui/common/empty": function (module, exports, require) {
// ui/common/empty.js — пустое состояние.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
module.exports = function empty({ title, hint, action }) {
  return h("div", { class: "sf-empty" }, icon("search", { size: 28 }), h("div", { class: "sf-empty__title" }, title), hint && h("div", { class: "sf-empty__hint" }, hint), action);
};

},
"ui/common/icon-button": function (module, exports, require) {
// ui/common/icon-button.js — квадратная кнопка-иконка 32×32.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
module.exports = function iconButton({ name, title, onClick, active = false, fill = false, label, cls }) {
  const b = h("button", { type: "button", class: ["sf-iconbtn", active && "is-active", cls], title, "aria-label": title, onClick }, icon(name, { size: 16, fill }));
  if (label) b.append(h("span", { class: "sf-iconbtn__label" }, label));
  return b;
};

},
"ui/common/modal": function (module, exports, require) {
// ui/common/modal.js — модальное окно (шторка) поверх страницы: заголовок с кнопкой закрытия, прокручиваемое тело, нижняя панель.
// Живёт в <body> (position: fixed), поэтому не зависит от overflow/transform родителей; тему и токены берёт из data-sf-theme.
// Тело оформлено как .sf-root.is-mobile — все мобильные стили виджета работают и внутри окна.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");

module.exports = function openModal(ctx, { title }) {
  const closeCbs = [];
  const theme = () => ctx.store.get().theme;
  const body = h("div", { class: "sf-modal__body" });
  const footer = h("div", { class: "sf-modal__footer" });
  const closeBtn = h("button", { type: "button", class: "sf-iconbtn sf-modal__close", "aria-label": "Закрыть", onClick: () => close() }, icon("x", { size: 18 }));
  const inner = h("div", { class: "sf-root sf-modal__root is-mobile", dataset: { sfTheme: theme() } }, body);
  const sheet = h("div", { class: "sf-modal__sheet", role: "dialog", "aria-modal": "true", "aria-label": title },
    h("div", { class: "sf-modal__head" }, h("h2", { class: "sf-modal__title" }, title), closeBtn), inner, footer);
  const overlay = h("div", { class: "sf-modal", dataset: { sfTheme: theme() }, onClick: (e) => { if (e.target === overlay) close(); } }, sheet);
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const offTheme = ctx.store.subscribe((s) => { overlay.dataset.sfTheme = s.theme; inner.dataset.sfTheme = s.theme; }, ["theme"]);

  document.body.appendChild(overlay);
  if (document.addEventListener) document.addEventListener("keydown", onKey);
  let closed = false;
  function close() {
    if (closed) return; closed = true;
    offTheme(); if (document.removeEventListener) document.removeEventListener("keydown", onKey);
    closeCbs.forEach((cb) => cb()); overlay.remove();
  }
  return { body, footer, close, onClose: (cb) => closeCbs.push(cb), el: overlay };
};

},
"ui/common/nav": function (module, exports, require) {
// ui/common/nav.js — верхняя панель: вкладки на всю ширину шапки + справа версия и переключатели
// (новая вкладка, полная ширина, тема). Бренд-чип убран: он вытеснял вкладки на узких экранах.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { list } = require("views");
const iconButton = require("ui/common/icon-button");
const versionBadge = require("ui/common/version-badge");
const openSettingsModal = require("ui/common/settings-modal");

const resolvedTheme = (t) => (t === "auto" ? (document.body && document.body.classList && document.body.classList.contains("theme-dark") ? "dark" : "light") : t);

module.exports = function nav(ctx) {
  const el = h("nav", { class: "sf-nav", "aria-label": "Разделы" });
  function draw() {
    clear(el);
    const s = ctx.store.get(), cur = s.view, dark = resolvedTheme(s.theme) === "dark";
    const mobile = !!(ctx.rootEl && ctx.rootEl.classList.contains("is-mobile"));
    const tabs = list.filter((v) => v.nav !== false).map((v) =>
      h("button", { type: "button", role: "tab", "aria-selected": v.id === cur ? "true" : "false", class: ["sf-nav__tab", v.short && "has-short", v.id === cur && "is-active"], title: v.title, onClick: () => ctx.actions.enterView(v.id) },
        h("span", { class: "sf-nav__full" }, v.title), v.short && h("span", { class: "sf-nav__short" }, v.short)));
    if (mobile) {
      // Телефон: только разделы (потоком, с переносом) и кнопка «Настройки» — переключатели вида/темы/вкладки внутри неё
      el.append(h("div", { class: "sf-nav__tabs", role: "tablist" }, tabs,
        h("button", { type: "button", class: "sf-nav__gear sf-nav__plus", "aria-label": "Новая заметка", title: "Новая заметка", onClick: () => ctx.createNote() }, icon("plus", { size: 16 })),
        h("button", { type: "button", class: "sf-nav__gear", "aria-label": "Настройки", onClick: () => openSettingsModal(ctx) }, icon("sliders", { size: 16 }))));
      return;
    }
    el.append(
      h("div", { class: "sf-nav__tabs", role: "tablist" }, tabs),
      h("div", { class: "sf-nav__right" },
        h("button", { type: "button", class: "sf-newnote", title: "Создать заметку (место — в настройках плагина)", onClick: () => ctx.createNote() }, icon("plus", { size: 15 }), h("span", null, "Новая заметка")),
        versionBadge(ctx),
        iconButton({ name: "phone", title: s.viewMode === "mobile" ? "Мобильный вид включён — нажмите, чтобы вернуть автоопределение" : "Показать мобильный вид (один столбец)", active: s.viewMode === "mobile", onClick: () => ctx.actions.setViewMode("mobile") }),
        iconButton({ name: "monitor", title: s.viewMode === "desktop" ? "Десктопный вид включён — нажмите, чтобы вернуть автоопределение" : "Показать десктопный вид (колонки, широкая шапка)", active: s.viewMode === "desktop", onClick: () => ctx.actions.setViewMode("desktop") }),
        iconButton({ name: "eye", title: s.popupView ? "Заметки открываются в плавающем окне просмотра (Ctrl/Cmd+клик — в редакторе)" : "Открывать заметки в плавающем окне просмотра", active: s.popupView, onClick: () => ctx.actions.setPopupView(!s.popupView) }),
        iconButton({ name: "newtab", title: s.openInNewTab ? "Заметки открываются в новой вкладке" : "Открывать заметки в новой вкладке", active: s.openInNewTab, onClick: () => ctx.actions.setOpenInNewTab(!s.openInNewTab) }),
        iconButton({ name: s.fullWidth ? "shrink" : "expand", title: s.fullWidth ? "Обычная ширина" : "На всю ширину", active: s.fullWidth, cls: "sf-nav__fullbtn", onClick: () => ctx.actions.setFullWidth(!s.fullWidth) }),
        h("button", { type: "button", class: "sf-themebtn", "aria-label": dark ? "Тёмная тема" : "Светлая тема", onClick: () => ctx.actions.setTheme(dark ? "light" : "dark") }, icon(dark ? "moon" : "sun", { size: 16 }))));
  }
  ctx.refreshNav = draw; // шапка зависит от мобильного режима — shell вызывает после смены вида/ширины
  draw();
  ctx.store.subscribe(draw, ["view", "fullWidth", "openInNewTab", "popupView", "theme", "viewMode"]);
  return el;
};

},
"ui/common/note-popup": function (module, exports, require) {
// ui/common/note-popup.js — плавающее окно просмотра заметки (reading view через MarkdownRenderer) вместо открытия в редакторе.
// Окно по центру экрана; основной контент затемнён (клик по затемнению закрывает окно).
// Включается настройкой «Открывать заметки в плавающем окне» (кнопка-глаз в навигации). Окно одно на вид: повторное открытие
// показывает другую заметку в том же окне. Его можно перетаскивать за заголовок и менять размер; Esc закрывает.
// В шапке окна — дата и теги; ссылки вперёд и назад (бэклинки) в этом режиме не показываются.
// Внутренние ссылки заметки открываются в этом же окне (кнопка «назад» — по истории), теги применяют фильтр ленты.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { fmtDateTime } = require("lib/date");
const { stripFrontmatter } = require("lib/text");
let Scope = null; try { Scope = require("obsidian").Scope || null; } catch (e) { /* вне Obsidian */ }

module.exports = function createNotePopup(ctx) {
  let win = null, parts = null, history = [], overlay = null, scope = null, pushed = false;

  const fileOf = (linktext, source) => {
    const { app } = ctx;
    return app.vault.getAbstractFileByPath(linktext) || (app.metadataCache.getFirstLinkpathDest && app.metadataCache.getFirstLinkpathDest(String(linktext).split("#")[0], source || "")) || null;
  };
  const postOf = (path) => (ctx.repo.collect().find((p) => p.path === path) || null);

  function close() {
    if (!win) return;
    detachBack();
    if (document.removeEventListener) document.removeEventListener("keydown", onKey);
    overlay.remove(); win = parts = overlay = null; history = [];
  }
  const onKey = (e) => { if (e.key === "Escape") close(); };

  // Кнопка/жест «назад» на телефоне: сначала возвращает к предыдущей заметке окна, затем закрывает окно.
  // Два независимых канала: стек областей клавиатуры Obsidian (Escape — его же использует «назад» для модальных окон)
  // и popstate веб-вью (на случай, если система откатывает историю браузера).
  const goBack = () => { if (history.length > 1) { history.pop(); const prev = history.pop(); if (prev) { show(prev); return; } } close(); };
  const onPop = () => { pushed = false; goBack(); if (win) attachHistory(); };
  function attachHistory() {
    try { if (typeof window !== "undefined" && window.history && window.history.pushState && window.addEventListener) { window.history.pushState({ sfPopup: 1 }, ""); pushed = true; window.addEventListener("popstate", onPop); } } catch (e) { pushed = false; }
  }
  function attachBack() {
    try { const km = ctx.app.keymap; if (Scope && km && km.pushScope) { scope = new Scope(); scope.register([], "Escape", () => { goBack(); return false; }); km.pushScope(scope); } } catch (e) { scope = null; }
    attachHistory();
  }
  function detachBack() {
    try { if (scope && ctx.app.keymap && ctx.app.keymap.popScope) ctx.app.keymap.popScope(scope); } catch (e) { /* ignore */ }
    scope = null;
    try {
      if (typeof window !== "undefined" && window.removeEventListener) window.removeEventListener("popstate", onPop);
      if (pushed && window.history && window.history.state && window.history.state.sfPopup && window.history.back) window.history.back();
    } catch (e) { /* ignore */ }
    pushed = false;
  }

  function build() {
    const back = h("button", { type: "button", class: "sf-iconbtn sf-npop__back", title: "Назад", "aria-label": "Назад", onClick: () => { if (history.length > 1) goBack(); } }, icon("arrowLeft", { size: 16 }));
    const title = h("h2", { class: "sf-npop__title" });
    const editBtn = h("button", { type: "button", class: "sf-iconbtn", title: "Открыть в редакторе", "aria-label": "Открыть в редакторе" }, icon("arrowUpRight", { size: 16 }));
    const closeBtn = h("button", { type: "button", class: "sf-iconbtn", title: "Закрыть", "aria-label": "Закрыть", onClick: close }, icon("x", { size: 16 }));
    const head = h("div", { class: "sf-npop__head" }, back, title, editBtn, closeBtn);
    const meta = h("div", { class: "sf-npop__meta" });
    const body = h("div", { class: "sf-npop__body markdown-preview-view markdown-rendered" });
    const el = h("div", { class: "sf-npop sf-root", role: "dialog", "aria-label": "Просмотр заметки", dataset: { sfTheme: ctx.store.get().theme } }, head, meta, body);
    overlay = h("div", { class: "sf-npop-overlay", dataset: { sfTheme: ctx.store.get().theme }, onClick: (e) => { if (e.target === overlay) close(); } }, el);
    document.body.appendChild(overlay);
    if (document.addEventListener) document.addEventListener("keydown", onKey);
    attachBack();
    drag(el, head);
    const offTheme = ctx.store.subscribe((s) => { el.dataset.sfTheme = s.theme; overlay.dataset.sfTheme = s.theme; }, ["theme"]);
    const rm = overlay.remove.bind(overlay); overlay.remove = () => { offTheme(); rm(); };
    // клики внутри текста: внутренние ссылки — в этом же окне, теги — фильтр ленты
    body.addEventListener("click", (e) => {
      for (let n = e.target; n && n !== body; n = n.parentNode) {
        if (n.tagName !== "A") continue;
        const cls = n.classList;
        if (cls.contains("tag")) { e.preventDefault(); const t = String(n.textContent).replace(/^#/, ""); if (t) ctx.actions.tagClick(t); return; }
        if (cls.contains("internal-link")) { e.preventDefault(); const href = n.getAttribute("data-href") || n.getAttribute("href"); const f = fileOf(href, parts.path); if (f) show(f.path); return; }
        return; // внешние ссылки — штатно
      }
    });
    return { el, title, meta, body, editBtn, back, path: null };
  }

  function drag(el, handle) {
    if (!handle.addEventListener) return;
    handle.addEventListener("pointerdown", (e) => {
      if (e.target && e.target.closest && e.target.closest("button")) return;
      const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      el.style.position = "fixed"; el.style.margin = "0"; el.style.left = r.left + "px"; el.style.top = r.top + "px";
      const move = (m) => { el.style.left = Math.max(0, Math.min(window.innerWidth - 80, m.clientX - dx)) + "px"; el.style.top = Math.max(0, Math.min(window.innerHeight - 40, m.clientY - dy)) + "px"; };
      const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); };
      document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
    });
  }

  async function show(path) {
    const file = fileOf(path, "");
    if (!file) { ctx.app.workspace.openLinkText(path, "", false); return; }
    if (!win) { parts = build(); win = parts.el; }
    parts.path = file.path;
    if (history[history.length - 1] !== file.path) history.push(file.path);
    parts.back.style.display = history.length > 1 ? "" : "none";
    const post = postOf(file.path);
    parts.title.textContent = (post && post.title) || file.basename || file.path;
    parts.editBtn.onclick = null;
    parts.editBtn.addEventListener("click", (e) => { const p = file.path; close(); ctx.app.workspace.openLinkText(p, "", !!(e && (e.ctrlKey || e.metaKey)) || !!ctx.store.get().openInNewTab); });
    // шапка: дата и теги (без ссылок вперёд/назад)
    clear(parts.meta);
    if (post) {
      parts.meta.append(h("span", { class: "sf-npop__date" }, fmtDateTime(post.ts, post.hasTime)));
      for (const t of post.tags.slice(0, 8)) parts.meta.append(h("a", { class: "sf-chip sf-chip--tag is-clickable", href: "#", onClick: (e) => { e.preventDefault(); ctx.actions.tagClick(t); } }, "#" + t));
    }
    clear(parts.body);
    parts.body.append(h("div", { class: "sf-skeleton" }, h("i"), h("i"), h("i")));
    const my = (parts.token = (parts.token || 0) + 1);
    try {
      const raw = await ctx.app.vault.cachedRead(file);
      if (!win || parts.token !== my) return;
      clear(parts.body);
      await ctx.md.render(stripFrontmatter(raw), parts.body, file.path);
      if (parts.body.scrollTop) parts.body.scrollTop = 0;
    } catch (e) {
      console.error("[journal-stream] окно просмотра", e);
      if (win) { clear(parts.body); parts.body.append(h("div", { class: "sf-media-missing" }, "Не удалось прочитать заметку")); }
    }
  }

  ctx.onDispose(close);
  return { open: (linktext, source) => show(fileOf(linktext, source) ? fileOf(linktext, source).path : linktext), close, isOpen: () => !!win, el: () => overlay };
};

},
"ui/common/rich-link": function (module, exports, require) {
// ui/common/rich-link.js — превью-ссылка на заметку: иконка типа, заголовок, пара строк текста, дата и связи.
// Возвращённый элемент имеет метод setExcerpt(text) — текст подгружается позже, когда прочитана заметка.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const types = require("types");
const { fmtDateTime } = require("lib/date");
const { plural } = require("lib/ru");

module.exports = function richLink(ctx, post, { excerpt } = {}) {
  const t = types.get(post.type);
  const meta = [fmtDateTime(post.ts, post.hasTime)];
  if (post.backlinks && !ctx.store.get().popupView) meta.push(`${post.backlinks} ${plural(post.backlinks, ["связь", "связи", "связей"])}`);
  const ex = h("span", { class: "sf-richlink__excerpt" }, excerpt || "");
  const el = h("a", { class: ["sf-richlink", `sf-richlink--${t.id}`], href: "#", "data-href": post.path, onClick: (e) => { e.preventDefault(); e.stopPropagation(); ctx.openNote(post.path, e); } },
    h("span", { class: "sf-richlink__icon" }, icon(t.icon, { size: 16 })),
    h("span", { class: "sf-richlink__main" }, h("span", { class: "sf-richlink__title" }, post.title), ex, h("span", { class: "sf-richlink__meta" }, meta.join(" · "))),
    h("span", { class: "sf-richlink__out" }, icon("arrowUpRight", { size: 14 })));
  el.setExcerpt = (text) => { ex.textContent = text || ""; };
  return el;
};

},
"ui/common/scroll-top": function (module, exports, require) {
// ui/common/scroll-top.js — плавающая кнопка «Наверх».
// Раньше была position: sticky внутри виджета — она ломалась, если у какого-то родителя есть overflow (sticky цепляется за него,
// а не за прокручиваемую область заметки). Теперь кнопка — position: fixed в <body>, а её положение (правый нижний угол
// ПРОКРУЧИВАЕМОЙ области заметки) считается из координат контейнера прокрутки. Появляется после прокрутки вниз на 400px.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");

const SHOW_AFTER = 400;

module.exports = function scrollTopButton(ctx) {
  const reg = (window.__sfFab = window.__sfFab || {});
  if (reg[ctx.scrollKey]) reg[ctx.scrollKey].remove();   // при перерисовке блока не плодим кнопки

  const wrap = h("div", { class: "sf-fab is-hidden", dataset: { sfTheme: ctx.store.get().theme } },
    h("button", { type: "button", class: "sf-fab__btn", title: "Наверх", "aria-label": "Прокрутить вверх", onClick: () => ctx.scroll.toTop() }, icon("arrowUp", { size: 18 })));
  document.body.appendChild(wrap);
  reg[ctx.scrollKey] = wrap;

  function place(top) {
    const sc = ctx.scroll.scroller();
    const alive = ctx.rootEl && ctx.rootEl.isConnected !== false;
    const y = typeof top === "number" ? top : sc ? sc.scrollTop : 0;
    if (sc && sc.getBoundingClientRect) {
      const r = sc.getBoundingClientRect();
      const vw = window.innerWidth || 0, vh = window.innerHeight || 0;
      if (r.width && vw) { wrap.style.right = Math.max(8, vw - r.right + 16) + "px"; wrap.style.bottom = Math.max(8, vh - r.bottom + 20) + "px"; }
    }
    wrap.classList.toggle("is-hidden", !(alive && sc && y > SHOW_AFTER));
  }
  ctx.scroll.onScroll(place);
  const onResize = () => place();
  if (window.addEventListener) window.addEventListener("resize", onResize);
  ctx.store.subscribe((s) => { wrap.dataset.sfTheme = s.theme; }, ["theme"]);
  // Виджет исчез (ушли в другую заметку) — убираем кнопку; пока жив — подстраиваем положение (панели могут сдвигаться)
  const timer = setInterval(() => {
    if (ctx.rootEl && ctx.rootEl.isConnected === false) { wrap.remove(); clearInterval(timer); } else place();
  }, 1000);
  if (ctx.onDispose) ctx.onDispose(() => { clearInterval(timer); wrap.remove(); if (window.removeEventListener) window.removeEventListener("resize", onResize); if (reg[ctx.scrollKey] === wrap) delete reg[ctx.scrollKey]; });
  return wrap;
};

},
"ui/common/segmented": function (module, exports, require) {
// ui/common/segmented.js — переключатель-сегменты (Masonry / Flow / Timeline).
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
module.exports = function segmented({ options, value, onChange }) {
  return h("div", { class: "sf-segmented", role: "tablist" },
    options.map((o) => h("button", { type: "button", role: "tab", class: ["sf-segmented__btn", o.id === value && "is-active"], onClick: () => onChange(o.id) }, o.icon && icon(o.icon, { size: 14 }), h("span", null, o.label))));
};

},
"ui/common/select": function (module, exports, require) {
// ui/common/select.js — нативный select со стилями темы.
const { h } = require("lib/dom");
module.exports = function select({ options, value, onChange, title }) {
  const el = h("select", { class: "sf-select", title, onChange: (e) => onChange(e.target.value) },
    options.map((o) => h("option", { value: o.id, selected: o.id === value }, o.label)));
  return el;
};

},
"ui/common/settings-modal": function (module, exports, require) {
// ui/common/settings-modal.js — «Настройки» в модальном окне (мобильная версия): вид, тема, открытие заметок, ширина, версия.
// На телефоне эти переключатели не занимают место в шапке — там остаются только разделы.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const openModal = require("ui/common/modal");
const { VERSION, RELEASED } = require("app/version");

const KEYS = ["viewMode", "theme", "openInNewTab", "popupView", "fullWidth"];

module.exports = function openSettingsModal(ctx) {
  const modal = openModal(ctx, { title: "Настройки" });
  const pills = (options, value, onPick) => h("div", { class: "sf-msec__row" }, options.map(([id, label, ic]) =>
    h("button", { type: "button", class: ["sf-sortbtn", id === value && "is-asc"], onClick: () => onPick(id) }, ic && icon(ic, { size: 14 }), h("span", null, label))));
  const toggle = (label, on, onClick, ic) => h("button", { type: "button", class: ["sf-setrow", on && "is-on"], role: "switch", "aria-checked": on ? "true" : "false", onClick },
    icon(ic, { size: 16 }), h("span", { class: "sf-setrow__label" }, label), h("span", { class: "sf-setrow__state" }, on ? "Вкл" : "Выкл"));
  const section = (title, ...c) => h("section", { class: "sf-msec" }, h("h3", { class: "sf-msec__title" }, title), ...c);

  function draw() {
    const s = ctx.store.get();
    clear(modal.body);
    modal.body.append(
      section("Вид", pills([["auto", "Авто"], ["mobile", "Мобильный", "phone"], ["desktop", "Десктопный", "monitor"]], s.viewMode || "auto", (m) => ctx.actions.setViewModeTo(m))),
      section("Тема", pills([["auto", "Как в Obsidian"], ["light", "Светлая", "sun"], ["dark", "Тёмная", "moon"]], s.theme, (t) => ctx.actions.setTheme(t))),
      section("Заметки", toggle("Плавающее окно просмотра", s.popupView, () => ctx.actions.setPopupView(!s.popupView), "eye"),
        toggle("Открывать в новой вкладке", s.openInNewTab, () => ctx.actions.setOpenInNewTab(!s.openInNewTab), "newtab"),
        toggle("Страница на всю ширину", s.fullWidth, () => ctx.actions.setFullWidth(!s.fullWidth), "expand")),
      section("О виджете", h("a", { class: "sf-setrow", href: "#", onClick: (e) => { e.preventDefault(); modal.close(); ctx.openChangelog(); } },
        icon("file", { size: 16 }), h("span", { class: "sf-setrow__label" }, `Journal Stream v${VERSION}`), h("span", { class: "sf-setrow__state" }, `${RELEASED} · что нового`))));
  }
  draw();
  const off = ctx.store.subscribe(draw, KEYS);
  modal.footer.append(h("button", { type: "button", class: "sf-btn sf-btn--primary sf-modal__show", onClick: () => modal.close() }, "Готово"));
  modal.onClose(off);
  return modal;
};

},
"ui/common/skeleton": function (module, exports, require) {
// ui/common/skeleton.js — шиммеры карточек на время загрузки (вместо пустого места).
const { h } = require("lib/dom");
const { columnCount } = require("lib/layout");

// Набор «форм» карточек: разная высота, чтобы заглушка напоминала настоящую ленту.
const SHAPES = [
  { media: false, lines: 4 }, { media: true, lines: 2 }, { media: false, lines: 2 }, { media: false, lines: 5 }, { media: true, lines: 3 }, { media: false, lines: 3 },
];

function skeletonCard(shape) {
  const line = (w) => h("i", { class: "sf-shim", style: { width: w } });
  return h("div", { class: "sf-skelcard" },
    h("div", { class: "sf-skelcard__row" }, line("38%"), h("i", { class: "sf-shim sf-shim--pill" })),
    line("72%"),
    shape.media && h("i", { class: "sf-shim sf-shim--media" }),
    Array.from({ length: shape.lines }, (_, i) => line(i === shape.lines - 1 ? "55%" : "100%")),
    h("div", { class: "sf-skelcard__row" }, h("i", { class: "sf-shim sf-shim--pill" }), h("i", { class: "sf-shim sf-shim--pill" })));
}

// count карточек в колонках, как будет в ленте (config.columns; на телефоне одна колонка)
module.exports = function skeletonGrid(ctx, { count = 6 } = {}) {
  const w = (ctx.rootEl && ctx.rootEl.clientWidth) || 0;
  const cols = columnCount(w, ctx.config, 24);
  const grid = h("div", { class: "sf-skelgrid", "aria-hidden": "true", style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } });
  for (let i = 0; i < count; i++) grid.append(skeletonCard(SHAPES[i % SHAPES.length]));
  return grid;
};

},
"ui/common/toast": function (module, exports, require) {
// ui/common/toast.js — доступ к всплывающему уведомлению из контекста.
module.exports = (ctx, text) => (ctx.toast ? ctx.toast(text) : console.log("[journal-stream]", text));

},
"ui/common/version-badge": function (module, exports, require) {
// ui/common/version-badge.js — бейдж версии на странице: «v1.0.0», по клику открывает окно «История версий» (из README плагина).
const { h } = require("lib/dom");
const { VERSION, RELEASED } = require("app/version");

module.exports = function versionBadge(ctx, { cls = "" } = {}) {
  return h("a", { class: ["sf-version", cls], href: "#", title: `Journal Stream v${VERSION} (${RELEASED}) — история версий`,
    onClick: (e) => { e.preventDefault(); e.stopPropagation(); ctx.openChangelog(); } }, "v" + VERSION);
};

},
"ui/feed/bento": function (module, exports, require) {
// ui/feed/bento.js — Bento: та же сетка, но видео и canvas занимают две колонки.
const tileGrid = require("ui/feed/tile-grid");
const isWide = (card) => !!(card && card.classList && (card.classList.contains("sf-card--video") || card.classList.contains("sf-card--canvas")));
module.exports = (ctx, cards) => tileGrid(ctx, cards, { variant: "bento", wide: isWide });

},
"ui/feed/feed": function (module, exports, require) {
// ui/feed/feed.js — лента: masonry | timeline | bento (+ пагинация «Показать ещё»).
const { h } = require("lib/dom");
const createCard = require("ui/card/card");
const groupByDay = require("ui/feed/groups");
const loadMore = require("ui/feed/load-more");
const masonry = require("ui/feed/masonry");
const bento = require("ui/feed/bento");
const empty = require("ui/common/empty");
const { toTokens } = require("filters/formula");

module.exports = function feed(ctx, { posts, layout, page }) {
  layout = layout === "flow" ? "timeline" : layout;
  const wrap = h("section", { class: ["sf-feed", `sf-feed--${layout}`] });
  const parts = [];
  wrap.sfDispose = () => parts.forEach((p) => p.sfDispose && p.sfDispose());

  if (!posts.length) {
    const st = ctx.store.get(), act = [];
    if (st.quick !== "all") act.push("режим «" + ({ today: "В этот день", random: "Рандомные", favorites: "Избранное" }[st.quick] || st.quick) + "»");
    act.push(...toTokens(st.filter).filter((t) => t.t !== "paren" && t.t !== "op").map((t) => t.v));
    wrap.append(empty({ title: "Ничего не найдено", hint: act.length ? "Сейчас применено: " + act.join(" · ") : "В выбранных источниках нет заметок.", action: h("button", { type: "button", class: "sf-btn", onClick: () => ctx.actions.resetFilter() }, "Сбросить фильтры") }));
    return wrap;
  }
  const mobile = !!(ctx.rootEl && ctx.rootEl.classList.contains("is-mobile"));
  const visible = posts.slice(0, (mobile ? ctx.config.pageSizeMobile || 12 : ctx.config.pageSize) * page);

  if (layout === "timeline") {
    // Timeline: колонка по дням; внутри дня — по две карточки в ряд одинаковой высоты, а если не помещаются — по одной.
    for (const g of groupByDay(visible)) {
      wrap.append(h("div", { class: "sf-timeline__group" },
        h("div", { class: "sf-timeline__label" }, h("span", { class: "sf-timeline__dot" }), g.label, h("span", { class: "sf-timeline__key" }, g.date)),
        h("div", { class: "sf-timeline__items" }, g.posts.map((p) => createCard(ctx, p)))));
    }
  } else {
    const cards = visible.map((p) => createCard(ctx, p));
    const grid = layout === "bento" ? bento(ctx, cards) : masonry(ctx, cards);
    parts.push(grid);
    wrap.append(grid);
  }
  if (posts.length > visible.length) wrap.append(loadMore({ remaining: posts.length - visible.length, onClick: () => ctx.actions.nextPage() }));
  return wrap;
};

},
"ui/feed/groups": function (module, exports, require) {
// ui/feed/groups.js — группировка постов по дню (для Timeline).
const { dayKey, relativeLabel, fmtDateLong } = require("lib/date");
module.exports = function groupByDay(posts, now = Date.now()) {
  const groups = [], idx = new Map();
  for (const p of posts) {
    const k = dayKey(p.ts);
    if (!idx.has(k)) { const g = { key: k, label: relativeLabel(p.ts, now, false), date: fmtDateLong(p.ts), posts: [] }; idx.set(k, g); groups.push(g); }
    idx.get(k).posts.push(p);
  }
  return groups;
};

},
"ui/feed/layouts": function (module, exports, require) {
// ui/feed/layouts.js — раскладки экрана «Лента». (Flow убран: он повторял Timeline; старое значение "flow" читается как timeline.)
const LAYOUTS = [
  { id: "masonry", label: "Masonry", icon: "grid" },
  { id: "timeline", label: "Timeline", icon: "timeline" },
];
module.exports = { LAYOUTS };

},
"ui/feed/load-more": function (module, exports, require) {
// ui/feed/load-more.js — кнопка «Показать ещё N».
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
module.exports = function loadMore({ remaining, onClick }) {
  return h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-loadmore", onClick }, icon("chevron", { size: 14 }), `Показать ещё ${remaining}`);
};

},
"ui/feed/masonry": function (module, exports, require) {
// ui/feed/masonry.js — Masonry: равные колонки, карточки разной высоты.
const tileGrid = require("ui/feed/tile-grid");
module.exports = (ctx, cards) => tileGrid(ctx, cards, { variant: "masonry", wide: () => false });

},
"ui/feed/mobile-bar": function (module, exports, require) {
// ui/feed/mobile-bar.js — мобильная шапка ленты/бенто: кнопка «Фильтры (N)» (открывает все фильтры в модальном окне),
// число заметок и краткая сводка применённых условий. Всё остальное (поиск, подборки, теги…) — внутри окна.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { summarize } = require("filters/summary");
const { withUnit } = require("lib/ru");
const openFiltersModal = require("ui/filters/filters-modal");

const MAX_CHIPS = 4;

module.exports = function mobileBar(ctx, { posts, withLayouts, onRefresh }) {
  let count = 0;
  const subs = new Set();
  const badge = h("span", { class: "sf-panel__badge" });
  const countEl = h("span", { class: "sf-count-pill" });
  const summaryEl = h("div", { class: "sf-msummary", role: "button", tabindex: "0" });
  const open = () => openFiltersModal(ctx, { posts, withLayouts, onRefresh, getCount: () => count, onCount: (cb) => { subs.add(cb); return () => subs.delete(cb); } });
  const btn = h("button", { type: "button", class: "sf-mfilter", onClick: open }, icon("filter", { size: 16 }), "Фильтры", badge);
  summaryEl.addEventListener("click", open);

  function draw() {
    const s = ctx.store.get(), preset = s.presetId && ctx.presets.get(s.presetId);
    const items = summarize(s, { presetName: preset && preset.name });
    const applied = items.filter((t) => !/^(Старые сначала)$/.test(t)).length;
    badge.textContent = applied || ""; badge.style.display = applied ? "" : "none";
    clear(summaryEl);
    if (!items.length) summaryEl.append(h("span", { class: "sf-msummary__none" }, "Без фильтров · сначала новые"));
    items.slice(0, MAX_CHIPS).forEach((t) => summaryEl.append(h("span", { class: "sf-sumchip" }, t)));
    if (items.length > MAX_CHIPS) summaryEl.append(h("span", { class: "sf-sumchip sf-sumchip--more" }, `+${items.length - MAX_CHIPS}`));
  }
  draw();
  const off = ctx.store.subscribe(draw, ["filter", "quick", "presetId"]);

  const el = h("div", { class: "sf-mbar" }, h("div", { class: "sf-mbar__row" }, btn, countEl), summaryEl);
  return {
    el,
    setCount(n) { count = n; countEl.textContent = withUnit(n, ["заметка", "заметки", "заметок"]); subs.forEach((cb) => cb(n)); },
    dispose: () => off(),
  };
};

},
"ui/feed/sort-toggle": function (module, exports, require) {
// ui/feed/sort-toggle.js — переключатель порядка по времени: «Новые ↓» (по умолчанию, date-desc) / «Старые ↑» (date-asc).
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");

module.exports = function sortToggle(ctx) {
  const btn = h("button", { type: "button", class: "sf-sortbtn", onClick: () => ctx.actions.toggleSortDir() });
  function draw() {
    clear(btn);
    const sort = ctx.store.get().filter.sort, asc = sort === "date-asc", other = sort !== "date-desc" && !asc;
    btn.classList.toggle("is-asc", asc);
    btn.title = asc ? "Сначала старые — нажмите, чтобы показать сначала новые" : "Сначала новые — нажмите, чтобы показать сначала старые";
    btn.append(icon(asc ? "arrowUp" : "arrowDown", { size: 14 }), h("span", null, asc ? "Старые" : other ? "По дате" : "Новые"));
  }
  draw();
  return { el: btn, dispose: ctx.store.subscribe(draw, ["filter"]) };
};

},
"ui/feed/tile-grid": function (module, exports, require) {
// ui/feed/tile-grid.js — общий движок плиток для Masonry, Bento и «Подборок».
// Плитки позиционируются абсолютно: у каждой своя высота, а «строка» не равна самой высокой плитке.
// Порядок — слева направо, потом сверху вниз: плитка занимает самую короткую колонку, а при равенстве
// (в пределах допуска) — самую левую. «Широкая» плитка (wide) занимает две соседние колонки.
const { h } = require("lib/dom");
const { columnCount } = require("lib/layout");
const skeletonGrid = require("ui/common/skeleton");

const TOLERANCE = 14;

module.exports = function tileGrid(ctx, cards, { wide = () => false, variant = "masonry" } = {}) {
  const items = cards.map((c) => h("div", { class: "sf-tilegrid__item" }, c));
  const skel = skeletonGrid(ctx, { count: Math.min(items.length, 6) });
  const el = h("div", { class: ["sf-tilegrid", "is-pending", `sf-tilegrid--${variant}`] }, skel, items);
  let dead = false, raf = null, ro = null, iro = null, lastW = 0;
  const width = () => el.clientWidth || (el.parentNode && el.parentNode.clientWidth) || 0;

  function layout() {
    raf = null;
    const W = width();
    if (dead || !W) return;
    const GAP = W < (ctx.config.singleColumnBelow ?? 560) ? 14 : 24;
    const cols = columnCount(W, ctx.config, GAP);
    const colW = (W - GAP * (cols - 1)) / cols;
    const hs = new Array(cols).fill(0);

    for (const item of items) {
      const span = Math.min(cols, wide(item.firstChild) ? 2 : 1);
      // лучшая стартовая колонка: минимальная «верхняя точка», при равенстве (допуск) — левее
      let best = 0, bestTop = Infinity;
      for (let c = 0; c + span <= cols; c++) {
        const top = Math.max(...hs.slice(c, c + span));
        if (top < bestTop - TOLERANCE) { best = c; bestTop = top; }
      }
      const w = colW * span + GAP * (span - 1);
      item.style.width = w + "px";
      item.style.left = best * (colW + GAP) + "px";
      item.style.top = bestTop + "px";
      const hgt = item.offsetHeight || 0;
      for (let k = 0; k < span; k++) hs[best + k] = bestTop + hgt + GAP;
    }
    el.style.height = Math.max(0, Math.max(...hs) - GAP) + "px";
    if (el.classList.contains("is-pending")) { el.classList.remove("is-pending"); skel.remove(); } // первая раскладка готова — шиммеры не нужны
  }
  const schedule = () => {
    if (dead || raf) return;
    raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(layout) : setTimeout(layout, 16);
  };

  cards.forEach((c) => c.sfReady && c.sfReady.then(schedule));
  if (typeof ResizeObserver !== "undefined") {
    // контейнер: реагируем только на смену ширины; плитки: на смену собственной высоты (картинки, подгрузка текста, «Показать ещё»)
    ro = new ResizeObserver(() => { const w = width(); if (w !== lastW) { lastW = w; schedule(); } });
    ro.observe(el);
    iro = new ResizeObserver(schedule);
    items.forEach((i) => iro.observe(i));
  }
  setTimeout(schedule, 0);
  setTimeout(schedule, 700);
  el.sfDispose = () => { dead = true; if (ro) ro.disconnect(); if (iro) iro.disconnect(); };
  el.sfRelayout = schedule;
  return el;
};

},
"ui/feed/toolbar": function (module, exports, require) {
// ui/feed/toolbar.js — шапка экрана как в dashboard: «Vault / …» + заголовок со счётчиком; справа — поиск, подборки,
// раскладки, обновление.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const segmented = require("ui/common/segmented");
const iconButton = require("ui/common/icon-button");
const searchBar = require("ui/filters/search-bar");
const presetsMenu = require("ui/filters/presets-menu");
const sortToggle = require("ui/feed/sort-toggle");
const { LAYOUTS } = require("ui/feed/layouts");
const { withUnit } = require("lib/ru");
const { fmtTime } = require("lib/date");

module.exports = function toolbar(ctx, { title, posts, withLayouts, onRefresh }) {
  const el = h("div", { class: "sf-toolbar" });
  const counter = h("span", { class: "sf-counter__n" });
  const search = searchBar(ctx, { posts });
  const menu = presetsMenu(ctx, { posts });
  const sort = sortToggle(ctx);
  const counterEl = h("span", { class: "sf-count-pill" }, counter);
  const stamp = fmtTime(Date.now());

  function draw() {
    clear(el);
    const layout = ctx.store.get().layout;
    el.append(
      h("div", { class: "sf-toolbar__title" },
        h("div", { class: "sf-crumbs" }, h("span", { class: "sf-crumbs__dot" }), "Vault / Journal Stream", h("span", { class: "sf-crumbs__sep" }, "·"), h("span", { class: "sf-crumbs__sync" }, icon("refresh", { size: 12 }), `Обновлено ${stamp}`)),
        h("div", { class: "sf-toolbar__h1" }, h("h1", null, title), counterEl)),
      h("div", { class: "sf-toolbar__controls" },
        search.el, menu.el, sort.el,
        withLayouts && segmented({ options: LAYOUTS, value: layout === "flow" ? "timeline" : layout, onChange: (id) => ctx.actions.setLayout(id) }),
        iconButton({ name: "refresh", title: "Перечитать хранилище", onClick: onRefresh })));
  }
  const setCount = (n) => { counter.textContent = withUnit(n, ["заметка", "заметки", "заметок"]); };
  draw();
  const unsub = withLayouts ? ctx.store.subscribe(draw, ["layout"]) : () => {};
  return { el, setCount, dispose: () => { unsub(); search.dispose(); sort.dispose(); menu.close(); } };
};

},
"ui/filters/advanced": function (module, exports, require) {
// ui/filters/advanced.js — расширенные условия: поиск, период, порог связей, сортировка, источники.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { PERIODS } = require("filters/periods");
const { SORTS } = require("filters/sorters");
const select = require("ui/common/select");
const chip = require("ui/common/chip");
const { debounce } = require("lib/async");

module.exports = function advanced(ctx, { withSearch = false } = {}) {
  const el = h("div", { class: "sf-advanced" });
  const setText = debounce((v) => ctx.actions.setFilter({ text: v }), 250);
  function draw() {
    clear(el);
    const f = ctx.store.get().filter;
    const search = h("div", { class: "sf-field sf-field--grow" }, h("label", null, "Поиск"), h("div", { class: "sf-input-wrap" }, icon("search", { size: 14 }),
      h("input", { class: "sf-input", type: "search", placeholder: "в заголовках, тегах и тексте", value: f.text, onInput: (e) => setText(e.target.value) })));
    const period = h("div", { class: "sf-field" }, h("label", null, "Период"), select({ options: PERIODS, value: f.period, onChange: (v) => ctx.actions.setFilter({ period: v }) }));
    const val = h("span", { class: "sf-range__val" }, f.minBacklinks > 0 ? `≥ ${f.minBacklinks}` : "любое");
    const range = h("input", { class: "sf-range", type: "range", min: 0, max: 15, step: 1, value: f.minBacklinks, onInput: (e) => { val.textContent = +e.target.value > 0 ? `≥ ${e.target.value}` : "любое"; }, onChange: (e) => ctx.actions.setFilter({ minBacklinks: +e.target.value }) });
    const links = h("div", { class: "sf-field" }, h("label", null, "Бэклинки"), h("div", { class: "sf-range-wrap" }, range, val));
    const sort = h("div", { class: "sf-field" }, h("label", null, "Сортировка"), select({ options: SORTS, value: f.sort, onChange: (v) => ctx.actions.setFilter({ sort: v }) }));
    el.append(...(withSearch ? [search] : []), period, links, sort);
    const sources = ctx.config.sources.filter((s) => s.enabled !== false);
    if (sources.length > 1) el.append(h("div", { class: "sf-field" }, h("label", null, "Источники"), h("div", { class: "sf-field__chips" }, sources.map((s) => chip({ text: s.label, kind: "attr", active: f.sources.includes(s.id), onClick: () => ctx.actions.toggleSource(s.id) })))));
  }
  draw();
  // Перерисовываем только при внешней смене фильтра, а не при вводе (чтобы не терять фокус поля поиска).
  let lastText = ctx.store.get().filter.text;
  const dispose = ctx.store.subscribe((s) => { if (s.filter.text !== lastText && document.activeElement && el.contains(document.activeElement)) { lastText = s.filter.text; return; } lastText = s.filter.text; draw(); }, ["filter"]);
  return { el, dispose };
};

},
"ui/filters/attr-toggles": function (module, exports, require) {
// ui/filters/attr-toggles.js — атрибуты заметок (С медиа / Фото / Видео / Аудио / Цитаты / Задачи / Со ссылками).
// Раньше рядом был ещё ряд «Тип» — он дублировал атрибуты и убран.
const { h, clear } = require("lib/dom");
const { ATTRS } = require("filters/attrs");
const chip = require("ui/common/chip");

module.exports = function attrToggles(ctx) {
  const el = h("div", { class: "sf-attrs" });
  function draw() {
    clear(el);
    const f = ctx.store.get().filter;
    el.append(h("span", { class: "sf-attrs__label" }, "Атрибуты:"));
    for (const a of ATTRS) el.append(chip({ text: a.label, kind: "attr", iconName: a.icon, active: f.attrs.includes(a.id), onClick: () => ctx.actions.toggleAttr(a.id) }));
  }
  draw();
  const dispose = ctx.store.subscribe(draw, ["filter"]);
  return { el, dispose };
};

},
"ui/filters/filter-panel": function (module, exports, require) {
// ui/filters/filter-panel.js — сборка панели фильтров. variant: "stream" (сворачиваемая) | "studio" (всё раскрыто).
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const formulaBar = require("ui/filters/formula-bar");
const tagBuilder = require("ui/filters/tag-builder");
const attrToggles = require("ui/filters/attr-toggles");
const advanced = require("ui/filters/advanced");
const searchBar = require("ui/filters/search-bar");
const { toTokens } = require("filters/formula");

module.exports = function filterPanel(ctx, { posts, variant = "stream" }) {
  const el = h("section", { class: ["sf-panel", `sf-panel--${variant}`] });
  const parts = [formulaBar(ctx), tagBuilder(ctx, { posts }), attrToggles(ctx), advanced(ctx)];
  const [formula, tags, attrs, adv] = parts;
  // В конструкторе строка поиска — первой в панели (в ленте и бенто она в шапке экрана)
  const search = variant === "studio" ? searchBar(ctx, { posts, cls: "sf-search--panel" }) : null;
  if (search) parts.push(search);
  let showAdv = variant === "studio";

  const toggle = h("button", { type: "button", class: "sf-iconbtn sf-panel__toggle" });
  const details = h("div", { class: "sf-panel__details" }, tags.el, attrs.el, adv.el);
  const advWrap = adv.el;

  const isMobile = () => !!(ctx.rootEl && ctx.rootEl.classList.contains("is-mobile"));
  // collapsed: null = авто (на телефоне свёрнута, на десктопе развёрнута), true/false — выбор пользователя
  const isCollapsed = () => { if (variant !== "stream") return false; const c = ctx.store.get().collapsed; return c === null || c === undefined ? isMobile() : c; };
  const activeCount = () => toTokens(ctx.store.get().filter).filter((t) => t.t !== "paren" && t.t !== "op").length + (ctx.store.get().quick !== "all" ? 1 : 0);

  function draw() {
    const collapsed = isCollapsed();
    el.classList.toggle("is-collapsed", collapsed);
    advWrap.style.display = showAdv ? "" : "none";
    clear(toggle);
    const n = activeCount();
    if (isMobile()) toggle.append(icon("filter", { size: 14 }), "Фильтры", n > 0 && h("span", { class: "sf-panel__badge" }, n), icon("chevron", { size: 13, cls: collapsed ? "" : "sf-flip" }));
    else { toggle.append(icon("chevron", { size: 14, cls: collapsed ? "" : "sf-flip" })); toggle.title = collapsed ? "Развернуть панель" : "Свернуть панель"; } // на десктопе — только иконка
  }
  toggle.addEventListener("click", () => ctx.actions.setCollapsed(!isCollapsed()));
  const advBtn = h("button", { type: "button", class: "sf-iconbtn", title: "Расширенные условия", "aria-label": "Расширенные условия", onClick: () => { showAdv = !showAdv; draw(); } }, icon("sliders", { size: 15 }));

  const head = h("div", { class: "sf-panel__head" }, formula.el, variant === "stream" ? h("div", { class: "sf-panel__actions" }, advBtn, toggle) : null);
  el.append(...(search ? [h("div", { class: "sf-panel__search" }, search.el)] : []), head, details);
  draw();
  const unsub = ctx.store.subscribe(draw, ["collapsed", "filter", "quick"]);
  return { el, dispose: () => { unsub(); parts.forEach((p) => p.dispose()); } };
};

},
"ui/filters/filters-modal": function (module, exports, require) {
// ui/filters/filters-modal.js — «Фильтры» в модальном окне (мобильная версия): поиск и даты, режим, подборки, теги, атрибуты,
// условия, порядок и вид. Фильтры применяются сразу; «Показать N» закрывает окно.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const openModal = require("ui/common/modal");
const searchBar = require("ui/filters/search-bar");
const quickbar = require("ui/filters/quickbar");
const presetsMenu = require("ui/filters/presets-menu");
const tagBuilder = require("ui/filters/tag-builder");
const attrToggles = require("ui/filters/attr-toggles");
const advanced = require("ui/filters/advanced");
const formulaBar = require("ui/filters/formula-bar");
const sortToggle = require("ui/feed/sort-toggle");
const segmented = require("ui/common/segmented");
const { LAYOUTS } = require("ui/feed/layouts");
const { withUnit } = require("lib/ru");

const section = (title, ...children) => h("section", { class: "sf-msec" }, h("h3", { class: "sf-msec__title" }, title), ...children);

// onCount(cb) — подписка на число найденных заметок (возвращает функцию отписки); getCount() — текущее значение
module.exports = function openFiltersModal(ctx, { posts, withLayouts, onRefresh, getCount, onCount }) {
  const modal = openModal(ctx, { title: "Фильтры" });
  const parts = [formulaBar(ctx), searchBar(ctx, { posts, cls: "sf-search--modal" }), quickbar(ctx, { posts }), presetsMenu(ctx, { posts }), tagBuilder(ctx, { posts }), attrToggles(ctx), advanced(ctx), sortToggle(ctx)];
  const [formula, search, quick, presets, tags, attrs, adv, sort] = parts;

  const layoutRow = h("div", { class: "sf-msec__row" }, sort.el);
  let unLayout = () => {};
  if (withLayouts) {
    const draw = () => { const old = layoutRow.querySelector ? layoutRow.querySelector(".sf-segmented") : null; if (old) old.remove(); layoutRow.append(segmented({ options: LAYOUTS, value: ctx.store.get().layout, onChange: (id) => ctx.actions.setLayout(id) })); };
    draw(); unLayout = ctx.store.subscribe(draw, ["layout"]);
  }

  modal.body.append(
    section("Применено", formula.el),
    section("Поиск и даты", search.el),
    section("Режим", quick.el),
    section("Подборки", presets.el),
    section("Теги", tags.el),
    section("Атрибуты", attrs.el),
    section("Условия", adv.el),
    section("Порядок и вид", layoutRow));

  const showBtn = h("button", { type: "button", class: "sf-btn sf-btn--primary sf-modal__show", onClick: () => modal.close() });
  const drawShow = () => { showBtn.textContent = `Показать ${withUnit(getCount(), ["заметку", "заметки", "заметок"])}`; };
  drawShow();
  const offCount = onCount(drawShow);
  modal.footer.append(
    h("button", { type: "button", class: "sf-btn sf-btn--ghost", onClick: () => ctx.actions.resetFilter() }, icon("refresh", { size: 14 }), "Сбросить"),
    h("button", { type: "button", class: "sf-iconbtn sf-modal__refresh", title: "Перечитать хранилище", "aria-label": "Перечитать хранилище", onClick: () => { modal.close(); onRefresh(); } }, icon("refresh", { size: 16 })),
    showBtn);

  modal.onClose(() => { offCount(); unLayout(); parts.forEach((p) => p.dispose && p.dispose()); presets.close && presets.close(); });
  return modal;
};

},
"ui/filters/formula-bar": function (module, exports, require) {
// ui/filters/formula-bar.js — живая формула фильтра с чипами, которые можно удалять.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { toTokens } = require("filters/formula");
const { isDefault, defaultFilter } = require("filters/state");
const chip = require("ui/common/chip");

module.exports = function formulaBar(ctx) {
  const el = h("div", { class: "sf-formula" });
  const DEFAULTS = { period: "all", minBacklinks: 0, day: "", text: "", dateFrom: "", dateTo: "" };
  function removeCond(t) {
    if (t.key === "types") ctx.actions.toggleType(t.item);
    else if (t.key === "sources") ctx.actions.toggleSource(t.item);
    else ctx.actions.setFilter({ [t.key]: DEFAULTS[t.key] });
  }
  function draw() {
    clear(el);
    const f = ctx.store.get().filter, tokens = toTokens(f);
    const body = h("div", { class: "sf-formula__body" });
    const st = ctx.store.get(), preset = st.presetId && ctx.presets.get(st.presetId);
    if (preset) body.append(chip({ text: "подборка: " + preset.name, kind: "rule", active: true, onRemove: () => ctx.actions.resetFilter() }));
    if (st.quick !== "all") body.append(chip({ text: "режим: " + ({ today: "в этот день", random: "рандом", favorites: "избранное" }[st.quick] || st.quick), kind: "rule", active: true, onRemove: () => ctx.actions.setQuick("all") }));
    if (!tokens.length && !preset && st.quick === "all") body.append(h("span", { class: "sf-formula__empty" }, "без условий — выберите теги ниже"));
    for (const t of tokens) {
      if (t.t === "paren") body.append(h("span", { class: "sf-formula__paren" }, t.v));
      else if (t.t === "op") body.append(h("span", { class: ["sf-formula__op", `sf-formula__op--${t.v.toLowerCase()}`] }, t.v));
      else if (t.t === "tag") body.append(chip({ text: t.v, kind: t.mode === "not" ? "not" : "tag", active: true, onRemove: () => ctx.actions.removeTag(t.tag) }));
      else if (t.t === "cond") body.append(chip({ text: t.v, kind: "attr", active: true, onRemove: () => removeCond(t) }));
      else body.append(chip({ text: t.v, kind: "attr", active: true, onRemove: () => ctx.actions.toggleAttr(t.attr) }));
    }
    el.append(body);
    if (!isDefault(f) || ctx.store.get().quick !== "all") el.append(h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-btn--sm", onClick: () => ctx.actions.setFilter(defaultFilter()) }, icon("refresh", { size: 13 }), "Сбросить"));
  }
  draw();
  const dispose = ctx.store.subscribe(draw, ["filter", "quick", "presetId"]);
  return { el, dispose };
};

},
"ui/filters/presets-menu": function (module, exports, require) {
// ui/filters/presets-menu.js — выпадающее меню «Подборки»: применить, удалить, сохранить текущий фильтр.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const dropdown = require("ui/common/dropdown");
const confirmButton = require("ui/common/confirm-button");
const pipeline = require("filters/pipeline");
const { merge, isDefault } = require("filters/state");
const toast = require("ui/common/toast");

module.exports = function presetsMenu(ctx, { posts }) {
  const count = (p) => pipeline.run(posts, { filter: merge(p.filter), quick: p.quick || "all", seed: 1 }, { config: ctx.config, flags: ctx.flags }).list.length;

  const dd = dropdown({
    label: "Подборки", iconName: "bookmark", title: "Сохранённые подборки",
    render(panel, close) {
      const s = ctx.store.get();
      const list = ctx.presets.list();
      panel.append(h("div", { class: "sf-menu__title" }, "Смарт-подборки"));
      const rows = h("div", { class: "sf-menu__list" });
      if (!list.length) rows.append(h("div", { class: "sf-menu__empty" }, "Подборок пока нет"));
      for (const p of list) {
        rows.append(h("div", { class: ["sf-menu__row", p.id === s.presetId && "is-active"] },
          h("button", { type: "button", class: "sf-menu__item", onClick: () => { ctx.actions.applyPreset(p); close(); } }, icon(p.icon || "star", { size: 15 }), h("span", { class: "sf-menu__name" }, p.name), h("span", { class: "sf-menu__count" }, count(p))),
          confirmButton({ title: "Удалить подборку", onConfirm: () => { ctx.presets.remove(p.id); if (ctx.store.get().presetId === p.id) ctx.store.set({ presetId: null }); toast(ctx, "Подборка удалена"); dd.redraw(); } })));
      }
      panel.append(rows);

      const name = h("input", { class: "sf-input sf-input--sm", type: "text", placeholder: "Название подборки", style: { width: "100%" } });
      const save = () => {
        const n = name.value.trim();
        if (!n) { name.focus(); toast(ctx, "Введите название подборки"); return; }
        const cur = ctx.store.get();
        ctx.presets.save({ name: n, icon: "star", description: "", quick: cur.quick, filter: cur.filter });
        toast(ctx, `Подборка «${n}» сохранена`); dd.redraw();
      };
      name.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
      const unsaved = isDefault(s.filter) && s.quick === "all";
      panel.append(h("div", { class: "sf-menu__save" },
        h("div", { class: "sf-menu__hint" }, unsaved ? "Выберите условия — и сохраните их как подборку" : "Сохранить текущий фильтр как подборку"),
        h("div", { class: "sf-menu__saverow" }, name, h("button", { type: "button", class: "sf-btn sf-btn--primary sf-btn--sm", onClick: save }, icon("save", { size: 13 }), "Сохранить"))),
        h("button", { type: "button", class: "sf-menu__link", onClick: () => { ctx.actions.enterView("collections"); close(); } }, "Все подборки →"));
    },
  });
  return dd;
};

},
"ui/filters/quickbar": function (module, exports, require) {
// ui/filters/quickbar.js — быстрые режимы: Все / В этот день / Рандомные 🎲 / Избранное (+ счётчики).
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const modes = require("filters/quick-modes");
const { fmtNum } = require("lib/ru");

module.exports = function quickbar(ctx, { posts }) {
  const el = h("div", { class: "sf-quickbar" });
  function draw() {
    clear(el);
    const { quick, seed } = ctx.store.get();
    const c = { now: Date.now(), seed, config: ctx.config, flags: ctx.flags };
    for (const m of modes.MODES) {
      const n = m.id === "random" ? null : modes.count(posts, m.id, c);
      el.append(h("button", { type: "button", class: ["sf-quick", m.id === quick && "is-active", `sf-quick--${m.id}`], onClick: () => ctx.actions.setQuick(m.id) },
        icon(m.icon, { size: 15 }), h("span", null, m.label(c)), n != null && h("span", { class: "sf-quick__count" }, fmtNum(n))));
    }
    if (quick === "random") el.append(h("button", { type: "button", class: "sf-btn sf-btn--primary sf-shuffle", onClick: () => ctx.actions.shuffle() }, icon("dice", { size: 14 }), "Перемешать"));
  }
  draw();
  const dispose = ctx.store.subscribe(draw, ["quick", "seed"]);
  return { el, dispose };
};

},
"ui/filters/search-bar": function (module, exports, require) {
// ui/filters/search-bar.js — поиск по названию или тексту + диапазон дат (от и до).
// Три параметра независимы: изменение ЛЮБОГО из них сразу применяет фильтр (текст — с задержкой 0,1 с, даты — мгновенно).
// Индексация текстов идёт в фоне (autoIndex) или при первом фокусе; пока она не закончилась, рядом виден прогресс.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { debounce } = require("lib/async");

module.exports = function searchBar(ctx, { posts, placeholder = "Поиск по названию или тексту…", cls = "" }) {
  const status = h("span", { class: "sf-search__status" });
  const apply = debounce((v) => ctx.actions.setFilter({ text: v }), 100);
  const f0 = ctx.store.get().filter;

  const input = h("input", { class: "sf-input", type: "search", placeholder, value: f0.text || "", enterkeyhint: "search",
    onFocus: () => ctx.indexer.ensure(posts),
    onInput: (e) => { clearBtn.style.display = e.target.value ? "" : "none"; apply(e.target.value); },
    onKeydown: (e) => { if (e.key === "Escape") { input.value = ""; clearBtn.style.display = "none"; ctx.actions.setFilter({ text: "" }); } } });
  const clearBtn = h("button", { type: "button", class: "sf-search__clear", title: "Очистить", style: { display: input.value ? "" : "none" }, onClick: () => { input.value = ""; clearBtn.style.display = "none"; ctx.actions.setFilter({ text: "" }); } }, icon("x", { size: 13 }));

  // Даты: каждое поле применяется само по себе (событие input — при выборе даты, change — на случай браузеров, где input не приходит)
  const dateField = (key, label) => {
    const apply = (e) => { ctx.actions.setFilter({ [key]: e.target.value || "" }); syncDates(); };
    const field = h("input", { class: "sf-input sf-date__input", type: "date", value: f0[key] || "", "aria-label": `Дата ${label}`, onInput: apply, onChange: apply });
    return { field, el: h("label", { class: "sf-date" }, h("span", { class: "sf-date__label" }, label), field) };
  };
  const from = dateField("dateFrom", "от"), to = dateField("dateTo", "до");
  const datesClear = h("button", { type: "button", class: "sf-search__clear sf-date__clear", title: "Сбросить даты", onClick: () => { ctx.actions.setFilter({ dateFrom: "", dateTo: "" }); } }, icon("x", { size: 13 }));
  function syncDates() { datesClear.style.display = from.field.value || to.field.value ? "" : "none"; }
  syncDates();

  const el = h("div", { class: ["sf-search", cls] },
    h("div", { class: "sf-input-wrap" }, icon("search", { size: 14 }), input, clearBtn),
    h("div", { class: "sf-daterange", role: "group", "aria-label": "Диапазон дат" }, from.el, to.el, datesClear),
    status);

  const showStatus = (s) => { status.textContent = s.running ? `индексация ${s.i}/${s.n}` : ""; status.title = s.running ? "Пока тексты не проиндексированы, поиск идёт по заголовкам и тегам" : ""; };
  showStatus(ctx.indexer.status());
  const offIndex = ctx.indexer.onChange(showStatus);
  // внешний сброс фильтра (формула, «Сбросить», подборка) → синхронизируем поля
  const offStore = ctx.store.subscribe((s) => {
    const f = s.filter;
    if (document.activeElement !== input && input.value !== (f.text || "")) { input.value = f.text || ""; clearBtn.style.display = input.value ? "" : "none"; }
    if (from.field.value !== (f.dateFrom || "")) from.field.value = f.dateFrom || "";
    if (to.field.value !== (f.dateTo || "")) to.field.value = f.dateTo || "";
    syncDates();
  }, ["filter"]);
  return { el, dispose: () => { offIndex(); offStore(); } };
};

},
"ui/filters/tag-builder": function (module, exports, require) {
// ui/filters/tag-builder.js — выбор тегов: тап по чипу ИЛИ ввод с автодополнением (режимы ANY / ALL / NOT).
// Поле ввода — это <form>: «Ввод»/«Готово» на мобильной клавиатуре и кнопка «+» работают одинаково надёжно.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { tagCounts } = require("stats/tags");
const { tagMode, normTag } = require("filters/state");
const { shuffle, newSeed } = require("lib/random");
const { DAY, sameMonthDay } = require("lib/date");
const chip = require("ui/common/chip");

const MODES = [
  { id: "any", label: "ANY (ИЛИ)" },
  { id: "all", label: "ALL (И)" },
  { id: "not", label: "NOT (НЕ)" },
];

// Подсказки: сначала теги, начинающиеся с введённого, затем содержащие; внутри — по частоте.
function suggestTags(all, query, limit = 8) {
  const q = normTag(query);
  if (!q) return all.slice(0, limit);
  const starts = all.filter((t) => t.tag.startsWith(q)), has = all.filter((t) => !t.tag.startsWith(q) && t.tag.includes(q));
  return [...starts, ...has].slice(0, limit);
}

module.exports = function tagBuilder(ctx, { posts }) {
  const el = h("div", { class: "sf-tagbuilder" });
  const allTags = tagCounts(posts, { limit: Infinity });
  const limit = ctx.config.topTags;
  let mode = "any", active = -1, shown = [], tab = "top", seed = newSeed();

  // «Подкладки» с наборами тегов: что показывать чипами под полем ввода
  const TABS = [
    { id: "top", label: "Топ", title: "Самые частые теги" },
    { id: "random", label: "Случайные", title: "Случайная выборка тегов — нажмите ещё раз, чтобы перемешать" },
    { id: "year", label: "За год", title: "Самые частые теги за последние 12 месяцев" },
    { id: "today", label: "Этот день", title: "Теги заметок, написанных в этот день в прошлые годы" },
  ];
  function tagSet() {
    const now = Date.now(), thisYear = new Date(now).getFullYear();
    if (tab === "random") return shuffle(allTags, seed).slice(0, limit);
    if (tab === "year") return tagCounts(posts.filter((p) => p.ts >= now - 365 * DAY && p.ts <= now + DAY), { limit });
    if (tab === "today") return tagCounts(posts.filter((p) => sameMonthDay(p.ts, now) && new Date(p.ts).getFullYear() < thisYear), { limit });
    return allTags.slice(0, limit);
  }
  const EMPTY = { year: "За последние 12 месяцев заметок с тегами нет.", today: "В прошлые годы в этот день заметок с тегами нет.", random: "В выбранных источниках нет тегов.", top: "В выбранных источниках нет тегов." };

  // --- постоянная часть (не перерисовывается, чтобы поле ввода не теряло фокус и клавиатура не закрывалась)
  const modeRow = h("div", { class: "sf-tagbuilder__modes" });
  const sug = h("div", { class: "sf-suggest", style: { display: "none" } });
  const input = h("input", { class: "sf-input sf-input--sm sf-tagadd__input", type: "text", placeholder: "Добавить тег…", autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: "false", enterkeyhint: "done" });

  function hideSuggest() { sug.style.display = "none"; active = -1; }
  function drawSuggest() {
    clear(sug);
    shown = suggestTags(allTags, input.value);
    const f = ctx.store.get().filter;
    shown.forEach((t, i) => sug.append(h("button", { type: "button", class: ["sf-suggest__item", i === active && "is-active", tagMode(f, t.tag) && "is-used"],
      // mousedown не отдаёт фокус кнопке — поле остаётся активным (важно для мобильной клавиатуры)
      onMousedown: (e) => e.preventDefault(), onClick: () => commit(t.tag) },
      h("span", { class: "sf-suggest__tag" }, "#" + t.tag), h("span", { class: "sf-suggest__count" }, t.count))));
    const typed = normTag(input.value);
    if (typed && !allTags.some((t) => t.tag === typed)) sug.append(h("button", { type: "button", class: "sf-suggest__item sf-suggest__new", onMousedown: (e) => e.preventDefault(), onClick: () => commit(typed) }, "Добавить «#" + typed + "»"));
    sug.style.display = sug.children.length ? "" : "none";
  }
  function commit(raw) {
    const t = normTag(raw);
    if (!t) return;
    ctx.actions.toggleTag(mode, t);
    input.value = ""; hideSuggest();
    if (input.focus) input.focus();
  }

  input.addEventListener("input", () => { active = -1; drawSuggest(); });
  input.addEventListener("focus", drawSuggest);
  input.addEventListener("blur", () => setTimeout(hideSuggest, 160));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!shown.length) return;
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
      drawSuggest();
    } else if (e.key === "Escape") hideSuggest();
  });
  const form = h("form", { class: "sf-tagadd", autocomplete: "off", onSubmit: (e) => {
    e.preventDefault();
    commit(active >= 0 && shown[active] ? shown[active].tag : input.value);
  } }, input,
  h("button", { type: "submit", class: "sf-iconbtn sf-tagadd__btn", title: "Добавить тег" }, icon("plus", { size: 16 })), sug);

  const head = h("div", { class: "sf-tagbuilder__head" }, h("span", { class: "sf-tagbuilder__title" }, "Теги"), modeRow, form);
  const tabsEl = h("div", { class: "sf-tagtabs", role: "tablist", "aria-label": "Наборы тегов" });
  const wrap = h("div", { class: "sf-tagbuilder__tags" });
  el.append(head, tabsEl, wrap);

  function drawModes() {
    clear(modeRow);
    MODES.forEach((m) => modeRow.append(h("button", { type: "button", class: ["sf-modebtn", `sf-modebtn--${m.id}`, m.id === mode && "is-active"], onClick: () => { mode = m.id; drawModes(); drawChips(); } }, m.label)));
  }
  function drawTabs() {
    clear(tabsEl);
    TABS.forEach((t) => tabsEl.append(h("button", { type: "button", role: "tab", title: t.title, "aria-selected": t.id === tab ? "true" : "false", class: ["sf-tagtab", t.id === tab && "is-active"],
      onClick: () => { if (tab === t.id && t.id === "random") seed = newSeed(); tab = t.id; drawTabs(); drawChips(); } },
    t.id === "random" && icon("dice", { size: 12 }), t.label)));
  }
  function drawChips() {
    clear(wrap);
    const f = ctx.store.get().filter, set = tagSet();
    // выбранные теги всегда видны первыми (даже если их нет в выбранном наборе)
    const selected = [...f.any, ...f.all, ...f.not].map((t) => ({ tag: t, count: (allTags.find((c) => c.tag === t) || {}).count }));
    const rest = set.filter((c) => !selected.some((s) => s.tag === c.tag));
    if (!set.length && !selected.length) { wrap.append(h("span", { class: "sf-muted" }, EMPTY[tab])); return; }
    for (const { tag, count } of [...selected, ...rest]) {
      const m = tagMode(f, tag);
      wrap.append(chip({ text: "#" + tag, count, kind: m === "not" ? "not" : "tag", active: !!m, onClick: () => ctx.actions.toggleTag(mode, tag), title: m ? `в режиме ${m.toUpperCase()} — тап, чтобы снять` : `добавить как ${mode.toUpperCase()}` }));
    }
    if (!rest.length) wrap.append(h("span", { class: "sf-muted" }, EMPTY[tab]));
  }
  drawModes(); drawTabs(); drawChips();
  const dispose = ctx.store.subscribe(() => { drawChips(); if (sug.style.display !== "none") drawSuggest(); }, ["filter"]);
  return { el, dispose };
};
module.exports.suggestTags = suggestTags;

},
"ui/overview/charts": function (module, exports, require) {
// ui/overview/charts.js — маленькие SVG-графики без зависимостей: спарклайн (area + линия) и кольцевая диаграмма.
const { h } = require("lib/dom");
const { uid } = require("lib/misc");

const f = (n) => Math.round(n * 100) / 100;
// Плавная кривая через точки (Catmull-Rom → кубические Безье)
function smooth(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

// values — значения по дням (первые `visible` точек), total — сколько точек занимает вся ось X (дней в месяце).
function sparkline(values, { total = values.length, w = 200, hgt = 56, pad = 4 } = {}) {
  const max = Math.max(1, ...values), n = Math.max(2, total);
  const pts = values.map((v, i) => [(i / (n - 1)) * w, hgt - pad - (v / max) * (hgt - pad * 2)]);
  const gid = uid("sg"), line = smooth(pts), last = pts[pts.length - 1] || [0, hgt - pad];
  const box = h("div", { class: "sf-spark" });
  box.innerHTML = `<svg viewBox="0 0 ${w} ${hgt}" preserveAspectRatio="none" aria-hidden="true">` +
    `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.35"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>` +
    (pts.length > 1 ? `<path d="${line} L${f(last[0])},${hgt} L0,${hgt} Z" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` : "") +
    `</svg>`;
  // точка «сегодня» — HTML-элементом, чтобы не искажалась при растяжении SVG
  box.append(h("span", { class: "sf-spark__dot", style: { left: (last[0] / w) * 100 + "%", top: (last[1] / hgt) * 100 + "%" } }));
  return box;
}

// segments: [{ id, value }] → кольцо; центр — подпись
function donut(segments, { size = 132, thick = 16, center = "" } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1, r = (size - thick) / 2, c = 2 * Math.PI * r;
  let off = 0, arcs = "";
  for (const s of segments) {
    const len = (s.value / total) * c;
    arcs += `<circle class="sf-donut__seg sf-donut__seg--${s.id}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${thick}" stroke-dasharray="${f(Math.max(0, len - 2))} ${f(c - Math.max(0, len - 2))}" stroke-dashoffset="${f(-off)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    off += len;
  }
  const box = h("div", { class: "sf-donut", style: { width: size + "px", height: size + "px" } });
  box.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle class="sf-donut__track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${thick}"/>${arcs}</svg>`;
  box.append(h("div", { class: "sf-donut__center" }, center));
  return box;
}
module.exports = { sparkline, donut };

},
"ui/overview/distribution": function (module, exports, require) {
// ui/overview/distribution.js — распределение заметок по типам за год: кольцевая диаграмма + легенда (клик → лента с типом).
const { h } = require("lib/dom");
const { typeCounts } = require("stats/types");
const { donut } = require("ui/overview/charts");
const { fmtNum } = require("lib/ru");
const { DAY } = require("lib/date");

const RU = { text: "Текст", quote: "Цитаты", audio: "Аудио", video: "Видео", image: "Фото", tasks: "Задачи", link: "Ссылки", canvas: "Canvas" };

module.exports = function distribution(ctx, posts, now) {
  const year = posts.filter((p) => p.ts >= now - 365 * DAY && p.ts <= now + DAY);
  const rows = typeCounts(year);
  const list = h("div", { class: "sf-dist__list" }, rows.length ? rows.map((r) =>
    h("button", { type: "button", class: "sf-dist__row", title: "Открыть в ленте", onClick: () => ctx.actions.jumpToType(r.id) },
      h("span", { class: ["sf-dist__dot", `is-${r.id}`] }), h("span", { class: "sf-dist__name" }, RU[r.id] || r.id), h("span", { class: "sf-dist__count" }, fmtNum(r.count)), h("span", { class: "sf-dist__pct" }, r.pct + "%")))
    : h("span", { class: "sf-muted" }, "За последний год заметок нет."));
  return h("div", { class: "sf-card-block sf-yearly__dist" },
    h("div", { class: "sf-block__head" }, h("div", null, h("h3", { class: "sf-block__title" }, "Типы заметок"), h("p", { class: "sf-block__sub" }, "Из чего состоит архив за последние 12 месяцев"))),
    h("div", { class: "sf-dist" }, donut(rows.map((r) => ({ id: r.id, value: r.count })), { center: h("span", null, h("strong", null, fmtNum(year.length)), "заметок") }), list));
};

},
"ui/overview/heatmap": function (module, exports, require) {
// ui/overview/heatmap.js — годовая карта активности: подписи месяцев и дней недели, легенда с диапазонами, сводка.
const { h } = require("lib/dom");
const { heatmap, levelRanges, summary } = require("stats/activity");
const { MONTHS_GEN, fmtDayMonth } = require("lib/date");
const { plural, fmtNum } = require("lib/ru");

const rangeLabel = ([from, to]) => (to === null ? `${from}+` : from === to ? `${from}` : `${from}–${to}`);

module.exports = function activityHeatmap(ctx, byDay, now) {
  // На телефоне — последние 26 недель (полгода): карта целиком помещается в ширину, без прокрутки. На десктопе — год.
  const mobile = !!(ctx.rootEl && ctx.rootEl.classList.contains("is-mobile"));
  const cols = heatmap(byDay, now, mobile ? 26 : 53), max = Math.max(0, ...byDay.values()), ranges = levelRanges(max), sum = summary(byDay);

  // Одна сетка: колонка подписей дней + по колонке на неделю; строка месяцев + 7 строк дней. Ячейки квадратные и тянутся по ширине.
  const grid = h("div", { class: "sf-heat", style: { "--cols": cols.length } });
  ["Пн", "Ср", "Пт"].forEach((d, i) => grid.append(h("span", { class: "sf-heat__daylabel", style: { gridRow: String(2 + i * 2), gridColumn: "1" } }, d)));
  let prev = -1;
  cols.forEach((col, i) => {
    const m = new Date(col[0].ts).getMonth();
    if (m !== prev && i < cols.length - 2) grid.append(h("span", { class: "sf-heat__month", style: { gridRow: "1", gridColumn: `${i + 2} / span 3` } }, MONTHS_GEN[m].slice(0, 3)));
    prev = m;
    col.forEach((c, d) => grid.append(h("span", { class: ["sf-heat__cell", `lv-${c.level}`, c.n > 0 && "is-click"], style: { gridRow: String(d + 2), gridColumn: String(i + 2) },
      title: c.level < 0 ? "" : `${c.key}: ${c.n} ${plural(c.n, ["заметка", "заметки", "заметок"])}`, onClick: c.n ? () => ctx.actions.jumpToDay(c.key) : null })));
  });

  const legend = h("div", { class: "sf-heat__legend" }, h("span", null, "Меньше"),
    ranges.map((r, i) => h("span", { class: `sf-heat__cell lv-${i}`, title: `${rangeLabel(r)} ${plural(r[1] === null ? 5 : r[1], ["заметка", "заметки", "заметок"])} в день` })),
    h("span", null, "Больше"));

  return h("div", { class: "sf-card-block sf-yearly__heat" },
    h("div", { class: "sf-block__head" },
      h("div", null, h("h3", { class: "sf-block__title" }, mobile ? "Активность за полгода" : "Активность за год"),
        h("p", { class: "sf-block__sub" }, "Каждый квадрат — один день, цвет — сколько заметок создано в этот день. Столбцы — недели (справа — текущая), строки — дни недели. Нажмите на цветной квадрат, чтобы открыть заметки этого дня.")),
      h("div", { class: "sf-block__stat" }, h("strong", null, fmtNum(sum.total)), ` ${plural(sum.total, ["заметка", "заметки", "заметок"])} · ${fmtNum(sum.activeDays)} ${plural(sum.activeDays, ["активный день", "активных дня", "активных дней"])}`,
        sum.best && h("span", null, `Рекорд: ${fmtDayMonth(new Date(sum.best.key + "T00:00:00").getTime())} — ${sum.best.n}`))),
    h("div", { class: "sf-heat__wrap" }, grid), legend);
};

},
"ui/overview/insights": function (module, exports, require) {
// ui/overview/insights.js — «Случайные озарения»: число карточек выбирается на месте (3 / 6 / 9 / 12, запоминается).
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { shuffle, newSeed } = require("lib/random");
const createCard = require("ui/card/card");
const tileGrid = require("ui/feed/tile-grid");

module.exports = function insights(ctx, posts) {
  const box = h("div", { class: "sf-insights" });
  let seed = newSeed(), grid = null;
  const options = (ctx.config.insightsOptions && ctx.config.insightsOptions.length ? ctx.config.insightsOptions : [3, 6, 9, 12]);

  function draw() {
    if (grid) grid.sfDispose();
    clear(box);
    const n = ctx.store.get().insightsCount;
    const pick = shuffle(posts, seed).slice(0, n);
    if (!pick.length) { box.append(h("span", { class: "sf-muted" }, "Нет заметок для выборки.")); return; }
    grid = tileGrid(ctx, pick.map((p) => createCard(ctx, p)), { variant: "masonry" });
    box.append(grid);
  }
  const counts = h("div", { class: "sf-segmented sf-insights__count", title: "Сколько карточек показывать" });
  function drawCounts() {
    clear(counts);
    const cur = ctx.store.get().insightsCount;
    options.forEach((o) => counts.append(h("button", { type: "button", class: ["sf-segmented__btn", o === cur && "is-active"], onClick: () => ctx.actions.setInsightsCount(o) }, h("span", null, String(o)))));
  }
  drawCounts(); draw();
  const unsub = ctx.store.subscribe(() => { drawCounts(); draw(); }, ["insightsCount"]);
  const el = h("section", { class: "sf-section" },
    h("div", { class: "sf-section__row" },
      h("div", { class: "sf-section__lead" }, h("span", { class: "sf-section__dot" }), h("h2", { class: "sf-section__title" }, "Случайные озарения")),
      h("div", { class: "sf-insights__tools" }, counts, h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-btn--sm", onClick: () => { seed = newSeed(); draw(); } }, icon("dice", { size: 14 }), "Перемешать"))),
    box);
  return { el, dispose: () => { unsub(); if (grid) grid.sfDispose(); } };
};

},
"ui/overview/pulse": function (module, exports, require) {
// ui/overview/pulse.js — «Пульс месяца» как в макете: 4 карточки (график, стрик, связи, медиа) + полоса трендовых тегов.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { MONTHS_GEN, startOfDay, dayKey, DAY } = require("lib/date");
const { monthStats } = require("stats/period");
const { streak } = require("stats/activity");
const { tagCounts } = require("stats/tags");
const { plural, fmtNum } = require("lib/ru");
const { sparkline } = require("ui/overview/charts");
const chip = require("ui/common/chip");

const head = (iconName, label, right) => h("div", { class: "sf-pcard__head" }, h("div", null, h("p", { class: "sf-pcard__label" }, label)), right);
const value = (v, unit, cls = "") => h("h3", { class: "sf-pcard__value" }, v, h("span", { class: ["sf-pcard__unit", cls] }, unit));

module.exports = function pulse(ctx, posts, byDay, now) {
  const d = new Date(now), ms = monthStats(posts, now), st = streak(byDay, now), mon = MONTHS_GEN[d.getMonth()];
  const short = (day) => `${day} ${mon.slice(0, 3)}`;

  // 1. Создано заметок + график накопления
  const trend = ms.deltaPct == null ? null : h("span", { class: ["sf-pcard__trend", ms.deltaPct < 0 && "is-down"] }, icon("trend", { size: 13 }), (ms.deltaPct > 0 ? "+" : "") + ms.deltaPct + "%");
  const c1 = h("div", { class: "sf-pcard sf-pcard--chart" },
    head("file", "Создано заметок", trend),
    value(fmtNum(ms.count), plural(ms.count, ["заметка", "заметки", "заметок"]), "is-tertiary"),
    h("div", { class: "sf-pcard__body" }, sparkline(ms.cumulative, { total: ms.daysInMonth }),
      h("div", { class: "sf-pcard__axis" }, h("span", null, short(1)), h("span", null, `накопительно · в прошлом месяце ${fmtNum(ms.prevCount)}`), h("span", null, short(ms.elapsed)))));

  // 2. Стрик + последние 7 дней кружками
  const days = Array.from({ length: 7 }, (_, i) => { const ts = startOfDay(now) - (6 - i) * DAY; return { n: byDay.get(dayKey(ts)) || 0, day: new Date(ts).getDate(), today: i === 6 }; });
  const c2 = h("div", { class: "sf-pcard" },
    head("flame", "Стрик регулярности", h("span", { class: "sf-pcard__badge" }, icon("flame", { size: 18 }))),
    value(st.current, plural(st.current, ["день подряд", "дня подряд", "дней подряд"]), "is-primary"),
    h("div", { class: "sf-pcard__body" },
      h("div", { class: "sf-streak" }, days.map((x) => h("span", { class: ["sf-streak__day", x.n > 0 && "is-on", x.today && "is-today"], title: `${x.day} ${mon}: ${x.n} ${plural(x.n, ["заметка", "заметки", "заметок"])}` }, x.day))),
      h("div", { class: "sf-pcard__axis" }, h("span", null, `Рекорд: ${st.best} ${plural(st.best, ["день", "дня", "дней"])}`), h("span", { class: "is-secondary" }, `${ms.consistencyPct}% консистентность`))));

  // 3. Связи + плотность графа
  const c3 = h("div", { class: "sf-pcard" },
    head("share", "Семантические связи", h("span", { class: "sf-pcard__badge is-plain" }, icon("share", { size: 18 }))),
    value(fmtNum(ms.links), plural(ms.links, ["связь", "связи", "связей"]), "is-tertiary"),
    h("div", { class: "sf-pcard__body" },
      h("div", { class: "sf-pcard__axis" }, h("span", null, "Плотность графа"), h("span", { class: "is-primary" }, `${ms.density} связей / заметка`)),
      h("div", { class: "sf-bar" }, h("div", { class: "sf-bar__fill", style: { width: Math.min(100, (ms.density / 6) * 100) + "%" } })),
      h("p", { class: "sf-pcard__note" }, `Изолированных заметок: ${ms.isolatedPct}%`)));

  // 4. Медиа: сегментная шкала фото / видео / аудио
  const m = ms.media, tot = Math.max(1, ms.mediaTotal);
  const seg = (cls, n, label) => h("div", { class: ["sf-seg", cls], style: { width: (n / tot) * 100 + "%" }, title: `${n} ${label}` });
  const leg = (cls, n, label) => h("span", { class: "sf-legend__item" }, h("span", { class: ["sf-legend__dot", cls] }), `${fmtNum(n)} ${label}`);
  const c4 = h("div", { class: "sf-pcard" },
    head("image", "Медиа за месяц", h("span", { class: "sf-pcard__badge is-plain" }, icon("image", { size: 18 }))),
    value(fmtNum(ms.mediaTotal), plural(ms.mediaTotal, ["файл", "файла", "файлов"]), ""),
    h("div", { class: "sf-pcard__body" },
      h("div", { class: "sf-segbar" }, ms.mediaTotal ? [seg("is-photo", m.photo, "фото"), seg("is-video", m.video, "видео"), seg("is-audio", m.audio, "аудио")] : h("div", { class: "sf-seg is-empty", style: { width: "100%" } })),
      h("div", { class: "sf-legend" }, leg("is-photo", m.photo, "фото"), leg("is-video", m.video, "видео"), leg("is-audio", m.audio, "аудио"))));

  // Трендовые теги месяца
  const tags = tagCounts(ms.posts, { limit: 10 });
  const strip = h("div", { class: "sf-tagstrip" },
    h("div", { class: "sf-tagstrip__label" }, icon("hash", { size: 16 }), `Трендовые теги ${mon}:`),
    h("div", { class: "sf-tagstrip__tags" }, tags.length ? tags.map((t) => chip({ text: "#" + t.tag, count: t.count, onClick: () => ctx.actions.jumpToTag(t.tag), title: "Открыть в ленте" })) : h("span", { class: "sf-muted" }, "В этом месяце заметок с тегами пока нет.")));

  return h("section", { class: "sf-section sf-pulse" },
    h("div", { class: "sf-section__row" },
      h("div", { class: "sf-section__lead" }, h("span", { class: "sf-section__dot is-secondary" }), h("h2", { class: "sf-section__title" }, `Пульс ${mon} ${d.getFullYear()}`), h("span", { class: "sf-pill" }, "Текущий срез")),
      h("span", { class: "sf-section__aside" }, icon("trend", { size: 15 }), `${ms.activeDays} из ${ms.elapsed} дней с заметками`)),
    h("div", { class: "sf-pulse__grid" }, c1, c2, c3, c4), strip);
};

},
"ui/stats/bars": function (module, exports, require) {
// ui/stats/bars.js — столбчатая диаграмма на div'ах (без SVG): подписи под столбцами, пик подсвечен, подсказка на каждом столбце.
const { h } = require("lib/dom");

// items: [{ label, value, title, show }] — show: подписывать ли столбец под осью (для плотных диаграмм — через один/несколько)
module.exports = function bars(items, { peakIndex = -1, height = 120, cls = "" } = {}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return h("div", { class: ["sf-bars", cls], style: { "--bars": items.length } },
    h("div", { class: "sf-bars__plot", style: { height: height + "px" } },
      items.map((it, i) => h("div", { class: ["sf-bars__col", i === peakIndex && "is-peak", it.value === 0 && "is-zero"], title: it.title || `${it.label}: ${it.value}` },
        h("div", { class: "sf-bars__bar", style: { height: Math.max(it.value ? 4 : 2, (it.value / max) * 100) + "%" } })))),
    h("div", { class: "sf-bars__axis" }, items.map((it) => h("span", { class: ["sf-bars__tick", it.show === false && "is-hidden"] }, it.label))));
};

},
"ui/stats/longest": function (module, exports, require) {
// ui/stats/longest.js — «Самые длинные записи»: за всё время, за текущий год и рекордсмены каждого года.
// Быстрый отбор по размеру файла, затем точный подсчёт слов по прочитанному телу (только для кандидатов).
const { h, clear } = require("lib/dom");
const { fmtNum, plural } = require("lib/ru");
const { fmtDateTime } = require("lib/date");
const segmented = require("ui/common/segmented");
const { longestCandidates } = require("stats/author");

// posts — только записи с датой (ts > 0); учитываются все годы, период экрана на этот блок не влияет.
module.exports = function longest(ctx, posts, { top = 10, now = Date.now() } = {}) {
  const year = new Date(now).getFullYear(), yearOf = (p) => new Date(p.ts).getFullYear();
  const MODES = [{ id: "all", label: "Всё время" }, { id: "year", label: `${year} год` }, { id: "years", label: "По годам" }];
  let mode = (ctx.session.get() || {}).statsLongest || "all", token = 0, dead = false;
  const list = h("ol", { class: "sf-longest__list" }), sub = h("p", { class: "sf-block__sub" }), tabs = h("div", { class: "sf-longest__tabs" });
  const el = h("div", { class: "sf-card-block sf-longest" },
    h("div", { class: "sf-block__head" }, h("div", null, h("h3", { class: "sf-block__title" }, "Самые длинные записи"), sub), tabs), list);

  const wordsOf = (p) => p.words || 0, sizeLine = (p) => `${fmtDateTime(p.ts, p.hasTime)} · ${fmtNum(p.words)} ${plural(p.words, ["слово", "слова", "слов"])} · ${p.feats ? p.feats.readMin : Math.max(1, Math.round(p.words / 200))} мин`;
  const row = (p, label, max) => h("li", { class: "sf-longest__row" },
    h("button", { type: "button", class: "sf-longest__btn", onClick: (e) => ctx.openNote(p.path, e) },
      h("span", { class: ["sf-longest__n", label.length > 2 && "is-year"] }, label),
      h("span", { class: "sf-longest__main" },
        h("span", { class: "sf-longest__title" }, p.hasOwnTitle ? p.title : fmtDateTime(p.ts, p.hasTime)),
        h("span", { class: "sf-longest__meta" }, sizeLine(p)),
        h("span", { class: "sf-longest__bar" }, h("i", { style: { width: Math.max(4, (p.words / max) * 100) + "%" } })))));

  async function draw() {
    const my = ++token;
    clear(tabs); tabs.append(segmented({ options: MODES, value: mode, onChange: (id) => { mode = id; ctx.session.patch({ statsLongest: id }); draw().catch(() => {}); } }));
    sub.textContent = mode === "years" ? "Самая длинная запись каждого года; клик открывает заметку" : mode === "year" ? `Записи ${year} года по числу слов; клик открывает заметку` : "По числу слов за все годы; клик открывает заметку";
    // кандидаты
    let cand, groups = null;
    if (mode === "years") {
      groups = new Map(); for (const p of posts) { const y = yearOf(p); if (!groups.has(y)) groups.set(y, []); groups.get(y).push(p); }
      cand = []; for (const [y, g] of groups) { const c = longestCandidates(g, 4); groups.set(y, c); cand.push(...c); }
    } else cand = longestCandidates(mode === "year" ? posts.filter((p) => yearOf(p) === year) : posts, 24);
    clear(list);
    if (!cand.length) { list.append(h("li", { class: "sf-muted" }, "Пока нечего показать.")); return; }
    list.append(...cand.slice(0, top).map(() => h("li", { class: "sf-longest__row sf-longest__row--skel" }, h("i"))));
    await ctx.content.preload(cand);
    if (dead || my !== token) return;
    clear(list);
    if (mode === "years") {
      const best = [...groups.entries()].map(([y, c]) => [y, c.filter(wordsOf).sort((a, b) => b.words - a.words)[0]]).filter(([, p]) => p).sort((a, b) => b[0] - a[0]);
      if (!best.length) { list.append(h("li", { class: "sf-muted" }, "Пока нечего показать.")); return; }
      const max = Math.max(...best.map(([, p]) => p.words));
      best.forEach(([y, p]) => list.append(row(p, String(y), max)));
      return;
    }
    const rows = cand.filter(wordsOf).sort((a, b) => b.words - a.words).slice(0, top);
    if (!rows.length) { list.append(h("li", { class: "sf-muted" }, "Пока нечего показать.")); return; }
    rows.forEach((p, i) => list.append(row(p, String(i + 1), rows[0].words)));
  }
  draw().catch((e) => { console.warn("[journal-stream] самые длинные", e); });
  return { el, dispose: () => { dead = true; } };
};

},
"ui/stats/records": function (module, exports, require) {
// ui/stats/records.js — карточки-рекорды: серия, текущая серия, плотный день/месяц, самая долгая пауза.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { plural, fmtNum } = require("lib/ru");
const { fmtDateLong, MONTHS_NOM } = require("lib/date");

const dateOf = (key) => fmtDateLong(new Date(key + "T00:00:00").getTime());
const range = (from, to) => (!from ? "" : from === to ? dateOf(from) : `${dateOf(from)} — ${dateOf(to)}`);
const days = (n) => `${fmtNum(n)} ${plural(n, ["день", "дня", "дней"])}`;
const monthLabel = (key) => `${MONTHS_NOM[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;

module.exports = function records(ctx, { streaks, busy }) {
  const card = (ic, tone, label, value, sub, onClick) => h(onClick ? "button" : "div", { type: onClick ? "button" : null, class: ["sf-rec", `is-${tone}`, onClick && "is-clickable"], onClick },
    h("span", { class: "sf-rec__icon" }, icon(ic, { size: 18 })),
    h("span", { class: "sf-rec__label" }, label), h("strong", { class: "sf-rec__value" }, value), h("span", { class: "sf-rec__sub" }, sub || "—"));
  const { best, current, gap } = streaks;
  return h("div", { class: "sf-recs" },
    card("flame", "primary", "Рекорд серии", best.len ? days(best.len) : "—", range(best.from, best.to), best.len ? () => ctx.actions.jumpToDay(best.from) : null),
    card("trend", "secondary", "Текущая серия", current.len ? days(current.len) : "нет", current.len ? `с ${dateOf(current.from)}` : "Запись сегодня или вчера начнёт новую"),
    card("bolt", "tertiary", "Самый плодотворный день", busy.day ? `${fmtNum(busy.day.n)} ${plural(busy.day.n, ["заметка", "заметки", "заметок"])}` : "—", busy.day ? dateOf(busy.day.key) : "", busy.day ? () => ctx.actions.jumpToDay(busy.day.key) : null),
    card("calendar", "primary", "Самый плодотворный месяц", busy.month ? `${fmtNum(busy.month.n)} ${plural(busy.month.n, ["заметка", "заметки", "заметок"])}` : "—", busy.month ? monthLabel(busy.month.key) : ""),
    card("clock", "secondary", "Самая долгая пауза", gap.days ? days(gap.days) : "нет", range(gap.from, gap.to)));
};

},
"ui/studio/action-bar": function (module, exports, require) {
// ui/studio/action-bar.js — панель действий конструктора: Сбросить · Открыть · Сохранить · Сохранить как новую · Удалить.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const confirmButton = require("ui/common/confirm-button");
const toast = require("ui/common/toast");

module.exports = function actionBar(ctx, draft) {
  const el = h("div", { class: "sf-actionbar" });

  function persist(asNew) {
    const name = (draft.name || "").trim();
    if (!name) { toast(ctx, "Введите название подборки"); return; }
    const s = ctx.store.get();
    const saved = ctx.presets.save({ id: asNew ? null : draft.id, name, description: draft.description, icon: draft.icon, quick: s.quick, filter: s.filter });
    draft.id = saved.id;
    ctx.store.set({ presetId: saved.id });
    toast(ctx, asNew ? "Сохранена как новая подборка" : "Подборка сохранена");
    draw();
  }

  function draw() {
    clear(el);
    const saved = !!(draft.id && ctx.presets.get(draft.id));
    el.append(
      h("button", { type: "button", class: "sf-btn sf-btn--ghost", onClick: () => ctx.actions.resetFilter() }, icon("refresh", { size: 14 }), "Сбросить условия"),
      h("button", { type: "button", class: "sf-btn sf-btn--ghost", onClick: () => { const s = ctx.store.get(); ctx.actions.openPreset({ id: saved ? draft.id : null, quick: s.quick, filter: s.filter }, "bento"); } }, icon("bento", { size: 14 }), "Открыть в Бенто"),
      h("span", { class: "sf-toolbar__spacer" }),
      confirmButton({ title: saved ? "Удалить подборку" : "Подборка ещё не сохранена", label: "Удалить", cls: "sf-btn sf-btn--danger", disabled: !saved, onConfirm: () => { ctx.presets.remove(draft.id); toast(ctx, "Подборка удалена"); ctx.actions.enterView("collections"); } }),
      saved && h("button", { type: "button", class: "sf-btn", onClick: () => persist(true) }, icon("copy", { size: 14 }), "Сохранить как новую"),
      h("button", { type: "button", class: "sf-btn sf-btn--primary", onClick: () => persist(false) }, icon("save", { size: 14 }), saved ? "Сохранить изменения" : "Сохранить подборку"));
  }
  draw();
  return { el, redraw: draw };
};

},
"ui/studio/dql-highlight": function (module, exports, require) {
// ui/studio/dql-highlight.js — лёгкая подсветка DQL (без внешних библиотек).
const { h } = require("lib/dom");
const RE = /("(?:[^"\\]|\\.)*")|\b(TABLE|WITHOUT|ID|FROM|WHERE|AND|OR|SORT|DESC|ASC|AS|NOT)\b|\b([a-z]+)(?=\()|(\d+)/g;
module.exports = function highlight(code) {
  const out = []; let last = 0, m;
  RE.lastIndex = 0;
  while ((m = RE.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const cls = m[1] ? "str" : m[2] ? "kw" : m[3] ? "fn" : "num";
    out.push(h("span", { class: `sf-dql__${cls}` }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
};

},
"ui/studio/dql-panel": function (module, exports, require) {
// ui/studio/dql-panel.js — сгенерированный DQL с подсветкой, копированием и пометками.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { compile } = require("filters/dql");
const highlight = require("ui/studio/dql-highlight");
const { copyText } = require("lib/misc");
const toast = require("ui/common/toast");

module.exports = function dqlPanel(ctx) {
  const el = h("section", { class: "sf-dqlpanel" });
  function draw() {
    clear(el);
    const s = ctx.store.get(), { query, notes } = compile(s.filter, { config: ctx.config, quick: s.quick });
    el.append(
      h("div", { class: "sf-dqlpanel__head" }, h("span", null, icon("terminal", { size: 14 }), " Obsidian DQL"),
        h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-btn--sm", onClick: async () => { toast(ctx, (await copyText(query)) ? "DQL скопирован" : "Не удалось скопировать"); } }, icon("copy", { size: 13 }), "Копировать")),
      h("pre", { class: "sf-dql" }, h("code", null, highlight(query))),
      notes.length && h("ul", { class: "sf-dqlpanel__notes" }, notes.map((n) => h("li", null, n))));
  }
  draw();
  return { el, dispose: ctx.store.subscribe(draw, ["filter", "quick"]) };
};

},
"ui/studio/live-preview": function (module, exports, require) {
// ui/studio/live-preview.js — живой отклик хранилища: число совпадений, время выполнения, первые заметки.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const pipeline = require("filters/pipeline");
const richLink = require("ui/common/rich-link");
const { fmtNum } = require("lib/ru");

module.exports = function livePreview(ctx, posts) {
  const el = h("section", { class: "sf-livepreview" });
  function draw() {
    clear(el);
    const t0 = performance.now();
    const { list } = pipeline.run(posts, ctx.store.get(), { config: ctx.config, flags: ctx.flags });
    const ms = Math.max(0.1, performance.now() - t0).toFixed(1);
    el.append(
      h("div", { class: "sf-livepreview__head" }, h("span", { class: "sf-counter" }, h("span", { class: "sf-counter__dot" }), `Найдено: ${fmtNum(list.length)}`), h("span", { class: "sf-muted" }, icon("clock", { size: 12 }), ` ${ms} мс`)),
      h("div", { class: "sf-livepreview__list" }, list.slice(0, 6).map((p) => richLink(ctx, p)), !list.length && h("span", { class: "sf-muted" }, "Ничего не найдено")));
  }
  draw();
  return { el, dispose: ctx.store.subscribe(draw, ["filter", "quick", "seed"]) };
};

},
"ui/studio/meta-panel": function (module, exports, require) {
// ui/studio/meta-panel.js — метаданные подборки: название, описание, быстрый режим, иконка.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const modes = require("filters/quick-modes");
const select = require("ui/common/select");

const ICONS = ["bolt", "mic", "video", "quote", "history", "dice", "star", "hash", "file", "link", "tasks", "image", "share"];

module.exports = function metaPanel(ctx, draft) {
  const el = h("section", { class: "sf-meta" });
  function draw() {
    clear(el);
    const quick = ctx.store.get().quick;
    el.append(
      h("div", { class: "sf-field sf-field--grow" }, h("label", null, "Название подборки"), h("input", { class: "sf-input", type: "text", value: draft.name, placeholder: "Например: Инженерные инсайты", onInput: (e) => (draft.name = e.target.value) })),
      h("div", { class: "sf-field sf-field--grow" }, h("label", null, "Описание"), h("input", { class: "sf-input", type: "text", value: draft.description, onInput: (e) => (draft.description = e.target.value) })),
      h("div", { class: "sf-field" }, h("label", null, "Режим"), select({ options: modes.MODES.map((m) => ({ id: m.id, label: m.label({ now: Date.now() }) })), value: quick, onChange: (v) => ctx.actions.setQuick(v) })),
      h("div", { class: "sf-field" }, h("label", null, "Иконка"), h("div", { class: "sf-iconpick" }, ICONS.map((i) => h("button", { type: "button", class: ["sf-iconbtn", i === draft.icon && "is-active"], onClick: () => { draft.icon = i; draw(); } }, icon(i, { size: 15 }))))));
  }
  draw();
  return { el, dispose: ctx.store.subscribe(draw, ["quick"]) };
};

},
"views/bento": function (module, exports, require) {
// views/bento.js — «Бенто»: асимметричная сетка с акцентными карточками (видео 2×1, аудио 1×1 …).
module.exports = require("views/feed-view")({ id: "bento", title: "Бенто", icon: "bento", fixedLayout: "bento" });

},
"views/collections": function (module, exports, require) {
// views/collections.js — «Подборки»: плитки в той же сетке, что и Бенто (первая подборка — «герой» на 2 колонки).
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const presetCard = require("ui/collections/preset-card");
const tileGrid = require("ui/feed/tile-grid");
const { plural } = require("lib/ru");
const { fmtTime } = require("lib/date");

module.exports = {
  id: "collections", title: "Подборки", icon: "star",
  async render(ctx, el) {
    const posts = ctx.repo.collect(), list = ctx.presets.list();
    const cards = list.map((p, i) => presetCard(ctx, p, posts, { hero: i === 0 }));
    const grid = tileGrid(ctx, cards, { variant: "bento", wide: (c) => !!(c && c.classList && c.classList.contains("sf-preset--hero")) });
    el.append(
      h("div", { class: "sf-hero sf-hero--row" },
        h("div", { class: "sf-toolbar__title" },
          h("div", { class: "sf-crumbs" }, h("span", { class: "sf-crumbs__dot" }), "Vault / Query Engine", h("span", { class: "sf-crumbs__sep" }, "·"), h("span", { class: "sf-crumbs__sync" }, icon("refresh", { size: 12 }), `Обновлено ${fmtTime(Date.now())}`)),
          h("div", { class: "sf-toolbar__h1" }, h("h1", null, "Сохранённые фильтры"), h("span", { class: "sf-count-pill" }, `${list.length} ${plural(list.length, ["подборка", "подборки", "подборок"])}`))),
        h("button", { type: "button", class: "sf-btn sf-btn--primary", onClick: () => ctx.actions.newPreset() }, icon("plus", { size: 14 }), "Новый смарт-фильтр")),
      grid);
    return () => grid.sfDispose();
  },
};

},
"views/feed-view": function (module, exports, require) {
// views/feed-view.js — фабрика экранов-лент (Лента, Бенто): тулбар (поиск, подборки) + быстрые режимы + фильтры + лента.
const { h, clear } = require("lib/dom");
const toolbar = require("ui/feed/toolbar");
const quickbar = require("ui/filters/quickbar");
const filterPanel = require("ui/filters/filter-panel");
const feed = require("ui/feed/feed");
const pipeline = require("filters/pipeline");
const mobileBar = require("ui/feed/mobile-bar");

module.exports = function createFeedView({ id, title, icon, fixedLayout }) {
  return {
    id, title, icon,
    async render(ctx, el) {
      const { store, config } = ctx;
      const posts = ctx.repo.collect();

      const refresh = () => { ctx.repo.refresh(); ctx.content.clear(); ctx.indexer.reset(); ctx.reload(); };
      // Мобильная версия: освобождаем экран — только «Фильтры» (всё в модальном окне) и краткая сводка; иначе — шапка, режимы, панель.
      const mobile = !!(ctx.rootEl && ctx.rootEl.classList.contains("is-mobile"));
      const top = mobile
        ? (() => { const b = mobileBar(ctx, { posts, withLayouts: !fixedLayout, onRefresh: refresh }); return { els: [b.el], setCount: b.setCount, dispose: b.dispose }; })()
        : (() => {
          const tb = toolbar(ctx, { title, posts, withLayouts: !fixedLayout, onRefresh: refresh });
          const qb = quickbar(ctx, { posts }), fp = filterPanel(ctx, { posts, variant: "stream" });
          return { els: [tb.el, qb.el, fp.el], setCount: tb.setCount, dispose: () => { tb.dispose(); qb.dispose(); fp.dispose(); } };
        })();
      const region = h("div", { class: "sf-feed-region" });
      el.append(...top.els, region);

      let current = null;
      let keepTimer = null;
      function drawFeed() {
        const s = store.get();
        // Пока лента перестраивается, держим прежнюю высоту — иначе страница «схлопывается» и прокрутка прыгает вверх.
        const prevH = region.offsetHeight;
        if (prevH) { region.style.minHeight = prevH + "px"; clearTimeout(keepTimer); keepTimer = setTimeout(() => { region.style.minHeight = ""; }, 700); }
        const { list } = pipeline.run(posts, s, { config, flags: ctx.flags });
        top.setCount(list.length);
        if (current && current.sfDispose) current.sfDispose();
        clear(region);
        current = feed(ctx, { posts: list, layout: fixedLayout || s.layout, page: s.page });
        region.append(current);
      }
      drawFeed();
      let unsub = store.subscribe(drawFeed, ["filter", "quick", "seed", "layout", "page"]);

      // Фоновая индексация текстов (поиск по тексту, точные типы/цитаты): сразу при deepScan, иначе — когда браузер свободен
      if (config.deepScan || config.autoIndex !== false) {
        const start = () => ctx.indexer.ensure(posts).then(drawFeed).catch((e) => console.warn("[journal-stream] индексация", e));
        const t = setTimeout(start, config.deepScan ? 0 : 600);
        const prev = unsub;
        unsub = () => { clearTimeout(t); prev(); };
      }
      return () => { clearTimeout(keepTimer); unsub(); if (current && current.sfDispose) current.sfDispose(); top.dispose(); };
    },
  };
};

},
"views/index": function (module, exports, require) {
// views/index.js — реестр экранов (порядок = порядок вкладок).
const list = ["overview", "stream", "bento", "collections", "stats", "studio"].map((n) => require("views/" + n));
const get = (id) => list.find((v) => v.id === id) || list[1];
module.exports = { list, get };

},
"views/overview": function (module, exports, require) {
// views/overview.js — «Обзор» по макету: пульс месяца с графиками, случайные озарения, годовая карта активности + типы.
const { h } = require("lib/dom");
const { countByDay } = require("stats/activity");
const { fmtNum } = require("lib/ru");
const pulse = require("ui/overview/pulse");
const activityHeatmap = require("ui/overview/heatmap");
const distribution = require("ui/overview/distribution");
const insights = require("ui/overview/insights");

module.exports = {
  id: "overview", title: "Обзор", icon: "grid",
  async render(ctx, el) {
    const posts = ctx.repo.collect(), now = Date.now(), byDay = countByDay(posts);
    const links = posts.reduce((s, p) => s + p.links, 0);
    const ins = insights(ctx, posts);
    el.append(
      h("div", { class: "sf-hero" }, h("h1", null, "Обзор хранилища"), h("p", null, `${fmtNum(posts.length)} заметок и ${fmtNum(links)} исходящих связей`)),
      pulse(ctx, posts, byDay, now),
      ins.el,
      h("section", { class: "sf-section" },
        h("div", { class: "sf-section__row" }, h("div", { class: "sf-section__lead" }, h("span", { class: "sf-section__dot is-tertiary" }), h("h2", { class: "sf-section__title" }, "Годовой срез мыслей"))),
        h("div", { class: "sf-yearly" }, activityHeatmap(ctx, byDay, now), distribution(ctx, posts, now))));
    return () => ins.dispose();
  },
};

},
"views/stats": function (module, exports, require) {
// views/stats.js — «Статистика»: мини-статистика по автору — когда вы пишете (часы, дни недели, годы), рекорды серий, самые длинные записи.
const { h, clear } = require("lib/dom");
const { countByDay } = require("stats/activity");
const A = require("stats/author");
const { fmtNum, plural } = require("lib/ru");
const { fmtDateLong } = require("lib/date");
const segmented = require("ui/common/segmented");
const select = require("ui/common/select");
const bars = require("ui/stats/bars");
const records = require("ui/stats/records");
const longest = require("ui/stats/longest");

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"], WEEKDAYS_FULL = ["понедельникам", "вторникам", "средам", "четвергам", "пятницам", "субботам", "воскресеньям"];
const PERIODS = [{ id: "all", label: "Всё время" }, { id: "year", label: "Этот год" }, { id: "12m", label: "12 месяцев" }];
const pad = (n) => String(n).padStart(2, "0");

module.exports = {
  id: "stats", title: "Статистика", icon: "trend",
  async render(ctx, el) {
    let period = (ctx.session.get() || {}).statsPeriod || "all", cyear = (ctx.session.get() || {}).statsYear || "all", dispose = () => {};
    const host = h("div", { class: "sf-stats" });
    const lead = h("p", { class: "sf-stats__lead" }), per = h("div", { class: "sf-stats__period" });
    const head = h("div", { class: "sf-hero sf-hero--row" }, h("div", { class: "sf-hero" }, h("h1", null, "Статистика"), lead), per);
    el.append(head, host);

    function draw() {
      dispose(); clear(host);
      const now = Date.now(), raw = ctx.repo.collect(), all = raw.filter((p) => p.ts > 0), undated = raw.length - all.length, thisYear = new Date(now).getFullYear(), yearPosts = A.inPeriod(all, "year", now), posts = A.inPeriod(all, period, now), byDay = countByDay(posts);
      const years = A.byYear(all);
      if (cyear !== "all" && !years.some((y) => String(y.year) === cyear)) cyear = "all";
      // «Когда вы пишете» и «дни недели»: общее (по выбранному периоду) или разрез по конкретному году
      const cposts = cyear === "all" ? posts : all.filter((p) => String(new Date(p.ts).getFullYear()) === cyear), scope = cyear === "all" ? "" : ` · ${cyear} год`;
      const sum = A.overall(posts, byDay), hours = A.byHour(cposts), wd = A.byWeekday(cposts), streaks = A.streakRecords(byDay, now), busy = A.busiest(byDay);
      lead.textContent = (sum.total ? `${fmtNum(sum.total)} ${plural(sum.total, ["заметка", "заметки", "заметок"])} за ${fmtNum(sum.activeDays)} ${plural(sum.activeDays, ["день", "дня", "дней"])} · с ${fmtDateLong(sum.first)}` : "Нет заметок за выбранный период") + (undated ? ` · без даты, не учтены: ${fmtNum(undated)}` : "");
      clear(per); per.append(segmented({ options: PERIODS, value: period, onChange: (id) => { period = id; ctx.session.patch({ statsPeriod: id }); draw(); } }));

      const tile = (value, label, tone) => h("div", { class: ["sf-statile", `is-${tone}`] }, h("strong", null, value), h("span", null, label));
      const hp = A.peak(hours.counts), wp = A.peak(wd);
      const hourItems = hours.counts.map((v, i) => ({ label: pad(i), value: v, show: i % 3 === 0, title: `${pad(i)}:00–${pad(i)}:59 — ${v} ${plural(v, ["заметка", "заметки", "заметок"])}` }));
      const wdItems = wd.map((v, i) => ({ label: WEEKDAYS[i], value: v, title: `${WEEKDAYS[i]} — ${v} ${plural(v, ["заметка", "заметки", "заметок"])}` }));
      const yStep = years.length > 12 ? Math.ceil(years.length / 8) : 1;   // много лет — подписываем каждый N-й, чтобы подписи не вылезали
      const yearItems = years.map((y, i) => ({ label: String(y.year), value: y.count, show: i % yStep === 0 || i === years.length - 1 && yStep === 1, title: `${y.year} — ${y.count} ${plural(y.count, ["заметка", "заметки", "заметок"])}` }));
      const block = (title, sub, ...c) => h("div", { class: "sf-card-block" }, h("div", { class: "sf-block__head" }, h("div", null, h("h3", { class: "sf-block__title" }, title), sub && h("p", { class: "sf-block__sub" }, sub))), ...c);

      const lg = longest(ctx, all, { now });
      dispose = () => lg.dispose();
      host.append(
        h("div", { class: "sf-statiles" },
          tile(fmtNum(all.length), "заметок за все годы", "primary"), tile(fmtNum(yearPosts.length), `заметок в ${thisYear} году`, "secondary"),
          tile(fmtNum(sum.activeDays), `активных дней · ${sum.total ? String(sum.perActiveDay).replace(".", ",") : "—"} в день`, "tertiary"), tile(sum.total ? String(sum.perWeek).replace(".", ",") : "—", "в неделю", "primary")),
        years.length > 1 ? h("div", { class: "sf-stats__years" }, h("span", { class: "sf-stats__years-label" }, "Разрез"), select({
          title: "Год для графиков «Когда вы пишете» и «По дням недели»", options: [{ id: "all", label: "Общее (выбранный период)" }, ...years.slice().reverse().map((y) => ({ id: String(y.year), label: `${y.year} год · ${fmtNum(y.count)}` }))], value: cyear,
          onChange: (id) => { cyear = id; ctx.session.patch({ statsYear: id }); draw(); } })) : null,
        h("div", { class: "sf-statgrid" },
          block("Когда вы пишете", hours.timed ? `Часы суток${scope} · по ${fmtNum(hours.timed)} из ${fmtNum(hours.total)} записей, где указано время` + (hp >= 0 ? ` · пик в ${pad(hp)}:00` : "") : "В записях нет времени" + scope + " — часы недоступны (можно включить «Время из файла» в настройках)",
            hours.timed ? bars(hourItems, { peakIndex: hp, cls: "sf-bars--hours" }) : null),
          block("По дням недели", wp >= 0 ? `Чаще всего вы пишете по ${WEEKDAYS_FULL[wp]}${scope}` : "Нет записей" + scope, bars(wdItems, { peakIndex: wp, height: 120 }))),
        records(ctx, { streaks, busy }),
        h("div", { class: "sf-statgrid" },
          lg.el,
          years.length > 1 ? block("По годам", "Сколько записей в каждом году (все годы)", bars(yearItems, { peakIndex: A.peak(years.map((y) => y.count)), height: 140, cls: "sf-bars--years" })) : block("Серии", "Статистика по годам появится, когда в архиве будет больше одного года")));
    }
    draw();
    return () => dispose();
  },
};

},
"views/stream": function (module, exports, require) {
// views/stream.js — «Лента»: Masonry / Flow / Timeline.
module.exports = require("views/feed-view")({ id: "stream", title: "Лента", icon: "rows" });

},
"views/studio": function (module, exports, require) {
// views/studio.js — «Фильтры · DQL»: конструктор. Каждый вход через навигацию начинается с НОВОГО конструктора;
// редактирование существующей подборки открывается из «Подборок».
const { h } = require("lib/dom");
const filterPanel = require("ui/filters/filter-panel");
const metaPanel = require("ui/studio/meta-panel");
const actionBar = require("ui/studio/action-bar");
const dqlPanel = require("ui/studio/dql-panel");
const livePreview = require("ui/studio/live-preview");

module.exports = {
  id: "studio", title: "Фильтры · DQL", short: "Конструктор", icon: "code",
  async render(ctx, el) {
    const posts = ctx.repo.collect();
    let draft = ctx.store.get().draft;
    if (!draft) { draft = ctx.actions.newDraft(); ctx.store.set({ draft }); }

    const bar = actionBar(ctx, draft);
    const meta = metaPanel(ctx, draft);
    const panel = filterPanel(ctx, { posts, variant: "studio" });
    const live = livePreview(ctx, posts);
    const dql = dqlPanel(ctx);

    el.append(
      h("div", { class: "sf-hero" },
        h("h1", null, draft.id ? "Редактирование подборки" : "Новый смарт-фильтр"),
        h("p", null, "Соберите условия мышкой — справа появится готовый запрос (DQL для Dataview — по желанию)")),
      bar.el,
      h("div", { class: "sf-studio" },
        h("div", { class: "sf-studio__main" }, meta.el, panel.el),
        h("aside", { class: "sf-studio__side" }, live.el, dql.el)));
    return () => [meta, panel, live, dql].forEach((p) => p.dispose());
  },
};

}
  },
  css: {"00-tokens.css":"/* 00-tokens.css — дизайн-токены по dashboard.html (тональные слои без рамок). Тёмная и светлая темы.\n   Всё оформление берётся отсюда. Тема: config.theme / кнопка в навигации; auto — по теме Obsidian. */\n.sf-root, .sf-fab, .sf-modal {\n  /* светлая тема (вариация той же палитры) */\n  --sf-canvas: #fbf8fd;            /* surface */\n  --sf-surface: #f5f2f8;           /* surface-container-low — карточки */\n  --sf-surface-2: #efecf2;         /* surface-container — вложенные блоки */\n  --sf-surface-3: #e9e6ec;         /* surface-container-high — hover вложенных */\n  --sf-surface-4: #e3e1e6;         /* surface-container-highest — активные вкладки */\n  --sf-surface-hover: #efecf2;     /* hover карточки: на ступень темнее */\n  --sf-line: rgba(77, 67, 84, 0.16);\n  --sf-text: #1b1b1d;              /* on-surface */\n  --sf-text-2: #4d4354;            /* on-surface-variant */\n  --sf-text-3: #7e7387;            /* outline */\n  --sf-primary: #842bd2;           /* текст/иконки акцента */\n  --sf-primary-hover: #6900b3;\n  --sf-primary-soft: rgba(132, 43, 210, 0.08);\n  --sf-primary-line: rgba(132, 43, 210, 0.28);\n  --sf-primary-fill: #842bd2;      /* заливка главной кнопки */\n  --sf-primary-on: #ffffff;\n  --sf-accent-grad: linear-gradient(135deg, #8f45e0 0%, #6a1fb5 100%);               /* заливка активных кнопок */\n  --sf-accent-soft: linear-gradient(135deg, rgba(132, 43, 210, 0.16), rgba(132, 43, 210, 0.04)); /* неактивные кнопки */\n  --sf-secondary: #6001d1;\n  --sf-secondary-container: #eaddff;\n  --sf-on-secondary-container: #25005a;\n  --sf-secondary-soft: rgba(96, 1, 209, 0.07);\n  --sf-tint: var(--sf-primary-soft);   /* оттенок градиента карточки; у типов (аудио, видео…) переопределяется */\n  --sf-tertiary: #00658a;\n  --sf-tertiary-soft: rgba(0, 101, 138, 0.1);\n  --sf-danger: #ba1a1a;\n  --sf-danger-soft: rgba(186, 26, 26, 0.1);\n  --sf-glow: 0 6px 24px -4px rgba(132, 43, 210, 0.18);\n  --sf-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);\n  --sf-heat-0: #ebe7ef; --sf-heat-1: #e0d0f5; --sf-heat-2: #c29cf0; --sf-heat-3: #a468e6; --sf-heat-4: #842bd2;\n\n  --sf-r: 0.5rem;          /* lg: поля, кнопки */\n  --sf-r-sm: 0.25rem;      /* DEFAULT: чипы-правила */\n  --sf-r-lg: 0.75rem;      /* xl: вложенные блоки */\n  --sf-r-xl: 1rem;         /* 2xl: карточки */\n  --sf-r-pill: 9999px;\n  --sf-gutter: 1rem;\n  --sf-gutter-lg: 1.5rem;\n  --sf-pad: 1.25rem;\n  --sf-quote-size: calc(17px / 1.5); /* размер текста цитаты: прежние 17px, уменьшенные в 1.5 раза */\n\n  --sf-font-head: \"Geist\", \"Inter\", var(--font-interface), system-ui, sans-serif;\n  --sf-font-body: \"Inter\", var(--font-text), system-ui, sans-serif;\n  --sf-font-mono: \"JetBrains Mono\", var(--font-monospace), ui-monospace, SFMono-Regular, Menlo, monospace;\n}\n\n.sf-root[data-sf-theme=\"dark\"], .sf-fab[data-sf-theme=\"dark\"], .sf-modal[data-sf-theme=\"dark\"],\nbody.theme-dark .sf-root[data-sf-theme=\"auto\"], body.theme-dark .sf-fab[data-sf-theme=\"auto\"], body.theme-dark .sf-modal[data-sf-theme=\"auto\"] {\n  --sf-canvas: #131315;\n  --sf-surface: #1b1b1d;\n  --sf-surface-2: #1f1f21;\n  --sf-surface-3: #2a2a2c;\n  --sf-surface-4: #353437;\n  --sf-surface-hover: #1f1f21;\n  --sf-line: rgba(77, 67, 84, 0.5);\n  --sf-text: #e4e2e4;\n  --sf-text-2: #cfc2d6;\n  --sf-text-3: #988d9f;\n  --sf-primary: #ddb7ff;\n  --sf-primary-hover: #f0dbff;\n  --sf-primary-soft: rgba(221, 183, 255, 0.1);\n  --sf-primary-line: rgba(221, 183, 255, 0.28);\n  --sf-primary-fill: #ddb7ff;\n  --sf-primary-on: #490080;\n  --sf-accent-grad: linear-gradient(135deg, #f0dbff 0%, #ddb7ff 45%, #b76dff 100%);\n  --sf-accent-soft: linear-gradient(135deg, rgba(221, 183, 255, 0.2), rgba(221, 183, 255, 0.05));\n  --sf-secondary: #d2bbff;\n  --sf-secondary-container: #6001d1;\n  --sf-on-secondary-container: #c9aeff;\n  --sf-secondary-soft: rgba(210, 187, 255, 0.1);\n  --sf-tertiary: #7bd0ff;\n  --sf-tertiary-soft: rgba(123, 208, 255, 0.12);\n  --sf-danger: #ffb4ab;\n  --sf-danger-soft: rgba(255, 180, 171, 0.12);\n  --sf-glow: 0 6px 24px -4px rgba(0, 0, 0, 0.5);\n  --sf-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);\n  --sf-heat-0: #222225; --sf-heat-1: #3b2a5a; --sf-heat-2: #5b2f9a; --sf-heat-3: #8a45e6; --sf-heat-4: #ddb7ff;\n}\n","10-base.css":"/* 10-base.css — корень, типографика, кнопки, чипы, поля ввода, служебные состояния. */\n.sf-root { color: var(--sf-text); background: var(--sf-root-bg, transparent); font-family: var(--sf-font-body); font-size: 14px; line-height: 22px; border-radius: var(--sf-r-xl); padding: var(--sf-gutter) var(--sf-gutter-lg) var(--sf-gutter-lg); max-width: 1600px; margin: 0 auto; box-sizing: border-box; position: relative; overflow-x: clip; }\n.sf-root *, .sf-root *::before, .sf-root *::after { box-sizing: border-box; }\n:where(.sf-root) button { font: inherit; color: inherit; background: none; border: 0; box-shadow: none; cursor: pointer; padding: 0; height: auto; }\n:where(.sf-root) h1, :where(.sf-root) h2, :where(.sf-root) h3, :where(.sf-root) p { margin: 0; }\n.sf-root h1, .sf-root h2, .sf-root h3 { font-family: var(--sf-font-head); color: var(--sf-text); border: 0; }\n.sf-root h1 { font-size: 28px; line-height: 36px; font-weight: 600; letter-spacing: -0.02em; }\n.sf-root a { text-decoration: none; }\n.sf-icon { display: inline-flex; align-items: center; justify-content: center; flex: none; line-height: 0; }\n.sf-flip svg { transform: rotate(180deg); }\n.sf-muted { color: var(--sf-text-3); font-size: 12px; display: inline-flex; align-items: center; gap: 4px; }\n.sf-view { display: flex; flex-direction: column; gap: var(--sf-gutter-lg); min-height: 200px; }\n.sf-error { background: var(--sf-danger-soft); color: var(--sf-danger); padding: 1rem; border-radius: var(--sf-r); white-space: pre-wrap; font-family: var(--sf-font-mono); font-size: 12px; }\n\n/* Ширина страницы: frontmatter `cssclasses: sf-page` (до 1600px). Полная ширина — см. 15-fullwidth.css */\n.sf-page .markdown-preview-sizer, .sf-page .markdown-preview-sizer.markdown-preview-section { max-width: 1600px !important; width: 100% !important; }\n.sf-page .cm-contentContainer, .sf-page .cm-sizer { max-width: 1600px !important; }\n\n/* Кнопки */\n.sf-btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: var(--sf-r); background: var(--sf-surface-2); color: var(--sf-text); font-family: var(--sf-font-mono); font-weight: 500; font-size: 12px; letter-spacing: 0.02em; transition: background 0.15s, color 0.15s, box-shadow 0.15s; }\n.sf-btn:hover { background: var(--sf-surface-3); }\n.sf-btn--primary { background: var(--sf-accent-grad); color: var(--sf-primary-on); border-radius: var(--sf-r-pill); padding: 0 18px; font-family: var(--sf-font-head); font-size: 14px; box-shadow: var(--sf-glow); }\n.sf-btn--primary:hover { background: var(--sf-accent-grad); filter: brightness(1.08); }\n.sf-btn--ghost { background: transparent; color: var(--sf-text-2); }\n.sf-btn--ghost:hover { background: var(--sf-surface-3); color: var(--sf-text); }\n.sf-btn--danger { color: var(--sf-danger); background: var(--sf-danger-soft); }\n.sf-btn--danger:hover { background: var(--sf-danger-soft); filter: brightness(1.15); }\n.sf-btn--sm { height: 28px; padding: 0 10px; font-size: 11px; }\n.sf-iconbtn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: 32px; height: 32px; border-radius: var(--sf-r); color: var(--sf-text-3); transition: background 0.15s, color 0.15s; }\n.sf-iconbtn:hover { color: var(--sf-text); background: var(--sf-surface-3); }\n.sf-iconbtn.is-active { color: var(--sf-primary); background: var(--sf-primary-soft); }\n.sf-link { color: var(--sf-primary); font-family: var(--sf-font-mono); font-size: 11px; }\n.sf-link:hover { text-decoration: underline; }\n\n/* Чипы */\n.sf-chip { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 9px; border-radius: var(--sf-r-pill); background: var(--sf-surface-2); color: var(--sf-text-2); font-family: var(--sf-font-mono); font-size: 11px; letter-spacing: 0.04em; white-space: nowrap; transition: all 0.15s; }\n.sf-chip.is-clickable { cursor: pointer; }\n.sf-chip.is-clickable:hover { background: var(--sf-surface-3); color: var(--sf-text); }\n.sf-chip.is-active { background: var(--sf-secondary-container); color: var(--sf-on-secondary-container); }\n.sf-chip--not.is-active { background: var(--sf-danger-soft); color: var(--sf-danger); }\n.sf-chip--rule { height: 22px; border-radius: var(--sf-r-sm); background: var(--sf-surface-2); color: var(--sf-secondary); font-size: 12px; letter-spacing: 0; }\n.sf-chip--rule.is-active { background: var(--sf-primary-soft); color: var(--sf-primary); }\n.sf-chip__count { opacity: 0.6; }\n.sf-chip__x { display: inline-flex; cursor: pointer; opacity: 0.7; } .sf-chip__x:hover { opacity: 1; }\n\n.sf-badge { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 8px; border-radius: var(--sf-r-pill); font-family: var(--sf-font-mono); font-size: 10.5px; letter-spacing: 0.04em; background: var(--sf-surface-3); color: var(--sf-text-2); }\n.sf-badge--source { background: var(--sf-tertiary-soft); color: var(--sf-tertiary); }\n.sf-badge--video, .sf-badge--canvas { background: var(--sf-secondary-container); color: var(--sf-on-secondary-container); }\n.sf-badge--audio { background: var(--sf-tertiary-soft); color: var(--sf-tertiary); }\n.sf-count-pill { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: var(--sf-r-pill); background: var(--sf-surface-3); color: var(--sf-primary); font-family: var(--sf-font-mono); font-size: 12px; font-weight: 500; }\n\n/* Поля ввода */\n.sf-field { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }\n.sf-field--grow { flex: 1 1 220px; }\n.sf-field > label { font-family: var(--sf-font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sf-text-3); }\n.sf-field__chips { display: flex; flex-wrap: wrap; gap: 6px; }\n.sf-input, .sf-select { height: 34px; padding: 0 10px; border-radius: var(--sf-r); border: 0; background: var(--sf-surface-2); color: var(--sf-text); font: inherit; font-size: 13px; width: 100%; box-shadow: none; }\n.sf-input::placeholder { color: var(--sf-text-3); }\n.sf-input:focus, .sf-select:focus { outline: none; background: var(--sf-surface-3); box-shadow: 0 0 0 1px var(--sf-primary-line); }\n.sf-input--sm { height: 28px; font-family: var(--sf-font-mono); font-size: 12px; width: 150px; }\n.sf-input-wrap { display: flex; align-items: center; gap: 6px; color: var(--sf-text-3); background: var(--sf-surface); border-radius: var(--sf-r); padding-left: 10px; }\n.sf-input-wrap .sf-input { background: transparent; padding-left: 0; box-shadow: none; }\n.sf-input-wrap:focus-within { background: var(--sf-surface-2); }\n.sf-range-wrap { display: flex; align-items: center; gap: 10px; height: 34px; }\n.sf-range { flex: 1; accent-color: var(--sf-primary); }\n.sf-range__val { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-2); min-width: 44px; }\n\n.sf-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 3rem 1rem; color: var(--sf-text-3); text-align: center; }\n.sf-empty__title { font-family: var(--sf-font-head); font-size: 18px; color: var(--sf-text-2); }\n.sf-empty__hint { max-width: 560px; font-family: var(--sf-font-mono); font-size: 12px; }\n.sf-skeleton { display: flex; flex-direction: column; gap: 8px; } .sf-skeleton i { display: block; height: 10px; border-radius: 5px; background: linear-gradient(90deg, var(--sf-surface-2), var(--sf-surface-3), var(--sf-surface-2)); background-size: 200% 100%; animation: sf-shimmer 1.4s infinite; } .sf-skeleton i:nth-child(2) { width: 85%; } .sf-skeleton i:nth-child(3) { width: 60%; }\n@keyframes sf-shimmer { to { background-position: -200% 0; } }\n.sf-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--sf-surface-4); color: var(--sf-text); padding: 8px 16px; border-radius: var(--sf-r); box-shadow: var(--sf-glow); z-index: 100; font-size: 13px; }\n\n/* Кнопка «Наверх»: fixed в <body> (см. ui/common/scroll-top.js), положение задаёт JS по прокручиваемой области */\n.sf-fab { position: fixed; right: 16px; bottom: 20px; z-index: 40; transition: opacity 0.2s, transform 0.2s; }\n.sf-fab.is-hidden { opacity: 0; transform: translateY(8px); pointer-events: none; }\n.sf-fab__btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: var(--sf-accent-grad); color: var(--sf-primary-on); box-shadow: var(--sf-glow); cursor: pointer; border: 0; padding: 0; transition: transform 0.15s, filter 0.15s; }\n.sf-fab__btn:hover { filter: brightness(1.08); transform: translateY(-2px); }\n\n/* Защита от горизонтальной прокрутки (планшет): flex/grid-потомки могут сжиматься, длинное содержимое не раздвигает блок */\n.sf-view, .sf-toolbar > *, .sf-toolbar__controls, .sf-panel, .sf-panel__head, .sf-panel__details, .sf-formula, .sf-tagbuilder, .sf-advanced, .sf-quickbar { min-width: 0; max-width: 100%; }\n.sf-root.is-forced-desktop { overflow-x: visible; }\n\n/* Длинные слова и теги не раздвигают блок: чипы сжимаются с многоточием, заголовки переносятся */\n.sf-chip { max-width: 100%; min-width: 0; }\n.sf-chip__text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.sf-chip__count, .sf-chip__x, .sf-chip .sf-icon { flex: none; }\n.sf-card__title, .sf-richlink__title, .sf-preset__titles h3 { overflow-wrap: anywhere; }\n.sf-richlink__title { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\n/* flex-контейнеры с чипами должны уметь сжиматься (иначе длинный тег раздвигает карточку) */\n.sf-card__tags, .sf-card__footer, .sf-tagbuilder__tags, .sf-formula__body, .sf-preset__rules, .sf-msummary, .sf-sumchip { min-width: 0; max-width: 100%; }\n","12-host.css":"/* 12-host.css — размещение в Obsidian: вкладка плагина (ItemView), code-блок ```journal-stream```, окно истории версий. */\n.sf-view-host { padding: 0 !important; }\n.sf-view-host > .sf-root { min-height: 100%; }\n\n.sf-codeblock { margin: 0; }\n.sf-block-warn { margin: 0 0 8px; padding: 6px 10px; border-radius: 10px; font-size: 12px; color: var(--text-error); background: var(--background-secondary); }\n\n.sf-changelog .modal-content { max-height: 70vh; overflow-y: auto; }\n.sf-changelog h3 { margin-top: 1.2em; }\n","15-fullwidth.css":"/* 15-fullwidth.css — режим «на всю ширину».\n   Включается: config.fullWidth = true, параметром code-блока (fullWidth: true), кнопкой ⤢ в навигации\n   или вручную через frontmatter заметки `cssclasses: sf-page-full`.\n   Число колонок карточек задаётся в настройках: columns.min / columns.max / minCardWidth. */\n.sf-root.is-full { max-width: none; width: 100%; border-radius: 0; }\n\n/* Снимаем ограничение ширины строки у самой заметки (reading view и live preview) */\n.sf-page-full { --file-line-width: 100%; }\n.sf-page-full .markdown-preview-sizer,\n.sf-page-full .markdown-preview-sizer.markdown-preview-section { max-width: none !important; width: 100% !important; margin-inline: 0 !important; }\n.sf-page-full .cm-sizer { max-width: none !important; width: 100% !important; }\n.sf-page-full .cm-contentContainer,\n.sf-page-full .cm-content { max-width: none !important; width: 100% !important; margin-inline: 0 !important; }\n.sf-page-full.markdown-preview-view { padding-inline: var(--sf-gutter, 1rem); }\n","20-shell.css":"/* 20-shell.css — верхняя панель (как header в dashboard), шапка экрана, сегменты. */\n\n\n/* Навигация и верхние кнопки: скруглённые «пилюли» в цвет акцента с градиентом.\n   Неактивные — мягкий градиент, активная — полная заливка градиентом. Вкладки растянуты на всю ширину шапки. */\n.sf-nav { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 4px 0 var(--sf-gutter); margin-bottom: var(--sf-gutter); }\n.sf-nav__tabs { display: flex; flex-wrap: wrap; flex: 1 1 380px; min-width: 0; gap: 8px; padding: 2px; }\n.sf-nav__tab { flex: 1 0 auto; min-width: 64px; padding: 9px 18px; border-radius: var(--sf-r-pill); text-align: center; background: var(--sf-accent-soft), var(--sf-surface-2); color: var(--sf-primary); box-shadow: inset 0 0 0 1px var(--sf-primary-soft); font-family: var(--sf-font-mono); font-size: 12px; font-weight: 500; white-space: nowrap; transition: box-shadow 0.15s, filter 0.15s, transform 0.15s; }\n.sf-nav__tab:hover { box-shadow: inset 0 0 0 1px var(--sf-primary-line); filter: brightness(1.1); }\n.sf-nav__tab.is-active { background: var(--sf-accent-grad); color: var(--sf-primary-on); box-shadow: var(--sf-glow); font-weight: 700; }\n.sf-nav__tab .sf-nav__short { display: none; }\n.sf-root.is-compact .sf-nav__tab.has-short .sf-nav__full { display: none; }\n.sf-root.is-compact .sf-nav__tab.has-short .sf-nav__short { display: inline; }\n.sf-nav__right { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px; margin-left: auto; min-width: 0; }\n.sf-nav__right .sf-iconbtn, .sf-toolbar__controls .sf-iconbtn { width: 34px; height: 34px; border-radius: 50%; background: var(--sf-accent-soft), var(--sf-surface-2); color: var(--sf-primary); box-shadow: inset 0 0 0 1px var(--sf-primary-soft); }\n.sf-nav__right .sf-iconbtn:hover, .sf-toolbar__controls .sf-iconbtn:hover { box-shadow: inset 0 0 0 1px var(--sf-primary-line); filter: brightness(1.1); }\n.sf-nav__right .sf-iconbtn.is-active { background: var(--sf-accent-grad); color: var(--sf-primary-on); box-shadow: var(--sf-glow); }\n.sf-themebtn { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0; border-radius: 50%; background: var(--sf-accent-soft), var(--sf-surface-2); color: var(--sf-primary); box-shadow: inset 0 0 0 1px var(--sf-primary-soft); transition: box-shadow 0.15s, filter 0.15s; }\n.sf-themebtn:hover { box-shadow: inset 0 0 0 1px var(--sf-primary-line); filter: brightness(1.1); }\n.sf-toolbar__controls > .sf-dropdown > .sf-btn { border-radius: var(--sf-r-pill); background: var(--sf-accent-soft), var(--sf-surface-2); color: var(--sf-primary); box-shadow: inset 0 0 0 1px var(--sf-primary-soft); }\n\n.sf-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sf-gutter); flex-wrap: wrap; }\n.sf-toolbar__spacer { flex: 1; }\n.sf-toolbar__title { display: flex; flex-direction: column; gap: 4px; min-width: 0; }\n.sf-toolbar__h1 { display: flex; align-items: center; gap: var(--sf-gutter); }\n.sf-toolbar__controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }\n.sf-crumbs { display: flex; align-items: center; gap: 8px; font-family: var(--sf-font-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--sf-primary); }\n.sf-crumbs__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--sf-primary); animation: sf-ping 2s infinite; }\n.sf-crumbs__sep { color: var(--sf-text-3); }\n.sf-crumbs__sync { display: inline-flex; align-items: center; gap: 4px; color: var(--sf-text-3); text-transform: none; letter-spacing: 0.02em; }\n@keyframes sf-ping { 50% { opacity: 0.35; } }\n\n.sf-segmented { display: inline-flex; gap: 6px; padding: 0; background: none; }\n.sf-segmented__btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: var(--sf-r-pill); background: var(--sf-accent-soft), var(--sf-surface-2); color: var(--sf-primary); box-shadow: inset 0 0 0 1px var(--sf-primary-soft); font-family: var(--sf-font-mono); font-size: 11px; transition: box-shadow 0.15s, filter 0.15s; }\n.sf-segmented__btn:hover { box-shadow: inset 0 0 0 1px var(--sf-primary-line); filter: brightness(1.1); }\n.sf-segmented__btn.is-active { background: var(--sf-accent-grad); color: var(--sf-primary-on); box-shadow: var(--sf-glow); }\n\n/* Бейдж версии (ссылка на «Историю версий» в README) */\n.sf-version { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: var(--sf-r-pill); background: var(--sf-accent-soft), var(--sf-surface-2); color: var(--sf-primary); font-family: var(--sf-font-mono); font-size: 11px; letter-spacing: 0.02em; transition: background 0.15s, color 0.15s; }\n.sf-version:hover { background: var(--sf-surface-3); color: var(--sf-primary); }\n.sf-footer { display: flex; align-items: center; justify-content: center; gap: 6px; padding-top: var(--sf-gutter); font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); }\n\n/* Порядок по времени: «Новые ↓» / «Старые ↑» */\n.sf-sortbtn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: var(--sf-r-pill); background: var(--sf-accent-soft), var(--sf-surface-2); color: var(--sf-primary); box-shadow: inset 0 0 0 1px var(--sf-primary-soft); font-family: var(--sf-font-mono); font-size: 12px; transition: box-shadow 0.15s, filter 0.15s; }\n.sf-sortbtn:hover { box-shadow: inset 0 0 0 1px var(--sf-primary-line); filter: brightness(1.1); }\n.sf-sortbtn.is-asc { background: var(--sf-accent-grad); color: var(--sf-primary-on); box-shadow: var(--sf-glow); }\n\n/* ---------- Мобильная шапка ленты/бенто: «Фильтры» + сводка ---------- */\n.sf-mbar { display: flex; flex-direction: column; gap: 10px; }\n.sf-mbar__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }\n.sf-mfilter { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: var(--sf-r-pill); background: var(--sf-accent-grad); color: var(--sf-primary-on); box-shadow: var(--sf-glow); font-family: var(--sf-font-head); font-size: 15px; font-weight: 600; }\n.sf-mfilter .sf-panel__badge { background: var(--sf-primary-on); color: var(--sf-primary); }\n.sf-msummary { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; cursor: pointer; }\n.sf-msummary__none { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); }\n.sf-sumchip { max-width: 100%; padding: 3px 10px; border-radius: var(--sf-r-pill); background: var(--sf-accent-soft), var(--sf-surface-2); color: var(--sf-primary); box-shadow: inset 0 0 0 1px var(--sf-primary-soft); font-family: var(--sf-font-mono); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.sf-sumchip--more { color: var(--sf-text-2); }\n\n/* Кнопка «Настройки» в шапке на телефоне (вместо ряда переключателей) и строки настроек в окне */\n.sf-nav__gear, .sf-nav__plus { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; flex: none; border-radius: 50%; background: var(--sf-accent-soft), var(--sf-surface-2); color: var(--sf-primary); box-shadow: inset 0 0 0 1px var(--sf-primary-soft); }\n.sf-setrow { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 0 14px; border-radius: var(--sf-r-lg); background: var(--sf-surface); color: var(--sf-text); text-align: left; font-size: 14px; }\n.sf-setrow .sf-icon { color: var(--sf-primary); }\n.sf-setrow__label { flex: 1; min-width: 0; }\n.sf-setrow__state { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); }\n.sf-setrow.is-on .sf-setrow__state { color: var(--sf-primary); font-weight: 700; }\n\n/* ---------- выравнивание по вертикали ----------\n   Поиск с диапазоном дат может занимать две строки — кнопки справа выравниваем по строке поля поиска (сверху), а не по центру блока. */\n.sf-toolbar { align-items: flex-start; }\n.sf-toolbar__controls { align-items: flex-start; flex: 1 1 auto; justify-content: flex-end; }\n.sf-toolbar__controls > :not(.sf-search) { margin-top: 1px; }\n.sf-toolbar__controls > .sf-search { flex: 1 1 360px; max-width: 560px; margin-right: auto; }\n.sf-nav { align-items: flex-start; }\n.sf-nav__right { padding-top: 4px; }\n.sf-root.is-compact .sf-toolbar__controls > :not(.sf-search) { margin-top: 0; }\n.sf-root.is-mobile .sf-toolbar__controls > :not(.sf-search) { margin-top: 0; }\n.sf-root.is-mobile .sf-nav__right { padding-top: 0; }\n\n/* ---------- кнопка «Новая заметка» ---------- */\n.sf-newnote { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border-radius: var(--sf-r-pill); background: var(--sf-accent-grad); color: var(--sf-primary-on); box-shadow: var(--sf-glow); font-family: var(--sf-font-mono); font-size: 12px; font-weight: 700; white-space: nowrap; }\n.sf-newnote:hover { filter: brightness(1.08); }\n.sf-nav__plus { background: var(--sf-accent-grad); color: var(--sf-primary-on); box-shadow: var(--sf-glow); }\n\n/* ---------- контраст кнопок с градиентом ----------\n   Текст на заливке всегда берёт --sf-primary-on (тёмный на светлой заливке тёмной темы, белый на насыщенной заливке светлой);\n   правило жёсткое, чтобы стили темы Obsidian для button не делали подпись бледной. */\n.sf-root .sf-newnote, .sf-root .sf-newnote *, .sf-root .sf-nav__tab.is-active, .sf-root .sf-nav__plus, .sf-root .sf-btn--primary,\n.sf-root .sf-segmented__btn.is-active, .sf-root .sf-sortbtn.is-asc, .sf-root .sf-mfilter, .sf-root .sf-tagtab.is-active { color: var(--sf-primary-on) !important; opacity: 1; }\n","30-filters.css":"/* 30-filters.css — быстрые режимы (pills), панель фильтров, формула, теги и автодополнение. */\n.sf-quickbar { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; align-items: center; }\n.sf-quick { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: var(--sf-r-pill); background: var(--sf-surface); color: var(--sf-text-2); font-family: var(--sf-font-mono); font-size: 12px; font-weight: 500; white-space: nowrap; transition: background 0.15s, color 0.15s; }\n.sf-quick:hover { background: var(--sf-surface-2); color: var(--sf-text); }\n.sf-quick.is-active { background: var(--sf-secondary-container); color: var(--sf-on-secondary-container); }\n.sf-quick--today .sf-icon { color: var(--sf-tertiary); }\n.sf-quick__count { font-size: 11px; opacity: 0.75; }\n.sf-shuffle { margin-left: 4px; }\n\n.sf-panel { display: flex; flex-direction: column; gap: 12px; padding: var(--sf-pad); background: var(--sf-surface); border-radius: var(--sf-r-xl); box-shadow: var(--sf-shadow); }\n.sf-panel__head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }\n.sf-panel__head .sf-formula { flex: 1 1 320px; }\n.sf-panel__actions { display: flex; gap: 6px; }\n.sf-panel__details { display: flex; flex-direction: column; gap: 14px; }\n.sf-panel.is-collapsed .sf-panel__details { display: none; }\n\n.sf-formula { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: var(--sf-r-lg); background: var(--sf-surface-2); min-height: 40px; }\n.sf-formula__body { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; flex: 1; min-width: 0; }\n.sf-formula__empty { color: var(--sf-text-3); font-size: 12px; font-family: var(--sf-font-mono); }\n.sf-formula__paren { font-family: var(--sf-font-mono); color: var(--sf-text-3); }\n.sf-formula__op { font-family: var(--sf-font-mono); font-size: 10.5px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: var(--sf-surface-4); }\n.sf-formula__op--or { color: var(--sf-primary); } .sf-formula__op--and { color: var(--sf-tertiary); } .sf-formula__op--not { color: var(--sf-danger); }\n\n.sf-tagbuilder { display: flex; flex-direction: column; gap: 10px; }\n.sf-tagbuilder__head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }\n.sf-tagbuilder__title { font-family: var(--sf-font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sf-text-3); }\n.sf-tagbuilder__modes { display: inline-flex; gap: 2px; padding: 3px; background: var(--sf-surface-2); border-radius: var(--sf-r); }\n.sf-modebtn { padding: 3px 10px; border-radius: var(--sf-r-sm); font-family: var(--sf-font-mono); font-size: 10.5px; color: var(--sf-text-2); }\n.sf-modebtn.is-active { background: var(--sf-surface-4); color: var(--sf-primary); }\n.sf-modebtn--all.is-active { color: var(--sf-tertiary); } .sf-modebtn--not.is-active { color: var(--sf-danger); }\n.sf-tagbuilder__tags { display: flex; flex-wrap: wrap; gap: 6px; }\n\n/* Ввод тега с автодополнением */\n.sf-tagadd { position: relative; display: inline-flex; align-items: center; gap: 2px; margin: 0; }\n.sf-tagadd__input { width: 190px; font-size: 16px; } /* 16px на мобильных: Safari не увеличивает страницу при фокусе */\n.sf-tagadd__btn { width: 30px; height: 30px; background: var(--sf-surface-2); }\n.sf-suggest { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; min-width: 240px; max-width: min(340px, 90vw); max-height: 280px; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; background: var(--sf-surface-3); border-radius: var(--sf-r-lg); box-shadow: var(--sf-glow); }\n.sf-suggest__item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 10px; min-height: 38px; border-radius: var(--sf-r); text-align: left; color: var(--sf-text); font-family: var(--sf-font-mono); font-size: 12px; }\n.sf-suggest__item:hover, .sf-suggest__item.is-active { background: var(--sf-surface-4); }\n.sf-suggest__item.is-used .sf-suggest__tag { color: var(--sf-primary); }\n.sf-suggest__count { color: var(--sf-text-3); }\n.sf-suggest__new { color: var(--sf-primary); justify-content: flex-start; }\n\n.sf-attrs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }\n.sf-attrs__label { font-family: var(--sf-font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sf-text-3); margin-right: 2px; }\n.sf-attrs__sep { width: 1px; height: 18px; background: var(--sf-line); margin: 0 6px; }\n.sf-advanced { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; padding-top: 12px; border-top: 1px solid var(--sf-line); }\n\n/* Наборы тегов: Топ · Случайные · За год · Этот день */\n.sf-tagtabs { display: flex; flex-wrap: wrap; gap: 6px; }\n.sf-tagtab { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: var(--sf-r-pill); background: var(--sf-surface-2); color: var(--sf-text-2); font-family: var(--sf-font-mono); font-size: 11px; transition: background 0.15s, color 0.15s; }\n.sf-tagtab:hover { color: var(--sf-text); background: var(--sf-surface-3); }\n.sf-tagtab.is-active { background: var(--sf-accent-grad); color: var(--sf-primary-on); }\n","35-menu.css":"/* 35-menu.css — поиск, выпадающее меню «Подборки», кнопка с подтверждением. */\n.sf-search { display: flex; align-items: center; gap: 8px; min-width: 220px; flex: 0 1 300px; }\n.sf-search .sf-input-wrap { flex: 1; }\n.sf-search__status { font-family: var(--sf-font-mono); font-size: 10.5px; color: var(--sf-text-3); white-space: nowrap; }\n.sf-search__clear { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; margin-right: 4px; border-radius: var(--sf-r-sm); color: var(--sf-text-3); }\n.sf-search__clear:hover { color: var(--sf-text); background: var(--sf-surface-3); }\n.sf-search input[type=\"search\"]::-webkit-search-cancel-button { display: none; }\n\n.sf-dropdown { position: relative; display: inline-flex; }\n.sf-menu { position: absolute; top: calc(100% + 6px); z-index: 50; width: 320px; max-width: calc(100vw - 32px); padding: 8px; background: var(--sf-surface-3); border-radius: var(--sf-r-lg); box-shadow: var(--sf-glow); display: flex; flex-direction: column; gap: 6px; }\n.sf-menu--right { right: 0; } .sf-menu--left { left: 0; }\n.sf-menu__title { font-family: var(--sf-font-mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sf-text-3); padding: 4px 8px; }\n.sf-menu__list { display: flex; flex-direction: column; gap: 2px; max-height: 280px; overflow-y: auto; }\n.sf-menu__row { display: flex; align-items: center; gap: 2px; border-radius: var(--sf-r); }\n.sf-menu__row.is-active { background: var(--sf-primary-soft); }\n.sf-menu__item { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; padding: 8px; border-radius: var(--sf-r); text-align: left; color: var(--sf-text); }\n.sf-menu__item:hover, .sf-menu__row:hover { background: var(--sf-surface-4); }\n.sf-menu__item .sf-icon { color: var(--sf-primary); }\n.sf-menu__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.sf-menu__count { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); }\n.sf-menu__empty { padding: 10px 8px; color: var(--sf-text-3); font-size: 12px; }\n.sf-menu__save { display: flex; flex-direction: column; gap: 6px; padding: 8px; border-top: 1px solid var(--sf-line); }\n.sf-menu__hint { font-size: 12px; color: var(--sf-text-2); }\n.sf-menu__saverow { display: flex; gap: 6px; }\n.sf-menu__link { align-self: flex-start; padding: 4px 8px; font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-primary); }\n.sf-menu__link:hover { text-decoration: underline; }\n\n.sf-iconbtn.is-armed, .sf-btn.is-armed { width: auto; padding: 0 10px; background: var(--sf-danger-soft); color: var(--sf-danger); }\n.sf-confirm__text { font-family: var(--sf-font-mono); font-size: 11px; white-space: nowrap; }\n.sf-iconbtn.is-disabled, .sf-btn.is-disabled, .sf-btn:disabled { opacity: 0.45; cursor: not-allowed; }\n\n/* Диапазон дат рядом с поиском: три независимых параметра (текст · от · до) */\n.sf-search { flex-wrap: wrap; flex: 0 1 auto; }\n.sf-search .sf-input-wrap { flex: 1 1 240px; min-width: 200px; }\n.sf-daterange { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; max-width: 100%; }\n.sf-date { display: inline-flex; align-items: center; gap: 6px; padding-left: 10px; border-radius: var(--sf-r); background: var(--sf-surface); color: var(--sf-text-3); font-family: var(--sf-font-mono); font-size: 11px; }\n.sf-date:focus-within { background: var(--sf-surface-2); }\n.sf-date .sf-date__input { width: 132px; max-width: 100%; padding-left: 0; background: transparent; color: var(--sf-text); font-family: var(--sf-font-mono); font-size: 12px; }\n.sf-root[data-sf-theme=\"dark\"] .sf-date__input, body.theme-dark .sf-root[data-sf-theme=\"auto\"] .sf-date__input { color-scheme: dark; }\n.sf-search--panel { width: 100%; }\n","36-modal.css":"/* 36-modal.css — модальное окно «Фильтры» (мобильная версия). Живёт в <body>: position: fixed, токены из data-sf-theme. */\n.sf-modal { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end; justify-content: center; background: rgba(0, 0, 0, 0.55); }\n.sf-modal__sheet { display: flex; flex-direction: column; width: 100%; max-width: 620px; max-height: 94vh; max-height: 94dvh; background: var(--sf-canvas); color: var(--sf-text); border-radius: var(--sf-r-xl) var(--sf-r-xl) 0 0; box-shadow: var(--sf-glow); overflow: hidden; font-family: var(--sf-font-body); }\n.sf-modal__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 16px 10px; border-bottom: 1px solid var(--sf-line); }\n.sf-modal__title { margin: 0; font-family: var(--sf-font-head); font-size: 18px; font-weight: 600; color: var(--sf-text); }\n.sf-modal__close { width: 38px; height: 38px; }\n.sf-modal__root.sf-root { max-width: none; margin: 0; padding: 0; border-radius: 0; background: none; overflow-y: auto; overflow-x: clip; flex: 1; min-height: 0; overscroll-behavior: contain; }\n.sf-modal__body { display: flex; flex-direction: column; gap: 18px; padding: 14px 16px 20px; min-width: 0; }\n.sf-modal__footer { display: flex; align-items: center; gap: 8px; padding: 10px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid var(--sf-line); background: var(--sf-canvas); }\n.sf-modal__show { flex: 1; justify-content: center; }\n.sf-modal__refresh { flex: none; background: var(--sf-surface-2); }\n.sf-msec { display: flex; flex-direction: column; gap: 8px; min-width: 0; }\n.sf-msec__title { margin: 0; font-family: var(--sf-font-mono); font-size: 10.5px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sf-text-3); }\n.sf-msec__row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }\n/* внутри окна ничего не прокручивается вбок: режимы и теги переносятся */\n.sf-modal .sf-quickbar { flex-wrap: wrap; overflow: visible; margin: 0; padding: 0; }\n.sf-modal .sf-dropdown { position: relative; }\n.sf-modal .sf-dropdown > .sf-btn { width: auto; }\n.sf-modal .sf-menu { left: 0; right: 0; width: auto; max-width: none; }\n.sf-modal .sf-search { width: 100%; }\n.sf-modal .sf-formula { flex-wrap: wrap; }\n@media (min-width: 640px) { .sf-modal { align-items: center; } .sf-modal__sheet { border-radius: var(--sf-r-xl); max-height: 88vh; } }\n","37-popup.css":"/* 37-popup.css — плавающее окно просмотра заметки (режим «Открывать заметки в плавающем окне»).\n   Затемнение (overlay) на весь экран в <body>, окно по центру; перетаскивается за заголовок, размер меняется за правый нижний угол. */\n.sf-npop-overlay { position: fixed; inset: 0; z-index: 55; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(8, 6, 14, 0.62); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); animation: sfNpopFade 0.14s ease-out; }\n@keyframes sfNpopFade { from { opacity: 0; } to { opacity: 1; } }\n.sf-npop.sf-root { position: relative; flex: none; width: min(720px, calc(100vw - 48px)); height: min(78vh, 800px); min-width: 300px; min-height: 220px; max-width: 94vw; max-height: 92vh;\n  display: flex; flex-direction: column; padding: 0; margin: 0; overflow: hidden; resize: both; border-radius: var(--sf-r-lg, 16px);\n  background: var(--sf-canvas); color: var(--sf-text); box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45), inset 0 0 0 1px var(--sf-line); }\n.sf-npop__head { display: flex; align-items: center; gap: 6px; padding: 10px 12px; cursor: move; border-bottom: 1px solid var(--sf-line); background: var(--sf-surface); user-select: none; touch-action: none; }\n.sf-npop__title { flex: 1; min-width: 0; margin: 0; font-family: var(--sf-font-head); font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }\n.sf-npop__head .sf-iconbtn { flex: none; width: 32px; height: 32px; }\n.sf-npop__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 14px 0; font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); }\n.sf-npop__meta:empty { display: none; }\n.sf-npop__meta .sf-chip { max-width: 100%; }\n.sf-npop__body { flex: 1; min-height: 0; overflow: auto; padding: 8px 18px 24px; user-select: text; overflow-wrap: anywhere; }\n.sf-npop__body img, .sf-npop__body video { max-width: 100%; height: auto; border-radius: 10px; }\n.sf-npop__body .frontmatter, .sf-npop__body .metadata-container { display: none; }\n@media (max-width: 700px) {\n  .sf-npop-overlay { padding: 0; align-items: flex-end; }\n  .sf-npop.sf-root { width: 100vw; height: 88vh; max-width: none; max-height: none; border-radius: 16px 16px 0 0; resize: none; }\n  .sf-npop__head { cursor: default; }\n}\n","40-card.css":"/* 40-card.css — карточка поста (как карточки dashboard): surface-container-low, радиус 1rem, без рамки;\n   при наведении фон на ступень светлее; клик по карточке открывает заметку. */\n.sf-card { display: flex; flex-direction: column; gap: 12px; padding: var(--sf-pad); background: linear-gradient(155deg, var(--sf-tint) 0%, rgba(0, 0, 0, 0) 62%), var(--sf-surface); border-radius: var(--sf-r-xl); box-shadow: var(--sf-shadow); transition: background 0.18s, box-shadow 0.18s; min-width: 0; }\n.sf-card.is-clickable { cursor: pointer; }\n.sf-card:hover { background: linear-gradient(155deg, var(--sf-tint) 0%, var(--sf-tint) 10%, rgba(0, 0, 0, 0) 78%), var(--sf-surface-hover); box-shadow: var(--sf-glow); }\n.sf-card--audio { --sf-tint: var(--sf-tertiary-soft); }\n.sf-card--video, .sf-card--canvas { --sf-tint: var(--sf-secondary-soft); }\n.sf-card--quote { --sf-tint: var(--sf-primary-soft); }\n.sf-card:hover .sf-chip:not(.is-active) { background: var(--sf-surface-3); }\n.sf-card.is-pinned { box-shadow: inset 0 0 0 1px var(--sf-primary-line); }\n.sf-card__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }\n.sf-card__date { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); letter-spacing: 0.04em; }\n.sf-card__meta { display: flex; align-items: center; gap: 4px; }\n.sf-card__meta .sf-iconbtn { width: 26px; height: 26px; }\n.sf-card__title { font-family: var(--sf-font-head); font-size: 20px; line-height: 28px; font-weight: 500; letter-spacing: -0.015em; color: var(--sf-text); }\n.sf-card__title:hover { color: var(--sf-primary); }\n.sf-card__body { display: flex; flex-direction: column; gap: 10px; min-width: 0; }\n.sf-card__text { font-size: 14px; line-height: 22px; color: var(--sf-text); overflow-wrap: anywhere; }\n.sf-card__text > :first-child { margin-top: 0; } .sf-card__text > :last-child { margin-bottom: 0; }\n.sf-card__text img { max-width: 100%; border-radius: var(--sf-r-sm); }\n.sf-card__text a.internal-link, .sf-richlink a.internal-link { color: var(--sf-primary); background: var(--sf-primary-soft); font-family: var(--sf-font-mono); font-size: 0.92em; border-radius: 4px; padding: 1px 5px; text-decoration: none; transition: filter 0.15s; }\n.sf-card__text a.internal-link:hover { filter: brightness(1.2); }\n.sf-card__text a.tag { color: var(--sf-secondary); background: var(--sf-surface-2); font-family: var(--sf-font-mono); font-size: 0.9em; border-radius: var(--sf-r-pill); padding: 1px 8px; cursor: pointer; }\n.sf-card__text a.external-link { color: var(--sf-tertiary); }\n.sf-card__text pre { background: var(--sf-surface-2); border-radius: var(--sf-r); font-size: 12.5px; }\n.sf-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-top: auto; padding-top: 4px; }\n.sf-card__tags { display: flex; flex-wrap: wrap; gap: 5px; }\n.sf-card__tagmore { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); align-self: center; }\n.sf-card__stats { display: flex; align-items: center; gap: 10px; font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); }\n.sf-card__backlinks { display: inline-flex; align-items: center; gap: 4px; color: var(--sf-tertiary); }\n.sf-card__stats .sf-iconbtn { width: 26px; height: 26px; }\n.sf-media-missing { padding: 10px 12px; border-radius: var(--sf-r); background: var(--sf-danger-soft); color: var(--sf-danger); font-size: 12px; font-family: var(--sf-font-mono); }\n","41-card-types.css":"/* 41-card-types.css — тела карточек по типам: цитата, аудио, видео, фото, canvas, задачи, ссылка, rich-link. */\n.sf-quote { position: relative; margin: 0; padding: 12px 14px 12px 16px; border-left: 2px solid var(--sf-primary-line); background: var(--sf-surface-2); border-radius: 0 var(--sf-r-lg) var(--sf-r-lg) 0; }\n.sf-quote__mark { position: absolute; top: 10px; right: 12px; color: var(--sf-primary); opacity: 0.3; }\n.sf-quote__text { font-family: var(--sf-font-body); font-size: var(--sf-quote-size); line-height: 1.5; font-weight: 400; font-style: italic; color: var(--sf-text-2); }\n.sf-quote__text > :first-child { margin-top: 0; } .sf-quote__text > :last-child { margin-bottom: 0; }\n.sf-quote__cite { display: block; margin-top: 8px; font-style: normal; font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); }\n\n.sf-audio { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--sf-r-lg); background: var(--sf-surface-2); }\n.sf-audio__btn { width: 36px; height: 36px; border-radius: 50%; background: var(--sf-primary-fill); color: var(--sf-primary-on); display: inline-flex; align-items: center; justify-content: center; flex: none; transition: background 0.15s; }\n.sf-audio__btn:hover, .sf-audio__btn.is-playing { background: var(--sf-primary-hover); }\n.sf-audio__wave { display: flex; align-items: center; gap: 2px; height: 34px; flex: 1; cursor: pointer; min-width: 0; }\n.sf-audio__bar { flex: 1; min-width: 2px; border-radius: 2px; background: var(--sf-surface-4); transition: background 0.1s; }\n.sf-audio__bar.is-played { background: var(--sf-tertiary); }\n.sf-audio__time { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-tertiary); white-space: nowrap; }\n.sf-audio audio { display: none; }\n\n.sf-video { position: relative; border-radius: var(--sf-r-lg); overflow: hidden; background: #000; }\n.sf-video video { display: block; width: 100%; max-height: 340px; }\n.sf-video__badge { position: absolute; top: 8px; left: 8px; padding: 2px 8px; border-radius: var(--sf-r-pill); background: rgba(0, 0, 0, 0.6); color: #fff; font-family: var(--sf-font-mono); font-size: 10.5px; pointer-events: none; }\n\n/* Картинки: centerCrop. Рамка имеет фиксированные пропорции, картинка заполняет её (object-fit: cover по центру) и\n   НЕ реагирует на наведение — ни масштаба, ни сдвига, ни фильтров (раньше hover-эффект «двигал» картинку). */\n.sf-images { display: grid; gap: 4px; border-radius: var(--sf-r-lg); overflow: hidden; aspect-ratio: 16 / 10; background: var(--sf-surface-2); }\n.sf-images--1 { grid-template-columns: 1fr; grid-template-rows: 1fr; }\n.sf-images--2 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }\n.sf-images--3 { grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; } .sf-images--3 .sf-images__cell:first-child { grid-row: span 2; }\n.sf-images--4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }\n.sf-images__cell { position: relative; display: block; min-width: 0; min-height: 0; overflow: hidden; background: var(--sf-surface-2); }\n.sf-images__cell img, .sf-card img { transform: none !important; transition: none !important; filter: none !important; }\n.sf-images__cell img { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; object-fit: cover; object-position: 50% 50%; display: block; }\n.sf-images__more { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.55); color: #fff; font-family: var(--sf-font-head); font-size: 22px; font-weight: 600; }\n\n.sf-canvas { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: var(--sf-r-lg); background: var(--sf-surface-2); color: var(--sf-text); transition: background 0.15s; }\n.sf-canvas:hover { background: var(--sf-surface-3); }\n.sf-canvas .sf-icon { color: var(--sf-primary); }\n.sf-canvas__name { font-family: var(--sf-font-mono); font-size: 12px; flex: 1; overflow: hidden; text-overflow: ellipsis; }\n.sf-canvas__open { display: inline-flex; align-items: center; gap: 4px; font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-primary); }\n\n.sf-progress { height: 4px; border-radius: 2px; background: var(--sf-surface-4); overflow: hidden; }\n.sf-progress__bar { height: 100%; background: var(--sf-primary); transition: width 0.3s; }\n.sf-tasks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }\n.sf-tasks__item { display: flex; align-items: flex-start; gap: 8px; font-size: 13.5px; }\n.sf-tasks__box { width: 16px; height: 16px; flex: none; margin-top: 3px; border: 1px solid var(--sf-text-3); border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; color: var(--sf-primary-on); }\n.sf-tasks__item.is-done .sf-tasks__box { background: var(--sf-primary-fill); border-color: var(--sf-primary-fill); }\n.sf-tasks__item.is-done > span:last-child { color: var(--sf-text-3); text-decoration: line-through; }\n.sf-tasks__more { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); }\n\n.sf-extlink { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--sf-r-lg); background: var(--sf-surface-2); color: var(--sf-text-2); transition: background 0.15s; }\n.sf-extlink:hover { background: var(--sf-surface-3); }\n.sf-extlink__main { display: flex; flex-direction: column; flex: 1; min-width: 0; }\n.sf-extlink__host { font-family: var(--sf-font-head); font-weight: 500; color: var(--sf-text); }\n.sf-extlink__url { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n\n/* Rich-link: строка «заметка» как во вложенных блоках dashboard (surface-container, hover — container-high) */\n.sf-richlink { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: var(--sf-r-lg); background: var(--sf-surface-2); color: var(--sf-text); transition: background 0.15s; }\n.sf-richlink:hover { background: var(--sf-surface-3); }\n.sf-richlink__icon { display: inline-flex; width: 28px; height: 28px; border-radius: var(--sf-r); background: var(--sf-primary-soft); color: var(--sf-primary); align-items: center; justify-content: center; flex: none; }\n.sf-richlink--audio .sf-richlink__icon, .sf-richlink--video .sf-richlink__icon { background: var(--sf-tertiary-soft); color: var(--sf-tertiary); }\n.sf-richlink__main { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }\n.sf-richlink__title { font-family: var(--sf-font-head); font-weight: 500; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.sf-richlink:hover .sf-richlink__title { color: var(--sf-primary); }\n.sf-richlink__excerpt { font-size: 12px; line-height: 18px; color: var(--sf-text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\n.sf-richlink__excerpt:empty { display: none; }\n.sf-richlink__meta { font-family: var(--sf-font-mono); font-size: 10.5px; color: var(--sf-text-3); }\n.sf-richlink__out { color: var(--sf-text-3); flex: none; }\n","45-skeleton.css":"/* 45-skeleton.css — шиммеры загрузки карточек (вместо пустого места, пока строится лента). */\n.sf-shim { display: block; height: 10px; border-radius: 5px; background: linear-gradient(90deg, var(--sf-surface-2), var(--sf-surface-4), var(--sf-surface-2)); background-size: 200% 100%; animation: sf-shimmer 1.4s infinite linear; }\n.sf-shim--pill { width: 56px; height: 20px; border-radius: var(--sf-r-pill); }\n.sf-shim--media { width: 100%; height: 120px; border-radius: var(--sf-r-lg); }\n.sf-skelgrid { display: grid; gap: var(--sf-gutter-lg); align-items: start; }\n.sf-root.is-mobile .sf-skelgrid { gap: 14px; }\n.sf-skelcard { display: flex; flex-direction: column; gap: 12px; padding: var(--sf-pad); border-radius: var(--sf-r-xl); background: linear-gradient(155deg, var(--sf-tint) 0%, rgba(0, 0, 0, 0) 62%), var(--sf-surface); box-shadow: var(--sf-shadow); }\n.sf-root.is-mobile .sf-skelcard { padding: 14px; border-radius: var(--sf-r-lg); }\n.sf-skelcard__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }\n.sf-tilegrid .sf-skelgrid { position: relative; }\n@media (prefers-reduced-motion: reduce) { .sf-shim, .sf-skeleton i { animation: none; } }\n","50-feed.css":"/* 50-feed.css — раскладки ленты. Число колонок и позиции плиток считает JS (config.columns, minCardWidth). */\n.sf-feed-region { min-width: 0; }\n.sf-feed { display: flex; flex-direction: column; gap: var(--sf-gutter-lg); align-items: stretch; }\n.sf-loadmore { align-self: center; }\n\n/* Плитки (Masonry, Bento, Подборки): абсолютное позиционирование, порядок — слева направо, затем сверху вниз */\n.sf-tilegrid { position: relative; min-width: 0; width: 100%; }\n.sf-tilegrid__item { position: absolute; top: 0; left: 0; min-width: 0; width: 100%; }\n.sf-tilegrid.is-pending .sf-tilegrid__item { visibility: hidden; }\n.sf-tilegrid__item > .sf-card, .sf-tilegrid__item > .sf-preset { width: 100%; }\n.sf-tilegrid--bento .sf-card { padding: var(--sf-pad); }\n.sf-tilegrid--bento .sf-video video { max-height: 360px; }\n\n/* Timeline: вертикальная лента по дням; внутри дня по две карточки в ряд одинаковой высоты, не помещаются — по одной */\n.sf-feed--timeline { align-items: center; }\n.sf-timeline__group { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: var(--sf-gutter); width: 100%; max-width: 1060px; }\n.sf-timeline__label { position: sticky; top: 8px; align-self: start; display: flex; flex-direction: column; gap: 2px; padding-left: 18px; font-family: var(--sf-font-head); font-weight: 500; color: var(--sf-text); }\n.sf-timeline__dot { position: absolute; left: 0; top: 6px; width: 10px; height: 10px; border-radius: 50%; background: var(--sf-primary); box-shadow: 0 0 0 4px var(--sf-primary-soft); }\n.sf-timeline__key { font-family: var(--sf-font-mono); font-size: 10.5px; font-weight: 400; color: var(--sf-text-3); }\n.sf-timeline__items { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: var(--sf-gutter); align-items: stretch; border-left: 1px solid var(--sf-line); padding-left: var(--sf-gutter); margin-left: -4px; min-width: 0; }\n.sf-timeline__items > .sf-card { height: 100%; }\n","60-overview.css":"/* 60-overview.css — «Обзор» по макету: пульс месяца (график, стрик, связи, медиа), озарения, годовой срез. */\n.sf-hero { display: flex; flex-direction: column; gap: 6px; }\n.sf-hero p { color: var(--sf-text-2); }\n.sf-hero--row { flex-direction: row; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 12px; }\n.sf-section { display: flex; flex-direction: column; gap: 16px; }\n.sf-section__title { font-size: 20px; line-height: 28px; font-weight: 500; letter-spacing: -0.015em; }\n.sf-section__row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }\n.sf-section__lead { display: flex; align-items: center; gap: 12px; min-width: 0; flex-wrap: wrap; }\n.sf-section__dot { width: 12px; height: 12px; border-radius: 50%; background: var(--sf-primary); flex: none; }\n.sf-section__dot.is-secondary { background: var(--sf-secondary); } .sf-section__dot.is-tertiary { background: var(--sf-tertiary); }\n.sf-section__aside { display: inline-flex; align-items: center; gap: 8px; font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); }\n.sf-section__aside .sf-icon { color: var(--sf-tertiary); }\n.sf-pill { padding: 2px 10px; border-radius: var(--sf-r-pill); background: var(--sf-surface-3); color: var(--sf-secondary); font-family: var(--sf-font-mono); font-size: 11px; }\n\n/* --- Пульс месяца: 4 карточки --- */\n.sf-pulse__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sf-gutter); }\n.sf-pcard, .sf-card-block { background: linear-gradient(155deg, var(--sf-tint) 0%, rgba(0, 0, 0, 0) 62%), var(--sf-surface); border-radius: var(--sf-r-xl); box-shadow: var(--sf-shadow); transition: background 0.18s, box-shadow 0.18s; }\n.sf-pcard:hover, .sf-card-block:hover { background: linear-gradient(155deg, var(--sf-tint) 0%, var(--sf-tint) 10%, rgba(0, 0, 0, 0) 78%), var(--sf-surface-hover); }\n.sf-pcard { display: flex; flex-direction: column; gap: 6px; padding: var(--sf-pad); min-width: 0; }\n.sf-pcard__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }\n.sf-pcard__label { margin: 0; font-family: var(--sf-font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sf-text-3); }\n.sf-pcard__value { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; font-family: var(--sf-font-head); font-size: 34px; line-height: 40px; font-weight: 600; letter-spacing: -0.03em; }\n.sf-pcard__unit { font-family: var(--sf-font-body); font-size: 13px; font-weight: 400; letter-spacing: 0; color: var(--sf-text-2); }\n.sf-pcard__unit.is-tertiary, .is-tertiary { color: var(--sf-tertiary); } .sf-pcard__unit.is-primary, .is-primary { color: var(--sf-primary); } .is-secondary { color: var(--sf-secondary); }\n.sf-pcard__trend { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--sf-r-pill); background: var(--sf-surface-2); color: var(--sf-tertiary); font-family: var(--sf-font-mono); font-size: 11px; }\n.sf-pcard__trend.is-down { color: var(--sf-danger); }\n.sf-pcard__badge { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--sf-r-lg); background: var(--sf-secondary-container); color: var(--sf-on-secondary-container); }\n.sf-pcard__badge.is-plain { background: var(--sf-surface-2); color: var(--sf-tertiary); }\n.sf-pcard__body { display: flex; flex-direction: column; gap: 8px; margin-top: auto; padding-top: 10px; }\n.sf-pcard__axis { display: flex; justify-content: space-between; gap: 8px; font-family: var(--sf-font-mono); font-size: 10.5px; color: var(--sf-text-3); }\n.sf-pcard__axis span:nth-child(2):not(:last-child) { text-align: center; flex: 1; }\n.sf-pcard__note { margin: 0; font-family: var(--sf-font-mono); font-size: 10.5px; color: var(--sf-text-3); }\n\n.sf-spark { position: relative; height: 56px; color: var(--sf-primary); }\n.sf-spark svg { width: 100%; height: 100%; overflow: visible; display: block; }\n.sf-spark__dot { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: var(--sf-primary); box-shadow: 0 0 0 4px var(--sf-primary-soft); animation: sf-ping 2s infinite; }\n\n.sf-streak { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }\n.sf-streak__day { display: flex; align-items: center; justify-content: center; aspect-ratio: 1; border-radius: 50%; background: var(--sf-surface-3); color: var(--sf-text-3); font-family: var(--sf-font-mono); font-size: 10px; font-weight: 600; }\n.sf-streak__day.is-on { background: var(--sf-primary-fill); color: var(--sf-primary-on); }\n.sf-streak__day.is-today { box-shadow: 0 0 0 3px var(--sf-primary-soft); }\n.sf-streak__day.is-today.is-on { background: var(--sf-primary-hover); animation: sf-ping 2s infinite; }\n\n.sf-bar { height: 8px; border-radius: var(--sf-r-pill); background: var(--sf-surface-3); overflow: hidden; }\n.sf-bar__fill { height: 100%; border-radius: var(--sf-r-pill); background: var(--sf-tertiary); }\n.sf-segbar { display: flex; gap: 2px; height: 10px; padding: 2px; border-radius: var(--sf-r-pill); background: var(--sf-surface-3); overflow: hidden; }\n.sf-seg { height: 100%; border-radius: var(--sf-r-pill); min-width: 0; }\n.sf-seg.is-photo, .sf-legend__dot.is-photo { background: var(--sf-primary); }\n.sf-seg.is-video, .sf-legend__dot.is-video { background: var(--sf-tertiary); }\n.sf-seg.is-audio, .sf-legend__dot.is-audio { background: var(--sf-secondary-container); }\n.sf-seg.is-empty { background: transparent; }\n.sf-legend { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px 10px; font-family: var(--sf-font-mono); font-size: 10.5px; color: var(--sf-text); }\n.sf-legend__item { display: inline-flex; align-items: center; gap: 6px; }\n.sf-legend__dot { width: 8px; height: 8px; border-radius: 50%; }\n\n.sf-tagstrip { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 16px; padding: 14px var(--sf-pad); background: var(--sf-surface); border-radius: var(--sf-r-xl); }\n.sf-tagstrip__label { display: inline-flex; align-items: center; gap: 8px; font-family: var(--sf-font-mono); font-size: 12px; color: var(--sf-text-3); }\n.sf-tagstrip__tags { display: flex; flex-wrap: wrap; gap: 8px; }\n\n/* --- Случайные озарения --- */\n.sf-insights { min-width: 0; }\n.sf-insights__tools { display: flex; align-items: center; gap: 8px; }\n.sf-insights__count .sf-segmented__btn { padding: 3px 11px; }\n\n/* --- Годовой срез: карта активности + типы --- */\n.sf-yearly { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: var(--sf-gutter-lg); align-items: stretch; }\n.sf-card-block { display: flex; flex-direction: column; gap: 14px; padding: var(--sf-pad); min-width: 0; }\n.sf-block__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }\n.sf-block__title { font-size: 18px; line-height: 26px; font-weight: 500; letter-spacing: -0.01em; }\n.sf-block__sub { margin: 2px 0 0; max-width: 560px; font-size: 12px; line-height: 18px; color: var(--sf-text-3); }\n.sf-block__stat { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-2); text-align: right; }\n.sf-block__stat strong { font-size: 18px; color: var(--sf-primary); }\n.sf-block__stat span { color: var(--sf-text-3); }\n\n/* Карта активности: одна сетка (подписи дней · недели), квадратные ячейки тянутся по ширине — прокрутка не нужна на любом экране */\n.sf-heat__wrap { max-width: calc(26px + var(--cols, 53) * 22px); }\n.sf-heat { --gap: 3px; display: grid; grid-template-columns: 22px repeat(var(--cols), minmax(0, 1fr)); grid-template-rows: 14px repeat(7, auto); gap: var(--gap); width: 100%; font-family: var(--sf-font-mono); font-size: 9.5px; color: var(--sf-text-3); }\n.sf-heat__daylabel { align-self: center; line-height: 1; }\n.sf-heat__month { white-space: nowrap; line-height: 14px; overflow: visible; }\n.sf-heat__cell { width: 100%; aspect-ratio: 1; min-width: 0; border-radius: 3px; background: var(--sf-heat-0); display: block; }\n.sf-heat__legend .sf-heat__cell { width: 12px; flex: none; }\n.sf-heat__cell.lv--1 { background: transparent; }\n.sf-heat__cell.lv-1 { background: var(--sf-heat-1); } .sf-heat__cell.lv-2 { background: var(--sf-heat-2); } .sf-heat__cell.lv-3 { background: var(--sf-heat-3); } .sf-heat__cell.lv-4 { background: var(--sf-heat-4); }\n.sf-heat__cell.is-click { cursor: pointer; } .sf-heat__cell.is-click:hover { outline: 2px solid var(--sf-primary-line); outline-offset: 1px; }\n.sf-heat__legend { display: flex; align-items: center; gap: 4px; margin-top: auto; font-family: var(--sf-font-mono); font-size: 10.5px; color: var(--sf-text-3); justify-content: flex-end; }\n.sf-heat__legend span:first-child { margin-right: 4px; } .sf-heat__legend span:last-child { margin-left: 4px; }\n\n.sf-dist { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }\n.sf-donut { position: relative; flex: none; }\n.sf-donut svg { display: block; }\n.sf-donut__track { stroke: var(--sf-surface-3); }\n.sf-donut__center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; font-family: var(--sf-font-mono); font-size: 10.5px; color: var(--sf-text-3); }\n.sf-donut__center span { display: flex; flex-direction: column; line-height: 1.2; } .sf-donut__center strong { font-family: var(--sf-font-head); font-size: 22px; color: var(--sf-text); }\n.sf-donut__seg--text, .sf-dist__dot.is-text { stroke: var(--sf-primary); background: var(--sf-primary); }\n.sf-donut__seg--image, .sf-dist__dot.is-image { stroke: var(--sf-secondary); background: var(--sf-secondary); }\n.sf-donut__seg--video, .sf-dist__dot.is-video { stroke: var(--sf-tertiary); background: var(--sf-tertiary); }\n.sf-donut__seg--audio, .sf-dist__dot.is-audio { stroke: var(--sf-on-secondary-container); background: var(--sf-on-secondary-container); }\n.sf-donut__seg--quote, .sf-dist__dot.is-quote { stroke: #f59e0b; background: #f59e0b; }\n.sf-donut__seg--tasks, .sf-dist__dot.is-tasks { stroke: #4ade80; background: #4ade80; }\n.sf-donut__seg--link, .sf-dist__dot.is-link { stroke: var(--sf-danger); background: var(--sf-danger); }\n.sf-donut__seg--canvas, .sf-dist__dot.is-canvas { stroke: var(--sf-text-3); background: var(--sf-text-3); }\n.sf-dist__list { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 140px; }\n.sf-dist__row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: var(--sf-r); text-align: left; font-size: 13px; transition: background 0.15s; }\n.sf-dist__row:hover { background: var(--sf-surface-2); }\n.sf-dist__dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }\n.sf-dist__name { flex: 1; } .sf-dist__count { font-family: var(--sf-font-mono); font-size: 12px; } .sf-dist__pct { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); min-width: 34px; text-align: right; }\n","65-stats.css":"/* 65-stats.css — экран «Статистика»: плитки-итоги, столбчатые диаграммы, рекорды, самые длинные записи. */\n.sf-stats { display: flex; flex-direction: column; gap: var(--sf-gutter); min-width: 0; }\n.sf-stats__lead { margin: 0; color: var(--sf-text-2); }\n.sf-stats__period { display: flex; }\n\n.sf-statiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sf-gutter); }\n.sf-statile { display: flex; flex-direction: column; gap: 4px; padding: var(--sf-pad); border-radius: var(--sf-r-xl); background: linear-gradient(155deg, var(--sf-tint) 0%, rgba(0, 0, 0, 0) 62%), var(--sf-surface); min-width: 0; }\n.sf-statile strong { font-family: var(--sf-font-head); font-size: 30px; line-height: 36px; font-weight: 600; letter-spacing: -0.02em; color: var(--sf-primary); }\n.sf-statile.is-secondary strong { color: var(--sf-secondary, var(--sf-primary)); }\n.sf-statile.is-tertiary strong { color: var(--sf-tertiary, var(--sf-primary)); }\n.sf-statile span { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); text-transform: uppercase; letter-spacing: 0.04em; }\n\n.sf-statgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sf-gutter); }\n\n/* столбчатые диаграммы */\n.sf-bars { display: flex; flex-direction: column; gap: 6px; min-width: 0; }\n.sf-bars__plot { display: grid; grid-template-columns: repeat(var(--bars), minmax(0, 1fr)); align-items: end; gap: 3px; }\n.sf-bars__col { display: flex; align-items: flex-end; height: 100%; min-width: 0; }\n.sf-bars__bar { width: 100%; border-radius: 6px 6px 3px 3px; background: var(--sf-primary-soft); box-shadow: inset 0 0 0 1px var(--sf-primary-line); transition: filter 0.15s; }\n.sf-bars__col:hover .sf-bars__bar { filter: brightness(1.25); }\n.sf-bars__col.is-peak .sf-bars__bar { background: var(--sf-accent-grad); box-shadow: var(--sf-glow); }\n.sf-bars__col.is-zero .sf-bars__bar { opacity: 0.5; }\n.sf-bars__axis { display: grid; grid-template-columns: repeat(var(--bars), minmax(0, 1fr)); gap: 3px; font-family: var(--sf-font-mono); font-size: 10.5px; color: var(--sf-text-3); text-align: center; }\n.sf-bars__tick { min-width: 0; overflow: visible; white-space: nowrap; }\n.sf-bars__tick.is-hidden { visibility: hidden; }\n.sf-bars--years .sf-bars__tick { font-size: 10px; }\n\n/* рекорды */\n.sf-recs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--sf-gutter); }\n.sf-rec { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: var(--sf-pad); border-radius: var(--sf-r-xl); background: linear-gradient(155deg, var(--sf-tint) 0%, rgba(0, 0, 0, 0) 62%), var(--sf-surface); text-align: left; min-width: 0; color: var(--sf-text); }\n.sf-rec.is-clickable { cursor: pointer; }\n.sf-rec.is-clickable:hover { background: linear-gradient(155deg, var(--sf-tint) 0%, var(--sf-tint) 10%, rgba(0, 0, 0, 0) 78%), var(--sf-surface-hover); }\n.sf-rec__icon { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 50%; background: var(--sf-primary-soft); color: var(--sf-primary); margin-bottom: 4px; }\n.sf-rec__label { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); text-transform: uppercase; letter-spacing: 0.04em; }\n.sf-rec__value { font-family: var(--sf-font-head); font-size: 20px; line-height: 26px; font-weight: 600; overflow-wrap: anywhere; }\n.sf-rec__sub { font-size: 12px; line-height: 17px; color: var(--sf-text-2); overflow-wrap: anywhere; }\n\n/* самые длинные записи */\n.sf-longest__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }\n.sf-longest__btn { display: flex; align-items: flex-start; gap: 12px; width: 100%; padding: 8px 10px; border-radius: var(--sf-r); text-align: left; color: var(--sf-text); background: none; }\n.sf-longest__btn:hover { background: var(--sf-surface-2); }\n.sf-longest__n { flex: none; width: 22px; font-family: var(--sf-font-mono); font-size: 12px; color: var(--sf-text-3); padding-top: 2px; }\n.sf-longest__main { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }\n.sf-longest__title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.sf-longest__meta { font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); }\n.sf-longest__bar { display: block; height: 4px; border-radius: 2px; background: var(--sf-primary-soft); overflow: hidden; }\n.sf-longest__bar i { display: block; height: 100%; border-radius: 2px; background: var(--sf-accent-grad); }\n.sf-longest__row--skel i { display: block; height: 38px; border-radius: var(--sf-r); background: linear-gradient(90deg, var(--sf-surface-2), var(--sf-surface-3), var(--sf-surface-2)); background-size: 200% 100%; animation: sf-shimmer 1.4s infinite; }\n\n@media (max-width: 1100px) { .sf-recs { grid-template-columns: repeat(3, minmax(0, 1fr)); } }\n.sf-root.is-compact .sf-statiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n.sf-root.is-compact .sf-statgrid { grid-template-columns: 1fr; }\n.sf-root.is-compact .sf-recs { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n.sf-root.is-mobile .sf-statile strong { font-size: 24px; line-height: 30px; }\n.sf-root.is-mobile .sf-recs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }\n.sf-root.is-mobile .sf-rec { padding: 14px; }\n.sf-root.is-mobile .sf-stats__period { width: 100%; }\n.sf-root.is-mobile .sf-stats__period .sf-segmented { width: 100%; }\n.sf-root.is-mobile .sf-stats__period .sf-segmented__btn { flex: 1; justify-content: center; padding: 8px 6px; }\n.sf-root.is-mobile .sf-stats__period .sf-segmented__btn span { display: inline; }\n.sf-root.is-mobile .sf-bars__plot, .sf-root.is-mobile .sf-bars__axis { gap: 2px; }\n.sf-root.is-mobile .sf-rec:last-child:nth-child(odd) { grid-column: 1 / -1; }\n.sf-longest__n.is-year { width: 38px; color: var(--sf-primary); }\n.sf-longest__tabs .sf-segmented__btn { padding: 4px 10px; }\n.sf-root.is-mobile .sf-longest__tabs { width: 100%; }\n.sf-root.is-mobile .sf-longest__tabs .sf-segmented { width: 100%; }\n.sf-root.is-mobile .sf-longest__tabs .sf-segmented__btn { flex: 1; justify-content: center; padding: 7px 4px; }\n.sf-root.is-mobile .sf-longest__tabs .sf-segmented__btn span { display: inline; }\n.sf-stats__years { display: flex; align-items: center; gap: 12px; min-width: 0; }\n.sf-stats__years-label { flex: none; font-family: var(--sf-font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sf-text-3); }\n.sf-stats__years .sf-select { width: auto; min-width: 220px; max-width: 100%; }\n.sf-root.is-mobile .sf-stats__years { flex-direction: column; align-items: stretch; gap: 6px; }\n.sf-root.is-mobile .sf-stats__years .sf-select { width: 100%; min-width: 0; }\n.sf-bars--years .sf-bars__tick { overflow: visible; white-space: nowrap; }\n","70-collections.css":"/* 70-collections.css — карточки смарт-подборок (как блоки в dashboard). Раскладка — общий движок плиток (см. 50-feed.css). */\n.sf-preset { position: relative; display: flex; flex-direction: column; gap: 12px; padding: var(--sf-pad); background: linear-gradient(155deg, var(--sf-tint) 0%, rgba(0, 0, 0, 0) 62%), var(--sf-surface); border-radius: var(--sf-r-xl); box-shadow: var(--sf-shadow); overflow: hidden; transition: background 0.18s, box-shadow 0.18s; }\n.sf-preset.is-clickable { cursor: pointer; }\n.sf-preset:hover { background: linear-gradient(155deg, var(--sf-tint) 0%, var(--sf-tint) 10%, rgba(0, 0, 0, 0) 78%), var(--sf-surface-hover); box-shadow: var(--sf-glow); }\n.sf-preset__glow { position: absolute; top: -64px; right: -64px; width: 224px; height: 224px; border-radius: 50%; background: var(--sf-primary); opacity: 0.1; filter: blur(48px); pointer-events: none; }\n.sf-preset > * { position: relative; }\n.sf-preset > .sf-preset__glow { position: absolute; }\n.sf-preset__head { display: flex; align-items: flex-start; gap: 12px; }\n.sf-preset__icon { color: var(--sf-primary); display: inline-flex; padding-top: 3px; flex: none; }\n.sf-preset__titles { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }\n.sf-preset__titles h3 { font-size: 20px; line-height: 28px; font-weight: 500; letter-spacing: -0.015em; }\n.sf-preset__count { align-self: flex-start; padding: 1px 8px; border-radius: var(--sf-r-pill); background: var(--sf-surface-3); color: var(--sf-primary); font-family: var(--sf-font-mono); font-size: 11px; }\n.sf-preset--hero .sf-preset__count { background: var(--sf-secondary-container); color: var(--sf-on-secondary-container); }\n.sf-preset__tools { display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: var(--sf-r); background: var(--sf-surface-2); }\n.sf-preset__tools .sf-iconbtn { width: 26px; height: 26px; }\n.sf-preset__desc { font-size: 12px; line-height: 18px; color: var(--sf-text-2); }\n.sf-preset__rules { display: flex; flex-wrap: wrap; gap: 6px; }\n.sf-preset__preview { display: flex; flex-direction: column; gap: 8px; }\n.sf-preset__foot { display: flex; align-items: center; gap: 8px; padding-top: 2px; font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-3); }\n.sf-preset__open { display: inline-flex; align-items: center; gap: 4px; font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-primary); }\n.sf-preset:hover .sf-richlink { background: var(--sf-surface-2); }\n.sf-preset:hover .sf-richlink:hover { background: var(--sf-surface-3); }\n","80-studio.css":"/* 80-studio.css — конструктор фильтров и генератор DQL. */\n.sf-studio { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr); gap: var(--sf-gutter-lg); align-items: start; }\n.sf-studio__main, .sf-studio__side { display: flex; flex-direction: column; gap: var(--sf-gutter); min-width: 0; }\n.sf-studio__side { position: sticky; top: 8px; }\n.sf-meta { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; padding: var(--sf-pad); background: var(--sf-surface); border-radius: var(--sf-r-xl); box-shadow: var(--sf-shadow); }\n.sf-iconpick { display: flex; flex-wrap: wrap; gap: 2px; }\n.sf-livepreview, .sf-dqlpanel { display: flex; flex-direction: column; gap: 10px; padding: var(--sf-pad); background: var(--sf-surface); border-radius: var(--sf-r-xl); box-shadow: var(--sf-shadow); }\n.sf-livepreview__head, .sf-dqlpanel__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-family: var(--sf-font-mono); font-size: 11px; color: var(--sf-text-2); }\n.sf-livepreview__list { display: flex; flex-direction: column; gap: 8px; }\n.sf-dql { margin: 0; padding: 12px; border-radius: var(--sf-r-lg); background: var(--sf-surface-2); font-family: var(--sf-font-mono); font-size: 12.5px; line-height: 20px; white-space: pre-wrap; overflow-wrap: anywhere; }\n.sf-dql code { font-family: inherit; background: none; padding: 0; color: var(--sf-text); }\n.sf-dql__kw { color: var(--sf-primary); font-weight: 600; } .sf-dql__str { color: #4ade80; } .sf-dql__fn { color: var(--sf-tertiary); } .sf-dql__num { color: #fbbf24; }\n.sf-root:not([data-sf-theme=\"dark\"]) .sf-dql__str { color: #16803c; }\n.sf-dqlpanel__notes { margin: 0; padding-left: 18px; font-size: 12px; color: var(--sf-text-3); }\n.sf-actionbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px var(--sf-gutter); background: var(--sf-surface); border-radius: var(--sf-r-xl); box-shadow: var(--sf-shadow); position: sticky; top: 8px; z-index: 5; }\n.sf-panel__search { display: flex; }\n.sf-panel__search .sf-search { flex: 1; max-width: none; }\n.sf-search--panel .sf-input-wrap { background: var(--sf-surface-2); }\n","85-responsive.css":"/* 85-responsive.css — адаптивность по ширине САМОГО блока (классы ставит app/shell.js, а не media-запросы окна):\n   .is-compact — < 900px (планшет / узкая панель);  .is-mobile — < config.singleColumnBelow (560px): один столбец, мобильный интерфейс.\n   Число колонок карточек считает JS (config.columns), на телефоне — всегда 1. */\n\n/* ---------- compact: < 900px ---------- */\n.sf-root.is-compact .sf-studio { grid-template-columns: 1fr; }\n.sf-root.is-compact .sf-studio__side { position: static; }\n.sf-root.is-compact .sf-pulse__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n.sf-root.is-compact .sf-yearly { grid-template-columns: 1fr; }\n.sf-root.is-compact .sf-toolbar__controls { width: 100%; }\n.sf-root.is-compact .sf-search { flex: 1 1 240px; }\n.sf-root.is-compact .sf-date .sf-date__input { width: 118px; }\n.sf-root.is-compact .sf-daterange { flex-wrap: wrap; }\n\n/* ---------- mobile: один столбец ---------- */\n.sf-root.is-mobile { padding: 12px 12px calc(16px + env(safe-area-inset-bottom)); border-radius: var(--sf-r-lg); font-size: 15px; -webkit-tap-highlight-color: transparent; }\n.sf-root.is-mobile button, .sf-root.is-mobile a, .sf-root.is-mobile input, .sf-root.is-mobile select { touch-action: manipulation; }\n.sf-root.is-mobile h1 { font-size: 22px; line-height: 28px; }\n.sf-root.is-mobile .sf-section__title { font-size: 18px; line-height: 24px; }\n.sf-root.is-mobile .sf-view { gap: var(--sf-gutter); }\n\n/* поля и кнопки: 16px в полях (iOS не увеличивает страницу при фокусе), крупные цели касания */\n.sf-root.is-mobile .sf-input, .sf-root.is-mobile .sf-select { font-size: 16px; height: 42px; }\n.sf-root.is-mobile .sf-input--sm { height: 40px; }\n.sf-root.is-mobile .sf-btn { height: 42px; }\n.sf-root.is-mobile .sf-btn--sm { height: 34px; }\n.sf-root.is-mobile .sf-iconbtn { width: 38px; height: 38px; }\n.sf-root.is-mobile .sf-chip { height: 30px; padding: 0 12px; }\n.sf-root.is-mobile .sf-chip--rule { height: 24px; padding: 0 8px; }\n\n/* навигация: вкладки — отдельной строкой на всю ширину, ниже справа — версия и переключатели */\n.sf-root.is-mobile .sf-nav { gap: 6px; padding-bottom: 8px; margin-bottom: 4px; }\n.sf-root.is-mobile .sf-nav__tabs { flex: 1 0 100%; }\n.sf-root.is-mobile .sf-nav__tabs { gap: 6px; padding: 0; }\n.sf-root.is-mobile .sf-nav__tab { flex: 1 1 auto; min-width: 0; padding: 9px 10px; min-height: 38px; font-size: 12px; }\n.sf-root.is-mobile .sf-nav__right .sf-iconbtn, .sf-root.is-mobile .sf-toolbar__controls .sf-iconbtn { width: 38px; height: 38px; }\n.sf-root.is-mobile .sf-themebtn { width: 38px; height: 38px; }\n.sf-root.is-mobile .sf-sortbtn { height: 42px; padding: 0 12px; }\n.sf-root.is-mobile .sf-sortbtn span { display: none; }\n.sf-root.is-mobile .sf-tagtab { padding: 7px 12px; }\n\n/* шапка экрана: заголовок, затем поиск на всю ширину, ниже — подборки · раскладка · обновить */\n.sf-root.is-mobile .sf-toolbar { gap: 10px; }\n.sf-root.is-mobile .sf-toolbar__title { width: 100%; }\n.sf-root.is-mobile .sf-crumbs__sync { display: none; }\n.sf-root.is-mobile .sf-toolbar__controls { position: relative; width: 100%; display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 8px; }\n.sf-root.is-mobile .sf-search { grid-column: 1 / -1; min-width: 0; flex: none; }\n.sf-root.is-mobile .sf-search .sf-input-wrap { flex: 1 1 100%; }\n.sf-root.is-mobile .sf-daterange { width: 100%; }\n.sf-root.is-mobile .sf-date { flex: 1; min-width: 0; }\n.sf-root.is-mobile .sf-date .sf-date__input { width: 100%; font-size: 16px; }\n.sf-root.is-mobile .sf-dropdown { position: static; }\n.sf-root.is-mobile .sf-dropdown > .sf-btn { width: 100%; justify-content: center; background: var(--sf-surface-2); }\n.sf-root.is-mobile .sf-segmented__btn { padding: 8px 10px; }\n.sf-root.is-mobile .sf-segmented__btn span { display: none; }  /* только иконки раскладок */\n.sf-root.is-mobile .sf-menu { left: 0; right: 0; width: auto; max-width: none; top: calc(100% + 6px); max-height: 75vh; overflow-y: auto; }\n.sf-root.is-mobile .sf-menu__item { min-height: 44px; }\n.sf-root.is-mobile .sf-menu__list { max-height: 45vh; }\n\n/* быстрые режимы: одна прокручиваемая строка */\n.sf-root.is-mobile .sf-quickbar { margin: 0 -12px; padding: 2px 12px; scroll-snap-type: x proximity; scrollbar-width: none; }\n.sf-root.is-mobile .sf-quickbar::-webkit-scrollbar { display: none; }\n.sf-root.is-mobile .sf-quick { flex: none; padding: 9px 14px; min-height: 38px; scroll-snap-align: start; }\n.sf-root.is-mobile .sf-quick__sub { display: none; }\n\n/* панель фильтров: по умолчанию свёрнута до кнопки «Фильтры (N)» */\n.sf-root.is-mobile .sf-panel { padding: 12px; border-radius: var(--sf-r-lg); gap: 10px; }\n.sf-root.is-mobile .sf-panel__head { flex-direction: column; align-items: stretch; }\n.sf-root.is-mobile .sf-panel__head .sf-formula { flex: none; flex-wrap: wrap; }\n.sf-root.is-mobile .sf-formula__label { display: none; }\n.sf-root.is-mobile .sf-panel__actions { width: 100%; }\n.sf-root.is-mobile .sf-panel__actions .sf-btn { flex: 1; justify-content: center; height: 42px; }\n.sf-panel__badge { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: var(--sf-r-pill); background: var(--sf-secondary-container); color: var(--sf-on-secondary-container); font-size: 11px; }\n.sf-root.is-mobile .sf-tagbuilder__head { flex-direction: column; align-items: stretch; gap: 8px; }\n.sf-root.is-mobile .sf-tagbuilder__modes { align-self: flex-start; }\n.sf-root.is-mobile .sf-modebtn { padding: 7px 10px; }\n.sf-root.is-mobile .sf-tagadd { width: 100%; }\n.sf-root.is-mobile .sf-tagadd__input { flex: 1; width: auto; }\n.sf-root.is-mobile .sf-tagadd__btn { width: 42px; height: 42px; }\n.sf-root.is-mobile .sf-suggest { left: 0; right: 0; max-width: none; min-width: 0; }\n.sf-root.is-mobile .sf-suggest__item { min-height: 44px; }\n.sf-root.is-mobile .sf-advanced .sf-field { min-width: 100%; }\n.sf-root.is-mobile .sf-attrs__sep { display: none; }\n\n/* карточки и плитки: один столбец */\n.sf-root.is-mobile .sf-card { padding: 14px; gap: 10px; border-radius: var(--sf-r-lg); }\n.sf-root.is-mobile .sf-card:active { background: var(--sf-surface-hover); }\n.sf-root.is-mobile .sf-card__title { font-size: 18px; line-height: 26px; }\n.sf-root.is-mobile .sf-card__meta .sf-iconbtn, .sf-root.is-mobile .sf-card__stats .sf-iconbtn { width: 34px; height: 34px; }\n.sf-root.is-mobile .sf-card__footer { gap: 6px; }\n.sf-root.is-mobile .sf-audio__btn { width: 42px; height: 42px; }\n.sf-root.is-mobile .sf-video video { max-height: 260px; }\n.sf-root.is-mobile .sf-richlink { padding: 10px; }\n\n/* Timeline: дата — заголовком над карточками, без левой колонки */\n.sf-root.is-mobile .sf-timeline__group { grid-template-columns: minmax(0, 1fr); gap: 8px; }\n.sf-root.is-mobile .sf-timeline__label { position: relative; top: auto; flex-direction: row; align-items: baseline; gap: 8px; padding-left: 16px; }\n.sf-root.is-mobile .sf-timeline__dot { top: 7px; }\n.sf-root.is-mobile .sf-timeline__items { grid-template-columns: minmax(0, 1fr); border-left: 0; padding-left: 0; margin-left: 0; }\n\n/* обзор */\n.sf-root.is-mobile .sf-pulse__grid { grid-template-columns: 1fr 1fr; gap: 10px; }\n.sf-root.is-mobile .sf-pulse__grid .sf-pcard:first-child { grid-column: 1 / -1; }\n.sf-root.is-mobile .sf-pcard { padding: 14px; }\n.sf-root.is-mobile .sf-pcard__value { font-size: 26px; line-height: 32px; }\n.sf-root.is-mobile .sf-tagstrip { flex-direction: column; align-items: flex-start; }\n.sf-root.is-mobile .sf-yearly { grid-template-columns: 1fr; }\n.sf-root.is-mobile .sf-card-block { padding: 14px; border-radius: var(--sf-r-lg); }\n.sf-root.is-mobile .sf-heat__cell { width: 10px; height: 10px; }\n.sf-root.is-mobile .sf-heat__months { grid-template-columns: repeat(53, 10px); }\n.sf-root.is-mobile .sf-dist { flex-direction: column; align-items: stretch; }\n.sf-root.is-mobile .sf-insights__tools { width: 100%; justify-content: space-between; }\n.sf-root.is-mobile .sf-section__row { flex-wrap: wrap; }\n\n/* подборки */\n.sf-root.is-mobile .sf-hero--row { flex-direction: column; align-items: stretch; }\n.sf-root.is-mobile .sf-hero--row .sf-btn { width: 100%; justify-content: center; height: 44px; }\n.sf-root.is-mobile .sf-preset { padding: 14px; border-radius: var(--sf-r-lg); }\n.sf-root.is-mobile .sf-preset__titles h3 { font-size: 18px; line-height: 24px; }\n.sf-root.is-mobile .sf-preset__tools .sf-iconbtn { width: 34px; height: 34px; }\n.sf-root.is-mobile .sf-preset__glow { width: 140px; height: 140px; top: -40px; right: -40px; }\n\n/* конструктор */\n.sf-root.is-mobile .sf-studio { gap: var(--sf-gutter); }\n.sf-root.is-mobile .sf-meta { padding: 12px; }\n.sf-root.is-mobile .sf-meta .sf-field { min-width: 100%; }\n.sf-root.is-mobile .sf-actionbar { position: static; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; border-radius: var(--sf-r-lg); }\n.sf-root.is-mobile .sf-actionbar .sf-toolbar__spacer { display: none; }\n.sf-root.is-mobile .sf-actionbar .sf-btn { width: 100%; justify-content: center; height: 42px; }\n.sf-root.is-mobile .sf-actionbar .sf-btn--primary { grid-column: 1 / -1; order: -1; }\n.sf-root.is-mobile .sf-livepreview, .sf-root.is-mobile .sf-dqlpanel { padding: 12px; border-radius: var(--sf-r-lg); }\n.sf-root.is-mobile .sf-dql { font-size: 11.5px; }\n\n/* служебное */\n.sf-root.is-mobile .sf-toast { bottom: calc(76px + env(safe-area-inset-bottom)); width: calc(100% - 32px); text-align: center; }\n.sf-root.is-mobile .sf-footer { padding-top: 8px; }\n\n/* ---------- принудительный вид (кнопки 📱 / 🖥 в навигации) ---------- */\n/* Мобильный вид на широком экране: узкая «рамка» по центру, один столбец */\n.sf-root.is-forced-mobile { max-width: 430px; margin-inline: auto; box-shadow: 0 0 0 1px var(--sf-line), var(--sf-glow); }\n/* Десктопный вид на узком экране: блок не уже 760px (страницу можно прокрутить вбок), колонки по config.columns */\n.sf-root.is-forced-desktop { min-width: 760px; }\n\n.sf-fab__btn { touch-action: manipulation; }\n@media (max-width: 767px) { .sf-fab__btn { width: 48px; height: 48px; } }\n","90-custom.css":"/* 90-custom.css — ваши личные переопределения (файл подключается последним).\n   Пример: .sf-root { --sf-primary: #0ea5e9; }  .sf-card { border-radius: 14px; } */\n"},
  readme: "# Journal Stream — плагин Obsidian\n\n**Версия 2.3.5** · [история версий](#история-версий) · исходник версии — `src/app/version.js` и `manifest.json`\n\n![Десктопная версия](img/desktop.png)\n\n![Мобильная версия](img/mobile.png)\n\n> Скриншоты сняты в headless-Chromium на тестовых данных (`tests/browser/layout_check.py --shots`); замените их своими из Obsidian, если хотите.\n\nЛента заметок в виде карточек «как в соцсети» по макетам *Obsidian Journal / Obsidian Stream*: поток (masonry / timeline), Bento-сетка,\nсмарт-подборки, конструктор фильтров с генератором DQL, обзор с пульсом месяца, поиск, мобильный интерфейс.\n**Плагин без зависимостей**: Dataview не нужен, сборщик не нужен — это обычные файлы, которые достаточно скопировать в папку плагинов.\n\n## Установка («скопировал — вставил»)\n\n1. Создайте папку `<vault>/.obsidian/plugins/journal-stream/` и положите в неё **два файла** из архива: `manifest.json` и `main.js`.\n   `main.js` — **собранный, самодостаточный**: все модули, стили и README встроены внутрь, папки `src/` и `css/` для работы не нужны (они в архиве — исходники для разработки).\n   Свои правки стилей: создайте рядом файл `css/90-custom.css` — он подключается последним.\n2. В Obsidian: **Settings → Community plugins** → отключите «Restricted mode», нажмите «Reload plugins» → включите **Journal Stream**.\n3. Откройте ленту: иконка в левой панели (ribbon), команда **«Journal Stream: Открыть ленту»** или код-блок в заметке (см. ниже).\n4. **Settings → Journal Stream** — укажите папки с заметками (по умолчанию `notes`; пусто — весь vault) и остальные параметры.\n\nСтруктура после установки:\n\n```\n.obsidian/plugins/journal-stream/\n├─ manifest.json\n├─ main.js            ← собранный файл: модули, стили и README внутри\n├─ css/90-custom.css  ← по желанию: ваши правки стилей\n└─ data.json          ← создаётся сам: настройки, подборки, избранное, предпочтения UI\n```\n\n> Плагин работает на мобильном Obsidian (`isDesktopOnly: false`). Обновление — замена файлов в папке плагина с сохранением `data.json` и перезагрузка плагина (или Obsidian). Если изменили `css/90-custom.css` — достаточно закрыть и снова открыть вкладку либо изменить любую настройку.\n\n## Как открыть ленту\n\n* **Вкладка**: ribbon-иконка, команда «Открыть ленту» или «Открыть раздел: Обзор / Лента / Бенто / Подборки / Конструктор». Вкладка запоминает раздел, фильтры и прокрутку: открыли заметку, нажали «назад» — вернулись на то же место.\n* **Блок в заметке** — встраивание ленты (например, на дашборд). Команда «Вставить блок journal-stream в заметку» добавляет заготовку.\n\n````markdown\n```journal-stream\nview: stream\ntags: мысли, daily\nexclude: архив\nperiod: 30d\nnav: false\n```\n````\n\nПараметры блока (одна строка — один параметр `ключ: значение`; все необязательны):\n\n| Параметр | Значения | Что делает |\n|---|---|---|\n| `view` | `overview` `stream` `bento` `collections` `stats` `studio` (или по-русски: Обзор, Лента, Бенто, Подборки, Статистика, Конструктор) | стартовый раздел (по умолчанию — из настроек) |\n| `layout` | `masonry` \\| `timeline` | раскладка ленты |\n| `theme` | `auto` \\| `dark` \\| `light` | тема блока |\n| `nav` | `true` \\| `false` | верхняя навигация (false — «чистый» экран без вкладок) |\n| `fullWidth` | `true` \\| `false` | на всю ширину заметки |\n| `openInNewTab` | `true` \\| `false` | открывать заметку по клику на карточку в новой вкладке |\n| `popupView` | `true` \\| `false` | открывать заметку в плавающем окне просмотра |\n| `viewMode` | `auto` \\| `mobile` \\| `desktop` | принудительный вид |\n| `tags` | список через запятую | заметки с любым из тегов (ANY) |\n| `alltags` | список | заметки со всеми тегами (ALL) |\n| `exclude` | список | исключить теги (NOT) |\n| `period` | `7d` `14d` `30d` `90d` `year` `all`… | период |\n| `search` | текст | стартовый поиск |\n| `sort` | `date-desc` `date-asc` `mtime-desc` `backlinks-desc` `length-desc` `alpha-asc` | сортировка |\n| `from` / `to` | `2026-01-01` | диапазон дат |\n| `day` | `2026-10-01` | конкретный день |\n| `id` | любая строка | ключ сохранения состояния: у нескольких блоков в одной заметке задавайте разные |\n\nНеизвестный параметр или непонятная строка не ломают блок — над лентой показывается предупреждение. Можно держать несколько блоков на странице.\nСтраница с блоком по умолчанию растягивается на всю ширину (кнопка ⤢ в навигации переключает); когда вы открываете заметку кликом по карточке, полная ширина с этой страницы снимается.\n\n## Настройки\n\n**Settings → Journal Stream** (применяются сразу к открытым вкладкам; блоки в заметках — при следующей отрисовке). Все значения хранятся в `data.json`; полный список ключей — в таблице ниже.\n\n| Группа | Что настраивается |\n|---|---|\n| Новая заметка | куда складывать (корень / папка / правило с датой), имя файла, открывать ли после создания |\n| Источники | папки с заметками (по одной в строке; пусто — весь vault), исключённые папки и теги, поля даты, откуда брать время, теги избранного и цитат |\n| Вид | раздел по умолчанию, тема, «на всю ширину», открытие заметок в новой вкладке, колонки min/max, минимальная ширина карточки, порог мобильного вида, размер «страницы» (десктоп / телефон), бейдж источника |\n| Поиск и диагностика | фоновая индексация текстов, подробный лог (`debug`) |\n| Данные | «Сбросить всё» (с подтверждением) |\n\n## Экраны\n\n| view | Что это | Из макетов |\n|---|---|---|\n| `overview` | **Пульс месяца** — 4 карточки: график накопления заметок (с динамикой к прошлому месяцу), стрик с кружками последних 7 дней, связи с плотностью графа, медиа (фото / видео / аудио) + полоса трендовых тегов; **случайные озарения** (3 / 6 / 9 / 12 карточек, выбор запоминается; 🎲 перемешивает); **годовой срез** — карта активности с подписями месяцев и дней недели, легендой и сводкой (клик по дню → лента) и кольцевая диаграмма типов заметок (клик по типу → лента) | Overview & Pulse |\n| `stream` | Лента карточек: **строка поиска** (результаты сразу при вводе), меню **«Подборки»**, быстрые режимы (Все / В этот день / Рандомные 🎲 / Избранное), формула фильтра, конструктор тегов ANY/ALL/NOT, атрибуты, раскладки Masonry и Timeline | Flow Stream |\n| `bento` | Те же данные в сетке-мозаике: у каждой плитки своя высота, видео и canvas шире (2 колонки), цитаты и аудио с цветным фоном. **Порядок — слева направо, затем сверху вниз** | Bento Grid |\n| `collections` | Галерея смарт-подборок: правила, счётчик, мини-превью заметок **с двумя строками текста**; **вся карточка кликабельна и открывает подборку в Бенто** (кнопка «Лента» — в ленте); ✎ редактировать, 🗑 удалить (с подтверждением), 🎲 для случайных | Smart Collections |\n| `studio` | Конструктор: название/иконка/режим, теги, атрибуты, период, порог бэклинков, сортировка, источники, поиск; справа — живой отклик (число и время) и готовый **DQL** с копированием. Панель действий вверху: **Сохранить**, **Сохранить как новую**, **Удалить**, Сбросить, Открыть в Бенто | Query Studio / Tag Builder |\n\n## Состояние, прокрутка и сброс\n\n* **Вернулись на страницу** (ушли открыть заметку и нажали «назад»): раздел, фильтры, быстрый режим, раскладка, «Показать ещё», текст поиска и **положение прокрутки** восстанавливаются. Позиция фиксируется в момент клика по карточке, а события прокрутки, которые Obsidian генерирует при смене заметки, игнорируются; восстановление повторяется, пока карточки дорисовываются. Состояние живёт в памяти окна Obsidian и **не пишется на диск** — после перезапуска Obsidian лента стартует с чистого листа.\n* **Вход в раздел через навигацию** (Обзор → Лента → Бенто → Подборки → Фильтры) всегда начинается с дефолта: без фильтров, режим «Все», первая страница, **новый пустой конструктор**.\n* Переходы «с переносом» не сбрасывают ничего: «Открыть подборку», клик по тегу на обзоре, клик по дню на карте активности, клик по типу в диаграмме, «Редактировать» подборку.\n* На диск (в `data.json`, раздел `ui`) сохраняются только предпочтения: раскладка ленты и «на всю ширину».\n\n## Поиск\n\nПоиск **по названию или тексту** есть везде, где есть фильтры: в шапке «Ленты» и «Бенто» и отдельной строкой в панели «Фильтры». Результаты обновляются сразу при вводе (задержка 0,1 с); несколько слов — условие «И»; регистр и «ё/е» не важны.\n\nПочему раньше находились не все записи: пока тексты заметок не прочитаны, поиск видит только заголовки и теги. Теперь индексация текстов стартует **сама** вскоре после открытия ленты (`autoIndex`), одна нечитаемая заметка её не прерывает, ищется весь текст заметки (а не превью), а рядом с полем виден прогресс «индексация N/M»; по завершении результаты пересчитываются автоматически. Если в результатах меньше записей, чем ожидалось, проверьте формулу над лентой (активные условия) и кнопку «Показать ещё» (за раз показывается `pageSize` карточек). Esc или ✕ очищают поле.\n\n**Фильтр дат.** Рядом со строкой поиска два поля даты — «от» и «до». Текст, «от» и «до» — **три независимых параметра**: можно задать любой из них, любые два или все три; при изменении любого фильтр применяется сразу, границы включительны. Условия видны в формуле над лентой (каждое снимается крестиком) и попадают в DQL и в сохраняемые подборки. Дата заметки — та же, что в карточке (поле даты → имя файла → дата создания). Для больших vault индексация читает все заметки один раз за сеанс (⟳ сбрасывает индекс).\n\n## Подборки: меню, сохранение, удаление\n\n* **Меню «Подборки ▾»** в панели ленты/бенто: список сохранённых подборок со счётчиками — клик применяет подборку, не покидая экран. Внизу — поле «Название» и кнопка **Сохранить**: текущий фильтр и режим сохраняются как подборка.\n* **Удаление**: 🗑 в меню, на карточке подборки или кнопка «Удалить» в конструкторе. Первый клик превращает кнопку в «Удалить?», второй — подтверждает (через 2,5 с подтверждение снимается).\n* В **конструкторе** «Сохранить подборку» требует название; для открытой существующей подборки доступны «Сохранить изменения» и «Сохранить как новую».\n* Подборки лежат в `data.json` (`presets`) и правятся руками.\n\n## Раскладки\n\n| | Что делает |\n|---|---|\n| **Masonry** (экран «Лента») | карточки разной высоты; каждая занимает самое короткое место (при равенстве — левее), поэтому порядок читается слева направо и сверху вниз, а высота «строки» ни к чему не привязана. Число колонок — `columns.min…max` по ширине блока |\n| **Timeline** (экран «Лента») | лента по дням с вертикальной линией; внутри дня **по две карточки в ряд одинаковой высоты**, если ширины мало — по одной. Режим Flow удалён как дубликат Timeline (старое значение `flow` читается как `timeline`) |\n| **Bento** (экран «Бенто», а также «Подборки») | тот же движок плиток, но видео/canvas (и первая подборка-«герой») занимают две колонки. Число колонок — те же `columns` |\n\nРазмер текста цитат — `--sf-quote-size` (по умолчанию `calc(17px / 1.5)`), меняется в `css/90-custom.css`.\n\n## Типы карточек\n\nТип определяется автоматически (приоритет сверху вниз), либо явно через frontmatter `type: audio|video|image|quote|tasks|link|canvas|text`.\n\n| Тип | Условие | Тело карточки |\n|---|---|---|\n| video | в заметке встроено видео (`![[x.mp4]]`) | плеер + текст |\n| audio | встроено аудио (`![[x.m4a]]`) | плеер с «волной» и прогрессом + текст |\n| canvas | встроен `.canvas` | плитка «Открыть в Canvas» + текст |\n| image | встроены изображения | сетка до 4 фото в рамке 16:10, centerCrop (обрезка по центру), «+N»; при наведении не меняется |\n| quote | тег из `quoteTags` (`#цитата`…) или цитаты занимают > 40% текста | крупная цитата (`> [!quote] Автор`) + остальной текст |\n| tasks | ≥ 2 задач `- [ ]` | прогресс-бар + первые 6 задач |\n| link | внешний URL и < 45 слов | превью ссылки (домен/адрес) |\n| text | всё остальное | markdown-превью (обрезается «…»; открыть заметку целиком — клик по карточке) |\n\nВики-ссылки `[[…]]` внутри текста стилизуются как в `DESIGN.md` (моно-шрифт, фиолетовая плашка). В подборках и живом отклике заметки показываются как **rich-link** с иконкой типа, датой и числом связей.\n\n**Дата и время** в карточке показываются в формате самих заметок: «1 октября 2024, 16:12». Дата берётся из первого найденного поля `dateFields` (frontmatter), иначе из имени файла (`YYYY-MM-DD`), иначе из даты создания файла. Распознаются форматы `2024-10-01 16:12`, `2024-10-01T16:12`, `01.10.2024 16:12` и русские `1 октября 2024, 16:12` / `1 окт 2024 г. в 16:12`. Если в поле даты нет времени, оно берётся из отдельного поля `time` / `время`; можно также включить `timeFallback: \"ctime\"` (или `\"mtime\"`) — тогда время подставляется из даты создания (изменения) файла. Без времени показывается только дата.\n\n## Клики по карточке\n\nРежим «плавающее окно просмотра» (кнопка-глаз в шапке / настройка `popupView`) открывает заметку в окне чтения поверх ленты — см. v2.2.0; Ctrl/Cmd+клик всегда открывает в редакторе.\n\n* **Клик по карточке** (по свободному месту) открывает заметку; по тегу, ссылке, кнопке, плееру — срабатывает сам элемент. Вкладку выбирает настройка «открывать в новой вкладке» (кнопка в навигации, `openInNewTab`); Ctrl/Cmd+клик или средняя кнопка — всегда новая вкладка.\n* **Клик по тегу** (чип в футере карточки или `#тег` в тексте) применяет тег **на этой странице** как фильтр — глобальный поиск Obsidian не открывается. В «Обзоре» и «Подборках» клик по тегу переносит в ленту с этим фильтром.\n* `[[Вики-ссылки]]` внутри текста открываются по тем же правилам, что и заголовок.\n\n## Мобильная версия\n\nИнтерфейс подстраивается под ширину самого блока: **< 560px** — один столбец и мобильный интерфейс (`is-mobile`), **< 900px** — компактный (`is-compact`). На телефоне экран максимально освобождён — в «Ленте» и «Бенто» остаются только три вещи:\n\n1. **Разделы** — кнопки идут потоком и переносятся на новую строку, если не хватает места (никакой прокрутки); рядом круглая кнопка **⚙ «Настройки»**.\n2. **Кнопка «Фильтры (N)»** — открывает **модальное окно** со всеми фильтрами: условия «Применено», поиск и даты (от/до), режим (Все / В этот день / Рандомные / Избранное), подборки, теги (Топ / Случайные / За год / Этот день), атрибуты, условия (период, связи, сортировка, источники), порядок и вид (Новые/Старые, Masonry/Timeline). Фильтры применяются сразу; нижняя панель: «Сбросить», «Перечитать хранилище» и «Показать N заметок» (закрывает окно). Esc, ✕ или тап по затемнению тоже закрывают его.\n3. **Краткая сводка** применённых условий (подборка, режим, теги, атрибуты, поиск, даты, период…) и число заметок; тап по сводке открывает то же окно. Нет условий — «Без фильтров · сначала новые».\n\n**«Настройки»** (⚙) — окно с переключателями, которые на телефоне не занимают место в шапке: вид (авто / мобильный / десктопный), тема (как в Obsidian / светлая / тёмная), открывать заметки в новой вкладке, страница на всю ширину, версия со ссылкой на историю.\n\nОстальное на телефоне: карта активности на обзоре — за последние 26 недель и помещается в ширину; блок кода DQL переносится по строкам; длинные теги и названия сжимаются с многоточием; карточек за раз — `pageSizeMobile`; крупные цели касания; поля 16px (iOS не увеличивает страницу). **Горизонтальной прокрутки нет** — ни у страницы, ни внутри виджета (проверяется в реальном браузере, см. «Тесты»). «Конструктор» (`studio`) на телефоне сохраняет обычную панель фильтров. Оформление — `css/85-responsive.css`, `css/36-modal.css`.\n\n## Теги, сортировка и атрибуты\n\n* **Наборы тегов** (вкладки над чипами в панели фильтров): **Топ** — самые частые; **Случайные** — случайная выборка, повторный клик перемешивает; **За год** — самые частые за последние 12 месяцев; **Этот день** — теги заметок, написанных в этот день в прошлые годы. Поле ввода с автодополнением ищет по всем тегам вне зависимости от набора.\n* **Сортировка по времени**: кнопка «Новые ↓» / «Старые ↑» в шапке ленты и бенто; по умолчанию — сначала новые. Другие варианты сортировки (связи, длина, алфавит) — в «Условиях» панели и в конструкторе.\n* **Атрибуты** (С медиа, Фото, Видео, Аудио, Цитаты, Задачи, Со ссылками) — единственный способ фильтровать по виду контента; прежний ряд «Тип» убран как дублирующий.\n\n## Мобильный и десктопный вид вручную\n\nВ правой части навигации две кнопки: 📱 «мобильный вид» и 🖥 «десктопный вид». **Мобильный** показывает интерфейс как на телефоне даже на компьютере (узкая рамка по центру, один столбец, фильтры свёрнуты) — удобно проверять и настраивать. **Десктопный** показывает колонки (`columns.min…max`) и широкую шапку даже на узком экране телефона (блок не уже 760px, страницу можно прокрутить вбок). Повторный клик по включённой кнопке возвращает автоопределение по ширине. Выбор запоминается в `data.json` (`ui.viewMode`: `auto` \\| `mobile` \\| `desktop`), задать вручную можно и параметром code-блока `viewMode: mobile`.\n\n## Тема и фон\n\nКнопка темы в навигации — иконка (☾ / ☀), переключает тёмную/светлую тему виджета. Когда вы переключаете тему самого Obsidian, выбор виджета сбрасывается на «auto» и снова следует глобальной теме. У виджета нет собственного цвета фона — виден фон заметки; чтобы вернуть, добавьте в `css/90-custom.css`: `.sf-root { --sf-root-bg: var(--sf-canvas); }`.\n\n## Тема и оформление\n\nОформление построено по `dashboard.html`: тональные слои без рамок, карточки со скруглением 1rem, при наведении фон карточки становится светлее, pill-фильтры, моно-чипы правил, акцентная кнопка. Переключатель темы «Тёмная / Светлая» — в правой части навигации (запоминается); `auto` следует теме Obsidian.\n\n## Кнопка «Наверх»\n\nПосле прокрутки вниз на 400px в правом нижнем углу прокручиваемой области заметки появляется круглая кнопка ↑ (акцентный градиент); клик плавно возвращает к началу страницы. Кнопка технически живёт в `<body>` (`position: fixed`) и сама подстраивает положение под область заметки.\n\n## Формат фильтра\n\n```json\n{ \"any\": [\"мысли\", \"zettel\"], \"all\": [], \"not\": [\"архив\"],\n  \"attrs\": [\"media\", \"task\"], \"types\": [\"audio\"], \"sources\": [\"lj\"],\n  \"period\": \"30d\", \"dateFrom\": \"2026-01-01\", \"dateTo\": \"2026-05-31\", \"day\": \"2026-05-14\", \"minBacklinks\": 3, \"text\": \"\", \"sort\": \"date-desc\" }\n```\n\n* `any` — хотя бы один тег (OR); `all` — все теги (AND); `not` — ни одного (NOT). Группы соединяются через AND. Тег `a` совпадает и с `a/b`.\n* `attrs`: `media photo video audio quote task link`. `period`: `all 7d 14d 30d 3m 1y`.\n* `sort`: `date-desc date-asc mtime-desc backlinks-desc length-desc alpha-asc`.\n* Быстрый режим (`quick`): `all | today | random | favorites`, применяется после фильтра; `random` берёт `randomCount` записей, «Перемешать» меняет только seed.\n\n## Данные — файл `data.json`\n\n**Что это.** `<vault>/.obsidian/plugins/journal-stream/data.json` — единственный рабочий файл плагина: настройки, смарт-подборки, избранное/закрепы и предпочтения интерфейса (раскладка, ширина, тема, вкладка). Создаётся сам при первом запуске; его же правит вкладка настроек и интерфейс ленты.\n**Как сбросить всё в дефолт.** Кнопка **«Сбросить всё»** в настройках плагина — либо отключите плагин, **удалите `data.json`** и включите снова. Код и CSS лежат отдельно; заметки плагин **никогда не изменяет**.\n\n```json\n{\n  \"version\": 3,\n  \"appVersion\": \"2.3.5\",\n  \"settings\": { \"...\": \"настройки (см. ниже)\" },\n  \"ui\":       { \"layout\": \"masonry\", \"fullWidth\": true, \"openInNewTab\": false, \"theme\": \"dark\", \"viewMode\": \"auto\" },\n  \"presets\":  [ { \"id\": \"...\", \"name\": \"...\", \"icon\": \"bolt\", \"description\": \"...\", \"quick\": \"all\", \"filter\": { } } ],\n  \"flags\":    { \"notes/путь/к/заметке.md\": { \"favorite\": true, \"pinned\": true } }\n}\n```\n\nИзбранное и закрепы живут в `flags`. Заметка также считается избранной, если у неё `favorite: true` во frontmatter или тег из `favoriteTags`. Файл можно править руками (плагин нужно перезагрузить); после правок убедитесь, что JSON валиден.\n\n### Ключи настроек (`settings`)\n\n| Ключ | По умолчанию | Описание |\n|---|---|---|\n| `sources` | `notes` | `[{id, label, folder, enabled}]`; пустой `folder` = весь vault |\n| `excludeFolders` / `excludeTags` | `scripts`, `.obsidian`, `templates` / — | что не показывать |\n| `dateFields` | `date, Date, created, дата, Дата, datetime, …` | поля frontmatter с датой (по порядку); формат — ISO или русский («1 октября 2024, 16:12»); если нет — дата из имени файла (`2024-10-01`) или создания |\n| `timeFallback` | `none` | откуда брать время, если в дате его нет: `none` \\| `ctime` \\| `mtime` (ещё читается поле `time`/`время`) |\n| `openInNewTab` | `false` | открывать заметку по клику на карточку в новой вкладке |\n| `hideSidebar` / `restoreSidebar` | `none` / `true` | скрывать боковые панели при открытии вкладки с лентой: `none` \\| `left` \\| `right` \\| `both`; возвращать при закрытии |\n| `popupView` | `false` | открывать заметку в плавающем окне просмотра (не в редакторе); бэклинки на карточках скрыты; Ctrl/Cmd+клик — в редакторе |\n| `quoteTags`, `favoriteTags`, `favoriteField` | `цитата…`, `избранное…`, `favorite` | как распознавать цитаты и избранное |\n| `columns` | `{ \"min\": 2, \"max\": 4 }` | число колонок карточек на десктопе (masonry и бенто) |\n| `minCardWidth` | `320` | минимальная ширина карточки, px: по ней считается, сколько колонок помещается; результат ограничивается `min`/`max` |\n| `fullWidth` | `true` | на всю ширину (также кнопка ⤢ в навигации, запоминается) |\n| `newNote` | `{mode: \"folder\", folder: \"notes\", rule: \"%%FOLDER_NAME/YYYY/YYYY-MM-MMMM/YYYY-MM-DD-hh-mm\", fileName: \"YYYY-MM-DD-hh-mm\", open: true}` | куда создаётся «Новая заметка»: `mode` = `root` \\| `folder` \\| `rule`; токены правила: `YYYY MM MMMM DD D hh mm`, `%%FOLDER_NAME` = `folder` |\n| `theme` / `nav` / `defaultView` / `layout` | `auto` / `true` / `stream` / `masonry` | оформление и стартовые экраны |\n| `pageSize`, `pageSizeMobile`, `excerptChars`, `randomCount`, `insightsCount`, `insightsOptions`, `topTags` | 24, 12, 420, 12, 3, [3, 6, 9, 12], 24 | размеры выборок |\n| `singleColumnBelow` | `560` | ширина блока (px), ниже которой включается один столбец и мобильный интерфейс |\n| `concurrency` | 8 | сколько заметок читать параллельно |\n| `debug` | `false` | подробный лог восстановления прокрутки в консоль (Ctrl+Shift+I) |\n| `autoIndex` | `true` | после открытия ленты в фоне индексировать тексты заметок — поиск находит и по тексту, а не только по заголовкам и тегам |\n| `deepScan` | `false` | прочитать тела **всех** заметок в фоне при открытии (точные типы/цитаты сразу; медленнее на больших vault) |\n| `showSourceBadge` | `false` | бейдж источника на карточке (при нескольких папках) |\n| `dql.dateExpr` | `file.cday` | какое выражение даты подставлять в DQL (раздел «Конструктор» — генератор запроса для Dataview; сам плагин Dataview не использует) |\n\n> Без `deepScan` тип карточки и атрибуты «цитаты/ссылки» определяются по тегам/вложениям (из `metadataCache`), а точно — после чтения тела при отрисовке карточки; поиск по тексту использует фоновую индексацию.\n\n## Откуда берутся данные заметки\n\n| Что | Источник в Obsidian |\n|---|---|\n| дата | frontmatter (`dateFields`) → имя файла → дата создания файла |\n| заголовок | frontmatter `title`, иначе имя файла |\n| теги | теги в тексте + `tags`/`tag` во frontmatter |\n| связи / обратные ссылки | `metadataCache.resolvedLinks` (вложения и ссылки / кто ссылается) |\n| задачи | `listItems` с чекбоксами |\n| медиа | вложения из `resolvedLinks` по расширению (фото, видео, аудио, canvas) |\n| тело заметки | `vault.cachedRead` — лениво, только для показанных карточек и индексации поиска |\n\nСписок заметок перечитывается при изменениях vault (с задержкой), по кнопке ⟳ в тулбаре и командой «Перечитать хранилище».\n\n## CSS — `css/`\n\nФайлы подключаются одним `<style>` по алфавиту имён (плагин читает их из своей папки при запуске и при смене настроек):\n\n| Файл | Содержимое |\n|---|---|\n| `00-tokens.css` | **все** цвета, радиусы, шрифты (светлая + тёмная тема); `--sf-quote-size`, `--sf-surface-hover` |\n| `10-base.css` | корень, кнопки, чипы, поля ввода, пустые состояния |\n| `12-host.css` | размещение в Obsidian: вкладка плагина, code-блок, окно истории версий |\n| `15-fullwidth.css` | режим «на всю ширину» (`.is-full`, `.sf-page-full`) |\n| `20-shell.css` | навигация, тулбар, крошки, сегменты раскладок |\n| `30-filters.css` | быстрые режимы, панель фильтров, формула, тег-билдер |\n| `35-menu.css`, `36-modal.css` | поиск и меню «Подборки»; модальные окна |\n| `40-card.css` / `41-card-types.css` | карточка и тела по типам, rich-link |\n| `45-skeleton.css` | шиммеры загрузки |\n| `50-feed.css` | masonry, timeline, bento |\n| `60-overview.css`, `70-collections.css`, `80-studio.css` | соответствующие экраны |\n| `85-responsive.css` | desktop ≥1280 · tablet 768–1279 · mobile <768 |\n| `90-custom.css` | **ваши** переопределения (подключается последним) |\n\nТема `auto` следует теме Obsidian. Классы начинаются с `sf-` и не затрагивают остальной интерфейс.\n\n## Структура\n\n```\njournal-stream/\n├─ manifest.json           id, версия, minAppVersion\n├─ main.js                 СОБИРАЕТСЯ: node tools/build.js (src + css + README внутри, ничего больше не нужно)\n├─ tools/\n│  ├─ build.js             сборщик main.js (без зависимостей)\n│  └─ main.template.js     класс Plugin + CommonJS-загрузчик (из src/ или из встроенного bundle)\n├─ src/\n│  ├─ plugin/              слой Obsidian\n│  │  ├─ index.js          сборка: ядро, вид, code-блок, команды, настройки, события vault\n│  │  ├─ view.js           ItemView — вкладка «Journal Stream»\n│  │  ├─ code-block.js     ```journal-stream\n│  │  ├─ block-params.js   разбор параметров блока\n│  │  ├─ settings-tab.js   вкладка в Settings\n│  │  └─ commands.js       ribbon и команды палитры\n│  ├─ app/                 композиция приложения\n│  │  ├─ main.js           createCore(plugin) — один раз; mount(core, …) — на каждый вид/блок\n│  │  ├─ shell.js          корень, тема, переключение экранов, восстановление прокрутки, toast, освобождение ресурсов\n│  │  ├─ state.js          реактивный стор (восстановление из session, UI-предпочтения → data.json)\n│  │  ├─ version.js        версия кода (единственный источник)\n│  │  ├─ actions.js        ВСЕ изменения состояния (enterView — со сбросом, openPreset/jumpToTag — с переносом)\n│  │  └─ open-note.js      открытие заметки (Ctrl/Cmd — новая вкладка)\n│  ├─ lib/                 чистые утилиты: dom, icons, date, ru, text, random, store, async, layout, search, misc\n│  ├─ model/               post.js (страница → пост), analyzer.js (разбор тела), media-kinds.js\n│  ├─ types/               реестр типов карточек: video audio canvas image quote tasks link text\n│  ├─ filters/             state, predicates, engine, sorters, periods, attrs, quick-modes, pipeline, formula, summary, dql, presets\n│  ├─ stats/               activity (карта, стрик, легенда), period (пульс месяца), tags, types\n│  ├─ services/            db (общая база data.json), storage, notes (metadataCache → страница), posts, session, scroll,\n│  │                       indexer, css-loader, md (MarkdownRenderer), changelog, media, content, flags, presets, theme-watch, config\n│  ├─ ui/                  common, card, feed, filters, overview, collections, studio (только отрисовка и вызов ctx.actions)\n│  └─ views/               overview, stream, bento, collections, studio, feed-view (фабрика), index\n├─ css/                    см. таблицу выше\n├─ img/                    desktop.png, mobile.png — скриншоты для README\n├─ tests/                  run.js, fake-dom.js, fake-app.js, fake-obsidian.js, fixtures.js, browser/ — в Obsidian не загружаются\n└─ README.md\n```\n\nПравила слоёв: `lib`, `model`, `types`, `filters`, `stats` — чистые функции без DOM и Obsidian API (тестируются в Node); `services` — доступ к vault/metadataCache/файлам; `ui` — отрисовка и вызов `ctx.actions`; `views` — сборка экранов; `plugin` — единственный слой, который знает про `Plugin`, `ItemView`, `PluginSettingTab`.\nМодуль подключается как `require(\"lib/dom\")` (путь от `src/`); `require(\"obsidian\")` возвращает API Obsidian. Новые `.js` файлы в `src/` подхватываются автоматически — список модулей нигде не ведётся.\n\n## Как расширять\n\n* **Новый тип карточки**: `src/types/<id>.js` (`{id, label, icon, match(post, feats)}`), включите в `types/index.js` (порядок = приоритет), добавьте `ui/card/bodies/<id>.js` с `render(ctx, post, feats, el)` и перечислите в `ui/card/bodies/index.js`; стили — в `css/41-card-types.css`.\n* **Новый экран**: `views/<id>.js` → `{id, title, icon, render(ctx, el)}` (можно вернуть функцию-деструктор), добавьте в `views/index.js`.\n* **Новое условие фильтра**: функция в `filters/predicates.js`, поле в `filters/state.js` (`defaultFilter`), при необходимости — в `formula.js` и `dql.js`.\n* **Новая настройка**: значение по умолчанию в `services/config.js` + поле в `plugin/settings-tab.js`.\n* **Новая команда**: `plugin/commands.js`.\n* **Своё оформление**: `css/90-custom.css` или переменные `--sf-*` из `00-tokens.css`.\n\n## История версий\n\nНомер версии показан на странице (бейдж `v2.3.5` в навигации; при `nav: false` — внизу) и по клику открывает это окно. После обновления плагина при первом открытии показывается уведомление «обновлён: vX → vY». Версия записывается в `data.json` (поле `appVersion`).\n\n### v2.3.5 — 2026-10-27\n- **Статистика: разрез по годам — выпадающий список** вместо горизонтальной полосы кнопок, которая не помещалась на экран («Общее» и годы с числом заметок). На мобильном список занимает всю ширину.\n- График «По годам» при большом числе лет подписывает не каждый столбец, а каждый N-й — подписи больше не наезжают друг на друга.\n\n### v2.3.4 — 2026-10-27\n- **Кнопка «назад» на телефоне закрывает окно заметки.** Если в окне открыто несколько заметок (переходы по внутренним ссылкам), «назад» сначала возвращает к предыдущей, на первой — закрывает окно. Окно регистрирует область клавиатуры Obsidian (Escape, как у штатных модальных окон) и слушает `popstate` веб-вью.\n\n### v2.3.3 — 2026-10-27\n- **Статистика: разрез по годам.** Над графиками «Когда вы пишете» и «По дням недели» появился переключатель «Общее / 2026 / 2025 / …». «Общее» — по выбранному периоду, годы — разрез по конкретному году; в подзаголовках указан год. Выбор запоминается на время сессии.\n\n### v2.3.2 — 2026-10-27\n- **Исправлена дата «14 января 1970».** Числовая дата в Unix-секундах (например `1200000000`) читалась как миллисекунды. Теперь числа и строки из 9–10 цифр понимаются как секунды, из 12–13 — как миллисекунды.\n- Любая дата раньше 1980 года считается ошибкой данных: запись берёт дату из имени файла или даты создания, а не уходит в 1970 год. Это работает во всех разделах, не только в статистике.\n\n### v2.3.1 — 2026-10-27\n- **Статистика: исправлена дата 1970.** Заметки без даты (ts = 0) больше не попадают в расчёты: все показатели считаются от первой датированной записи. Их число показано в подзаголовке («без даты, не учтены: N»).\n- **«Самые длинные записи»**: переключатель «Всё время» / «{текущий год}» / «По годам» — в последнем режиме показана самая длинная запись каждого года.\n- **Итоги**: отдельные плитки «заметок за все годы» и «заметок в {год} году»; график «По годам» всегда по всем годам, независимо от выбранного периода.\n\n### v2.3.0 — 2026-10-27\n- **Новый раздел «Статистика»** (`view: stats`): мини-статистика по автору.\n  - Итоги: заметок, активных дней, заметок за активный день, в неделю. Период: всё время / этот год / 12 месяцев.\n  - График «Когда вы пишете» по часам суток (только записи, где указано время) и по дням недели (с понедельника); пик подсвечен.\n  - Рекорды: лучшая и текущая серия дней подряд, самый плодотворный день и месяц, самая долгая пауза. Клик по рекорду открывает ленту на этом дне/месяце.\n  - «Самые длинные записи» — топ-10 по числу слов, клик открывает заметку; график «По годам».\n  - Раздел адаптивен (на мобильном рекорды в два столбца), расчёты — чистые функции в `src/stats/author.js`.\n\n### v2.2.1 — 2026-10-27\n- **Окно просмотра — по центру с затемнением** основного контента (лёгкое размытие); клик по затемнению или Esc закрывает, окно по-прежнему можно перетаскивать и менять его размер.\n- **Скрывать боковую панель при открытии ленты**: Settings → Journal Stream → «Скрывать боковую панель» (не скрывать / левую / правую / обе, ключ `hideSidebar`) и «Возвращать панель при закрытии» (`restoreSidebar`, по умолчанию да). Действует для вкладки с лентой, не для код-блока.\n\n### v2.2.0 — 2026-10-27\n- **Плавающее окно просмотра заметки** (опция «Открывать заметки в плавающем окне» в настройках плагина, кнопка-глаз в шапке ленты, «Плавающее окно просмотра» в «Настройках» на телефоне; параметр блока `popupView: true`, ключ `popupView`). Клик по карточке показывает заметку в режиме чтения в окне по центру поверх затемнённой ленты, а не в редакторе: окно перетаскивается за заголовок, меняет размер за угол, закрывается по Esc или крестиком; на телефоне — нижняя шторка. Кнопка ↗ — открыть в редакторе; **Ctrl/Cmd+клик** по карточке — тоже в редакторе. Внутренние ссылки заметки открываются в этом же окне (кнопка «назад»), клик по тегу применяет фильтр ленты.\n- В этом режиме **ссылки вперёд и назад скрыты**: на карточках и в мини-превью подборок нет счётчика бэклинков, в шапке окна — только дата и теги.\n\n### v2.1.4 — 2026-10-23\n- Новая заметка создаётся **только с атрибутом даты** (`date`): пустое свойство `tags` больше не добавляется.\n\n### v2.1.3 — 2026-10-22\n- **Язык месяца в названиях папок — в настройках**: `newNote.folderLang`, по умолчанию **English** → `notes/2026/2026-10-October/2026-10-22-00-31`; `ru` → `2026-10-Октябрь`. Отдельно — язык месяца в дате заметки (`newNote.dateLang`, по умолчанию `ru`: «16 октября 2026, 18:14»).\n\n### v2.1.2 — 2026-10-22\n- **Дата новой заметки задаётся правилом** (Settings → «Новая заметка» → «Дата в заметке», ключ `newNote.dateRule`). По умолчанию `D MMMM YYYY, hh:mm` → `16 октября 2026, 18:14` (месяц после «D » — в родительном падеже). Токены: `YYYY`, `MM`, `MMMM`, `DD`, `D`, `hh`, `mm`. Пример пути и даты показывается в настройках.\n- **Контраст градиентных кнопок**: подпись на заливке всегда берёт `--sf-primary-on` (стили темы Obsidian больше не делают её бледной); заливка в светлой теме темнее — белый текст читается.\n\n### v2.1.1 — 2026-10-22\n- **Установка из двух файлов**: `main.js` теперь собирается (`node tools/build.js`) в самодостаточный файл — модули, CSS и README внутри; достаточно `manifest.json` + `main.js`. Исправляет `ENOENT`/«не найдена папка src/» при неполном копировании. Папки `src/`, `css/` остаются исходниками; `css/90-custom.css` рядом с `main.js` по-прежнему подхватывается.\n- Загрузчик модулей встроен в `main.js` (`tools/main.template.js`); `src/core` удалён.\n\n### v2.1.0 — 2026-10-22\n- **Кнопка «Новая заметка»** в шапке (на телефоне — «＋» рядом с «Настройками») и команда палитры. Создаёт заметку с frontmatter (`date: \"16 октября 2026, 18:14\"` — формат задаётся правилом; **других свойств и тегов нет**) и открывает её; существующий файл не затирается (добавляется суффикс `-2`).\n- **Куда складывать** — Settings → Journal Stream → «Новая заметка»: в корень vault; в папку; по правилу, например `%%FOLDER_NAME/YYYY/YYYY-MM-MMMM/YYYY-MM-DD-hh-mm` (`%%FOLDER_NAME` — папка из настроек; токены YYYY, MM, MMMM — месяц словом, DD, hh, mm). Под полями показан пример получающегося пути.\n- Выравнивание по вертикали: кнопки справа от поиска стоят на одной линии с полем поиска, правая группа шапки — по верхней строке вкладок.\n\n### v2.0.0 — 2026-10-21\n**Виджет Dataview превращён в плагин Obsidian** (установка «скопировал — вставил», без сборщика: `main.js` + `src/*`).\n- **Без Dataview.** Заметки читаются из `metadataCache` (frontmatter, теги, ссылки, задачи, `resolvedLinks` для обратных ссылок) — список пересобирается при изменениях vault.\n- **Отдельная вкладка** «Journal Stream» (ribbon-иконка и команда «Открыть ленту»); состояние и прокрутка сохраняются при переходе в заметку и возврате.\n- **Code-блок** ```` ```journal-stream ```` для встраивания в заметки: `view`, `tags`, `exclude`, `period`, `search`, `layout`, `theme`, `nav`, `fullWidth`…\n- **Вкладка настроек** в Obsidian: папки-источники, исключения, поля даты, цвета/теги, колонки, ширины, индексация, сброс. Применяется сразу.\n- **Команды**: открыть ленту, по одному разделу (Обзор / Лента / Бенто / Подборки / Конструктор), вставить блок, перечитать хранилище.\n- **Данные — `data.json`** плагина (`loadData/saveData`); удалите файл или нажмите «Сбросить» в настройках — всё вернётся к умолчаниям.\n- Окно **«История версий»** по клику на бейдж версии (берётся из этого README).\n- Корректное освобождение ресурсов при закрытии вкладки/блока (слушатели, таймеры, кнопка «Наверх»).\n- Тесты адаптированы под API плагина (+ новые для вкладки, code-блока, настроек, чтения из metadataCache).\n- **Миграция с виджета 1.x**: `data/social_feed.json` не импортируется автоматически — перенесите настройки в окно настроек плагина (подборки можно скопировать в `data.json`, раздел `presets`), старую папку `scripts/social_feed` и dataviewjs-блоки можно удалить.\n\n### v1.6.0 — 2026-10-19\nМобильный интерфейс в один экран.\n- **Лента и Бенто на телефоне** — только разделы, кнопка «Фильтры (N)» и краткая сводка применённых условий. Все фильтры (поиск, даты, режим, подборки, теги, атрибуты, условия, порядок и вид) — в **модальном окне**; фильтры применяются сразу, «Показать N» закрывает окно.\n- **Разделы потоком**: кнопки переносятся на новую строку (без прокрутки); служебные переключатели (вид, тема, вкладка, ширина, версия) вынесены в окно **«Настройки»** (⚙). Короткая подпись конструктора — «Конструктор» (не путается с кнопкой «Фильтры»).\n- **Нет горизонтальной прокрутки** на телефоне и планшете: карта активности — 26 недель на телефоне, ячейки тянутся по ширине; DQL переносится по строкам; длинные теги и названия сжимаются; вкладки переносятся. Исправлена установка CSS-переменных через `style` в `h()`.\n- **Проверка раскладки в реальном браузере** (`tests/browser/layout_check.py`, Playwright/Chromium): 8 ширин × все экраны × обе темы + стресс-данные + окна «Фильтры» и «Настройки».\n- README: скриншоты `img/desktop.png` и `img/mobile.png` в начале.\n\n### v1.5.0 — 2026-10-18\n- **Теги — «подкладки» наборов**: Топ · Случайные (повторный клик перемешивает) · За год · Этот день (теги заметок, написанных в этот день в прошлые годы). Выбранные теги всегда остаются первыми.\n- **Порядок по времени** в ленте и бенто: кнопка «Новые ↓ / Старые ↑» в шапке (по умолчанию — сначала новые).\n- **Фильтры**: остались только атрибуты, ряд «Тип» убран (он дублировал атрибуты); клик по типу в диаграмме обзора и стандартные подборки теперь ставят атрибут. Подпись «FORMULA» убрана.\n- **Панель фильтров** компактнее: переключатели «Условия» и «Свернуть/Развернуть» — только иконки (на телефоне — кнопка «Фильтры (N)»). Защита от горизонтальной прокрутки на планшете (`overflow-x: clip`, перенос диапазона дат, сжимаемые элементы шапки).\n- «В этот день» — без даты в названии кнопки.\n- **Тема**: кнопка темы — только иконка (без подсказки и подписи); при переключении темы Obsidian выбор темы в виджете сбрасывается на «auto» (глобальная тема).\n- **Фон**: у самого виджета нет цвета фона — виден фон заметки Obsidian (вернуть: `.sf-root { --sf-root-bg: var(--sf-canvas); }` в `css/90-custom.css`).\n\n### v1.4.0 — 2026-10-17\n- **Фильтр дат «от» и «до»** рядом со строкой поиска (в шапке ленты/бенто и в панели конструктора). Текст, «от» и «до» — три независимых параметра: изменение любого сразу применяет фильтр; границы включительно; каждая дата снимается крестиком в формуле. Поддержан в DQL и в сохраняемых подборках (`dateFrom`, `dateTo`).\n- **Кнопка «Наверх»** (исправление): теперь `position: fixed` в `<body>` с положением по прокручиваемой области заметки — раньше `sticky` не срабатывал, если у родителя есть `overflow`. Появляется после 400px прокрутки; при перерисовке блока и уходе со страницы не плодится и убирается.\n- **Картинки** (исправление): centerCrop — рамка фиксированных пропорций 16:10, картинка заполняет её и обрезается по центру; при наведении ничего не меняется (убраны масштаб, фильтр и зависимость от естественного размера).\n\n### v1.3.0 — 2026-10-17\n- **Верхние кнопки** (вкладки разделов, кнопки справа, «Подборки», раскладки, главная кнопка) — скруглённые «пилюли» в цвет акцента с градиентом: неактивные — мягкий градиент, активная — полная заливка. Все кнопки на месте и на телефоне (кнопку ширины больше не прячем).\n- **Мобильный / десктопный вид вручную**: кнопки 📱 и 🖥 в навигации. «Мобильный» — как на телефоне даже на компьютере (узкая рамка, один столбец, свёрнутые фильтры); «десктопный» — колонки по `columns` даже на телефоне (блок не уже 760px). Повторный клик возвращает автоопределение; выбор запоминается (`ui.viewMode`).\n- **Прокрутка при возврате** (исправление): контейнер прокрутки определяется надёжно — по событиям прокрутки, подсказке из прошлого сеанса и известным контейнерам Obsidian; «ложные» обёртки с `overflow:auto` больше не дают `scrollTop = 0` при клике по карточке. Позиция удерживается 3 с после восстановления. `debug: true` в настройках пишет ход восстановления в консоль.\n\n### v1.2.0 — 2026-10-17\n- **Обзор по макету**: «Пульс месяца» — 4 карточки с графиком накопления, стриком по 7 дням, плотностью связей и разбивкой медиа + трендовые теги; годовой срез с картой активности и диаграммой типов. Плитки «Пространства» убраны.\n- **Карта активности** получила подписи месяцев и дней недели, легенду с диапазонами, пояснение «что такое квадраты» и сводку (всего, активных дней, рекорд).\n- **Случайные озарения**: число карточек выбирается (3 / 6 / 9 / 12, `insightsCount`, `insightsOptions`), запоминается; карточки раскладываются как в ленте.\n- **Карточки**: градиентная заливка как в подборках (оттенок зависит от типа), кнопка «Читать далее» убрана — вся карточка кликабельна.\n- **Навигация**: бренд-чип «Journal Stream» убран; вкладки растянуты на всю ширину шапки (на телефоне и планшете — отдельной строкой, у «Фильтры · DQL» короткая подпись), справа — версия и переключатели.\n- **Шиммеры загрузки** вместо пустого места: стартовая заглушка до загрузки модулей, затем «скелет» ленты, пока строится экран и раскладываются карточки.\n- **Поиск**: строка «по названию или тексту» в панели фильтров конструктора; автоиндексация текстов (`autoIndex`), поиск по всему тексту заметки, ё=е, устойчивость к нечитаемым заметкам.\n- **Прокрутка при возврате** (исправление): позиция читается до перерисовки, пока идёт восстановление новые значения не сохраняются, высота виджета резервируется, восстановление «удерживается» 1.5 с; прокрутка не прыгает вверх при «Показать ещё» и смене фильтров.\n\n### v1.1.0 — 2026-10-17\nОптимизация под телефон (один столбец).\n- Адаптивность по ширине самого блока (а не окна): `is-compact` < 900px, `is-mobile` < `singleColumnBelow` (560px) — работает и в узкой боковой панели.\n- Один столбец: Masonry, Bento, Подборки; Timeline без левой колонки — дата заголовком над карточками; зазоры 14px.\n- Навигация в две строки (бренд и переключатели · вкладки с прокруткой), заголовок, поиск на всю ширину, ниже — «Подборки», раскладка, обновление (раскладки — иконками).\n- Быстрые режимы — одна прокручиваемая строка (дата в «В этот день» скрыта); панель фильтров по умолчанию свёрнута до кнопки «Фильтры (N)» с числом активных условий (`collapsed: null` = авто).\n- Крупные цели касания (38–44px), поля 16px (iOS не масштабирует страницу), меню «Подборки» и подсказки тегов — на всю ширину, действия конструктора — сеткой 2×N, обзор: метрики по две в ряд, тепловая карта открывается на свежих неделях.\n- Новые настройки: `pageSizeMobile` (12 карточек за раз), `singleColumnBelow` (560).\n\n### v1.0.0 — 2026-10-17\nПервая версионированная сборка.\n- Введено версионирование: единый источник версии `app/version.js`, бейдж версии на странице со ссылкой на эту историю, уведомление после обновления, версия в файле данных.\n- Без изменений поведения относительно 0.5.0.\n\n### v0.5.0\n- Оформление по `dashboard.html`: тональные слои без рамок, карточки 1rem, hover «на ступень светлее», pill-фильтры, моно-чипы; переключатель темы в навигации.\n- Общий движок плиток для Masonry, Bento и «Подборок»: порядок слева направо, потом сверху вниз; первая подборка — «герой» на 2 колонки.\n- Клик по карточке открывает заметку; тег (чип и `#тег` в тексте) применяется на странице; опция открытия в новой вкладке.\n- Страница на всю ширину по умолчанию, при открытии заметки по карточке ширина снимается.\n- Дата и время как в заметках («1 октября 2024, 16:12»), русские форматы дат, `time`/`timeFallback`.\n- Восстановление прокрутки при возврате на страницу (фиксация при клике, игнор сбросов Obsidian).\n- Автодополнение тегов и кнопка «+» (мобильный Enter/«Готово»); кнопка «Наверх».\n- Формула показывает все условия фильтра; пустое состояние объясняет, что применено.\n\n### v0.4.0\n- Единый рабочий файл данных `data/social_feed.json` (настройки, подборки, избранное, UI-предпочтения; удалить — сброс).\n- Состояние сохраняется при возврате в заметку; вход в раздел всегда с дефолта; новый конструктор при каждом входе.\n- Строка поиска с мгновенными результатами и фоновой индексацией текстов; меню «Подборки»; сохранение/удаление подборок (с подтверждением); панель действий конструктора.\n- Колонки `columns.min/max` и `minCardWidth`; режим Flow удалён (остался Timeline: по две карточки в ряд).\n- Пульс месяца: «Добавлено фото/видео»; цитаты мельче; подсветка карточки при наведении.\n\n### v0.3.0\n- Дата в карточках в формате заметок; Timeline ограничен по ширине; картинки не «прыгают» при наведении.\n\n### v0.2.0\n- Папка по умолчанию `notes`; режим «на всю ширину» (кнопка ⤢, параметр `fullWidth`, `cssclasses: sf-page-full`).\n\n### v0.1.0\n- Первая сборка: экраны Обзор / Лента / Бенто / Подборки / Студия, типы карточек, фильтры и генератор DQL, смарт-подборки, README и тесты.\n\n> Записи 0.1–0.5 восстановлены задним числом по порядку доработок; даты у них не указаны.\n\n## Версионирование\n\nСхема `MAJOR.MINOR.PATCH`: **PATCH** — исправления без новых возможностей; **MINOR** — новые возможности и изменения оформления, совместимые с имеющимся `data.json`; **MAJOR** — несовместимые изменения (формат `data.json`, параметры code-блока). Как выпустить версию:\n1. Поднять `VERSION` и `RELEASED` в `src/app/version.js` и `version` в `manifest.json`; после любых правок `src/`, `css/` или README — **`node tools/build.js`** (тест проверяет, что `main.js` актуален).\n2. Добавить в этот README раздел `### vX.Y.Z — дата` вверху «Истории версий» и обновить строку версии под заголовком.\n3. Запустить `node tests/run.js` — тест проверит совпадение версий в коде и `manifest.json` и наличие записи в README.\nЕсли меняется формат `data.json` — увеличить `version` в `services/db.js` и добавить миграцию там же.\n\n## Тесты\n\nЗапускаются из папки проекта (в Obsidian не загружаются).\n\n```bash\nnode tests/run.js                                    # юнит- и сценарные тесты на заглушке DOM\npython3 tests/browser/layout_check.py                # раскладка в реальном Chromium (нужен playwright)\npython3 tests/browser/layout_check.py --shots        # + скриншоты img/desktop.png и img/mobile.png\n```\n\n**Node-тесты** прогоняют чистые модули, экраны и сценарии (поиск, сессия и сброс, меню подборок, сохранение/удаление, `data.json`) и слой плагина: чтение заметок из фиктивного `metadataCache`, регистрацию вида/блока/команд/настроек, открытие и закрытие вкладки, code-блок с параметрами, вкладку настроек и сброс. Копия папки плагина кладётся во временный vault — ваш `data.json` не затрагивается.\n**Браузерная проверка** открывает страницу-имитацию Obsidian (`tests/browser/harness.html`: настоящие модули и CSS плагина, фиктивные `app`/`plugin`/`obsidian`, ~50 заметок разных типов) на ширинах 360–1440px по всем экранам, раскладкам и обеим темам, со «стресс-данными» (очень длинные названия и теги) и проверяет, что **нет горизонтальной прокрутки**; на телефоне дополнительно открываются окна «Фильтры» и «Настройки».\nТесты **не заменяют** проверку в самом Obsidian.\n\n## Ограничения и диагностика\n\n* Тесты работают на заглушках Obsidian API; запуск в настоящем Obsidian не проверялся. Если плагин не стартует — сначала проверьте, что в папке плагина рядом с `main.js` лежит папка `src/` (иначе в уведомлении будет об этом сказано); затем откройте консоль (Ctrl+Shift+I) и найдите `[journal-stream]`; в интерфейсе появится уведомление об ошибке запуска.\n* Модули выполняются через встроенный загрузчик (в `main.js` они лежат как функции; при запуске из шаблона — читаются из `src/` через `new Function`): так работает «скопировал — вставил», но такой плагин не пройдёт проверку каталога сообщества Obsidian — он рассчитан на личное использование.\n* Рендер markdown в карточках — `MarkdownRenderer` Obsidian; при сбое показывается сырой текст (`[journal-stream] markdown fallback` в консоли).\n* Медиа ищутся через `metadataCache` (по имени файла, как вики-ссылки); если файла нет — карточка покажет «файл не найден».\n* Не реализовано из макетов: Canvas View как раскладка ленты, быстрый захват мысли (⌥N), 3D-граф, пакетная AI-транскрибация.\n* Раскладки Masonry/Bento/Подборки измеряют высоту карточек в браузере и пересчитываются при изменении размеров; если плитка «съехала», нажмите ⟳.\n* Восстановление прокрутки делается повторными попытками, пока карточки дорисовываются; если вы начали прокручивать сами, попытки прекращаются. Включите `debug` в `data.json`/настройках, чтобы увидеть ход в консоли.\n* Если подборка («В этот день» и др.) показывает пустую ленту при ненулевом счётчике — посмотрите формулу над лентой: в ней отображаются **все** применённые условия с кнопкой ✕.\n* Миграция с виджета 1.x: см. заметку в v2.0.0.\n",
};
// main.js (шаблон; рабочий main.js собирает tools/build.js) — точка входа плагина Obsidian «Journal Stream». Тонкая обёртка: вся логика лежит в src/* и подключается
// мини-загрузчиком (ниже) прямо из папки плагина — сборщик не нужен ("скопировал — вставил").
// Загрузчик встроен сюда намеренно: main.js — единственный файл, без которого ничего не стартует.
const obsidian = require("obsidian");

// CommonJS-загрузчик: читает все *.js из <плагин>/src и даёт sync-require. `externals` — модули хоста, например { obsidian }.
function createLoader({ app, root, externals = {}, bundle = null }) {
  const adapter = app.vault.adapter;
  const SKIP_DIRS = new Set();
  const SKIP_FILES = new Set();

  async function listJs(dir) {
    const out = [];
    const { files, folders } = await adapter.list(dir);
    for (const f of files) if (f.endsWith(".js") && !SKIP_FILES.has(f)) out.push(f);
    for (const d of folders) {
      const name = d.split("/").pop();
      if (!SKIP_DIRS.has(name)) out.push(...(await listJs(d)));
    }
    return out;
  }

  async function load() {
    // bundle (готовый main.js из tools/build.js): модули уже внутри — файлы src/ не нужны
    const paths = bundle ? [] : await listJs(root);
    const sources = await Promise.all(paths.map(async (p) => [p, await adapter.read(p)]));
    const defs = new Map();
    for (const [p, code] of sources) defs.set(p.slice(root.length + 1).replace(/\.js$/, ""), { path: p, code });
    if (bundle) for (const id of Object.keys(bundle.modules)) defs.set(id, { path: "journal-stream/src/" + id + ".js", fn: bundle.modules[id] });
    const cache = new Map();

    function resolve(fromId, request) {
      if (request in externals) return "ext:" + request;
      let id = request;
      if (request.startsWith(".")) {
        const base = fromId.split("/").slice(0, -1);
        for (const part of request.split("/")) {
          if (part === "." || part === "") continue;
          if (part === "..") base.pop();
          else base.push(part);
        }
        id = base.join("/");
      }
      id = id.replace(/\.js$/, "");
      if (defs.has(id)) return id;
      if (defs.has(id + "/index")) return id + "/index";
      throw new Error(`[journal-stream] модуль не найден: "${request}" (импорт из "${fromId}")`);
    }

    function requireFrom(fromId, request) {
      const id = resolve(fromId, request);
      if (id.startsWith("ext:")) return externals[id.slice(4)];
      if (cache.has(id)) return cache.get(id).exports;
      const def = defs.get(id);
      const module = { exports: {} };
      cache.set(id, module);
      const fn = def.fn || new Function("module", "exports", "require", def.code + "\n//# sourceURL=" + def.path);
      fn(module, module.exports, (r) => requireFrom(id, r));
      return module.exports;
    }

    return { require: (request) => requireFrom("<entry>", request), ids: [...defs.keys()] };
  }

  return { load };
};

module.exports = class JournalStreamPlugin extends obsidian.Plugin {
  async onload() {
    const adapter = this.app.vault.adapter;
    const dir = this.manifest.dir;
    const root = `${dir}/src`;
    try {
      const bundle = typeof __JS_BUNDLE__ !== "undefined" ? __JS_BUNDLE__ : null;
      this.__bundle = bundle;
      if (!bundle && !(await adapter.exists(`${root}/plugin/index.js`))) {
        throw new Error(`не найдена папка src/ (ожидался файл ${root}/plugin/index.js). Скопируйте в ${dir} ВСЕ файлы и папки архива: manifest.json, main.js, src/, css/, README.md — папка src должна лежать рядом с main.js`);
      }
      const { require: sfRequire } = await createLoader({ app: this.app, root, externals: { obsidian }, bundle }).load();
      this.sf = sfRequire("plugin/index");
      await this.sf.setup(this);
    } catch (e) {
      console.error("[journal-stream] ошибка запуска", e);
      new obsidian.Notice("Journal Stream: ошибка запуска — " + (e && e.message ? e.message : e), 15000);
    }
  }
  onunload() {
    try { if (this.sf) this.sf.teardown(this); } catch (e) { console.error("[journal-stream]", e); }
  }
};
module.exports.createLoader = createLoader;
