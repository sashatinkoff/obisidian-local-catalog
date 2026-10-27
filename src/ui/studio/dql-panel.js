// ui/studio/dql-panel.js — сгенерированный DQL с подсветкой, копированием и пометками.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { compile } = require("filters/dql");
const highlight = require("ui/studio/dql-highlight");
const { copyText } = require("lib/misc");
const toast = require("ui/common/toast");

module.exports = function dqlPanel(ctx) {
  const el = h("section", { class: "sf-dqlpanel" });
  function draw() {
    clear(el);
    const s = ctx.store.get(), { query, notes } = compile(s.filter, { config: ctx.config, quick: s.quick });
    el.append(
      h("div", { class: "sf-dqlpanel__head" }, h("span", null, icon("terminal", { size: 14 }), " Obsidian DQL"),
        h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-btn--sm", onClick: async () => { toast(ctx, (await copyText(query)) ? "DQL скопирован" : "Не удалось скопировать"); } }, icon("copy", { size: 13 }), "Копировать")),
      h("pre", { class: "sf-dql" }, h("code", null, highlight(query))),
      notes.length && h("ul", { class: "sf-dqlpanel__notes" }, notes.map((n) => h("li", null, n))));
  }
  draw();
  return { el, dispose: ctx.store.subscribe(draw, ["filter", "quick"]) };
};
