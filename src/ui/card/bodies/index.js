// ui/card/bodies/index.js — тип карточки → рендер тела.
const map = {};
for (const id of ["text", "quote", "audio", "video", "image", "canvas", "tasks", "link"]) map[id] = require("ui/card/bodies/" + id);
module.exports = { get: (id) => map[id] || map.text };
