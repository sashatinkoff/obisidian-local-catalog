// lib/data.js — выборка заметок из Dataview и приведение их к единому виду.

const { cfg, dv, app } = ctx;
const U = ctx.lib.utils;
const F = cfg.fields;

// Заглушка для списка, когда у книги нет обложки
const EMPTY_COVER =
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzJlMzQzOCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOGE5Mjk3IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiI+0J3QtdGCINC+0LHQu9C+0LbQutC4PC90ZXh0Pjwvc3ZnPg==";

const byScore = (a, b) => (a.score5 ?? -1) - (b.score5 ?? -1);

const SORTS = {
    date_desc: { label: "Сначала новые", fn: (a, b) => b.dateMs - a.dateMs },
    date_asc: { label: "Сначала старые", fn: (a, b) => a.dateMs - b.dateMs },
    rating_desc: { label: "Оценка: по убыванию", fn: (a, b) => byScore(b, a) || b.dateMs - a.dateMs },
    rating_asc: { label: "Оценка: по возрастанию", fn: (a, b) => byScore(a, b) || b.dateMs - a.dateMs },
    title_asc: { label: "Название (А-Я)", fn: (a, b) => a.titleKey.localeCompare(b.titleKey, "ru") },
    title_desc: { label: "Название (Я-А)", fn: (a, b) => b.titleKey.localeCompare(a.titleKey, "ru") },
};

const getTags = (p) => {
    const tags = p.file.etags?.length ? p.file.etags : p.file.tags || [];
    return Array.from(new Set(U.toArray(tags)));
};

const formatDate = (d) => {
    if (!d) return "";
    return d.toFormat ? d.toFormat(cfg.dateFormat) : String(d);
};

// Оценка по шкале ratingMax -> число от 0 до 5 или null
function toScore5(raw) {
    const n = U.toNumber(raw);
    if (n === null) return null;
    return (Math.max(0, Math.min(cfg.ratingMax, n)) / cfg.ratingMax) * 5;
}

// 4.5 -> пять звёзд (HTML) для режима «Список»
function starsHtml(score5) {
    if (score5 === null) return "—";
    const full = Math.floor(score5);
    const half = score5 % 1 >= 0.5 ? 1 : 0;
    const empty = Math.max(0, 5 - full - half);
    return (
        (full ? `<span class="star-full">${"★".repeat(full)}</span>` : "") +
        (half ? `<span class="star-half">★</span>` : "") +
        (empty ? `<span class="star-empty">${"★".repeat(empty)}</span>` : "")
    );
}

// Обложка -> url или null (если её нет)
function resolveCover(p) {
    try {
        let c = p[F.cover];
        if (!c) return null;
        c = U.toArray(c)[0];
        const raw = c.path
            ? c.path
            : String(c).replace(/^\[\[|\]\]$/g, "").replace(/^["']|["']$/g, "").split("|")[0];
        if (!raw) return null;
        if (/^(https?:|data:)/i.test(raw)) return raw;
        const file = app.metadataCache.getFirstLinkpathDest(raw, p.file.path);
        return file ? app.vault.getResourcePath(file) : null;
    } catch (e) {
        return null;
    }
}

// Ссылка на заметку ("[[имя]]" или объект Dataview) -> путь к файлу или null
function linkTargetPath(item, sourcePath) {
    if (item && item.path) return item.path;
    const m = typeof item === "string" ? item.match(/^\[\[([^\]|#]+)/) : null;
    if (!m) return null;
    const file = app.metadataCache.getFirstLinkpathDest(m[1].trim(), sourcePath);
    return file ? file.path : null;
}

const firstText = (v) => {
    const s = U.toArray(v).map(U.itemToString)[0];
    return s ? String(s).trim() : "";
};

// Загрузить книги и один раз привести к удобному для отрисовки виду
function loadBooks() {
    const folderQuery = `"${String(cfg.folder).replace(/"/g, '\\"')}"`;
    let pages = dv.pages(folderQuery);
    if (cfg.filterField) {
        pages = pages.where((p) => p[cfg.filterField] === cfg.filterValue);
    }

    return pages.array().map((p) => {
        const title = String(p[F.title] || p.file.name);
        const authors = U.splitList(p[F.author]);
        const genres = U.splitList(p[F.genre]);
        const date = p[F.date];
        const score5 = toScore5(p[F.rating]);
        const quote = firstText(p[F.quote]);
        const timeRaw = p[F.time];

        // свойство «Заметки»: ссылки на заметки и/или число
        let notesNum = null;
        const noteLinks = [];
        U.toArray(p[F.notes]).forEach((item) => {
            const path = typeof item === "number" ? null : linkTargetPath(item, p.file.path);
            if (path) noteLinks.push(path);
            else if (notesNum === null) notesNum = U.toNumber(item);
        });

        return {
            path: p.file.path,
            title,
            titleKey: title.toLowerCase(),
            authors,
            genres,
            genre: genres[0] || "",
            tags: getTags(p),
            authorText: authors.join(", "),
            genresText: genres.join(", "),
            score5,
            scoreText: score5 === null ? "" : score5.toFixed(1),
            dateMs: U.toMillis(date),
            dateText: formatDate(date),
            cover: resolveCover(p),
            quote,
            fileKey: p.file.name.toLowerCase(),
            notesNum,                       // число из свойства (если задано)
            noteLinks,                      // пути заметок из свойства «Заметки»
            noteList: [],                   // все заметки книги (заполняет lib/notes.js)
            inlinks: U.toArray(p.file.inlinks).length,
            notes: notesNum ?? 0,           // итоговое число заметок (уточняет lib/notes.js)
            label: firstText(p[F.label]),
            time: typeof timeRaw === "number" ? `${timeRaw} ч` : firstText(timeRaw),
            pages: U.toNumber(p[F.pages]),
            searchText: [title, authors.join(" "), genres.join(" "), quote].join(" ").toLowerCase(),
        };
    });
}

// Отсортированные уникальные значения поля (авторы, жанры, теги) для фильтров
const uniqueValues = (books, key) =>
    Array.from(new Set(books.flatMap((b) => b[key]))).sort((a, b) => a.localeCompare(b, "ru"));

return { SORTS, EMPTY_COVER, starsHtml, loadBooks, uniqueValues };
