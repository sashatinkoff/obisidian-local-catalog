// plugin/index.js — точка сборки плагина: общее ядро, вид-вкладка, code-block, настройки, команды, обновление при изменениях vault.
const { createCore } = require("app/main");
const { JournalStreamView, VIEW_TYPE } = require("plugin/view");
const { JournalStreamSettingTab } = require("plugin/settings-tab");
const registerCodeBlock = require("plugin/code-block");
const registerCommands = require("plugin/commands");
const { debounce } = require("lib/async");

async function setup(plugin) {
  const core = await createCore(plugin);
  plugin.core = core;

  // Изменения в настройках применяем «мягко»: перерисовываем открытые вкладки (code-block'и обновятся при следующем рендере заметки).
  const remount = debounce(async (hard) => {
    await require("services/css-loader")(core.storage);
    if (hard) window.__sfSession = {};
    for (const leaf of plugin.app.workspace.getLeavesOfType(VIEW_TYPE)) if (leaf.view && leaf.view.remount) await leaf.view.remount();
    if (hard) { window.__sfSession = {}; for (const i of [...core.instances]) i.markDirty(); }
  }, 600);
  plugin.scheduleRemount = (hard) => remount(hard);

  // Создание заметки без открытой ленты (команда палитры): минимальный контекст поверх общих настроек
  plugin.createNote = async () => {
    const { Notice } = require("obsidian");
    try {
      const ctx = { app: plugin.app, config: core.db.data.settings, store: { get: () => ({}) }, openNote: (p) => plugin.app.workspace.openLinkText(p, "", false) };
      await require("services/new-note")(ctx)();
    } catch (e) { console.error("[journal-stream] новая заметка", e); new Notice("Journal Stream: не удалось создать заметку — " + (e && e.message ? e.message : e)); }
  };
  plugin.registerView(VIEW_TYPE, (leaf) => new JournalStreamView(leaf, core));
  registerCodeBlock(plugin, core);
  registerCommands(plugin, core);
  plugin.addSettingTab(new JournalStreamSettingTab(plugin.app, plugin, core));

  // Заметки изменились/появились/удалены: помечаем списки устаревшими — следующий рендер/«Перечитать» подхватит.
  const dirty = debounce(() => { for (const i of core.instances) i.markDirty(); }, 1500);
  plugin.registerEvent(plugin.app.metadataCache.on("resolved", dirty));
  plugin.registerEvent(plugin.app.vault.on("create", dirty));
  plugin.registerEvent(plugin.app.vault.on("delete", dirty));
  plugin.registerEvent(plugin.app.vault.on("rename", dirty));
}

function teardown(plugin) {
  const core = plugin.core;
  if (!core) return;
  for (const i of [...core.instances]) i.destroy();
  core.db.flush();
  const st = document.getElementById(require("services/css-loader").STYLE_ID);
  if (st) st.remove();
}
module.exports = { setup, teardown };
