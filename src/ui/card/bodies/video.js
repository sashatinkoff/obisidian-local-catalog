// Видео-заметка: нативный <video> + превью текста.
const { h } = require("lib/dom");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");

async function render(ctx, post, feats, el) {
  const m = feats.byKind("video")[0];
  const src = m && ctx.media.resolve(m.target, post.path);
  if (src) el.append(h("div", { class: "sf-video" }, h("video", { src, controls: true, preload: "metadata", playsinline: true }), h("span", { class: "sf-video__badge" }, m.target.split("/").pop())));
  else el.append(h("div", { class: "sf-media-missing" }, "Видеофайл не найден: " + (m ? m.target : "—")));
  await renderExcerpt(ctx, post, feats, el, { max: 280 });
}
module.exports = { render };
