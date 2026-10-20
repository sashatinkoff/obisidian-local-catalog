// lib/templates.js — HTML-шаблоны карточек и таблицы. Без логики и без обработчиков событий.

const { esc } = ctx.lib.utils;

const cardsHtml = (list) =>
    list
        .map(
            (b) => `
<div class="book-card">
    <div class="book-cover-wrap" data-path="${esc(b.path)}"><img src="${esc(b.cover)}" class="book-cover" loading="lazy"></div>
    <div class="book-title">${esc(b.title)}</div>
    <div class="book-author">${esc(b.authorText || "Неизвестен")}</div>
    <div class="book-rating">${b.ratingHtml}</div>
    <div class="book-date">${esc(b.dateText)}</div>
    <a class="book-open-btn" data-path="${esc(b.path)}">Открыть</a>
</div>`
        )
        .join("");

const tagsHtml = (tags, activeTag) =>
    tags.length
        ? tags
              .map(
                  (t) =>
                      `<span class="book-table-tag${t === activeTag ? " is-active" : ""}" data-tag="${esc(t)}">${esc(t)}</span>`
              )
              .join(" ")
        : "—";

const tableHtml = (list, activeTag) => `
<table class="book-table">
    <thead><tr>
        <th>Обложка</th><th>Название</th><th>Автор</th><th>Жанр</th><th>Теги</th><th>Оценка</th><th>Дата</th>
    </tr></thead>
    <tbody>${list
        .map(
            (b) => `
    <tr>
        <td><img src="${esc(b.cover)}" class="table-cover" loading="lazy"></td>
        <td><a class="internal-link book-table-title" data-href="${esc(b.path)}" href="${esc(b.path)}">${esc(b.title)}</a></td>
        <td>${esc(b.authorText || "—")}</td>
        <td>${esc(b.genresText || "—")}</td>
        <td>${tagsHtml(b.tags, activeTag)}</td>
        <td style="white-space: nowrap;">${b.ratingHtml}</td>
        <td>${esc(b.dateText || "—")}</td>
    </tr>`
        )
        .join("")}</tbody>
</table>`;

return { cardsHtml, tableHtml };
