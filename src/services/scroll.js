// services/scroll.js — запоминание и восстановление прокрутки заметки с виджетом.
//
// Главное: прокручиваемый контейнер определяется НАДЁЖНО.
//  • сначала — элемент, на котором реально происходили события scroll (last): он гарантированно настоящий;
//  • затем — подсказка из прошлого сеанса (scrollerSel) и известные контейнеры Obsidian (.markdown-preview-view, .cm-scroller);
//  • и только потом — эвристика по overflow, причём ТОЛЬКО для элементов, которые действительно прокручиваются
//    (у промежуточных обёрток computed overflow-y бывает "auto" без прокрутки: из-за них раньше сохранялся scrollTop = 0).
//
// Остальные меры: позиция и высота фиксируются при клике по карточке (leave); пока идёт восстановление (hold), новые значения
// не сохраняются; высота виджета резервируется; восстановление «удерживается» 3 с (Obsidian может сам сдвинуть прокрутку после
// рендера); события от «мёртвого» виджета (заметку уже сменили) игнорируются. config.debug = true пишет ход дел в консоль.
const { debounce } = require("lib/async");

const KNOWN = ".markdown-preview-view, .cm-scroller";
const HINTS = ["markdown-preview-view", "cm-scroller", "view-content"];

module.exports = function createScroll({ session, key, log = () => {} }) {
  let rootEl = null, last = null, cancelled = false, frozen = false, held = false, holdTimer = null;
  const listeners = new Set();
  const alive = () => !!rootEl && rootEl.isConnected !== false && (rootEl.offsetHeight === undefined || rootEl.offsetHeight > 0);
  const scrollable = (n) => n.scrollHeight - n.clientHeight > 1;
  const hintOf = (t) => HINTS.find((c) => t.classList && t.classList.contains(c));

  function findScroller() {
    if (!rootEl) return null;
    if (last && last.isConnected !== false && last.contains && last.contains(rootEl)) return last;
    if (rootEl.closest) {
      const hint = (session.get() || {}).scrollerSel;
      const byHint = hint && rootEl.closest("." + hint);
      if (byHint) return byHint;
      const known = rootEl.closest(KNOWN);
      if (known) return known;
    }
    for (let n = rootEl.parentElement || rootEl.parentNode; n && n.nodeType === 1; n = n.parentElement || n.parentNode) {
      const oy = typeof getComputedStyle === "function" ? getComputedStyle(n).overflowY : "";
      if ((oy === "auto" || oy === "scroll" || oy === "overlay") && scrollable(n)) return n;
    }
    return rootEl.closest ? rootEl.closest(".view-content") : null;
  }
  const snapshot = (sc) => { session.patch({ scroll: sc.scrollTop, height: rootEl.offsetHeight || undefined, scrollerSel: hintOf(sc) }); log("save", sc.scrollTop, hintOf(sc) || sc.className); };

  const save = debounce((t) => { if (!frozen && !held && alive()) snapshot(t); }, 80);
  const onScroll = (e) => {
    const t = e.target;
    if (!(rootEl && t && t.nodeType === 1 && t.contains && t.contains(rootEl))) return;
    last = t;
    listeners.forEach((cb) => cb(t.scrollTop));
    save(t);
  };
  const onUser = () => { cancelled = true; };
  const USER = ["wheel", "touchmove", "keydown"];

  const g = (window.__sfScrollOff = window.__sfScrollOff || {});
  if (g[key]) g[key]();               // не копим слушатели при повторных перерисовках блока
  if (document.addEventListener) {
    document.addEventListener("scroll", onScroll, true);
    USER.forEach((e) => document.addEventListener(e, onUser, true));
    g[key] = () => { document.removeEventListener("scroll", onScroll, true); USER.forEach((e) => document.removeEventListener(e, onUser, true)); };
  }

  const release = () => { held = false; clearTimeout(holdTimer); };
  return {
    setRoot(el) { rootEl = el; },
    destroy() { if (g[key]) { g[key](); delete g[key]; } listeners.clear(); clearTimeout(holdTimer); cancelled = true; },
    scroller: () => findScroller(),
    onScroll(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    toTop() { const sc = findScroller(); if (!sc) return; if (sc.scrollTo) sc.scrollTo({ top: 0, behavior: "smooth" }); else sc.scrollTop = 0; },

    // Приостановить сохранение позиции (вызывается до построения интерфейса, если предстоит восстановление).
    hold() { held = true; clearTimeout(holdTimer); holdTimer = setTimeout(release, 16000); },

    // Восстановить позицию: повторяем, пока страница не станет достаточно высокой, затем удерживаем 3 с.
    restore(top, onDone) {
      held = true; cancelled = false; frozen = false;
      clearTimeout(holdTimer); holdTimer = setTimeout(release, 16000);
      const t0 = Date.now(); let okSince = 0;
      const finish = (why) => { log("restore done:", why); release(); if (onDone) onDone(); };
      const tick = () => {
        if (!top) return finish("нет позиции");
        if (cancelled) return finish("пользователь прокручивает сам");
        const sc = findScroller();
        if (sc) {
          if (Math.abs(sc.scrollTop - top) >= 2) { sc.scrollTop = top; okSince = 0; log("restore set", top, "→", sc.scrollTop, "высота", sc.scrollHeight, hintOf(sc) || sc.className); }
          else if (!okSince) okSince = Date.now();
        } else log("restore: контейнер прокрутки не найден");
        if (okSince && Date.now() - okSince > 3000) return finish("позиция удержана");
        if (Date.now() - t0 > 12000) return finish("таймаут");
        setTimeout(tick, 120);
      };
      tick();
    },

    // Уходим со страницы (клик по карточке): зафиксировать позицию и высоту и больше их не менять.
    leave() {
      const sc = findScroller(), saved = (session.get() || {}).scroll || 0;
      // не затираем верную позицию нулём от элемента, который на самом деле не прокручивается
      if (sc && alive() && !held && !(sc.scrollTop === 0 && saved > 0 && sc !== last)) snapshot(sc);
      frozen = true;
    },

    // Вход в раздел: показать верх блока.
    toBlockTop() {
      const sc = findScroller();
      if (!sc || !rootEl.getBoundingClientRect) return;
      const delta = rootEl.getBoundingClientRect().top - sc.getBoundingClientRect().top;
      if (delta < 0) sc.scrollTop += delta - 8;
      snapshot(sc);
    },
  };
};
