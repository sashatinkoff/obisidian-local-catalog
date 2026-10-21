// lib/cards.js — бенто-сетка карточек.
//
// Сетка собирается полосами одинаковой высоты. Карточка занимает 1 колонку (вертикальная) или 2
// (горизонтальная: обложка слева, справа текст и заметка). Полосы заполняются точно, без пустот и без
// растягивания карточек: раскладку подбирает небольшой динамический расчёт (см. plan).
// Большую карточку получает только книга, у которой достаточно текста (bigMinChars).
// Без обработчиков: клики ловит ui.js по атрибутам data-action.

const { cfg } = ctx;
const { esc, cssUrl, plural } = ctx.lib.utils;
const { icon } = ctx.lib.icons;
const Notes = ctx.lib.notes;
const Thumbs = ctx.lib.thumbs;

// «текст» -> «текст» в ёлочках, без двойных кавычек
const quoteText = (q) => `«${String(q).replace(/^[«"“”\s]+|[»"“”\s]+$/g, "")}»`;

// Цитаты выводятся в ёлочках, отрывок из заметки книги — обычным текстом
const showText = (c) => (c.source === "excerpt" ? c.quote : quoteText(c.quote));
const captionOf = (c) => (c.source === "excerpt" ? "О книге" : c.source === "property" ? "Цитата" : "Из заметок");

const openAttrs = (path) => `data-action="open" data-path="${esc(path)}"`;

const scoreBadge = (b) =>
    b.scoreText ? `<span class="bg-score bg-mono">${b.scoreText}${icon("star", "bg-ico--fill bg-star")}</span>` : "";

const notesLabel = (n) => `${n} ${plural(n, ["заметка", "заметки", "заметок"])}`;

const placeholder = (b) => `
    <div class="bg-ph">
        ${icon("book")}
        <div class="bg-ph-title">${esc(b.title)}</div>
        <div class="bg-ph-author">${esc(b.authors[0] || "")}</div>
    </div>`;

// Обложка с рейтингом и первым тегом
function coverHtml(b, { tag = true, overlay = "" } = {}) {
    const media = b.cover ? Thumbs.imgTag(b.cover, "bg-cover-img") : placeholder(b);
    const chip = tag && b.tags[0] ? `<span class="bg-cover-tag bg-mono">${esc(b.tags[0])}</span>` : "";
    return `<div class="bg-cover${b.cover ? "" : " bg-cover--empty"}">${media}${scoreBadge(b)}${chip}${overlay}</div>`;
}

const genreHtml = (b) =>
    b.genre ? `<span class="bg-genre bg-mono">${icon("book")}<span class="bg-ellipsis">${esc(b.genre)}</span></span>` : `<span></span>`;

// Подвал обычной карточки: «12 заметок · Финал 10/10»
function statsRow(b) {
    const parts = [];
    if (b.notes) parts.push(`<span>${esc(notesLabel(b.notes))}</span>`);
    if (b.label) parts.push(`<span class="bg-label-text">${esc(b.label)}</span>`);
    if (!parts.length) return "";
    return `<div class="bg-card-stats bg-mono">${parts.join('<i class="bg-dot">·</i>')}</div>`;
}

// ---------- тексты в карточках ----------
// Небольшой фрагмент текста в узкой карточке. Клик открывает показанную заметку (или книгу)
function snippet(b) {
    const c = Notes.content(b);
    if (!c) return "";
    return `<div class="bg-snippet" data-book="${esc(b.path)}" ${openAttrs(c.path)}><div class="bg-quote-text">${esc(showText(c))}</div></div>`;
}

// Блок с заметкой в широкой карточке: цитата, ваш комментарий и кнопка «другая заметка»
function bigQuote(b) {
    const c = Notes.content(b);
    if (!c) return "";
    const reroll = b.noteList.length > 1
        ? `<button class="bg-reroll" type="button" data-action="reroll" data-path="${esc(b.path)}" title="Показать другую заметку" aria-label="Показать другую заметку">${icon("reset")}</button>`
        : "";
    return `<div class="bg-quote bg-quote--big" data-book="${esc(b.path)}" ${openAttrs(c.path)}>
        <div class="bg-quote-cap bg-mono">${icon("quote")}<span class="bg-cap-text">${esc(captionOf(c))}</span>${reroll}</div>
        <div class="bg-quote-text">${esc(showText(c))}</div>
        <div class="bg-note-comment"${c.comment ? "" : " hidden"}>${icon("pen")}<span>${esc(c.comment || "")}</span></div>
    </div>`;
}

// Подставить прочитанный текст в уже отрисованный элемент (вызывает ui.js после дочитывания файлов)
function fill(el, c) {
    const set = (sel, text) => {
        const node = el.querySelector(sel);
        if (node && node.textContent !== text) node.textContent = text;
    };
    if (el.dataset.role === "insight") {
        set(".bg-insight-text", showText(c));
        const link = el.querySelector(".bg-insight-link");
        if (link) {
            link.dataset.path = c.path;
            link.lastChild.textContent = c.name;
        }
        return;
    }
    set(".bg-quote-text", showText(c));
    set(".bg-cap-text", captionOf(c));
    el.dataset.path = c.path;
    const comment = el.querySelector(".bg-note-comment");
    if (comment) {
        comment.hidden = !c.comment;
        const span = comment.querySelector("span");
        if (span && span.textContent !== (c.comment || "")) span.textContent = c.comment || "";
    }
}

// ---------- два варианта вёрстки ----------
const kindClass = (kind) => (kind === "featured" ? " bg-card--featured" : kind === "low" ? " bg-card--low" : "");

// Узкая вертикальная карточка: обложка забирает всё свободное место
function tall(b, kind) {
    const flag = kind === "low" ? `<span class="bg-cover-flag bg-mono">${esc(cfg.lowLabel)}</span>` : "";
    return `
<article class="bg-card bg-card--tall${kindClass(kind)}" style="--span:1" ${openAttrs(b.path)}>
    ${coverHtml(b, { overlay: flag })}
    <div class="bg-card-body">
        <div class="bg-card-meta">
            ${genreHtml(b)}
            <span class="bg-date bg-mono">${esc(b.dateText)}</span>
        </div>
        <div class="bg-card-title">${esc(b.title)}</div>
        <div class="bg-card-author">${esc(b.authorText || "Неизвестен")}</div>
        ${snippet(b)}
        ${statsRow(b)}
    </div>
</article>`;
}

// Широкая горизонтальная карточка: обложка слева, справа текст и случайная заметка
function wide(b, kind) {
    const head =
        kind === "featured"
            ? `<span class="bg-badge bg-badge--accent bg-mono">${icon("badge")}${esc(cfg.featuredLabel)}</span>`
            : kind === "low"
              ? `<span class="bg-badge bg-badge--danger bg-mono">${icon("alert")}${esc(cfg.lowLabel)}</span>`
              : genreHtml(b);

    const meta = [
        kind === "featured" && b.genre ? `<div><div class="bg-meta-k bg-mono">Жанр</div><div class="bg-meta-v">${esc(b.genre)}</div></div>` : "",
        b.notes ? `<div><div class="bg-meta-k bg-mono">Заметки</div><div class="bg-meta-v bg-meta-v--accent bg-mono">${esc(notesLabel(b.notes))}</div></div>` : "",
        b.time ? `<div><div class="bg-meta-k bg-mono">Время</div><div class="bg-meta-v bg-mono">${esc(b.time)}</div></div>` : "",
    ].join("");

    const foot =
        kind === "low"
            ? `<span class="bg-label-text bg-label-text--danger bg-mono">${esc(b.label || b.genre)}</span>`
            : `<div class="bg-tags-plain">${b.tags.slice(0, 4).map((t) => `<span class="bg-tag-plain bg-mono">${esc(t)}</span>`).join("")}</div>`;

    return `
<article class="bg-card bg-card--wide${kindClass(kind)}" style="--span:2" ${openAttrs(b.path)}>
    ${coverHtml(b, { tag: false, overlay: kind === "low" ? `<span class="bg-cover-flag bg-mono">${esc(cfg.lowLabel)}</span>` : "" })}
    <div class="bg-card-body">
        <div class="bg-card-meta">
            ${head}
            <span class="bg-date bg-mono">${esc(b.dateText)}</span>
        </div>
        <div class="bg-card-title bg-card-title--lg">${esc(b.title)}</div>
        <div class="bg-card-author">${esc(b.authorText || "Неизвестен")}</div>
        ${bigQuote(b)}
        ${meta ? `<div class="bg-meta">${meta}</div>` : ""}
        <div class="bg-card-foot">${foot}</div>
    </div>
</article>`;
}

// ---------- отбор ----------
// Достаточно ли у книги текста для большой карточки
const isEligible = (b) => Notes.textLength(b) >= cfg.bigMinChars;

const isLow = (b) => b.score5 !== null && b.score5 < cfg.lowScore;

// Главная карточка: лучшая по оценке книга выборки с достаточным текстом (при равенстве — самая свежая)
function pickFeatured(list) {
    if (!cfg.featured) return null;
    return (
        list
            .filter((b) => isEligible(b) && b.score5 !== null && b.score5 >= cfg.featuredMinScore)
            .sort((a, b) => b.score5 - a.score5 || b.dateMs - a.dateMs)[0] || null
    );
}

// Какие книги предпочтительно делать большими: «Книга года», «Разочарование» и лучшие по оценке,
// пока не наберётся доля bigShare. Только из книг с достаточным текстом
function pickBig(list, top) {
    const big = new Set();
    if (top) big.add(top);
    list.filter((b) => isLow(b) && isEligible(b)).forEach((b) => big.add(b));
    const target = Math.round(list.length * Math.max(0, Math.min(1, cfg.bigShare)));
    const rest = list
        .filter((b) => !big.has(b) && isEligible(b))
        .sort((a, b) => (b.score5 ?? -1) - (a.score5 ?? -1) || Notes.textLength(b) - Notes.textLength(a));
    for (const b of rest) {
        if (big.size >= target) break;
        big.add(b);
    }
    return big;
}

// ---------- раскладка ----------
// Разложить карточки по полосам из cols колонок. Для каждой карточки задан набор допустимых ширин
// (allowed) и цена выбора (cost). Динамический расчёт подбирает ширины и небольшие перестановки
// (карточку можно поставить раньше соседних, но не дальше WINDOW-1 позиций) так, чтобы каждая полоса
// заполнилась ровно. Сначала сводится к минимуму пустое место в конце, затем цена выбора и сдвиги.
// Карточки не растягиваются шире двух колонок. locked-карточку (главную) переставлять нельзя.
const WINDOW = 5;
const SHIFT_COST = 0.4;

function plan(items, cols) {
    const n = items.length;
    const memo = new Map();

    // f(i, mask, u): i — первая ещё не размещённая карточка, бит b в mask — карточка i+1+b уже размещена,
    // u — сколько колонок занято в текущей полосе
    function f(i, mask, u) {
        if (i >= n) return { empty: u === 0 ? 0 : cols - u, cost: 0, move: null };
        const key = i * 4096 + mask * 8 + u; // u < 8, mask < 512
        if (memo.has(key)) return memo.get(key);

        let best = null;
        for (let k = 0; k < WINDOW && i + k < n; k++) {
            if (k > 0) {
                if (mask & (1 << (k - 1))) continue; // уже размещена
                if (items[i + k - 1].locked && !(k > 1 && mask & (1 << (k - 2)))) continue;
            }
            // нельзя перепрыгивать через закреплённую (главную) карточку
            let blocked = false;
            for (let t = 0; t < k; t++) {
                const placed = t > 0 && mask & (1 << (t - 1));
                if (!placed && items[i + t].locked) blocked = true;
            }
            if (blocked) continue;

            const item = items[i + k];
            for (const span of item.allowed) {
                if (u + span > cols) continue;
                let ni = i, nm = mask;
                if (k === 0) {
                    ni = i + 1;
                    while (nm & 1) {
                        nm >>= 1;
                        ni++;
                    }
                    nm >>= 1;
                } else {
                    nm = mask | (1 << (k - 1));
                }
                const next = f(ni, nm, (u + span) % cols);
                if (!next) continue;
                const cand = { empty: next.empty, cost: next.cost + item.cost(span) + SHIFT_COST * k, move: { k, span, ni, nm } };
                if (!best || cand.empty < best.empty || (cand.empty === best.empty && cand.cost < best.cost)) best = cand;
            }
        }
        memo.set(key, best);
        return best;
    }

    // Восстановить порядок и ширины по найденным ходам
    const placed = [];
    let i = 0, mask = 0, u = 0;
    for (let guard = 0; guard <= n + 1; guard++) {
        const r = f(i, mask, u);
        if (!r || !r.move) break;
        const { k, span, ni, nm } = r.move;
        placed.push({ item: items[i + k], span });
        u = (u + span) % cols;
        i = ni;
        mask = nm;
    }
    // запасной вариант (не должен понадобиться): всё в одну колонку
    const result = placed.length === n ? placed : items.map((item) => ({ item, span: 1 }));

    const bands = [];
    let band = [];
    let used = 0;
    for (const cell of result) {
        band.push(cell);
        used += cell.span;
        if (used >= cols) {
            bands.push(band);
            band = [];
            used = 0;
        }
    }
    if (band.length) bands.push(band);
    return bands;
}

function grid(list, cols) {
    if (!list.length) return `<div class="bg-empty">По этим фильтрам ничего не найдено</div>`;
    const c = Math.max(2, cols || 4);

    const top = pickFeatured(list);
    const preferred = pickBig(list, top);
    // главная карточка идёт первой, остальные — в порядке сортировки
    const ordered = top ? [top, ...list.filter((b) => b !== top)] : list;

    const items = ordered.map((b) => {
        const kind = b === top ? "featured" : isLow(b) ? "low" : "normal";
        let allowed, cost;
        if (b === top) {
            allowed = [2];
            cost = () => 0;
        } else if (!isEligible(b)) {
            allowed = [1]; // мало текста — большой карточки не будет
            cost = () => 0;
        } else if (preferred.has(b)) {
            allowed = [1, 2];
            cost = (s) => (s === 2 ? 0 : 2);
        } else {
            allowed = [1, 2];
            cost = (s) => (s === 2 ? 1 : 0);
        }
        return { b, kind, allowed, cost, locked: b === top }; // главная карточка всегда первая
    });

    const html = plan(items, c)
        .map((band) => {
            const wideOnly = band.every((x) => x.span >= 2);
            const single = band.length === 1;
            const cards = band.map(({ item, span }) => (span >= 2 ? wide(item.b, item.kind) : tall(item.b, item.kind))).join("");
            return `<div class="bg-band${wideOnly ? " bg-band--wide" : ""}${single ? " bg-band--single" : ""}" style="--cols:${c}">${cards}</div>`;
        })
        .join("");
    return `<div class="bg-bento">${html}</div>`;
}

return { grid, pickFeatured, quoteText, fill, plan };
