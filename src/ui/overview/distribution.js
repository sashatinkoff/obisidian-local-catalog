// ui/overview/distribution.js — распределение заметок по типам за год: кольцевая диаграмма + легенда (клик → лента с типом).
const { h } = require("lib/dom");
const { typeCounts } = require("stats/types");
const { donut } = require("ui/overview/charts");
const { fmtNum } = require("lib/ru");
const { DAY } = require("lib/date");

const RU = { text: "Текст", quote: "Цитаты", audio: "Аудио", video: "Видео", image: "Фото", tasks: "Задачи", link: "Ссылки", canvas: "Canvas" };

module.exports = function distribution(ctx, posts, now) {
  const year = posts.filter((p) => p.ts >= now - 365 * DAY && p.ts <= now + DAY);
  const rows = typeCounts(year);
  const list = h("div", { class: "sf-dist__list" }, rows.length ? rows.map((r) =>
    h("button", { type: "button", class: "sf-dist__row", title: "Открыть в ленте", onClick: () => ctx.actions.jumpToType(r.id) },
      h("span", { class: ["sf-dist__dot", `is-${r.id}`] }), h("span", { class: "sf-dist__name" }, RU[r.id] || r.id), h("span", { class: "sf-dist__count" }, fmtNum(r.count)), h("span", { class: "sf-dist__pct" }, r.pct + "%")))
    : h("span", { class: "sf-muted" }, "За последний год заметок нет."));
  return h("div", { class: "sf-card-block sf-yearly__dist" },
    h("div", { class: "sf-block__head" }, h("div", null, h("h3", { class: "sf-block__title" }, "Типы заметок"), h("p", { class: "sf-block__sub" }, "Из чего состоит архив за последние 12 месяцев"))),
    h("div", { class: "sf-dist" }, donut(rows.map((r) => ({ id: r.id, value: r.count })), { center: h("span", null, h("strong", null, fmtNum(year.length)), "заметок") }), list));
};
