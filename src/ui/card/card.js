// ui/card/card.js — карточка поста: скелетон сразу, тело — после чтения заметки.
const { h, clear } = require("lib/dom");
const types = require("types");
const header = require("ui/card/header");
const footer = require("ui/card/footer");
const bodies = require("ui/card/bodies");

const INTERACTIVE = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "VIDEO", "AUDIO", "LABEL"]);
// Клик по ссылке/кнопке/плееру/чипу обрабатывается самим элементом; по «пустому» месту карточки — открывает заметку.
function isInteractive(target, root) {
  for (let n = target; n && n !== root; n = n.parentNode) {
    if (INTERACTIVE.has(n.tagName) || (n.classList && (n.classList.contains("sf-chip") || n.classList.contains("sf-audio__wave")))) return true;
  }
  return false;
}
const hasSelection = () => { try { const s = window.getSelection && window.getSelection(); return !!s && String(s).length > 0; } catch (e) { return false; } };

module.exports = function createCard(ctx, post) {
  const el = h("article", { class: "sf-card", dataset: { path: post.path } });
  let loaded = false;
  el.addEventListener("click", (e) => { if (!isInteractive(e.target, el) && !hasSelection()) ctx.openNote(post.path, e); });

  function frame() {
    clear(el);
    el.className = ["sf-card", "is-clickable", `sf-card--${post.type}`, ctx.flags.isPinned(post) && "is-pinned", ctx.flags.isFavorite(post) && "is-fav"].filter(Boolean).join(" ");
    const body = h("div", { class: "sf-card__body" });
    el.append(header(ctx, post, frame));
    if (post.hasOwnTitle) el.append(h("a", { class: "sf-card__title", href: "#", "data-href": post.path, onClick: (e) => { e.preventDefault(); ctx.openNote(post.path, e); } }, post.title));
    el.append(body, footer(ctx, post));
    return body;
  }

  async function hydrate() {
    let body = frame();
    if (!loaded) body.append(h("div", { class: "sf-skeleton" }, h("i"), h("i"), h("i")));
    try {
      const feats = await ctx.content.load(post);
      if (!feats) return;
      const before = post.type;
      post.type = types.resolve(post, feats).id;
      loaded = true;
      body = frame(); // тип мог измениться — перерисовываем рамку
      await bodies.get(post.type).render(ctx, post, feats, body);
      if (before !== post.type) el.dataset.retyped = before;
    } catch (e) {
      console.error("[journal-stream] карточка", post.path, e);
      body.append(h("div", { class: "sf-media-missing" }, "Не удалось прочитать заметку"));
    }
  }
  el.sfReady = hydrate();
  return el;
};
