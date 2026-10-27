// services/changelog.js — окно «История версий»: берёт раздел «## История версий» из README плагина и рисует его через MarkdownRenderer.
const { Modal } = require("obsidian");

function section(readme) {
  const m = readme.match(/^## История версий[^\n]*\n([\s\S]*?)(?=^## |\s*$(?![\s\S]))/m);
  return m ? m[1].trim() : "";
}

module.exports = function createChangelog({ app, storage, md, component }) {
  return async function open() {
    const text = section(await storage.readText("README.md")) || "История версий не найдена: проверьте README.md в папке плагина.";
    const modal = new Modal(app);
    modal.titleEl.setText("Journal Stream — история версий");
    modal.modalEl.classList.add("sf-changelog");
    await md.render(text, modal.contentEl, "");
    modal.open();
  };
};
module.exports.section = section;
