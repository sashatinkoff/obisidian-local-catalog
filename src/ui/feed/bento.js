// ui/feed/bento.js — Bento: та же сетка, но видео и canvas занимают две колонки.
const tileGrid = require("ui/feed/tile-grid");
const isWide = (card) => !!(card && card.classList && (card.classList.contains("sf-card--video") || card.classList.contains("sf-card--canvas")));
module.exports = (ctx, cards) => tileGrid(ctx, cards, { variant: "bento", wide: isWide });
