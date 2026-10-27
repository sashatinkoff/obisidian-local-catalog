// lib/new-note-path.js — путь новой заметки по настройке (чистая функция).
// Язык названий месяцев в путях — newNote.folderLang (по умолчанию en: 2026-10-October), в дате заметки — newNote.dateLang (по умолчанию ru).
// Токены (регистр важен): YYYY — год, MM — месяц числом, MMMM — месяц словом (Октябрь; после «D »/«DD » — «октября»), DD — день с нулём, D — день без нуля, hh — часы, mm — минуты.
// %%FOLDER_NAME в правиле заменяется на папку из настроек.
const { MONTHS_NOM, MONTHS_GEN } = require("lib/date");
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n) => String(n).padStart(2, "0");

// Месяц словом (токен MMMM) зависит от языка lang: "en" — October; "ru" — Октябрь, а после «D »/«DD » — родительный («16 октября»).
function fmtTokens(pattern, d, lang = "ru") {
  return String(pattern).replace(/(DD? )?(MMMM)|YYYY|MM|DD|D|hh|mm/g, (t, dayBefore, mmmm) => {
    if (mmmm) {
      const day = dayBefore ? dayBefore.replace(/^DD?/, (x) => (x === "DD" ? pad(d.getDate()) : String(d.getDate()))) : "";
      const names = lang === "en" ? MONTHS_EN : dayBefore ? MONTHS_GEN : MONTHS_NOM;
      return day + names[d.getMonth()];
    }
    return ({ YYYY: String(d.getFullYear()), MM: pad(d.getMonth() + 1), DD: pad(d.getDate()), D: String(d.getDate()), hh: pad(d.getHours()), mm: pad(d.getMinutes()) })[t];
  });
}
const DEFAULT_DATE_RULE = "D MMMM YYYY, hh:mm";
const clean = (p) => String(p).split("/").map((s) => s.trim().replace(/[\\:*?"<>|#^\[\]]/g, "-")).filter(Boolean).join("/");

// → путь без расширения, например "notes/2026/2026-10-Октябрь/2026-10-22-00-31"
function newNotePath(cfg, date = new Date()) {
  const n = cfg || {}, folder = String(n.folder || "").replace(/^\/+|\/+$/g, "");
  const file = n.fileName || "YYYY-MM-DD-hh-mm";
  let raw;
  if (n.mode === "rule") raw = fmtTokens(String(n.rule || file).replace(/%%FOLDER_NAME/g, folder), date, n.folderLang || "en");
  else if (n.mode === "root" || !folder) raw = fmtTokens(file, date, n.folderLang || "en");
  else raw = folder + "/" + fmtTokens(file, date, n.folderLang || "en");
  return clean(raw);
}
module.exports = { newNotePath, fmtTokens, DEFAULT_DATE_RULE };
