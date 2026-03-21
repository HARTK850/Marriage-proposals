// =========================================
// admin.js — Admin panel logic
// =========================================

const API = '/api/items';
let allItems = [];
let editingId = null;
let pendingDeleteId = null;
let currentTags = [];

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  loadItems();
  setupForm();
  setupTagsInput();
  setupAdminSearch();
  setupDeleteModal();
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allItems = data.items || data || [];
    renderTable(allItems);
    updateStats(allItems.length);
  } catch (err) {
    showToast('שגיאה בטעינת פריטים: ' + err.message, 'error');
    document.getElementById('adminTableBody').innerHTML = `
      <tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">
        שגיאה בטעינת נתונים
      </td></tr>`;
  }
}

// === RENDER TABLE ===
function renderTable(items) {
  const tbody = document.getElementById('adminTableBody');
  const empty = document.getElementById('emptyTable');

  tbody.innerHTML = '';

  if (!items.length) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  items.forEach(item => {
    const tags = parseTags(item.tags);
    const date = item.created_at ? new Date(item.created_at).toLocaleDateString('he-IL') : '—';
    const tagsHtml = tags.map(t => `<span class="tag outline" style="font-size:0.7rem">${escHtml(t)}</span>`).join('');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        ${item.image
          ? `<img class="table-thumb" src="${escHtml(item.image)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
          : `<div class="table-thumb-placeholder">◈</div>`
        }
      </td>
      <td><div class="table-title">${escHtml(item.title)}</div></td>
      <td><div class="table-desc">${escHtml(item.description || '')}</div></td>
      <td><div class="table-tags">${tagsHtml || '—'}</div></td>
      <td><span class="table-date">${date}</span></td>
      <td>
        <div class="row-actions">
          <button class="action-btn edit" data-id="${item.id}">✏️ עריכה</button>
          <button class="action-btn delete" data-id="${item.id}" data-title="${escHtml(item.title)}">🗑 מחיקה</button>
        </div>
      </td>
    `;

    tr.querySelector('.action-btn.edit').addEventListener('click', () => startEdit(item));
    tr.querySelector('.action-btn.delete').addEventListener('click', () => startDelete(item));

    tbody.appendChild(tr);
  });
}

function updateStats(count) {
  document.getElementById('adminStats').textContent = `סה"כ ${count} פריטים`;
}

// === FORM SETUP ===
function setupForm() {
  const form = document.getElementById('itemForm');
  const textarea = document.getElementById('fieldDesc');
  const imgInput = document.getElementById('fieldImage');

  // Char count
  textarea.addEventListener('input', () => {
    document.getElementById('descCount').textContent = `${textarea.value.length}/1000`;
  });

  // Image preview
  let previewTimer;
  imgInput.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const url = imgInput.value.trim();
      const preview = document.getElementById('imgPreview');
      const img = document.getElementById('previewImg');
      if (url) {
        img.src = url;
        img.onload = () => { preview.style.display = 'block'; };
        img.onerror = () => { preview.style.display = 'none'; };
      } else {
        preview.style.display = 'none';
      }
    }, 500);
  });

  // Reset buttons
  document.getElementById('clearFormBtn').addEventListener('click', resetForm);
  document.getElementById('resetFormBtn').addEventListener('click', resetForm);

  // Submit
  form.addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.querySelector('.btn-text').style.display = 'none';
  btn.querySelector('.btn-loader').style.display = 'inline';

  const payload = {
    title: document.getElementById('fieldTitle').value.trim(),
    description: document.getElementById('fieldDesc').value.trim(),
    image: document.getElementById('fieldImage').value.trim() || null,
    tags: JSON.stringify(currentTags),
  };

  try {
    let res, data;
    if (editingId) {
      res = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...payload }),
      });
    } else {
      res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    showToast(editingId ? '✅ פריט עודכן בהצלחה' : '✅ פריט נוסף בהצלחה', 'success');
    resetForm();
    await loadItems();
  } catch (err) {
    showToast('שגיאה: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-text').style.display = 'inline';
    btn.querySelector('.btn-loader').style.display = 'none';
  }
}

// === VALIDATE ===
function validateForm() {
  let valid = true;

  const titleEl = document.getElementById('fieldTitle');
  const descEl = document.getElementById('fieldDesc');
  const imgEl = document.getElementById('fieldImage');

  clearErrors();

  if (!titleEl.value.trim()) {
    setError('errTitle', titleEl, 'כותרת הינה שדה חובה');
    valid = false;
  } else if (titleEl.value.trim().length < 2) {
    setError('errTitle', titleEl, 'כותרת חייבת להכיל לפחות 2 תווים');
    valid = false;
  }

  if (!descEl.value.trim()) {
    setError('errDesc', descEl, 'תיאור הינו שדה חובה');
    valid = false;
  }

  if (imgEl.value.trim() && !isValidUrl(imgEl.value.trim())) {
    setError('errImage', imgEl, 'כתובת URL לא חוקית');
    valid = false;
  }

  return valid;
}

function setError(errId, input, msg) {
  document.getElementById(errId).textContent = msg;
  input.classList.add('error');
  input.addEventListener('input', () => {
    document.getElementById(errId).textContent = '';
    input.classList.remove('error');
  }, { once: true });
}

function clearErrors() {
  ['errTitle', 'errDesc', 'errImage'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  document.querySelectorAll('.field-group input.error, .field-group textarea.error')
    .forEach(el => el.classList.remove('error'));
}

function isValidUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

// === EDIT ===
function startEdit(item) {
  editingId = item.id;
  document.getElementById('editId').value = item.id;
  document.getElementById('fieldTitle').value = item.title || '';
  document.getElementById('fieldDesc').value = item.description || '';
  document.getElementById('fieldImage').value = item.image || '';
  document.getElementById('descCount').textContent = `${(item.description || '').length}/1000`;

  currentTags = parseTags(item.tags);
  renderTags();

  if (item.image) {
    const preview = document.getElementById('imgPreview');
    const previewImg = document.getElementById('previewImg');
    previewImg.src = item.image;
    preview.style.display = 'block';
  }

  document.getElementById('formTitle').textContent = '✏️ עריכת פריט';
  document.getElementById('resetFormBtn').style.display = 'inline';
  document.getElementById('submitBtn').querySelector('.btn-text').textContent = 'עדכן פריט';

  document.querySelector('.admin-sidebar').scrollTo({ top: 0, behavior: 'smooth' });
  document.getElementById('fieldTitle').focus();
}

// === DELETE ===
function startDelete(item) {
  pendingDeleteId = item.id;
  document.getElementById('deleteItemName').textContent = item.title;
  document.getElementById('deleteModal').classList.add('open');
}

function setupDeleteModal() {
  document.getElementById('confirmDelete').addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    try {
      const res = await fetch(API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pendingDeleteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      showToast('🗑 פריט נמחק', 'success');
      await loadItems();
    } catch (err) {
      showToast('שגיאה: ' + err.message, 'error');
    } finally {
      pendingDeleteId = null;
      document.getElementById('deleteModal').classList.remove('open');
    }
  });

  document.getElementById('cancelDelete').addEventListener('click', () => {
    pendingDeleteId = null;
    document.getElementById('deleteModal').classList.remove('open');
  });

  document.getElementById('deleteModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('deleteModal')) {
      pendingDeleteId = null;
      document.getElementById('deleteModal').classList.remove('open');
    }
  });
}

// === RESET FORM ===
function resetForm() {
  editingId = null;
  currentTags = [];
  document.getElementById('editId').value = '';
  document.getElementById('fieldTitle').value = '';
  document.getElementById('fieldDesc').value = '';
  document.getElementById('fieldImage').value = '';
  document.getElementById('descCount').textContent = '0/1000';
  document.getElementById('imgPreview').style.display = 'none';
  document.getElementById('formTitle').textContent = '➕ פריט חדש';
  document.getElementById('resetFormBtn').style.display = 'none';
  document.getElementById('submitBtn').querySelector('.btn-text').textContent = 'שמור פריט';
  renderTags();
  clearErrors();
}

// === TAGS INPUT ===
function setupTagsInput() {
  const input = document.getElementById('fieldTags');

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input.value.trim().replace(/,$/, ''));
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && currentTags.length) {
      currentTags.pop();
      renderTags();
    }
  });

  input.addEventListener('blur', () => {
    if (input.value.trim()) {
      addTag(input.value.trim());
      input.value = '';
    }
  });
}

function addTag(tag) {
  if (!tag || currentTags.includes(tag) || currentTags.length >= 10) return;
  currentTags.push(tag);
  renderTags();
}

function renderTags() {
  const list = document.getElementById('tagsList');
  list.innerHTML = '';
  currentTags.forEach((tag, i) => {
    const chip = document.createElement('div');
    chip.className = 'tag-chip';
    chip.innerHTML = `${escHtml(tag)}<span class="tag-chip-remove" data-i="${i}">✕</span>`;
    chip.querySelector('.tag-chip-remove').addEventListener('click', () => {
      currentTags.splice(i, 1);
      renderTags();
    });
    list.appendChild(chip);
  });
}

// === ADMIN SEARCH ===
function setupAdminSearch() {
  document.getElementById('adminSearch').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allItems.filter(i =>
      i.title?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      parseTags(i.tags).join(' ').toLowerCase().includes(q)
    );
    renderTable(filtered);
    updateStats(filtered.length);
  });
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
  setTimeout(() => t.classList.remove('show'), 3500);
}
