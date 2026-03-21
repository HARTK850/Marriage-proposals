// =========================================
// script.js — Public display page logic
// =========================================

const API = '/api/items';

let allItems = [];
let favorites = JSON.parse(localStorage.getItem('catalog_favorites') || '[]');
let showFavsOnly = false;
let currentItem = null;
let isListView = false;

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  loadItems();
  setupSearch();
  setupModal();
  setupViewToggle();
  setupFavorites();
  updateFavCount();
});

// === DARK MODE ===
function initDarkMode() {
  const saved = localStorage.getItem('catalog_darkmode');
  if (saved === 'true' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.replace('light-mode', 'dark-mode');
  }
  document.getElementById('darkModeToggle').addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode', !isDark);
    localStorage.setItem('catalog_darkmode', isDark);
  });
}

// === LOAD ITEMS ===
async function loadItems() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error('שגיאה בטעינת הנתונים');
    const data = await res.json();
    allItems = data.items || data || [];
    renderItems(allItems);
    buildTagFilter(allItems);
  } catch (err) {
    showToast('שגיאה: ' + err.message, 'error');
    document.getElementById('itemsGrid').innerHTML = '';
    document.getElementById('emptyState').style.display = 'block';
  }
}

// === RENDER ===
function renderItems(items) {
  const grid = document.getElementById('itemsGrid');
  const empty = document.getElementById('emptyState');
  const info = document.getElementById('resultsInfo');

  grid.innerHTML = '';

  if (!items.length) {
    empty.style.display = 'block';
    info.textContent = '';
    return;
  }

  empty.style.display = 'none';
  info.textContent = `מציג ${items.length} מתוך ${allItems.length} פריטים`;

  items.forEach((item, i) => {
    const card = createCard(item, i);
    grid.appendChild(card);
  });

  // Lazy load images
  const imgs = grid.querySelectorAll('img[loading="lazy"]');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const img = e.target;
          img.src = img.dataset.src || img.src;
          img.onload = () => img.classList.add('loaded');
          obs.unobserve(img);
        }
      });
    }, { rootMargin: '100px' });
    imgs.forEach(img => obs.observe(img));
  } else {
    imgs.forEach(img => img.classList.add('loaded'));
  }
}

function createCard(item, i) {
  const card = document.createElement('div');
  card.className = 'item-card';
  card.style.animationDelay = `${i * 0.05}s`;
  const isFav = favorites.includes(String(item.id));

  const tags = parseTags(item.tags);
  const tagsHtml = tags.slice(0, 3).map(t => `<span class="tag">${escHtml(t)}</span>`).join('');
  const date = item.created_at ? new Date(item.created_at).toLocaleDateString('he-IL') : '';

  card.innerHTML = `
    <div class="card-img-wrap">
      ${item.image
        ? `<img src="${escHtml(item.image)}" alt="${escHtml(item.title)}" loading="lazy" />`
        : `<div class="card-img-placeholder">◈</div>`
      }
      <button class="card-fav ${isFav ? 'active' : ''}" data-id="${item.id}" title="מועדפים">
        ${isFav ? '★' : '☆'}
      </button>
    </div>
    <div class="card-body">
      <div class="card-tags">${tagsHtml}</div>
      <h3 class="card-title">${escHtml(item.title)}</h3>
      <p class="card-desc">${escHtml(item.description || '')}</p>
    </div>
    <div class="card-footer">
      <span>${date}</span>
      <span>לחץ לפרטים ←</span>
    </div>
  `;

  // Open modal
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-fav')) return;
    openModal(item);
  });

  // Favorite toggle
  card.querySelector('.card-fav').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(item.id, card.querySelector('.card-fav'));
  });

  return card;
}

// === SEARCH & FILTER ===
function setupSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearch');
  const tagFilter = document.getElementById('tagFilter');

  const applyFilters = () => {
    const q = input.value.trim().toLowerCase();
    const tag = tagFilter.value;
    clearBtn.style.display = q ? 'block' : 'none';

    let filtered = allItems;

    if (showFavsOnly) {
      filtered = filtered.filter(i => favorites.includes(String(i.id)));
    }

    if (q) {
      filtered = filtered.filter(i => {
        const tags = parseTags(i.tags).join(' ').toLowerCase();
        return i.title?.toLowerCase().includes(q)
          || i.description?.toLowerCase().includes(q)
          || tags.includes(q);
      });
    }

    if (tag) {
      filtered = filtered.filter(i => parseTags(i.tags).includes(tag));
    }

    renderItems(filtered);
  };

  input.addEventListener('input', applyFilters);
  tagFilter.addEventListener('change', applyFilters);
  clearBtn.addEventListener('click', () => { input.value = ''; applyFilters(); });

  // expose applyFilters so setupFavorites can call it
  window._applyFilters = applyFilters;
}

function buildTagFilter(items) {
  const all = new Set();
  items.forEach(i => parseTags(i.tags).forEach(t => all.add(t)));
  const sel = document.getElementById('tagFilter');
  [...all].sort().forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
}

// === MODAL ===
function setupModal() {
  const overlay = document.getElementById('itemModal');
  document.getElementById('modalClose').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  document.getElementById('modalFav').addEventListener('click', () => {
    if (currentItem) toggleFavorite(currentItem.id, document.getElementById('modalFav'), true);
  });
}

function openModal(item) {
  currentItem = item;
  const isFav = favorites.includes(String(item.id));
  const tags = parseTags(item.tags);
  const date = item.created_at ? new Date(item.created_at).toLocaleString('he-IL') : 'לא ידוע';

  const imgWrap = document.getElementById('modalImg');
  if (item.image) {
    imgWrap.src = item.image;
    imgWrap.alt = item.title;
    imgWrap.style.display = '';
    imgWrap.onload = () => imgWrap.classList.add('loaded');
  } else {
    imgWrap.style.display = 'none';
  }

  document.getElementById('modalTags').innerHTML = tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('');
  document.getElementById('modalTitle').textContent = item.title;
  document.getElementById('modalDesc').textContent = item.description || 'אין תיאור';
  document.getElementById('modalMeta').textContent = `נוצר: ${date} | ID: ${item.id}`;

  const favBtn = document.getElementById('modalFav');
  favBtn.textContent = isFav ? '★ הסר ממועדפים' : '♡ הוסף למועדפים';
  favBtn.classList.toggle('active', isFav);

  document.getElementById('itemModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('itemModal').classList.remove('open');
  document.body.style.overflow = '';
  currentItem = null;
}

// === VIEW TOGGLE ===
function setupViewToggle() {
  const grid = document.getElementById('itemsGrid');
  document.getElementById('gridView').addEventListener('click', (e) => {
    grid.classList.remove('list-view');
    document.getElementById('gridView').classList.add('active');
    document.getElementById('listView').classList.remove('active');
    isListView = false;
  });
  document.getElementById('listView').addEventListener('click', (e) => {
    grid.classList.add('list-view');
    document.getElementById('listView').classList.add('active');
    document.getElementById('gridView').classList.remove('active');
    isListView = true;
  });
}

// === FAVORITES ===
function setupFavorites() {
  document.getElementById('favsOnlyBtn').addEventListener('click', function () {
    showFavsOnly = !showFavsOnly;
    this.classList.toggle('active', showFavsOnly);
    if (window._applyFilters) window._applyFilters();
  });
}

function toggleFavorite(id, btn, isModalBtn = false) {
  const sid = String(id);
  const idx = favorites.indexOf(sid);
  if (idx === -1) {
    favorites.push(sid);
    if (isModalBtn) { btn.textContent = '★ הסר ממועדפים'; btn.classList.add('active'); }
    else { btn.textContent = '★'; btn.classList.add('active'); }
    showToast('נוסף למועדפים ★', 'success');
  } else {
    favorites.splice(idx, 1);
    if (isModalBtn) { btn.textContent = '♡ הוסף למועדפים'; btn.classList.remove('active'); }
    else { btn.textContent = '☆'; btn.classList.remove('active'); }
    showToast('הוסר מהמועדפים');
  }
  localStorage.setItem('catalog_favorites', JSON.stringify(favorites));
  updateFavCount();

  // Update any visible card fav buttons
  document.querySelectorAll(`.card-fav[data-id="${id}"]`).forEach(b => {
    const isFav = favorites.includes(sid);
    b.textContent = isFav ? '★' : '☆';
    b.classList.toggle('active', isFav);
  });
}

function updateFavCount() {
  document.getElementById('favCount').textContent = favorites.length;
}

// === UTILS ===
function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try { return JSON.parse(tags); } catch { return String(tags).split(',').map(t => t.trim()).filter(Boolean); }
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => t.classList.remove('show'), 3000);
}
