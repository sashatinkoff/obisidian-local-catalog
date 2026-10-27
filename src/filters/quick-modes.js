// filters/quick-modes.js — быстрые режимы ленты: Все / В этот день / Рандомные / Избранное.
const { sameMonthDay } = require("lib/date");
const { shuffle } = require("lib/random");

const MODES = [
  { id: "all", icon: "infinity", label: () => "Все записи", test: () => true },
  { id: "today", icon: "history", label: () => "В этот день", test: (p, c) => sameMonthDay(p.ts, c.now) },
  { id: "random", icon: "dice", label: () => "Рандомные", pick: (list, c) => shuffle(list, c.seed).slice(0, c.config.randomCount || 12) },
  { id: "favorites", icon: "star", label: () => "Избранное", test: (p, c) => c.flags.isFavorite(p) },
];
const byId = Object.fromEntries(MODES.map((m) => [m.id, m]));

// c = { now, seed, config, flags }
function applyQuick(posts, quick, c) {
  const m = byId[quick] || byId.all;
  let out = m.test ? posts.filter((p) => m.test(p, c)) : posts;
  if (m.pick) out = m.pick(out, c);
  return out;
}
const count = (posts, id, c) => { const m = byId[id]; return m && m.test ? posts.filter((p) => m.test(p, c)).length : posts.length; };
module.exports = { MODES, byId, applyQuick, count };
