// ui/filters/presets-menu.js — выпадающее меню «Подборки»: применить, удалить, сохранить текущий фильтр.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const dropdown = require("ui/common/dropdown");
const confirmButton = require("ui/common/confirm-button");
const pipeline = require("filters/pipeline");
const { merge, isDefault } = require("filters/state");
const toast = require("ui/common/toast");

module.exports = function presetsMenu(ctx, { posts }) {
  const count = (p) => pipeline.run(posts, { filter: merge(p.filter), quick: p.quick || "all", seed: 1 }, { config: ctx.config, flags: ctx.flags }).list.length;

  const dd = dropdown({
    label: "Подборки", iconName: "bookmark", title: "Сохранённые подборки",
    render(panel, close) {
      const s = ctx.store.get();
      const list = ctx.presets.list();
      panel.append(h("div", { class: "sf-menu__title" }, "Смарт-подборки"));
      const rows = h("div", { class: "sf-menu__list" });
      if (!list.length) rows.append(h("div", { class: "sf-menu__empty" }, "Подборок пока нет"));
      for (const p of list) {
        rows.append(h("div", { class: ["sf-menu__row", p.id === s.presetId && "is-active"] },
          h("button", { type: "button", class: "sf-menu__item", onClick: () => { ctx.actions.applyPreset(p); close(); } }, icon(p.icon || "star", { size: 15 }), h("span", { class: "sf-menu__name" }, p.name), h("span", { class: "sf-menu__count" }, count(p))),
          confirmButton({ title: "Удалить подборку", onConfirm: () => { ctx.presets.remove(p.id); if (ctx.store.get().presetId === p.id) ctx.store.set({ presetId: null }); toast(ctx, "Подборка удалена"); dd.redraw(); } })));
      }
      panel.append(rows);

      const name = h("input", { class: "sf-input sf-input--sm", type: "text", placeholder: "Название подборки", style: { width: "100%" } });
      const save = () => {
        const n = name.value.trim();
        if (!n) { name.focus(); toast(ctx, "Введите название подборки"); return; }
        const cur = ctx.store.get();
        ctx.presets.save({ name: n, icon: "star", description: "", quick: cur.quick, filter: cur.filter });
        toast(ctx, `Подборка «${n}» сохранена`); dd.redraw();
      };
      name.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
      const unsaved = isDefault(s.filter) && s.quick === "all";
      panel.append(h("div", { class: "sf-menu__save" },
        h("div", { class: "sf-menu__hint" }, unsaved ? "Выберите условия — и сохраните их как подборку" : "Сохранить текущий фильтр как подборку"),
        h("div", { class: "sf-menu__saverow" }, name, h("button", { type: "button", class: "sf-btn sf-btn--primary sf-btn--sm", onClick: save }, icon("save", { size: 13 }), "Сохранить"))),
        h("button", { type: "button", class: "sf-menu__link", onClick: () => { ctx.actions.enterView("collections"); close(); } }, "Все подборки →"));
    },
  });
  return dd;
};
