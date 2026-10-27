// ui/studio/live-preview.js — живой отклик хранилища: число совпадений, время выполнения, первые заметки.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const pipeline = require("filters/pipeline");
const richLink = require("ui/common/rich-link");
const { fmtNum } = require("lib/ru");

module.exports = function livePreview(ctx, posts) {
  const el = h("section", { class: "sf-livepreview" });
  function draw() {
    clear(el);
    const t0 = performance.now();
    const { list } = pipeline.run(posts, ctx.store.get(), { config: ctx.config, flags: ctx.flags });
    const ms = Math.max(0.1, performance.now() - t0).toFixed(1);
    el.append(
      h("div", { class: "sf-livepreview__head" }, h("span", { class: "sf-counter" }, h("span", { class: "sf-counter__dot" }), `Найдено: ${fmtNum(list.length)}`), h("span", { class: "sf-muted" }, icon("clock", { size: 12 }), ` ${ms} мс`)),
      h("div", { class: "sf-livepreview__list" }, list.slice(0, 6).map((p) => richLink(ctx, p)), !list.length && h("span", { class: "sf-muted" }, "Ничего не найдено")));
  }
  draw();
  return { el, dispose: ctx.store.subscribe(draw, ["filter", "quick", "seed"]) };
};
