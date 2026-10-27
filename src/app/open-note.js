// app/open-note.js — открытие заметок из виджета.
// Вкладка: настройка openInNewTab (кнопка в навигации) или Ctrl/Cmd/средняя кнопка — всегда в новой.
// Если заметка открывается в этой же вкладке — фиксируем прокрутку и снимаем «полную ширину» со страницы (для code-block),
// чтобы открытая заметка отображалась с обычными отступами.
module.exports = function createOpenNote(ctx) {
  const wantsNewTab = (evt) => !!(ctx.store.get().openInNewTab || (evt && (evt.ctrlKey || evt.metaKey || evt.button === 1)));
  // Режим «плавающее окно»: клик по карточке показывает заметку в окне просмотра. Ctrl/Cmd/средняя кнопка — как обычно, в редакторе.
  const wantsPopup = (evt) => !!(ctx.store.get().popupView && ctx.openPreview && !(evt && (evt.ctrlKey || evt.metaKey || evt.button === 1)));
  const open = (linktext, source, evt) => {
    if (wantsPopup(evt)) return ctx.openPreview(linktext, source);
    const newTab = wantsNewTab(evt);
    if (!newTab && ctx.leavePage) ctx.leavePage();
    return ctx.app.workspace.openLinkText(linktext, source || "", newTab);
  };
  return { openNote: (path, evt) => open(path, "", evt), openLink: (link, source, evt) => open(link, source, evt) };
};
