// lib/utils.js — небольшие общие функции без зависимостей от настроек.

const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC_MAP[c]);

// Создать DOM-элемент: el("div", "класс", { textContent: "..." })
const el = (tag, className, props) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (props) Object.assign(node, props);
    return node;
};

// Dataview-массив / обычный массив / скаляр -> обычный массив
const toArray = (v) => {
    if (v === undefined || v === null || v === "") return [];
    if (Array.isArray(v)) return v;
    if (v.values && Array.isArray(v.values)) return v.values;
    return [v];
};

// Массив строк без пустых значений (для классов и т.п.)
const toStringList = (v) => toArray(v).map(String).filter(Boolean);

// Элемент списка -> строка (поддержка ссылок [[...]])
const itemToString = (item) => {
    if (item && item.path) {
        return item.display || item.path.split("/").pop().replace(/\.md$/, "");
    }
    return String(item);
};

// Список значений с разбором "a, b, c"
const splitList = (v) =>
    toArray(v)
        .flatMap((item) => itemToString(item).split(","))
        .map((s) => s.trim())
        .filter(Boolean);

const toMillis = (d) => {
    if (!d) return 0;
    if (d.toMillis) return d.toMillis();
    const t = Date.parse(d);
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

return { esc, el, toArray, toStringList, itemToString, splitList, toMillis, toNumber, plural, fmtInt, cssUrl, formatDate };
