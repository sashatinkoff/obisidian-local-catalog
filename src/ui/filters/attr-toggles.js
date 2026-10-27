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
