// ui/stats/bars.js — столбчатая диаграмма на div'ах (без SVG): подписи под столбцами, пик подсвечен, подсказка на каждом столбце.
const { h } = require("lib/dom");

// items: [{ label, value, title, show }] — show: подписывать ли столбец под осью (для плотных диаграмм — через один/несколько)
module.exports = function bars(items, { peakIndex = -1, height = 120, cls = "" } = {}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return h("div", { class: ["sf-bars", cls], style: { "--bars": items.length } },
    h("div", { class: "sf-bars__plot", style: { height: height + "px" } },
      items.map((it, i) => h("div", { class: ["sf-bars__col", i === peakIndex && "is-peak", it.value === 0 && "is-zero"], title: it.title || `${it.label}: ${it.value}` },
        h("div", { class: "sf-bars__bar", style: { height: Math.max(it.value ? 4 : 2, (it.value / max) * 100) + "%" } })))),
    h("div", { class: "sf-bars__axis" }, items.map((it) => h("span", { class: ["sf-bars__tick", it.show === false && "is-hidden"] }, it.label))));
};
