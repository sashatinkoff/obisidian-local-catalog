// model/post.js — нормализация страницы Dataview в «пост» ленты (без чтения тела заметки).
const { toMs, hasTime, fromFilename } = require("lib/date");
const { toArray, pageField } = require("lib/misc");
const { kindOf } = require("model/media-kinds");
const { norm } = require("lib/search");

const normTag = (t) => String(t || "").trim().replace(/^#+/, "").toLowerCase();

function matchSource(path, sources) {
  for (const s of sources || []) {
    if (s.enabled === false) continue;
    const f = String(s.folder || "").replace(/^\/+|\/+$/g, "");
    if (!f || path === f || path.startsWith(f + "/")) return s.id;
  }
  return null;
}

function createPost(page, config) {
  const F = page.file;
  const raw = pageField(page, config.dateFields);
  let ts = toMs(raw), timed = ts != null && hasTime(raw, ts);
  if (ts == null) ts = fromFilename(F.name);
  // Время: из отдельного поля (time / время) или — если включено в настройках — из времени создания/изменения файла.
  if (ts != null && !timed) {
    const tf = pageField(page, ["time", "Time", "время", "Время"]);
    const tm = tf != null && String(tf).match(/(\d{1,2}):(\d{2})/);
    let hm = tm ? [+tm[1], +tm[2]] : null;
    if (!hm && (config.timeFallback === "ctime" || config.timeFallback === "mtime")) {
      const src = toMs(config.timeFallback === "ctime" ? F.ctime : F.mtime);
      if (src != null) { const d = new Date(src); hm = [d.getHours(), d.getMinutes()]; }
    }
    if (hm) { const d = new Date(ts); d.setHours(hm[0], hm[1], 0, 0); ts = d.getTime(); timed = true; }
  }
  if (ts == null) ts = toMs(F.cday) ?? toMs(F.ctime) ?? 0;

  const tags = [...new Set(toArray(F.tags).map(normTag).filter(Boolean))];
  const outPaths = toArray(F.outlinks).map((l) => String((l && l.path) || "")).filter(Boolean);
  const kinds = outPaths.map(kindOf).filter(Boolean);
  const mediaKinds = new Set(kinds);
  const mediaCounts = { image: 0, video: 0, audio: 0 };
  for (const k of kinds) if (k in mediaCounts) mediaCounts[k]++;
  const explicitTitle = page.title || page.Title;
  const type = String(pageField(page, ["type", "тип", "kind"]) || "").toLowerCase();

  const post = {
    id: F.path, path: F.path, name: F.name,
    title: String(explicitTitle || F.name),
    hasOwnTitle: !!explicitTitle || !/^\d{4}-\d{2}-\d{2}/.test(F.name),
    ts, hasTime: timed, tags,
    source: matchSource(F.path, config.sources),
    backlinks: toArray(F.inlinks).length,
    links: outPaths.length,
    size: F.size || 0,
    mtime: toMs(F.mtime) || 0,
    mediaKinds, mediaCounts,
    typeHint: type,
    favoriteMeta: pageField(page, [config.favoriteField]) === true || tags.some((t) => (config.favoriteTags || []).includes(t)),
    cover: pageField(page, ["cover", "image", "обложка"]) || null,
    tasksTotal: toArray(F.tasks).length,
    attrs: new Set(),
    search: norm(String(explicitTitle || "") + " " + F.name + " " + tags.join(" ")),
    feats: null, // заполняется после чтения тела (services/content)
  };
  refreshAttrs(post, config);
  return post;
}

// Пересчёт «атрибутов» (media/photo/audio/video/task/quote/link) — дешёвые признаки + признаки из тела.
function refreshAttrs(post, config) {
  const a = new Set();
  const mk = post.mediaKinds;
  if (mk.has("image")) { a.add("photo"); a.add("media"); }
  if (mk.has("video")) { a.add("video"); a.add("media"); }
  if (mk.has("audio")) { a.add("audio"); a.add("media"); }
  if (post.tasksTotal > 0) a.add("task");
  if (post.tags.some((t) => (config.quoteTags || []).includes(t))) a.add("quote");
  const f = post.feats;
  if (f) {
    for (const m of f.media) { a.add("media"); if (m.kind === "image") a.add("photo"); if (m.kind === "video") a.add("video"); if (m.kind === "audio") a.add("audio"); }
    if (f.tasks.total > 0) a.add("task");
    if (f.quotes.length) a.add("quote");
    if (f.external.length) a.add("link");
  }
  post.attrs = a;
}

function enrichPost(post, feats, config) {
  post.feats = feats;
  post.words = feats.words;
  post.searchBody = norm(feats.body); // весь текст заметки (без frontmatter), а не только превью
  refreshAttrs(post, config);
  return post;
}

module.exports = { createPost, enrichPost, refreshAttrs, normTag, matchSource };
