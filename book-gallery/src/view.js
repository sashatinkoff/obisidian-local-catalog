// src/view.js — отдельная вкладка «Каталог книг» (открывается командой или кнопкой на боковой панели).

const { ItemView } = ctx.obsidian;
const VIEW_TYPE = "book-gallery-view";

class BookGalleryView extends ItemView {
    constructor(leaf) {
        super(leaf);
        this.host = null;
    }

    getViewType() {
        return VIEW_TYPE;
    }

    getDisplayText() {
        return "Каталог книг";
    }

    getIcon() {
        return "book-open";
    }

    async onOpen() {
        this.contentEl.empty();
        this.contentEl.addClass("book-gallery-view");
        const holder = this.contentEl.createDiv();
        // в отдельной вкладке заголовок «Каталог…» остаётся из настроек, ширина и так полная
        this.host = ctx.plugin.createHost(holder, { fullWidth: false }, this);
        await this.host.render();
    }

    async onClose() {
        if (this.host) this.host.destroy();
        this.host = null;
    }
}

module.exports = { BookGalleryView, VIEW_TYPE };
