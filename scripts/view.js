// ==========================================================
// book-gallery.js — галерея/таблица книг для Dataview (dv.view)
// Вызов из заметки:
//   await dv.view("scripts/book-gallery", { folder: "Прочитанные книги" })
// ==========================================================

// ---------- 1. НАСТРОЙКИ (всё можно переопределить через input) ----------
const defaults = {
    folder: "Прочитанные книги",      // папка с заметками о книгах (подпапки включены)
    filterField: "Прочитано",         // поле-флаг; null или "" — не фильтровать
    filterValue: true,                // нужное значение флага
    fields: {                         // имена свойств во frontmatter
        title: "Название",
        author: "Автор",
        genre: "Жанр",
        rating: "Оценка",
        date: "Дата прочтения",
        cover: "cover",
    },
    ratingMax: 10,                    // шкала оценки в заметках (в UI всегда 5 звёзд)
    dateFormat: "dd.MM.yyyy",
    openInNewTab: true,               // true — заметка открывается в новой вкладке, false — в текущей
    defaultView: "cards",             // "cards" | "table"
    defaultSort: "date_desc",         // date_desc | date_asc | title_asc | title_desc
    storageKey: "obsidian-book-gallery-view",
    cssPath: null,                    // путь к своему CSS-файлу в хранилище; null — встроенные стили
    searchDebounce: 150,              // мс
};

const user = input || {};
const cfg = Object.assign({}, defaults, user, {
    fields: Object.assign({}, defaults.fields, user.fields || {}),
});
const F = cfg.fields;

// ---------- СТИЛИ (встроены в скрипт, отдельный CSS-файл не нужен) ----------
const BOOK_CSS = `
/* Цвета в одном месте: меняйте здесь.
   Obsidian ставит на body класс theme-dark или theme-light,
   поэтому для каждой темы своя палитра. */
body.theme-dark {
    --bg-card: #22272a;
    --bg-input: #2e3438;
    --bg-hover: #3a4247;
    --bg-row-hover: #2a3034;
    --border: #333a3e;
    --border-input: #3e464b;
    --accent: #c9a971;
    --muted: #8a9297;
    --star-on: #c9a971;
    --star-off: #3e464b;
    --text-hover: #ffffff;
    --card-shadow: rgba(0, 0, 0, 0.3);
}

body.theme-light {
    --bg-card: #f6f3ec;
    --bg-input: #ebe7dc;
    --bg-hover: #ded9cb;
    --bg-row-hover: #efebe1;
    --border: #d9d4c7;
    --border-input: #cfc9ba;
    --accent: #8a6a2f;
    --muted: #6b7378;
    --star-on: #c9a24d;
    --star-off: #d5cfc0;
    --text-hover: #1f2326;
    --card-shadow: rgba(0, 0, 0, 0.12);
}

/* ---------- Панель управления ---------- */
.book-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 15px;
    background-color: var(--bg-card);
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--border);
}

.book-filters-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.book-search-input,
.book-select,
.book-view-btn {
    height: auto !important; /* отменяем жёсткую высоту Obsidian */
    padding: 14px 20px;
    border-radius: 8px;
    background-color: var(--bg-input);
    border: 1px solid var(--border-input);
    font-size: 1.1em;
    box-sizing: border-box;
}

.book-search-input {
    width: 100%;
    color: var(--accent);
    line-height: 1.5;
}

.book-select {
    flex: 1;
    min-width: 200px;
    color: var(--muted);
    line-height: 1.5;
    cursor: pointer;
}

.book-view-btn {
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
}

.book-view-btn:hover {
    background-color: var(--bg-hover);
    color: var(--text-hover);
}

.book-stats {
    color: var(--muted);
    font-size: 0.9em;
    margin-bottom: 16px;
    padding-left: 4px;
}

/* ---------- Карточки ---------- */
.book-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.book-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 12px 0 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 4px 10px var(--card-shadow);
    font-family: var(--font-interface);
    transition: transform 0.2s;
}

.book-card:hover {
    transform: translateY(-4px);
}

.book-cover-wrap {
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 12px;
    aspect-ratio: 2 / 3;
    cursor: pointer;
}

.book-cover {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.book-title {
    color: var(--accent);
    font-weight: 700;
    font-size: 1.1em;
    text-align: center;
    line-height: 1.3;
    margin-bottom: 6px;
}

.book-author {
    color: var(--muted);
    font-size: 0.9em;
    text-align: center;
    margin-bottom: 12px;
}

.book-rating {
    color: var(--accent);
    font-size: 1.2em;
    margin-bottom: 16px;
    letter-spacing: 2px;
}

.book-date {
    color: var(--muted);
    font-size: 0.8em;
    text-align: center;
    margin-bottom: 12px;
}

.book-open-btn {
    width: calc(100% + 24px);
    margin: auto -12px 0 -12px; /* прижимаем к низу карточки */
    background-color: var(--bg-input);
    color: var(--muted) !important;
    text-align: center;
    padding: 12px 0;
    text-decoration: none;
    font-weight: 600;
    border-radius: 0 0 12px 12px;
    transition: background 0.2s, color 0.2s;
    cursor: pointer;
}

.book-open-btn:hover {
    background-color: var(--bg-hover);
    color: var(--accent) !important;
    text-decoration: none;
}

/* ---------- Таблица ---------- */
.book-table-container {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: auto;
    box-sizing: border-box;
}

.book-table {
    width: 100% !important;
    min-width: 100% !important;
    table-layout: auto;
    border-collapse: collapse;
    margin-top: 10px;
    color: var(--muted);
    text-align: left;
    font-size: 0.95em;
    box-sizing: border-box;
}

.book-table th {
    padding: 14px 12px;
    color: var(--accent);
    font-weight: 600;
    white-space: nowrap;
}

.book-table td {
    padding: 12px;
    vertical-align: middle;
}

.book-table tr:hover {
    background-color: var(--bg-row-hover);
}

/* колонка «Обложка» — под миниатюру, «Название» — основное место */
.book-table th:nth-child(1),
.book-table td:nth-child(1) {
    width: 60px;
    text-align: center;
}

.book-table th:nth-child(2),
.book-table td:nth-child(2) {
    width: 35%;
}

.table-cover {
    width: 45px;
    height: 65px;
    object-fit: cover;
    border-radius: 4px;
    display: inline-block;
}

.book-table-tag {
    display: inline-block;
    padding: 2px 6px;
    margin: 2px;
    border-radius: 4px;
    background-color: var(--bg-input);
    color: var(--accent);
    font-size: 0.85em;
    border: 1px solid var(--border-input);
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.book-table-tag:hover {
    background-color: var(--bg-hover);
    border-color: var(--accent);
}

/* тег, по которому сейчас включён фильтр */
.book-table-tag.is-active {
    background-color: var(--accent);
    color: var(--bg-card);
    border-color: var(--accent);
}

/* ---------- Звёзды ---------- */
.star-full,
.star-half,
.star-empty {
    display: inline-block;
    line-height: 1;
}

.star-full {
    color: var(--star-on);
}

.star-empty {
    color: var(--star-off);
}

/* Половина звезды через градиент символа ★ */
.star-half {
    background: linear-gradient(90deg, var(--star-on) 50%, var(--star-off) 50%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    vertical-align: middle;
}
`;

const STYLE_ID = "book-gallery-styles";

async function injectStyles() {
    let css = BOOK_CSS;
    if (cfg.cssPath) {
        try {
            css = await app.vault.adapter.read(cfg.cssPath);
        } catch (e) {
            console.warn("book-gallery: не удалось прочитать cssPath, используются встроенные стили", e);
        }
    }
    let style = document.getElementById(STYLE_ID);
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }
    style.textContent = css; // перезаписываем, чтобы правки применялись при перерисовке
}

// ---------- 2. УТИЛИТЫ ----------
const EMPTY_COVER =
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzJlMzQzOCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOGE5Mjk3IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiI+0J3QtdGCINC+0LHQu9C+0LbQutC4PC90ZXh0Pjwvc3ZnPg==";

const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC_MAP[c]);

const el = (tag, className, props) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (props) Object.assign(node, props);
    return node;
};

// Dataview-массив / обычный массив / скаляр -> обычный массив
const toArray = (v) => {
    if (v === undefined || v === null || v === "") return [];
    if (Array.isArray(v)) return v;
    if (v.values && Array.isArray(v.values)) return v.values;
    return [v];
};

// Элемент списка -> строка (поддержка ссылок [[...]])
const itemToString = (item) => {
    if (item && item.path) {
        return item.display || item.path.split("/").pop().replace(/\.md$/, "");
    }
    return String(item);
};

// Список значений с разбором "a, b, c"
const splitList = (v) =>
    toArray(v)
        .flatMap((item) => itemToString(item).split(","))
        .map((s) => s.trim())
        .filter(Boolean);

const getTags = (p) => {
    const tags = p.file.etags?.length ? p.file.etags : p.file.tags || [];
    return Array.from(new Set(toArray(tags)));
};

const toMillis = (d) => {
    if (!d) return 0;
    if (d.toMillis) return d.toMillis();
    const t = Date.parse(d);
    return Number.isNaN(t) ? 0 : t;
};

const formatDate = (d) => {
    if (!d) return "";
    return d.toFormat ? d.toFormat(cfg.dateFormat) : String(d);
};

function formatRating(score) {
    if (score === undefined || score === null || score === "") return "—";
    const n = parseFloat(score);
    if (Number.isNaN(n)) return esc(score);

    const score5 = (Math.max(0, Math.min(cfg.ratingMax, n)) / cfg.ratingMax) * 5;
    const full = Math.floor(score5);
    const half = score5 % 1 >= 0.5 ? 1 : 0;
    const empty = Math.max(0, 5 - full - half);

    return (
        (full ? `<span class="star-full">${"★".repeat(full)}</span>` : "") +
        (half ? `<span class="star-half">★</span>` : "") +
        (empty ? `<span class="star-empty">${"★".repeat(empty)}</span>` : "")
    );
}

function resolveCover(p) {
    try {
        let c = p[F.cover];
        if (!c) return EMPTY_COVER;
        c = toArray(c)[0];
        const raw = c.path
            ? c.path
            : String(c).replace(/^\[\[|\]\]$/g, "").replace(/^["']|["']$/g, "").split("|")[0];
        if (/^https?:\/\//i.test(raw)) return raw;
        const file = app.metadataCache.getFirstLinkpathDest(raw, p.file.path);
        return file ? app.vault.getResourcePath(file) : EMPTY_COVER;
    } catch (e) {
        return EMPTY_COVER;
    }
}

// ---------- 3. ДАННЫЕ (нормализуем один раз) ----------
const folderQuery = `"${String(cfg.folder).replace(/"/g, '\\"')}"`;
let pages = dv.pages(folderQuery);
if (cfg.filterField) {
    pages = pages.where((p) => p[cfg.filterField] === cfg.filterValue);
}

const books = pages.array().map((p) => {
    const title = String(p[F.title] || p.file.name);
    const authors = splitList(p[F.author]);
    const genres = splitList(p[F.genre]);
    const tags = getTags(p);
    const date = p[F.date];
    return {
        path: p.file.path,
        title,
        titleKey: title.toLowerCase(),
        authors,
        genres,
        tags,
        authorText: authors.join(", "),
        genresText: genres.join(", "),
        ratingHtml: formatRating(p[F.rating]),
        dateMs: toMillis(date),
        dateText: formatDate(date),
        cover: resolveCover(p),
        searchText: (title + " " + authors.join(", ")).toLowerCase(),
    };
});

const unique = (key) =>
    Array.from(new Set(books.flatMap((b) => b[key]))).sort((a, b) => a.localeCompare(b, "ru"));

// ---------- 4. ИНТЕРФЕЙС ----------
await injectStyles();

const container = dv.container;
container.innerHTML = "";

let currentView =
    localStorage.getItem(cfg.storageKey) === "table" ||
    localStorage.getItem(cfg.storageKey) === "cards"
        ? localStorage.getItem(cfg.storageKey)
        : cfg.defaultView;

const controls = el("div", "book-controls");
const searchInput = el("input", "book-search-input", {
    type: "text",
    placeholder: "Поиск по названию или автору...",
});
const filtersRow = el("div", "book-filters-row");

const viewBtn = el("button", "book-view-btn");
const setViewLabel = () => {
    viewBtn.textContent = currentView === "cards" ? "Вид: Карточки" : "Вид: Таблица";
};

const authorSelect = el("select", "book-select");
const genreSelect = el("select", "book-select");
const tagSelect = el("select", "book-select");
const sortSelect = el("select", "book-select");

const fillSelect = (select, allLabel, values) => {
    select.innerHTML = "";
    select.appendChild(el("option", "", { value: "all", textContent: allLabel }));
    values.forEach((v) => select.appendChild(el("option", "", { value: v, textContent: v })));
};
fillSelect(authorSelect, "Все авторы", unique("authors"));
fillSelect(genreSelect, "Все жанры", unique("genres"));
fillSelect(tagSelect, "Все теги", unique("tags"));

const SORTS = {
    date_desc: { label: "Сначала новые (по дате)", fn: (a, b) => b.dateMs - a.dateMs },
    date_asc: { label: "Сначала старые (по дате)", fn: (a, b) => a.dateMs - b.dateMs },
    title_asc: { label: "Название (А-Я)", fn: (a, b) => a.titleKey.localeCompare(b.titleKey, "ru") },
    title_desc: { label: "Название (Я-А)", fn: (a, b) => b.titleKey.localeCompare(a.titleKey, "ru") },
};
Object.entries(SORTS).forEach(([value, s]) =>
    sortSelect.appendChild(el("option", "", { value, textContent: "Сортировка: " + s.label }))
);
sortSelect.value = SORTS[cfg.defaultSort] ? cfg.defaultSort : "date_desc";

[viewBtn, authorSelect, genreSelect, tagSelect, sortSelect].forEach((n) => filtersRow.appendChild(n));
controls.append(searchInput, filtersRow);

const statsDiv = el("div", "book-stats");
const gridDiv = el("div");
container.append(controls, statsDiv, gridDiv);

// ---------- 5. ОТРИСОВКА ----------
const cardsHtml = (list) =>
    list
        .map(
            (b) => `
<div class="book-card">
    <div class="book-cover-wrap" data-path="${esc(b.path)}"><img src="${esc(b.cover)}" class="book-cover" loading="lazy"></div>
    <div class="book-title">${esc(b.title)}</div>
    <div class="book-author">${esc(b.authorText || "Неизвестен")}</div>
    <div class="book-rating">${b.ratingHtml}</div>
    <div class="book-date">${esc(b.dateText)}</div>
    <a class="book-open-btn" data-path="${esc(b.path)}">Открыть</a>
</div>`
        )
        .join("");

const tableHtml = (list) => `
<table class="book-table">
    <thead><tr>
        <th>Обложка</th><th>Название</th><th>Автор</th><th>Жанр</th><th>Теги</th><th>Оценка</th><th>Дата</th>
    </tr></thead>
    <tbody>${list
        .map(
            (b) => `
    <tr>
        <td><img src="${esc(b.cover)}" class="table-cover" loading="lazy"></td>
        <td><a class="internal-link book-table-title" data-href="${esc(b.path)}" href="${esc(b.path)}">${esc(b.title)}</a></td>
        <td>${esc(b.authorText || "—")}</td>
        <td>${esc(b.genresText || "—")}</td>
        <td>${
            b.tags.length
                ? b.tags
                      .map(
                          (t) =>
                              `<span class="book-table-tag${t === tagSelect.value ? " is-active" : ""}" data-tag="${esc(t)}">${esc(t)}</span>`
                      )
                      .join(" ")
                : "—"
        }</td>
        <td style="white-space: nowrap;">${b.ratingHtml}</td>
        <td>${esc(b.dateText || "—")}</td>
    </tr>`
        )
        .join("")}</tbody>
</table>`;

function render() {
    const q = searchInput.value.trim().toLowerCase();
    const a = authorSelect.value;
    const g = genreSelect.value;
    const t = tagSelect.value;

    const list = books
        .filter(
            (b) =>
                (!q || b.searchText.includes(q)) &&
                (a === "all" || b.authors.includes(a)) &&
                (g === "all" || b.genres.includes(g)) &&
                (t === "all" || b.tags.includes(t))
        )
        .sort(SORTS[sortSelect.value].fn);

    statsDiv.textContent = `Найдено: ${list.length}`;
    gridDiv.className = currentView === "cards" ? "book-grid" : "book-table-container";
    gridDiv.innerHTML = currentView === "cards" ? cardsHtml(list) : tableHtml(list);
}

// ---------- 6. СОБЫТИЯ ----------
let timer;
searchInput.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(render, cfg.searchDebounce);
});
[authorSelect, genreSelect, tagSelect, sortSelect].forEach((s) => s.addEventListener("change", render));

viewBtn.addEventListener("click", () => {
    currentView = currentView === "cards" ? "table" : "cards";
    localStorage.setItem(cfg.storageKey, currentView);
    setViewLabel();
    render();
});

// Один обработчик на всю сетку (делегирование)
gridDiv.addEventListener("click", (e) => {
    // Клик по тегу в таблице: включить фильтр (повторный клик — снять)
    const tagEl = e.target.closest("[data-tag]");
    if (tagEl) {
        const tag = tagEl.dataset.tag;
        tagSelect.value = tagSelect.value === tag ? "all" : tag;
        render();
        return;
    }

    // Обложка / кнопка «Открыть» (data-path) и название в таблице (data-href).
    // Превью при наведении от этого не страдает: оно работает на наведении, не на клике.
    const target = e.target.closest("[data-path], [data-href]");
    if (!target) return;
    e.preventDefault();
    e.stopPropagation(); // чтобы штатный обработчик Obsidian не открыл заметку ещё раз
    const path = target.dataset.path || target.dataset.href;
    // Ctrl/Cmd+клик инвертирует настройку openInNewTab
    const newTab = cfg.openInNewTab !== (e.ctrlKey || e.metaKey);
    app.workspace.openLinkText(path, "", newTab);
});

setViewLabel();
render();
