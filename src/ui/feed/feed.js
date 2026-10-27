// ui/feed/feed.js — лента: masonry | timeline | bento (+ пагинация «Показать ещё»).
const { h } = require("lib/dom");
const createCard = require("ui/card/card");
const groupByDay = require("ui/feed/groups");
const loadMore = require("ui/feed/load-more");
const masonry = require("ui/feed/masonry");
const bento = require("ui/feed/bento");
const empty = require("ui/common/empty");
const { toTokens } = require("filters/formula");

module.exports = function feed(ctx, { posts, layout, page }) {
  layout = layout === "flow" ? "timeline" : layout;
  const wrap = h("section", { class: ["sf-feed", `sf-feed--${layout}`] });
  const parts = [];
  wrap.sfDispose = () => parts.forEach((p) => p.sfDispose && p.sfDispose());

  if (!posts.length) {
    const st = ctx.store.get(), act = [];
    if (st.quick !== "all") act.push("режим «" + ({ today: "В этот день", random: "Рандомные", favorites: "Избранное" }[st.quick] || st.quick) + "»");
    act.push(...toTokens(st.filter).filter((t) => t.t !== "paren" && t.t !== "op").map((t) => t.v));
    wrap.append(empty({ title: "Ничего не найдено", hint: act.length ? "Сейчас применено: " + act.join(" · ") : "В выбранных источниках нет заметок.", action: h("button", { type: "button", class: "sf-btn", onClick: () => ctx.actions.resetFilter() }, "Сбросить фильтры") }));
    return wrap;
  }
  const mobile = !!(ctx.rootEl && ctx.rootEl.classList.contains("is-mobile"));
  const visible = posts.slice(0, (mobile ? ctx.config.pageSizeMobile || 12 : ctx.config.pageSize) * page);

  if (layout === "timeline") {
    // Timeline: колонка по дням; внутри дня — по две карточки в ряд одинаковой высоты, а если не помещаются — по одной.
    for (const g of groupByDay(visible)) {
      wrap.append(h("div", { class: "sf-timeline__group" },
        h("div", { class: "sf-timeline__label" }, h("span", { class: "sf-timeline__dot" }), g.label, h("span", { class: "sf-timeline__key" }, g.date)),
        h("div", { class: "sf-timeline__items" }, g.posts.map((p) => createCard(ctx, p)))));
    }
  } else {
    const cards = visible.map((p) => createCard(ctx, p));
    const grid = layout === "bento" ? bento(ctx, cards) : masonry(ctx, cards);
    parts.push(grid);
    wrap.append(grid);
  }
  if (posts.length > visible.length) wrap.append(loadMore({ remaining: posts.length - visible.length, onClick: () => ctx.actions.nextPage() }));
  return wrap;
};
