// lib/notes.js — заметки и цитаты книги: поиск, чтение файла, случайный выбор.
//
// Заметка-цитата — отдельный файл, у которого в свойстве `Источник` указана книга
// (название или ссылка). Кроме того, заметками считаются ссылки из свойства книги `Заметки`.
// Текст заметки: первая строка-метка («Note», «Цитата») отбрасывается, первый абзац — цитата,
// всё остальное — ваш комментарий. Читаются только файлы, выбранные для показа.

const { cfg, dv, app } = ctx;
const U = ctx.lib.utils;

const booksByPath = new Map();  // путь книги -> книга
const parsedCache = new Map();  // путь заметки -> { quote, comment } | null
const picked = new Map();       // путь книги -> { note, quote, comment }

const stripLink = (s) => String(s).replace(/^\[\[|\]\]$/g, "").split("|")[0].split("#")[0].trim();
const baseName = (s) => String(s).split("/").pop().replace(/\.md$/i, "").toLowerCase();

// ---------- индекс: какие заметки относятся к каким книгам ----------
function buildIndex(books) {
    booksByPath.clear();
    const lookup = new Map();
    books.forEach((b) => {
        booksByPath.set(b.path, b);
        [b.titleKey, b.fileKey, b.path.toLowerCase()].forEach((k) => lookup.set(k, b));
    });

    const index = new Map(books.map((b) => [b.path, new Map()]));
    const add = (b, path, name) => {
        if (path !== b.path) index.get(b.path).set(path, { path, name: name || baseName(path) });
    };

    // 1. ссылки из свойства книги «Заметки»
    books.forEach((b) => b.noteLinks.forEach((path) => add(b, path)));

    // 2. заметки с полем «Источник», указывающим на книгу
    try {
        let pages = cfg.notesFolder ? dv.pages(`"${String(cfg.notesFolder).replace(/"/g, '\\"')}"`) : dv.pages();
        pages = pages.where((p) => p[cfg.sourceField]);
        pages.array().forEach((p) => {
            if (booksByPath.has(p.file.path)) return;
            U.toArray(p[cfg.sourceField]).forEach((s) => {
                const raw = s && s.path ? s.path : stripLink(s);
                const key = String(raw).toLowerCase();
                const b = lookup.get(key) || lookup.get(baseName(raw));
                if (b) add(b, p.file.path, p.file.name);
            });
        });
    } catch (e) {
        console.warn("book-gallery: не удалось собрать заметки-цитаты", e);
    }

    books.forEach((b) => {
        b.noteList = [...index.get(b.path).values()];
        b.notes = b.notesNum ?? (b.noteList.length || b.inlinks);
    });
}

// ---------- разбор текста заметки ----------
function clean(s) {
    return String(s)
        .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
        .replace(/\[\[([^\]]+)\]\]/g, "$1")
        .replace(/(\*\*|__|==|~~)/g, "")
        .replace(/^\s*>+\s?/gm, "")
        .replace(/\s+/g, " ")
        .trim();
}

const LABEL = /^(#{1,6}\s*)?(note|quote|notes|цитата|заметка|заметки)\s*:?\s*$/i;

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

async function readNote(note) {
    if (parsedCache.has(note.path)) return parsedCache.get(note.path);
    let parsed = null;
    try {
        const file = app.vault.getAbstractFileByPath(note.path);
        if (file) parsed = parse(await app.vault.cachedRead(file));
    } catch (e) {
        parsed = null;
    }
    parsedCache.set(note.path, parsed);
    return parsed;
}

// ---------- случайный выбор ----------
const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

// Выбранная для книги заметка (если уже выбрана и прочитана), без ожидания
const peek = (book) => picked.get(book.path) || null;

// Выбрать случайную заметку; fresh — выбрать другую, чем сейчас
async function pick(book, fresh) {
    if (!book.noteList.length) return null;
    if (!fresh && picked.has(book.path)) return picked.get(book.path);

    const current = picked.get(book.path);
    const pool = shuffle([...book.noteList]);
    const order = fresh && current ? [...pool.filter((n) => n.path !== current.note.path), ...pool.filter((n) => n.path === current.note.path)] : pool;

    for (const note of order.slice(0, 10)) {
        const parsed = await readNote(note);
        if (parsed && parsed.quote) {
            const result = { note, quote: parsed.quote, comment: parsed.comment };
            picked.set(book.path, result);
            return result;
        }
    }
    return null;
}

// Дочитать заметки для элементов с data-book и вызвать fill(элемент, результат)
async function hydrate(root, fill) {
    const nodes = [...root.querySelectorAll("[data-book]")];
    await Promise.all(
        nodes.map(async (el) => {
            const book = booksByPath.get(el.dataset.book);
            if (!book || !book.noteList.length) return;
            const had = picked.has(book.path);
            const result = await pick(book, false);
            if (result && !had && root.contains(el)) fill(el, result);
        })
    );
}

async function reroll(bookPath) {
    const book = booksByPath.get(bookPath);
    return book ? pick(book, true) : null;
}

return { buildIndex, parse, peek, pick, hydrate, reroll };
