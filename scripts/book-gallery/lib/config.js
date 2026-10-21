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
        // необязательные поля: если их нет, соответствующие блоки просто не показываются
        quote: "Цитата",              // ключевая мысль / аннотация (карточки, инсайт месяца, поиск)
        notes: "Заметки",             // ссылки на заметки книги ("[[...]]") или число заметок
        label: "Метка",               // короткая пометка в подвале карточки («Тонкий юмор»)
        time: "Время чтения",         // «16 ч 40 м» (показывается в главной карточке)
        pages: "Страниц",             // число страниц (для статистики месяца)
    },
    ratingMax: 10,                    // шкала оценки в заметках (в интерфейсе всегда 5 звёзд)
    dateFormat: "dd MMMM yyyy",       // формат даты: yyyy yy MMMM MMM MM M dd d EEEE EEE (YYYY тоже понимается)
    dateLocale: "ru",                 // язык названий месяцев и дней недели

    // --- заметки и цитаты ---
    sourceField: "Источник",          // свойство заметки-цитаты, указывающее на книгу (название или ссылка)
    notesFolder: null,                // папка с заметками-цитатами; null — искать по всему хранилищу

    // --- оформление ---
    title: "Каталог прочитанных книг", // заголовок над галереей; "" — не показывать
    showStats: true,                  // блок «месяц + инсайт»
    showPulse: true,                  // виджет «Пульс прочитанных за год»
    tagsCollapsed: false,             // панель тегов свёрнута по умолчанию (дальше запоминается выбор)
    bigShare: 0.4,                    // доля больших карточек в сетке среди книг, у которых достаточно текста
    bigMinChars: 90,                  // минимум символов текста, чтобы книга могла получить большую карточку
    showExcerpt: true,                // если у книги нет заметок и цитаты, показывать отрывок из её собственной заметки
    excerptChars: 420,                // длина отрывка
    showFooter: true,                 // строка «Dataview: загружено N записей»
    addButton: true,                  // кнопка «Добавить книгу» (создаёт заметку в folder)
    featured: true,                   // большая карточка для лучшей книги (в режиме карточек)
    featuredMinScore: 4.5,            // минимальная оценка (по 5-балльной шкале) для главной карточки
    featuredLabel: "Книга года · топ 1",
    lowScore: 2,                      // оценка ниже этой — карточка «Разочарование» (по 5-балльной шкале)
    lowLabel: "Разочарование",

    // --- поведение ---
    openInNewTab: true,               // true — заметка открывается в новой вкладке
    defaultView: "cards",             // "cards" | "list"
    defaultSort: "date_desc",         // date_desc | date_asc | rating_desc | rating_asc | title_asc | title_desc
    tagMode: "any",                   // "any" — книга подходит, если есть любой из выбранных тегов; "all" — все сразу
    storageKey: "obsidian-book-gallery-view",
    searchDebounce: 150,              // мс

    // --- ширина заметки ---
    fullWidth: false,                 // растянуть заметку на всю ширину (вместо cssclasses)
    fullWidthClasses: ["max", "full-width"],

    // --- файлы ---
    dir: "scripts/book-gallery",      // папка со скриптом (там lib/ и styles/)
    cssFiles: ["theme", "base", "header", "stats", "filters", "cards", "list", "layout"], // порядок подключения styles/*.css
};

function build(input) {
    const user = input || {};
    return Object.assign({}, defaults, user, {
        fields: Object.assign({}, defaults.fields, user.fields || {}),
    });
}

return { defaults, build };
