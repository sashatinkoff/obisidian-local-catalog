// filters/summary.js — краткая сводка применённых условий для мобильной панели: ["Подборка: …", "В этот день", "#a #b", "с 1 окт", …].
const { label: attrLabel } = require("filters/attrs");
const { byId: periods } = require("filters/periods");
const { MONTHS_GEN, toMs } = require("lib/date");

const QUICK = { today: "В этот день", random: "Рандом", favorites: "Избранное" };
function shortDate(s) {
  const ms = toMs(s);
  if (ms == null) return s;
  const d = new Date(ms), cur = new Date().getFullYear();
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()].slice(0, 3)}${d.getFullYear() === cur ? "" : " " + d.getFullYear()}`;
}
const tagList = (arr, max = 3) => arr.slice(0, max).map((t) => "#" + t).join(" ") + (arr.length > max ? ` +${arr.length - max}` : "");

// presetName — имя активной подборки (если есть). Возвращает массив коротких строк в порядке важности.
function summarize(state, { presetName } = {}) {
  const f = state.filter, out = [];
  if (presetName) out.push("Подборка: " + presetName);
  if (QUICK[state.quick]) out.push(QUICK[state.quick]);
  if (f.any.length) out.push(tagList(f.any));
  if (f.all.length) out.push("все: " + tagList(f.all));
  if (f.not.length) out.push("без " + tagList(f.not));
  if (f.attrs.length) out.push(f.attrs.map(attrLabel).join(", "));
  if ((f.text || "").trim()) out.push("«" + f.text.trim() + "»");
  if (f.dateFrom || f.dateTo) out.push(f.dateFrom && f.dateTo ? `${shortDate(f.dateFrom)} – ${shortDate(f.dateTo)}` : f.dateFrom ? "с " + shortDate(f.dateFrom) : "по " + shortDate(f.dateTo));
  if (f.day) out.push("день " + shortDate(f.day));
  if (f.period && f.period !== "all" && periods[f.period]) out.push(periods[f.period].label.toLowerCase());
  if (f.minBacklinks > 0) out.push("связи ≥ " + f.minBacklinks);
  if (f.sources.length) out.push("источник: " + f.sources.join(", "));
  if (f.types.length) out.push("тип: " + f.types.join(", "));
  if (f.sort === "date-asc") out.push("Старые сначала");
  else if (f.sort !== "date-desc") out.push("сортировка: " + f.sort.replace(/-.*/, ""));
  return out;
}
module.exports = { summarize, shortDate };
