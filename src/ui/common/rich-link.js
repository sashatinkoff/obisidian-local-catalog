// ui/common/rich-link.js — превью-ссылка на заметку: иконка типа, заголовок, пара строк текста, дата и связи.
// Возвращённый элемент имеет метод setExcerpt(text) — текст подгружается позже, когда прочитана заметка.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const types = require("types");
const { fmtDateTime } = require("lib/date");
const { plural } = require("lib/ru");

module.exports = function richLink(ctx, post, { excerpt } = {}) {
  const t = types.get(post.type);
  const meta = [fmtDateTime(post.ts, post.hasTime)];
  if (post.backlinks && !ctx.store.get().popupView) meta.push(`${post.backlinks} ${plural(post.backlinks, ["связь", "связи", "связей"])}`);
  const ex = h("span", { class: "sf-richlink__excerpt" }, excerpt || "");
  const el = h("a", { class: ["sf-richlink", `sf-richlink--${t.id}`], href: "#", "data-href": post.path, onClick: (e) => { e.preventDefault(); e.stopPropagation(); ctx.openNote(post.path, e); } },
    h("span", { class: "sf-richlink__icon" }, icon(t.icon, { size: 16 })),
    h("span", { class: "sf-richlink__main" }, h("span", { class: "sf-richlink__title" }, post.title), ex, h("span", { class: "sf-richlink__meta" }, meta.join(" · "))),
    h("span", { class: "sf-richlink__out" }, icon("arrowUpRight", { size: 14 })));
  el.setExcerpt = (text) => { ex.textContent = text || ""; };
  return el;
};
