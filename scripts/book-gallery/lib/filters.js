// lib/filters.js — состояние фильтров и отбор книг. Без DOM.

const { cfg } = ctx;
const { SORTS } = ctx.lib.data;

// Фильтр по оценке (по 5-балльной шкале): id -> условие
const SCORE_FILTERS = {
    all: () => true,
    "5": (b) => b.score5 !== null && b.score5 >= 4.95,
    "4": (b) => b.score5 !== null && b.score5 >= 4,
    "3": (b) => b.score5 !== null && b.score5 >= 3,
    low: (b) => b.score5 !== null && b.score5 < 3,
};

const createState = () => ({
    search: "",
    author: "all",
    genre: "all",
    tags: new Set(),
    tagQuery: "",   // строка поиска среди чипов тегов, на книги не влияет
    score: "all",
    sort: SORTS[cfg.defaultSort] ? cfg.defaultSort : "date_desc",
});

function matches(b, st, q) {
    if (q && !b.searchText.includes(q)) return false;
    if (st.author !== "all" && !b.authors.includes(st.author)) return false;
    if (st.genre !== "all" && !b.genres.includes(st.genre)) return false;
    if (!SCORE_FILTERS[st.score](b)) return false;
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
    (st.search.trim() ? 1 : 0) + (st.author !== "all" ? 1 : 0) + (st.genre !== "all" ? 1 : 0) + st.tags.size + (st.score !== "all" ? 1 : 0);

function reset(st) {
    Object.assign(st, createState(), { sort: st.sort });
}

return { createState, apply, scoreCounts, activeCount, reset };
