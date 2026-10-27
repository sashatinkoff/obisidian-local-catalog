// Аудио-заметка: плеер с «волной» (декоративной) и прогрессом.
const { h } = require("lib/dom");
const { icon } = require("lib/icons");
const { mulberry32 } = require("lib/random");
const { hash } = require("lib/misc");
const { renderExcerpt } = require("ui/card/bodies/_excerpt");

const fmt = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

async function render(ctx, post, feats, el) {
  const m = feats.byKind("audio")[0];
  const src = m && ctx.media.resolve(m.target, post.path);
  if (src) {
    const audio = h("audio", { preload: "metadata", src });
    const time = h("span", { class: "sf-audio__time" }, "0:00");
    const rnd = mulberry32(parseInt(hash(post.path), 36));
    const bars = Array.from({ length: 40 }, () => h("span", { class: "sf-audio__bar", style: { height: 20 + Math.round(rnd() * 80) + "%" } }));
    const btn = h("button", { type: "button", class: "sf-audio__btn", title: "Воспроизвести", onClick: () => (audio.paused ? audio.play() : audio.pause()) }, icon("play", { size: 16, fill: true }));
    const wave = h("div", { class: "sf-audio__wave", onClick: (e) => { const r = wave.getBoundingClientRect(); if (audio.duration) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration; } }, bars);
    audio.addEventListener("loadedmetadata", () => (time.textContent = fmt(audio.duration)));
    audio.addEventListener("play", () => btn.classList.add("is-playing"));
    audio.addEventListener("pause", () => btn.classList.remove("is-playing"));
    audio.addEventListener("timeupdate", () => {
      const p = audio.duration ? audio.currentTime / audio.duration : 0;
      bars.forEach((b, i) => b.classList.toggle("is-played", i / bars.length < p));
      time.textContent = fmt(audio.currentTime) + " / " + fmt(audio.duration);
    });
    el.append(h("div", { class: "sf-audio" }, btn, wave, time, audio));
  } else el.append(h("div", { class: "sf-media-missing" }, "Аудиофайл не найден: " + (m ? m.target : "—")));
  await renderExcerpt(ctx, post, feats, el, { max: 260 });
}
module.exports = { render };
