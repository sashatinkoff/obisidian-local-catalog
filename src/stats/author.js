// stats/author.js — «мини-статистика по автору»: когда вы пишете, рекорды серий, самые длинные записи. Чистые функции.
const { dayKey, DAY, startOfDay } = require("lib/date");

const keyTs = (k) => new Date(k + "T00:00:00").getTime();

// Часы суток: учитываются только записи с указанным временем (hasTime) — иначе всё упадёт в 00:00.
function byHour(posts) {
  const counts = Array(24).fill(0); let timed = 0;
  for (const p of posts) { if (!p.hasTime) continue; counts[new Date(p.ts).getHours()]++; timed++; }
  return { counts, timed, total: posts.length };
}
// Дни недели (пн..вс).
function byWeekday(posts) {
  const counts = Array(7).fill(0);
  for (const p of posts) counts[(new Date(p.ts).getDay() + 6) % 7]++;
  return counts;
}
// По годам (по возрастанию) и по месяцам года (янв..дек, суммарно за все годы).
function byYear(posts) {
  const m = new Map();
  for (const p of posts) { const y = new Date(p.ts).getFullYear(); m.set(y, (m.get(y) || 0) + 1); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count }));
}
const peak = (counts) => { let i = 0; counts.forEach((v, k) => { if (v > counts[i]) i = k; }); return counts[i] > 0 ? i : -1; };

// Серии подряд идущих дней с записями: лучшая за всё время, текущая; самая долгая пауза между записями.
function streakRecords(byDay, now) {
  const keys = [...byDay.keys()].sort();
  let best = { len: 0, from: null, to: null }, run = 0, runFrom = null, prev = null, gap = { days: 0, from: null, to: null };
  for (const k of keys) {
    const t = keyTs(k);
    if (prev !== null && Math.round((t - prev) / DAY) === 1) run++; else { run = 1; runFrom = k; }
    if (prev !== null) { const g = Math.round((t - prev) / DAY) - 1; if (g > gap.days) gap = { days: g, from: dayKey(prev + DAY), to: dayKey(t - DAY) }; }
    if (run > best.len) best = { len: run, from: runFrom, to: k };
    prev = t;
  }
  let cur = { len: 0, from: null, to: null }, d = startOfDay(now);
  if (!byDay.get(dayKey(d))) d -= DAY;
  const to = dayKey(d);
  while (byDay.get(dayKey(d))) { cur.len++; cur.from = dayKey(d); d -= DAY; }
  if (cur.len) cur.to = to;
  return { best, current: cur, gap };
}
// Самый плодотворный день и месяц.
function busiest(byDay) {
  let day = null; const months = new Map();
  for (const [k, n] of byDay) { if (!day || n > day.n) day = { key: k, n }; const mk = k.slice(0, 7); months.set(mk, (months.get(mk) || 0) + n); }
  let month = null; for (const [key, n] of months) if (!month || n > month.n) month = { key, n };
  return { day, month };
}
// Кандидаты в «самые длинные»: быстрый отбор по размеру файла (точные слова считаются позже, по прочитанному телу).
const longestCandidates = (posts, n = 24) => posts.slice().sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, n);

// Сводка: активные дни, среднее за активный день, диапазон дат, «заметок в неделю».
function overall(posts, byDay) {
  if (!posts.length) return { total: 0, activeDays: 0, perActiveDay: 0, perWeek: 0, first: null, last: null, spanDays: 0 };
  let first = Infinity, last = -Infinity;
  for (const p of posts) { if (p.ts < first) first = p.ts; if (p.ts > last) last = p.ts; }
  const spanDays = Math.max(1, Math.round((startOfDay(last) - startOfDay(first)) / DAY) + 1);
  return { total: posts.length, activeDays: byDay.size, perActiveDay: Math.round((posts.length / byDay.size) * 10) / 10, perWeek: Math.round((posts.length / (spanDays / 7)) * 10) / 10, first, last, spanDays };
}
// Период: all | year (с 1 января) | 12m (последние 365 дней)
function inPeriod(posts, period, now) {
  if (period === "year") { const s = new Date(new Date(now).getFullYear(), 0, 1).getTime(); return posts.filter((p) => p.ts >= s); }
  if (period === "12m") return posts.filter((p) => p.ts >= now - 365 * DAY);
  return posts;
}
module.exports = { byHour, byWeekday, byYear, peak, streakRecords, busiest, longestCandidates, overall, inPeriod };
