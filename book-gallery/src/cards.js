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
        return; // подпись под инсайтом — книга и автор, она не меняется
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

// Вертикальная карточка. Высота зависит от содержимого: пропорции обложки (ratio — высота к ширине)
// и объёма текста. big — «большой» вариант: полная цитата с комментарием вместо короткого фрагмента
function tall(b, kind, opts) {
    const o = opts || {};
    const flag = kind === "low" ? `<span class="bg-cover-flag bg-mono">${esc(cfg.lowLabel)}</span>` : "";
    return `
<article class="bg-card bg-card--tall${o.big ? " bg-card--big" : ""}${kindClass(kind)}" style="--ratio:${o.ratio || 1.5}" ${openAttrs(b.path)}>
    ${coverHtml(b, { overlay: flag })}
    <div class="bg-card-body">
        <div class="bg-card-meta">
            ${genreHtml(b)}
            <span class="bg-date bg-mono">${esc(b.dateText)}</span>
        </div>
        <div class="bg-card-title">${esc(b.title)}</div>
        <div class="bg-card-author">${esc(b.authorText || "Неизвестен")}</div>
        ${o.big ? bigQuote(b) : snippet(b)}
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
<article class="bg-card bg-card--wide${kindClass(kind)}" ${openAttrs(b.path)}>
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

// Главная карточка: лучшая по оценке книга выборки с достаточным текстом.
// При равной оценке побеждает книга с большим числом заметок, затем самая свежая
function pickFeatured(list) {
    if (!cfg.featured) return null;
    return (
        list
            .filter((b) => isEligible(b) && b.score5 !== null && b.score5 >= cfg.featuredMinScore)
            .sort((a, b) => b.score5 - a.score5 || (b.notes || 0) - (a.notes || 0) || b.dateMs - a.dateMs)[0] || null
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

// ---------- раскладка: staggered grid ----------
// Колонки одинаковой ширины, карточки разной высоты. Сетка — CSS Grid с мелкими строками (UNIT px):
// высота каждой карточки измеряется, и она занимает столько строк, сколько ей нужно (grid-row-end: span N).
// Режим dense кладёт каждую следующую карточку в самое высокое свободное место, то есть в самую низкую колонку.
// Широкие карточки занимают две колонки и встречаются реже (wideShare).
const NOMINAL_W = 300;  // ширина колонки, на которую рассчитана оценка высоты до измерения
const UNIT = 4;         // высота строки сетки, px
const GAP = 16;
const RATIOS = [1.3, 1.5, 1.7]; // пропорции обложек (высота к ширине): их чередование даёт «ступеньки»

const hashOf = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
};

// Примерная высота карточки в пикселях — для первой отрисовки, до измерения
function estimate(t) {
    if (t.wide) return t.kind === "featured" ? 440 : 340;
    const c = Notes.content(t.b);
    const chars = c ? c.quote.length : 0;
    const cover = NOMINAL_W * t.ratio;
    const titleLines = Math.min(2, Math.ceil(t.b.title.length / 22));
    let text = 0;
    if (t.big && c) text = 44 + Math.min(7, Math.ceil(chars / 34)) * 21 + (c.comment ? 44 : 0);
    else if (c) text = 22 + Math.min(3, Math.ceil(chars / 34)) * 19;
    const stats = t.b.notes || t.b.label ? 40 : 0;
    return 28 + cover + 14 + 18 + titleLines * 22 + 20 + (text ? text + 14 : 0) + stats + 14;
}

const spanFor = (h, gap) => Math.max(1, Math.ceil((h + gap) / UNIT));

// Какие книги получают широкую карточку (кроме «Книги года»): «Разочарование» и лучшие по оценке из книг
// с достаточным текстом, но не больше wideShare от списка, не ближе MIN_GAP позиций друг к другу и не в самом хвосте
const MIN_GAP = 5;
function pickWide(list, top, cols) {
    const wide = new Set();
    const share = Math.max(0, Math.min(1, Number(cfg.wideShare) || 0));
    const target = Math.floor(list.length * share);
    if (!target) return wide;
    const index = new Map(list.map((b, i) => [b, i]));
    const taken = [];
    const candidates = list
        // в конце списка широкая карточка оставила бы дыру рядом с собой: заполнять её уже нечем
        .filter((b) => b !== top && isEligible(b) && index.get(b) < list.length - (cols + 2))
        .sort((a, b) => (isLow(b) ? 1 : 0) - (isLow(a) ? 1 : 0) || (b.score5 ?? -1) - (a.score5 ?? -1) || Notes.textLength(b) - Notes.textLength(a));
    for (const b of candidates) {
        if (wide.size >= target) break;
        const i = index.get(b);
        if (taken.some((j) => Math.abs(i - j) < MIN_GAP)) continue; // широкие карточки не идут подряд
        wide.add(b);
        taken.push(i);
    }
    return wide;
}

function grid(list, cols) {
    if (!list.length) return `<div class="bg-empty">По этим фильтрам ничего не найдено</div>`;
    const c = Math.max(2, cols || 4);

    const top = pickFeatured(list);
    const wides = pickWide(list, top, c);
    const big = pickBig(list, top);
    // главная карточка первая, остальные — в порядке сортировки
    const ordered = top ? [top, ...list.filter((b) => b !== top)] : list;

    const html = ordered
        .map((b, index) => {
            const kind = b === top ? "featured" : isLow(b) ? "low" : "normal";
            const isWide = b === top || wides.has(b);
            const isBig = !isWide && big.has(b) && isEligible(b);
            // большая карточка получает более короткую обложку: на текст остаётся больше места
            const ratio = isBig ? 1.2 : RATIOS[hashOf(b.path) % RATIOS.length];
            const t = { b, kind, wide: isWide, big: isBig, ratio, index };
            const card = isWide ? wide(b, kind) : tall(b, kind, t);
            // стартовая высота по оценке; после вставки в страницу relayout() заменит её измеренной
            const span = `grid-row-end:span ${spanFor(estimate(t), GAP)}`;
            return card.includes(' style="') ? card.replace(' style="', ` style="${span};`) : card.replace("<article ", `<article style="${span}" `);
        })
        .join("");
    return `<div class="bg-stagger" style="--cols:${c}">${html}</div>`;
}

// Подогнать сетку под реальные высоты карточек: вызывается после вставки HTML, после дочитывания текстов
// и при изменении ширины блока. Меняет только grid-row-end (и только если значение изменилось).
// Затем закрывает щели рядом с широкими карточками: рядом с широкой карточкой колонки могут оказаться
// разной высоты, и в более низкой остаётся пустое место. Карточка над ним растягивается (растёт обложка).
function relayout(root) {
    const st = root && root.querySelector(".bg-stagger");
    if (!st || !st.offsetWidth) return;
    const gap = parseFloat(getComputedStyle(st).columnGap) || GAP;
    const cards = [...st.children];

    // растяжения прошлой раскладки сбрасываем: измерять надо естественную высоту
    cards.forEach((card) => {
        if (card.dataset.stretch) {
            card.style.height = "";
            card.classList.remove("is-stretched");
            delete card.dataset.stretch;
        }
    });

    cards.forEach((c) => c.classList.remove("is-solo"));

    const setSpans = (list) => {
        // сначала читаем все высоты, потом пишем: без перемешивания чтения и записи браузер не пересчитывает раскладку на каждой карточке
        const heights = list.map((card) => card.getBoundingClientRect().height);
        list.forEach((card, i) => {
            const value = `span ${spanFor(heights[i], gap)}`;
            if (card.style.gridRowEnd !== value) card.style.gridRowEnd = value;
        });
    };
    setSpans(cards);

    const wides = cards.filter((c) => c.classList.contains("bg-card--wide"));
    if (!wides.length) return;

    const stretchPass = () => {
        // После растяжения сетка перестраивается, поэтому щели ищем заново — несколько проходов
        for (let pass = 0; pass < 4; pass++) {
            const rects = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
            const stretched = new Map();
            for (const w of wides) {
                if (w.classList.contains("is-solo")) continue;
                const wr = rects.get(w);
                const above = new Map();
                for (const a of cards) {
                    if (a === w) continue;
                    const ar = rects.get(a);
                    if (ar.left < wr.left - 1 || ar.right > wr.right + 1 || ar.bottom > wr.top + 1) continue;
                    const key = Math.round(ar.left);
                    if (!above.has(key) || ar.bottom > rects.get(above.get(key)).bottom) above.set(key, a);
                }
                for (const a of above.values()) {
                    const hole = wr.top - rects.get(a).bottom - gap;
                    if (hole > 6) stretched.set(a, Math.max(stretched.get(a) || 0, hole));
                }
            }
            if (!stretched.size) break;
            for (const [a, hole] of stretched) {
                a.style.height = `${rects.get(a).height + hole}px`;
                a.classList.add("is-stretched");
                a.dataset.stretch = "1";
            }
            setSpans([...stretched.keys()]);
        }
    };

    // Остаточные дыры по колонкам: широкая карточка, над которой они остались, становится обычной одноколоночной
    const holeWides = () => {
        const rects = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
        const top = st.getBoundingClientRect().top;
        const bad = new Set();
        const xs = [...new Set([...rects.values()].map((r) => Math.round(r.left)))];
        for (const x of xs) {
            const col = cards.filter((c) => { const r = rects.get(c); return r.left - 1 <= x && r.right + 1 >= x + 10; })
                .sort((a, b) => rects.get(a).top - rects.get(b).top);
            let prev = top;
            for (const c of col) {
                const r = rects.get(c);
                if (r.top - prev > 60 && c.classList.contains("bg-card--wide")) bad.add(c);
                prev = Math.max(prev, r.bottom);
            }
        }
        return [...bad];
    };

    stretchPass();
    for (let round = 0; round < 6; round++) {
        const bad = holeWides();
        if (!bad.length) break;
        bad.forEach((c) => c.classList.add("is-solo"));
        cards.forEach((card) => {
            if (card.dataset.stretch) { card.style.height = ""; card.classList.remove("is-stretched"); delete card.dataset.stretch; }
        });
        setSpans(cards);
        stretchPass();
    }
}

module.exports = { grid, relayout, pickFeatured, quoteText, fill };
