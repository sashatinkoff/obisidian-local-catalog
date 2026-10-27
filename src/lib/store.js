// lib/store.js — крошечный реактивный стор: set(patch) уведомляет подписчиков об изменённых ключах.
function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      const changed = Object.keys(patch).filter((k) => state[k] !== patch[k]);
      if (!changed.length) return;
      state = { ...state, ...patch };
      for (const l of [...listeners]) if (!l.keys || changed.some((k) => l.keys.includes(k))) l.fn(state, changed);
    },
    subscribe(fn, keys) {
      const l = { fn, keys };
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
module.exports = { createStore };
