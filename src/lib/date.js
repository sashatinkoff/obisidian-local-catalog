// lib/date.js — разбор и форматирование дат (всё в локальном времени).
const DAY = 86400000;
const MONTHS_GEN = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const MONTHS_NOM = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const RU_MONTH = { янв: 0, фев: 1, мар: 2, апр: 3, мая: 4, май: 4, июн: 5, июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11 };
const pad = (n) => String(n).padStart(2, "0");

function toMs(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (v instanceof Date) return isNaN(v) ? null : v.getTime();
  if (typeof v.toMillis === "function") return v.toMillis(); // luxon DateTime (Dataview)
  if (typeof v === "object" && v.path) return fromFilename(v.path); // [[2024-10-01]] — дата из имени заметки
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
  // «1 октября 2024, 16:12» · «1 окт 2024 г. в 16:12» · «1 октября 2024»
  m = s.toLowerCase().match(/^(\d{1,2})\s+([а-яё]+)\.?\s+(\d{4})(?:\s*г\.?)?(?:[,\sв]+(\d{1,2}):(\d{2}))?/);
  if (m && RU_MONTH[m[2].slice(0, 3)] !== undefined) return new Date(+m[3], RU_MONTH[m[2].slice(0, 3)], +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
  const t = Date.parse(s);
  return isNaN(t) ? null : t;
}

function hasTime(v, ms) {
  if (v == null) return false;
  if (typeof v === "string") return /\d{1,2}:\d{2}/.test(v);
  if (typeof v.hour === "number") return v.hour !== 0 || v.minute !== 0;
  if (ms != null) { const d = new Date(ms); return d.getHours() !== 0 || d.getMinutes() !== 0; }
  return false;
}

function fromFilename(name) {
  const m = String(name || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null;
}

const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthKey = (ms) => dayKey(ms).slice(0, 7);
const fmtDate = (ms) => dayKey(ms);
const fmtTime = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// «1 октября 2024» и «1 октября 2024, 16:12» — как в самих заметках
const fmtDateLong = (ms) => { const d = new Date(ms); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDateTime = (ms, withTime) => (withTime ? `${fmtDateLong(ms)}, ${fmtTime(ms)}` : fmtDateLong(ms));
const fmtDayMonth = (ms) => { const d = new Date(ms); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };
const sameMonthDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };

function relativeLabel(ms, now = Date.now(), withTime = true) {
  const diff = Math.round((startOfDay(now) - startOfDay(ms)) / DAY);
  const t = withTime ? `, ${fmtTime(ms)}` : "";
  if (diff === 0) return "Сегодня" + t;
  if (diff === 1) return "Вчера" + t;
  const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
  return sameYear ? fmtDayMonth(ms) + t : `${fmtDayMonth(ms)} ${new Date(ms).getFullYear()}`;
}

module.exports = { DAY, MONTHS_GEN, MONTHS_NOM, toMs, hasTime, fromFilename, startOfDay, dayKey, monthKey, fmtDate, fmtDateLong, fmtTime, fmtDateTime, fmtDayMonth, sameMonthDay, relativeLabel };
