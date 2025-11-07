const API_KEY = "44e79bb02c9546f499bac9897bf496b4"; // вставь свой ключ здесь
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

const $q = document.getElementById('q');
const $sort = document.getElementById('sort');
const $feed = document.getElementById('feed');
const $tags = document.getElementById('tags');
const $pageInfo = document.getElementById('pageInfo');
const $loader = document.getElementById('loader');
const $sentinel = document.getElementById('sentinel');
const tpl = document.getElementById('cardTpl');

let observer;

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
//  FETCH NEWS FROM NEWSAPI
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

    const params = new URLSearchParams({
        language: 'ru',
        pageSize: String(PER_PAGE),
        page: String(apiPage),
        sortBy: 'publishedAt'
    });

    const searchQuery = buildSearchQuery();
    params.set('q', searchQuery);

    const url = `https://newsapi.org/v2/everything?${params.toString()}`;

    try {
        const res = await fetch(url, {
            headers: {
                'X-Api-Key': API_KEY
            }
        });

        if (!res.ok) {
            const errorBody = await res.json().catch(() => ({}));
            throw new Error(errorBody.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const startIndex = articles.length;
        const incoming = (data.articles || []).map((a, i) => ({
            id: startIndex + i,
            title: a.title || '(без заголовка)',
            desc: a.description || '',
            date: a.publishedAt || '',
            source: a.source?.name || '',
            url: a.url,
            image: a.urlToImage || '',
            tags: a.author ? [a.author] : [],
            content: a.content || ''
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
        if (reset) {
            articles = [];
        }
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
    if (isLoading && articles.length === 0) {
        $pageInfo.textContent = 'Загружаем свежие новости...';
    } else if (isLoading) {
        $pageInfo.textContent = 'Обновляем список...';
    } else if (!articles.length) {
        $pageInfo.textContent = 'Новости пока не найдены.';
    } else if (!hasMore) {
        $pageInfo.textContent = 'Это все новости по запросу.';
    } else {
        $pageInfo.textContent = 'Прокрутите вниз, чтобы загрузить ещё.';
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
    const combined = terms.join(' ').trim();
    return combined || FALLBACK_QUERY;
}

function uniqueTags(list){
    return [...new Set(list.flatMap(a => a.tags || []))].slice(0, 10);
}

function applyFilters(){
    let list = articles.slice();
    if (activeTag) list = list.filter(a => (a.tags || []).includes(activeTag));
    if (sort==='new') list.sort((a,b)=> new Date(b.date)-new Date(a.date));
    if (sort==='old') list.sort((a,b)=> new Date(a.date)-new Date(b.date));
    if (sort==='az') list.sort((a,b)=> a.title.localeCompare(b.title,'ru'));
    return list;
}

function renderTags(){
    $tags.innerHTML='';
    const all = ['все', ...uniqueTags(articles)];
    for(const t of all){
        const b = document.createElement('button');
        b.className = 'tag' + ((t===activeTag) || (t==='все' && !activeTag) ? ' active':'');
        b.textContent = t;
        b.addEventListener('click', ()=>{
            activeTag = (t==='все')? null : t;
            render();
        });
        $tags.append(b);
    }
}

function render(){
    const list = applyFilters();

    $feed.innerHTML='';

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
    for(const a of list){
        const node = tpl.content.cloneNode(true);
        node.querySelector('.title').textContent = a.title;
        node.querySelector('.desc').textContent = a.desc;
        node.querySelector('.date').textContent = a.date ? new Date(a.date).toLocaleDateString('ru-RU') : '';
        node.querySelector('.source').textContent = a.source;
        node.querySelector('.read').href = `article.html?id=${a.id}`;

        const tags = node.querySelector('.taglist');
        tags.innerHTML = '';
        for(const t of a.tags){
            const pill = document.createElement('span');
            pill.className='tagpill';
            pill.textContent = t;
            tags.append(pill);
        }

        fragment.append(node);
    }

    $feed.append(fragment);
    updateStatus();
}

// ========== UI Events ==========
let searchTimer;
$q.addEventListener('input', (e)=>{
    query = e.target.value.trim();
    hasMore = true;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(()=>{
        fetchNews({ reset: true });
    }, 350);
});

$sort.addEventListener('change', (e)=>{
    sort = e.target.value;
    render();
});

// ============================
//  INIT
// ============================
setupInfiniteScroll();
fetchNews({ reset: true });