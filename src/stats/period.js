// stats/period.js — «Пульс месяца»: заметки, дельта, связи, медиа, плотность графа.
const { monthKey } = require("lib/date");

function monthStats(posts, now) {
  const d = new Date(now), cur = monthKey(now), prev = monthKey(new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime());
  const inCur = posts.filter((p) => monthKey(p.ts) === cur), inPrev = posts.filter((p) => monthKey(p.ts) === prev);
  const links = inCur.reduce((s, p) => s + p.links, 0);
  // files — сколько файлов добавлено (по встроенным вложениям), notes — в скольких заметках они встречаются
  const files = { photo: 0, video: 0, audio: 0 }, notes = { photo: 0, video: 0, audio: 0 };
  for (const p of inCur) {
    const c = p.mediaCounts || { image: 0, video: 0, audio: 0 };
    files.photo += c.image; files.video += c.video; files.audio += c.audio;
    if (c.image) notes.photo++; if (c.video) notes.video++; if (c.audio) notes.audio++;
  }
  const isolated = inCur.filter((p) => p.links + p.backlinks === 0).length;
  // накопительная динамика по дням текущего месяца (до сегодняшнего дня) и «консистентность»
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), elapsed = Math.min(dim, d.getDate());
  const daily = new Array(dim).fill(0);
  for (const p of inCur) daily[new Date(p.ts).getDate() - 1]++;
  let acc = 0;
  const cumulative = daily.slice(0, elapsed).map((n) => (acc += n));
  const activeDays = daily.slice(0, elapsed).filter((n) => n > 0).length;
  return {
    daysInMonth: dim, elapsed, daily, cumulative, activeDays,
    consistencyPct: elapsed ? Math.round((activeDays / elapsed) * 100) : 0,
    count: inCur.length, prevCount: inPrev.length,
    deltaPct: inPrev.length ? Math.round(((inCur.length - inPrev.length) / inPrev.length) * 100) : null,
    links, density: inCur.length ? Math.round((links / inCur.length) * 10) / 10 : 0,
    isolatedPct: inCur.length ? Math.round((isolated / inCur.length) * 100) : 0,
    media: files, mediaNotes: notes, mediaTotal: files.photo + files.video + files.audio, posts: inCur,
  };
}
module.exports = { monthStats };
