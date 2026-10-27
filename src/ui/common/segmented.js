// ui/common/segmented.js — переключатель-сегменты (Masonry / Flow / Timeline).
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
module.exports = function segmented({ options, value, onChange }) {
  return h("div", { class: "sf-segmented", role: "tablist" },
    options.map((o) => h("button", { type: "button", role: "tab", class: ["sf-segmented__btn", o.id === value && "is-active"], onClick: () => onChange(o.id) }, o.icon && icon(o.icon, { size: 14 }), h("span", null, o.label))));
};
