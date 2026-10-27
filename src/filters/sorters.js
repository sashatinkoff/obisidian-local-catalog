// filters/sorters.js — варианты сортировки ленты.
const SORTS = [
  { id: "date-desc", label: "Сначала новые", cmp: (a, b) => b.ts - a.ts },
  { id: "date-asc", label: "Сначала старые", cmp: (a, b) => a.ts - b.ts },
  { id: "mtime-desc", label: "Дата изменения", cmp: (a, b) => b.mtime - a.mtime },
  { id: "backlinks-desc", label: "Плотность связей", cmp: (a, b) => b.backlinks - a.backlinks || b.ts - a.ts },
  { id: "length-desc", label: "Длина текста", cmp: (a, b) => b.size - a.size },
  { id: "alpha-asc", label: "Алфавит", cmp: (a, b) => a.title.localeCompare(b.title, "ru") },
];
const get = (id) => (SORTS.find((s) => s.id === id) || SORTS[0]).cmp;
module.exports = { SORTS, get };
