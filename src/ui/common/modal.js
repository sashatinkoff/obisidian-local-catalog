// ui/common/modal.js — модальное окно (шторка) поверх страницы: заголовок с кнопкой закрытия, прокручиваемое тело, нижняя панель.
// Живёт в <body> (position: fixed), поэтому не зависит от overflow/transform родителей; тему и токены берёт из data-sf-theme.
// Тело оформлено как .sf-root.is-mobile — все мобильные стили виджета работают и внутри окна.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");

module.exports = function openModal(ctx, { title }) {
  const closeCbs = [];
  const theme = () => ctx.store.get().theme;
  const body = h("div", { class: "sf-modal__body" });
  const footer = h("div", { class: "sf-modal__footer" });
  const closeBtn = h("button", { type: "button", class: "sf-iconbtn sf-modal__close", "aria-label": "Закрыть", onClick: () => close() }, icon("x", { size: 18 }));
  const inner = h("div", { class: "sf-root sf-modal__root is-mobile", dataset: { sfTheme: theme() } }, body);
  const sheet = h("div", { class: "sf-modal__sheet", role: "dialog", "aria-modal": "true", "aria-label": title },
    h("div", { class: "sf-modal__head" }, h("h2", { class: "sf-modal__title" }, title), closeBtn), inner, footer);
  const overlay = h("div", { class: "sf-modal", dataset: { sfTheme: theme() }, onClick: (e) => { if (e.target === overlay) close(); } }, sheet);
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const offTheme = ctx.store.subscribe((s) => { overlay.dataset.sfTheme = s.theme; inner.dataset.sfTheme = s.theme; }, ["theme"]);

  document.body.appendChild(overlay);
  if (document.addEventListener) document.addEventListener("keydown", onKey);
  let closed = false;
  function close() {
    if (closed) return; closed = true;
    offTheme(); if (document.removeEventListener) document.removeEventListener("keydown", onKey);
    closeCbs.forEach((cb) => cb()); overlay.remove();
  }
  return { body, footer, close, onClose: (cb) => closeCbs.push(cb), el: overlay };
};
