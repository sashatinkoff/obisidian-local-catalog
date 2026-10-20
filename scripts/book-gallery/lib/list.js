// lib/list.js — режим «Список»: таблица. Название — обычная внутренняя ссылка Obsidian,
// поэтому превью при наведении работает; клик обрабатывает ui.js.

const { esc } = ctx.lib.utils;
const { icon } = ctx.lib.icons;
const { starsHtml, EMPTY_COVER } = ctx.lib.data;

const tagsHtml = (tags, selected) =>
    tags.length
        ? tags
              .map((t) => `<button type="button" class="bg-chip bg-chip--sm bg-mono${selected.has(t) ? " is-on" : ""}" data-action="tag" data-tag="${esc(t)}">${esc(t)}</button>`)
              .join(" ")
        : "—";

function table(list, selectedTags) {
    if (!list.length) return `<div class="bg-empty">По этим фильтрам ничего не найдено</div>`;

    const rows = list
        .map(
            (b) => `
    <tr>
        <td><img class="bg-thumb" src="${esc(b.cover || EMPTY_COVER)}" loading="lazy" alt=""></td>
        <td><a class="internal-link bg-list-title" data-href="${esc(b.path)}" href="${esc(b.path)}">${esc(b.title)}</a></td>
        <td>${esc(b.authorText || "—")}</td>
        <td>${esc(b.genresText || "—")}</td>
        <td>${tagsHtml(b.tags, selectedTags)}</td>
        <td class="bg-nowrap"><span class="bg-stars">${starsHtml(b.score5)}</span>${b.scoreText ? ` <span class="bg-mono bg-score-num">${b.scoreText}</span>` : ""}</td>
        <td class="bg-mono bg-nowrap">${esc(b.dateText || "—")}</td>
    </tr>`
        )
        .join("");

    return `
<div class="bg-list-wrap">
<table class="bg-list">
    <thead><tr>
        <th></th><th>Название</th><th>Автор</th><th>Жанр</th><th>Теги</th><th>Оценка</th><th>Дата</th>
    </tr></thead>
    <tbody>${rows}</tbody>
</table>
</div>`;
}

return { table };
