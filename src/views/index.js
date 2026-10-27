// views/index.js — реестр экранов (порядок = порядок вкладок).
const list = ["overview", "stream", "bento", "collections", "studio"].map((n) => require("views/" + n));
const get = (id) => list.find((v) => v.id === id) || list[1];
module.exports = { list, get };
