// ui/common/nav.js — верхняя панель: вкладки на всю ширину шапки + справа версия и переключатели
// (новая вкладка, полная ширина, тема). Бренд-чип убран: он вытеснял вкладки на узких экранах.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { list } = require("views");
const iconButton = require("ui/common/icon-button");
const versionBadge = require("ui/common/version-badge");
const openSettingsModal = require("ui/common/settings-modal");

const resolvedTheme = (t) => (t === "auto" ? (document.body && document.body.classList && document.body.classList.contains("theme-dark") ? "dark" : "light") : t);

module.exports = function nav(ctx) {
  const el = h("nav", { class: "sf-nav", "aria-label": "Разделы" });
  function draw() {
    clear(el);
    const s = ctx.store.get(), cur = s.view, dark = resolvedTheme(s.theme) === "dark";
    const mobile = !!(ctx.rootEl && ctx.rootEl.classList.contains("is-mobile"));
    const tabs = list.filter((v) => v.nav !== false).map((v) =>
      h("button", { type: "button", role: "tab", "aria-selected": v.id === cur ? "true" : "false", class: ["sf-nav__tab", v.short && "has-short", v.id === cur && "is-active"], title: v.title, onClick: () => ctx.actions.enterView(v.id) },
        h("span", { class: "sf-nav__full" }, v.title), v.short && h("span", { class: "sf-nav__short" }, v.short)));
    if (mobile) {
      // Телефон: только разделы (потоком, с переносом) и кнопка «Настройки» — переключатели вида/темы/вкладки внутри неё
      el.append(h("div", { class: "sf-nav__tabs", role: "tablist" }, tabs,
        h("button", { type: "button", class: "sf-nav__gear sf-nav__plus", "aria-label": "Новая заметка", title: "Новая заметка", onClick: () => ctx.createNote() }, icon("plus", { size: 16 })),
        h("button", { type: "button", class: "sf-nav__gear", "aria-label": "Настройки", onClick: () => openSettingsModal(ctx) }, icon("sliders", { size: 16 }))));
      return;
    }
    el.append(
      h("div", { class: "sf-nav__tabs", role: "tablist" }, tabs),
      h("div", { class: "sf-nav__right" },
        h("button", { type: "button", class: "sf-newnote", title: "Создать заметку (место — в настройках плагина)", onClick: () => ctx.createNote() }, icon("plus", { size: 15 }), h("span", null, "Новая заметка")),
        versionBadge(ctx),
        iconButton({ name: "phone", title: s.viewMode === "mobile" ? "Мобильный вид включён — нажмите, чтобы вернуть автоопределение" : "Показать мобильный вид (один столбец)", active: s.viewMode === "mobile", onClick: () => ctx.actions.setViewMode("mobile") }),
        iconButton({ name: "monitor", title: s.viewMode === "desktop" ? "Десктопный вид включён — нажмите, чтобы вернуть автоопределение" : "Показать десктопный вид (колонки, широкая шапка)", active: s.viewMode === "desktop", onClick: () => ctx.actions.setViewMode("desktop") }),
        iconButton({ name: "eye", title: s.popupView ? "Заметки открываются в плавающем окне просмотра (Ctrl/Cmd+клик — в редакторе)" : "Открывать заметки в плавающем окне просмотра", active: s.popupView, onClick: () => ctx.actions.setPopupView(!s.popupView) }),
        iconButton({ name: "newtab", title: s.openInNewTab ? "Заметки открываются в новой вкладке" : "Открывать заметки в новой вкладке", active: s.openInNewTab, onClick: () => ctx.actions.setOpenInNewTab(!s.openInNewTab) }),
        iconButton({ name: s.fullWidth ? "shrink" : "expand", title: s.fullWidth ? "Обычная ширина" : "На всю ширину", active: s.fullWidth, cls: "sf-nav__fullbtn", onClick: () => ctx.actions.setFullWidth(!s.fullWidth) }),
        h("button", { type: "button", class: "sf-themebtn", "aria-label": dark ? "Тёмная тема" : "Светлая тема", onClick: () => ctx.actions.setTheme(dark ? "light" : "dark") }, icon(dark ? "moon" : "sun", { size: 16 }))));
  }
  ctx.refreshNav = draw; // шапка зависит от мобильного режима — shell вызывает после смены вида/ширины
  draw();
  ctx.store.subscribe(draw, ["view", "fullWidth", "openInNewTab", "popupView", "theme", "viewMode"]);
  return el;
};
