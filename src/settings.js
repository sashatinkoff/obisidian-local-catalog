// src/settings.js — вкладка настроек плагина. Значения — «по умолчанию» для всех галерей;
// параметры в самом блоке ```book-gallery их переопределяют.

const { PluginSettingTab, Setting, AbstractInputSuggest } = ctx.obsidian;
const plugin = ctx.plugin;

// ---------- подсказки в полях ввода ----------
// Папки хранилища (без служебных и скрытых), от корня; пустой вариант — всё хранилище
function allFolders(app) {
    const list = typeof app.vault.getAllFolders === "function"
        ? app.vault.getAllFolders()
        : app.vault.getAllLoadedFiles().filter((f) => f && f.children !== undefined);
    return list
        .map((f) => f.path)
        .filter((p) => p && p !== "/" && !p.split("/").some((part) => part.startsWith(".")))
        .sort((a, b) => a.localeCompare(b, "ru"));
}

// Имена свойств, которые есть в заметках хранилища
function allProperties(app) {
    try {
        const info = app.metadataCache.getAllPropertyInfos ? app.metadataCache.getAllPropertyInfos() : {};
        const names = Object.values(info).map((i) => i.name).filter(Boolean);
        return [...new Set(names)].sort((a, b) => a.localeCompare(b, "ru"));
    } catch (e) {
        return [];
    }
}

// Выпадающий список подсказок под полем (если Obsidian старый и AbstractInputSuggest нет — просто текстовое поле)
const Suggest = AbstractInputSuggest
    ? class extends AbstractInputSuggest {
          constructor(app, inputEl, getItems, showAllOnExact) {
              super(app, inputEl);
              this.inputEl = inputEl;
              this.getItems = getItems;
              this.showAllOnExact = !!showAllOnExact;
          }
          getSuggestions(query) {
              const q = String(query || "").trim().toLowerCase();
              const items = this.getItems();
              // поле уже заполнено папкой — показываем весь список, чтобы можно было выбрать другую
              if (!q || (this.showAllOnExact && items.some((x) => x.toLowerCase() === q))) return items.slice(0, 200);
              return items.filter((x) => x.toLowerCase().includes(q)).slice(0, 50);
          }
          renderSuggestion(value, el) {
              el.setText(value);
          }
          selectSuggestion(value) {
              this.inputEl.value = value;
              this.inputEl.dispatchEvent(new Event("input", { bubbles: true }));
              this.close();
          }
      }
    : null;

const FOLDER_KEYS = new Set(["folder", "notesFolder"]);
const PROPERTY_KEYS = new Set(["filterField", "sourceField"]);

const SORT_OPTIONS = {
    date_desc: "Сначала новые",
    date_asc: "Сначала старые",
    rating_desc: "Оценка: по убыванию",
    rating_asc: "Оценка: по возрастанию",
    title_asc: "Название (А-Я)",
    title_desc: "Название (Я-А)",
};

const FIELD_LABELS = {
    title: "Название",
    author: "Автор",
    genre: "Жанр",
    rating: "Оценка",
    date: "Дата прочтения",
    cover: "Обложка",
    quote: "Цитата",
    notes: "Заметки",
    label: "Метка",
    time: "Время чтения",
    pages: "Страницы",
};

// Набор секций: [заголовок, [[ключ, тип, название, описание, варианты]]]
const SECTIONS = [
    ["Данные", [
        ["folder", "text", "Папка с книгами", "Заметки из этой папки (и подпапок) попадают в каталог. Начните вводить — появятся папки хранилища; пусто — всё хранилище."],
        ["filterField", "text", "Свойство-флаг", "Показывать только заметки, где это свойство равно значению ниже. Пусто — не фильтровать."],
        ["filterValue", "text", "Значение флага", "true / false или любой текст."],
        ["ratingMax", "text", "Шкала оценки", "Максимум в свойстве оценки (в интерфейсе всегда 5 звёзд)."],
        ["dateFormat", "text", "Формат даты", "yyyy yy MMMM MMM MM M dd d EEEE EEE. По умолчанию dd MMMM yyyy."],
        ["dateLocale", "text", "Язык дат", "ru, en, de …"],
        ["sourceField", "text", "Свойство «Источник»", "В заметке-цитате указывает на книгу."],
        ["notesFolder", "text", "Папка заметок-цитат", "Где искать заметки со свойством «Источник». Начните вводить — появятся папки хранилища; пусто — всё хранилище."],
    ]],
    ["План на год", [
        ["yearGoal", "text", "Книг за год", "Цель на год для инфографики: прогресс, прогноз, пунктир плана в «Пульсе». 0 — не задана."],
        ["yearGoalPages", "text", "Страниц за год", "Необязательно. 0 — не задана."],
        ["showProgress", "toggle", "Инфокарточки о прогрессе"],
    ]],
    ["Оформление", [
        ["title", "text", "Заголовок", "Пусто — не показывать."],
        ["showStats", "toggle", "Блок «месяц + инсайт»"],
        ["showPulse", "toggle", "Виджет «Пульс года»"],
        ["tagsCollapsed", "toggle", "Панель тегов свёрнута"],
        ["featured", "toggle", "Главная карточка для лучшей книги"],
        ["wideShare", "text", "Доля широких карточек", "От 0 до 1: сколько карточек занимают две колонки (кроме «Книги года»). 0 — без широких."],
        ["bigShare", "text", "Доля больших карточек", "От 0 до 1."],
        ["bigMinChars", "text", "Минимум текста для большой карточки", "Символов."],
        ["coverFromBody", "toggle", "Обложка из текста заметки", "Если файла из свойства обложки нет — взять первую картинку из заметки."],
        ["showExcerpt", "toggle", "Отрывок из заметки книги", "Если нет цитат и заметок."],
        ["showFooter", "toggle", "Строка внизу"],
        ["addButton", "toggle", "Кнопка «Добавить книгу»"],
        ["fullWidth", "toggle", "Растянуть заметку на всю ширину", "Только для блока в заметке."],
    ]],
    ["Поведение", [
        ["openInNewTab", "toggle", "Открывать заметки в новой вкладке"],
        ["defaultView", "dropdown", "Вид по умолчанию", "", { cards: "Карточки", list: "Список" }],
        ["defaultSort", "dropdown", "Сортировка по умолчанию", "", SORT_OPTIONS],
        ["coverFit", "dropdown", "Обложки в карточках", "", { cover: "Заполнить (обрезать по краям)", contain: "Показать целиком" }],
        ["tagMode", "dropdown", "Режим тегов", "", { any: "Любой из выбранных", all: "Все выбранные" }],
    ]],
];

const parseFlag = (v) => {
    const s = String(v).trim();
    if (s === "true") return true;
    if (s === "false") return false;
    return s;
};

class BookGallerySettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        const S = this.plugin.settings;
        const D = this.plugin.defaults;
        containerEl.empty();

        const save = () => this.plugin.saveSettings();

        for (const [heading, rows] of SECTIONS) {
            new Setting(containerEl).setName(heading).setHeading();
            for (const [key, type, name, desc, options] of rows) {
                const row = new Setting(containerEl).setName(name);
                if (desc) row.setDesc(desc);
                const cur = S[key] !== undefined ? S[key] : D[key];
                if (type === "toggle") {
                    row.addToggle((t) => t.setValue(!!cur).onChange((v) => { S[key] = v; save(); }));
                } else if (type === "dropdown") {
                    row.addDropdown((d) => d.addOptions(options).setValue(String(cur)).onChange((v) => { S[key] = v; save(); }));
                } else {
                    row.addText((t) => {
                        const isFolder = FOLDER_KEYS.has(key);
                        t.setValue(cur === null || cur === undefined ? "" : String(cur)).onChange((v) => {
                            const text = isFolder ? v.trim().replace(/^\/+|\/+$/g, "") : v;
                            S[key] = key === "filterValue" ? parseFlag(v) : key === "notesFolder" ? text || null : text;
                            if (key === "yearGoal" || key === "yearGoalPages") S[key] = Math.max(0, parseInt(String(v).replace(/\D/g, ""), 10) || 0);
                            save();
                        });
                        if (isFolder && t.setPlaceholder) t.setPlaceholder("Всё хранилище");
                        if (Suggest && t.inputEl && isFolder) new Suggest(this.app, t.inputEl, () => allFolders(this.app), true);
                        if (Suggest && t.inputEl && PROPERTY_KEYS.has(key)) new Suggest(this.app, t.inputEl, () => allProperties(this.app));
                    });
                }
            }
        }

        new Setting(containerEl).setName("Имена свойств").setDesc("Какие свойства заметки соответствуют полям книги.").setHeading();
        S.fields = S.fields || {};
        for (const key of Object.keys(D.fields)) {
            new Setting(containerEl).setName(FIELD_LABELS[key] || key).addText((t) => {
                t.setValue(S.fields[key] !== undefined ? S.fields[key] : D.fields[key]).onChange((v) => {
                    S.fields[key] = v.trim() || D.fields[key];
                    save();
                });
                if (Suggest && t.inputEl) new Suggest(this.app, t.inputEl, () => allProperties(this.app));
            });
        }

        new Setting(containerEl).setName("Сбросить настройки").addButton((b) =>
            b.setButtonText("Сбросить").setWarning().onClick(async () => {
                this.plugin.settings = {};
                await this.plugin.saveSettings();
                this.display();
            })
        );
    }
}

module.exports = { BookGallerySettingTab };
