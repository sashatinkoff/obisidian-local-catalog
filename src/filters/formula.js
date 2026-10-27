// filters/formula.js — человекочитаемая формула фильтра. Показывает ВСЕ активные условия
// (теги, атрибуты, тип, источник, период, связи, день, текст) — скрытых условий не бывает.
const { label } = require("filters/attrs");
const { byId: periods } = require("filters/periods");

function toTokens(f) {
  const groups = [];
  if (f.any.length) groups.push({ mode: "any", op: "OR", tags: f.any });
  if (f.all.length) groups.push({ mode: "all", op: "AND", tags: f.all });
  const out = [];
  const sep = () => { if (out.length) out.push({ t: "op", v: "AND" }); };
  for (const g of groups) {
    sep(); out.push({ t: "paren", v: "(" });
    g.tags.forEach((tag, i) => { if (i) out.push({ t: "op", v: g.op }); out.push({ t: "tag", v: "#" + tag, tag, mode: g.mode }); });
    out.push({ t: "paren", v: ")" });
  }
  if (f.not.length) {
    sep(); out.push({ t: "op", v: "NOT", neg: true }, { t: "paren", v: "(" });
    f.not.forEach((tag, i) => { if (i) out.push({ t: "op", v: "OR" }); out.push({ t: "tag", v: "!#" + tag, tag, mode: "not" }); });
    out.push({ t: "paren", v: ")" });
  }
  for (const a of f.attrs) { sep(); out.push({ t: "attr", v: label(a), attr: a }); }
  // прочие условия — отдельными удаляемыми чипами
  const cond = (v, key, item) => { sep(); out.push({ t: "cond", v, key, item }); };
  for (const t of f.types) cond("тип: " + t, "types", t);
  for (const s of f.sources) cond("источник: " + s, "sources", s);
  if (f.period && f.period !== "all") cond("период: " + (periods[f.period] ? periods[f.period].label.toLowerCase() : f.period), "period");
  if (f.minBacklinks > 0) cond("связи ≥ " + f.minBacklinks, "minBacklinks");
  if (f.dateFrom) cond("с " + f.dateFrom, "dateFrom");
  if (f.dateTo) cond("по " + f.dateTo, "dateTo");
  if (f.day) cond("день: " + f.day, "day");
  if ((f.text || "").trim()) cond("поиск: «" + f.text.trim() + "»", "text");
  return out;
}
const toString = (f) => toTokens(f).map((t) => t.v).join(" ");
module.exports = { toTokens, toString };
