// services/notes.js — чтение заметок через metadataCache Obsidian (без Dataview) и приведение к «странице» для model/post.
// Страница: { file: { path, name, tags, inlinks, outlinks, tasks, size, ctime, mtime, cday }, ...frontmatter, title }.
// Всё берётся из кэша метаданных — тела заметок здесь не читаются.
const normFmTags = (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,\s]+/) : []).map((t) => String(t).trim()).filter(Boolean);

function backlinkMap(app) {
  const res = (app.metadataCache && app.metadataCache.resolvedLinks) || {};
  const back = new Map();
  for (const from of Object.keys(res)) for (const to of Object.keys(res[from] || {})) {
    if (to === from) continue;
    let a = back.get(to); if (!a) back.set(to, (a = [])); a.push(from);
  }
  return back;
}

function toPage(app, file, back) {
  const cache = (app.metadataCache.getFileCache && app.metadataCache.getFileCache(file)) || {};
  const fm = cache.frontmatter || {};
  const res = (app.metadataCache.resolvedLinks && app.metadataCache.resolvedLinks[file.path]) || {};
  const tags = [...(cache.tags || []).map((t) => t.tag), ...normFmTags(fm.tags), ...normFmTags(fm.tag)];
  const tasks = (cache.listItems || []).filter((li) => li.task !== undefined && li.task !== null);
  const st = file.stat || {};
  const cday = st.ctime ? new Date(new Date(st.ctime).setHours(0, 0, 0, 0)).getTime() : 0;
  const page = {
    ...fm,
    file: {
      path: file.path, name: file.basename || file.name.replace(/\.md$/, ""), tags,
      outlinks: Object.keys(res).map((p) => ({ path: p })),
      inlinks: (back.get(file.path) || []).map((p) => ({ path: p })),
      tasks, size: st.size || 0, ctime: st.ctime || 0, mtime: st.mtime || 0, cday,
    },
  };
  return page;
}

module.exports = { toPage, backlinkMap };
