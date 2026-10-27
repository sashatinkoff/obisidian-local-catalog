// ui/stats/longest.js — «Самые длинные записи»: за всё время, за текущий год и рекордсмены каждого года.
// Быстрый отбор по размеру файла, затем точный подсчёт слов по прочитанному телу (только для кандидатов).
const { h, clear } = require("lib/dom");
const { fmtNum, plural } = require("lib/ru");
const { fmtDateTime } = require("lib/date");
const segmented = require("ui/common/segmented");
const { longestCandidates } = require("stats/author");

// posts — только записи с датой (ts > 0); учитываются все годы, период экрана на этот блок не влияет.
module.exports = function longest(ctx, posts, { top = 10, now = Date.now() } = {}) {
  const year = new Date(now).getFullYear(), yearOf = (p) => new Date(p.ts).getFullYear();
  const MODES = [{ id: "all", label: "Всё время" }, { id: "year", label: `${year} год` }, { id: "years", label: "По годам" }];
  let mode = (ctx.session.get() || {}).statsLongest || "all", token = 0, dead = false;
  const list = h("ol", { class: "sf-longest__list" }), sub = h("p", { class: "sf-block__sub" }), tabs = h("div", { class: "sf-longest__tabs" });
  const el = h("div", { class: "sf-card-block sf-longest" },
    h("div", { class: "sf-block__head" }, h("div", null, h("h3", { class: "sf-block__title" }, "Самые длинные записи"), sub), tabs), list);

  const wordsOf = (p) => p.words || 0, sizeLine = (p) => `${fmtDateTime(p.ts, p.hasTime)} · ${fmtNum(p.words)} ${plural(p.words, ["слово", "слова", "слов"])} · ${p.feats ? p.feats.readMin : Math.max(1, Math.round(p.words / 200))} мин`;
  const row = (p, label, max) => h("li", { class: "sf-longest__row" },
    h("button", { type: "button", class: "sf-longest__btn", onClick: (e) => ctx.openNote(p.path, e) },
      h("span", { class: ["sf-longest__n", label.length > 2 && "is-year"] }, label),
      h("span", { class: "sf-longest__main" },
        h("span", { class: "sf-longest__title" }, p.hasOwnTitle ? p.title : fmtDateTime(p.ts, p.hasTime)),
        h("span", { class: "sf-longest__meta" }, sizeLine(p)),
        h("span", { class: "sf-longest__bar" }, h("i", { style: { width: Math.max(4, (p.words / max) * 100) + "%" } })))));

  async function draw() {
    const my = ++token;
    clear(tabs); tabs.append(segmented({ options: MODES, value: mode, onChange: (id) => { mode = id; ctx.session.patch({ statsLongest: id }); draw().catch(() => {}); } }));
    sub.textContent = mode === "years" ? "Самая длинная запись каждого года; клик открывает заметку" : mode === "year" ? `Записи ${year} года по числу слов; клик открывает заметку` : "По числу слов за все годы; клик открывает заметку";
    // кандидаты
    let cand, groups = null;
    if (mode === "years") {
      groups = new Map(); for (const p of posts) { const y = yearOf(p); if (!groups.has(y)) groups.set(y, []); groups.get(y).push(p); }
      cand = []; for (const [y, g] of groups) { const c = longestCandidates(g, 4); groups.set(y, c); cand.push(...c); }
    } else cand = longestCandidates(mode === "year" ? posts.filter((p) => yearOf(p) === year) : posts, 24);
    clear(list);
    if (!cand.length) { list.append(h("li", { class: "sf-muted" }, "Пока нечего показать.")); return; }
    list.append(...cand.slice(0, top).map(() => h("li", { class: "sf-longest__row sf-longest__row--skel" }, h("i"))));
    await ctx.content.preload(cand);
    if (dead || my !== token) return;
    clear(list);
    if (mode === "years") {
      const best = [...groups.entries()].map(([y, c]) => [y, c.filter(wordsOf).sort((a, b) => b.words - a.words)[0]]).filter(([, p]) => p).sort((a, b) => b[0] - a[0]);
      if (!best.length) { list.append(h("li", { class: "sf-muted" }, "Пока нечего показать.")); return; }
      const max = Math.max(...best.map(([, p]) => p.words));
      best.forEach(([y, p]) => list.append(row(p, String(y), max)));
      return;
    }
    const rows = cand.filter(wordsOf).sort((a, b) => b.words - a.words).slice(0, top);
    if (!rows.length) { list.append(h("li", { class: "sf-muted" }, "Пока нечего показать.")); return; }
    rows.forEach((p, i) => list.append(row(p, String(i + 1), rows[0].words)));
  }
  draw().catch((e) => { console.warn("[journal-stream] самые длинные", e); });
  return { el, dispose: () => { dead = true; } };
};
