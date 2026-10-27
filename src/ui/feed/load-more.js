// ui/feed/load-more.js — кнопка «Показать ещё N».
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
module.exports = function loadMore({ remaining, onClick }) {
  return h("button", { type: "button", class: "sf-btn sf-btn--ghost sf-loadmore", onClick }, icon("chevron", { size: 14 }), `Показать ещё ${remaining}`);
};
