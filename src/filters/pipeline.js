// filters/pipeline.js — полный путь: все посты → фильтр → быстрый режим → сортировка/закрепы.
const { applyFilter, sortPosts } = require("filters/engine");
const { applyQuick } = require("filters/quick-modes");

function run(posts, state, env) {
  const c = { now: env.now || Date.now(), seed: state.seed, config: env.config, flags: env.flags };
  const filtered = applyFilter(posts, state.filter, c.now);
  let list = applyQuick(filtered, state.quick, c);
  list = sortPosts(list, state.quick === "random" ? "date-desc" : state.filter.sort);
  const pinned = list.filter((p) => env.flags.isPinned(p));
  return { filtered, list: pinned.length ? [...pinned, ...list.filter((p) => !env.flags.isPinned(p))] : list };
}
module.exports = { run };
