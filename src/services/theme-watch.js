// services/theme-watch.js — следит за темой Obsidian (класс theme-dark / theme-light на <body>).
// Когда пользователь переключает тему Obsidian, выбор темы в виджете сбрасывается на «auto» (следовать глобальной теме).
module.exports = function watchObsidianTheme(ctx) {
  if (typeof MutationObserver === "undefined" || !document.body) return () => {};
  const isDark = () => document.body.classList.contains("theme-dark");
  let was = isDark();
  const mo = new MutationObserver(() => {
    if (ctx.rootEl && ctx.rootEl.isConnected === false) { mo.disconnect(); return; } // виджет исчез
    const now = isDark();
    if (now !== was) { was = now; if (ctx.store.get().theme !== "auto") ctx.actions.setTheme("auto"); }
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
};
