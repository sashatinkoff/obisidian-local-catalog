// ui/filters/quickbar.js — быстрые режимы: Все / В этот день / Рандомные 🎲 / Избранное (+ счётчики).
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const modes = require("filters/quick-modes");
const { fmtNum } = require("lib/ru");

module.exports = function quickbar(ctx, { posts }) {
  const el = h("div", { class: "sf-quickbar" });
  function draw() {
    clear(el);
    const { quick, seed } = ctx.store.get();
    const c = { now: Date.now(), seed, config: ctx.config, flags: ctx.flags };
    for (const m of modes.MODES) {
      const n = m.id === "random" ? null : modes.count(posts, m.id, c);
      el.append(h("button", { type: "button", class: ["sf-quick", m.id === quick && "is-active", `sf-quick--${m.id}`], onClick: () => ctx.actions.setQuick(m.id) },
        icon(m.icon, { size: 15 }), h("span", null, m.label(c)), n != null && h("span", { class: "sf-quick__count" }, fmtNum(n))));
    }
    if (quick === "random") el.append(h("button", { type: "button", class: "sf-btn sf-btn--primary sf-shuffle", onClick: () => ctx.actions.shuffle() }, icon("dice", { size: 14 }), "Перемешать"));
  }
  draw();
  const dispose = ctx.store.subscribe(draw, ["quick", "seed"]);
  return { el, dispose };
};
