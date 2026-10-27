// app/main.js — композиция. Два уровня:
//  • createCore(plugin) — один раз на плагин: хранилище, общая база данных (data.json), CSS;
//  • mount(core, opts)   — на каждый вид (вкладка / code-block): настройки → сессия → состояние → контекст → оболочка.
const createStorage = require("services/storage");
const createDb = require("services/db");
const { DEFAULTS } = require("services/config");
const { DEFAULT_PRESETS, createPresets } = require("services/presets");
const loadCss = require("services/css-loader");
const createMarkdown = require("services/md");
const createMedia = require("services/media");
const createContent = require("services/content");
const createFlags = require("services/flags");
const createPostsRepo = require("services/posts");
const createSession = require("services/session");
const createIndexer = require("services/indexer");
const createScroll = require("services/scroll");
const createChangelog = require("services/changelog");
const createNewNote = require("services/new-note");
const createNotePopup = require("ui/common/note-popup");
const { Notice } = require("obsidian");
const createAppState = require("app/state");
const createActions = require("app/actions");
const createOpenNote = require("app/open-note");
const { mountShell } = require("app/shell");
const { VERSION } = require("app/version");

async function createCore(plugin) {
  const storage = createStorage(plugin);
  const db = await createDb(storage, { settings: DEFAULTS, presets: DEFAULT_PRESETS });
  await loadCss(storage);
  return { plugin, app: plugin.app, storage, db, instances: new Set(), defaults: DEFAULTS };
}

// opts: { container, input, sourcePath, component, boot }
async function mount(core, { container, input = {}, sourcePath = "", component = {}, boot = null }) {
  const { app, storage, db } = core;
  const config = JSON.parse(JSON.stringify(db.data.settings)); // копия: параметры вызова не пишутся обратно в данные
  if (input.nav === false) config.nav = false;

  // Ключ сессии: место, где живёт вид (заметка / вкладка) + id блока. Позволяет вернуться на то же место после перехода в заметку.
  const key = (sourcePath || "journal-stream") + "::" + (input.id || "default");
  const session = createSession(key);
  const { store, restored } = createAppState({ db, config, input, session });

  const disposers = [];
  const ctx = { app, plugin: core.plugin, component, sourcePath, input, config, storage, db, session, store, restored, boot, destroyed: false };
  ctx.onDispose = (fn) => { disposers.push(fn); };
  ctx.flags = createFlags({ db });
  ctx.presets = createPresets({ db });
  ctx.md = createMarkdown({ app, component });
  ctx.media = createMedia(app);
  ctx.content = createContent({ app, config });
  ctx.repo = createPostsRepo({ app, config });
  const popup = createNotePopup(ctx);
  ctx.openPreview = (link, source) => popup.open(link, source);
  ctx.closePreview = popup.close;
  Object.assign(ctx, createOpenNote(ctx));
  ctx.scrollKey = key;
  ctx.scroll = createScroll({ session, key, log: config.debug ? (...a) => console.log("[journal-stream:scroll]", ...a) : undefined });
  ctx.onDispose(() => ctx.scroll.destroy());
  ctx.actions = createActions(ctx);
  ctx.indexer = createIndexer(ctx);
  const makeNote = createNewNote(ctx);
  ctx.createNote = async () => { try { await makeNote(); } catch (e) { console.error("[journal-stream] новая заметка", e); new Notice("Journal Stream: не удалось создать заметку — " + (e && e.message ? e.message : e)); } };
  ctx.openChangelog = createChangelog({ app, storage, md: ctx.md, component });

  const inst = {
    ctx,
    // Изменились заметки vault: следующий рендер перечитает список (без лишней работы на каждое событие)
    markDirty() { ctx.repo.markDirty(); },
    destroy() {
      if (ctx.destroyed) return;
      ctx.destroyed = true;
      for (const fn of disposers.splice(0).reverse()) { try { fn(); } catch (e) { console.warn("[journal-stream] dispose", e); } }
      db.flush();
      core.instances.delete(inst);
    },
  };
  core.instances.add(inst);
  await mountShell(ctx, container);

  // Версия, которой записаны данные: после обновления плагина показываем одно уведомление со ссылкой на историю версий.
  const prev = db.data.appVersion;
  if (prev !== VERSION) {
    db.data.appVersion = VERSION; db.save();
    if (!db.fresh) ctx.toast(`Journal Stream обновлён${prev ? `: v${prev} → v${VERSION}` : ` до v${VERSION}`}. Что нового — по ссылке v${VERSION} в навигации`);
  }
  return inst;
}
module.exports = { createCore, mount };
