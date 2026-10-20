// lib/config.js — параметры по умолчанию и слияние с тем, что передал пользователь.
// Файл модуля — тело функции: получает `ctx`, возвращает объект с экспортами.

const defaults = {
    // --- данные ---
    folder: "Прочитанные книги",      // папка с заметками о книгах (подпапки включены)
    filterField: "Прочитано",         // поле-флаг; null или "" — не фильтровать
    filterValue: true,                // нужное значение флага
    fields: {                         // имена свойств во frontmatter
        title: "Название",
        author: "Автор",
        genre: "Жанр",
        rating: "Оценка",
        date: "Дата прочтения",
        cover: "cover",
    },
    ratingMax: 10,                    // шкала оценки в заметках (в UI всегда 5 звёзд)
    dateFormat: "dd.MM.yyyy",

    // --- поведение ---
    openInNewTab: true,               // true — заметка открывается в новой вкладке
    defaultView: "cards",             // "cards" | "table"
    defaultSort: "date_desc",         // date_desc | date_asc | title_asc | title_desc
    storageKey: "obsidian-book-gallery-view",
    searchDebounce: 150,              // мс

    // --- ширина заметки ---
    fullWidth: false,                 // растянуть заметку на всю ширину (вместо cssclasses)
    fullWidthClasses: ["max", "full-width"],

    // --- файлы ---
    dir: "scripts/book-gallery",      // папка со скриптом (там lib/ и styles/)
    cssFiles: ["theme", "controls", "cards", "table", "rating", "layout"], // порядок подключения styles/*.css
};

function build(input) {
    const user = input || {};
    return Object.assign({}, defaults, user, {
        fields: Object.assign({}, defaults.fields, user.fields || {}),
    });
}

return { defaults, build };
