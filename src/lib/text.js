// lib/text.js — чистые функции для работы с markdown-текстом заметок.
function stripFrontmatter(raw) {
  return String(raw || "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

// Убирает то, что не должно попадать в превью: встраивания, комментарии, dataview-блоки.
function cleanForExcerpt(md) {
  return String(md || "")
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```(?:dataview|dataviewjs)[\s\S]*?```/g, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Обрезает markdown по границе абзаца/предложения/слова, не разрывая [[вики-ссылки]].
function truncateMarkdown(md, max) {
  const text = String(md || "");
  if (text.length <= max) return { text, truncated: false };
  let cut = text.lastIndexOf("\n\n", max);
  if (cut < max * 0.5) {
    const m = text.slice(0, max).match(/[\s\S]*[.!?…»)]\s/);
    cut = m ? m[0].length : -1;
  }
  if (cut < max * 0.5) cut = text.lastIndexOf(" ", max);
  if (cut <= 0) cut = max;
  let out = text.slice(0, cut);
  const open = out.lastIndexOf("[[");
  if (open > out.lastIndexOf("]]")) out = out.slice(0, open);
  if ((out.match(/```/g) || []).length % 2 === 1) out += "\n```";
  return { text: out.trimEnd() + "…", truncated: true };
}

// Markdown → простой текст для коротких превью (подборки, поиск).
function plainText(md) {
  return String(md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/\[\[([^\]#|]*)(?:#[^\]|]*)?\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/gm, "")
    .replace(/[*_~`=]{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
// Короткий фрагмент по границе слова.
function snippet(text, max) {
  const t = plainText(text);
  if (t.length <= max) return t;
  const cut = t.lastIndexOf(" ", max);
  return t.slice(0, cut > max * 0.6 ? cut : max).trimEnd() + "…";
}

const wordCount = (md) => (String(md || "").match(/[\p{L}\p{N}'’-]+/gu) || []).length;
const readMinutes = (words, wpm = 180) => Math.max(1, Math.ceil(words / wpm));
const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const dqlEscape = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

module.exports = { plainText, snippet, stripFrontmatter, cleanForExcerpt, truncateMarkdown, wordCount, readMinutes, escapeRegExp, dqlEscape };
