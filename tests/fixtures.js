// tests/fixtures.js — тестовое «хранилище»: заметки + моки app (vault/metadataCache), plugin и obsidian поверх файловой системы.
const fs = require("fs");
const path = require("path");
const DAY = 86400000, now = Date.now();
const iso = (off, time = "10:30") => { const d = new Date(now - off * DAY); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${time}`; };
const lastYear = (() => { const d = new Date(now); return `${d.getFullYear() - 1}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} 09:00`; })();

const NOTES = [
  { path: "notes/LiveJournal/2026/a.md", date: iso(0), tags: ["#мысли", "#daily"], body: "Утренние мысли про [[Zettelkasten]] и атомарность.\n\nВторой абзац.", inl: 4, out: ["Zettelkasten.md"] },
  { path: "notes/LiveJournal/2026/quote.md", date: iso(1), tags: ["#цитаты"], body: "> [!quote] Барри Шварц\n> Свобода выбора без жестких ограничений превращается в паралич мышления.\n", inl: 11 },
  { path: "notes/Twitter/2026/voice.md", date: iso(2), tags: ["#audio", "#черновик"], body: "Аудиозапись мысли\n![[rec-001.m4a]]", out: ["rec-001.m4a"] },
  { path: "notes/Twitter/2026/video.md", date: iso(3), tags: ["#видео", "#разбор"], body: "# Стрим\n![[stream.mp4]]\nКонспект про CRDT.", out: ["stream.mp4"], inl: 5 },
  { path: "notes/Twitter/2026/photos.md", date: iso(4), tags: ["#daily"], body: "Фото дня\n![[1.jpg]] ![[2.jpg]] ![[3.png]] ![[4.png]] ![[5.webp]]", out: ["1.jpg", "2.jpg", "3.png", "4.png", "5.webp"] },
  { path: "notes/LiveJournal/2026/tasks.md", date: iso(5), tags: ["#проекты"], body: "- [x] Разгрузить inbox\n- [ ] Перелинковать заметки\n- [ ] Ещё одна", tasks: 3 },
  { path: "notes/Twitter/2026/link.md", date: iso(6), tags: ["#dev"], body: "Читать: https://example.com/article/crdt", },
  { path: "notes/LiveJournal/2026/canvas.md", date: iso(7), tags: ["#zettelkasten", "#obsidian"], body: "Карта\n![[system_map.canvas]]", out: ["system_map.canvas"] },
  { path: "notes/LiveJournal/2025/old.md", date: lastYear, tags: ["#мысли"], body: "Заметка годичной давности. Подробно о себе и о том, что было." },
  { path: "notes/LiveJournal/2024/ru-date.md", date: "1 октября 2024, 16:12", tags: ["#мысли"], body: "Дата в формате самих заметок." },
  { path: "notes/LiveJournal/2024/2024-03-02.md", date: null, tags: [], body: "Без даты в frontmatter, дата в имени файла." },
];

const { buildVault } = require("./fake-app");
const { makeObsidian } = require("./fake-obsidian");

function makeApp(vaultRoot) {
  const abs = (p) => path.join(vaultRoot, p);
  const v = buildVault(NOTES, { now });
  const opened = [], created = new Set(), createdFiles = {};
  const app = {
    opened, createdFiles, scopes: [],
    keymap: { pushScope(s) { this._a.scopes.push(s); }, popScope(s) { const i = this._a.scopes.indexOf(s); if (i >= 0) this._a.scopes.splice(i, 1); }, _a: null },
    vault: {
      adapter: {
        read: async (p) => fs.readFileSync(abs(p), "utf8"),
        write: async (p, d) => { fs.mkdirSync(path.dirname(abs(p)), { recursive: true }); fs.writeFileSync(abs(p), d); },
        exists: async (p) => fs.existsSync(abs(p)),
        mkdir: async (p) => fs.mkdirSync(abs(p), { recursive: true }),
        list: async (p) => {
          const ents = fs.readdirSync(abs(p), { withFileTypes: true });
          return { files: ents.filter((e) => e.isFile()).map((e) => p + "/" + e.name), folders: ents.filter((e) => e.isDirectory()).map((e) => p + "/" + e.name) };
        },
      },
      getMarkdownFiles: v.getMarkdownFiles, getAbstractFileByPath: (p) => v.getAbstractFileByPath(p) || (created.has(p) ? { path: p } : null),
      createFolder: async (p) => { created.add(p); }, create: async (p, d) => { created.add(p); createdFiles[p] = d; return { path: p }; }, cachedRead: v.cachedRead, getResourcePath: v.getResourcePath,
      on: () => ({}),
    },
    metadataCache: { ...v.metadataCache, on: () => ({}) },
    workspace: { leftSplit: { collapsed: false, collapse() { this.collapsed = true; }, expand() { this.collapsed = false; } }, rightSplit: { collapsed: false, collapse() { this.collapsed = true; }, expand() { this.collapsed = false; } }, openLinkText: (p, _s, nt) => opened.push([p, nt]), getLeavesOfType: () => [], revealLeaf: () => {}, getLeaf: () => ({ setViewState: async () => {} }) },
  };
  app.keymap._a = app;
  return app;
}

// Плагин-заглушка: manifest.dir, loadData/saveData (файл data.json в папке плагина) и записи регистраций.
function makePlugin(app, vaultRoot, dir) {
  const file = path.join(vaultRoot, dir, "data.json");
  const reg = { views: {}, commands: [], blocks: {}, ribbon: [], tabs: [], events: [] };
  return {
    app, manifest: { dir }, reg,
    loadData: async () => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null),
    saveData: async (d) => { fs.writeFileSync(file, JSON.stringify(d, null, 2)); },
    registerView: (t, f) => { reg.views[t] = f; },
    registerMarkdownCodeBlockProcessor: (l, f) => { reg.blocks[l] = f; },
    registerEvent: (e) => reg.events.push(e),
    addCommand: (c) => reg.commands.push(c),
    addRibbonIcon: (...a) => reg.ribbon.push(a),
    addSettingTab: (t) => reg.tabs.push(t),
  };
}
module.exports = { NOTES, makeApp, makePlugin, makeObsidian };
