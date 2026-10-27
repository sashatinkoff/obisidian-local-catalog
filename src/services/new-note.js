// services/new-note.js — создание новой заметки по настройке `newNote` и открытие её.
const { newNotePath } = require("lib/new-note-path");
const { fmtTokens, DEFAULT_DATE_RULE } = require("lib/new-note-path");

module.exports = function createNewNote(ctx) {
  const { app, config } = ctx;
  async function ensureFolders(path) {
    const parts = path.split("/").slice(0, -1);
    let cur = "";
    for (const p of parts) {
      cur = cur ? cur + "/" + p : p;
      if (!app.vault.getAbstractFileByPath(cur)) { try { await app.vault.createFolder(cur); } catch (e) { if (!app.vault.getAbstractFileByPath(cur)) throw e; } }
    }
  }
  return async function create() {
    const now = new Date(), base = newNotePath(config.newNote, now);
    let path = base + ".md", i = 1;
    while (app.vault.getAbstractFileByPath(path)) path = `${base}-${++i}.md`;
    await ensureFolders(path);
    const field = (config.dateFields && config.dateFields[0]) || "date";
    const file = await app.vault.create(path, `---\n${field}: "${fmtTokens((config.newNote && config.newNote.dateRule) || DEFAULT_DATE_RULE, now, (config.newNote && config.newNote.dateLang) || "ru")}"\n---\n\n`);
    if (ctx.repo) ctx.repo.markDirty();
    if (!config.newNote || config.newNote.open !== false) ctx.openNote(file.path || path);
    return file;
  };
};
