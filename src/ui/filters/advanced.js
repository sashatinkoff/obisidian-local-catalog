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
