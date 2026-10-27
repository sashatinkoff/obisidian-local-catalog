// plugin/block-params.js — разбор параметров code-блока ```journal-stream (строки «ключ: значение») в input для app/main.mount.
// Пример:
//   ```journal-stream
//   view: stream
//   tags: мысли, daily
//   period: 30d
//   nav: false
//   ```
const BOOL = new Set(["true", "yes", "да", "on"]), NOBOOL = new Set(["false", "no", "нет", "off"]);
const val = (v) => { const s = String(v).trim(), l = s.toLowerCase(); return BOOL.has(l) ? true : NOBOOL.has(l) ? false : s; };
const list = (v) => String(v).split(/[,;]+/).map((t) => t.trim().replace(/^#/, "")).filter(Boolean);

const FLAT = ["view", "layout", "theme", "id"];
const BOOLS = ["nav", "fullWidth", "openInNewTab", "popupView"];
const ALIASES = { tags: "any", любой: "any", теги: "any", alltags: "all", все: "all", exclude: "not", not: "not", исключить: "not", search: "text", text: "text", поиск: "text", period: "period", период: "period", sort: "sort", сортировка: "sort", from: "dateFrom", to: "dateTo", day: "day" };
const VIEW_ALIAS = { обзор: "overview", лента: "stream", бенто: "bento", подборки: "collections", статистика: "stats", конструктор: "studio" };

function parseBlock(source) {
  const input = {}, filter = {}, errors = [];
  for (const raw of String(source || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (!m) { errors.push(`Не понял строку: «${line}»`); continue; }
    const key = m[1].trim(), k = key.toLowerCase(), v = m[2].trim();
    if (FLAT.includes(key)) input[key] = key === "view" ? (VIEW_ALIAS[v.toLowerCase()] || v) : v;
    else if (BOOLS.includes(key)) input[key] = val(v) === true;
    else if (k === "viewmode") input.viewMode = v;
    else if (ALIASES[k] === "any" || ALIASES[k] === "all" || ALIASES[k] === "not") filter[ALIASES[k]] = list(v).map((t) => t.toLowerCase());
    else if (ALIASES[k]) filter[ALIASES[k]] = v;
    else errors.push(`Неизвестный параметр: «${key}»`);
  }
  if (Object.keys(filter).length) input.filter = filter;
  return { input, errors };
}
module.exports = { parseBlock };
