// lib/styles.js — читает CSS-файлы из styles/ и подключает их одним <style> в документ.

const { cfg, app } = ctx;
const STYLE_ID = "book-gallery-styles";

// Возвращает текст ошибки (какие файлы не найдены) или null
async function load() {
    const paths = cfg.cssFiles.map((name) => `${cfg.dir}/styles/${name}.css`);
    const results = await Promise.all(
        paths.map((path) =>
            app.vault.adapter.read(path).then(
                (text) => ({ path, text }),
                () => ({ path, text: null })
            )
        )
    );

    const missing = results.filter((r) => r.text === null).map((r) => r.path);
    const css = results.map((r) => r.text || "").join("\n");

    let style = document.getElementById(STYLE_ID);
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }
    style.textContent = css; // перезаписываем, чтобы правки CSS применялись при перерисовке

    if (!missing.length) return null;
    console.warn("book-gallery: не найдены файлы стилей", missing);
    return `Не найдены файлы стилей: ${missing.join(", ")}. Проверьте параметр dir (сейчас «${cfg.dir}»).`;
}

return { load };
