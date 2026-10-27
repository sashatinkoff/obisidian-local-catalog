// lib/misc.js — мелкие утилиты: хэш, глубокий merge, копирование, приведение Dataview-массивов.
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

function deepMerge(base, over) {
  if (Array.isArray(base) || Array.isArray(over) || typeof base !== "object" || typeof over !== "object" || !base || !over) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
  return out;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
    ta.remove(); return ok;
  }
}

const toArray = (x) => (x == null ? [] : Array.isArray(x) ? x : typeof x[Symbol.iterator] === "function" && typeof x !== "string" ? Array.from(x) : [x]);
function pageField(page, names) {
  for (const n of names) { const v = page[n]; if (v !== undefined && v !== null && v !== "") return v; }
  return undefined;
}
const uid = (p = "id") => p + "-" + Math.random().toString(36).slice(2, 8);

module.exports = { hash, deepMerge, copyText, toArray, pageField, uid };
