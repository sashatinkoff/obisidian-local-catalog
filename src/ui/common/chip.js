// ui/common/chip.js — чип: тег, режим, фильтр. kind: tag | not | attr | rule.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");

module.exports = function chip({ text, kind = "tag", active = false, count, onClick, onRemove, title, iconName }) {
  const el = h("span", { class: ["sf-chip", `sf-chip--${kind}`, active && "is-active", onClick && "is-clickable"], title, onClick, role: onClick ? "button" : null });
  if (iconName) el.append(icon(iconName, { size: 12 }));
  el.append(h("span", { class: "sf-chip__text" }, text));
  if (count != null) el.append(h("span", { class: "sf-chip__count" }, count));
  if (onRemove) el.append(h("span", { class: "sf-chip__x", onClick: (e) => { e.stopPropagation(); onRemove(e); } }, icon("x", { size: 11 })));
  return el;
};
