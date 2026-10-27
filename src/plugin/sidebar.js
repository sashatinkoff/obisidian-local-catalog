// plugin/sidebar.js — скрытие боковых панелей Obsidian при открытии ленты (опция hideSidebar: none | left | right | both).
// Возвращает функцию, которая раскрывает обратно ровно те панели, что были раскрыты до нас.
function hideSidebars(app, mode) {
  const ws = app.workspace, targets = [];
  if (mode === "left" || mode === "both") targets.push(ws.leftSplit);
  if (mode === "right" || mode === "both") targets.push(ws.rightSplit);
  const hidden = [];
  for (const sp of targets) if (sp && !sp.collapsed && typeof sp.collapse === "function") { sp.collapse(); hidden.push(sp); }
  return () => { for (const sp of hidden) if (sp.collapsed && typeof sp.expand === "function") sp.expand(); };
}
module.exports = { hideSidebars };
