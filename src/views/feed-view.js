// views/feed-view.js — фабрика экранов-лент (Лента, Бенто): тулбар (поиск, подборки) + быстрые режимы + фильтры + лента.
const { h, clear } = require("lib/dom");
const toolbar = require("ui/feed/toolbar");
const quickbar = require("ui/filters/quickbar");
const filterPanel = require("ui/filters/filter-panel");
const feed = require("ui/feed/feed");
const pipeline = require("filters/pipeline");
const mobileBar = require("ui/feed/mobile-bar");

module.exports = function createFeedView({ id, title, icon, fixedLayout }) {
  return {
    id, title, icon,
    async render(ctx, el) {
      const { store, config } = ctx;
      const posts = ctx.repo.collect();

      const refresh = () => { ctx.repo.refresh(); ctx.content.clear(); ctx.indexer.reset(); ctx.reload(); };
      // Мобильная версия: освобождаем экран — только «Фильтры» (всё в модальном окне) и краткая сводка; иначе — шапка, режимы, панель.
      const mobile = !!(ctx.rootEl && ctx.rootEl.classList.contains("is-mobile"));
      const top = mobile
        ? (() => { const b = mobileBar(ctx, { posts, withLayouts: !fixedLayout, onRefresh: refresh }); return { els: [b.el], setCount: b.setCount, dispose: b.dispose }; })()
        : (() => {
          const tb = toolbar(ctx, { title, posts, withLayouts: !fixedLayout, onRefresh: refresh });
          const qb = quickbar(ctx, { posts }), fp = filterPanel(ctx, { posts, variant: "stream" });
          return { els: [tb.el, qb.el, fp.el], setCount: tb.setCount, dispose: () => { tb.dispose(); qb.dispose(); fp.dispose(); } };
        })();
      const region = h("div", { class: "sf-feed-region" });
      el.append(...top.els, region);

      let current = null;
      let keepTimer = null;
      function drawFeed() {
        const s = store.get();
        // Пока лента перестраивается, держим прежнюю высоту — иначе страница «схлопывается» и прокрутка прыгает вверх.
        const prevH = region.offsetHeight;
        if (prevH) { region.style.minHeight = prevH + "px"; clearTimeout(keepTimer); keepTimer = setTimeout(() => { region.style.minHeight = ""; }, 700); }
        const { list } = pipeline.run(posts, s, { config, flags: ctx.flags });
        top.setCount(list.length);
        if (current && current.sfDispose) current.sfDispose();
        clear(region);
        current = feed(ctx, { posts: list, layout: fixedLayout || s.layout, page: s.page });
        region.append(current);
      }
      drawFeed();
      let unsub = store.subscribe(drawFeed, ["filter", "quick", "seed", "layout", "page"]);

      // Фоновая индексация текстов (поиск по тексту, точные типы/цитаты): сразу при deepScan, иначе — когда браузер свободен
      if (config.deepScan || config.autoIndex !== false) {
        const start = () => ctx.indexer.ensure(posts).then(drawFeed).catch((e) => console.warn("[journal-stream] индексация", e));
        const t = setTimeout(start, config.deepScan ? 0 : 600);
        const prev = unsub;
        unsub = () => { clearTimeout(t); prev(); };
      }
      return () => { clearTimeout(keepTimer); unsub(); if (current && current.sfDispose) current.sfDispose(); top.dispose(); };
    },
  };
};
