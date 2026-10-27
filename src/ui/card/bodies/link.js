// Ссылка: превью внешнего URL (домен + адрес) + текст.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");

async function render(ctx, post, feats, el) {
  const url = feats.external[0];
  if (url) {
    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) {}
    el.append(h("a", { class: "sf-extlink", href: url, target: "_blank", rel: "noopener" }, icon("link", { size: 16 }), h("span", { class: "sf-extlink__main" }, h("span", { class: "sf-extlink__host" }, host), h("span", { class: "sf-extlink__url" }, url)), icon("arrowUpRight", { size: 14 })));
  }
  await renderExcerpt(ctx, post, feats, el, { max: 220 });
}
module.exports = { render };
