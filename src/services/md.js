// services/md.js — рендер markdown внутрь элемента через MarkdownRenderer Obsidian (с запасным вариантом — простой текст).
const { MarkdownRenderer } = require("obsidian");

module.exports = function createMarkdown({ app, component }) {
  async function render(md, el, path) {
    try {
      if (typeof MarkdownRenderer.render === "function") await MarkdownRenderer.render(app, md, el, path || "", component);
      else await MarkdownRenderer.renderMarkdown(md, el, path || "", component);
    } catch (e) {
      console.warn("[journal-stream] markdown fallback", e);
      el.textContent = md;
    }
  }
  return { render };
};
