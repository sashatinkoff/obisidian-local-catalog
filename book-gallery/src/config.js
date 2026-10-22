// src/config.js — параметры по умолчанию и слияние: значения по умолчанию < настройки плагина < параметры блока.

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
    coverFromBody: true,              // нет файла обложки (или свойство cover пустое) — взять первую картинку из текста заметки
    showExcerpt: true,                // если у книги нет заметок и цитаты, показывать отрывок из её собственной заметки
    excerptChars: 420,                // длина отрывка
    showFooter: true,                 // строка «загружено N записей» внизу
    addButton: true,                  // кнопка «Добавить книгу» (создаёт заметку в folder)
    compactPairs: true,               // бенто: книги с небольшим текстом иногда собираются в «стопку» из двух компактных карточек
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
    cssFiles: ["theme", "base", "header", "stats", "filters", "cards", "list", "layout"], // порядок подключения styles/*.css
};

// Слияние нескольких слоёв настроек; вложенный объект fields сливается по ключам
function build(...layers) {
    const out = Object.assign({}, defaults);
    out.fields = Object.assign({}, defaults.fields);
    layers.forEach((layer) => {
        if (!layer || typeof layer !== "object") return;
        Object.keys(layer).forEach((k) => {
            if (k === "fields") Object.assign(out.fields, layer.fields || {});
            else if (layer[k] !== undefined) out[k] = layer[k];
        });
    });
    // числа и логические значения из YAML бывают строками
    ["bigShare", "bigMinChars", "excerptChars", "ratingMax", "featuredMinScore", "lowScore", "searchDebounce"].forEach((k) => {
        const n = parseFloat(String(out[k]).replace(",", "."));
        out[k] = Number.isNaN(n) ? defaults[k] : n;
    });
    if (!out.ratingMax || out.ratingMax <= 0) out.ratingMax = defaults.ratingMax;
    return out;
}

module.exports = { defaults, build };
