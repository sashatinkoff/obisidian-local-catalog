// ui/common/toast.js — доступ к всплывающему уведомлению из контекста.
module.exports = (ctx, text) => (ctx.toast ? ctx.toast(text) : console.log("[journal-stream]", text));
