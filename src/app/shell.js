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
