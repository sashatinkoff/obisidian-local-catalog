// ui/studio/action-bar.js — панель действий конструктора: Сбросить · Открыть · Сохранить · Сохранить как новую · Удалить.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const confirmButton = require("ui/common/confirm-button");
const toast = require("ui/common/toast");

module.exports = function actionBar(ctx, draft) {
  const el = h("div", { class: "sf-actionbar" });

  function persist(asNew) {
    const name = (draft.name || "").trim();
    if (!name) { toast(ctx, "Введите название подборки"); return; }
    const s = ctx.store.get();
    const saved = ctx.presets.save({ id: asNew ? null : draft.id, name, description: draft.description, icon: draft.icon, quick: s.quick, filter: s.filter });
    draft.id = saved.id;
    ctx.store.set({ presetId: saved.id });
    toast(ctx, asNew ? "Сохранена как новая подборка" : "Подборка сохранена");
    draw();
  }

  function draw() {
    clear(el);
    const saved = !!(draft.id && ctx.presets.get(draft.id));
    el.append(
      h("button", { type: "button", class: "sf-btn sf-btn--ghost", onClick: () => ctx.actions.resetFilter() }, icon("refresh", { size: 14 }), "Сбросить условия"),
      h("button", { type: "button", class: "sf-btn sf-btn--ghost", onClick: () => { const s = ctx.store.get(); ctx.actions.openPreset({ id: saved ? draft.id : null, quick: s.quick, filter: s.filter }, "bento"); } }, icon("bento", { size: 14 }), "Открыть в Бенто"),
      h("span", { class: "sf-toolbar__spacer" }),
      confirmButton({ title: saved ? "Удалить подборку" : "Подборка ещё не сохранена", label: "Удалить", cls: "sf-btn sf-btn--danger", disabled: !saved, onConfirm: () => { ctx.presets.remove(draft.id); toast(ctx, "Подборка удалена"); ctx.actions.enterView("collections"); } }),
      saved && h("button", { type: "button", class: "sf-btn", onClick: () => persist(true) }, icon("copy", { size: 14 }), "Сохранить как новую"),
      h("button", { type: "button", class: "sf-btn sf-btn--primary", onClick: () => persist(false) }, icon("save", { size: 14 }), saved ? "Сохранить изменения" : "Сохранить подборку"));
  }
  draw();
  return { el, redraw: draw };
};
