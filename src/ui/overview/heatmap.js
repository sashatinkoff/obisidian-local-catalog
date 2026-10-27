// ui/overview/heatmap.js — годовая карта активности: подписи месяцев и дней недели, легенда с диапазонами, сводка.
const { h } = require("lib/dom");
const { heatmap, levelRanges, summary } = require("stats/activity");
const { MONTHS_GEN, fmtDayMonth } = require("lib/date");
const { plural, fmtNum } = require("lib/ru");

const rangeLabel = ([from, to]) => (to === null ? `${from}+` : from === to ? `${from}` : `${from}–${to}`);

module.exports = function activityHeatmap(ctx, byDay, now) {
  // На телефоне — последние 26 недель (полгода): карта целиком помещается в ширину, без прокрутки. На десктопе — год.
  const mobile = !!(ctx.rootEl && ctx.rootEl.classList.contains("is-mobile"));
  const cols = heatmap(byDay, now, mobile ? 26 : 53), max = Math.max(0, ...byDay.values()), ranges = levelRanges(max), sum = summary(byDay);

  // Одна сетка: колонка подписей дней + по колонке на неделю; строка месяцев + 7 строк дней. Ячейки квадратные и тянутся по ширине.
  const grid = h("div", { class: "sf-heat", style: { "--cols": cols.length } });
  ["Пн", "Ср", "Пт"].forEach((d, i) => grid.append(h("span", { class: "sf-heat__daylabel", style: { gridRow: String(2 + i * 2), gridColumn: "1" } }, d)));
  let prev = -1;
  cols.forEach((col, i) => {
    const m = new Date(col[0].ts).getMonth();
    if (m !== prev && i < cols.length - 2) grid.append(h("span", { class: "sf-heat__month", style: { gridRow: "1", gridColumn: `${i + 2} / span 3` } }, MONTHS_GEN[m].slice(0, 3)));
    prev = m;
    col.forEach((c, d) => grid.append(h("span", { class: ["sf-heat__cell", `lv-${c.level}`, c.n > 0 && "is-click"], style: { gridRow: String(d + 2), gridColumn: String(i + 2) },
      title: c.level < 0 ? "" : `${c.key}: ${c.n} ${plural(c.n, ["заметка", "заметки", "заметок"])}`, onClick: c.n ? () => ctx.actions.jumpToDay(c.key) : null })));
  });

  const legend = h("div", { class: "sf-heat__legend" }, h("span", null, "Меньше"),
    ranges.map((r, i) => h("span", { class: `sf-heat__cell lv-${i}`, title: `${rangeLabel(r)} ${plural(r[1] === null ? 5 : r[1], ["заметка", "заметки", "заметок"])} в день` })),
    h("span", null, "Больше"));

  return h("div", { class: "sf-card-block sf-yearly__heat" },
    h("div", { class: "sf-block__head" },
      h("div", null, h("h3", { class: "sf-block__title" }, mobile ? "Активность за полгода" : "Активность за год"),
        h("p", { class: "sf-block__sub" }, "Каждый квадрат — один день, цвет — сколько заметок создано в этот день. Столбцы — недели (справа — текущая), строки — дни недели. Нажмите на цветной квадрат, чтобы открыть заметки этого дня.")),
      h("div", { class: "sf-block__stat" }, h("strong", null, fmtNum(sum.total)), ` ${plural(sum.total, ["заметка", "заметки", "заметок"])} · ${fmtNum(sum.activeDays)} ${plural(sum.activeDays, ["активный день", "активных дня", "активных дней"])}`,
        sum.best && h("span", null, `Рекорд: ${fmtDayMonth(new Date(sum.best.key + "T00:00:00").getTime())} — ${sum.best.n}`))),
    h("div", { class: "sf-heat__wrap" }, grid), legend);
};
