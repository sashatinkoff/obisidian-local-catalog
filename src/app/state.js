// app/state.js — реактивное состояние экрана.
// • Между перерисовками блока (переход в другую заметку и назад) состояние берётся из session — в памяти.
// • Предпочтения UI (раскладка, полная ширина) сохраняются в едином файле данных.
const { createStore } = require("lib/store");
const { newSeed } = require("lib/random");
const { merge } = require("filters/state");

const normLayout = (l) => (l === "timeline" || l === "masonry" ? l : l === "flow" ? "timeline" : "masonry");

module.exports = function createAppState({ db, config, input, session }) {
  const ui = db.data.ui || {};
  const saved = session.get() && session.get().state;
  const fresh = {
    view: input.view || config.defaultView,
    layout: normLayout(input.layout || ui.layout || config.layout),
    fullWidth: !!(input.fullWidth ?? ui.fullWidth ?? config.fullWidth),
    openInNewTab: !!(input.openInNewTab ?? ui.openInNewTab ?? config.openInNewTab),
    popupView: !!(input.popupView ?? ui.popupView ?? config.popupView),
    theme: input.theme || ui.theme || config.theme,
    viewMode: input.viewMode || ui.viewMode || "auto",   // auto | mobile | desktop — принудительный вид
    insightsCount: Number(input.insightsCount ?? ui.insightsCount ?? config.insightsCount) || 3,
    quick: "all", filter: merge(input.filter), seed: newSeed(), page: 1, collapsed: null, presetId: null, draft: null,
  };
  const store = createStore(saved ? { ...fresh, ...saved, layout: normLayout(saved.layout) } : fresh);
  const restored = !!saved;

  store.subscribe((s) => session.patch({ state: s }));
  store.subscribe((s) => { db.data.ui = { ...db.data.ui, layout: s.layout, fullWidth: s.fullWidth, openInNewTab: s.openInNewTab, popupView: s.popupView, theme: s.theme, insightsCount: s.insightsCount, viewMode: s.viewMode }; db.save(); }, ["layout", "fullWidth", "openInNewTab", "popupView", "theme", "insightsCount", "viewMode"]);
  session.patch({ state: store.get() });
  return { store, restored };
};
