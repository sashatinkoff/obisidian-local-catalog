// Canvas: плитка-ссылка на .canvas + текст.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");

async function render(ctx, post, feats, el) {
  const m = feats.byKind("canvas")[0];
  if (m) {
    const f = ctx.media.resolveFile(m.target, post.path);
    el.append(h("a", { class: "sf-canvas", href: "#", onClick: (e) => { e.preventDefault(); ctx.openNote(f ? f.path : post.path, e); } },
      icon("share", { size: 18 }), h("span", { class: "sf-canvas__name" }, m.target.split("/").pop()), h("span", { class: "sf-canvas__open" }, "Открыть в Canvas", icon("arrowUpRight", { size: 13 }))));
  }
  await renderExcerpt(ctx, post, feats, el, { max: 260 });
}
module.exports = { render };
