// lib/ui.js — сборка интерфейса, состояние, события и обновление списка.

const { cfg, app } = ctx;
const U = ctx.lib.utils;
const { uniqueValues } = ctx.lib.data;
const Stats = ctx.lib.stats;
const Filters = ctx.lib.filters;
const T = ctx.lib.templates;
const Cards = ctx.lib.cards;
const List = ctx.lib.list;
const Notes = ctx.lib.notes;

const localDate = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// localStorage может быть недоступен (приватный режим, ограничения) — тогда просто не запоминаем вид
const store = {
    get: (k) => {
        try { return localStorage.getItem(k); } catch (e) { return null; }
    },
    set: (k, v) => {
        try { localStorage.setItem(k, v); } catch (e) { /* ничего страшного */ }
    },
};

const notify = (msg) => {
    if (typeof Notice !== "undefined") new Notice(msg);
    else console.warn("book-gallery:", msg);
};

// Создать пустую заметку о книге в cfg.folder и открыть её
async function addBook() {
    const F = cfg.fields;
    const folder = String(cfg.folder).replace(/\/+$/, "");
    try {
        if (folder && !app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
        let path;
        let n = 0;
        do {
            n++;
            path = `${folder ? folder + "/" : ""}Новая книга${n > 1 ? " " + n : ""}.md`;
        } while (app.vault.getAbstractFileByPath(path));

        const lines = [
            "---",
            `${F.title}: `,
            `${F.author}: `,
            `${F.genre}: `,
            `${F.rating}: `,
            `${F.date}: ${localDate()}`,
            `${F.cover}: `,
            cfg.filterField ? `${cfg.filterField}: ${cfg.filterValue}` : null,
            "---",
            "",
        ].filter((l) => l !== null);
        const file = await app.vault.create(path, lines.join("\n"));
        await app.workspace.getLeaf(true).openFile(file);
    } catch (e) {
        console.error("book-gallery:", e);
        notify("Не удалось создать заметку: " + (e && e.message ? e.message : e));
    }
}

function mount(container, books, opts) {
    const loadMs = (opts && opts.loadMs) || 0;
    container.innerHTML = "";

    const saved = store.get(cfg.storageKey);
    let view = saved === "list" || saved === "cards" ? saved : cfg.defaultView === "table" ? "list" : cfg.defaultView;
    if (view !== "list") view = "cards";

    // заметки книг нужны до статистики: от них зависят счётчики и «инсайт месяца»
    Notes.buildIndex(books);

    const state = Filters.createState();
    const allTags = uniqueValues(books, "tags");
    const stats = cfg.showStats ? Stats.compute(books) : null;
    const insight = cfg.showStats ? Stats.insight(books, stats) : null;

    const root = U.el("div", "bg-root");
    root.innerHTML =
        T.header(books.length) +
        T.stats(stats, insight) +
        T.panel({ authors: uniqueValues(books, "authors"), genres: uniqueValues(books, "genres"), view }) +
        `<div class="bg-results" data-zone="results"></div>` +
        (cfg.showFooter ? T.footer(books.length, loadMs) : "");
    container.appendChild(root);

    const zone = (name) => root.querySelector(`[data-zone="${name}"]`);
    const zones = {
        badge: zone("badge"),
        tagcount: zone("tagcount"),
        scores: zone("scores"),
        tags: zone("tags"),
        applied: zone("applied"),
        results: zone("results"),
    };
    const sortSelect = root.querySelector('[data-filter="sort"]');
    sortSelect.value = state.sort;

    // ---------- отрисовка ----------
    function update() {
        const list = Filters.apply(books, state);

        const active = Filters.activeCount(state);
        zones.badge.hidden = !active;
        zones.badge.textContent = active ? `${active} ${U.plural(active, ["активный", "активных", "активных"])}` : "";
        zones.tagcount.textContent = `${allTags.length} ${U.plural(allTags.length, ["тег", "тега", "тегов"])} · ${state.tags.size} выбрано`;
        zones.tags.innerHTML = T.tagChips(allTags, state.tags, state.tagQuery);
        zones.scores.innerHTML = T.scoreChips(Filters.scoreCounts(books), state.score);
        zones.applied.innerHTML = T.applied(state, list, books.length);
        zones.results.innerHTML = view === "cards" ? Cards.grid(list) : List.table(list, state.tags);

        root.querySelectorAll('[data-action="view"]').forEach((b) => b.classList.toggle("is-on", b.dataset.value === view));

        // случайные заметки в больших карточках дочитываются из файлов уже после отрисовки
        Notes.hydrate(zones.results, Cards.fill);
    }

    // ---------- события ----------
    let timer;
    root.addEventListener("input", (e) => {
        const f = e.target.dataset && e.target.dataset.filter;
        if (f === "search") {
            clearTimeout(timer);
            timer = setTimeout(() => {
                state.search = e.target.value;
                update();
            }, cfg.searchDebounce);
        } else if (f === "tagQuery") {
            state.tagQuery = e.target.value;
            zones.tags.innerHTML = T.tagChips(allTags, state.tags, state.tagQuery);
        }
    });

    root.addEventListener("change", (e) => {
        const f = e.target.dataset && e.target.dataset.filter;
        if (f === "author" || f === "genre" || f === "sort") {
            state[f] = e.target.value;
            update();
        }
    });

    // Enter в поиске тегов: если остался один тег — включить его
    root.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || !(e.target.dataset && e.target.dataset.filter === "tagQuery")) return;
        const q = state.tagQuery.trim().toLowerCase();
        const found = allTags.filter((t) => q && t.toLowerCase().includes(q));
        if (found.length === 1) {
            state.tags.has(found[0]) ? state.tags.delete(found[0]) : state.tags.add(found[0]);
            e.target.value = "";
            state.tagQuery = "";
            update();
        }
    });

    // Один обработчик кликов на весь блок (делегирование)
    root.addEventListener("click", (e) => {
        const actionEl = e.target.closest("[data-action]");
        if (actionEl) {
            const action = actionEl.dataset.action;

            if (action === "tag") {
                const tag = actionEl.dataset.tag;
                state.tags.has(tag) ? state.tags.delete(tag) : state.tags.add(tag);
                update();
                return;
            }
            if (action === "score") {
                state.score = state.score === actionEl.dataset.value ? "all" : actionEl.dataset.value;
                update();
                return;
            }
            if (action === "view") {
                view = actionEl.dataset.value;
                store.set(cfg.storageKey, view);
                update();
                return;
            }
            if (action === "reset") {
                Filters.reset(state);
                root.querySelector('[data-filter="search"]').value = "";
                root.querySelector('[data-filter="tagQuery"]').value = "";
                root.querySelector('[data-filter="author"]').value = "all";
                root.querySelector('[data-filter="genre"]').value = "all";
                update();
                return;
            }
            if (action === "reroll") {
                e.preventDefault();
                e.stopPropagation();
                actionEl.disabled = true;
                Notes.reroll(actionEl.dataset.path).then(update);
                return;
            }
            if (action === "add") {
                addBook();
                return;
            }
            if (action === "open") {
                e.preventDefault();
                e.stopPropagation();
                // Ctrl/Cmd+клик инвертирует настройку openInNewTab
                const newTab = cfg.openInNewTab !== (e.ctrlKey || e.metaKey);
                app.workspace.openLinkText(actionEl.dataset.path, "", newTab);
                return;
            }
        }

        // Название в списке — внутренняя ссылка Obsidian (работает превью при наведении)
        const link = e.target.closest("a[data-href]");
        if (link) {
            e.preventDefault();
            e.stopPropagation(); // чтобы штатный обработчик Obsidian не открыл заметку второй раз
            const newTab = cfg.openInNewTab !== (e.ctrlKey || e.metaKey);
            app.workspace.openLinkText(link.dataset.href, "", newTab);
        }
    });

    update();
    Notes.hydrate(root, Cards.fill); // инсайт месяца
}

return { mount };
