// tests/fake-app.js — фиктивный vault + metadataCache поверх списка тестовых заметок. Один код для Node-тестов и браузерного harness.
// Заметка: { path, title?, date?, tags?, body, out?, inl?, tasks? }.
function buildVault(notes, { now = Date.now(), resource = (p) => "app://local/" + p } = {}) {
  const base = (p) => p.split("/").pop().replace(/\.md$/, "");
  const files = notes.map((n) => ({ path: n.path, basename: base(n.path), name: n.path.split("/").pop(), extension: "md", stat: { ctime: now, mtime: now, size: n.body.length } }));
  const byPath = Object.fromEntries(notes.map((n) => [n.path, n]));
  const fileBy = Object.fromEntries(files.map((f) => [f.path, f]));
  const resolvedLinks = {};
  for (const n of notes) {
    const r = (resolvedLinks[n.path] = {});
    for (const o of n.out || []) r[o] = 1;
    for (let i = 0; i < (n.inl || 0); i++) resolvedLinks[`inl/${n.path}/${i}.md`] = { [n.path]: 1 };
  }
  const cacheOf = (f) => {
    const n = byPath[f.path]; if (!n) return null;
    const fm = {}; if (n.date) fm.date = n.date; if (n.title) fm.title = n.title;
    return { frontmatter: Object.keys(fm).length ? fm : undefined, tags: (n.tags || []).map((t) => ({ tag: t })), listItems: Array.from({ length: n.tasks || 0 }, () => ({ task: " " })) };
  };
  return {
    files,
    getMarkdownFiles: () => files.slice(),
    getAbstractFileByPath: (p) => fileBy[p] || null,
    cachedRead: async (f) => (byPath[f.path].date ? `---\ndate: ${byPath[f.path].date}\n---\n` : "") + byPath[f.path].body,
    getResourcePath: (f) => resource(f.path),
    metadataCache: { getFileCache: (f) => cacheOf(f), resolvedLinks, getFirstLinkpathDest: (t) => ({ path: t }) },
  };
}
if (typeof module !== "undefined") module.exports = { buildVault };
