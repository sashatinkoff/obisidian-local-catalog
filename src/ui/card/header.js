// ui/card/header.js — шапка: дата (mono) слева; тип, источник, закреп/избранное справа.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const types = require("types");
const { fmtDateTime } = require("lib/date");
const iconButton = require("ui/common/icon-button");

module.exports = function cardHeader(ctx, post, rerender) {
  const t = types.get(post.type);
  const src = ctx.config.showSourceBadge && ctx.config.sources.find((s) => s.id === post.source);
  const fav = ctx.flags.isFavorite(post), pin = ctx.flags.isPinned(post);
  return h("header", { class: "sf-card__header" },
    h("time", { class: "sf-card__date" }, fmtDateTime(post.ts, post.hasTime)),
    h("div", { class: "sf-card__meta" },
      src && h("span", { class: "sf-badge sf-badge--source" }, src.label),
      h("span", { class: ["sf-badge", `sf-badge--${t.id}`] }, icon(t.icon, { size: 12 }), t.label),
      iconButton({ name: "pin", title: pin ? "Открепить" : "Закрепить", active: pin, onClick: () => { ctx.flags.togglePin(post); rerender(); } }),
      iconButton({ name: "star", title: fav ? "Убрать из избранного" : "В избранное", active: fav, fill: fav, onClick: () => { ctx.flags.toggleFavorite(post); rerender(); } })));
};
