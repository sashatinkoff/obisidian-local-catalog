// lib/thumbs.js — уменьшенные копии обложек.
//
// Обложки в хранилище бывают огромными (тысячи пикселей). Если выводить их как есть, браузер держит в
// памяти полноразмерные кадры для каждой карточки, а при наведении и прокрутке перекодирует их заново:
// это даёт мерцание и тормоза. Здесь каждая обложка один раз уменьшается до MAX_SIDE пикселей
// и дальше показывается копия. Кэш общий для всех перерисовок. Если что-то не вышло, берётся оригинал.

const MAX_SIDE = 560;
const LIMIT = 3;            // сколько обложек обрабатывается одновременно
const TIMEOUT = 6000;       // мс на одну обложку: если не успели, показываем оригинал и освобождаем очередь
const MAX_FAILS = 3;        // столько сбоев подряд — и уменьшение отключается (показываем оригиналы)

// кэш живёт в window, чтобы переживать перерисовку блока
const store = (window.__bookGalleryThumbs = window.__bookGalleryThumbs || { done: new Map(), pending: new Map(), fails: 0 });

let running = 0;
const waiting = [];
function schedule(task) {
    return new Promise((resolve, reject) => {
        const run = () => {
            running++;
            task()
                .then(resolve, reject)
                .finally(() => {
                    running--;
                    const next = waiting.shift();
                    if (next) next();
                });
        };
        running < LIMIT ? run() : waiting.push(run);
    });
}

// Уменьшенная копия или исходный url; никогда не висит дольше TIMEOUT
async function build(url) {
    if (/^data:/i.test(url) || typeof createImageBitmap !== "function") return url;
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            if (ctl) ctl.abort();
            reject(new Error("timeout"));
        }, TIMEOUT);
    });
    const work = (async () => {
        const res = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
        if (!res.ok) throw new Error("http " + res.status);
        const bmp = await createImageBitmap(await res.blob());
        try {
            const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
            if (k >= 1) return url; // уже небольшая
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(bmp.width * k));
            canvas.height = Math.max(1, Math.round(bmp.height * k));
            const g = canvas.getContext("2d");
            g.imageSmoothingQuality = "high";
            g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
            return blob ? URL.createObjectURL(blob) : url;
        } finally {
            if (bmp.close) bmp.close();
        }
    })();
    work.catch(() => {}); // если победил таймаут, ошибка поздней работы не должна считаться необработанной
    try {
        const result = await Promise.race([work, timeout]);
        store.fails = 0;
        return result;
    } finally {
        clearTimeout(timer);
    }
}

// Уже готовая копия или null (без ожидания)
const peek = (url) => (store.done.has(url) ? store.done.get(url) : null);

function get(url) {
    if (store.done.has(url)) return Promise.resolve(store.done.get(url));
    if (!store.pending.has(url)) {
        store.pending.set(
            url,
            (store.fails >= MAX_FAILS ? Promise.resolve(url) : schedule(() => build(url)))
                .catch(() => {
                    store.fails++;
                    return url;
                })
                .then((result) => {
                    store.done.set(url, result);
                    store.pending.delete(url);
                    return result;
                })
        );
    }
    return store.pending.get(url);
}

// <img>: если копия готова — сразу с src, иначе с data-src (подставит hydrate)
function imgTag(url, cls) {
    const esc = ctx.lib.utils.esc;
    const ready = peek(url);
    return ready
        ? `<img class="${cls}" src="${esc(ready)}" decoding="async" alt="">`
        : `<img class="${cls}" data-src="${esc(url)}" decoding="async" alt="">`;
}

// Подставить src для всех картинок с data-src внутри root.
// Если уменьшенная копия не загрузилась как картинка, берём исходный файл
function hydrate(root) {
    root.querySelectorAll("img[data-src]").forEach((img) => {
        const url = img.dataset.src;
        img.removeAttribute("data-src");
        img.addEventListener(
            "error",
            () => {
                if (img.src !== url && !img.dataset.fallback) {
                    img.dataset.fallback = "1";
                    img.src = url;
                }
            },
            { once: true }
        );
        get(url).then((src) => {
            if (img.isConnected) img.src = src;
        });
    });
}

module.exports = { get, peek, imgTag, hydrate };
