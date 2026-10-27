// plugin/view.js — отдельная вкладка Obsidian с лентой (ItemView). Сохраняет состояние и прокрутку между открытиями заметок.
const { ItemView } = require("obsidian");
const { mount } = require("app/main");
const { hideSidebars } = require("plugin/sidebar");

const VIEW_TYPE = "journal-stream-view";
let counter = 0;

class JournalStreamView extends ItemView {
  constructor(leaf, core) {
    super(leaf);
    this.core = core;
    this.input = {};
    this.uid = "tab-" + (leaf && leaf.id ? leaf.id : ++counter);
    this.inst = null;
    this.mounting = null;
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Journal Stream"; }
  getIcon() { return "layout-grid"; }

  async onOpen() { await this.ensure(); }
  async onClose() { this.unmount(); }

  getState() { return { view: this.inst ? this.inst.ctx.store.get().view : this.input.view }; }
  async setState(state, result) {
    if (state && state.view) {
      if (this.inst) this.inst.ctx.actions.enterView(state.view);
      else this.input.view = state.view;
    }
    if (super.setState) await super.setState(state, result);
  }

  // Открыть нужный раздел (команды плагина)
  goTo(view) { if (this.inst) this.inst.ctx.actions.enterView(view); else this.input.view = view; }

  ensure() {
    if (this.inst || this.mounting) return this.mounting;
    const container = this.contentEl;
    container.empty && container.empty();
    container.classList.add("sf-view-host");
    this.mounting = mount(this.core, { container, input: { ...this.input, id: this.uid }, sourcePath: "", component: this })
      .then((inst) => { this.inst = inst; this.hideSidebar(); })
      .catch((e) => { console.error("[journal-stream]", e); container.createEl("pre", { text: "[journal-stream] ошибка запуска:\n" + (e && e.stack ? e.stack : e) }); })
      .finally(() => { this.mounting = null; });
    return this.mounting;
  }
  // Опция «Скрывать боковую панель при открытии ленты»: прячем панели, при закрытии вкладки (если включено) — возвращаем.
  hideSidebar() {
    const s = this.core.db.data.settings;
    if (!s.hideSidebar || s.hideSidebar === "none" || this.restoreSidebar) return;
    const restore = hideSidebars(this.core.app, s.hideSidebar);
    this.restoreSidebar = s.restoreSidebar === false ? () => {} : restore;
  }
  unmount() {
    if (this.restoreSidebar) { try { this.restoreSidebar(); } catch (e) {} this.restoreSidebar = null; }
    if (this.inst) { this.input.view = this.inst.ctx.store.get().view; this.inst.destroy(); this.inst = null; }
    this.contentEl.empty && this.contentEl.empty();
  }
  async remount() { this.unmount(); await this.ensure(); }
}
module.exports = { JournalStreamView, VIEW_TYPE };
