// plugin/code-block.js — встраивание ленты в заметку: ```journal-stream (параметры — в блоке, см. block-params.js).
const { MarkdownRenderChild } = require("obsidian");
const { mount } = require("app/main");
const { parseBlock } = require("plugin/block-params");

module.exports = function registerCodeBlock(plugin, core) {
  plugin.registerMarkdownCodeBlockProcessor("journal-stream", async (source, el, mdCtx) => {
    const { input, errors } = parseBlock(source);
    const child = new MarkdownRenderChild(el);
    mdCtx.addChild(child);
    el.classList.add("sf-codeblock");
    if (errors.length) el.createEl("div", { cls: "sf-block-warn", text: errors.join(" · ") });
    const host = el.createEl("div");
    try {
      const inst = await mount(core, { container: host, input: { id: "block", ...input }, sourcePath: mdCtx.sourcePath, component: child });
      child.onunload = () => inst.destroy();
    } catch (e) {
      console.error("[journal-stream]", e);
      host.createEl("pre", { text: "[journal-stream] ошибка запуска:\n" + (e && e.stack ? e.stack : e) });
    }
  });
};
