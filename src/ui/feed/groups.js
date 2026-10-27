// ui/feed/groups.js — группировка постов по дню (для Timeline).
const { dayKey, relativeLabel, fmtDateLong } = require("lib/date");
module.exports = function groupByDay(posts, now = Date.now()) {
  const groups = [], idx = new Map();
  for (const p of posts) {
    const k = dayKey(p.ts);
    if (!idx.has(k)) { const g = { key: k, label: relativeLabel(p.ts, now, false), date: fmtDateLong(p.ts), posts: [] }; idx.set(k, g); groups.push(g); }
    idx.get(k).posts.push(p);
  }
  return groups;
};
