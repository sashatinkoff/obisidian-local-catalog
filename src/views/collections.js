// views/collections.js — «Подборки»: плитки в той же сетке, что и Бенто (первая подборка — «герой» на 2 колонки).
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const presetCard = require("ui/collections/preset-card");
const tileGrid = require("ui/feed/tile-grid");
const { plural } = require("lib/ru");
const { fmtTime } = require("lib/date");
const select = require("ui/common/select");
const pipeline = require("filters/pipeline");
const { merge } = require("filters/state");
const { SORTS, sortDef, presetStats, sortPresets } = require("lib/preset-sort");

module.exports = {
  id: "collections", title: "Подборки", icon: "star",
  async render(ctx, el) {
    const posts = ctx.repo.collect(), list = ctx.presets.list(), ui = () => ctx.db.data.ui || {};
    let sortId = SORTS.some((x) => x.id === ui().collSort) ? ui().collSort : "manual", dir = ui().collDir === "desc" || ui().collDir === "asc" ? ui().collDir : sortDef(sortId).def;
    // показатели считаем один раз; сортировка меняет только порядок плиток
    const env = { config: ctx.config, flags: ctx.flags }, seed = 1;
    const items = list.map((preset) => ({ preset, stats: presetStats(pipeline.run(posts, { filter: merge(preset.filter), quick: preset.quick || "all", seed }, env).list) }));
    const host = h("div", { class: "sf-coll__host" });
    let grid = null;
    const sortSel = h("div", { class: "sf-coll__sort" }), dirBtn = h("button", { type: "button", class: "sf-sortbtn", onClick: () => { dir = dir === "asc" ? "desc" : "asc"; save(); draw(); } });
    const save = () => { ctx.db.data.ui = { ...ui(), collSort: sortId, collDir: dir }; ctx.db.save(); };

    function drawControls() {
      clear(sortSel);
      sortSel.append(select({ title: "Сортировка подборок", options: SORTS, value: sortId, onChange: (id) => { sortId = id; dir = sortDef(id).def; save(); draw(); } }));
      const asc = dir === "asc", d = sortId === "name" || sortId === "manual" ? ["А → Я", "Я → А"] : sortId === "created" || sortId === "fresh" ? ["Старые", "Новые"] : ["Меньше", "Больше"];
      clear(dirBtn); dirBtn.title = "Изменить направление сортировки"; dirBtn.classList.toggle("is-asc", asc);
      dirBtn.append(icon(asc ? "arrowUp" : "arrowDown", { size: 14 }), h("span", null, asc ? d[0] : d[1]));
    }
    function draw() {
      if (grid) grid.sfDispose();
      clear(host); drawControls();
      const sorted = sortPresets(items, sortId, dir);
      const cards = sorted.map((it, i) => presetCard(ctx, it.preset, posts, { hero: i === 0 }));
      grid = tileGrid(ctx, cards, { variant: "bento", wide: (c) => !!(c && c.classList && c.classList.contains("sf-preset--hero")) });
      host.append(grid);
    }
    el.append(
      h("div", { class: "sf-hero sf-hero--row" },
        h("div", { class: "sf-toolbar__title" },
          h("div", { class: "sf-crumbs" }, h("span", { class: "sf-crumbs__dot" }), "Vault / Query Engine", h("span", { class: "sf-crumbs__sep" }, "·"), h("span", { class: "sf-crumbs__sync" }, icon("refresh", { size: 12 }), `Обновлено ${fmtTime(Date.now())}`)),
          h("div", { class: "sf-toolbar__h1" }, h("h1", null, "Сохранённые фильтры"), h("span", { class: "sf-count-pill" }, `${list.length} ${plural(list.length, ["подборка", "подборки", "подборок"])}`))),
        h("div", { class: "sf-coll__tools" }, sortSel, dirBtn,
          h("button", { type: "button", class: "sf-btn sf-btn--primary", onClick: () => ctx.actions.newPreset() }, icon("plus", { size: 14 }), "Новый смарт-фильтр"))),
      host);
    draw();
    return () => { if (grid) grid.sfDispose(); };
  },
};
