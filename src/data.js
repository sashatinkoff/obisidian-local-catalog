// src/data.js — выборка заметок о книгах из хранилища Obsidian (metadataCache) и приведение к единому виду.
// Dataview не нужен: свойства читаются из frontmatter, теги — из кэша метаданных.

const { cfg, app, obsidian } = ctx;
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

// Оценка по шкале ratingMax -> число от 0 до 5 или null
function toScore5(raw) {
    const n = U.toNumber(U.toArray(raw)[0]);
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

// "[[Имя|псевдоним]]" / "Имя" -> цель ссылки ("Имя") или null
const linkTarget = (item) => {
    const s = String(item ?? "").trim().replace(/^!/, "").replace(/^["']|["']$/g, "");
    const m = s.match(/^\[\[([^\]]+)\]\]$/);
    return (m ? m[1] : s).split("|")[0].split("#")[0].trim() || null;
};

// Значение обложки -> текст ссылки: [[файл|300]], ![[файл]], ![](путь), «файл.jpg», URL
function coverTarget(value) {
    let s = String(value ?? "").trim().replace(/^["']|["']$/g, "");
    if (!s) return null;
    const md = s.match(/^!?\[[^\]]*\]\(([^)]+)\)$/); // ![alt](путь)
    if (md) s = md[1].trim().replace(/^<|>$/g, "");
    const wiki = s.match(/^!?\[\[([^\]]+)\]\]$/);
    if (wiki) s = wiki[1];
    s = s.split("|")[0].split("#")[0].trim();
    return s || null;
}

const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;
const nfc = (x) => String(x).normalize("NFC");

// Файлы хранилища по имени (без учёта регистра и формы Unicode: macOS хранит имена в NFD) —
// запасной путь, когда ссылка не разрешилась обычным способом
let filesByName = null;
const findByName = (name) => {
    if (!filesByName) {
        filesByName = new Map();
        for (const f of app.vault.getFiles()) {
            const k = nfc(f.name).toLowerCase();
            if (!filesByName.has(k)) filesByName.set(k, f);
        }
    }
    return filesByName.get(nfc(String(name).split("/").pop()).toLowerCase());
};

// Файл по тексту ссылки: как есть, в разных формах Unicode, по полному пути, по имени
function findFile(text, sourcePath) {
    let decoded = text;
    try { decoded = decodeURIComponent(text); } catch (e) { /* не URL-кодирована */ }
    const variants = [text, decoded];
    [text, decoded].forEach((v) => variants.push(v.normalize("NFC"), v.normalize("NFD")));
    for (const v of new Set(variants)) {
        const file = app.metadataCache.getFirstLinkpathDest(v, sourcePath) || app.vault.getAbstractFileByPath(v);
        if (file && file.extension) return file;
    }
    return typeof app.vault.getFiles === "function" ? findByName(decoded) || null : null;
}

// Первая картинка, встроенная в текст заметки (![[файл.webp|457x724]])
function firstEmbeddedImage(cache, sourcePath) {
    for (const e of (cache && cache.embeds) || []) {
        const link = String((e && e.link) || "").split("#")[0].split("|")[0].trim();
        if (!link || !IMG_EXT.test(link)) continue;
        const file = app.metadataCache.getFirstLinkpathDest(link, sourcePath) || findFile(link, sourcePath);
        if (file) return file;
    }
    return null;
}

// Обложка -> { set: задано ли свойство, url: адрес картинки или null, raw: значение свойства }.
// Порядок: файл из свойства → первая картинка из текста заметки (если coverFromBody)
function resolveCover(fm, cache, sourcePath) {
    const raw = coverTarget(U.toArray(U.prop(fm, F.cover))[0]);
    try {
        if (raw && /^(https?:|data:)/i.test(raw)) return { set: true, url: raw, raw };
        let file = raw ? findFile(raw, sourcePath) : null;
        if (!file && cfg.coverFromBody) file = firstEmbeddedImage(cache, sourcePath);
        return { set: !!raw, url: file ? app.vault.getResourcePath(file) : null, raw };
    } catch (e) {
        return { set: !!raw, url: null, raw };
    }
}

// Ссылка на заметку из свойства -> путь к файлу или null
function linkTargetPath(item, sourcePath) {
    if (typeof item !== "string") return null;
    if (!/^\s*!?\[\[/.test(item)) return null;
    const target = linkTarget(item);
    if (!target) return null;
    const file = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
    return file ? file.path : null;
}

const firstText = (v) => {
    const s = U.toArray(v).map(U.itemToString)[0];
    return s ? String(s).trim() : "";
};

// Теги заметки: из frontmatter и из текста, вместе с «#»
function tagsOf(cache) {
    try {
        const list = obsidian.getAllTags(cache) || [];
        return Array.from(new Set(list));
    } catch (e) {
        return [];
    }
}

// Сколько заметок ссылается на каждую (для запасного счётчика заметок)
function inlinkCounts() {
    const counts = new Map();
    const links = app.metadataCache.resolvedLinks || {};
    for (const src of Object.keys(links)) {
        for (const dest of Object.keys(links[src])) counts.set(dest, (counts.get(dest) || 0) + 1);
    }
    return counts;
}

const sameFlag = (value, want) => {
    if (typeof want === "boolean") return value === want || String(value).toLowerCase() === String(want);
    return String(value) === String(want);
};

// Заметки из папки книг (с подпапками), для которых есть кэш метаданных
function bookFiles() {
    const folder = U.normFolder(cfg.folder);
    const prefix = folder ? folder + "/" : "";
    return app.vault.getMarkdownFiles().filter((f) => !prefix || f.path.startsWith(prefix));
}

// Загрузить книги и один раз привести к удобному для отрисовки виду
function loadBooks() {
    const inlinks = inlinkCounts();
    const books = [];
    filesByName = null;
    const coverStats = { set: 0, found: 0, missing: [] };

    for (const file of bookFiles()) {
        const cache = app.metadataCache.getFileCache(file);
        const fm = (cache && cache.frontmatter) || {};
        if (cfg.filterField && !sameFlag(U.prop(fm, cfg.filterField), cfg.filterValue)) continue;

        const title = String(U.toArray(U.prop(fm, F.title))[0] || file.basename);
        const authors = U.splitList(U.prop(fm, F.author));
        const genres = U.splitList(U.prop(fm, F.genre));
        const dateMs = U.toMillis(U.prop(fm, F.date));
        const score5 = toScore5(U.prop(fm, F.rating));
        const quote = firstText(U.prop(fm, F.quote));
        const timeRaw = U.toArray(U.prop(fm, F.time))[0];

        // свойство «Заметки»: ссылки на заметки и/или число
        let notesNum = null;
        const noteLinks = [];
        U.toArray(U.prop(fm, F.notes)).forEach((item) => {
            const path = linkTargetPath(item, file.path);
            if (path) noteLinks.push(path);
            else if (notesNum === null) notesNum = U.toNumber(item);
        });

        const cov = resolveCover(fm, cache, file.path);
        if (cov.set) {
            coverStats.set++;
            if (cov.url) coverStats.found++;
            else if (coverStats.missing.length < 5) coverStats.missing.push(`${file.basename}: ${cov.raw ?? "?"}`);
        }

        books.push({
            path: file.path,
            title,
            titleKey: title.toLowerCase(),
            authors,
            genres,
            genre: genres[0] || "",
            tags: tagsOf(cache),
            authorText: authors.join(", "),
            genresText: genres.join(", "),
            score5,
            scoreText: score5 === null ? "" : score5.toFixed(1),
            dateMs,
            dateText: U.formatDate(dateMs, cfg.dateFormat, cfg.dateLocale),
            cover: cov.url,
            quote,
            fileKey: file.basename.toLowerCase(),
            notesNum,                       // число из свойства (если задано)
            noteLinks,                      // пути заметок из свойства «Заметки»
            noteList: [],                   // все заметки книги (заполняет src/notes.js)
            inlinks: inlinks.get(file.path) || 0,
            notes: notesNum ?? 0,           // итоговое число заметок (уточняет src/notes.js)
            label: firstText(U.prop(fm, F.label)),
            time: typeof timeRaw === "number" ? `${timeRaw} ч` : firstText(timeRaw),
            pages: U.toNumber(U.toArray(U.prop(fm, F.pages))[0]),
            searchText: [title, authors.join(" "), genres.join(" "), quote].join(" ").toLowerCase(),
        });
    }
    if (coverStats.set > coverStats.found) {
        console.warn(`book-gallery: обложка не найдена у ${coverStats.set - coverStats.found} из ${coverStats.set} книг. Примеры:`, coverStats.missing);
    }
    books.coverStats = coverStats;
    return books;
}

// Отсортированные уникальные значения поля (авторы, жанры, теги) для фильтров
const uniqueValues = (books, key) =>
    Array.from(new Set(books.flatMap((b) => b[key]))).sort((a, b) => a.localeCompare(b, "ru"));

module.exports = { SORTS, EMPTY_COVER, starsHtml, loadBooks, uniqueValues, linkTarget };
