// filters/presets.js — сохранённые подборки: сводка правил (чипы) и применение к состоянию ленты.
const { merge } = require("filters/state");
const { byId: periods } = require("filters/periods");
const { label: attrLabel } = require("filters/attrs");

function ruleChips(preset) {
  const f = merge(preset.filter), chips = [];
  if (f.any.length) chips.push("теги: " + f.any.map((t) => "#" + t).join(" OR "));
  if (f.all.length) chips.push("все: " + f.all.map((t) => "#" + t).join(" AND "));
  if (f.not.length) chips.push("без: " + f.not.map((t) => "#" + t).join(", "));
  if (f.attrs.length) chips.push(f.attrs.map(attrLabel).join(", "));
  if (f.types.length) chips.push("тип: " + f.types.join(", "));
  if (f.minBacklinks > 0) chips.push("связи: > " + (f.minBacklinks - 1));
  if (periods[f.period] && f.period !== "all") chips.push("период: " + periods[f.period].label.toLowerCase());
  if (f.dateFrom) chips.push("с " + f.dateFrom);
  if (f.dateTo) chips.push("по " + f.dateTo);
  if (preset.quick === "today") chips.push("в этот день");
  if (preset.quick === "random") chips.push("рандом");
  if (preset.quick === "favorites") chips.push("избранное");
  return chips;
}
const toState = (preset) => ({ quick: preset.quick || "all", filter: merge(preset.filter) });
module.exports = { ruleChips, toState };
