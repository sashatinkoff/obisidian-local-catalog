// ui/feed/tile-grid.js — общий движок плиток для Masonry, Bento и «Подборок».
// Плитки позиционируются абсолютно: у каждой своя высота, а «строка» не равна самой высокой плитке.
// Порядок — слева направо, потом сверху вниз: плитка занимает самую короткую колонку, а при равенстве
// (в пределах допуска) — самую левую. «Широкая» плитка (wide) занимает две соседние колонки.
const { h } = require("lib/dom");
const { columnCount } = require("lib/layout");
const skeletonGrid = require("ui/common/skeleton");

const TOLERANCE = 14;

module.exports = function tileGrid(ctx, cards, { wide = () => false, variant = "masonry" } = {}) {
  const items = cards.map((c) => h("div", { class: "sf-tilegrid__item" }, c));
  const skel = skeletonGrid(ctx, { count: Math.min(items.length, 6) });
  const el = h("div", { class: ["sf-tilegrid", "is-pending", `sf-tilegrid--${variant}`] }, skel, items);
  let dead = false, raf = null, ro = null, iro = null, lastW = 0;
  const width = () => el.clientWidth || (el.parentNode && el.parentNode.clientWidth) || 0;

  function layout() {
    raf = null;
    const W = width();
    if (dead || !W) return;
    const GAP = W < (ctx.config.singleColumnBelow ?? 560) ? 14 : 24;
    const cols = columnCount(W, ctx.config, GAP);
    const colW = (W - GAP * (cols - 1)) / cols;
    const hs = new Array(cols).fill(0);

    for (const item of items) {
      const span = Math.min(cols, wide(item.firstChild) ? 2 : 1);
      // лучшая стартовая колонка: минимальная «верхняя точка», при равенстве (допуск) — левее
      let best = 0, bestTop = Infinity;
      for (let c = 0; c + span <= cols; c++) {
        const top = Math.max(...hs.slice(c, c + span));
        if (top < bestTop - TOLERANCE) { best = c; bestTop = top; }
      }
      const w = colW * span + GAP * (span - 1);
      item.style.width = w + "px";
      item.style.left = best * (colW + GAP) + "px";
      item.style.top = bestTop + "px";
      const hgt = item.offsetHeight || 0;
      for (let k = 0; k < span; k++) hs[best + k] = bestTop + hgt + GAP;
    }
    el.style.height = Math.max(0, Math.max(...hs) - GAP) + "px";
    if (el.classList.contains("is-pending")) { el.classList.remove("is-pending"); skel.remove(); } // первая раскладка готова — шиммеры не нужны
  }
  const schedule = () => {
    if (dead || raf) return;
    raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(layout) : setTimeout(layout, 16);
  };

  cards.forEach((c) => c.sfReady && c.sfReady.then(schedule));
  if (typeof ResizeObserver !== "undefined") {
    // контейнер: реагируем только на смену ширины; плитки: на смену собственной высоты (картинки, подгрузка текста, «Показать ещё»)
    ro = new ResizeObserver(() => { const w = width(); if (w !== lastW) { lastW = w; schedule(); } });
    ro.observe(el);
    iro = new ResizeObserver(schedule);
    items.forEach((i) => iro.observe(i));
  }
  setTimeout(schedule, 0);
  setTimeout(schedule, 700);
  el.sfDispose = () => { dead = true; if (ro) ro.disconnect(); if (iro) iro.disconnect(); };
  el.sfRelayout = schedule;
  return el;
};
