// tests/fake-obsidian.js — заглушка модуля "obsidian" для тестов плагина (Node и браузерный harness).
// render(md, el) — как «рисовать» markdown; по умолчанию просто текст.
function makeObsidian({ render } = {}) {
  const modals = [], notices = [], settings = [];
  const el = (tag = "div") => { const e = document.createElement(tag); e.setText = (t) => { e.textContent = t; }; return e; };
  class Plugin {}
  class Modal { constructor(app) { this.app = app; this.titleEl = el(); this.contentEl = el(); this.modalEl = el(); this.modalEl.append(this.titleEl, this.contentEl); } open() { modals.push(this); if (typeof document !== "undefined" && document.body) document.body.append(this.modalEl); } close() { this.modalEl.remove(); } }
  class ItemView { constructor(leaf) { this.leaf = leaf; this.contentEl = el(); } }
  class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = el(); } }
  class MarkdownRenderChild { constructor(containerEl) { this.containerEl = containerEl; } }
  class Notice { constructor(m) { notices.push(m); } }
  const comp = (kind) => { const c = { kind, handlers: [], inputEl: {}, setValue(v) { c.value = v; return c; }, setPlaceholder() { return c; }, onChange(f) { c.onChangeFn = f; return c; }, setButtonText(t) { c.text = t; return c; }, setWarning() { return c; }, onClick(f) { c.onClickFn = f; return c; }, addOption(v, l) { (c.options ||= []).push([v, l]); return c; } }; return c; };
  class Setting {
    constructor(container) { this.rec = { name: "", desc: "", comps: [] }; settings.push(this.rec); }
    setName(n) { this.rec.name = n; return this; } setDesc(d) { this.rec.desc = d; return this; }
    _add(kind, cb) { const c = comp(kind); this.rec.comps.push(c); cb(c); return this; }
    addText(cb) { return this._add("text", cb); } addTextArea(cb) { return this._add("area", cb); } addToggle(cb) { return this._add("toggle", cb); }
    addDropdown(cb) { return this._add("dropdown", cb); } addButton(cb) { return this._add("button", cb); }
  }
  const MarkdownRenderer = { render: async (app, md, e) => { if (render) render(md, e); else e.append(document.createTextNode(md)); } };
  return { Plugin, Modal, ItemView, PluginSettingTab, MarkdownRenderChild, Notice, Setting, MarkdownRenderer, __modals: modals, __notices: notices, __settings: settings };
}
if (typeof module !== "undefined") module.exports = { makeObsidian };
