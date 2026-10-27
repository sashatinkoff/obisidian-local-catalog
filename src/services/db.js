// services/db.js — ЕДИНЫЙ файл данных плагина (data.json): настройки, подборки, избранное/закрепы, UI-предпочтения.
// Удалите data.json (или нажмите «Сбросить» в настройках плагина) — при следующем запуске всё пересоздастся по умолчанию.
// База одна на плагин: её делят все открытые виды (вкладка и code-block'и), а также вкладка настроек.
const { deepMerge } = require("lib/misc");
const { debounce } = require("lib/async");

module.exports = async function createDb(storage, defaults) {
  const raw = await storage.load();
  const fresh = !raw;
  const src = raw || {};
  const data = {
    version: 3,
    appVersion: src.appVersion,
    settings: deepMerge(defaults.settings, src.settings || {}),
    ui: src.ui || {},
    presets: Array.isArray(src.presets) ? src.presets : defaults.presets,
    flags: src.flags || {},
  };
  const save = debounce(() => storage.save(data), 400);
  if (fresh) await storage.save(data);
  // Сброс: всё возвращается к значениям по умолчанию, объект data остаётся тем же (на него ссылаются открытые виды).
  async function reset() {
    data.settings = deepMerge(defaults.settings, {});
    data.ui = {}; data.flags = {}; data.presets = JSON.parse(JSON.stringify(defaults.presets));
    data.appVersion = undefined;
    await storage.save(data);
  }
  return { data, save, flush: () => save.flush(), reset, fresh };
};
