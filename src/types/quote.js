// Цитата: тег из config.quoteTags/«цитата» или тело, где цитаты занимают заметную часть текста.
module.exports = {
  id: "quote", label: "Quote", icon: "quote",
  match: (p, f) => p.tags.some((t) => /цитат|quote/.test(t)) || (!!f && f.quotes.length > 0 && f.quoteRatio > 0.4),
};
