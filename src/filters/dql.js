// filters/dql.js — компиляция состояния фильтра в Dataview DQL (TABLE).
const { dqlEscape } = require("lib/text");
const { byId: periods } = require("filters/periods");
const { merge } = require("filters/state");
const { toMs, DAY } = require("lib/date");

const EXT = { photo: "png|jpe?g|gif|webp|svg|avif", video: "mp4|mov|mkv|webm|m4v", audio: "mp3|wav|m4a|ogg|flac|aac", media: "png|jpe?g|gif|webp|svg|avif|mp4|mov|mkv|webm|m4v|mp3|wav|m4a|ogg|flac|aac" };
const outlinkMedia = (ext) => `length(filter(file.outlinks, (l) => regexmatch("(?i).*\\\\.(${ext})$", string(l.path)))) > 0`;
const tag = (t) => `contains(file.tags, "#${dqlEscape(t)}")`;

function compile(filter, opts = {}) {
  const f = merge(filter), cfg = opts.config || {}, notes = [];
  const dateExpr = (cfg.dql && cfg.dql.dateExpr) || "file.cday";
  const folders = f.sources.length
    ? (cfg.sources || []).filter((s) => f.sources.includes(s.id)).map((s) => s.folder)
    : (cfg.sources || []).filter((s) => s.enabled !== false && s.folder).map((s) => s.folder);
  const where = [];

  if (f.any.length) where.push("(" + f.any.map(tag).join(" OR ") + ")");
  for (const t of f.all) where.push(tag(t));
  for (const t of f.not) where.push("!" + tag(t));
  for (const a of f.attrs) {
    if (EXT[a]) where.push("(" + outlinkMedia(EXT[a]) + ")");
    else if (a === "task") where.push("length(file.tasks) > 0");
    else { where.push(`contains(file.tags, "#${a === "quote" ? "цитата" : a}")`); notes.push(`Атрибут «${a}» в DQL приблизительный (по тегу): точное определение делает движок ленты.`); }
  }
  if (f.types.length) notes.push("Типы карточек определяются движком ленты и в DQL не выражаются.");
  const p = periods[f.period];
  if (p && p.days) where.push(`${dateExpr} >= date(today) - dur(${p.days} days)`);
  const nextDay = (s) => { const d = new Date(toMs(s) + DAY); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  if (f.dateFrom && toMs(f.dateFrom) != null) where.push(`${dateExpr} >= date("${f.dateFrom}")`);
  if (f.dateTo && toMs(f.dateTo) != null) where.push(`${dateExpr} < date("${nextDay(f.dateTo)}")`);
  if (f.day) where.push(`${dateExpr} = date("${f.day}")`);
  if (f.minBacklinks > 0) where.push(`length(file.inlinks) >= ${f.minBacklinks}`);
  if (f.text.trim()) where.push(`contains(lower(file.name), "${dqlEscape(f.text.trim().toLowerCase())}")`);
  if (opts.quick === "today") where.push(`dateformat(${dateExpr}, "MM-dd") = dateformat(date(today), "MM-dd")`);
  if (opts.quick === "favorites") where.push(`${cfg.favoriteField || "favorite"} = true`);
  if (opts.quick === "random") notes.push("«Рандомные» — перемешивание выполняет движок ленты (DQL не умеет random).");

  const sort = { "date-desc": `${dateExpr} DESC`, "date-asc": `${dateExpr} ASC`, "mtime-desc": "file.mtime DESC", "backlinks-desc": "length(file.inlinks) DESC", "length-desc": "file.size DESC", "alpha-asc": "file.name ASC" }[f.sort] || `${dateExpr} DESC`;
  const lines = [`TABLE WITHOUT ID file.link AS "Заметка", ${dateExpr} AS "Дата", length(file.inlinks) AS "Связи"`];
  if (folders.length) lines.push("FROM " + folders.map((x) => `"${dqlEscape(x)}"`).join(" OR "));
  if (where.length) lines.push("WHERE " + where.join("\n  AND "));
  lines.push("SORT " + sort);
  return { query: lines.join("\n"), notes };
}
module.exports = { compile };
