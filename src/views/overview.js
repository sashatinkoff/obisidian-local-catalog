// views/overview.js — «Обзор» по макету: пульс месяца с графиками, случайные озарения, годовая карта активности + типы.
const { h } = require("lib/dom");
const { countByDay } = require("stats/activity");
const { fmtNum } = require("lib/ru");
const pulse = require("ui/overview/pulse");
const activityHeatmap = require("ui/overview/heatmap");
const distribution = require("ui/overview/distribution");
const insights = require("ui/overview/insights");

module.exports = {
  id: "overview", title: "Обзор", icon: "grid",
  async render(ctx, el) {
    const posts = ctx.repo.collect(), now = Date.now(), byDay = countByDay(posts);
    const links = posts.reduce((s, p) => s + p.links, 0);
    const ins = insights(ctx, posts);
    el.append(
      h("div", { class: "sf-hero" }, h("h1", null, "Обзор хранилища"), h("p", null, `${fmtNum(posts.length)} заметок и ${fmtNum(links)} исходящих связей`)),
      pulse(ctx, posts, byDay, now),
      ins.el,
      h("section", { class: "sf-section" },
        h("div", { class: "sf-section__row" }, h("div", { class: "sf-section__lead" }, h("span", { class: "sf-section__dot is-tertiary" }), h("h2", { class: "sf-section__title" }, "Годовой срез мыслей"))),
        h("div", { class: "sf-yearly" }, activityHeatmap(ctx, byDay, now), distribution(ctx, posts, now))));
    return () => ins.dispose();
  },
};
