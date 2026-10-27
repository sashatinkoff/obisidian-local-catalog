// ui/common/icon-button.js — квадратная кнопка-иконка 32×32.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
module.exports = function iconButton({ name, title, onClick, active = false, fill = false, label, cls }) {
  const b = h("button", { type: "button", class: ["sf-iconbtn", active && "is-active", cls], title, "aria-label": title, onClick }, icon(name, { size: 16, fill }));
  if (label) b.append(h("span", { class: "sf-iconbtn__label" }, label));
  return b;
};
