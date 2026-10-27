// services/content.js — ленивое чтение тела заметок с кэшем по mtime.
const { analyze } = require("model/analyzer");
const { enrichPost } = require("model/post");
const types = require("types");
const { mapPool } = require("lib/async");

module.exports = function createContent({ app, config }) {
  const cache = new Map(); // path -> { mtime, feats }

  async function load(post) {
    const file = app.vault.getAbstractFileByPath(post.path);
    if (!file) return null;
    const mtime = file.stat ? file.stat.mtime : 0;
    let hit = cache.get(post.path);
    if (!hit || hit.mtime !== mtime) {
      const raw = await app.vault.cachedRead(file);
      hit = { mtime, feats: analyze(raw) };
      cache.set(post.path, hit);
    }
    if (post.feats !== hit.feats) {
      enrichPost(post, hit.feats, config);
      post.type = types.resolve(post, hit.feats).id;
    }
    return hit.feats;
  }
  // Одна нечитаемая заметка не должна прерывать индексацию остальных.
  const preload = (posts, onProgress) => mapPool(posts, config.concurrency || 8, async (p, i) => {
    try { await load(p); } catch (e) { console.warn("[journal-stream] не удалось прочитать", p.path, e); }
    if (onProgress) onProgress(i + 1, posts.length);
  });
  return { load, preload, clear: () => cache.clear() };
};
