// Задачи: прогресс + первые пункты (только чтение).
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");

async function render(ctx, post, feats, el) {
  const { total, done, items } = feats.tasks;
  el.append(h("div", { class: "sf-progress", title: `${done} из ${total}` }, h("div", { class: "sf-progress__bar", style: { width: (total ? (done / total) * 100 : 0) + "%" } })));
  el.append(h("ul", { class: "sf-tasks" }, items.slice(0, 6).map((t) =>
    h("li", { class: ["sf-tasks__item", t.done && "is-done"] }, h("span", { class: "sf-tasks__box" }, t.done && icon("check", { size: 11 })), h("span", null, t.text)))));
  if (total > 6) el.append(h("div", { class: "sf-tasks__more" }, `ещё ${total - 6}…`));
  await renderExcerpt(ctx, post, feats, el, { tasks: true, max: 220 });
}
module.exports = { render };
