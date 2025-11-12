// ============================
//  THE NEWS API CONFIG
// ============================
const API_KEY = "nRcMF8e2o4SHGIA89GSACRyre3vi1T2EYorIbzUO"; // вставь свой ключ
const PER_PAGE = 12;
const FALLBACK_QUERY = 'новости';
const OBSERVER_MARGIN = '400px';

let articles = [];
let query = '';
let sort = 'new';
let activeTag = null;
let errorMsg = '';
let apiPage = 1;
let isLoading = false;
let hasMore = true;

// ============================
//  DOM ELEMENTS
// ============================
const $q = document.getElementById('q');
const $sort = document.getElementById('sort');
const $feed = document.getElementById('feed');
const $tags = document.getElementById('tags');
const $pageInfo = document.getElementById('pageInfo');
const $loader = document.getElementById('loader');
const $sentinel = document.getElementById('sentinel');
const tpl = document.getElementById('cardTpl');

let observer;

// ============================
//  CACHE INIT
// ============================
const cachedArticles = localStorage.getItem('articlesData');
if (cachedArticles) {
    try {
        const parsed = JSON.parse(cachedArticles);
        if (Array.isArray(parsed)) {
            articles = parsed;
        }
    } catch (err) {
        console.warn('Не удалось прочитать кэш статей:', err);
    }
}

renderTags();
render();

// ============================
//  FETCH NEWS (TheNewsAPI)
// ============================
async function fetchNews({ reset = false } = {}) {
    if (isLoading) return;
    if (!hasMore && !reset) return;

    if (reset) {
        apiPage = 1;
        hasMore = true;
        errorMsg = '';
        activeTag = null;
    }

    errorMsg = '';
    isLoading = true;
    setLoader(true);
    updateStatus();

    const searchQuery = buildSearchQuery() || FALLBACK_QUERY;

    // ===> ВАЖНО: TheNewsAPI рекомендует использовать endpoint /v1/news/all или /v1/news/top
    const url = new URL('https://api.thenewsapi.com/v1/news/all');
    url.searchParams.set('api_token', API_KEY);
    url.searchParams.set('language', 'ru'); // можно 'en' или др.
    url.searchParams.set('search', searchQuery);
    url.searchParams.set('limit', String(PER_PAGE));

    try {
        const res = await fetch(url);
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.message || `HTTP ${res.status}`);
        }

        const data = await res.json();

        // ===> структура у TheNewsAPI:
        // {
        //   "meta": { "found": number, "page": number },
        //   "data": [ { "uuid": "...", "title": "...", "published_at": "...", "description": "...", "image_url": "...", "url": "...", "source": "...", "categories": [...] } ]
        // }

        const startIndex = reset ? 0 : articles.length;
        const incoming = (data.data || []).map((a, i) => ({
            id: startIndex + i,
            title: a.title || '(без заголовка)',
            desc: a.description || '',
            date: a.published_at || '',
            source: a.source || '',
            url: a.url,
            image: a.image_url || '',
            tags: a.categories || [],
            content: a.snippet || a.description || ''
        }));

        articles = reset ? incoming : articles.concat(incoming);
        localStorage.setItem('articlesData', JSON.stringify(articles));

        if (incoming.length < PER_PAGE) {
            hasMore = false;
        } else {
            apiPage += 1;
        }
    } catch (err) {
        console.error('Ошибка загрузки новостей:', err);
        if (reset) articles = [];
        errorMsg = err.message || 'Не удалось загрузить новости.';
        hasMore = false;
        localStorage.setItem('articlesData', JSON.stringify(articles));
    } finally {
        isLoading = false;
        setLoader(false);
        renderTags();
        render();
        updateStatus();
        updateObserver();
    }
}

// ============================
//  HELPERS
// ============================
function setLoader(visible) {
    if (!$loader) return;
    $loader.classList.toggle('hidden', !visible);
}

function updateStatus() {
    if (!$pageInfo) return;
    if (errorMsg) {
        $pageInfo.textContent = errorMsg;
        return;
    }
    
}

function updateObserver() {
    if (!observer || !$sentinel) return;
    if (!hasMore || errorMsg) {
        observer.unobserve($sentinel);
    } else {
        observer.observe($sentinel);
    }
}

function setupInfiniteScroll() {
    if (!$sentinel) return;
    observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
            fetchNews();
        }
    }, { root: null, rootMargin: OBSERVER_MARGIN, threshold: 0 });
    observer.observe($sentinel);
}

function buildSearchQuery() {
    const terms = [];
    if (query) terms.push(query);
    if (activeTag) terms.push(activeTag);
    return terms.join(' ').trim() || FALLBACK_QUERY;
}

function uniqueTags(list) {
    return [...new Set(list.flatMap(a => a.tags || []))].slice(0, 10);
}

function applyFilters() {
    let list = [...articles];
    if (activeTag) list = list.filter(a => (a.tags || []).includes(activeTag));
    if (sort === 'new') list.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sort === 'old') list.sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sort === 'az') list.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    return list;
}

function renderTags() {
    $tags.innerHTML = '';
    const all = ['все', ...uniqueTags(articles)];
    for (const t of all) {
        const b = document.createElement('button');
        b.className = 'tag' + ((t === activeTag) || (t === 'все' && !activeTag) ? ' active' : '');
        b.textContent = t;
        b.addEventListener('click', () => {
            activeTag = (t === 'все') ? null : t;
            render();
        });
        $tags.append(b);
    }
}

function render() {
    const list = applyFilters();
    $feed.innerHTML = '';

    if (errorMsg) {
        const error = document.createElement('div');
        error.className = 'empty error';
        error.textContent = errorMsg;
        $feed.append(error);
        updateStatus();
        return;
    }

    if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = isLoading ? 'Загружаем свежие новости...' : 'Ничего не найдено.';
        $feed.append(empty);
        updateStatus();
        return;
    }

    const fragment = document.createDocumentFragment();
    for (const a of list) {
        const node = tpl.content.cloneNode(true);
        
        // Изображение
        const cardImage = node.querySelector('.card-image');
        if (a.image) {
            cardImage.src = a.image;
            cardImage.alt = a.title;
            cardImage.style.display = 'block';
        } else {
            cardImage.style.display = 'none';
        }
        
        // Заголовок
        node.querySelector('.title').textContent = a.title;
        
        // Описание
        node.querySelector('.desc').textContent = a.desc;
        
        // Дата и источник
        node.querySelector('.date').textContent = a.date ? new Date(a.date).toLocaleDateString('ru-RU') : '';
        node.querySelector('.source').textContent = a.source || 'Неизвестный источник';
        
        // Кнопка "Читать" теперь ведёт на оригинальный сайт статьи
        const readBtn = node.querySelector('.read');
        readBtn.href = a.url;
        readBtn.target = '_blank';
        readBtn.rel = 'noopener noreferrer';

        // Теги
        const tags = node.querySelector('.taglist');
        tags.innerHTML = '';
        for (const t of a.tags) {
            const pill = document.createElement('span');
            pill.className = 'tagpill';
            pill.textContent = t;
            tags.append(pill);
        }

        fragment.append(node);
    }

    $feed.append(fragment);
    updateStatus();
}

// ============================
//  UI EVENTS
// ============================
let searchTimer;
$q.addEventListener('input', (e) => {
    query = e.target.value.trim();
    hasMore = true;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => fetchNews({ reset: true }), 350);
});

$sort.addEventListener('change', (e) => {
    sort = e.target.value;
    render();
});

// ============================
//  INIT
// ============================
setupInfiniteScroll();
fetchNews({ reset: true });
