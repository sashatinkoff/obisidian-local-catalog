// filters/predicates.js — отдельные условия фильтра (каждое — чистая функция).
const { inPeriod } = require("filters/periods");
const { dayKey, toMs, startOfDay, DAY } = require("lib/date");
const { norm } = require("lib/search");
const tagHit = (postTags, wanted) => postTags.some((t) => t === wanted || t.startsWith(wanted + "/"));

const predicates = {
  any: (p, f) => !f.any.length || f.any.some((t) => tagHit(p.tags, t)),
  all: (p, f) => f.all.every((t) => tagHit(p.tags, t)),
  not: (p, f) => !f.not.some((t) => tagHit(p.tags, t)),
  attrs: (p, f) => f.attrs.every((a) => p.attrs.has(a)),
  types: (p, f) => !f.types.length || f.types.includes(p.type),
  sources: (p, f) => !f.sources.length || f.sources.includes(p.source),
  period: (p, f, now) => inPeriod(p.ts, f.period, now),
  day: (p, f) => !f.day || dayKey(p.ts) === f.day,
  // Диапазон дат: «от» и «до» независимы — можно задать любой из них, оба или ни одного; границы включительно.
  range: (p, f) => {
    const from = f.dateFrom ? toMs(f.dateFrom) : null, to = f.dateTo ? toMs(f.dateTo) : null;
    if (from != null && p.ts < startOfDay(from)) return false;
    if (to != null && p.ts >= startOfDay(to) + DAY) return false;
    return true;
  },
  backlinks: (p, f) => p.backlinks >= (f.minBacklinks || 0),
  text: (p, f) => {
    const words = norm((f.text || "").trim()).split(/\s+/).filter(Boolean);
    return words.every((w) => p.search.includes(w) || (p.searchBody || "").includes(w));
  },
};
module.exports = { predicates, tagHit };
