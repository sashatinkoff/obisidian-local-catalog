// ui/common/select.js — нативный select со стилями темы.
const { h } = require("lib/dom");
module.exports = function select({ options, value, onChange, title }) {
  const el = h("select", { class: "sf-select", title, onChange: (e) => onChange(e.target.value) },
    options.map((o) => h("option", { value: o.id, selected: o.id === value }, o.label)));
  return el;
};
