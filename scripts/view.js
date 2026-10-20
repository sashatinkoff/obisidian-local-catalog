// ==========================================================
// view.js — точка входа галереи книг для Dataview.
//
// Вызов из заметки:
//   await dv.view("scripts/book-gallery", { folder: "Прочитанные книги" })
//
// Структура папки:
//   view.js          — этот файл: загружает модули и собирает галерею
//   lib/*.js         — модули (config, utils, data, styles, layout, templates, ui)
//   styles/*.css     — стили, разбитые по темам (подключает lib/styles.js)
//
// Dataview умеет загружать только один файл, поэтому модули читаются отсюда
// через app.vault.adapter и выполняются как функции вида (ctx) => exports.
// ==========================================================

const DEFAULT_DIR = "scripts/book-gallery";
const MODULES = ["config", "utils", "data", "styles", "layout", "templates", "ui"]; // порядок важен

const container = dv.container;
const dir = (input && input.dir) || DEFAULT_DIR;
const ctx = { dv, app, cfg: null, lib: {} };

function showError(message, details) {
    container.innerHTML = "";
    const box = document.createElement("div");
    box.style.cssText = "color:#d9534f;margin-bottom:12px;white-space:pre-wrap;";
    box.textContent = "book-gallery: " + message;
    container.appendChild(box);
    if (details) console.error("book-gallery:", message, details);
}

// Прочитать все модули параллельно и выполнить их по порядку
async function loadModules() {
    const sources = await Promise.all(
        MODULES.map((name) =>
            app.vault.adapter.read(`${dir}/lib/${name}.js`).catch(() => {
                throw new Error(`не найден модуль «${dir}/lib/${name}.js». Проверьте параметр dir.`);
            })
        )
    );

    MODULES.forEach((name, i) => {
        ctx.lib[name] = new Function("ctx", sources[i])(ctx);
        // настройки нужны всем остальным модулям, поэтому собираем их сразу после config
        if (name === "config") {
            ctx.cfg = ctx.lib.config.build(input);
            ctx.cfg.dir = dir;
        }
    });
}

try {
    await loadModules();

    const { styles, layout, data, ui } = ctx.lib;

    const cssError = await styles.load();
    layout.apply(container);

    ui.mount(container, data.loadBooks());

    if (cssError) {
        // стили не загрузились, поэтому оформляем сообщение inline
        const note = document.createElement("div");
        note.style.cssText = "color:#d9534f;margin-bottom:12px;";
        note.textContent = "book-gallery: " + cssError;
        container.prepend(note);
    }
} catch (e) {
    showError(e && e.message ? e.message : String(e), e);
}
