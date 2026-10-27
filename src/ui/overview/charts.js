// ui/overview/charts.js — маленькие SVG-графики без зависимостей: спарклайн (area + линия) и кольцевая диаграмма.
const { h } = require("lib/dom");
const { uid } = require("lib/misc");

const f = (n) => Math.round(n * 100) / 100;
// Плавная кривая через точки (Catmull-Rom → кубические Безье)
function smooth(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)},${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)},${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])},${f(p2[1])}`;
  }
  return d;
}

// values — значения по дням (первые `visible` точек), total — сколько точек занимает вся ось X (дней в месяце).
function sparkline(values, { total = values.length, w = 200, hgt = 56, pad = 4 } = {}) {
  const max = Math.max(1, ...values), n = Math.max(2, total);
  const pts = values.map((v, i) => [(i / (n - 1)) * w, hgt - pad - (v / max) * (hgt - pad * 2)]);
  const gid = uid("sg"), line = smooth(pts), last = pts[pts.length - 1] || [0, hgt - pad];
  const box = h("div", { class: "sf-spark" });
  box.innerHTML = `<svg viewBox="0 0 ${w} ${hgt}" preserveAspectRatio="none" aria-hidden="true">` +
    `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity="0.35"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>` +
    (pts.length > 1 ? `<path d="${line} L${f(last[0])},${hgt} L0,${hgt} Z" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` : "") +
    `</svg>`;
  // точка «сегодня» — HTML-элементом, чтобы не искажалась при растяжении SVG
  box.append(h("span", { class: "sf-spark__dot", style: { left: (last[0] / w) * 100 + "%", top: (last[1] / hgt) * 100 + "%" } }));
  return box;
}

// segments: [{ id, value }] → кольцо; центр — подпись
function donut(segments, { size = 132, thick = 16, center = "" } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1, r = (size - thick) / 2, c = 2 * Math.PI * r;
  let off = 0, arcs = "";
  for (const s of segments) {
    const len = (s.value / total) * c;
    arcs += `<circle class="sf-donut__seg sf-donut__seg--${s.id}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${thick}" stroke-dasharray="${f(Math.max(0, len - 2))} ${f(c - Math.max(0, len - 2))}" stroke-dashoffset="${f(-off)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    off += len;
  }
  const box = h("div", { class: "sf-donut", style: { width: size + "px", height: size + "px" } });
  box.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle class="sf-donut__track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${thick}"/>${arcs}</svg>`;
  box.append(h("div", { class: "sf-donut__center" }, center));
  return box;
}
module.exports = { sparkline, donut };
