#!/usr/bin/env node
// tools/build.js — собирает САМОДОСТАТОЧНЫЙ main.js: все модули src/**/*.js, css/*.css и README.md встроены внутрь.
// Без зависимостей:  node tools/build.js   →  main.js рядом с manifest.json. Для установки достаточно manifest.json + main.js.
// (Папки src/ и css/ в собранном варианте не читаются; исключение — css/90-custom.css на диске: ваши правки подхватываются.)
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

const modules = walk(path.join(ROOT, "src")).filter((f) => f.endsWith(".js")).sort().map((f) => {
  const id = path.relative(path.join(ROOT, "src"), f).split(path.sep).join("/").replace(/\.js$/, "");
  return `${JSON.stringify(id)}: function (module, exports, require) {\n${fs.readFileSync(f, "utf8")}\n}`;
});
const cssDir = path.join(ROOT, "css");
const css = Object.fromEntries(fs.readdirSync(cssDir).filter((n) => n.endsWith(".css")).sort().map((n) => [n, fs.readFileSync(path.join(cssDir, n), "utf8")]));
const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
const version = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")).version;

const out = `/* Journal Stream v${version} — собранный файл (tools/build.js). Не редактируйте: правьте src/ и пересобирайте. */\n` +
  `const __JS_BUNDLE__ = {\n  modules: {\n${modules.join(",\n")}\n  },\n  css: ${JSON.stringify(css)},\n  readme: ${JSON.stringify(readme)},\n};\n` +
  fs.readFileSync(path.join(__dirname, "main.template.js"), "utf8");
fs.writeFileSync(path.join(ROOT, "main.js"), out);
console.log(`main.js: ${(out.length / 1024).toFixed(0)} КБ, модулей ${modules.length}, css ${Object.keys(css).length}`);
