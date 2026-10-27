// services/posts.js — репозиторий постов: заметки vault (metadataCache) → нормализованные посты (тела не читаются).
const { createPost } = require("model/post");
const { toPage, backlinkMap } = require("services/notes");
const types = require("types");

module.exports = function createPostsRepo({ app, config }) {
  let cache = null;

  const folderOf = (s) => String(s.folder || "").replace(/^\/+|\/+$/g, "");
  function inSources(path) {
    const act = (config.sources || []).filter((s) => s.enabled !== false);
    if (!act.length) return true;
    return act.some((s) => { const f = folderOf(s); return !f || path === f || path.startsWith(f + "/"); });
  }
  const excluded = (path) => (config.excludeFolders || []).some((f) => { f = String(f).replace(/^\/+|\/+$/g, ""); return f && (path === f || path.startsWith(f + "/")); });

  function collect(force = false) {
    if (cache && !force) return cache;
    const back = backlinkMap(app);
    const posts = [];
    for (const file of app.vault.getMarkdownFiles()) {
      if (!inSources(file.path) || excluded(file.path)) continue;
      const post = createPost(toPage(app, file, back), config);
      if ((config.excludeTags || []).some((t) => post.tags.includes(t))) continue;
      post.type = types.resolve(post, null).id;
      posts.push(post);
    }
    cache = posts;
    return posts;
  }
  return { collect, refresh: () => collect(true), markDirty: () => { cache = null; } };
};
