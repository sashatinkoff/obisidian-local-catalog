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
