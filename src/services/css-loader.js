// services/css-loader.js — подключает все css/*.css плагина (по порядку имён) одним <style> в документ.
// Свои правки — в css/90-custom.css (он подключается последним). Повторный вызов обновляет содержимое.
const ID = "journal-stream-style";
module.exports = async function loadCss(storage) {
  const files = (await storage.listFiles("css")).filter((f) => f.endsWith(".css")).sort((a, b) => a.split("/").pop().localeCompare(b.split("/").pop()));
  const parts = [];
  for (const f of files) parts.push(`/* ${f.split("/").pop()} */\n` + (await storage.readText("css/" + f.split("/").pop())));
  let el = document.getElementById(ID);
  if (!el) { el = document.createElement("style"); el.id = ID; document.head.appendChild(el); }
  el.textContent = parts.join("\n\n");
  return files.length;
};
module.exports.STYLE_ID = ID;
