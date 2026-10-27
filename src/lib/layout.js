// lib/layout.js — сколько колонок помещается в ширину (config.columns.min/max + minCardWidth).
// Узкий контейнер (< singleColumnBelow, по умолчанию 560px — телефон) всегда даёт 1 колонку.
function columnCount(width, cfg, gap = 24) {
  let { min = 2, max = 4 } = cfg.columns || {};
  if (min > max) [min, max] = [max, min];
  min = Math.max(1, min); max = Math.max(min, max);
  if (!width) return max;
  if (width < (cfg.singleColumnBelow ?? 560)) return 1;
  const fit = Math.floor((width + gap) / ((cfg.minCardWidth || 320) + gap));
  return Math.max(min, Math.min(max, fit));
}
module.exports = { columnCount };
