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
