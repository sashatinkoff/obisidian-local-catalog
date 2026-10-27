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
