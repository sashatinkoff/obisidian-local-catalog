// model/analyzer.js — чистый разбор тела заметки: медиа, цитаты, задачи, ссылки, слова.
const { kindOf } = require("model/media-kinds");
const { stripFrontmatter, cleanForExcerpt, wordCount, readMinutes } = require("lib/text");

const WIKI_EMBED = /!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g;
const MD_EMBED = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const WIKI_LINK = /(?<!!)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
const TASK = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;
const URL_RE = /https?:\/\/[^\s)>\]]+/g;

function collectQuotes(lines) {
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    if (/^\s*>/.test(line)) {
      const t = line.replace(/^\s*>\s?/, "");
      if (!cur) cur = [];
      cur.push(t);
    } else if (cur) { blocks.push(cur); cur = null; }
  }
  if (cur) blocks.push(cur);
  return blocks
    .map((b) => {
      let callout = null;
      if (/^\[!(\w+)\][+-]?\s*(.*)$/.test(b[0])) {
        const m = b[0].match(/^\[!(\w+)\][+-]?\s*(.*)$/);
        callout = { kind: m[1].toLowerCase(), title: m[2] };
        b = b.slice(1);
      }
      return { callout, text: b.join("\n").trim() };
    })
    .filter((q) => q.text && (!q.callout || ["quote", "cite"].includes(q.callout.kind)));
}

function analyze(rawOrBody) {
  const body = stripFrontmatter(rawOrBody);
  const media = [];
  let m;
  WIKI_EMBED.lastIndex = 0;
  while ((m = WIKI_EMBED.exec(body))) media.push({ kind: kindOf(m[1]), target: m[1].trim(), alt: m[2] || "", remote: false });
  MD_EMBED.lastIndex = 0;
  while ((m = MD_EMBED.exec(body))) {
    const target = decodeURI(m[2]);
    media.push({ kind: kindOf(target) || (/^https?:/.test(target) ? "image" : null), target, alt: m[1], remote: /^https?:/.test(target) });
  }
  const known = media.filter((x) => x.kind);

  const lines = body.split(/\r?\n/);
  const tasks = [];
  for (const l of lines) { const t = l.match(TASK); if (t) tasks.push({ done: t[1] !== " ", text: t[2] }); }

  const quotes = collectQuotes(lines);
  const text = cleanForExcerpt(body);
  const words = wordCount(text);
  const quoteChars = quotes.reduce((s, q) => s + q.text.length, 0);

  const links = [];
  WIKI_LINK.lastIndex = 0;
  while ((m = WIKI_LINK.exec(body))) links.push(m[1].trim());
  const external = [...new Set(body.replace(WIKI_EMBED, "").match(URL_RE) || [])];
  const heading = (body.match(/^#{1,3}\s+(.+)$/m) || [])[1] || "";

  return {
    body, text, words, readMin: readMinutes(words),
    media: known,
    byKind: (k) => known.filter((x) => x.kind === k),
    tasks: { total: tasks.length, done: tasks.filter((t) => t.done).length, items: tasks },
    quotes, quoteRatio: text.length ? quoteChars / text.length : 0,
    links, external, heading,
  };
}

module.exports = { analyze };
