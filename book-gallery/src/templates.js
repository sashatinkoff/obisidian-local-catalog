// lib/templates.js — HTML заголовка, блока статистики, «Пульса» года и панели фильтров.
// Без логики событий: клики ловит ui.js по атрибутам data-action.

const { cfg } = ctx;
const { esc, fmtInt, plural, formatDate } = ctx.lib.utils;
const { icon } = ctx.lib.icons;
const { SORTS } = ctx.lib.data;
const Notes = ctx.lib.notes;

// ---------- заголовок ----------
// 3.2 -> «3,2», 3 -> «3»
const num1 = (n) => String(Math.round(n * 10) / 10).replace(".", ",");

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

// ---------- статистика месяца и инсайт ----------
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
        const c = Notes.content(b);
        const text = c ? (c.source === "excerpt" ? c.quote : `«${c.quote.replace(/^[«"“”\s]+|[»"“”\s]+$/g, "")}»`) : "";
        // подпись — книга и автор, а не название заметки; клик открывает книгу
        const target = { path: b.path, name: b.authorText ? `${b.title} — ${b.authorText}` : b.title };
        insightCard = `
<div class="bg-stat bg-stat--insight" data-book="${esc(b.path)}" data-role="insight">
    <div class="bg-stat-head">
        <span class="bg-eyebrow bg-mono"><span class="bg-eyebrow-ico">${icon("quote")}</span>Инсайт месяца</span>
        <span class="bg-eyebrow-ico">${icon("link")}</span>
    </div>
    <div class="bg-insight-text">${text ? esc(text) : "…"}</div>
    <a class="bg-insight-link bg-mono" href="#" data-action="open" data-path="${esc(target.path)}">${icon("file")}<span>${esc(target.name)}</span></a>
</div>`;
    }

    return `<section class="bg-stats">${monthCard}${insightCard}</section>`;
}

// ---------- «Пульс прочитанных за год» ----------
const monthShort = (year, m) => {
    try {
        return new Intl.DateTimeFormat(cfg.dateLocale || "ru", { month: "long" }).format(new Date(year, m, 1)).slice(0, 3);
    } catch (e) {
        return String(m + 1);
    }
};

const monthKey = (year, m) => `${year}-${String(m + 1).padStart(2, "0")}`;

// data — результат Stats.pulse; selected — ключ выбранного месяца ("2026-09") или null
function pulse(data, selected, goalPerMonth) {
    if (!data || !data.years.length) return "";
    // шкала столбцов; если задан план, пунктир плана тоже должен помещаться
    const scale = Math.max(data.max, goalPerMonth ? Math.ceil(goalPerMonth) : 0, 1);

    const idx = data.years.indexOf(data.year);
    const older = data.years[idx + 1];
    const newer = data.years[idx - 1];
    const yearBtn = (icoName, target, label) =>
        `<button class="bg-year-btn" type="button" data-action="pulse-year" data-value="${target ?? ""}" aria-label="${label}"${target ? "" : " disabled"}>${icon(icoName)}</button>`;

    const bars = data.months
        .map((x) => {
            const key = monthKey(data.year, x.m);
            const h = x.count ? Math.max(8, Math.round((x.count / scale) * 100)) : 3;
            const full = formatDate(new Date(data.year, x.m, 1).getTime(), "MMMM yyyy", cfg.dateLocale);
            const hint = `${full}: ${x.count} ${plural(x.count, ["книга", "книги", "книг"])}${x.pages ? `, ${fmtInt(x.pages)} стр` : ""}`;
            return `
<button class="bg-bar${selected === key ? " is-on" : ""}${x.count ? "" : " is-empty"}${x.count === data.max && x.count ? " is-peak" : ""}" type="button" data-action="pulse-month" data-value="${key}" title="${esc(hint)}">
    <span class="bg-bar-val bg-mono">${x.count || ""}</span>
    <span class="bg-bar-track"><span class="bg-bar-fill" style="height:${h}%"></span>${goalPerMonth ? `<span class="bg-bar-goal" style="bottom:${Math.min(100, (goalPerMonth / scale) * 100)}%"></span>` : ""}</span>
    <span class="bg-bar-lbl bg-mono">${esc(monthShort(data.year, x.m))}</span>
</button>`;
        })
        .join("");

    const best = data.bestMonth !== null
        ? `<div><div class="bg-meta-k bg-mono">Лучший месяц</div><div class="bg-meta-v">${esc(formatDate(new Date(data.year, data.bestMonth, 1).getTime(), "MMMM", cfg.dateLocale))} · ${data.max}</div></div>`
        : "";
    const sums = [
        data.pages ? `<div><div class="bg-meta-k bg-mono">Страниц</div><div class="bg-meta-v bg-mono">${fmtInt(data.pages)}</div></div>` : "",
        data.avg !== null ? `<div><div class="bg-meta-k bg-mono">Средняя оценка</div><div class="bg-meta-v bg-mono">${data.avg.toFixed(1)}${icon("star", "bg-ico--fill bg-star")}</div></div>` : "",
        best,
    ].join("");

    return `
<section class="bg-pulse">
    <div class="bg-pulse-head">
        <span class="bg-eyebrow bg-mono"><span class="bg-eyebrow-ico">${icon("pulse")}</span>Пульс прочитанных за год</span>
        <div class="bg-year bg-mono">${yearBtn("chevron-left", older, "Предыдущий год")}<span>${data.year}</span>${yearBtn("chevron-right", newer, "Следующий год")}</div>
    </div>
    <div class="bg-pulse-body">
        <div class="bg-pulse-sum">
            <div class="bg-stat-main"><span class="bg-stat-num">${data.total}</span><span class="bg-stat-unit">${plural(data.total, ["книга", "книги", "книг"])}</span></div>
            <div class="bg-meta">${sums}</div>
        </div>
        <div class="bg-bars" role="group" aria-label="Книги по месяцам">${bars}</div>
    </div>
    <div class="bg-pulse-hint bg-mono">Нажмите на столбец, чтобы показать книги месяца${goalPerMonth ? ` · пунктир — план: ${num1(goalPerMonth)} ${plural(Math.round(goalPerMonth), ["книга", "книги", "книг"])} в месяц` : ""}</div>
</section>`;
}

// ---------- панель фильтров ----------
const options = (values, allLabel) =>
    [`<option value="all">${esc(allLabel)}</option>`, ...values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`)].join("");

const select = (name, optionsHtml, icoName) =>
    `<div class="bg-select">${icoName ? icon(icoName, "bg-select-ico") : ""}<select data-filter="${name}">${optionsHtml}</select>${icon("chevron-down", "bg-select-arrow")}</div>`;

function panel({ authors, genres, view, tagsOpen }) {
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
            <button type="button" class="bg-ghost bg-mono" data-action="reset" title="Сбросить все" aria-label="Сбросить все">${icon("reset")}<span>Сбросить все</span></button>
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

        <div class="bg-field bg-field--tags${tagsOpen ? "" : " is-collapsed"}" data-zone="tagsfield">
            <div class="bg-label-row">
                <button type="button" class="bg-label bg-label--btn bg-mono" data-action="tags-toggle" aria-expanded="${tagsOpen ? "true" : "false"}">
                    ${icon("chevron-up", "bg-fold")}${icon("hash")}Теги заметок <span class="bg-pill bg-mono" data-zone="tagcount"></span>
                </button>
                <span class="bg-hint bg-mono">Кликните для включения в фильтр</span>
            </div>
            <div class="bg-tags-body">
                <div class="bg-chips" data-zone="tags"></div>
                <input class="bg-tag-find bg-mono" type="text" placeholder="+ Найти тег..." data-filter="tagQuery">
            </div>
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
        ["5", `5 ${star}`],
        ["4", `4 ${star}`],
        ["3", `3 ${star}`],
        ["2", `2 ${star}`],
        ["low", `${icon("thumbs-down")}Менее 2`],
    ];
    return items
        .map(([id, label]) => `<button type="button" class="bg-chip bg-chip--score bg-mono${id === "low" ? " bg-chip--danger" : ""}${active === id ? " is-on" : ""}" data-action="score" data-value="${id}">${label}</button>`)
        .join("");
}

const SCORE_LABELS = { "5": "5 ★", "4": "4 ★", "3": "3 ★", "2": "2 ★", low: "менее 2 ★" };

function applied(st, list, total) {
    const chips = [];
    if (st.search.trim()) chips.push(`${icon("search")}«${esc(st.search.trim())}»`);
    if (st.month) {
        const [y, m] = st.month.split("-").map(Number);
        chips.push(`${icon("pulse")}${esc(formatDate(new Date(y, m - 1, 1).getTime(), "MMMM yyyy", cfg.dateLocale))}`);
    }
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

// ---------- инфокарточки о прогрессе ----------
const RING = 2 * Math.PI * 42;
const ring = (pct) =>
    `<svg class="bg-ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="bg-ring-bg" cx="50" cy="50" r="42"/><circle class="bg-ring-fg" cx="50" cy="50" r="42" stroke-dasharray="${((RING * pct) / 100).toFixed(1)} ${RING.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>`;

const bar = (pct) => `<span class="bg-progress-bar"><span style="width:${pct}%"></span></span>`;

const pcard = (cls, ico, title, body, foot) => `
<div class="bg-stat bg-pcard ${cls}">
    <div class="bg-stat-head"><span class="bg-eyebrow bg-mono"><span class="bg-eyebrow-ico">${icon(ico)}</span>${esc(title)}</span></div>
    ${body}
    ${foot ? `<div class="bg-stat-foot bg-mono">${foot}</div>` : ""}
</div>`;

const STATUS = {
    ahead: (p) => `<b class="bg-accent">Опережаете на ${p.diff}</b>`,
    behind: (p) => `<b class="bg-down">Отстаёте на ${p.diff}</b>`,
    onTrack: () => `<b class="bg-accent">По графику</b>`,
    done: () => `<b class="bg-accent">План выполнен</b>`,
    missed: (p) => `<b class="bg-down">Не хватило ${p.remaining}</b>`,
};

function progress(P) {
    if (!P) return "";
    const books = ["книга", "книги", "книг"];
    const cards = [];

    // 1. план на год
    if (P.plan) {
        const p = P.plan;
        cards.push(
            pcard(
                "bg-pcard--plan",
                "badge",
                `План на ${P.year}`,
                `<div class="bg-plan"><div class="bg-ring-wrap">${ring(p.pct)}<span class="bg-ring-num bg-mono">${p.pct}%</span></div>
                <div class="bg-plan-text"><div class="bg-stat-main"><span class="bg-stat-num">${P.count}</span><span class="bg-stat-unit">из ${p.goal}</span></div>
                <div class="bg-plan-status bg-mono">${STATUS[p.status](p)}</div></div></div>`,
                p.done
                    ? `<span>Сверх плана: ${P.count - p.goal}</span>`
                    : `<span>Осталось ${p.remaining}</span><span class="bg-accent">${p.need ? `нужно ${num1(p.need)} в месяц` : ""}</span>`
            )
        );
    } else {
        cards.push(
            pcard(
                "bg-pcard--plan bg-pcard--hint",
                "badge",
                "План на год",
                `<div class="bg-pcard-hint">Задайте цель на год в настройках плагина («План на год») или параметром <code>yearGoal</code> в блоке — здесь появятся прогресс и прогноз.</div>`,
                ""
            )
        );
    }

    if (P.count) {
        // 2. темп и прогноз
        const unit = P.finished ? "книги в месяц" : "к концу года";
        const big = P.finished ? num1(P.count / 12) : P.forecast !== null ? `≈ ${P.forecast}` : "—";
        const verdict =
            P.plan && P.forecast !== null && !P.finished
                ? P.forecast >= P.plan.goal
                    ? `<span class="bg-accent">Успеете: прогноз выше плана</span>`
                    : `<span class="bg-down">Не успеете при таком темпе</span>`
                : "";
        cards.push(
            pcard(
                "",
                "trend",
                P.finished ? "Темп года" : "Темп и прогноз",
                `<div class="bg-stat-row"><div class="bg-stat-main"><span class="bg-stat-num">${big}</span><span class="bg-stat-unit">${unit}</span></div></div>`,
                verdict || (P.perMonth ? `<span>Сейчас ${num1(P.perMonth)} ${plural(Math.round(P.perMonth), books)} в месяц</span>` : `<span>Мало данных для прогноза</span>`)
            )
        );

        // 3. серия месяцев
        const n = P.streak.current !== null ? P.streak.current : P.streak.longest;
        const dots = P.read
            .map((v, m) => `<i class="bg-dot-m${v ? " is-on" : ""}" title="${esc(monthShort(P.year, m))}"></i>`)
            .join("");
        cards.push(
            pcard(
                "",
                "pulse",
                "Серия чтения",
                `<div class="bg-stat-row"><div class="bg-stat-main"><span class="bg-stat-num">${n}</span><span class="bg-stat-unit">${plural(n, ["месяц", "месяца", "месяцев"])} подряд</span></div></div>
                <div class="bg-dots">${dots}</div>`,
                `<span>${P.streak.current !== null ? "Текущая серия" : "Лучшая серия года"}</span><span class="bg-accent">рекорд года: ${P.streak.longest}</span>`
            )
        );

        // 4. страницы
        if (P.pages || P.pagesPlan) {
            const pp = P.pagesPlan;
            cards.push(
                pcard(
                    "",
                    "file",
                    "Страницы",
                    `<div class="bg-stat-row"><div class="bg-stat-main"><span class="bg-stat-num">${fmtInt(P.pages || 0)}</span><span class="bg-stat-unit">стр${pp ? ` из ${fmtInt(pp.goal)}` : ""}</span></div></div>
                    ${pp ? bar(pp.pct) : ""}`,
                    `<span>${P.pagesPerDay ? `≈ ${fmtInt(P.pagesPerDay)} стр в день` : ""}</span><span class="bg-accent">${P.pagesPerBook ? `${fmtInt(P.pagesPerBook)} стр на книгу` : ""}</span>`
                )
            );
        }

        // 5. оценки
        if (P.scored) {
            const maxN = Math.max(1, ...Object.values(P.dist));
            const row = (id, label) =>
                `<button type="button" class="bg-dist-row" data-action="score" data-value="${id}" title="Показать книги с оценкой ${esc(label)}">
                    <span class="bg-dist-k bg-mono">${label}</span>${bar(Math.round((P.dist[id] / maxN) * 100))}<span class="bg-dist-n bg-mono">${P.dist[id]}</span></button>`;
            cards.push(
                pcard(
                    "bg-pcard--dist",
                    "star",
                    "Оценки года",
                    `<div class="bg-dist">${row("5", "5★")}${row("4", "4★")}${row("3", "3★")}${row("2", "2★")}${row("low", "<2★")}</div>`,
                    `<span>Средняя оценка</span><span class="bg-accent">${P.avg.toFixed(1)} ${icon("star", "bg-ico--fill bg-star")}</span>`
                )
            );
        }

        // 6. любимые жанр и автор
        if (P.topGenre || P.topAuthor) {
            const fav = (ico, label, top, field) =>
                top
                    ? `<button type="button" class="bg-fav" data-action="set-filter" data-field="${field}" data-value="${esc(top.name)}" title="Показать книги: ${esc(top.name)}">
                        <span class="bg-fav-ico">${icon(ico)}</span><span class="bg-fav-body"><span class="bg-meta-k bg-mono">${label}</span><span class="bg-fav-name">${esc(top.name)}</span></span><span class="bg-fav-n bg-mono">${top.count}</span></button>`
                    : "";
            cards.push(
                pcard("bg-pcard--fav", "shapes", "Чаще всего", `<div class="bg-favs">${fav("shapes", "Жанр", P.topGenre, "genre")}${fav("user", "Автор", P.topAuthor, "author")}</div>`, "")
            );
        }
    }

    return `<section class="bg-progress">${cards.join("")}</section>`;
}

function footer(total, ms, cov) {
    const loaded = `Book Gallery: загружено ${total} ${plural(total, ["запись", "записи", "записей"])} за ${Math.max(1, Math.round(ms))} мс`;
    const lost = cov && cov.set > cov.found ? cov.set - cov.found : 0;
    const warn = lost
        ? ` · <span class="bg-accent" title="${esc("Не найдены файлы обложек. Примеры: " + cov.missing.join("; "))}">обложек не найдено: ${lost}</span>`
        : "";
    return `<div class="bg-footer bg-mono">${icon("database")}${loaded}${warn}</div>`;
}

module.exports = { header, stats, pulse, progress, panel, tagChips, scoreChips, applied, footer, monthKey };
