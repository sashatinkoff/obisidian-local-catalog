// ui/collections/preset-card.js — карточка смарт-подборки. Клик по карточке открывает подборку в Бенто.
// Показывает правила, счётчик и мини-превью заметок с парой строк текста.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const chip = require("ui/common/chip");
const richLink = require("ui/common/rich-link");
const confirmButton = require("ui/common/confirm-button");
const toast = require("ui/common/toast");
const pipeline = require("filters/pipeline");
const { ruleChips } = require("filters/presets");
const { merge } = require("filters/state");
const { newSeed } = require("lib/random");
const { fmtNum, plural } = require("lib/ru");
const { snippet } = require("lib/text");

const stop = (fn) => (e) => { e.stopPropagation(); fn(e); };

module.exports = function presetCard(ctx, preset, posts, { hero = false } = {}) {
  const el = h("article", { class: ["sf-preset", "is-clickable", hero && "sf-preset--hero"], title: "Открыть подборку в Бенто", onClick: () => ctx.actions.openPreset(preset, "bento") });
  let seed = newSeed(), expanded = false;

  function draw() {
    clear(el);
    if (hero) el.append(h("span", { class: "sf-preset__glow" }));
    const { list } = pipeline.run(posts, { filter: merge(preset.filter), quick: preset.quick || "all", seed }, { config: ctx.config, flags: ctx.flags });
    const preview = list.slice(0, expanded ? 8 : 3);
    const rows = preview.map((p) => {
      const r = richLink(ctx, p);
      ctx.content.load(p).then((feats) => feats && r.setExcerpt(snippet(feats.text, 170))).catch(() => {});
      return r;
    });
    el.append(
      h("header", { class: "sf-preset__head" }, h("span", { class: "sf-preset__icon" }, icon(preset.icon || "star", { size: 18 })),
        h("div", { class: "sf-preset__titles" }, h("h3", null, preset.name), h("span", { class: "sf-preset__count" }, `${fmtNum(list.length)} ${plural(list.length, ["заметка", "заметки", "заметок"])}`)),
        h("div", { class: "sf-preset__tools" },
          preset.quick === "random" && h("button", { type: "button", class: "sf-iconbtn", title: "Перемешать", onClick: stop(() => { seed = newSeed(); draw(); }) }, icon("dice", { size: 15 })),
          h("button", { type: "button", class: "sf-iconbtn", title: "Редактировать в конструкторе", onClick: stop(() => ctx.actions.editPreset(preset)) }, icon("sliders", { size: 15 })),
          confirmButton({ title: "Удалить подборку", onConfirm: () => { ctx.presets.remove(preset.id); toast(ctx, "Подборка удалена"); ctx.reload(); } }))),
      preset.description && h("p", { class: "sf-preset__desc" }, preset.description),
      h("div", { class: "sf-preset__rules" }, ruleChips(preset).map((t) => chip({ text: t, kind: "rule" }))),
      h("div", { class: "sf-preset__preview" }, rows.length ? rows : h("span", { class: "sf-muted" }, "Нет подходящих заметок")),
      h("footer", { class: "sf-preset__foot" },
        list.length > 3 && h("button", { type: "button", class: "sf-link", onClick: stop(() => { expanded = !expanded; draw(); }) }, expanded ? "Свернуть" : `Показать ещё ${Math.min(5, list.length - 3)}`),
        h("span", { class: "sf-toolbar__spacer" }),
        h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-btn--sm", onClick: stop(() => ctx.actions.openPreset(preset, "stream")) }, "Лента"),
        h("span", { class: "sf-preset__open" }, "Открыть в Бенто", icon("arrowUpRight", { size: 13 }))));
  }
  draw();
  el.sfReady = Promise.resolve();
  return el;
};
