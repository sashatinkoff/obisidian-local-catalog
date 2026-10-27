// app/actions.js — все изменения состояния в одном месте (UI вызывает только их).
const { toggleTag, removeTag, merge, defaultFilter, toggleIn } = require("filters/state");
const { newSeed } = require("lib/random");
const { toState } = require("filters/presets");

const newDraft = () => ({ id: null, name: "", description: "", icon: "star" });
const draftOf = (p) => ({ id: p.id, name: p.name || "", description: p.description || "", icon: p.icon || "star" });

module.exports = function createActions(ctx) {
  const { store } = ctx;
  const filter = () => store.get().filter;
  const setFilter = (patch) => store.set({ filter: merge(filter(), patch), page: 1 });
  // Состояние «с чистого листа» — применяется при входе в раздел.
  const clean = () => ({ filter: defaultFilter(), quick: "all", page: 1, seed: newSeed(), presetId: null, collapsed: null, draft: null });

  return {
    setFilter,
    newDraft,
    resetFilter: () => store.set({ filter: defaultFilter(), page: 1, quick: "all", presetId: null }),
    setQuick: (quick) => store.set({ quick, page: 1, presetId: null }),
    shuffle: () => store.set({ seed: newSeed(), page: 1 }),
    toggleTag: (mode, tag) => store.set({ filter: toggleTag(filter(), mode, tag), page: 1 }),
    removeTag: (tag) => store.set({ filter: removeTag(filter(), tag), page: 1 }),
    toggleAttr: (a) => setFilter({ attrs: toggleIn(filter().attrs, a) }),
    toggleType: (t) => setFilter({ types: toggleIn(filter().types, t) }),
    toggleSource: (s) => setFilter({ sources: toggleIn(filter().sources, s) }),
    // Направление сортировки по времени: по умолчанию «сначала новые» (date-desc); любая другая сортировка → сначала новые
    toggleSortDir: () => setFilter({ sort: filter().sort === "date-desc" ? "date-asc" : "date-desc" }),
    setFullWidth: (fullWidth) => store.set({ fullWidth }),
    setPopupView: (popupView) => store.set({ popupView }),
    setOpenInNewTab: (openInNewTab) => store.set({ openInNewTab }),
    setTheme: (theme) => store.set({ theme }),
    // Повторный клик по активной кнопке возвращает автоопределение по ширине
    setViewModeTo: (viewMode) => store.set({ viewMode }),
    setViewMode: (mode) => store.set({ viewMode: store.get().viewMode === mode ? "auto" : mode }),
    setInsightsCount: (insightsCount) => store.set({ insightsCount }),
    setLayout: (layout) => store.set({ layout }),
    setCollapsed: (collapsed) => store.set({ collapsed }),
    nextPage: () => store.set({ page: store.get().page + 1 }),

    // Вход в раздел через навигацию: ВСЕГДА чистое состояние (фильтры, режим, страница, черновик конструктора).
    enterView(view) { store.set({ ...clean(), view }); if (ctx.scroll) ctx.scroll.toBlockTop(); },
    // Переход с переносом состояния (подборка, тег, день…) — без сброса.
    openPreset(preset, view = "stream") { store.set({ ...toState(preset), page: 1, presetId: preset.id || null, draft: null, view }); },
    applyPreset(preset) { store.set({ ...toState(preset), page: 1, presetId: preset.id || null }); },
    editPreset(preset) { store.set({ ...toState(preset), page: 1, presetId: preset.id, draft: draftOf(preset), view: "studio" }); },
    newPreset() { store.set({ ...clean(), draft: newDraft(), view: "studio" }); },
    // Клик по тегу в карточке: в Ленте/Бенто — переключить тег в фильтре; в других разделах — перейти в ленту с этим тегом.
    tagClick(tag) {
      const v = store.get().view;
      if (v === "stream" || v === "bento") store.set({ filter: toggleTag(filter(), "any", tag), page: 1 });
      else store.set({ ...clean(), filter: toggleTag(defaultFilter(), "any", tag), view: "stream" });
    },
    jumpToTag(tag) { store.set({ ...clean(), filter: toggleTag(defaultFilter(), "any", tag), view: "stream" }); },
    // Клик по типу в диаграмме обзора: в фильтрах остались только атрибуты — ставим соответствующий атрибут (иначе, для «текста» и canvas, — тип)
    jumpToType(type) {
      const attr = { image: "photo", video: "video", audio: "audio", quote: "quote", tasks: "task", link: "link" }[type];
      store.set({ ...clean(), filter: merge(null, attr ? { attrs: [attr] } : { types: [type] }), view: "stream" });
    },
    jumpToDay(day) { store.set({ ...clean(), filter: merge(null, { day }), view: "stream" }); },
  };
};
