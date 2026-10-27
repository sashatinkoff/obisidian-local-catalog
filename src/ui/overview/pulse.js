// ui/overview/pulse.js — «Пульс месяца» как в макете: 4 карточки (график, стрик, связи, медиа) + полоса трендовых тегов.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { MONTHS_GEN, startOfDay, dayKey, DAY } = require("lib/date");
const { monthStats } = require("stats/period");
const { streak } = require("stats/activity");
const { tagCounts } = require("stats/tags");
const { plural, fmtNum } = require("lib/ru");
const { sparkline } = require("ui/overview/charts");
const chip = require("ui/common/chip");

const head = (iconName, label, right) => h("div", { class: "sf-pcard__head" }, h("div", null, h("p", { class: "sf-pcard__label" }, label)), right);
const value = (v, unit, cls = "") => h("h3", { class: "sf-pcard__value" }, v, h("span", { class: ["sf-pcard__unit", cls] }, unit));

module.exports = function pulse(ctx, posts, byDay, now) {
  const d = new Date(now), ms = monthStats(posts, now), st = streak(byDay, now), mon = MONTHS_GEN[d.getMonth()];
  const short = (day) => `${day} ${mon.slice(0, 3)}`;

  // 1. Создано заметок + график накопления
  const trend = ms.deltaPct == null ? null : h("span", { class: ["sf-pcard__trend", ms.deltaPct < 0 && "is-down"] }, icon("trend", { size: 13 }), (ms.deltaPct > 0 ? "+" : "") + ms.deltaPct + "%");
  const c1 = h("div", { class: "sf-pcard sf-pcard--chart" },
    head("file", "Создано заметок", trend),
    value(fmtNum(ms.count), plural(ms.count, ["заметка", "заметки", "заметок"]), "is-tertiary"),
    h("div", { class: "sf-pcard__body" }, sparkline(ms.cumulative, { total: ms.daysInMonth }),
      h("div", { class: "sf-pcard__axis" }, h("span", null, short(1)), h("span", null, `накопительно · в прошлом месяце ${fmtNum(ms.prevCount)}`), h("span", null, short(ms.elapsed)))));

  // 2. Стрик + последние 7 дней кружками
  const days = Array.from({ length: 7 }, (_, i) => { const ts = startOfDay(now) - (6 - i) * DAY; return { n: byDay.get(dayKey(ts)) || 0, day: new Date(ts).getDate(), today: i === 6 }; });
  const c2 = h("div", { class: "sf-pcard" },
    head("flame", "Стрик регулярности", h("span", { class: "sf-pcard__badge" }, icon("flame", { size: 18 }))),
    value(st.current, plural(st.current, ["день подряд", "дня подряд", "дней подряд"]), "is-primary"),
    h("div", { class: "sf-pcard__body" },
      h("div", { class: "sf-streak" }, days.map((x) => h("span", { class: ["sf-streak__day", x.n > 0 && "is-on", x.today && "is-today"], title: `${x.day} ${mon}: ${x.n} ${plural(x.n, ["заметка", "заметки", "заметок"])}` }, x.day))),
      h("div", { class: "sf-pcard__axis" }, h("span", null, `Рекорд: ${st.best} ${plural(st.best, ["день", "дня", "дней"])}`), h("span", { class: "is-secondary" }, `${ms.consistencyPct}% консистентность`))));

  // 3. Связи + плотность графа
  const c3 = h("div", { class: "sf-pcard" },
    head("share", "Семантические связи", h("span", { class: "sf-pcard__badge is-plain" }, icon("share", { size: 18 }))),
    value(fmtNum(ms.links), plural(ms.links, ["связь", "связи", "связей"]), "is-tertiary"),
    h("div", { class: "sf-pcard__body" },
      h("div", { class: "sf-pcard__axis" }, h("span", null, "Плотность графа"), h("span", { class: "is-primary" }, `${ms.density} связей / заметка`)),
      h("div", { class: "sf-bar" }, h("div", { class: "sf-bar__fill", style: { width: Math.min(100, (ms.density / 6) * 100) + "%" } })),
      h("p", { class: "sf-pcard__note" }, `Изолированных заметок: ${ms.isolatedPct}%`)));

  // 4. Медиа: сегментная шкала фото / видео / аудио
  const m = ms.media, tot = Math.max(1, ms.mediaTotal);
  const seg = (cls, n, label) => h("div", { class: ["sf-seg", cls], style: { width: (n / tot) * 100 + "%" }, title: `${n} ${label}` });
  const leg = (cls, n, label) => h("span", { class: "sf-legend__item" }, h("span", { class: ["sf-legend__dot", cls] }), `${fmtNum(n)} ${label}`);
  const c4 = h("div", { class: "sf-pcard" },
    head("image", "Медиа за месяц", h("span", { class: "sf-pcard__badge is-plain" }, icon("image", { size: 18 }))),
    value(fmtNum(ms.mediaTotal), plural(ms.mediaTotal, ["файл", "файла", "файлов"]), ""),
    h("div", { class: "sf-pcard__body" },
      h("div", { class: "sf-segbar" }, ms.mediaTotal ? [seg("is-photo", m.photo, "фото"), seg("is-video", m.video, "видео"), seg("is-audio", m.audio, "аудио")] : h("div", { class: "sf-seg is-empty", style: { width: "100%" } })),
      h("div", { class: "sf-legend" }, leg("is-photo", m.photo, "фото"), leg("is-video", m.video, "видео"), leg("is-audio", m.audio, "аудио"))));

  // Трендовые теги месяца
  const tags = tagCounts(ms.posts, { limit: 10 });
  const strip = h("div", { class: "sf-tagstrip" },
    h("div", { class: "sf-tagstrip__label" }, icon("hash", { size: 16 }), `Трендовые теги ${mon}:`),
    h("div", { class: "sf-tagstrip__tags" }, tags.length ? tags.map((t) => chip({ text: "#" + t.tag, count: t.count, onClick: () => ctx.actions.jumpToTag(t.tag), title: "Открыть в ленте" })) : h("span", { class: "sf-muted" }, "В этом месяце заметок с тегами пока нет.")));

  return h("section", { class: "sf-section sf-pulse" },
    h("div", { class: "sf-section__row" },
      h("div", { class: "sf-section__lead" }, h("span", { class: "sf-section__dot is-secondary" }), h("h2", { class: "sf-section__title" }, `Пульс ${mon} ${d.getFullYear()}`), h("span", { class: "sf-pill" }, "Текущий срез")),
      h("span", { class: "sf-section__aside" }, icon("trend", { size: 15 }), `${ms.activeDays} из ${ms.elapsed} дней с заметками`)),
    h("div", { class: "sf-pulse__grid" }, c1, c2, c3, c4), strip);
};
