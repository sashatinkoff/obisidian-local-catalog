// ui/filters/filters-modal.js — «Фильтры» в модальном окне (мобильная версия): поиск и даты, режим, подборки, теги, атрибуты,
// условия, порядок и вид. Фильтры применяются сразу; «Показать N» закрывает окно.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const openModal = require("ui/common/modal");
const searchBar = require("ui/filters/search-bar");
const quickbar = require("ui/filters/quickbar");
const presetsMenu = require("ui/filters/presets-menu");
const tagBuilder = require("ui/filters/tag-builder");
const attrToggles = require("ui/filters/attr-toggles");
const advanced = require("ui/filters/advanced");
const formulaBar = require("ui/filters/formula-bar");
const sortToggle = require("ui/feed/sort-toggle");
const segmented = require("ui/common/segmented");
const { LAYOUTS } = require("ui/feed/layouts");
const { withUnit } = require("lib/ru");

const section = (title, ...children) => h("section", { class: "sf-msec" }, h("h3", { class: "sf-msec__title" }, title), ...children);

// onCount(cb) — подписка на число найденных заметок (возвращает функцию отписки); getCount() — текущее значение
module.exports = function openFiltersModal(ctx, { posts, withLayouts, onRefresh, getCount, onCount }) {
  const modal = openModal(ctx, { title: "Фильтры" });
  const parts = [formulaBar(ctx), searchBar(ctx, { posts, cls: "sf-search--modal" }), quickbar(ctx, { posts }), presetsMenu(ctx, { posts }), tagBuilder(ctx, { posts }), attrToggles(ctx), advanced(ctx), sortToggle(ctx)];
  const [formula, search, quick, presets, tags, attrs, adv, sort] = parts;

  const layoutRow = h("div", { class: "sf-msec__row" }, sort.el);
  let unLayout = () => {};
  if (withLayouts) {
    const draw = () => { const old = layoutRow.querySelector ? layoutRow.querySelector(".sf-segmented") : null; if (old) old.remove(); layoutRow.append(segmented({ options: LAYOUTS, value: ctx.store.get().layout, onChange: (id) => ctx.actions.setLayout(id) })); };
    draw(); unLayout = ctx.store.subscribe(draw, ["layout"]);
  }

  modal.body.append(
    section("Применено", formula.el),
    section("Поиск и даты", search.el),
    section("Режим", quick.el),
    section("Подборки", presets.el),
    section("Теги", tags.el),
    section("Атрибуты", attrs.el),
    section("Условия", adv.el),
    section("Порядок и вид", layoutRow));

  const showBtn = h("button", { type: "button", class: "sf-btn sf-btn--primary sf-modal__show", onClick: () => modal.close() });
  const drawShow = () => { showBtn.textContent = `Показать ${withUnit(getCount(), ["заметку", "заметки", "заметок"])}`; };
  drawShow();
  const offCount = onCount(drawShow);
  modal.footer.append(
    h("button", { type: "button", class: "sf-btn sf-btn--ghost", onClick: () => ctx.actions.resetFilter() }, icon("refresh", { size: 14 }), "Сбросить"),
    h("button", { type: "button", class: "sf-iconbtn sf-modal__refresh", title: "Перечитать хранилище", "aria-label": "Перечитать хранилище", onClick: () => { modal.close(); onRefresh(); } }, icon("refresh", { size: 16 })),
    showBtn);

  modal.onClose(() => { offCount(); unLayout(); parts.forEach((p) => p.dispose && p.dispose()); presets.close && presets.close(); });
  return modal;
};
