// ui/feed/sort-toggle.js — переключатель порядка по времени: «Новые ↓» (по умолчанию, date-desc) / «Старые ↑» (date-asc).
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");

module.exports = function sortToggle(ctx) {
  const btn = h("button", { type: "button", class: "sf-sortbtn", onClick: () => ctx.actions.toggleSortDir() });
  function draw() {
    clear(btn);
    const sort = ctx.store.get().filter.sort, asc = sort === "date-asc", other = sort !== "date-desc" && !asc;
    btn.classList.toggle("is-asc", asc);
    btn.title = asc ? "Сначала старые — нажмите, чтобы показать сначала новые" : "Сначала новые — нажмите, чтобы показать сначала старые";
    btn.append(icon(asc ? "arrowUp" : "arrowDown", { size: 14 }), h("span", null, asc ? "Старые" : other ? "По дате" : "Новые"));
  }
  draw();
  return { el: btn, dispose: ctx.store.subscribe(draw, ["filter"]) };
};
