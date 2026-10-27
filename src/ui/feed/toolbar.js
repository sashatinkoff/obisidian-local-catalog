// ui/feed/toolbar.js — шапка экрана как в dashboard: «Vault / …» + заголовок со счётчиком; справа — поиск, подборки,
// раскладки, обновление.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const segmented = require("ui/common/segmented");
const iconButton = require("ui/common/icon-button");
const searchBar = require("ui/filters/search-bar");
const presetsMenu = require("ui/filters/presets-menu");
const sortToggle = require("ui/feed/sort-toggle");
const { LAYOUTS } = require("ui/feed/layouts");
const { withUnit } = require("lib/ru");
const { fmtTime } = require("lib/date");

module.exports = function toolbar(ctx, { title, posts, withLayouts, onRefresh }) {
  const el = h("div", { class: "sf-toolbar" });
  const counter = h("span", { class: "sf-counter__n" });
  const search = searchBar(ctx, { posts });
  const menu = presetsMenu(ctx, { posts });
  const sort = sortToggle(ctx);
  const counterEl = h("span", { class: "sf-count-pill" }, counter);
  const stamp = fmtTime(Date.now());

  function draw() {
    clear(el);
    const layout = ctx.store.get().layout;
    el.append(
      h("div", { class: "sf-toolbar__title" },
        h("div", { class: "sf-crumbs" }, h("span", { class: "sf-crumbs__dot" }), "Vault / Journal Stream", h("span", { class: "sf-crumbs__sep" }, "·"), h("span", { class: "sf-crumbs__sync" }, icon("refresh", { size: 12 }), `Обновлено ${stamp}`)),
        h("div", { class: "sf-toolbar__h1" }, h("h1", null, title), counterEl)),
      h("div", { class: "sf-toolbar__controls" },
        search.el, menu.el, sort.el,
        withLayouts && segmented({ options: LAYOUTS, value: layout === "flow" ? "timeline" : layout, onChange: (id) => ctx.actions.setLayout(id) }),
        iconButton({ name: "refresh", title: "Перечитать хранилище", onClick: onRefresh })));
  }
  const setCount = (n) => { counter.textContent = withUnit(n, ["заметка", "заметки", "заметок"]); };
  draw();
  const unsub = withLayouts ? ctx.store.subscribe(draw, ["layout"]) : () => {};
  return { el, setCount, dispose: () => { unsub(); search.dispose(); sort.dispose(); menu.close(); } };
};
