// stats/activity.js — активность по дням, матрица-тепловая карта и стрик.
const { dayKey, DAY, startOfDay } = require("lib/date");

function countByDay(posts) {
  const m = new Map();
  for (const p of posts) { const k = dayKey(p.ts); m.set(k, (m.get(k) || 0) + 1); }
  return m;
}
const level = (n, max) => (n <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((n / Math.max(max, 1)) * 4))));

// weeks столбцов × 7 строк (пн..вс); последняя колонка — текущая неделя.
function heatmap(byDay, now, weeks = 53) {
  const today = startOfDay(now), dow = (new Date(today).getDay() + 6) % 7;
  const start = today - (dow + (weeks - 1) * 7) * DAY;
  const max = Math.max(0, ...byDay.values());
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const ts = start + (w * 7 + d) * DAY, key = dayKey(ts), n = byDay.get(key) || 0;
      col.push({ key, ts, n, level: ts > today ? -1 : level(n, max) });
    }
    cols.push(col);
  }
  return cols;
}

function streak(byDay, now) {
  let cur = 0, d = startOfDay(now);
  if (!byDay.get(dayKey(d))) d -= DAY;
  while (byDay.get(dayKey(d))) { cur++; d -= DAY; }
  const keys = [...byDay.keys()].sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    const t = new Date(k + "T00:00:00").getTime();
    run = prev !== null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = t;
  }
  return { current: cur, best };
}
// Диапазоны числа заметок за день для каждого уровня цвета (для легенды): [от, до], до=null — «и больше».
function levelRanges(max) {
  if (max <= 0) return [[0, 0], [1, 1], [2, 2], [3, 3], [4, null]];
  const edges = [1, 2, 3, 4].map((l) => Math.max(1, Math.floor((max * l) / 4)));
  const out = [[0, 0]]; let from = 1;
  for (let l = 1; l <= 4; l++) { const to = l === 4 ? null : Math.max(from, edges[l - 1]); out.push([from, to]); if (to !== null) from = to + 1; }
  return out;
}
function summary(byDay) {
  let total = 0, best = null;
  for (const [key, n] of byDay) { total += n; if (!best || n > best.n) best = { key, n }; }
  return { total, activeDays: byDay.size, best };
}
module.exports = { countByDay, heatmap, streak, levelRanges, summary };
