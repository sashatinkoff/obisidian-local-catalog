// lib/filters.js — состояние фильтров и отбор книг. Без DOM.

const { cfg } = ctx;
const { SORTS } = ctx.lib.data;

// Фильтр по оценке (по 5-балльной шкале) — строгий: «3» это только 3.0 и 3.5, а не «3 и выше».
// При шкале 10 баллов: 5 = 10; 4 = 8–9; 3 = 6–7; 2 = 4–5; «меньше 2» = 0–3.
const starsOf = (b) => (b.score5 === null ? null : Math.min(5, Math.floor(b.score5 + 1e-9)));
const SCORE_FILTERS = {
    all: () => true,
    "5": (b) => starsOf(b) === 5,
    "4": (b) => starsOf(b) === 4,
    "3": (b) => starsOf(b) === 3,
    "2": (b) => starsOf(b) === 2,
    low: (b) => b.score5 !== null && b.score5 < 2,
};

// Ключ месяца для фильтра: "2026-09"
const monthKey = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const createState = () => ({
    search: "",
    author: "all",
    genre: "all",
    tags: new Set(),
    tagQuery: "",   // строка поиска среди чипов тегов, на книги не влияет
    score: "all",
    month: null,    // "2026-09" — книги, прочитанные в этом месяце (клик по столбцу «Пульса»)
    sort: SORTS[cfg.defaultSort] ? cfg.defaultSort : "date_desc",
});

function matches(b, st, q) {
    if (q && !b.searchText.includes(q)) return false;
    if (st.author !== "all" && !b.authors.includes(st.author)) return false;
    if (st.genre !== "all" && !b.genres.includes(st.genre)) return false;
    if (!SCORE_FILTERS[st.score](b)) return false;
    if (st.month && (!b.dateMs || monthKey(b.dateMs) !== st.month)) return false;
    if (st.tags.size) {
        const picked = [...st.tags];
        const ok = cfg.tagMode === "all" ? picked.every((t) => b.tags.includes(t)) : picked.some((t) => b.tags.includes(t));
        if (!ok) return false;
    }
    return true;
}

function apply(books, st) {
    const q = st.search.trim().toLowerCase();
    return books.filter((b) => matches(b, st, q)).sort(SORTS[st.sort].fn);
}

// Сколько всего книг подходит под каждый вариант фильтра по оценке
const scoreCounts = (books) =>
    Object.fromEntries(Object.entries(SCORE_FILTERS).map(([id, fn]) => [id, books.filter(fn).length]));

// Число включённых фильтров (для бейджа «N активных»)
const activeCount = (st) =>
    (st.search.trim() ? 1 : 0) + (st.author !== "all" ? 1 : 0) + (st.genre !== "all" ? 1 : 0) + st.tags.size + (st.score !== "all" ? 1 : 0) + (st.month ? 1 : 0);

function reset(st) {
    Object.assign(st, createState(), { sort: st.sort });
}

module.exports = { createState, apply, scoreCounts, activeCount, reset, monthKey };
