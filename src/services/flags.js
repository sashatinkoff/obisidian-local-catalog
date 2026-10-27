// services/flags.js — избранное и закрепы (хранятся в едином файле данных; файлы заметок не изменяются).
module.exports = function createFlags({ db }) {
  const data = db.data.flags;
  const get = (p) => data[p.path] || {};
  function toggle(p, key) {
    const cur = { ...get(p) };
    if (cur[key]) delete cur[key]; else cur[key] = true;
    if (Object.keys(cur).length) data[p.path] = cur; else delete data[p.path];
    db.save();
    return !!cur[key];
  }
  return {
    isFavorite: (p) => !!get(p).favorite || p.favoriteMeta,
    isPinned: (p) => !!get(p).pinned,
    toggleFavorite: (p) => toggle(p, "favorite"),
    togglePin: (p) => toggle(p, "pinned"),
  };
};
