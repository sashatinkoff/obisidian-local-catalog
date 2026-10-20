// lib/templates.js — HTML заголовка, блока статистики и панели фильтров. Без логики событий.

const { cfg } = ctx;
const { esc, fmtInt, plural } = ctx.lib.utils;
const { icon } = ctx.lib.icons;
const { SORTS } = ctx.lib.data;
const { quoteText } = ctx.lib.cards;
const Notes = ctx.lib.notes;

// ---------- заголовок ----------
function header(total) {
    if (!cfg.title && !cfg.addButton) return "";
    return `
<header class="bg-header">
    <div class="bg-title">${esc(cfg.title)}</div>
    <div class="bg-header-actions">
        <span class="bg-count bg-mono">${icon("book")}Найдено: <b>${total}</b></span>
        ${cfg.addButton ? `<button class="bg-btn bg-btn--primary" type="button" data-action="add">${icon("plus")}Добавить книгу</button>` : ""}
    </div>
</header>`;
}

// ---------- статистика ----------
// Мини-график: нарастающий итог по дням месяца
function sparkline(series) {
    const W = 220, H = 60, pad = 4;
    const pts = series.length > 1 ? series : [0, series[0] || 0];
    const max = Math.max(1, ...pts);
    const x = (i) => pad + (i * (W - pad * 2)) / (pts.length - 1);
    const y = (v) => H - pad - (v / max) * (H - pad * 2 - 6);
    const line = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    const last = pts.length - 1;
    const area = `${line} L${x(last).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`;
    return `
<svg class="bg-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="bg-spark-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#bg-spark-fill)"/>
    <path d="${line}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
</svg>`;
}

function stats(s, insight) {
    if (!s) return "";

    const record = s.record
        ? `<span class="bg-badge bg-badge--soft bg-mono">Рекорд года${s.record.diff > 0 ? ` +${s.record.diff}` : ""}</span>`
        : "";
    const side = [
        s.pages ? `${fmtInt(s.pages)} стр` : "",
        s.pagesPerDay ? `<span class="bg-accent">${fmtInt(s.pagesPerDay)} стр/день</span>` : "",
    ].filter(Boolean).join(" · ");
    const pace = s.pace
        ? `<span class="bg-pace bg-mono">Темп чтения: <b class="${s.pace.pct >= 0 ? "bg-accent" : "bg-down"}">${s.pace.pct >= 0 ? "+" : ""}${s.pace.pct}%</b> vs ${esc(s.pace.vs)}</span>`
        : "";

    const monthCard = `
<div class="bg-stat">
    <div class="bg-stat-head">
        <span class="bg-eyebrow bg-mono"><span class="bg-eyebrow-ico bg-eyebrow-ico--amber">${icon("trend")}</span>${esc(s.monthLabel)}</span>
        ${record}
    </div>
    <div class="bg-stat-row">
        <div class="bg-stat-main"><span class="bg-stat-num">${s.count}</span><span class="bg-stat-unit">${esc(s.unit)}</span></div>
        ${side ? `<div class="bg-stat-side bg-mono">${side}</div>` : ""}
    </div>
    <div class="bg-stat-foot bg-mono">
        <span>${pace || "Динамика месяца"}</span>
        <span class="bg-accent">${s.activeDays} ${plural(s.activeDays, ["день", "дня", "дней"])} чтения</span>
    </div>
    ${sparkline(s.series)}
</div>`;

    let insightCard = "";
    if (insight) {
        const b = insight.book;
        const r = Notes.peek(b);
        const text = r ? r.quote : b.quote;
        const target = r ? { path: r.note.path, name: r.note.name } : { path: b.path, name: b.title };
        insightCard = `
<div class="bg-stat bg-stat--insight" data-book="${esc(b.path)}" data-role="insight">
    <div class="bg-stat-head">
        <span class="bg-eyebrow bg-mono"><span class="bg-eyebrow-ico">${icon("quote")}</span>Инсайт месяца</span>
        <span class="bg-eyebrow-ico">${icon("link")}</span>
    </div>
    <div class="bg-insight-text">${text ? esc(quoteText(text)) : "…"}</div>
    <a class="bg-insight-link bg-mono" href="#" data-action="open" data-path="${esc(target.path)}">${icon("file")}<span>[[${esc(target.name)}]]</span></a>
</div>`;
    }

    return `<section class="bg-stats">${monthCard}${insightCard}</section>`;
}

// ---------- панель фильтров ----------
const options = (values, allLabel) =>
    [`<option value="all">${esc(allLabel)}</option>`, ...values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`)].join("");

const select = (name, optionsHtml, icoName) =>
    `<div class="bg-select">${icoName ? icon(icoName, "bg-select-ico") : ""}<select data-filter="${name}">${optionsHtml}</select>${icon("chevron-down", "bg-select-arrow")}</div>`;

function panel({ authors, genres, view }) {
    const sortOptions = Object.entries(SORTS)
        .map(([id, s]) => `<option value="${id}">Сортировка: ${esc(s.label)}</option>`)
        .join("");

    return `
<section class="bg-panel">
    <div class="bg-panel-head">
        <div class="bg-panel-title">
            <span class="bg-ico-box">${icon("sliders")}</span>
            <div>
                <div class="bg-panel-name">Конфигуратор фильтров <span class="bg-pill bg-mono" data-zone="badge" hidden></span></div>
                <div class="bg-panel-sub">Быстрая калибровка витрины и поиск по тегам</div>
            </div>
        </div>
        <div class="bg-panel-actions">
            <div class="bg-seg" role="group">
                <button type="button" class="bg-seg-btn${view === "cards" ? " is-on" : ""}" data-action="view" data-value="cards">${icon("grid")}<span>Карточки</span></button>
                <button type="button" class="bg-seg-btn${view === "list" ? " is-on" : ""}" data-action="view" data-value="list">${icon("list")}<span>Список</span></button>
            </div>
            <button type="button" class="bg-ghost bg-mono" data-action="reset">${icon("reset")}<span>Сбросить все</span></button>
        </div>
    </div>

    <div class="bg-panel-body">
        <div class="bg-row">
            <label class="bg-search">${icon("search")}<input class="bg-search-input" type="text" placeholder="Поиск по названию, автору или аннотации книги..." data-filter="search"></label>
            ${select("sort", sortOptions)}
        </div>

        <div class="bg-two">
            <div class="bg-field">
                <div class="bg-label bg-mono">${icon("user")}Автор заметки</div>
                ${select("author", options(authors, `Все авторы (${authors.length} в каталоге)`))}
            </div>
            <div class="bg-field">
                <div class="bg-label bg-mono">${icon("shapes")}Основной жанр</div>
                ${select("genre", options(genres, "Все жанры"))}
            </div>
        </div>

        <div class="bg-field">
            <div class="bg-label-row">
                <div class="bg-label bg-mono">${icon("star")}Фильтр по оценке</div>
                <span class="bg-hint bg-mono">шкала 0–5</span>
            </div>
            <div class="bg-chips" data-zone="scores"></div>
        </div>

        <div class="bg-field">
            <div class="bg-label-row">
                <div class="bg-label bg-mono">${icon("hash")}Теги заметок <span class="bg-pill bg-mono" data-zone="tagcount"></span></div>
                <span class="bg-hint bg-mono">Кликните для включения в фильтр</span>
            </div>
            <div class="bg-chips" data-zone="tags"></div>
            <input class="bg-tag-find bg-mono" type="text" placeholder="+ Найти тег..." data-filter="tagQuery">
        </div>
    </div>

    <div class="bg-panel-foot bg-mono" data-zone="applied"></div>
</section>`;
}

// ---------- динамические зоны панели ----------
function tagChips(allTags, selected, query) {
    const q = query.trim().toLowerCase();
    const shown = allTags.filter((t) => selected.has(t) || !q || t.toLowerCase().includes(q));
    if (!shown.length) return `<span class="bg-hint bg-mono">Нет таких тегов</span>`;
    return shown
        .map((t) => `<button type="button" class="bg-chip bg-mono${selected.has(t) ? " is-on" : ""}" data-action="tag" data-tag="${esc(t)}">${esc(t)}</button>`)
        .join("");
}

function scoreChips(counts, active) {
    const star = icon("star", "bg-ico--fill bg-star");
    const items = [
        ["all", `Все (${counts.all})`],
        ["5", `5.0 ${star}`],
        ["4", `4.0+ ${star}`],
        ["3", `3.0+ ${star}`],
        ["low", `${icon("thumbs-down")}Менее 3.0`],
    ];
    return items
        .map(([id, label]) => `<button type="button" class="bg-chip bg-chip--score bg-mono${id === "low" ? " bg-chip--danger" : ""}${active === id ? " is-on" : ""}" data-action="score" data-value="${id}">${label}</button>`)
        .join("");
}

const SCORE_LABELS = { "5": "5.0", "4": "4.0+", "3": "3.0+", low: "< 3.0" };

function applied(st, list, total) {
    const chips = [];
    if (st.search.trim()) chips.push(`${icon("search")}«${esc(st.search.trim())}»`);
    if (st.tags.size) chips.push(`${icon("hash")}${esc([...st.tags].map((t) => t.replace(/^#/, "")).join(", "))}`);
    if (st.author !== "all") chips.push(`${icon("user")}${esc(st.author)}`);
    if (st.genre !== "all") chips.push(`${icon("shapes")}${esc(st.genre)}`);
    if (st.score !== "all") chips.push(`${icon("star")}${SCORE_LABELS[st.score]}`);
    if (!chips.length) chips.push(`${icon("shapes")}Без фильтров`);

    const last = list.reduce((m, b) => (b.dateMs > m.dateMs ? b : m), { dateMs: 0, dateText: "" });
    return `
<div class="bg-foot-left"><span>Применены:</span>${chips.map((c) => `<span class="bg-applied">${c}</span>`).join("")}</div>
<div class="bg-foot-right"><span>Совпадений: <b class="bg-accent">${list.length}</b> из ${total} заметок</span>${last.dateMs ? `<span class="bg-last" title="Последнее добавление">${icon("file")}${esc(last.dateText)}</span>` : ""}</div>`;
}

function footer(total, ms) {
    return `<div class="bg-footer bg-mono">${icon("database")}Dataview: загружено ${total} ${plural(total, ["запись", "записи", "записей"])} за ${Math.max(1, Math.round(ms))} мс</div>`;
}

return { header, stats, panel, tagChips, scoreChips, applied, footer };
