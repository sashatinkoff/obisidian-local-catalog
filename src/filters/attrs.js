// filters/attrs.js — атрибуты-переключатели («С медиа», «Цитаты», «Задачи» …).
const ATTRS = [
  { id: "media", label: "С медиа", icon: "image" },
  { id: "photo", label: "С фото", icon: "image" },
  { id: "video", label: "Видеозаписи", icon: "video" },
  { id: "audio", label: "Аудио", icon: "mic" },
  { id: "quote", label: "Цитаты", icon: "quote" },
  { id: "task", label: "Задачи", icon: "tasks" },
  { id: "link", label: "Со ссылками", icon: "link" },
];
const label = (id) => (ATTRS.find((a) => a.id === id) || { label: id }).label;
module.exports = { ATTRS, label };
