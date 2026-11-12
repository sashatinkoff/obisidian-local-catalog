// src/notes.js — тексты для карточек: заметки-цитаты, свойства книги и отрывки.
//
// Источники текста по приоритету:
//   1. случайная заметка-цитата книги (файл со свойством `Источник` или ссылка из свойства `Заметки`);
//   2. свойство книги `Цитата`;
//   3. отрывок из текста самой заметки книги (первые абзацы без служебной разметки).
// Файлы читаются заранее (preload) ограниченным числом потоков, чтобы раскладка знала, сколько
// текста у каждой книги: книги с небольшим текстом не получают большую карточку.

const { cfg, app } = ctx;
const U = ctx.lib.utils;

const booksByPath = new Map();  // путь книги -> книга
const parsedCache = new Map();  // путь заметки -> Promise<{ quote, comment } | null>
const picked = new Map();       // путь книги -> { note, quote, comment }
const excerpts = new Map();     // путь книги -> текст отрывка ("" — отрывка нет)

const stripLink = (s) => String(s).replace(/^\[\[|\]\]$/g, "").split("|")[0].split("#")[0].trim();
const normalPath = (s) => String(s || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").normalize("NFC");
const keyOf = (s) => normalPath(s).replace(/\.md$/i, "").toLocaleLowerCase("ru-RU");
const baseName = (s) => keyOf(s).split("/").pop();
const notesFolderPath = () => normalPath(U.normFolder(cfg.notesFolder) || U.normFolder(cfg.folder));
const inNotesFolder = (path) => {
    const folder = notesFolderPath();
    const p = normalPath(path);
    return !!folder && (p === folder || p.startsWith(folder + "/"));
};

// ---------- индекс: какие заметки относятся к каким книгам ----------
function buildIndex(books) {
    booksByPath.clear();
    picked.clear();
    const lookup = new Map();
    books.forEach((b) => {
        booksByPath.set(b.path, b);
        [b.title, b.titleKey, b.fileKey, b.path, keyOf(b.path), baseName(b.path)].forEach((k) => {
            if (k) lookup.set(keyOf(k), b);
        });
    });

    const index = new Map(books.map((b) => [b.path, new Map()]));
    const add = (b, path, name) => {
        if (path !== b.path) index.get(b.path).set(path, { path, name: name || baseName(path) });
    };

    // Папка заметок-цитат задаётся отдельно. Если она не указана, ищем цитаты
    // только внутри папки книг, а не по всему хранилищу.
    const notesFolder = notesFolderPath();
    const notesPrefix = notesFolder ? notesFolder + "/" : "";

    // 1. ссылки из свойства книги «Заметки», но только в разрешённой папке заметок
    books.forEach((b) => b.noteLinks.forEach((path) => {
        if (inNotesFolder(path)) add(b, path);
    }));

    // 2. заметки с полем «Источник», указывающим на книгу
    try {
        if (notesPrefix) for (const file of app.vault.getMarkdownFiles()) {
            if (booksByPath.has(file.path) || !inNotesFolder(file.path)) continue;
            const cache = app.metadataCache.getFileCache(file);
            const fm = cache && cache.frontmatter;
            const sourceValue = U.prop(fm, cfg.sourceField);
            if (!sourceValue) continue;
            U.toArray(sourceValue).forEach((s) => {
                const raw = stripLink(s);
                if (!raw) return;
                let b = lookup.get(keyOf(raw)) || lookup.get(baseName(raw));
                if (!b) {
                    const dest = app.metadataCache.getFirstLinkpathDest(raw, file.path);
                    if (dest) b = booksByPath.get(dest.path) || books.find((book) => keyOf(book.path) === keyOf(dest.path));
                }
                if (b) add(b, file.path, file.basename);
            });
        }
    } catch (e) {
        console.warn("book-gallery: не удалось собрать заметки-цитаты", e);
    }

    books.forEach((b) => {
        b.noteList = [...index.get(b.path).values()];
        b.notes = b.notesNum ?? (b.noteList.length || b.inlinks);
    });
}

// ---------- разбор текста ----------
function clean(s) {
    return String(s)
        .replace(/\[![^\]]+\][+-]?/g, "")
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
        .replace(/\[\[([^\]]+)\]\]/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/(\*\*|__|==|~~)/g, "")
        .replace(/^\s*>+\s?/gm, "")
        .replace(/\s+/g, " ")
        .trim();
}

const LABEL = /^(#{1,6}\s*)?(note|quote|notes|цитата|заметка|заметки)\s*:?\s*$/i;

// Заметка-цитата: первая строка-метка отбрасывается, первый абзац — цитата, остальное — комментарий
function parse(raw) {
    const text = String(raw).replace(/^\uFEFF/, "").replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, "");
    const lines = text.split(/\r?\n/);
    while (lines.length && !lines[0].trim()) lines.shift();

    // callout: «> [!quote]» — цитата внутри блока, остальное — комментарий
    if (lines.length && /^>\s*\[![^\]]+\]/.test(lines[0])) {
        let i = 1;
        const inner = [];
        while (i < lines.length && /^>/.test(lines[i])) inner.push(lines[i++]);
        const quote = clean(inner.map((l) => l.replace(/^>+\s?/, "")).join(" "));
        return quote ? { quote, comment: clean(lines.slice(i).join(" ")) } : null;
    }

    while (lines.length && LABEL.test(lines[0].trim())) lines.shift();
    const body = lines.join("\n").trim();
    if (!body) return null;

    let blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    if (blocks.length === 1) blocks = body.split("\n").map((b) => b.trim()).filter(Boolean);
    const quote = clean(blocks[0]);
    return quote ? { quote, comment: clean(blocks.slice(1).join(" ")) } : null;
}

// Отрывок из заметки книги: первые «живые» абзацы без заголовков, таблиц, встраиваний и кода
function parseExcerpt(raw, max) {
    let t = String(raw).replace(/^\uFEFF/, "").replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, "");
    t = t
        .replace(/```[\s\S]*?```/g, "")
        .replace(/~~~[\s\S]*?~~~/g, "")
        .replace(/%%[\s\S]*?%%/g, "")
        .replace(/<!--[\s\S]*?-->/g, "");

    const parts = [];
    let len = 0;
    for (const block of t.split(/\n\s*\n/)) {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (!lines.length) continue;
        if (/^(#{1,6}\s|\||!\[|<|>|-{3,}$|\*{3,}$|\^|\$\$)/.test(lines[0])) continue; // заголовки, таблицы, встраивания, callout и цитаты — не проза книги
        const text = clean(
            lines
                .join(" ")
                .replace(/!\[\[[^\]]*\]\]/g, "")
                .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
                .replace(/(^|\s)#[\p{L}\d_/-]+/gu, " ")
        );
        if (text.length < 25) continue;
        parts.push(text);
        len += text.length;
        if (len >= max) break;
    }
    const joined = parts.join(" ");
    if (!joined) return "";
    return joined.length > max ? joined.slice(0, max).replace(/\s+\S*$/, "") + "…" : joined;
}

async function readFile(path) {
    try {
        const file = app.vault.getAbstractFileByPath(path);
        return file ? await app.vault.cachedRead(file) : null;
    } catch (e) {
        return null;
    }
}

async function readNote(note) {
    if (parsedCache.has(note.path)) return parsedCache.get(note.path);
    // Кэшируем сразу Promise: предварительная загрузка и карточки инсайтов
    // могут запросить один файл одновременно, но сам файл читается один раз.
    const pending = (async () => {
        const raw = await readFile(note.path);
        return raw === null ? null : parse(raw);
    })();
    parsedCache.set(note.path, pending);
    return pending;
}

async function loadExcerpt(book) {
    if (excerpts.has(book.path)) return excerpts.get(book.path);
    const raw = cfg.showExcerpt ? await readFile(book.path) : null;
    const text = raw === null ? "" : parseExcerpt(raw, cfg.excerptChars || 420);
    excerpts.set(book.path, text);
    return text;
}

// ---------- случайный выбор ----------
const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

// Выбрать случайную заметку; fresh — выбрать другую, чем сейчас
async function pick(book, fresh) {
    if (!book.noteList.length) return null;
    if (!fresh && picked.has(book.path)) return picked.get(book.path);

    const current = picked.get(book.path);
    const pool = shuffle([...book.noteList]);
    const order = fresh && current ? [...pool.filter((n) => n.path !== current.note.path), ...pool.filter((n) => n.path === current.note.path)] : pool;

    for (const note of order) {
        const parsed = await readNote(note);
        if (parsed && parsed.quote) {
            const result = { note, quote: parsed.quote, comment: parsed.comment };
            picked.set(book.path, result);
            return result;
        }
    }
    return null;
}

// Текст только из заметки-цитаты, найденной в cfg.notesFolder (или в папке книг,
// если отдельная папка заметок-цитат не задана). Не использует свойства книги и отрывки.
function noteContent(book) {
    const r = book && picked.get(book.path);
    return r ? { quote: r.quote, comment: r.comment, path: r.note.path, name: r.note.name, source: "note" } : null;
}

// Лучший из доступных текстов для обычных карточек: заметка, свойство или отрывок.
function content(book) {
    const note = noteContent(book);
    if (note) return note;
    if (book.quote) return { quote: book.quote, comment: "", path: book.path, name: book.title, source: "property" };
    const ex = excerpts.get(book.path);
    if (ex) return { quote: ex, comment: "", path: book.path, name: book.title, source: "excerpt" };
    return null;
}

// Сколько текста у книги: от этого зависит, можно ли дать ей большую карточку
const textLength = (book) => {
    const c = content(book);
    return c ? c.quote.length + (c.comment || "").length : 0;
};

// Все читаемые заметки конкретной книги строго внутри папки заметок-цитат.
// Возвращаем полный список, чтобы инсайт мог независимо выбрать одну из них,
// не используя случайную заметку, предварительно выбранную обычной карточкой.
function sourceMatchesBook(value, book, notePath) {
    const raw = stripLink(value);
    if (!raw) return false;

    const candidates = [book.title, book.titleKey, book.fileKey, book.path, keyOf(book.path), baseName(book.path)];
    const sourceKey = keyOf(raw);
    if (candidates.some((candidate) => candidate && keyOf(candidate) === sourceKey) ||
        candidates.some((candidate) => candidate && baseName(candidate) === baseName(raw))) return true;

    try {
        const dest = app.metadataCache.getFirstLinkpathDest(raw, notePath);
        return !!dest && keyOf(dest.path) === keyOf(book.path);
    } catch (e) {
        return false;
    }
}

// Для инсайтов строим независимый список заметок прямо из разрешённой папки.
// Не полагаемся на book.noteList: это предварительный индекс обычных карточек,
// который может оказаться неполным, если Obsidian ещё не разрешил ссылку/метаданные.
async function insightNotes(book) {
    if (!book) return [];

    const byPath = new Map();
    const add = (path, name) => {
        const normalized = normalPath(path);
        if (!normalized || normalized === normalPath(book.path) || !inNotesFolder(normalized)) return;
        if (!byPath.has(normalized)) byPath.set(normalized, { path: normalized, name: name || baseName(normalized) });
    };

    // Явные ссылки из свойства «Заметки» и уже собранного индекса.
    (book.noteLinks || []).forEach((path) => add(path));
    (book.noteList || []).forEach((note) => note && add(note.path, note.name));

    // Полный повторный поиск: все заметки в папке цитат, связанные через «Источник».
    try {
        for (const file of app.vault.getMarkdownFiles()) {
            if (!file || !inNotesFolder(file.path) || normalPath(file.path) === normalPath(book.path)) continue;
            const cache = app.metadataCache.getFileCache(file);
            const fm = cache && cache.frontmatter;
            const sourceValue = U.prop(fm, cfg.sourceField);
            if (!sourceValue) continue;
            if (U.toArray(sourceValue).some((value) => sourceMatchesBook(value, book, file.path))) {
                add(file.path, file.basename);
            }
        }
    } catch (e) {
        console.warn("book-gallery: не удалось повторно просканировать заметки для инсайта", e);
    }

    const parsed = await Promise.all([...byPath.values()].map(async (note) => {
        const value = await readNote(note);
        return value && value.quote
            ? { note, quote: value.quote, comment: value.comment, path: note.path, name: note.name, source: "note" }
            : null;
    }));
    return parsed.filter(Boolean);
}

// Совместимость с вызывающим кодом старых сборок.
async function ensureNote(book) {
    const available = await insightNotes(book);
    if (!available.length) return null;
    const result = available[Math.floor(Math.random() * available.length)];
    picked.set(book.path, { note: result.note, quote: result.quote, comment: result.comment });
    return result;
}

// Прочитать всё нужное для обычной карточки книги
async function ensure(book) {
    if (book.noteList.length && !picked.has(book.path)) await pick(book, false);
    if (!content(book)) await loadExcerpt(book);
}

// Заранее прочитать тексты всех книг (до 8 файлов одновременно), но не дольше budgetMs
async function preload(books, budgetMs) {
    const work = books.filter((b) => b.noteList.length || (!b.quote && cfg.showExcerpt));
    let next = 0;
    const worker = async () => {
        while (next < work.length) {
            const book = work[next++];
            try {
                await ensure(book);
            } catch (e) {
                /* пропускаем книгу */
            }
        }
    };
    const all = Promise.all(Array.from({ length: Math.min(8, work.length) }, worker));
    await Promise.race([all, new Promise((resolve) => setTimeout(resolve, budgetMs || 2500))]);
}

// Дочитать недостающие тексты для уже отрисованных элементов с data-book и вызвать fill(элемент, текст)
async function hydrate(root, fill) {
    // Инсайты уже содержат конкретную заметку, независимо выбранную Stats.insights().
    // Нельзя перезаписывать её обычной заметкой из picked-кэша книги.
    const nodes = [...root.querySelectorAll("[data-book]")].filter((el) => el.dataset.role !== "insight");
    await Promise.all(
        nodes.map(async (el) => {
            const book = booksByPath.get(el.dataset.book);
            if (!book) return;
            await ensure(book);
            const c = content(book);
            if (c && root.contains(el)) fill(el, c);
        })
    );
}

async function reroll(bookPath) {
    const book = booksByPath.get(bookPath);
    return book ? pick(book, true) : null;
}

module.exports = { buildIndex, parse, parseExcerpt, content, noteContent, textLength, pick, insightNotes, ensureNote, ensure, preload, hydrate, reroll };
