// filters/state.js — модель состояния фильтра и неизменяемые операции над ним.
const MODES = ["any", "all", "not"];
const defaultFilter = () => ({ any: [], all: [], not: [], attrs: [], types: [], sources: [], period: "all", day: "", dateFrom: "", dateTo: "", minBacklinks: 0, text: "", sort: "date-desc" });
const normTag = (t) => String(t || "").trim().replace(/^#+/, "").toLowerCase();
const merge = (base, patch) => ({ ...defaultFilter(), ...(base || {}), ...(patch || {}) });
const isDefault = (f) => JSON.stringify(merge(f)) === JSON.stringify(defaultFilter());
const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// Тег живёт ровно в одном режиме: повторный клик по тому же режиму снимает его.
function toggleTag(filter, mode, tag) {
  const t = normTag(tag), had = filter[mode].includes(t), next = { ...filter };
  for (const m of MODES) next[m] = filter[m].filter((x) => x !== t);
  if (!had) next[mode] = [...next[mode], t];
  return next;
}
const removeTag = (filter, tag) => { const t = normTag(tag), n = { ...filter }; for (const m of MODES) n[m] = filter[m].filter((x) => x !== t); return n; };
const tagMode = (filter, tag) => MODES.find((m) => filter[m].includes(normTag(tag))) || null;

module.exports = { MODES, defaultFilter, normTag, merge, isDefault, toggleIn, toggleTag, removeTag, tagMode };
