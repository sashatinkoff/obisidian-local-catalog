// Фото: сетка до 4 изображений с «+N».
const { h } = require("lib/dom");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");

async function render(ctx, post, feats, el) {
  const imgs = feats.byKind("image");
  const shown = imgs.slice(0, 4);
  const grid = h("div", { class: ["sf-images", `sf-images--${shown.length}`] });
  shown.forEach((m, i) => {
    const src = ctx.media.resolve(m.target, post.path);
    if (!src) return;
    const cell = h("a", { class: "sf-images__cell", href: "#", onClick: (e) => { e.preventDefault(); ctx.openNote(post.path, e); } }, h("img", { src, loading: "lazy", alt: m.alt || m.target }));
    if (i === 3 && imgs.length > 4) cell.append(h("span", { class: "sf-images__more" }, `+${imgs.length - 4}`));
    grid.append(cell);
  });
  if (grid.children.length) el.append(grid);
  await renderExcerpt(ctx, post, feats, el, { max: 300 });
}
module.exports = { render };
