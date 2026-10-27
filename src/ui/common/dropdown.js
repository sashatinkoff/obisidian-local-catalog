// ui/common/dropdown.js — выпадающее меню. render(panel, close) вызывается при каждом открытии.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");

module.exports = function dropdown({ label, iconName, title, render, align = "right" }) {
  const panel = h("div", { class: ["sf-menu", `sf-menu--${align}`], style: { display: "none" } });
  const btn = h("button", { type: "button", class: "sf-btn sf-btn--ghost", title, onClick: () => (open ? close() : show()) }, iconName && icon(iconName, { size: 14 }), label && h("span", null, label), icon("chevron", { size: 13 }));
  const el = h("div", { class: "sf-dropdown" }, btn, panel);
  let open = false;
  const onDoc = (e) => { if (!el.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };

  function show() { open = true; clear(panel); render(panel, close, show); panel.style.display = ""; if (document.addEventListener) { document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey); } }
  function close() { open = false; panel.style.display = "none"; if (document.removeEventListener) { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); } }
  // redraw — перерисовать содержимое открытого меню
  return { el, close, redraw: () => { if (open) { clear(panel); render(panel, close, show); } } };
};
