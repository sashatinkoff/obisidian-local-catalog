// ==========================================================
// Book Gallery — плагин Obsidian: каталог прочитанных книг.
//
// Без сборки: достаточно скопировать папку в <хранилище>/.obsidian/plugins/book-gallery/
//   main.js        — этот файл: загрузчик модулей, регистрация блока кода, вкладки, настроек и автообновления
//   manifest.json  — описание плагина
//   src/*.js       — модули (config, utils, icons, data, notes, stats, filters, layout, thumbs,
//                    cards, list, templates, ui, app — на экземпляр галереи; settings, view — на плагин)
//   styles/*.css   — стили, подключаются одним <style>
//
// Модули читаются из src/ через app.vault.adapter и выполняются как (ctx, module, exports) => …:
// так плагин одинаково работает на компьютере и на телефоне, где require() локальных файлов недоступен.
//
// Использование в заметке:
//   ```book-gallery
//   folder: Прочитанные книги
//   ```
// ==========================================================

const obsidian = require("obsidian");
const { Plugin, MarkdownRenderChild, Notice, parseYaml } = obsidian;

const VIEW_TYPE = "book-gallery-view";
const CODE_BLOCK = "book-gallery";
const STYLE_ID = "book-gallery-styles";

// Модули одного экземпляра галереи. Порядок важен: модуль использует только те, что загружены раньше
const MODULES = [
    "config", "utils", "icons", "data", "notes", "stats", "filters",
    "layout", "thumbs", "cards", "list", "templates", "ui", "app",
];
// Модули плагина целиком (загружаются один раз)
const PLUGIN_MODULES = ["settings", "view"];

// Заполняется скриптом build.js: { src: {имя: текст}, styles: {имя: текст} }.
// В исходной версии null — модули и стили читаются из папок src/ и styles/ рядом с main.js.
const EMBEDDED = null; // @@EMBEDDED@@

const REFRESH_DELAY = 2500; // мс тишины после правки заметок перед тихим обновлением галерей

/**
 * Один экземпляр галереи: элемент на странице + параметры блока. Умеет перерисовываться,
 * сохраняя фильтры, и аккуратно убирает за собой.
 */
class Host {
    constructor(plugin, el, params) {
        this.plugin = plugin;
        this.el = el;
        this.params = params || {};
        this.keep = {};       // фильтры, вид, год «Пульса» — переживают перерисовку
        this.cleanups = [];
        this.cfg = null;
        this.stale = false;   // данные устарели, а блок сейчас не виден
        this.destroyed = false;
        this.rendering = false;
    }

    attach(component) {
        component.register(() => this.destroy());
        this.plugin.hosts.add(this);
    }

    runCleanups() {
        const list = this.cleanups;
        this.cleanups = [];
        list.forEach((fn) => {
            try { fn(); } catch (e) { console.warn("book-gallery: cleanup", e); }
        });
    }

    isVisible() {
        return this.el.isConnected && this.el.offsetParent !== null;
    }

    async render(silent) {
        if (this.destroyed || this.rendering) return;
        this.rendering = true;
        try {
            this.runCleanups();
            const scope = { register: (fn) => this.cleanups.push(fn) };
            const ctx = this.plugin.instantiate(this.params, scope);
            this.cfg = ctx.cfg;
            this.stale = false;
            await ctx.lib.app.run(this.el, {
                keep: this.keep,
                silent: !!silent,
                onCleanup: (fn) => this.cleanups.push(fn),
            });
        } catch (e) {
            console.error("book-gallery:", e);
            this.el.empty();
            this.el.createDiv({ text: "book-gallery: " + (e && e.message ? e.message : e) }).style.cssText =
                "color:#d9534f;white-space:pre-wrap;";
        } finally {
            this.rendering = false;
        }
    }

    destroy() {
        this.destroyed = true;
        this.runCleanups();
        this.plugin.hosts.delete(this);
    }
}

module.exports = class BookGalleryPlugin extends Plugin {
    async onload() {
        this.hosts = new Set();
        this.compiled = {};
        this.settings = Object.assign({}, await this.loadData());
        this.dirty = true;       // до первого индексирования метаданных данные могут быть неполными
        this.refreshTimer = null;

        try {
            await this.compileAll();
        } catch (e) {
            console.error("book-gallery:", e);
            new Notice("Book Gallery: " + (e && e.message ? e.message : e), 10000);
            return;
        }

        this.defaults = this.runModule("config", { obsidian }).defaults;
        await this.injectStyles();

        const { BookGallerySettingTab } = this.runModule("settings", { obsidian, plugin: this });
        const { BookGalleryView } = this.runModule("view", { obsidian, plugin: this });

        this.addSettingTab(new BookGallerySettingTab(this.app, this));

        // блок кода ```book-gallery
        this.registerMarkdownCodeBlockProcessor(CODE_BLOCK, (source, el, mdCtx) => {
            let params = {};
            try {
                params = parseYaml(source) || {};
                if (typeof params !== "object" || Array.isArray(params)) throw new Error("параметры должны быть в формате «ключ: значение»");
            } catch (e) {
                el.createDiv({ text: "book-gallery: ошибка в параметрах блока — " + (e && e.message ? e.message : e) }).style.cssText =
                    "color:#d9534f;white-space:pre-wrap;";
                return;
            }
            const child = new MarkdownRenderChild(el);
            mdCtx.addChild(child);
            const host = this.createHost(el.createDiv(), params, child);
            host.render();
        });

        // отдельная вкладка
        this.registerView(VIEW_TYPE, (leaf) => new BookGalleryView(leaf));
        this.addRibbonIcon("book-open", "Каталог книг", () => this.openView());
        this.addCommand({ id: "open-book-gallery", name: "Открыть каталог книг", callback: () => this.openView() });
        this.addCommand({
            id: "insert-book-gallery",
            name: "Вставить блок каталога книг в заметку",
            editorCallback: (editor) => editor.replaceSelection("```" + CODE_BLOCK + "\nfolder: " + (this.settings.folder || this.defaults.folder) + "\n```\n"),
        });
        this.addCommand({ id: "refresh-book-gallery", name: "Обновить каталоги книг", callback: () => this.refreshAll(true) });

        // автообновление: правка книг и заметок-цитат, переименование, удаление
        const { metadataCache, vault, workspace } = this.app;
        this.registerEvent(metadataCache.on("changed", (file) => { if (this.isRelevant(file)) this.dirty = true; }));
        this.registerEvent(metadataCache.on("resolved", () => {
            if (!this.dirty) return;
            this.dirty = false;
            this.scheduleRefresh();
        }));
        const touch = () => { this.dirty = true; this.scheduleRefresh(); };
        this.registerEvent(vault.on("delete", touch));
        this.registerEvent(vault.on("rename", touch));
        // скрытые галереи обновляются, когда их снова открывают
        this.registerEvent(workspace.on("active-leaf-change", () => this.refreshStale()));
    }

    onunload() {
        clearTimeout(this.refreshTimer);
        [...this.hosts].forEach((h) => h.destroy());
        const style = document.getElementById(STYLE_ID);
        if (style) style.remove();
        this.app.workspace.detachLeavesOfType(VIEW_TYPE);
    }

    // ---------- модули ----------
    get dir() {
        return this.manifest.dir;
    }

    async compileAll() {
        const names = [...MODULES, ...PLUGIN_MODULES];
        const adapter = this.app.vault.adapter;
        if (EMBEDDED) {
            names.forEach((name) => {
                this.compiled[name] = new Function("ctx", "module", "exports", EMBEDDED.src[name] + `\n//# sourceURL=book-gallery/src/${name}.js`);
            });
            return;
        }
        const sources = await Promise.all(
            names.map((name) =>
                adapter.read(`${this.dir}/src/${name}.js`).catch((e) => {
                    const err = new Error(`${this.dir}/src/${name}.js (${e && e.message ? e.message : e})`);
                    err.missing = true;
                    throw err;
                })
            )
        ).catch(async (e) => {
            // подсказка: что реально лежит в папке плагина
            let listing = "";
            try {
                const l = await adapter.list(this.dir);
                listing = `\nВ папке плагина: файлы [${l.files.map((f) => f.split("/").pop()).join(", ")}], папки [${l.folders.map((f) => f.split("/").pop()).join(", ")}]`;
            } catch (e2) { /* без подсказки */ }
            throw new Error(`не удалось прочитать модуль: ${e.message}.${listing}\nПапка src должна лежать рядом с main.js.`);
        });
        names.forEach((name, i) => {
            this.compiled[name] = new Function("ctx", "module", "exports", sources[i] + `\n//# sourceURL=book-gallery/src/${name}.js`);
        });
    }

    runModule(name, ctx) {
        const module = { exports: {} };
        this.compiled[name](ctx, module, module.exports);
        return module.exports;
    }

    // Свежий набор модулей для одной галереи: у каждой свои настройки и состояние
    instantiate(params, component) {
        const ctx = { app: this.app, obsidian, plugin: this, component, lib: {}, cfg: null };
        for (const name of MODULES) {
            ctx.lib[name] = this.runModule(name, ctx);
            // настройки нужны всем остальным модулям, поэтому собираем их сразу после config
            if (name === "config") ctx.cfg = ctx.lib.config.build(this.settings, params);
        }
        return ctx;
    }

    createHost(el, params, component) {
        const host = new Host(this, el, params);
        host.attach(component);
        return host;
    }

    // ---------- стили ----------
    async injectStyles() {
        const files = this.defaults.cssFiles;
        const texts = EMBEDDED
            ? files.map((name) => (EMBEDDED.styles[name] !== undefined ? EMBEDDED.styles[name] : null))
            : await Promise.all(files.map((name) => this.app.vault.adapter.read(`${this.dir}/styles/${name}.css`).catch(() => null)));
        const missing = files.filter((_, i) => texts[i] === null);
        if (missing.length) new Notice(`Book Gallery: не найдены стили: ${missing.map((m) => m + ".css").join(", ")}`, 8000);
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement("style");
            style.id = STYLE_ID;
            document.head.appendChild(style);
        }
        style.textContent = texts.map((t) => t || "").join("\n");
    }

    // ---------- вкладка ----------
    async openView() {
        const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
        const leaf = existing || this.app.workspace.getLeaf("tab");
        if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true });
        this.app.workspace.revealLeaf(leaf);
    }

    // ---------- настройки и обновление ----------
    async saveSettings() {
        await this.saveData(this.settings);
        this.dirty = true;
        this.scheduleRefresh(); // с задержкой: настройка может вводиться по буквам
    }

    // Относится ли изменённая заметка к какой-нибудь из открытых галерей
    isRelevant(file) {
        if (!file || file.extension !== "md" || !this.hosts.size) return false;
        const cache = this.app.metadataCache.getFileCache(file);
        for (const host of this.hosts) {
            const cfg = host.cfg;
            if (!cfg) continue;
            const folder = String(cfg.folder || "").trim().replace(/^\/+|\/+$/g, "");
            if (!folder || file.path.startsWith(folder + "/")) return true;
            if (cache && cache.frontmatter && cache.frontmatter[cfg.sourceField]) return true;
        }
        return false;
    }

    scheduleRefresh() {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => this.refreshAll(false), REFRESH_DELAY);
    }

    // force — перерисовать сразу все, иначе только видимые (остальные получат метку «устарело»)
    refreshAll(force) {
        for (const host of this.hosts) {
            if (force || host.isVisible()) host.render(!force);
            else host.stale = true;
        }
    }

    refreshStale() {
        for (const host of this.hosts) if (host.stale && host.isVisible()) host.render(true);
    }
};
