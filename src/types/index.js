// types/index.js — реестр типов карточек. Порядок = приоритет автоопределения.
const list = ["video", "audio", "canvas", "image", "quote", "tasks", "link", "text"].map((n) => require("types/" + n));
const byId = Object.fromEntries(list.map((t) => [t.id, t]));
const ALIASES = { voice: "audio", photo: "image", todo: "tasks", task: "tasks", citation: "quote", цитата: "quote", аудио: "audio", видео: "video", фото: "image", задачи: "tasks" };

// frontmatter `type` (если известен) важнее автоопределения; f (анализ тела) может быть null.
function resolve(post, f) {
  const hint = ALIASES[post.typeHint] || post.typeHint;
  if (hint && byId[hint]) return byId[hint];
  return list.find((t) => t.match(post, f)) || byId.text;
}
const get = (id) => byId[id] || byId.text;
module.exports = { list, get, resolve };
