// lib/cards.js — HTML карточек: обычная, главная («Книга года») и «Разочарование».
// Без логики и без обработчиков: клики ловит ui.js по атрибутам data-action.

const { cfg } = ctx;
const { esc, cssUrl } = ctx.lib.utils;
const { icon } = ctx.lib.icons;
const Notes = ctx.lib.notes;

// «текст» -> «текст» в ёлочках, без двойных кавычек
const quoteText = (q) => `«${String(q).replace(/^[«"“”\s]+|[»"“”\s]+$/g, "")}»`;

const openAttrs = (b) => `data-action="open" data-path="${esc(b.path)}"`;

const scoreBadge = (b) =>
    b.scoreText ? `<span class="bg-score bg-mono">${b.scoreText}${icon("star", "bg-ico--fill bg-star")}</span>` : "";

const placeholder = (b) => `
    <div class="bg-ph">
        ${icon("book")}
        <div class="bg-ph-title">${esc(b.title)}</div>
        <div class="bg-ph-author">${esc(b.authors[0] || "")}</div>
    </div>`;

// Обложка с рейтингом и первым тегом; фон размыт из самой обложки
function coverHtml(b, { tag = true, overlay = "" } = {}) {
    const media = b.cover ? `<img class="bg-cover-img" src="${esc(b.cover)}" loading="lazy" alt="">` : placeholder(b);
    const style = b.cover ? ` style="--cover:${esc(cssUrl(b.cover))}"` : "";
    const chip = tag && b.tags[0] ? `<span class="bg-cover-tag bg-mono">${esc(b.tags[0])}</span>` : "";
    return `<div class="bg-cover${b.cover ? "" : " bg-cover--empty"}" ${openAttrs(b)}${style}>${media}${scoreBadge(b)}${chip}${overlay}</div>`;
}

const quoteBox = (b, caption = "") =>
    b.quote
        ? `<div class="bg-quote">${caption ? `<div class="bg-quote-cap bg-mono">${icon("quote")}${esc(caption)}</div>` : ""}<div class="bg-quote-text">${esc(quoteText(b.quote))}</div></div>`
        : "";

// path — какую заметку открывает кнопка (по умолчанию — заметку книги)
const noteBtn = (b, modifier = "", path = b.path) =>
    `<button class="bg-note-btn${modifier}" type="button" data-action="open" data-path="${esc(path)}" data-note-btn>${icon("pen")}<span class="bg-mono">Заметка</span></button>`;

// Блок со случайной заметкой книги для больших карточек. Если заметка ещё не прочитана,
// показывается свойство «Цитата», а ui.js потом подменяет текст (см. fill).
function bigQuote(b, caption) {
    const r = Notes.peek(b);
    const text = r ? r.quote : b.quote;
    if (!text && !b.noteList.length) return "";
    const comment = r ? r.comment : "";
    const reroll = b.noteList.length > 1
        ? `<button class="bg-reroll" type="button" data-action="reroll" data-path="${esc(b.path)}" title="Показать другую заметку" aria-label="Показать другую заметку">${icon("reset")}</button>`
        : "";
    return `<div class="bg-quote bg-quote--big" data-book="${esc(b.path)}">
        <div class="bg-quote-cap bg-mono">${icon("quote")}<span>${esc(caption)}</span>${reroll}</div>
        <div class="bg-quote-text">${text ? esc(quoteText(text)) : "…"}</div>
        <div class="bg-note-comment"${comment ? "" : " hidden"}>${icon("pen")}<span>${esc(comment)}</span></div>
    </div>`;
}

// Подставить прочитанную заметку в уже отрисованный элемент
function fill(el, r) {
    const set = (sel, text) => {
        const node = el.querySelector(sel);
        if (node) node.textContent = text;
    };
    if (el.dataset.role === "insight") {
        set(".bg-insight-text", quoteText(r.quote));
        const link = el.querySelector(".bg-insight-link");
        if (link) {
            link.dataset.path = r.note.path;
            link.lastChild.textContent = `[[${r.note.name}]]`;
        }
        return;
    }
    set(".bg-quote-text", quoteText(r.quote));
    const comment = el.querySelector(".bg-note-comment");
    if (comment) {
        comment.hidden = !r.comment;
        const span = comment.querySelector("span");
        if (span) span.textContent = r.comment;
    }
    const btn = el.closest("article") && el.closest("article").querySelector("[data-note-btn]");
    if (btn) btn.dataset.path = r.note.path;
}

const notesLabel = (n) => `${n} ${ctx.lib.utils.plural(n, ["заметка", "заметки", "заметок"])}`;

// Подвал обычной карточки: «12 заметок · Финал 10/10»
function statsRow(b) {
    const parts = [];
    if (b.notes) parts.push(`<span>${esc(notesLabel(b.notes))}</span>`);
    if (b.label) parts.push(`<span class="bg-label-text">${esc(b.label)}</span>`);
    if (!parts.length) return "";
    return `<div class="bg-card-stats bg-mono">${parts.join('<i class="bg-dot">·</i>')}</div>`;
}

function standard(b) {
    return `
<article class="bg-card" ${openAttrs(b)}>
    ${coverHtml(b)}
    <div class="bg-card-body">
        <div class="bg-card-meta">
            <span class="bg-genre bg-mono">${b.genre ? icon("book") + esc(b.genre) : ""}</span>
            <span class="bg-date bg-mono">${esc(b.dateText)}</span>
        </div>
        <div class="bg-card-title">${esc(b.title)}</div>
        <div class="bg-card-author">${esc(b.authorText || "Неизвестен")}</div>
        ${quoteBox(b)}
        ${statsRow(b)}
    </div>
    ${noteBtn(b)}
</article>`;
}

function featured(b) {
    const meta = [
        b.genre ? `<div><div class="bg-meta-k bg-mono">Жанр</div><div class="bg-meta-v">${esc(b.genre)}</div></div>` : "",
        b.notes ? `<div><div class="bg-meta-k bg-mono">Заметки</div><div class="bg-meta-v bg-meta-v--accent bg-mono">${esc(notesLabel(b.notes))}</div></div>` : "",
        b.time ? `<div><div class="bg-meta-k bg-mono">Время</div><div class="bg-meta-v bg-mono">${esc(b.time)}</div></div>` : "",
    ].join("");
    const tags = b.tags.slice(0, 4).map((t) => `<span class="bg-tag-plain bg-mono">${esc(t)}</span>`).join("");

    return `
<article class="bg-card bg-card--featured" ${openAttrs(b)}>
    ${coverHtml(b, { tag: false })}
    <div class="bg-card-body">
        <div class="bg-card-meta">
            <span class="bg-badge bg-badge--accent bg-mono">${icon("badge")}${esc(cfg.featuredLabel)}</span>
            <span class="bg-date bg-mono">${esc(b.dateText)}</span>
        </div>
        <div class="bg-card-title bg-card-title--lg">${esc(b.title)}</div>
        <div class="bg-card-author">${esc(b.authorText || "Неизвестен")}</div>
        ${bigQuote(b, "Из заметок")}
        ${meta ? `<div class="bg-meta">${meta}</div>` : ""}
        <div class="bg-card-foot">
            <div class="bg-tags-plain">${tags}</div>
            ${noteBtn(b, " bg-note-btn--accent", (Notes.peek(b) || {}).note ? Notes.peek(b).note.path : b.path)}
        </div>
    </div>
</article>`;
}

function low(b) {
    return `
<article class="bg-card bg-card--low" ${openAttrs(b)}>
    ${coverHtml(b, { tag: false, overlay: `<span class="bg-cover-flag bg-mono">${esc(cfg.lowLabel)}</span>` })}
    <div class="bg-card-body">
        <div class="bg-card-meta">
            <span class="bg-badge bg-badge--danger bg-mono">${icon("alert")}${esc(cfg.lowLabel)}</span>
            <span class="bg-date bg-mono">${esc(b.dateText)}</span>
        </div>
        <div class="bg-card-title bg-card-title--lg">${esc(b.title)}</div>
        <div class="bg-card-author">${esc(b.authorText || "Неизвестен")}</div>
        ${bigQuote(b, "Из заметок")}
        <div class="bg-card-foot">
            <span class="bg-label-text bg-label-text--danger bg-mono">${esc(b.label || b.genre)}</span>
            ${noteBtn(b, "", (Notes.peek(b) || {}).note ? Notes.peek(b).note.path : b.path)}
        </div>
    </div>
</article>`;
}

// Главная карточка: лучшая по оценке книга выборки (при равенстве — самая свежая)
function pickFeatured(list) {
    if (!cfg.featured) return null;
    const best = list
        .filter((b) => b.score5 !== null && b.score5 >= cfg.featuredMinScore)
        .sort((a, b) => b.score5 - a.score5 || b.dateMs - a.dateMs)[0];
    return best || null;
}

function grid(list) {
    if (!list.length) return `<div class="bg-empty">По этим фильтрам ничего не найдено</div>`;
    const top = pickFeatured(list);
    const ordered = top ? [top, ...list.filter((b) => b !== top)] : list;
    const html = ordered
        .map((b) => (b === top ? featured(b) : b.score5 !== null && b.score5 < cfg.lowScore ? low(b) : standard(b)))
        .join("");
    return `<div class="bg-grid">${html}</div>`;
}

return { grid, pickFeatured, quoteText, fill };
