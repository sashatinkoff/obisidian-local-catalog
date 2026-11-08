// build.js — собирает версию «один файл»: node build.js [папка-вывода]
// Результат: <вывод>/main.js (модули и стили внутри) + manifest.json. Для установщиков, которые копируют только файлы верхнего уровня.
const fs = require("fs");
const path = require("path");
const root = __dirname;
const SOURCE_MAIN = fs.existsSync(path.join(root, "main.source.js")) ? "main.source.js" : "main.js";
const out = path.resolve(process.argv[2] || path.join(root, "dist", "book-gallery"));
const readDir = (d, ext) =>
    Object.fromEntries(fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith(ext)).map((f) => [f.slice(0, -ext.length), fs.readFileSync(path.join(root, d, f), "utf8")]));
const embedded = { src: readDir("src", ".js"), styles: readDir("styles", ".css") };
const main = fs.readFileSync(path.join(root, SOURCE_MAIN), "utf8");
const marker = "const EMBEDDED = null; // @@EMBEDDED@@";
if (!main.includes(marker)) throw new Error("маркер EMBEDDED не найден в main.js");
fs.mkdirSync(out, { recursive: true });
// JSON безопасно вставляется как литерал JS (разделители строк U+2028/2029 экранируем)
const json = JSON.stringify(embedded)
    .split(String.fromCharCode(0x2028)).join("\\u2028")
    .split(String.fromCharCode(0x2029)).join("\\u2029");
fs.writeFileSync(path.join(out, "main.js"), main.replace(marker, () => "const EMBEDDED = " + json + ";"));
fs.copyFileSync(path.join(root, "manifest.json"), path.join(out, "manifest.json"));
console.log("собрано:", out);
