// src/app.js — сборка одного экземпляра галереи: раскладка, чтение книг, отрисовка интерфейса.
// Вызывается из main.js (Host.render) для блока кода ```book-gallery и для вкладки «Каталог книг».

async function run(container, opts) {
    const { layout, data, ui } = ctx.lib;
    try {
        layout.apply(container);
        const t0 = performance.now();
        const books = data.loadBooks();
        await ui.mount(container, books, {
            loadMs: performance.now() - t0,
            keep: opts.keep,
            silent: opts.silent,
            onCleanup: opts.onCleanup,
        });
    } catch (e) {
        console.error("book-gallery:", e);
        container.innerHTML = "";
        const box = document.createElement("div");
        box.style.cssText = "color:#d9534f;margin-bottom:12px;white-space:pre-wrap;";
        box.textContent = "book-gallery: " + (e && e.message ? e.message : String(e));
        container.appendChild(box);
    }
}

module.exports = { run };
