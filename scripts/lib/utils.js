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

return { esc, el, toArray, toStringList, itemToString, splitList, toMillis };
