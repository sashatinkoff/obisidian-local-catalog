// services/indexer.js — фоновая индексация текстов заметок для поиска (один раз за сеанс, прогресс доступен подписчикам).
// Пока индекс не готов, поиск работает по заголовкам и тегам; по завершении результаты пересчитываются автоматически.
module.exports = function createIndexer(ctx) {
  let state = { running: false, done: false, i: 0, n: 0 };
  const subs = new Set();
  const emit = () => subs.forEach((cb) => cb({ ...state }));
  return {
    status: () => ({ ...state }),
    onChange(cb) { subs.add(cb); return () => subs.delete(cb); },
    reset() { state = { running: false, done: false, i: 0, n: 0 }; emit(); },
    async ensure(posts) {
      if (state.running || state.done) return;
      state = { running: true, done: false, i: 0, n: posts.length }; emit();
      await ctx.content.preload(posts, (i, n) => { state.i = i; if (i % 20 === 0 || i === n) emit(); });
      state = { running: false, done: true, i: posts.length, n: posts.length }; emit();
      ctx.actions.setFilter({}); // пересчитать ленту уже с поиском по тексту
    },
  };
};
