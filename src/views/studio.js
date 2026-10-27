// views/studio.js — «Фильтры · DQL»: конструктор. Каждый вход через навигацию начинается с НОВОГО конструктора;
// редактирование существующей подборки открывается из «Подборок».
const { h } = require("lib/dom");
const filterPanel = require("ui/filters/filter-panel");
const metaPanel = require("ui/studio/meta-panel");
const actionBar = require("ui/studio/action-bar");
const dqlPanel = require("ui/studio/dql-panel");
const livePreview = require("ui/studio/live-preview");

module.exports = {
  id: "studio", title: "Фильтры · DQL", short: "Конструктор", icon: "code",
  async render(ctx, el) {
    const posts = ctx.repo.collect();
    let draft = ctx.store.get().draft;
    if (!draft) { draft = ctx.actions.newDraft(); ctx.store.set({ draft }); }

    const bar = actionBar(ctx, draft);
    const meta = metaPanel(ctx, draft);
    const panel = filterPanel(ctx, { posts, variant: "studio" });
    const live = livePreview(ctx, posts);
    const dql = dqlPanel(ctx);

    el.append(
      h("div", { class: "sf-hero" },
        h("h1", null, draft.id ? "Редактирование подборки" : "Новый смарт-фильтр"),
        h("p", null, "Соберите условия мышкой — справа появится готовый запрос (DQL для Dataview — по желанию)")),
      bar.el,
      h("div", { class: "sf-studio" },
        h("div", { class: "sf-studio__main" }, meta.el, panel.el),
        h("aside", { class: "sf-studio__side" }, live.el, dql.el)));
    return () => [meta, panel, live, dql].forEach((p) => p.dispose());
  },
};
