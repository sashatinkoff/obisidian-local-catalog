// lib/async.js — debounce, пул задач с ограничением параллелизма, мьютекс.
function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); return fn(...a); };
  return d;
}
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
function createMutex() {
  let tail = Promise.resolve();
  return (task) => { const run = tail.then(task, task); tail = run.catch(() => {}); return run; };
}
module.exports = { debounce, mapPool, createMutex };
