// lib/ui.js — панель управления, состояние, отрисовка списка и обработка кликов.

const { cfg, app } = ctx;
const { el } = ctx.lib.utils;
const { SORTS, uniqueValues } = ctx.lib.data;
const { cardsHtml, tableHtml } = ctx.lib.templates;

function mount(container, books) {
    container.innerHTML = "";

    // ---------- состояние ----------
    const saved = localStorage.getItem(cfg.storageKey);
    let currentView = saved === "table" || saved === "cards" ? saved : cfg.defaultView;

    // ---------- элементы ----------
    const controls = el("div", "book-controls");
    const searchInput = el("input", "book-search-input", {
        type: "text",
        placeholder: "Поиск по названию или автору...",
    });
    const filtersRow = el("div", "book-filters-row");
    const viewBtn = el("button", "book-view-btn");
    const authorSelect = el("select", "book-select");
    const genreSelect = el("select", "book-select");
    const tagSelect = el("select", "book-select");
    const sortSelect = el("select", "book-select");

    const fillSelect = (select, allLabel, values) => {
        select.innerHTML = "";
        select.appendChild(el("option", "", { value: "all", textContent: allLabel }));
        values.forEach((v) => select.appendChild(el("option", "", { value: v, textContent: v })));
    };
    fillSelect(authorSelect, "Все авторы", uniqueValues(books, "authors"));
    fillSelect(genreSelect, "Все жанры", uniqueValues(books, "genres"));
    fillSelect(tagSelect, "Все теги", uniqueValues(books, "tags"));

    Object.entries(SORTS).forEach(([value, s]) =>
        sortSelect.appendChild(el("option", "", { value, textContent: "Сортировка: " + s.label }))
    );
    sortSelect.value = SORTS[cfg.defaultSort] ? cfg.defaultSort : "date_desc";

    [viewBtn, authorSelect, genreSelect, tagSelect, sortSelect].forEach((n) => filtersRow.appendChild(n));
    controls.append(searchInput, filtersRow);

    const statsDiv = el("div", "book-stats");
    const gridDiv = el("div");
    container.append(controls, statsDiv, gridDiv);

    // ---------- отрисовка ----------
    const setViewLabel = () => {
        viewBtn.textContent = currentView === "cards" ? "Вид: Карточки" : "Вид: Таблица";
    };

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
        gridDiv.innerHTML = currentView === "cards" ? cardsHtml(list) : tableHtml(list, t);
    }

    // ---------- события ----------
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

        // Обложка / кнопка «Открыть» (data-path) и название в таблице (data-href)
        const target = e.target.closest("[data-path], [data-href]");
        if (!target) return;
        e.preventDefault();
        e.stopPropagation(); // чтобы штатный обработчик Obsidian не открыл заметку второй раз
        const path = target.dataset.path || target.dataset.href;
        // Ctrl/Cmd+клик инвертирует настройку openInNewTab
        const newTab = cfg.openInNewTab !== (e.ctrlKey || e.metaKey);
        app.workspace.openLinkText(path, "", newTab);
    });

    setViewLabel();
    render();
}

return { mount };
