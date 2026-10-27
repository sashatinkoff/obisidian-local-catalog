// ui/studio/dql-highlight.js — лёгкая подсветка DQL (без внешних библиотек).
const { h } = require("lib/dom");
const RE = /("(?:[^"\\]|\\.)*")|\b(TABLE|WITHOUT|ID|FROM|WHERE|AND|OR|SORT|DESC|ASC|AS|NOT)\b|\b([a-z]+)(?=\()|(\d+)/g;
module.exports = function highlight(code) {
  const out = []; let last = 0, m;
  RE.lastIndex = 0;
  while ((m = RE.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const cls = m[1] ? "str" : m[2] ? "kw" : m[3] ? "fn" : "num";
    out.push(h("span", { class: `sf-dql__${cls}` }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
};
