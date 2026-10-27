// plugin/commands.js — ribbon-иконка и команды палитры.
const { Notice } = require("obsidian");
const { VIEW_TYPE } = require("plugin/view");

const SECTIONS = [["overview", "Обзор"], ["stream", "Лента"], ["bento", "Бенто"], ["collections", "Подборки"], ["studio", "Конструктор"]];
const BLOCK = "```journal-stream\nview: stream\n```\n";

module.exports = function registerCommands(plugin, core) {
  async function open(view) {
    const ws = plugin.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (leaf) { if (view && leaf.view && leaf.view.goTo) leaf.view.goTo(view); }
    else { leaf = ws.getLeaf(true); await leaf.setViewState({ type: VIEW_TYPE, active: true, state: view ? { view } : {} }); }
    ws.revealLeaf(leaf);
  }
  plugin.openFeed = open;
  plugin.addRibbonIcon("layout-grid", "Journal Stream", () => open());
  plugin.addCommand({ id: "open", name: "Открыть ленту", callback: () => open() });
  for (const [id, label] of SECTIONS) plugin.addCommand({ id: "open-" + id, name: "Открыть раздел: " + label, callback: () => open(id) });
  plugin.addCommand({ id: "new-note", name: "Новая заметка (по правилам Journal Stream)", callback: () => plugin.createNote() });
  plugin.addCommand({ id: "insert-block", name: "Вставить блок journal-stream в заметку", editorCallback: (editor) => editor.replaceSelection(BLOCK) });
  plugin.addCommand({ id: "refresh", name: "Перечитать хранилище", callback: () => { for (const i of core.instances) { i.markDirty(); i.ctx.reload && i.ctx.reload(); } new Notice("Journal Stream: список заметок обновлён"); } });
};
