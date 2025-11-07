const articles = JSON.parse(localStorage.getItem('articlesData')) || [];

function getParam(name){
    const url = new URL(location.href);
    return url.searchParams.get(name);
}

function renderArticle(){
    const container = document.getElementById('article');
    container.innerHTML = '';

    const idParam = getParam('id');
    if (idParam === null) {
        container.textContent = 'Не указан идентификатор статьи.';
        return;
    }

    const id = Number(idParam);
    if (Number.isNaN(id)) {
        container.textContent = 'Некорректный идентификатор статьи.';
        return;
    }

    const art = articles.find(a => a.id === id);

    if (!art) {
        container.textContent = 'Статья не найдена. Вернитесь на главную и выберите материал снова.';
        return;
    }

    const title = document.createElement('h1');
    title.textContent = art.title;
    container.append(title);

    const meta = document.createElement('div');
    meta.className = 'meta';
    const dateStr = art.date ? new Date(art.date).toLocaleDateString('ru-RU') : '';
    const sourceStr = art.source || '';
    meta.textContent = [dateStr, sourceStr].filter(Boolean).join(' · ');
    if (meta.textContent) {
        container.append(meta);
    }

    if (art.image) {
        const figure = document.createElement('figure');
        figure.className = 'hero';
        const img = document.createElement('img');
        img.src = art.image;
        img.alt = art.title;
        figure.append(img);
        container.append(figure);
    }

    if (art.desc) {
        const desc = document.createElement('p');
        desc.className = 'desc';
        desc.textContent = art.desc;
        container.append(desc);
    }

    const body = document.createElement('div');
    body.className = 'content';
    body.textContent = art.content || art.desc || 'Текст статьи недоступен.';
    container.append(body);

    if (art.tags && art.tags.length) {
        const tagList = document.createElement('div');
        tagList.className = 'taglist';
        for (const t of art.tags) {
            const pill = document.createElement('span');
            pill.className = 'tagpill';
            pill.textContent = t;
            tagList.append(pill);
        }
        container.append(tagList);
    }

    if (art.url) {
        const link = document.createElement('a');
        link.className = 'read-source';
        link.href = art.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = 'Открыть оригинал на источнике';
        container.append(link);
    }
}

renderArticle();
