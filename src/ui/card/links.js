// ui/card/links.js — клики по ссылкам внутри отрисованного markdown карточки:
// • #тег → фильтр на этой странице (а не глобальный поиск Obsidian);
// • [[заметка]] → открытие по правилам виджета (вкладка из настройки, Ctrl/Cmd — новая).
module.exports = function hookLinks(ctx, root, post) {
  root.addEventListener("click", (e) => {
    let a = e.target;
    while (a && a !== root && a.tagName !== "A") a = a.parentNode;
    if (!a || a === root) return;
    const cls = a.classList;
    if (cls.contains("tag")) {
      e.preventDefault(); e.stopPropagation();
      ctx.actions.tagClick((a.getAttribute("href") || a.textContent || "").replace(/^#/, ""));
    } else if (cls.contains("internal-link")) {
      e.preventDefault(); e.stopPropagation();
      ctx.openLink(a.getAttribute("data-href") || a.getAttribute("href") || a.textContent, post.path, e);
    }
  }, true);
};
