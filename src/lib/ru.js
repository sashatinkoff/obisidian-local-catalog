// lib/ru.js — русские числа и склонения.
function plural(n, forms) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
const fmtNum = (n) => Number(n).toLocaleString("ru-RU");
const withUnit = (n, forms) => `${fmtNum(n)} ${plural(n, forms)}`;
module.exports = { plural, fmtNum, withUnit };
