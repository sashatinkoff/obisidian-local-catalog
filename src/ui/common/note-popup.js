// ui/common/note-popup.js — плавающее окно просмотра заметки (reading view через MarkdownRenderer) вместо открытия в редакторе.
// Окно по центру экрана; основной контент затемнён (клик по затемнению закрывает окно).
// Включается настройкой «Открывать заметки в плавающем окне» (кнопка-глаз в навигации). Окно одно на вид: повторное открытие
// показывает другую заметку в том же окне. Его можно перетаскивать за заголовок и менять размер; Esc закрывает.
// В шапке окна — дата и теги; ссылки вперёд и назад (бэклинки) в этом режиме не показываются.
// Внутренние ссылки заметки открываются в этом же окне (кнопка «назад» — по истории), теги применяют фильтр ленты.
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");
const { fmtDateTime } = require("lib/date");
const { stripFrontmatter } = require("lib/text");
let Scope = null; try { Scope = require("obsidian").Scope || null; } catch (e) { /* вне Obsidian */ }

module.exports = function createNotePopup(ctx) {
  let win = null, parts = null, history = [], overlay = null, scope = null, pushed = false;

  const fileOf = (linktext, source) => {
    const { app } = ctx;
    return app.vault.getAbstractFileByPath(linktext) || (app.metadataCache.getFirstLinkpathDest && app.metadataCache.getFirstLinkpathDest(String(linktext).split("#")[0], source || "")) || null;
  };
  const postOf = (path) => (ctx.repo.collect().find((p) => p.path === path) || null);

  function close() {
    if (!win) return;
    detachBack();
    if (document.removeEventListener) document.removeEventListener("keydown", onKey);
    overlay.remove(); win = parts = overlay = null; history = [];
  }
  const onKey = (e) => { if (e.key === "Escape") close(); };

  // Кнопка/жест «назад» на телефоне: сначала возвращает к предыдущей заметке окна, затем закрывает окно.
  // Два независимых канала: стек областей клавиатуры Obsidian (Escape — его же использует «назад» для модальных окон)
  // и popstate веб-вью (на случай, если система откатывает историю браузера).
  const goBack = () => { if (history.length > 1) { history.pop(); const prev = history.pop(); if (prev) { show(prev); return; } } close(); };
  const onPop = () => { pushed = false; goBack(); if (win) attachHistory(); };
  function attachHistory() {
    try { if (typeof window !== "undefined" && window.history && window.history.pushState && window.addEventListener) { window.history.pushState({ sfPopup: 1 }, ""); pushed = true; window.addEventListener("popstate", onPop); } } catch (e) { pushed = false; }
  }
  function attachBack() {
    try { const km = ctx.app.keymap; if (Scope && km && km.pushScope) { scope = new Scope(); scope.register([], "Escape", () => { goBack(); return false; }); km.pushScope(scope); } } catch (e) { scope = null; }
    attachHistory();
  }
  function detachBack() {
    try { if (scope && ctx.app.keymap && ctx.app.keymap.popScope) ctx.app.keymap.popScope(scope); } catch (e) { /* ignore */ }
    scope = null;
    try {
      if (typeof window !== "undefined" && window.removeEventListener) window.removeEventListener("popstate", onPop);
      if (pushed && window.history && window.history.state && window.history.state.sfPopup && window.history.back) window.history.back();
    } catch (e) { /* ignore */ }
    pushed = false;
  }

  function build() {
    const back = h("button", { type: "button", class: "sf-iconbtn sf-npop__back", title: "Назад", "aria-label": "Назад", onClick: () => { if (history.length > 1) goBack(); } }, icon("arrowLeft", { size: 16 }));
    const title = h("h2", { class: "sf-npop__title" });
    const editBtn = h("button", { type: "button", class: "sf-iconbtn", title: "Открыть в редакторе", "aria-label": "Открыть в редакторе" }, icon("arrowUpRight", { size: 16 }));
    const closeBtn = h("button", { type: "button", class: "sf-iconbtn", title: "Закрыть", "aria-label": "Закрыть", onClick: close }, icon("x", { size: 16 }));
    const head = h("div", { class: "sf-npop__head" }, back, title, editBtn, closeBtn);
    const meta = h("div", { class: "sf-npop__meta" });
    const body = h("div", { class: "sf-npop__body markdown-preview-view markdown-rendered" });
    const el = h("div", { class: "sf-npop sf-root", role: "dialog", "aria-label": "Просмотр заметки", dataset: { sfTheme: ctx.store.get().theme } }, head, meta, body);
    overlay = h("div", { class: "sf-npop-overlay", dataset: { sfTheme: ctx.store.get().theme }, onClick: (e) => { if (e.target === overlay) close(); } }, el);
    document.body.appendChild(overlay);
    if (document.addEventListener) document.addEventListener("keydown", onKey);
    attachBack();
    drag(el, head);
    const offTheme = ctx.store.subscribe((s) => { el.dataset.sfTheme = s.theme; overlay.dataset.sfTheme = s.theme; }, ["theme"]);
    const rm = overlay.remove.bind(overlay); overlay.remove = () => { offTheme(); rm(); };
    // клики внутри текста: внутренние ссылки — в этом же окне, теги — фильтр ленты
    body.addEventListener("click", (e) => {
      for (let n = e.target; n && n !== body; n = n.parentNode) {
        if (n.tagName !== "A") continue;
        const cls = n.classList;
        if (cls.contains("tag")) { e.preventDefault(); const t = String(n.textContent).replace(/^#/, ""); if (t) ctx.actions.tagClick(t); return; }
        if (cls.contains("internal-link")) { e.preventDefault(); const href = n.getAttribute("data-href") || n.getAttribute("href"); const f = fileOf(href, parts.path); if (f) show(f.path); return; }
        return; // внешние ссылки — штатно
      }
    });
    return { el, title, meta, body, editBtn, back, path: null };
  }

  function drag(el, handle) {
    if (!handle.addEventListener) return;
    handle.addEventListener("pointerdown", (e) => {
      if (e.target && e.target.closest && e.target.closest("button")) return;
      const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      el.style.position = "fixed"; el.style.margin = "0"; el.style.left = r.left + "px"; el.style.top = r.top + "px";
      const move = (m) => { el.style.left = Math.max(0, Math.min(window.innerWidth - 80, m.clientX - dx)) + "px"; el.style.top = Math.max(0, Math.min(window.innerHeight - 40, m.clientY - dy)) + "px"; };
      const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); };
      document.addEventListener("pointermove", move); document.addEventListener("pointerup", up);
    });
  }

  async function show(path) {
    const file = fileOf(path, "");
    if (!file) { ctx.app.workspace.openLinkText(path, "", false); return; }
    if (!win) { parts = build(); win = parts.el; }
    parts.path = file.path;
    if (history[history.length - 1] !== file.path) history.push(file.path);
    parts.back.style.display = history.length > 1 ? "" : "none";
    const post = postOf(file.path);
    parts.title.textContent = (post && post.title) || file.basename || file.path;
    parts.editBtn.onclick = null;
    parts.editBtn.addEventListener("click", (e) => { const p = file.path; close(); ctx.app.workspace.openLinkText(p, "", !!(e && (e.ctrlKey || e.metaKey)) || !!ctx.store.get().openInNewTab); });
    // шапка: дата и теги (без ссылок вперёд/назад)
    clear(parts.meta);
    if (post) {
      parts.meta.append(h("span", { class: "sf-npop__date" }, fmtDateTime(post.ts, post.hasTime)));
      for (const t of post.tags.slice(0, 8)) parts.meta.append(h("a", { class: "sf-chip sf-chip--tag is-clickable", href: "#", onClick: (e) => { e.preventDefault(); ctx.actions.tagClick(t); } }, "#" + t));
    }
    clear(parts.body);
    parts.body.append(h("div", { class: "sf-skeleton" }, h("i"), h("i"), h("i")));
    const my = (parts.token = (parts.token || 0) + 1);
    try {
      const raw = await ctx.app.vault.cachedRead(file);
      if (!win || parts.token !== my) return;
      clear(parts.body);
      await ctx.md.render(stripFrontmatter(raw), parts.body, file.path);
      if (parts.body.scrollTop) parts.body.scrollTop = 0;
    } catch (e) {
      console.error("[journal-stream] окно просмотра", e);
      if (win) { clear(parts.body); parts.body.append(h("div", { class: "sf-media-missing" }, "Не удалось прочитать заметку")); }
    }
  }

  ctx.onDispose(close);
  return { open: (linktext, source) => show(fileOf(linktext, source) ? fileOf(linktext, source).path : linktext), close, isOpen: () => !!win, el: () => overlay };
};
