// main.js (шаблон; рабочий main.js собирает tools/build.js) — точка входа плагина Obsidian «Journal Stream». Тонкая обёртка: вся логика лежит в src/* и подключается
// мини-загрузчиком (ниже) прямо из папки плагина — сборщик не нужен ("скопировал — вставил").
// Загрузчик встроен сюда намеренно: main.js — единственный файл, без которого ничего не стартует.
const obsidian = require("obsidian");

// CommonJS-загрузчик: читает все *.js из <плагин>/src и даёт sync-require. `externals` — модули хоста, например { obsidian }.
function createLoader({ app, root, externals = {}, bundle = null }) {
  const adapter = app.vault.adapter;
  const SKIP_DIRS = new Set();
  const SKIP_FILES = new Set();

  async function listJs(dir) {
    const out = [];
    const { files, folders } = await adapter.list(dir);
    for (const f of files) if (f.endsWith(".js") && !SKIP_FILES.has(f)) out.push(f);
    for (const d of folders) {
      const name = d.split("/").pop();
      if (!SKIP_DIRS.has(name)) out.push(...(await listJs(d)));
    }
    return out;
  }

  async function load() {
    // bundle (готовый main.js из tools/build.js): модули уже внутри — файлы src/ не нужны
    const paths = bundle ? [] : await listJs(root);
    const sources = await Promise.all(paths.map(async (p) => [p, await adapter.read(p)]));
    const defs = new Map();
    for (const [p, code] of sources) defs.set(p.slice(root.length + 1).replace(/\.js$/, ""), { path: p, code });
    if (bundle) for (const id of Object.keys(bundle.modules)) defs.set(id, { path: "journal-stream/src/" + id + ".js", fn: bundle.modules[id] });
    const cache = new Map();

    function resolve(fromId, request) {
      if (request in externals) return "ext:" + request;
      let id = request;
      if (request.startsWith(".")) {
        const base = fromId.split("/").slice(0, -1);
        for (const part of request.split("/")) {
          if (part === "." || part === "") continue;
          if (part === "..") base.pop();
          else base.push(part);
        }
        id = base.join("/");
      }
      id = id.replace(/\.js$/, "");
      if (defs.has(id)) return id;
      if (defs.has(id + "/index")) return id + "/index";
      throw new Error(`[journal-stream] модуль не найден: "${request}" (импорт из "${fromId}")`);
    }

    function requireFrom(fromId, request) {
      const id = resolve(fromId, request);
      if (id.startsWith("ext:")) return externals[id.slice(4)];
      if (cache.has(id)) return cache.get(id).exports;
      const def = defs.get(id);
      const module = { exports: {} };
      cache.set(id, module);
      const fn = def.fn || new Function("module", "exports", "require", def.code + "\n//# sourceURL=" + def.path);
      fn(module, module.exports, (r) => requireFrom(id, r));
      return module.exports;
    }

    return { require: (request) => requireFrom("<entry>", request), ids: [...defs.keys()] };
  }

  return { load };
};

module.exports = class JournalStreamPlugin extends obsidian.Plugin {
  async onload() {
    const adapter = this.app.vault.adapter;
    const dir = this.manifest.dir;
    const root = `${dir}/src`;
    try {
      const bundle = typeof __JS_BUNDLE__ !== "undefined" ? __JS_BUNDLE__ : null;
      this.__bundle = bundle;
      if (!bundle && !(await adapter.exists(`${root}/plugin/index.js`))) {
        throw new Error(`не найдена папка src/ (ожидался файл ${root}/plugin/index.js). Скопируйте в ${dir} ВСЕ файлы и папки архива: manifest.json, main.js, src/, css/, README.md — папка src должна лежать рядом с main.js`);
      }
      const { require: sfRequire } = await createLoader({ app: this.app, root, externals: { obsidian }, bundle }).load();
      this.sf = sfRequire("plugin/index");
      await this.sf.setup(this);
    } catch (e) {
      console.error("[journal-stream] ошибка запуска", e);
      new obsidian.Notice("Journal Stream: ошибка запуска — " + (e && e.message ? e.message : e), 15000);
    }
  }
  onunload() {
    try { if (this.sf) this.sf.teardown(this); } catch (e) { console.error("[journal-stream]", e); }
  }
};
module.exports.createLoader = createLoader;
