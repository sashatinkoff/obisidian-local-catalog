// Цитата: крупный блок-цитата + остальной текст.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");
const { truncateMarkdown } = require("lib/text");
const hookLinks = require("ui/card/links");

async function render(ctx, post, feats, el) {
  const q = feats.quotes[0];
  if (q) {
    const box = h("blockquote", { class: "sf-quote" }, icon("quote", { size: 18, cls: "sf-quote__mark" }));
    const txt = h("div", { class: "sf-quote__text markdown-rendered" });
    box.append(txt);
    el.append(box);
    await ctx.md.render(truncateMarkdown(q.text, 320).text, txt, post.path);
    hookLinks(ctx, txt, post);
    if (q.callout && q.callout.title) box.append(h("cite", { class: "sf-quote__cite" }, q.callout.title));
  }
  await renderExcerpt(ctx, post, feats, el, { quotes: true, max: 220 });
}
module.exports = { render };
