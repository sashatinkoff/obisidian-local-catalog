// ui/card/footer.js — теги (пиллы), счётчик бэклинков (кроме режима плавающего окна), время чтения, «открыть».
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const chip = require("ui/common/chip");
const iconButton = require("ui/common/icon-button");
const { plural } = require("lib/ru");

module.exports = function cardFooter(ctx, post) {
  const active = new Set([...ctx.store.get().filter.any, ...ctx.store.get().filter.all]);
  const tags = post.tags.slice(0, 6);
  // В режиме плавающего окна ссылки вперёд/назад (бэклинки) на карточке скрыты
  const bl = ctx.store.get().popupView ? 0 : post.backlinks;
  return h("footer", { class: "sf-card__footer" },
    h("div", { class: "sf-card__tags" }, tags.map((t) => chip({ text: "#" + t, active: active.has(t), onClick: () => ctx.actions.tagClick(t), title: "Фильтр по тегу на этой странице" })), post.tags.length > 6 && h("span", { class: "sf-card__tagmore" }, `+${post.tags.length - 6}`)),
    h("div", { class: "sf-card__stats" },
      bl > 0 && h("span", { class: "sf-card__backlinks", title: "Входящие ссылки" }, icon("back", { size: 12 }), `${bl} ${plural(bl, ["бэклинк", "бэклинка", "бэклинков"])}`),
      post.feats && h("span", { class: "sf-card__read" }, `${post.feats.readMin} мин`),
      iconButton({ name: "arrowUpRight", title: "Открыть заметку", onClick: (e) => ctx.openNote(post.path, e) })));
};
