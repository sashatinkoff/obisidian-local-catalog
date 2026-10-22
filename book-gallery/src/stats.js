// lib/stats.js — статистика последнего месяца и «инсайт месяца» (цитата). Без DOM.

const { plural } = ctx.lib.utils;

const MONTH_NAMES = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

const sameMonth = (ms, y, m) => {
    const d = new Date(ms);
    return d.getFullYear() === y && d.getMonth() === m;
};

// Возвращает null, если ни у одной книги нет даты
function compute(books) {
    const dated = books.filter((b) => b.dateMs);
    if (!dated.length) return null;

    const latest = new Date(Math.max(...dated.map((b) => b.dateMs)));
    const y = latest.getFullYear();
    const m = latest.getMonth();
    const prev = new Date(y, m - 1, 1);

    const cur = dated.filter((b) => sameMonth(b.dateMs, y, m));
    const prevCount = dated.filter((b) => sameMonth(b.dateMs, prev.getFullYear(), prev.getMonth())).length;

    // рекорд года: в этом месяце прочитано больше, чем в любом другом месяце того же года
    const perMonth = Array(12).fill(0);
    dated.filter((b) => new Date(b.dateMs).getFullYear() === y).forEach((b) => perMonth[new Date(b.dateMs).getMonth()]++);
    const bestOther = Math.max(0, ...perMonth.filter((_, i) => i !== m));
    const isRecord = cur.length > bestOther && bestOther > 0;

    // нарастающий итог по дням месяца (для мини-графика)
    const lastDay = latest.getDate();
    const perDay = Array(lastDay).fill(0);
    cur.forEach((b) => perDay[new Date(b.dateMs).getDate() - 1]++);
    let acc = 0;
    const series = perDay.map((n) => (acc += n));

    const now = new Date();
    const inCurrentMonth = now.getFullYear() === y && now.getMonth() === m;
    const daysElapsed = inCurrentMonth ? now.getDate() : new Date(y, m + 1, 0).getDate();
    const pages = cur.reduce((s, b) => s + (b.pages || 0), 0);

    return {
        monthLabel: `${MONTH_NAMES[m]} ${y}`,
        count: cur.length,
        unit: plural(cur.length, ["книга", "книги", "книг"]),
        record: isRecord ? { diff: cur.length - bestOther } : null,
        pace: prevCount > 0 ? { pct: Math.round(((cur.length - prevCount) / prevCount) * 100), vs: MONTH_NAMES[prev.getMonth()] } : null,
        pages: pages || null,
        pagesPerDay: pages ? Math.round(pages / Math.max(1, daysElapsed)) : null,
        activeDays: new Set(cur.map((b) => new Date(b.dateMs).getDate())).size,
        series,
        month: cur,
    };
}

// Годы, в которые есть прочитанные книги (по убыванию)
const years = (books) =>
    [...new Set(books.filter((b) => b.dateMs).map((b) => new Date(b.dateMs).getFullYear()))].sort((a, b) => b - a);

// «Пульс» года: книги, страницы и средняя оценка по месяцам
function pulse(books, year) {
    const months = Array.from({ length: 12 }, (_, m) => ({ m, count: 0, pages: 0, scoreSum: 0, scored: 0 }));
    books
        .filter((b) => b.dateMs && new Date(b.dateMs).getFullYear() === year)
        .forEach((b) => {
            const mm = months[new Date(b.dateMs).getMonth()];
            mm.count++;
            mm.pages += b.pages || 0;
            if (b.score5 !== null) {
                mm.scoreSum += b.score5;
                mm.scored++;
            }
        });
    const total = months.reduce((s, x) => s + x.count, 0);
    const scored = months.reduce((s, x) => s + x.scored, 0);
    const max = Math.max(0, ...months.map((x) => x.count));
    return {
        year,
        months,
        total,
        max,
        pages: months.reduce((s, x) => s + x.pages, 0) || null,
        avg: scored ? months.reduce((s, x) => s + x.scoreSum, 0) / scored : null,
        bestMonth: max ? months.find((x) => x.count === max).m : null,
        years: years(books),
    };
}

// Книга для «инсайта месяца»: лучшая по оценке книга месяца, у которой есть заметки или цитата;
// если таких нет — лучшая среди всех. Сам текст выбирает случайно lib/notes.js
function insight(books, stats) {
    const pick = (list) =>
        list
            .filter((b) => b.quote || b.noteList.length)
            .sort((a, b) => (b.score5 ?? -1) - (a.score5 ?? -1) || b.dateMs - a.dateMs)[0];
    const book = (stats && pick(stats.month)) || pick(books);
    return book ? { book } : null;
}

module.exports = { compute, insight, pulse, years };
