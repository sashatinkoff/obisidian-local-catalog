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
    fullWidth: false,                 // растянуть заметку на всю ширину (вместо cssclasses во frontmatter)
    fullWidthClasses: ["max", "full-width"], // классы, которые добавляются заметке при fullWidth: true
    cssPath: "scripts/book-gallery/view.css", // путь к CSS-файлу от корня хранилища
    searchDebounce: 150,              // мс
};

const user = input || {};
const cfg = Object.assign({}, defaults, user, {
    fields: Object.assign({}, defaults.fields, user.fields || {}),
});
const F = cfg.fields;

// ---------- СТИЛИ (читаются из CSS-файла рядом со скриптом) ----------
const STYLE_ID = "book-gallery-styles";

// Возвращает текст ошибки или null
async function injectStyles() {
    let css = "";
    let error = null;
    try {
        css = await app.vault.adapter.read(cfg.cssPath);
    } catch (e) {
        error = `Не найден файл стилей «${cfg.cssPath}». Положите view.css рядом со скриптом или укажите путь параметром cssPath.`;
        console.warn("book-gallery:", error, e);
    }
    let style = document.getElementById(STYLE_ID);
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }
    style.textContent = css; // перезаписываем, чтобы правки CSS применялись при перерисовке
    return error;
}

// Добавляет заметке классы ширины так же, как это делает cssclasses во frontmatter,
// и убирает их, когда блок выгружается (переход на другую заметку, перерисовка)
function applyFullWidth(container) {
    if (!cfg.fullWidth) return;

    const classes = toArrayOfStrings(cfg.fullWidthClasses);
    if (!classes.length) return;

    container.classList.add("book-gallery-root");

    let host = null;
    let added = [];
    let tries = 0;

    const attach = () => {
        host = container.closest(".markdown-preview-view, .markdown-source-view");
        if (host) {
            added = classes.filter((c) => !host.classList.contains(c));
            host.classList.add(...added);
        } else if (tries++ < 60) {
            // в режиме чтения блок бывает ещё не вставлен в страницу — повторяем
            requestAnimationFrame(attach);
        }
    };
    attach();

    dv.component?.register(() => {
        // небольшая задержка: при перерисовке новый блок успеет вставиться
        setTimeout(() => {
            if (host && !host.querySelector(".book-gallery-root")) {
                host.classList.remove(...added);
            }
        }, 0);
    });
}

function toArrayOfStrings(v) {
    if (!v) return [];
    return (Array.isArray(v) ? v : [v]).map(String).filter(Boolean);
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
const cssError = await injectStyles();
applyFullWidth(dv.container);

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
if (cssError) {
    // стили не загрузились, поэтому оформляем сообщение inline
    container.prepend(el("div", "", { textContent: cssError, style: "color:#d9534f;margin-bottom:12px;" }));
}

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
