// Короткая заметка-ссылка: есть внешний URL и мало текста.
module.exports = { id: "link", label: "Link", icon: "link", match: (p, f) => !!f && f.external.length > 0 && f.words < 45 };
