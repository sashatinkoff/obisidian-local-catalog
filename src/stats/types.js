// stats/types.js — распределение заметок по типам карточек.
function typeCounts(posts) {
  const m = new Map();
  for (const p of posts) m.set(p.type || "text", (m.get(p.type || "text") || 0) + 1);
  const total = posts.length || 1;
  return [...m.entries()].map(([id, count]) => ({ id, count, pct: Math.round((count / total) * 100) })).sort((a, b) => b.count - a.count);
}
module.exports = { typeCounts };
