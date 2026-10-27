// views/stats.js — «Статистика»: мини-статистика по автору — когда вы пишете (часы, дни недели, годы), рекорды серий, самые длинные записи.
const { h, clear } = require("lib/dom");
const { countByDay } = require("stats/activity");
const A = require("stats/author");
const { fmtNum, plural } = require("lib/ru");
const { fmtDateLong } = require("lib/date");
const segmented = require("ui/common/segmented");
const bars = require("ui/stats/bars");
const records = require("ui/stats/records");
const longest = require("ui/stats/longest");

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"], WEEKDAYS_FULL = ["понедельникам", "вторникам", "средам", "четвергам", "пятницам", "субботам", "воскресеньям"];
const PERIODS = [{ id: "all", label: "Всё время" }, { id: "year", label: "Этот год" }, { id: "12m", label: "12 месяцев" }];
const pad = (n) => String(n).padStart(2, "0");

module.exports = {
  id: "stats", title: "Статистика", icon: "trend",
  async render(ctx, el) {
    let period = (ctx.session.get() || {}).statsPeriod || "all", dispose = () => {};
    const host = h("div", { class: "sf-stats" });
    const lead = h("p", { class: "sf-stats__lead" }), per = h("div", { class: "sf-stats__period" });
    const head = h("div", { class: "sf-hero sf-hero--row" }, h("div", { class: "sf-hero" }, h("h1", null, "Статистика"), lead), per);
    el.append(head, host);

    function draw() {
      dispose(); clear(host);
      const now = Date.now(), raw = ctx.repo.collect(), all = raw.filter((p) => p.ts > 0), undated = raw.length - all.length, thisYear = new Date(now).getFullYear(), yearPosts = A.inPeriod(all, "year", now), posts = A.inPeriod(all, period, now), byDay = countByDay(posts);
      const sum = A.overall(posts, byDay), hours = A.byHour(posts), wd = A.byWeekday(posts), years = A.byYear(all), streaks = A.streakRecords(byDay, now), busy = A.busiest(byDay);
      lead.textContent = (sum.total ? `${fmtNum(sum.total)} ${plural(sum.total, ["заметка", "заметки", "заметок"])} за ${fmtNum(sum.activeDays)} ${plural(sum.activeDays, ["день", "дня", "дней"])} · с ${fmtDateLong(sum.first)}` : "Нет заметок за выбранный период") + (undated ? ` · без даты, не учтены: ${fmtNum(undated)}` : "");
      clear(per); per.append(segmented({ options: PERIODS, value: period, onChange: (id) => { period = id; ctx.session.patch({ statsPeriod: id }); draw(); } }));

      const tile = (value, label, tone) => h("div", { class: ["sf-statile", `is-${tone}`] }, h("strong", null, value), h("span", null, label));
      const hp = A.peak(hours.counts), wp = A.peak(wd);
      const hourItems = hours.counts.map((v, i) => ({ label: pad(i), value: v, show: i % 3 === 0, title: `${pad(i)}:00–${pad(i)}:59 — ${v} ${plural(v, ["заметка", "заметки", "заметок"])}` }));
      const wdItems = wd.map((v, i) => ({ label: WEEKDAYS[i], value: v, title: `${WEEKDAYS[i]} — ${v} ${plural(v, ["заметка", "заметки", "заметок"])}` }));
      const yearItems = years.map((y) => ({ label: String(y.year), value: y.count, title: `${y.year} — ${y.count}` }));
      const block = (title, sub, ...c) => h("div", { class: "sf-card-block" }, h("div", { class: "sf-block__head" }, h("div", null, h("h3", { class: "sf-block__title" }, title), sub && h("p", { class: "sf-block__sub" }, sub))), ...c);

      const lg = longest(ctx, all, { now });
      dispose = () => lg.dispose();
      host.append(
        h("div", { class: "sf-statiles" },
          tile(fmtNum(all.length), "заметок за все годы", "primary"), tile(fmtNum(yearPosts.length), `заметок в ${thisYear} году`, "secondary"),
          tile(fmtNum(sum.activeDays), `активных дней · ${sum.total ? String(sum.perActiveDay).replace(".", ",") : "—"} в день`, "tertiary"), tile(sum.total ? String(sum.perWeek).replace(".", ",") : "—", "в неделю", "primary")),
        h("div", { class: "sf-statgrid" },
          block("Когда вы пишете", hours.timed ? `Часы суток · по ${fmtNum(hours.timed)} из ${fmtNum(hours.total)} записей, где указано время` + (hp >= 0 ? ` · пик в ${pad(hp)}:00` : "") : "В записях нет времени — часы недоступны (можно включить «Время из файла» в настройках)",
            hours.timed ? bars(hourItems, { peakIndex: hp, cls: "sf-bars--hours" }) : null),
          block("По дням недели", wp >= 0 ? `Чаще всего вы пишете по ${WEEKDAYS_FULL[wp]}` : "", bars(wdItems, { peakIndex: wp, height: 120 }))),
        records(ctx, { streaks, busy }),
        h("div", { class: "sf-statgrid" },
          lg.el,
          years.length > 1 ? block("По годам", "Сколько записей в каждом году (все годы)", bars(yearItems, { peakIndex: A.peak(years.map((y) => y.count)), height: 140, cls: "sf-bars--years" })) : block("Серии", "Статистика по годам появится, когда в архиве будет больше одного года")));
    }
    draw();
    return () => dispose();
  },
};
