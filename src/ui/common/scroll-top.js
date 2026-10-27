// ui/common/scroll-top.js — плавающая кнопка «Наверх».
// Раньше была position: sticky внутри виджета — она ломалась, если у какого-то родителя есть overflow (sticky цепляется за него,
// а не за прокручиваемую область заметки). Теперь кнопка — position: fixed в <body>, а её положение (правый нижний угол
// ПРОКРУЧИВАЕМОЙ области заметки) считается из координат контейнера прокрутки. Появляется после прокрутки вниз на 400px.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");

const SHOW_AFTER = 400;

module.exports = function scrollTopButton(ctx) {
  const reg = (window.__sfFab = window.__sfFab || {});
  if (reg[ctx.scrollKey]) reg[ctx.scrollKey].remove();   // при перерисовке блока не плодим кнопки

  const wrap = h("div", { class: "sf-fab is-hidden", dataset: { sfTheme: ctx.store.get().theme } },
    h("button", { type: "button", class: "sf-fab__btn", title: "Наверх", "aria-label": "Прокрутить вверх", onClick: () => ctx.scroll.toTop() }, icon("arrowUp", { size: 18 })));
  document.body.appendChild(wrap);
  reg[ctx.scrollKey] = wrap;

  function place(top) {
    const sc = ctx.scroll.scroller();
    const alive = ctx.rootEl && ctx.rootEl.isConnected !== false;
    const y = typeof top === "number" ? top : sc ? sc.scrollTop : 0;
    if (sc && sc.getBoundingClientRect) {
      const r = sc.getBoundingClientRect();
      const vw = window.innerWidth || 0, vh = window.innerHeight || 0;
      if (r.width && vw) { wrap.style.right = Math.max(8, vw - r.right + 16) + "px"; wrap.style.bottom = Math.max(8, vh - r.bottom + 20) + "px"; }
    }
    wrap.classList.toggle("is-hidden", !(alive && sc && y > SHOW_AFTER));
  }
  ctx.scroll.onScroll(place);
  const onResize = () => place();
  if (window.addEventListener) window.addEventListener("resize", onResize);
  ctx.store.subscribe((s) => { wrap.dataset.sfTheme = s.theme; }, ["theme"]);
  // Виджет исчез (ушли в другую заметку) — убираем кнопку; пока жив — подстраиваем положение (панели могут сдвигаться)
  const timer = setInterval(() => {
    if (ctx.rootEl && ctx.rootEl.isConnected === false) { wrap.remove(); clearInterval(timer); } else place();
  }, 1000);
  if (ctx.onDispose) ctx.onDispose(() => { clearInterval(timer); wrap.remove(); if (window.removeEventListener) window.removeEventListener("resize", onResize); if (reg[ctx.scrollKey] === wrap) delete reg[ctx.scrollKey]; });
  return wrap;
};
