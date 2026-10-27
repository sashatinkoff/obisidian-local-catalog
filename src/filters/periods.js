// filters/periods.js — относительные периоды для фильтра.
const DAY = 86400000;
const PERIODS = [
  { id: "all", label: "Весь архив", days: null },
  { id: "7d", label: "За 7 дней", days: 7 },
  { id: "14d", label: "За 14 дней", days: 14 },
  { id: "30d", label: "За 30 дней", days: 30 },
  { id: "3m", label: "За 3 месяца", days: 90 },
  { id: "1y", label: "За год", days: 365 },
];
const byId = Object.fromEntries(PERIODS.map((p) => [p.id, p]));
const inPeriod = (ts, period, now) => { const p = byId[period]; return !p || !p.days || ts >= now - p.days * DAY; };
module.exports = { PERIODS, byId, inPeriod };
