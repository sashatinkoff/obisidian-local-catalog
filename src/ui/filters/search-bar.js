// ui/filters/search-bar.js — поиск по названию или тексту + диапазон дат (от и до).
// Три параметра независимы: изменение ЛЮБОГО из них сразу применяет фильтр (текст — с задержкой 0,1 с, даты — мгновенно).
// Индексация текстов идёт в фоне (autoIndex) или при первом фокусе; пока она не закончилась, рядом виден прогресс.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { debounce } = require("lib/async");

module.exports = function searchBar(ctx, { posts, placeholder = "Поиск по названию или тексту…", cls = "" }) {
  const status = h("span", { class: "sf-search__status" });
  const apply = debounce((v) => ctx.actions.setFilter({ text: v }), 100);
  const f0 = ctx.store.get().filter;

  const input = h("input", { class: "sf-input", type: "search", placeholder, value: f0.text || "", enterkeyhint: "search",
    onFocus: () => ctx.indexer.ensure(posts),
    onInput: (e) => { clearBtn.style.display = e.target.value ? "" : "none"; apply(e.target.value); },
    onKeydown: (e) => { if (e.key === "Escape") { input.value = ""; clearBtn.style.display = "none"; ctx.actions.setFilter({ text: "" }); } } });
  const clearBtn = h("button", { type: "button", class: "sf-search__clear", title: "Очистить", style: { display: input.value ? "" : "none" }, onClick: () => { input.value = ""; clearBtn.style.display = "none"; ctx.actions.setFilter({ text: "" }); } }, icon("x", { size: 13 }));

  // Даты: каждое поле применяется само по себе (событие input — при выборе даты, change — на случай браузеров, где input не приходит)
  const dateField = (key, label) => {
    const apply = (e) => { ctx.actions.setFilter({ [key]: e.target.value || "" }); syncDates(); };
    const field = h("input", { class: "sf-input sf-date__input", type: "date", value: f0[key] || "", "aria-label": `Дата ${label}`, onInput: apply, onChange: apply });
    return { field, el: h("label", { class: "sf-date" }, h("span", { class: "sf-date__label" }, label), field) };
  };
  const from = dateField("dateFrom", "от"), to = dateField("dateTo", "до");
  const datesClear = h("button", { type: "button", class: "sf-search__clear sf-date__clear", title: "Сбросить даты", onClick: () => { ctx.actions.setFilter({ dateFrom: "", dateTo: "" }); } }, icon("x", { size: 13 }));
  function syncDates() { datesClear.style.display = from.field.value || to.field.value ? "" : "none"; }
  syncDates();

  const el = h("div", { class: ["sf-search", cls] },
    h("div", { class: "sf-input-wrap" }, icon("search", { size: 14 }), input, clearBtn),
    h("div", { class: "sf-daterange", role: "group", "aria-label": "Диапазон дат" }, from.el, to.el, datesClear),
    status);

  const showStatus = (s) => { status.textContent = s.running ? `индексация ${s.i}/${s.n}` : ""; status.title = s.running ? "Пока тексты не проиндексированы, поиск идёт по заголовкам и тегам" : ""; };
  showStatus(ctx.indexer.status());
  const offIndex = ctx.indexer.onChange(showStatus);
  // внешний сброс фильтра (формула, «Сбросить», подборка) → синхронизируем поля
  const offStore = ctx.store.subscribe((s) => {
    const f = s.filter;
    if (document.activeElement !== input && input.value !== (f.text || "")) { input.value = f.text || ""; clearBtn.style.display = input.value ? "" : "none"; }
    if (from.field.value !== (f.dateFrom || "")) from.field.value = f.dateFrom || "";
    if (to.field.value !== (f.dateTo || "")) to.field.value = f.dateTo || "";
    syncDates();
  }, ["filter"]);
  return { el, dispose: () => { offIndex(); offStore(); } };
};
