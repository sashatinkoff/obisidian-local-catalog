// filters/engine.js — применение фильтра к списку постов.
const { predicates } = require("filters/predicates");
const { merge } = require("filters/state");
const { get: sorter } = require("filters/sorters");

function matches(post, filter, now) {
  for (const key of Object.keys(predicates)) if (!predicates[key](post, filter, now)) return false;
  return true;
}
function applyFilter(posts, filter, now = Date.now()) {
  const f = merge(filter);
  return posts.filter((p) => matches(p, f, now));
}
function sortPosts(posts, key) { return posts.slice().sort(sorter(key)); }
module.exports = { matches, applyFilter, sortPosts };
