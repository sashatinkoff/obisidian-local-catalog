// services/media.js — ссылка на медиафайл → URL ресурса Obsidian.
module.exports = function createMedia(app) {
  return {
    resolveFile(target, sourcePath) {
      return app.metadataCache.getFirstLinkpathDest(decodeURIComponent(target), sourcePath);
    },
    resolve(target, sourcePath) {
      if (/^https?:\/\//i.test(target)) return target;
      const f = app.metadataCache.getFirstLinkpathDest(decodeURIComponent(target), sourcePath);
      return f ? app.vault.getResourcePath(f) : null;
    },
  };
};
