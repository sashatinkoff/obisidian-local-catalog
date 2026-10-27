// model/media-kinds.js — определение типа медиа по расширению.
const EXT = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"],
  audio: ["mp3", "wav", "m4a", "ogg", "oga", "flac", "aac", "opus"],
  video: ["mp4", "mov", "mkv", "webm", "m4v", "ogv"],
  canvas: ["canvas"],
  pdf: ["pdf"],
};
const MAP = {};
for (const [kind, list] of Object.entries(EXT)) for (const e of list) MAP[e] = kind;

function extOf(path) {
  const m = String(path || "").split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}
const kindOf = (path) => MAP[extOf(path)] || null;
module.exports = { EXT, extOf, kindOf };
