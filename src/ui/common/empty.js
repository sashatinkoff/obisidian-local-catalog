// ui/common/empty.js — пустое состояние.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
module.exports = function empty({ title, hint, action }) {
  return h("div", { class: "sf-empty" }, icon("search", { size: 28 }), h("div", { class: "sf-empty__title" }, title), hint && h("div", { class: "sf-empty__hint" }, hint), action);
};
