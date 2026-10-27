// ui/stats/records.js — карточки-рекорды: серия, текущая серия, плотный день/месяц, самая долгая пауза.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { plural, fmtNum } = require("lib/ru");
const { fmtDateLong, MONTHS_NOM } = require("lib/date");

const dateOf = (key) => fmtDateLong(new Date(key + "T00:00:00").getTime());
const range = (from, to) => (!from ? "" : from === to ? dateOf(from) : `${dateOf(from)} — ${dateOf(to)}`);
const days = (n) => `${fmtNum(n)} ${plural(n, ["день", "дня", "дней"])}`;
const monthLabel = (key) => `${MONTHS_NOM[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;

module.exports = function records(ctx, { streaks, busy }) {
  const card = (ic, tone, label, value, sub, onClick) => h(onClick ? "button" : "div", { type: onClick ? "button" : null, class: ["sf-rec", `is-${tone}`, onClick && "is-clickable"], onClick },
    h("span", { class: "sf-rec__icon" }, icon(ic, { size: 18 })),
    h("span", { class: "sf-rec__label" }, label), h("strong", { class: "sf-rec__value" }, value), h("span", { class: "sf-rec__sub" }, sub || "—"));
  const { best, current, gap } = streaks;
  return h("div", { class: "sf-recs" },
    card("flame", "primary", "Рекорд серии", best.len ? days(best.len) : "—", range(best.from, best.to), best.len ? () => ctx.actions.jumpToDay(best.from) : null),
    card("trend", "secondary", "Текущая серия", current.len ? days(current.len) : "нет", current.len ? `с ${dateOf(current.from)}` : "Запись сегодня или вчера начнёт новую"),
    card("bolt", "tertiary", "Самый плодотворный день", busy.day ? `${fmtNum(busy.day.n)} ${plural(busy.day.n, ["заметка", "заметки", "заметок"])}` : "—", busy.day ? dateOf(busy.day.key) : "", busy.day ? () => ctx.actions.jumpToDay(busy.day.key) : null),
    card("calendar", "primary", "Самый плодотворный месяц", busy.month ? `${fmtNum(busy.month.n)} ${plural(busy.month.n, ["заметка", "заметки", "заметок"])}` : "—", busy.month ? monthLabel(busy.month.key) : ""),
    card("clock", "secondary", "Самая долгая пауза", gap.days ? days(gap.days) : "нет", range(gap.from, gap.to)));
};
