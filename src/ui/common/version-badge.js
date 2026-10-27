// ui/common/version-badge.js — бейдж версии на странице: «v1.0.0», по клику открывает окно «История версий» (из README плагина).
const { h } = require("lib/dom");
const { VERSION, RELEASED } = require("app/version");

module.exports = function versionBadge(ctx, { cls = "" } = {}) {
  return h("a", { class: ["sf-version", cls], href: "#", title: `Journal Stream v${VERSION} (${RELEASED}) — история версий`,
    onClick: (e) => { e.preventDefault(); e.stopPropagation(); ctx.openChangelog(); } }, "v" + VERSION);
};
