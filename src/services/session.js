// services/session.js — состояние экрана в памяти окна Obsidian (переживает перерисовку блока при переходах
// «заметка → назад»). Намеренно НЕ пишется на диск: после перезапуска Obsidian лента стартует с чистого листа.
module.exports = function createSession(key) {
  const g = (window.__sfSession = window.__sfSession || {});
  return {
    get: () => g[key] || null,
    patch: (p) => { g[key] = { ...(g[key] || {}), ...p }; },
  };
};
