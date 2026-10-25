// src/ui.js — сборка интерфейса, состояние, события и обновление списка.

const { cfg, app } = ctx;
const U = ctx.lib.utils;
const { uniqueValues } = ctx.lib.data;
const Stats = ctx.lib.stats;
const Filters = ctx.lib.filters;
const T = ctx.lib.templates;
const Cards = ctx.lib.cards;
const List = ctx.lib.list;
const Notes = ctx.lib.notes;
const Thumbs = ctx.lib.thumbs;

const localDate = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// localStorage может быть недоступен (приватный режим, ограничения) — тогда просто не запоминаем выбор
const store = {
    get: (k) => {
        try { return localStorage.getItem(k); } catch (e) { return null; }
    },
    set: (k, v) => {
        try { localStorage.setItem(k, v); } catch (e) { /* ничего страшного */ }
    },
};

const notify = (msg) => {
    if (ctx.obsidian && ctx.obsidian.Notice) new ctx.obsidian.Notice(msg);
    else console.warn("book-gallery:", msg);
};

// Число колонок бенто-сетки по ширине блока: примерно по одной колонке на каждые ~300 px, от 2 до 8.
// Для уже выбранного числа колонок (prev) действует запас в 48 px: когда из-за смены раскладки появляется
// или исчезает полоса прокрутки, ширина меняется на ~15 px, и без запаса сетка бесконечно перестраивалась бы
const COL_STEPS = [0, 0, 0, 640, 900, 1200, 1500, 1800, 2100]; // COL_STEPS[n] — минимальная ширина для n колонок
function colsFor(w, prev) {
    if (!prev) {
        let c = 2;
        while (c < 8 && w >= COL_STEPS[c + 1]) c++;
        return c;
    }
    const MARGIN = 48;
    let c = prev;
    while (c < 8 && w >= COL_STEPS[c + 1] + MARGIN) c++;
    while (c > 2 && w < COL_STEPS[c] - MARGIN) c--;
    return c;
}

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

async function mount(container, books, opts) {
    const loadMs = (opts && opts.loadMs) || 0;
    // keep — объект владельца блока: переживает перерисовку, чтобы фильтры и выбранный вид не сбрасывались
    const keep = (opts && opts.keep) || {};

    // блок могут перерисовать, пока предыдущий запуск ещё читает файлы
    const token = {};
    container.__bgToken = token;
    // при тихом обновлении старая версия остаётся на экране, пока не готова новая (без мигания и скачка прокрутки)
    if (!(opts && opts.silent)) container.innerHTML = '<div style="padding:24px;text-align:center;opacity:.6">Загрузка…</div>';

    const saved = store.get(cfg.storageKey);
    let view = keep.view || (saved === "list" || saved === "cards" ? saved : cfg.defaultView === "table" ? "list" : cfg.defaultView);
    if (view !== "list") view = "cards";

    const tagsKey = cfg.storageKey + "-tags";
    const savedTags = store.get(tagsKey);
    let tagsOpen = typeof keep.tagsOpen === "boolean" ? keep.tagsOpen : savedTags === "open" ? true : savedTags === "closed" ? false : !cfg.tagsCollapsed;

    // заметки книг нужны до статистики: от них зависят счётчики и «инсайт месяца»
    Notes.buildIndex(books);
    // тексты читаются заранее: по их объёму решается, какие книги получат большую карточку
    await Notes.preload(books, 2500);
    if (container.__bgToken !== token) return; // блок уже перезапущен
    container.innerHTML = "";

    const state = keep.state || Filters.createState();
    const allTags = uniqueValues(books, "tags");
    const stats = cfg.showStats ? Stats.compute(books) : null;
    const insight = cfg.showStats ? Stats.insight(books, stats) : null;
    const years = Stats.years(books);
    let pulseYear = years.includes(keep.pulseYear) ? keep.pulseYear : years[0];
    const sync = () => Object.assign(keep, { state, view, tagsOpen, pulseYear });

    let timer; // задержка поиска

    const root = U.el("div", cfg.coverFit === "contain" ? "bg-root bg-root--fit-contain" : "bg-root");
    root.innerHTML =
        T.header(books.length) +
        T.stats(stats, insight) +
        `<div data-zone="pulse"></div>` +
        `<div data-zone="progress"></div>` +
        T.panel({ authors: uniqueValues(books, "authors"), genres: uniqueValues(books, "genres"), view, tagsOpen }) +
        `<div class="bg-results" data-zone="results"></div>` +
        (cfg.showFooter ? T.footer(books.length, loadMs, books.coverStats) : "");
    container.appendChild(root);

    const zone = (name) => root.querySelector(`[data-zone="${name}"]`);
    const zones = {
        pulse: zone("pulse"),
        progress: zone("progress"),
        badge: zone("badge"),
        tagcount: zone("tagcount"),
        scores: zone("scores"),
        tags: zone("tags"),
        tagsfield: zone("tagsfield"),
        applied: zone("applied"),
        results: zone("results"),
    };
    // восстановить значения полей (после перерисовки состояние уже может быть непустым)
    const setField = (name, value) => {
        const node = root.querySelector(`[data-filter="${name}"]`);
        if (node) node.value = value;
    };
    setField("search", state.search);
    setField("tagQuery", state.tagQuery);
    setField("author", state.author);
    setField("genre", state.genre);
    setField("sort", state.sort);

    let lastList = [];
    let cols = 0;
    let lastW = 0; // ширина блока при последней раскладке: по ней понимаем, что высоты карточек надо измерить заново

    // ---------- отрисовка ----------
    function renderPulse() {
        const goal = years.length ? Stats.goalFor(pulseYear, cfg) : 0;
        zones.pulse.innerHTML = cfg.showPulse && years.length ? T.pulse(Stats.pulse(books, pulseYear), state.month, goal ? goal / 12 : 0) : "";
        // инфокарточки о прогрессе: за тот же год, что выбран в «Пульсе»; без книг показываем только план
        zones.progress.innerHTML =
            cfg.showProgress !== false && (years.length || cfg.yearGoal > 0)
                ? T.progress(Stats.progress(books, pulseYear || new Date().getFullYear(), { goal, goalPages: Number(cfg.yearGoalPages) || 0 }))
                : "";
    }

    function renderResults() {
        cols = colsFor(zones.results.clientWidth || root.clientWidth || 1000, cols);
        zones.results.innerHTML = view === "cards" ? Cards.grid(lastList, cols) : List.table(lastList, state.tags);
        lastW = zones.results.clientWidth;
        if (view === "cards") Cards.relayout(zones.results); // высоты карточек по факту
        Thumbs.hydrate(zones.results);              // уменьшенные обложки
        // тексты, которые не успели прочитаться заранее; после них высоты меняются — подгоняем сетку ещё раз
        Notes.hydrate(zones.results, Cards.fill).then(() => {
            if (view === "cards" && zones.results.isConnected) Cards.relayout(zones.results);
        });
    }

    function update() {
        sync();
        lastList = Filters.apply(books, state);

        const active = Filters.activeCount(state);
        zones.badge.hidden = !active;
        zones.badge.textContent = active ? `${active} ${U.plural(active, ["активный", "активных", "активных"])}` : "";
        zones.tagcount.textContent = `${allTags.length} ${U.plural(allTags.length, ["тег", "тега", "тегов"])} · ${state.tags.size} выбрано`;
        zones.tags.innerHTML = T.tagChips(allTags, state.tags, state.tagQuery);
        zones.scores.innerHTML = T.scoreChips(Filters.scoreCounts(books), state.score);
        zones.applied.innerHTML = T.applied(state, lastList, books.length);
        root.querySelectorAll('[data-action="view"]').forEach((b) => b.classList.toggle("is-on", b.dataset.value === view));

        renderPulse();
        renderResults();
    }

    // Бенто-сетка пересчитывается, когда меняется число колонок (изменили ширину панели или окна)
    const cleanups = [];
    if (typeof ResizeObserver !== "undefined") {
        let frame = 0;
        const relayouts = []; // время последних перестроек: защита от бесконечного цикла
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (!root.isConnected) return observer.disconnect();
                const w = zones.results.clientWidth || root.clientWidth || 1000;
                const next = colsFor(w, cols);
                if (view !== "cards") return;
                if (next === cols) {
                    // число колонок то же, но ширина изменилась: тексты переносятся иначе, высоты надо измерить заново
                    if (Math.abs(w - lastW) >= 1) {
                        lastW = w;
                        Cards.relayout(zones.results);
                    }
                    return;
                }
                const now = Date.now();
                while (relayouts.length && now - relayouts[0] > 3000) relayouts.shift();
                if (relayouts.length >= 6) return observer.disconnect(); // слишком часто — перестаём следить
                relayouts.push(now);
                renderResults();
            });
        });
        observer.observe(root);
        cleanups.push(() => {
            cancelAnimationFrame(frame);
            observer.disconnect();
        });
    }
    cleanups.push(() => clearTimeout(timer));
    // когда блок выгружается (переход на другую заметку, закрытие вкладки, перерисовка), всё останавливаем
    if (opts && typeof opts.onCleanup === "function") opts.onCleanup(() => cleanups.forEach((fn) => fn()));

    // ---------- события ----------
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
            if (action === "tags-toggle") {
                tagsOpen = !tagsOpen;
                sync();
                store.set(tagsKey, tagsOpen ? "open" : "closed");
                zones.tagsfield.classList.toggle("is-collapsed", !tagsOpen);
                actionEl.setAttribute("aria-expanded", tagsOpen ? "true" : "false");
                return;
            }
            if (action === "pulse-year") {
                if (actionEl.dataset.value) {
                    pulseYear = Number(actionEl.dataset.value);
                    sync();
                    renderPulse();
                }
                return;
            }
            if (action === "pulse-month") {
                // повторный клик по тому же месяцу снимает фильтр
                state.month = state.month === actionEl.dataset.value ? null : actionEl.dataset.value;
                const year = Number(state.month ? state.month.split("-")[0] : pulseYear);
                if (years.includes(year)) pulseYear = year;
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
            if (action === "set-filter") {
                // клик по «любимому» жанру или автору включает соответствующий фильтр
                const field = actionEl.dataset.field;
                if (field === "author" || field === "genre") {
                    state[field] = state[field] === actionEl.dataset.value ? "all" : actionEl.dataset.value;
                    const select = root.querySelector(`[data-filter="${field}"]`);
                    if (select) select.value = state[field];
                    update();
                }
                return;
            }
            if (action === "reroll") {
                e.preventDefault();
                e.stopPropagation();
                actionEl.disabled = true;
                Notes.reroll(actionEl.dataset.path).then(renderResults);
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

module.exports = { mount };
