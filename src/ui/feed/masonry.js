// ui/feed/masonry.js — Masonry: равные колонки, карточки разной высоты.
const tileGrid = require("ui/feed/tile-grid");
module.exports = (ctx, cards) => tileGrid(ctx, cards, { variant: "masonry", wide: () => false });
