// plugin/settings-tab.js — вкладка «Journal Stream» в настройках Obsidian. Правит тот же data.json, что и интерфейс ленты.
const { PluginSettingTab, Setting, Notice } = require("obsidian");

const csv = (a) => (a || []).join(", ");
const parseCsv = (s) => String(s || "").split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
const slug = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "src";

const exampleText = (nn) => { const { newNotePath, fmtTokens, DEFAULT_DATE_RULE } = require("lib/new-note-path"), d = new Date(); return `${newNotePath(nn, d)}.md · date: ${fmtTokens(nn.dateRule || DEFAULT_DATE_RULE, d, nn.dateLang || "ru")}`; };

class JournalStreamSettingTab extends PluginSettingTab {
  constructor(app, plugin, core) { super(app, plugin); this.plugin = plugin; this.core = core; }

  display() {
    const { containerEl: el } = this, db = this.core.db, s = db.data.settings;
    el.empty();
    const changed = () => { db.save(); this.plugin.scheduleRemount(); if (this.example) this.example.setDesc(exampleText(s.newNote)); };
    const text = (name, desc, get, set, opts = {}) => new Setting(el).setName(name).setDesc(desc).addText((t) => { t.setPlaceholder(opts.placeholder || "").setValue(get()).onChange((v) => { set(v); changed(); }); });
    const area = (name, desc, get, set, placeholder) => new Setting(el).setName(name).setDesc(desc).addTextArea((t) => { t.setPlaceholder(placeholder || "").setValue(get()).onChange((v) => { set(v); changed(); }); t.inputEl.rows = 3; });
    const toggle = (name, desc, key) => new Setting(el).setName(name).setDesc(desc).addToggle((t) => t.setValue(!!s[key]).onChange((v) => { s[key] = v; changed(); }));
    const drop = (name, desc, key, options) => new Setting(el).setName(name).setDesc(desc).addDropdown((d) => { for (const [v, l] of options) d.addOption(v, l); d.setValue(String(s[key])).onChange((v) => { s[key] = v; changed(); }); });
    const drop2 = (name, desc, get, set, options, redraw) => new Setting(el).setName(name).setDesc(desc).addDropdown((d) => { for (const [v, l] of options) d.addOption(v, l); d.setValue(get()).onChange((v) => { set(v); changed(); if (redraw) this.display(); }); });
    const num = (name, desc, get, set, min, max) => text(name, desc, () => String(get()), (v) => { const n = Number(v); if (isFinite(n) && n >= min && n <= max) set(n); });

    el.createEl("h2", { text: "Источники заметок" });
    area("Папки с заметками", "По одной в строке. Пусто — весь vault. Несколько папок → в карточках можно показывать бейдж источника.",
      () => (s.sources || []).filter((x) => x.folder).map((x) => x.folder).join("\n"),
      (v) => { const folders = v.split("\n").map((x) => x.trim().replace(/^\/+|\/+$/g, "")).filter(Boolean); const old = s.sources || [];
        s.sources = folders.length ? folders.map((f) => { const o = old.find((x) => x.folder === f); return o || { id: slug(f.split("/").pop()), label: f.split("/").pop(), folder: f, enabled: true }; }) : [{ id: "all", label: "Vault", folder: "", enabled: true }]; }, "notes");
    area("Исключить папки", "По одной в строке: заметки из них не попадут в ленту.", () => (s.excludeFolders || []).join("\n"), (v) => { s.excludeFolders = v.split("\n").map((x) => x.trim()).filter(Boolean); }, "templates");
    text("Исключить теги", "Через запятую, без #.", () => csv(s.excludeTags), (v) => { s.excludeTags = parseCsv(v).map((t) => t.replace(/^#/, "").toLowerCase()); });
    text("Поля даты", "Поля frontmatter, откуда брать дату записи (по порядку). Если их нет — дата из имени файла (2024-10-01) или дата создания.", () => csv(s.dateFields), (v) => { const l = parseCsv(v); if (l.length) s.dateFields = l; });
    drop("Время, если его нет в дате", "Откуда брать время записи, если в дате его нет.", "timeFallback", [["none", "Не показывать"], ["ctime", "Время создания файла"], ["mtime", "Время изменения файла"]]);
    text("Теги избранного", "Через запятую.", () => csv(s.favoriteTags), (v) => { s.favoriteTags = parseCsv(v).map((t) => t.replace(/^#/, "").toLowerCase()); });
    text("Теги цитат", "Через запятую.", () => csv(s.quoteTags), (v) => { s.quoteTags = parseCsv(v).map((t) => t.replace(/^#/, "").toLowerCase()); });

    el.createEl("h2", { text: "Новая заметка" });
    const nn = s.newNote;
    drop2("Куда складывать", "Корень vault, одна папка или правило с датой.", () => nn.mode, (v) => { nn.mode = v; }, [["root", "В корень vault"], ["folder", "В папку"], ["rule", "По правилу"]], true);
    text("Папка", "Для режима «В папку» и для %%FOLDER_NAME в правиле. Например: notes", () => nn.folder, (v) => { nn.folder = v.trim().replace(/^\/+|\/+$/g, ""); });
    text("Правило", "Папки и имя файла одной строкой. %%FOLDER_NAME — папка из поля выше; YYYY год, MM месяц числом, MMMM месяц словом, DD день, hh часы, mm минуты.", () => nn.rule, (v) => { nn.rule = v.trim(); }, { placeholder: "%%FOLDER_NAME/YYYY/YYYY-MM-MMMM/YYYY-MM-DD-hh-mm" });
    drop2("Месяц в названиях папок", "Язык токена MMMM в пути: English → 2026-10-October, Русский → 2026-10-Октябрь.", () => nn.folderLang || "en", (v) => { nn.folderLang = v; }, [["en", "English (October)"], ["ru", "Русский (Октябрь)"]]);
    text("Имя файла", "Для режимов «В корень» и «В папку».", () => nn.fileName, (v) => { nn.fileName = v.trim() || "YYYY-MM-DD-hh-mm"; });
    text("Дата в заметке", "Как записать дату во frontmatter (поле из «Полей даты»). Токены: YYYY, MM, MMMM (месяц словом; после «D » — «октября»), DD и D (день), hh, mm. По умолчанию: D MMMM YYYY, hh:mm", () => nn.dateRule, (v) => { nn.dateRule = v.trim() || "D MMMM YYYY, hh:mm"; }, { placeholder: "D MMMM YYYY, hh:mm" });
    drop2("Месяц в дате заметки", "Язык токена MMMM в дате: Русский → 16 октября 2026, English → 16 October 2026.", () => nn.dateLang || "ru", (v) => { nn.dateLang = v; }, [["ru", "Русский (октября)"], ["en", "English (October)"]]);
    this.example = new Setting(el).setName("Пример").setDesc(exampleText(nn));
    new Setting(el).setName("Открывать после создания").addToggle((t) => t.setValue(nn.open !== false).onChange((v) => { nn.open = v; changed(); }));

    el.createEl("h2", { text: "Вид" });
    drop("Раздел по умолчанию", "С какого экрана открывается лента.", "defaultView", [["overview", "Обзор"], ["stream", "Лента"], ["bento", "Бенто"], ["collections", "Подборки"], ["studio", "Конструктор"]]);
    drop("Тема", "«Как в Obsidian» — следовать теме приложения.", "theme", [["auto", "Как в Obsidian"], ["light", "Светлая"], ["dark", "Тёмная"]]);
    toggle("На всю ширину", "Растянуть ленту на всю ширину заметки/вкладки.", "fullWidth");
    drop("Скрывать боковую панель", "При открытии вкладки с лентой (не код-блока) сворачивать боковые панели Obsidian — больше места для карточек.", "hideSidebar", [["none", "Не скрывать"], ["left", "Левую"], ["right", "Правую"], ["both", "Обе"]]);
    toggle("Возвращать панель при закрытии", "Раскрыть скрытые панели обратно, когда вкладка с лентой закрыта.", "restoreSidebar");
    toggle("Открывать заметки в плавающем окне", "Клик по карточке показывает заметку в окне просмотра (не в редакторе); на карточках скрыты ссылки вперёд/назад (бэклинки). Ctrl/Cmd+клик — открыть в редакторе. Кнопка-глаз в шапке ленты переключает режим на лету.", "popupView");
    toggle("Открывать заметки в новой вкладке", "Иначе — в текущей (Ctrl/Cmd+клик всегда в новой).", "openInNewTab");
    num("Колонок минимум", "На десктопе (1–6).", () => s.columns.min, (n) => { s.columns.min = n; if (s.columns.max < n) s.columns.max = n; }, 1, 6);
    num("Колонок максимум", "На десктопе (1–8).", () => s.columns.max, (n) => { s.columns.max = Math.max(n, s.columns.min); }, 1, 8);
    num("Минимальная ширина карточки, px", "По ней считается, сколько колонок помещается (200–800).", () => s.minCardWidth, (n) => { s.minCardWidth = n; }, 200, 800);
    num("Мобильный вид уже, px", "Ниже этой ширины блока лента — в один столбец с мобильным интерфейсом.", () => s.singleColumnBelow, (n) => { s.singleColumnBelow = n; }, 300, 1200);
    num("Карточек за раз (десктоп)", "Размер «страницы» ленты.", () => s.pageSize, (n) => { s.pageSize = n; }, 6, 200);
    num("Карточек за раз (телефон)", "", () => s.pageSizeMobile, (n) => { s.pageSizeMobile = n; }, 4, 100);
    toggle("Бейдж источника на карточках", "Имеет смысл при нескольких папках.", "showSourceBadge");

    el.createEl("h2", { text: "Поиск и диагностика" });
    toggle("Фоновая индексация текстов", "После открытия ленты читает тела заметок в фоне — поиск находит и по тексту, не только по заголовкам.", "autoIndex");
    toggle("Подробный лог (debug)", "Пишет в консоль (Ctrl+Shift+I) ход восстановления прокрутки.", "debug");

    el.createEl("h2", { text: "Данные" });
    new Setting(el).setName("Сбросить всё").setDesc("Настройки, подборки, избранное и предпочтения интерфейса вернутся к значениям по умолчанию. Файл data.json в папке плагина можно также просто удалить.")
      .addButton((b) => b.setButtonText("Сбросить").setWarning().onClick(async () => {
        if (!b.__armed) { b.__armed = true; b.setButtonText("Точно сбросить?"); setTimeout(() => { b.__armed = false; b.setButtonText("Сбросить"); }, 4000); return; }
        await this.core.db.reset(); new Notice("Journal Stream: данные сброшены"); this.plugin.scheduleRemount(true); this.display();
      }));
  }
}
module.exports = { JournalStreamSettingTab };
