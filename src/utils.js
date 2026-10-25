// src/utils.js — небольшие общие функции без зависимостей от настроек.

const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC_MAP[c]);

// Создать DOM-элемент: el("div", "класс", { textContent: "..." })
const el = (tag, className, props) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (props) Object.assign(node, props);
    return node;
};

// Значение свойства -> плоский массив без пустых значений.
// В frontmatter ссылка [[Имя]] без кавычек приходит как вложенный массив [["Имя"]] — разворачиваем
const toArray = (v) => {
    if (v === undefined || v === null || v === "") return [];
    if (Array.isArray(v)) return v.flatMap(toArray);
    return [v];
};

// Массив строк без пустых значений (для классов и т.п.)
const toStringList = (v) => toArray(v).map(String).filter(Boolean);

// "[[Папка/Имя|Псевдоним]]" -> "Имя" (текст для показа); обычная строка возвращается как есть
const itemToString = (item) => {
    const s = String(item ?? "").trim();
    const m = s.match(/^!?\[\[([^\]]*)\]\]$/);
    if (!m) return s;
    const [target, alias] = m[1].split("|");
    if (alias && alias.trim()) return alias.trim();
    return target.split("#")[0].split("/").pop().replace(/\.md$/i, "").trim();
};

// Список значений с разбором "a, b, c"
const splitList = (v) =>
    toArray(v)
        .flatMap((item) => itemToString(item).split(","))
        .map((s) => s.trim())
        .filter(Boolean);

// Значение даты -> миллисекунды (локальное время). Понимает 2026-09-07, 2026-09-07T10:00, 07.09.2026, Date и числа
const toMillis = (d) => {
    d = toArray(d)[0];
    if (!d) return 0;
    if (typeof d === "number") return d;
    if (d instanceof Date) return d.getTime();
    const s = String(d).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
    m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
    const t = Date.parse(s);
    return Number.isNaN(t) ? 0 : t;
};

// Число из значения свойства («4,5», 4.5, "12") или null
const toNumber = (v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isNaN(n) ? null : n;
};

// Склонение: plural(5, ["книга", "книги", "книг"]) -> "книг"
const plural = (n, forms) => {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
};

// 1920 -> "1 920" (с неразрывным пробелом)
const fmtInt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");

// Дата (мс) -> строка по формату в стиле Luxon: dd MMMM yyyy -> «07 сентября 2026».
// Токены: yyyy yy MMMM MMM MM M dd d EEEE EEE. Текст в одинарных кавычках выводится как есть.
// Привычные YYYY / YY / D из moment тоже понимаются.
const DATE_TOKENS = /yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE/g;

function formatDate(ms, fmt, locale) {
    if (!ms) return "";
    const d = new Date(ms);
    const loc = locale || "ru";
    const f = String(fmt || "dd MMMM yyyy").replace(/YYYY/g, "yyyy").replace(/YY/g, "yy").replace(/D/g, "d");
    const hasDay = /d/.test(f.replace(/'[^']*'/g, ""));
    const pad = (n) => String(n).padStart(2, "0");
    const part = (opts, type) => {
        try {
            const p = new Intl.DateTimeFormat(loc, opts).formatToParts(d).find((x) => x.type === type);
            return p ? p.value : "";
        } catch (e) {
            return "";
        }
    };
    // с числом месяц склоняется («7 сентября»), без числа — именительный («сентябрь»)
    const month = (style) => part(hasDay ? { day: "numeric", month: style } : { month: style }, "month");

    const map = {
        yyyy: () => String(d.getFullYear()),
        yy: () => pad(d.getFullYear() % 100),
        MMMM: () => month("long"),
        MMM: () => month("short"),
        MM: () => pad(d.getMonth() + 1),
        M: () => String(d.getMonth() + 1),
        dd: () => pad(d.getDate()),
        d: () => String(d.getDate()),
        EEEE: () => part({ weekday: "long" }, "weekday"),
        EEE: () => part({ weekday: "short" }, "weekday"),
    };
    return f
        .split(/('[^']*')/)
        .map((seg) => (seg.startsWith("'") ? seg.slice(1, -1) : seg.replace(DATE_TOKENS, (t) => map[t]())))
        .join("");
}

// Безопасный url(...) для inline-стиля
const cssUrl = (u) =>
    `url('${String(u).replace(/['"()\\\s]/g, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))}')`;

// Значение свойства по имени: точное совпадение, затем без учёта регистра, пробелов, «_» и «-»
// (как в Dataview: «Cover», «cover» и «COVER» — одно и то же свойство)
const normKey = (k) => String(k).toLowerCase().replace(/[\s_-]+/g, "");
const prop = (fm, name) => {
    if (!fm || !name) return undefined;
    if (Object.prototype.hasOwnProperty.call(fm, name)) return fm[name];
    const want = normKey(name);
    for (const k of Object.keys(fm)) if (normKey(k) === want) return fm[k];
    return undefined;
};

// "/Книги/" -> "Книги" ("" или "/" — всё хранилище)
const normFolder = (f) => String(f ?? "").trim().replace(/^\/+|\/+$/g, "");

module.exports = { prop, normFolder, esc, el, toArray, toStringList, itemToString, splitList, toMillis, toNumber, plural, fmtInt, cssUrl, formatDate };
