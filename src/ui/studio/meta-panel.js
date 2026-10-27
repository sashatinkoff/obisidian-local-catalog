// ui/studio/meta-panel.js — метаданные подборки: название, описание, быстрый режим, иконка.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const modes = require("filters/quick-modes");
const select = require("ui/common/select");

const ICONS = ["bolt", "mic", "video", "quote", "history", "dice", "star", "hash", "file", "link", "tasks", "image", "share"];

module.exports = function metaPanel(ctx, draft) {
  const el = h("section", { class: "sf-meta" });
  function draw() {
    clear(el);
    const quick = ctx.store.get().quick;
    el.append(
      h("div", { class: "sf-field sf-field--grow" }, h("label", null, "Название подборки"), h("input", { class: "sf-input", type: "text", value: draft.name, placeholder: "Например: Инженерные инсайты", onInput: (e) => (draft.name = e.target.value) })),
      h("div", { class: "sf-field sf-field--grow" }, h("label", null, "Описание"), h("input", { class: "sf-input", type: "text", value: draft.description, onInput: (e) => (draft.description = e.target.value) })),
      h("div", { class: "sf-field" }, h("label", null, "Режим"), select({ options: modes.MODES.map((m) => ({ id: m.id, label: m.label({ now: Date.now() }) })), value: quick, onChange: (v) => ctx.actions.setQuick(v) })),
      h("div", { class: "sf-field" }, h("label", null, "Иконка"), h("div", { class: "sf-iconpick" }, ICONS.map((i) => h("button", { type: "button", class: ["sf-iconbtn", i === draft.icon && "is-active"], onClick: () => { draft.icon = i; draw(); } }, icon(i, { size: 15 }))))));
  }
  draw();
  return { el, dispose: ctx.store.subscribe(draw, ["quick"]) };
};
