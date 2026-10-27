// services/presets.js — смарт-подборки в data/presets.json.
const { uid } = require("lib/misc");

const DEFAULT_PRESETS = [
  { id: "atomic", name: "Атомарные озарения недели", icon: "bolt", description: "Записи с высокой плотностью связей за последние 7 дней", quick: "all", filter: { any: ["мысли", "zettel"], minBacklinks: 3, period: "7d" } },
  { id: "voice", name: "Голосовые черновики", icon: "mic", description: "Аудио-заметки без обработки", quick: "all", filter: { attrs: ["audio"], not: ["архив"] } },
  { id: "video", name: "Видео-конспекты", icon: "video", description: "Заметки с видео", quick: "all", filter: { attrs: ["video"] } },
  { id: "quotes", name: "Цитаты", icon: "quote", description: "Выписки и цитаты", quick: "all", filter: { attrs: ["quote"] } },
  { id: "today", name: "В этот день", icon: "history", description: "Что вы писали в этот день в прошлые годы", quick: "today", filter: {} },
  { id: "random30", name: "Случайная выборка за период", icon: "dice", description: "Рандом из заметок за последние 30 дней — 🎲 перемешивает", quick: "random", filter: { period: "30d" } },
];

function createPresets({ db }) {
  const get = () => db.data.presets;
  // Подборкам без даты создания (встроенные и сохранённые старыми версиями) ставим дату появления в плагине, сохраняя их порядок.
  { const list = get(); if (list.some((p) => !p.createdAt)) { const base = Date.now() - list.length * 1000; db.data.presets = list.map((p, i) => (p.createdAt ? p : { ...p, createdAt: base + i * 1000 })); db.save(); } }
  return {
    list: () => get(),
    get: (id) => get().find((p) => p.id === id),
    save(preset) {
      const p = { ...preset, id: preset.id || uid("flt"), createdAt: preset.createdAt || Date.now() };
      const list = get(), i = list.findIndex((x) => x.id === p.id);
      db.data.presets = i >= 0 ? list.map((x, j) => (j === i ? p : x)) : [...list, p];
      db.save();
      return p;
    },
    remove(id) { db.data.presets = get().filter((p) => p.id !== id); db.save(); },
  };
}
module.exports = { DEFAULT_PRESETS, createPresets };
