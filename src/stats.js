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

// План на год для выбранного года: свой (yearGoals) или общий (yearGoal)
function goalFor(year, cfg) {
    const own = cfg.yearGoals && Number(cfg.yearGoals[year]);
    return own > 0 ? own : Number(cfg.yearGoal) > 0 ? Number(cfg.yearGoal) : 0;
}

const topOf = (books, pick) => {
    const counts = new Map();
    books.forEach((b) => pick(b).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1)));
    const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"));
    return sorted.length ? { name: sorted[0][0], count: sorted[0][1] } : null;
};

// Показатели прогресса за год: план, темп, прогноз, серия месяцев, страницы, оценки, любимые жанр и автор
function progress(books, year, opts) {
    const o = opts || {};
    const now = o.now || new Date();
    const goal = o.goal > 0 ? o.goal : 0;
    const goalPages = o.goalPages > 0 ? o.goalPages : 0;
    const inYear = books.filter((b) => b.dateMs && new Date(b.dateMs).getFullYear() === year);
    const count = inYear.length;
    const pages = inYear.reduce((s, b) => s + (b.pages || 0), 0);

    // какая часть года прошла: 0 — год впереди, 1 — завершён
    const start = new Date(year, 0, 1).getTime();
    const end = new Date(year + 1, 0, 1).getTime();
    const cy = now.getFullYear();
    const frac = year < cy ? 1 : year > cy ? 0 : Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
    const finished = frac >= 1;

    // серия месяцев с прочитанными книгами
    const read = Array(12).fill(false);
    inYear.forEach((b) => (read[new Date(b.dateMs).getMonth()] = true));
    let longest = 0, run = 0;
    read.forEach((v) => {
        run = v ? run + 1 : 0;
        longest = Math.max(longest, run);
    });
    let current = null;
    if (year === cy) {
        let m = now.getMonth();
        if (!read[m]) m--; // текущий месяц ещё без книг — серия считается с прошлого
        current = 0;
        while (m >= 0 && read[m]) {
            current++;
            m--;
        }
    }

    // план
    const plan = goal
        ? (() => {
              const expected = goal * frac;
              const ahead = count - expected;
              const monthsLeft = 12 * (1 - frac);
              const remaining = Math.max(0, goal - count);
              return {
                  goal,
                  pct: Math.min(100, Math.round((count / goal) * 100)),
                  remaining,
                  done: count >= goal,
                  // «по графику» — в пределах полкниги от равномерного темпа
                  status: finished ? (count >= goal ? "done" : "missed") : ahead >= 0.5 ? "ahead" : ahead <= -0.5 ? "behind" : "onTrack",
                  diff: Math.round(Math.abs(ahead)),
                  need: !finished && remaining > 0 && monthsLeft > 0.05 ? remaining / monthsLeft : null,
              };
          })()
        : null;

    const perMonth = frac > 0.02 ? count / Math.max(frac * 12, 0.5) : null;
    const forecast = frac > 0.02 && frac < 1 ? Math.round(count / frac) : null;

    // страницы
    const pagesPlan = goalPages
        ? { goal: goalPages, pct: Math.min(100, Math.round((pages / goalPages) * 100)), perDay: null }
        : null;
    const daysElapsed = Math.max(1, Math.round(frac * (end - start) / 86400000));

    // оценки по целым звёздам (как в фильтре)
    const dist = { "5": 0, "4": 0, "3": 0, "2": 0, low: 0 };
    let scored = 0, sum = 0;
    inYear.forEach((b) => {
        if (b.score5 === null) return;
        scored++;
        sum += b.score5;
        const stars = Math.min(5, Math.floor(b.score5 + 1e-9));
        dist[stars >= 2 ? String(stars) : "low"]++;
    });

    return {
        year, count, finished, frac, plan, perMonth, forecast, read,
        streak: { current, longest },
        pages: pages || null,
        pagesPerDay: pages ? Math.round(pages / daysElapsed) : null,
        pagesPerBook: pages && inYear.filter((b) => b.pages).length ? Math.round(pages / inYear.filter((b) => b.pages).length) : null,
        pagesPlan,
        dist, scored, avg: scored ? sum / scored : null,
        topGenre: topOf(inYear, (b) => b.genres),
        topAuthor: topOf(inYear, (b) => b.authors),
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

module.exports = { compute, insight, pulse, years, progress, goalFor };
