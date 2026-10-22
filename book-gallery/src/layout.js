// src/layout.js — ширина заметки на весь экран (опция fullWidth).
//
// Obsidian ограничивает ширину текста через --file-line-width и max-width у контейнеров
// .markdown-preview-sizer (чтение) и .cm-sizer (редактирование). Классы из cssclasses
// Obsidian вешает на .markdown-preview-view / .markdown-source-view. Делаем то же самое
// из скрипта и дублируем inline-стилями, чтобы результат не зависел от порядка отрисовки.

const SIZERS = ".markdown-preview-sizer, .cm-sizer";
const HOSTS = ".markdown-preview-view, .markdown-source-view";
const OWN_CLASS = "book-gallery-fw";

function apply(container) {
    const { cfg } = ctx;
    if (!cfg.fullWidth) return;

    const classes = [OWN_CLASS, ...ctx.lib.utils.toStringList(cfg.fullWidthClasses)];
    container.classList.add("book-gallery-root");

    let host = null;
    let observer = null;
    let frame = 0;
    let tries = 0;
    let alive = true;

    const stretch = (node) => {
        // запоминаем, какие классы добавили мы, чтобы потом убрать только их
        if (!node._bgAdded) node._bgAdded = classes.filter((c) => !node.classList.contains(c));
        // меняем DOM только если что-то реально отсутствует: лишняя запись класса снова разбудила бы наблюдатель
        const missing = classes.filter((c) => !node.classList.contains(c));
        if (missing.length) node.classList.add(...missing);
        if (node.style.getPropertyValue("--file-line-width") !== "100%") node.style.setProperty("--file-line-width", "100%");
        node.querySelectorAll(SIZERS).forEach((s) => {
            if (s.style.getPropertyValue("max-width") !== "100%") s.style.setProperty("max-width", "100%", "important");
        });
    };

    const restore = (node) => {
        node.classList.remove(...(node._bgAdded || []));
        delete node._bgAdded;
        node.style.removeProperty("--file-line-width");
        node.querySelectorAll(SIZERS).forEach((s) => s.style.removeProperty("max-width"));
    };

    const attach = () => {
        if (!alive) return;
        host = container.closest(HOSTS);
        if (!host) {
            // в режиме чтения блок бывает ещё не вставлен в страницу — повторяем
            if (tries++ < 120) frame = requestAnimationFrame(attach);
            return;
        }
        stretch(host);
        // Obsidian может перезаписать классы при перерисовке — возвращаем свои
        observer = new MutationObserver(() => stretch(host));
        observer.observe(host, { attributes: true, attributeFilter: ["class"], subtree: false });
    };
    attach();

    // Блок выгружается (переход на другую заметку, перерисовка): убираем стили,
    // но только если на странице не осталось ни одной галереи
    ctx.component?.register(() => {
        alive = false;
        observer?.disconnect();
        cancelAnimationFrame(frame);
        const node = host;
        setTimeout(() => {
            if (node && !node.querySelector(".book-gallery-root")) restore(node);
        }, 300);
    });
}

module.exports = { apply };
