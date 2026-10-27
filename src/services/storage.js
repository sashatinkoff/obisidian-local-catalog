// services/storage.js — доступ к данным и ресурсам плагина.
//  • данные пользователя (настройки, подборки, избранное, UI) — один файл data.json через plugin.loadData/saveData;
//  • ресурсы (css/*.css, README) — из папки плагина (vault adapter) либо, в собранном main.js, из встроенного bundle.
module.exports = function createStorage(plugin) {
  const adapter = plugin.app.vault.adapter;
  const dir = plugin.manifest.dir;
  const full = (rel) => `${dir}/${rel}`;
  const bundle = plugin.__bundle || null; // в собранном main.js css и README лежат внутри
  return {
    dir,
    async load() { try { return (await plugin.loadData()) || null; } catch (e) { console.warn("[journal-stream] не удалось прочитать data.json", e); return null; } },
    async save(data) { try { await plugin.saveData(data); return true; } catch (e) { console.warn("[journal-stream] не удалось записать data.json", e); return false; } },
    async readText(rel) {
      if (bundle && rel !== "css/90-custom.css") { const r = rel.startsWith("css/") ? bundle.css[rel.slice(4)] : rel === "README.md" ? bundle.readme : undefined; if (r !== undefined) return r; }
      const p = full(rel); return (await adapter.exists(p)) ? adapter.read(p) : "";
    },
    // css/90-custom.css на диске (если есть) важнее встроенного: пользовательские правки не теряются
    async listFiles(rel) {
      const p = full(rel), disk = (await adapter.exists(p)) ? (await adapter.list(p)).files : [];
      if (bundle && rel === "css") { const names = new Set(Object.keys(bundle.css)); disk.forEach((f) => names.add(f.split("/").pop())); return [...names].filter((n) => n.endsWith(".css")).map((n) => rel + "/" + n); }
      return disk;
    },
  };
};
