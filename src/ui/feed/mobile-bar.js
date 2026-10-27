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
