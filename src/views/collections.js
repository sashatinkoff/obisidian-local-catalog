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
