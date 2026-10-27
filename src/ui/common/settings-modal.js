// ui/common/settings-modal.js — «Настройки» в модальном окне (мобильная версия): вид, тема, открытие заметок, ширина, версия.
// На телефоне эти переключатели не занимают место в шапке — там остаются только разделы.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const openModal = require("ui/common/modal");
const { VERSION, RELEASED } = require("app/version");

const KEYS = ["viewMode", "theme", "openInNewTab", "popupView", "fullWidth"];

module.exports = function openSettingsModal(ctx) {
  const modal = openModal(ctx, { title: "Настройки" });
  const pills = (options, value, onPick) => h("div", { class: "sf-msec__row" }, options.map(([id, label, ic]) =>
    h("button", { type: "button", class: ["sf-sortbtn", id === value && "is-asc"], onClick: () => onPick(id) }, ic && icon(ic, { size: 14 }), h("span", null, label))));
  const toggle = (label, on, onClick, ic) => h("button", { type: "button", class: ["sf-setrow", on && "is-on"], role: "switch", "aria-checked": on ? "true" : "false", onClick },
    icon(ic, { size: 16 }), h("span", { class: "sf-setrow__label" }, label), h("span", { class: "sf-setrow__state" }, on ? "Вкл" : "Выкл"));
  const section = (title, ...c) => h("section", { class: "sf-msec" }, h("h3", { class: "sf-msec__title" }, title), ...c);

  function draw() {
    const s = ctx.store.get();
    clear(modal.body);
    modal.body.append(
      section("Вид", pills([["auto", "Авто"], ["mobile", "Мобильный", "phone"], ["desktop", "Десктопный", "monitor"]], s.viewMode || "auto", (m) => ctx.actions.setViewModeTo(m))),
      section("Тема", pills([["auto", "Как в Obsidian"], ["light", "Светлая", "sun"], ["dark", "Тёмная", "moon"]], s.theme, (t) => ctx.actions.setTheme(t))),
      section("Заметки", toggle("Плавающее окно просмотра", s.popupView, () => ctx.actions.setPopupView(!s.popupView), "eye"),
        toggle("Открывать в новой вкладке", s.openInNewTab, () => ctx.actions.setOpenInNewTab(!s.openInNewTab), "newtab"),
        toggle("Страница на всю ширину", s.fullWidth, () => ctx.actions.setFullWidth(!s.fullWidth), "expand")),
      section("О виджете", h("a", { class: "sf-setrow", href: "#", onClick: (e) => { e.preventDefault(); modal.close(); ctx.openChangelog(); } },
        icon("file", { size: 16 }), h("span", { class: "sf-setrow__label" }, `Journal Stream v${VERSION}`), h("span", { class: "sf-setrow__state" }, `${RELEASED} · что нового`))));
  }
  draw();
  const off = ctx.store.subscribe(draw, KEYS);
  modal.footer.append(h("button", { type: "button", class: "sf-btn sf-btn--primary sf-modal__show", onClick: () => modal.close() }, "Готово"));
  modal.onClose(off);
  return modal;
};
