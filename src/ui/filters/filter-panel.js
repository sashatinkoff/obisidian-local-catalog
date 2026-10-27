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
