// stats/tags.js — частоты тегов.
function tagCounts(posts, { limit = 30, exclude = [] } = {}) {
  const m = new Map(), ex = new Set(exclude);
  for (const p of posts) for (const t of p.tags) if (!ex.has(t)) m.set(t, (m.get(t) || 0) + 1);
  return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, limit);
}
module.exports = { tagCounts };
