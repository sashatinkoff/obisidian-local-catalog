// lib/preset-sort.js — сортировка смарт-подборок (чистые функции).
const DAY = 86400000;

// def — направление по умолчанию: "desc" — «больше/новее сначала», "asc" — «А→Я».
const SORTS = [
  { id: "manual", label: "Мой порядок", def: "asc" },
  { id: "count", label: "По количеству заметок", def: "desc" },
  { id: "fresh", label: "По свежести (последняя заметка)", def: "desc" },
  { id: "active", label: "По активности за 30 дней", def: "desc" },
  { id: "created", label: "По дате создания подборки", def: "desc" },
  { id: "name", label: "По названию", def: "asc" },
];
const sortDef = (id) => SORTS.find((s) => s.id === id) || SORTS[0];

// Показатели подборки по списку её заметок.
function presetStats(list, now = Date.now()) {
  let latest = 0, recent = 0;
  for (const p of list) { if (p.ts > latest) latest = p.ts; if (p.ts >= now - 30 * DAY) recent++; }
  return { count: list.length, latest, recent };
}

// items: [{ preset, stats }] → новый массив. dir: "asc" | "desc" (для "manual" порядок исходный, "desc" — наоборот).
function sortPresets(items, sortId, dir) {
  const key = { count: (i) => i.stats.count, fresh: (i) => i.stats.latest, active: (i) => i.stats.recent, created: (i) => i.preset.createdAt || 0 }[sortId];
  const withIdx = items.map((it, idx) => ({ it, idx }));
  const mul = dir === "desc" ? -1 : 1;
  withIdx.sort((a, b) => {
    let c = 0;
    if (sortId === "name") c = String(a.it.preset.name).localeCompare(String(b.it.preset.name), "ru") * mul;
    else if (key) c = (key(a.it) - key(b.it)) * mul;
    else c = (a.idx - b.idx) * mul;
    return c || String(a.it.preset.name).localeCompare(String(b.it.preset.name), "ru") || a.idx - b.idx;
  });
  return withIdx.map((x) => x.it);
}
module.exports = { SORTS, sortDef, presetStats, sortPresets };
