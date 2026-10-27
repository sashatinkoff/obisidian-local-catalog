// ui/common/confirm-button.js — кнопка опасного действия с подтверждением вторым кликом («Удалить?»).
const { h, clear } = require("lib/dom");
const { icon } = require("lib/icons");

module.exports = function confirmButton({ title = "Удалить", confirmText = "Удалить?", label, onConfirm, disabled = false, cls = "sf-iconbtn" }) {
  let armed = false, timer = null;
  const b = h("button", { type: "button", class: [cls, disabled && "is-disabled"], title, disabled: disabled || null });
  function draw() {
    clear(b);
    b.classList.toggle("is-armed", armed);
    if (armed) b.append(h("span", { class: "sf-confirm__text" }, confirmText));
    else { b.append(icon("trash", { size: 14 })); if (label) b.append(h("span", null, label)); }
  }
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (!armed) { armed = true; draw(); timer = setTimeout(() => { armed = false; draw(); }, 2500); return; }
    clearTimeout(timer); armed = false; draw(); onConfirm(e);
  });
  draw();
  return b;
};
