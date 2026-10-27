// lib/search.js — нормализация текста для поиска: регистр, ё→е, неразрывные пробелы.
const norm = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/\u00a0/g, " ");
module.exports = { norm };
