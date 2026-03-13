// app.js — MyCRM Frontend
'use strict';

const API = '/api';

// ─── Modal state ───────────────────────────────────────────────────────────────
let modalMode       = 'add';   // 'add' | 'edit'
let modalContactId  = null;    // id ที่กำลัง edit

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

function showSection(name, btn) {
  document.querySelectorAll('section[id^="section-"]').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.remove('bg-navy-700', 'text-white');
    b.classList.add('text-gray-400');
  });

  document.getElementById(`section-${name}`).classList.remove('hidden');

  if (btn) {
    btn.classList.add('bg-navy-700', 'text-white');
    btn.classList.remove('text-gray-400');
  }

  const titles = { dashboard: 'Dashboard', contacts: 'Contacts', deals: 'Deals' };
  document.getElementById('topbar-title').textContent = titles[name] || name;

  if (name === 'deals') { loadPipeline(); loadContactsDropdown(); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════════

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════════

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('th-TH', {
    style: 'currency', currency: 'THB', minimumFractionDigits: 0,
  });
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

const STATUS_BADGE = {
  lead:     'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  prospect: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  customer: 'bg-green-500/15 text-green-400 border border-green-500/30',
  inactive: 'bg-gray-500/15 text-gray-500 border border-gray-600/30',
};

const STAGE_BADGE = {
  new:         'bg-slate-500/15 text-slate-400 border border-slate-500/30',
  contacted:   'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  proposal:    'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  negotiation: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  won:         'bg-green-500/15 text-green-400 border border-green-500/30',
  lost:        'bg-red-500/15 text-red-400 border border-red-500/30',
};

function badge(text, classMap) {
  const cls = classMap[text] || 'bg-gray-500/15 text-gray-400';
  return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full
                       text-xs font-semibold ${cls}">
            <span class="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
            ${esc(text)}
          </span>`;
}

function loadingRow(cols) {
  return `<tr><td colspan="${cols}" class="px-5 py-16 text-center">
    <div class="flex flex-col items-center gap-3">
      <div class="spinner"></div>
      <span class="text-sm text-gray-600">กำลังโหลด...</span>
    </div></td></tr>`;
}

function emptyRow(cols, icon, msg) {
  return `<tr><td colspan="${cols}" class="px-5 py-14 text-center">
    <div class="flex flex-col items-center gap-2 text-gray-600">
      <span class="text-4xl">${icon}</span>
      <span class="text-sm">${msg}</span>
    </div></td></tr>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ██  MODAL — Add / Edit Contact
// ═══════════════════════════════════════════════════════════════════════════════

// ─── เปิด modal โหมด Add ──────────────────────────────────────────────────────
function openAddModal() {
  modalMode      = 'add';
  modalContactId = null;

  // ตั้งค่า header + button
  document.getElementById('modal-title').textContent    = 'เพิ่ม Contact ใหม่';
  document.getElementById('modal-btn-text').textContent = 'บันทึก';

  // ล้าง fields ทั้งหมด
  _resetModalFields();

  _openModal();
}

// ─── เปิด modal โหมด Edit (โหลดข้อมูลจาก API) ────────────────────────────────
async function openEditModal(id) {
  modalMode      = 'edit';
  modalContactId = id;

  document.getElementById('modal-title').textContent    = 'แก้ไข Contact';
  document.getElementById('modal-btn-text').textContent = 'บันทึกการแก้ไข';

  _resetModalFields();
  _openModal();

  // แสดง loading บน submit button ระหว่างโหลด
  _setSubmitLoading(true);

  try {
    const res  = await fetch(`${API}/contacts/${id}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();

    // Pre-fill ข้อมูลเดิมลง fields
    document.getElementById('m-name').value    = data.name    || '';
    document.getElementById('m-company').value = data.company || '';
    document.getElementById('m-email').value   = data.email   || '';
    document.getElementById('m-phone').value   = data.phone   || '';
    document.getElementById('m-status').value  = data.status  || 'lead';
    document.getElementById('m-tags').value    = data.tags    || '';
    document.getElementById('m-notes').value   = data.notes   || '';
  } catch (err) {
    showToast('❌ โหลดข้อมูลไม่สำเร็จ');
    closeModal();
  } finally {
    _setSubmitLoading(false);
  }
}

// ─── ปิด modal ─────────────────────────────────────────────────────────────────
function closeModal() {
  document.getElementById('contact-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _clearErrors();
}

// ─── Save — POST (add) หรือ PUT (edit) ──────────────────────────────────────────
async function saveContact() {
  // ── Validate ──
  const name  = document.getElementById('m-name').value.trim();
  const email = document.getElementById('m-email').value.trim();
  let   valid = true;

  _clearErrors();

  if (!name) {
    _showFieldError('m-name', 'err-name', 'กรุณากรอกชื่อ-นามสกุล');
    valid = false;
  }
  if (!email) {
    _showFieldError('m-email', 'err-email', 'กรุณากรอกอีเมล');
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    _showFieldError('m-email', 'err-email', 'รูปแบบอีเมลไม่ถูกต้อง');
    valid = false;
  }
  if (!valid) return;

  // ── รวบรวม payload ──
  const payload = {
    name,
    email,
    company: document.getElementById('m-company').value.trim() || null,
    phone:   document.getElementById('m-phone').value.trim()   || null,
    status:  document.getElementById('m-status').value,
    tags:    document.getElementById('m-tags').value.trim()    || null,
    notes:   document.getElementById('m-notes').value.trim()   || null,
  };

  // ── Submit ──
  _setSubmitLoading(true);

  try {
    const url    = modalMode === 'edit' ? `${API}/contacts/${modalContactId}` : `${API}/contacts`;
    const method = modalMode === 'edit' ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(`❌ ${err.error || 'เกิดข้อผิดพลาด'}`);
      return;
    }

    const label = modalMode === 'edit' ? 'แก้ไข' : 'เพิ่ม';
    showToast(`✅ ${label} Contact สำเร็จ!`);

    closeModal();
    loadContacts();  // refresh ตาราง
    loadStats();     // refresh stat cards
  } catch (err) {
    showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่');
    console.error(err);
  } finally {
    _setSubmitLoading(false);
  }
}

// ─── Internal modal helpers ───────────────────────────────────────────────────

function _openModal() {
  document.getElementById('contact-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // ป้องกัน scroll ด้านหลัง
  // focus ที่ชื่อหลังจาก animation เล็กน้อย
  setTimeout(() => document.getElementById('m-name').focus(), 50);
}

function _resetModalFields() {
  ['m-name','m-company','m-email','m-phone','m-tags','m-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('m-status').value = 'lead';
  _clearErrors();
}

function _clearErrors() {
  // ล้าง error message
  ['err-name','err-email'].forEach(id => {
    const el = document.getElementById(id);
    el.textContent = '';
    el.classList.add('hidden');
  });
  // ล้าง input error border
  ['m-name','m-email'].forEach(id => {
    document.getElementById(id).classList.remove('input-error');
  });
}

function _showFieldError(inputId, errId, msg) {
  document.getElementById(inputId).classList.add('input-error');
  const errEl = document.getElementById(errId);
  errEl.textContent = msg;
  errEl.classList.remove('hidden');
}

function _setSubmitLoading(loading) {
  const btn     = document.getElementById('modal-submit-btn');
  const spinner = document.getElementById('modal-btn-spinner');
  const text    = document.getElementById('modal-btn-text');

  btn.disabled = loading;
  spinner.classList.toggle('hidden', !loading);
  text.textContent = loading
    ? (modalMode === 'edit' ? 'กำลังบันทึก...' : 'กำลังเพิ่ม...')
    : (modalMode === 'edit' ? 'บันทึกการแก้ไข' : 'บันทึก');
}

// ปิด modal เมื่อกด Escape (contact modal)
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDealModal(); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL SEARCH (topbar → sync to contacts filter)
// ═══════════════════════════════════════════════════════════════════════════════

let searchDebounce;
function handleSearch() {
  clearTimeout(searchDebounce);
  const q = document.getElementById('global-search').value.trim();
  searchDebounce = setTimeout(() => {
    const fs = document.getElementById('filter-search');
    if (fs) { fs.value = q; filterContacts(); }
  }, 300);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ██  CONTACTS
// ═══════════════════════════════════════════════════════════════════════════════

// cache ข้อมูลทั้งหมดจาก API — filter ทำ client-side เพื่อ real-time
let _allContacts = [];

// ─── loadContacts() — GET /api/contacts แล้ว render ตาราง ────────────────────
async function loadContacts() {
  document.getElementById('contacts-tbody').innerHTML = loadingRow(7);
  try {
    const res    = await fetch(`${API}/contacts`);
    _allContacts = await res.json();

    // reset filter แล้ว render
    _applyFilter();

    // อัปเดต sidebar badge (ใช้ total จริง ไม่ใช่ filtered)
    const badgeEl = document.getElementById('badge-contacts');
    badgeEl.textContent = _allContacts.length;
    badgeEl.classList.toggle('hidden', _allContacts.length === 0);
  } catch {
    document.getElementById('contacts-tbody').innerHTML = emptyRow(7, '⚠️', 'โหลดข้อมูลไม่สำเร็จ');
  }
}

// ─── loadStats() — GET stats แล้ว update stat cards ─────────────────────────
async function loadStats() {
  try {
    const res  = await fetch(`${API}/contacts/stats`);
    const data = await res.json();

    document.getElementById('dash-total-contacts').textContent = data.total ?? 0;
    document.getElementById('badge-contacts').textContent      = data.total ?? 0;

    const byStatus = {};
    (data.by_status || []).forEach(r => { byStatus[r.status] = r.count; });
    document.getElementById('dash-leads').textContent     = byStatus.lead     ?? 0;
    document.getElementById('dash-customers').textContent = byStatus.customer ?? 0;
  } catch (err) {
    console.error('loadStats:', err);
  }
}

// ─── filterContacts() — Real-time filter พร้อม debounce 300ms ────────────────
// เรียกจาก oninput (search) และ onchange (status)
// ถ้าเรียกจาก search input จะมี debounce / status dropdown เรียกตรงๆ
let _filterDebounce;
function filterContacts(immediate = false) {
  clearTimeout(_filterDebounce);
  const delay = immediate ? 0 : 300;
  _filterDebounce = setTimeout(_applyFilter, delay);
}

// ─── _applyFilter() — ตัว filter จริง (client-side) ──────────────────────────
function _applyFilter() {
  const keyword = (document.getElementById('filter-search')?.value || '').trim();
  const status  = document.getElementById('filter-status')?.value || '';
  const q       = keyword.toLowerCase();

  // ── กรองข้อมูลจาก cache ──
  const filtered = _allContacts.filter(c => {
    // 1. filter status
    if (status && c.status !== status) return false;

    // 2. filter keyword — ค้นใน name, company, email, phone (case-insensitive)
    if (q) {
      const haystack = [c.name, c.company, c.email, c.phone]
        .map(v => (v || '').toLowerCase())
        .join(' ');
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // ── อัปเดต UI ──
  _updateFilterUI(keyword, status, filtered.length, _allContacts.length);
  renderContacts(filtered, keyword);
}

// ─── _updateFilterUI() — อัปเดต count label + clear button ──────────────────
function _updateFilterUI(keyword, status, shown, total) {
  // count text: "แสดง X จาก Y รายการ" หรือ "X รายการ" ถ้าไม่มี filter
  const countEl = document.getElementById('contacts-count');
  const isFiltered = keyword || status;
  if (countEl) {
    countEl.textContent = isFiltered
      ? `แสดง ${shown} จาก ${total} รายการ`
      : `${total} รายการ`;
    countEl.className = isFiltered
      ? 'text-xs font-medium whitespace-nowrap text-blue-400'
      : 'text-xs font-medium whitespace-nowrap text-gray-500';
  }

  // section subtitle
  const label = document.getElementById('contacts-count-label');
  if (label) label.textContent = `(${total} รายการ)`;

  // แสดง/ซ่อน ปุ่ม X บน search box
  const clearSearchBtn = document.getElementById('clear-search-btn');
  if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', !keyword);

  // แสดง/ซ่อน ปุ่ม "ล้างตัวกรอง"
  const clearAllBtn = document.getElementById('clear-all-btn');
  if (clearAllBtn) clearAllBtn.classList.toggle('hidden', !isFiltered);
}

// ─── clearSearch() — ล้าง keyword เดียว ──────────────────────────────────────
function clearSearch() {
  const input = document.getElementById('filter-search');
  if (input) input.value = '';
  _applyFilter();
  input?.focus();
}

// ─── clearAllFilters() — ล้าง filter ทั้งหมด ─────────────────────────────────
function clearAllFilters() {
  const search = document.getElementById('filter-search');
  const status = document.getElementById('filter-status');
  if (search) search.value = '';
  if (status) status.value = '';
  _applyFilter();
}

// ─── highlight() — wrap keyword matches ด้วย <mark> ─────────────────────────
// ใช้หลังจาก esc() เสมอ เพื่อป้องกัน XSS
function highlight(text, keyword) {
  if (!keyword || !text) return text;
  // escape regex special chars ใน keyword
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(
    new RegExp(escaped, 'gi'),
    match => `<mark class="hl">${match}</mark>`
  );
}

// ─── renderContacts() — render rows พร้อม highlight ─────────────────────────
// keyword: คำค้นหาปัจจุบัน (ใช้ highlight)
function renderContacts(contacts, keyword = '') {
  const tbody = document.getElementById('contacts-tbody');

  if (!contacts.length) {
    const msg = keyword
      ? `ไม่พบข้อมูลที่ค้นหา "<strong class="text-gray-400">${esc(keyword)}</strong>"`
      : 'ยังไม่มี contact';
    tbody.innerHTML = `<tr><td colspan="7" class="px-5 py-14 text-center">
      <div class="flex flex-col items-center gap-3 text-gray-600">
        <span class="text-4xl">${keyword ? '🔍' : '👤'}</span>
        <span class="text-sm">${msg}</span>
        ${keyword ? `<button onclick="clearAllFilters()"
          class="text-xs text-blue-400 hover:text-blue-300 mt-1 transition">
          ล้างการค้นหา
        </button>` : ''}
      </div>
    </td></tr>`;
    return;
  }

  // helper: esc แล้ว highlight
  const h = (val) => highlight(esc(val || '—'), keyword);

  tbody.innerHTML = contacts.map(c => `
    <tr class="border-b border-navy-700/50 hover:bg-navy-700/30 transition group">
      <td class="px-5 py-3.5">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-navy-600 text-xs font-bold text-white
                      flex items-center justify-center flex-shrink-0 flex-shrink-0">
            ${esc(initials(c.name))}
          </div>
          <span class="text-sm font-semibold text-gray-200">${h(c.name)}</span>
        </div>
      </td>
      <td class="px-4 py-3.5 text-sm text-gray-400 max-w-[140px] truncate">
        ${h(c.company)}
      </td>
      <td class="px-4 py-3.5 text-sm text-gray-400">${h(c.email)}</td>
      <td class="px-4 py-3.5 text-sm text-gray-400 whitespace-nowrap">${h(c.phone)}</td>
      <td class="px-4 py-3.5">${badge(c.status, STATUS_BADGE)}</td>
      <td class="px-4 py-3.5 text-xs text-gray-600 max-w-[120px] truncate">
        ${esc(c.tags || '—')}
      </td>
      <td class="px-4 py-3.5">
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onclick="openEditModal(${c.id})"
            class="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition"
            title="แก้ไข">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button onclick="deleteContact(${c.id})"
            class="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition"
            title="ลบ">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ─── deleteContact(id) — confirm dialog แล้ว DELETE ──────────────────────────
async function deleteContact(id) {
  if (!confirm('ลบ Contact นี้?\n(Deals ที่ผูกอยู่จะถูก unlink อัตโนมัติ)')) return;
  try {
    const res = await fetch(`${API}/contacts/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    showToast('🗑️ ลบ Contact แล้ว');
    loadContacts();
    loadStats();
    loadDashboard();
  } catch {
    showToast('❌ ลบไม่สำเร็จ');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ██  DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

async function loadDashboard() {
  try {
    const [statsRes, pipelineRes, contactsRes] = await Promise.all([
      fetch(`${API}/contacts/stats`),
      fetch(`${API}/deals/pipeline`),
      fetch(`${API}/contacts`),
    ]);
    const stats    = await statsRes.json();
    const pipeline = await pipelineRes.json();
    const contacts = await contactsRes.json();

    const byStatus = {};
    (stats.by_status || []).forEach(r => { byStatus[r.status] = r.count; });

    document.getElementById('dash-total-contacts').textContent = stats.total ?? 0;
    document.getElementById('dash-leads').textContent          = byStatus.lead     ?? 0;
    document.getElementById('dash-customers').textContent      = byStatus.customer ?? 0;
    document.getElementById('dash-deal-value').textContent     = formatCurrency(pipeline.pipeline_value);

    const badgeC = document.getElementById('badge-contacts');
    badgeC.textContent = stats.total;
    badgeC.classList.toggle('hidden', !stats.total);

    // Pipeline mini
    const stageLabel = { new:'New', contacted:'Contacted', proposal:'Proposal',
                         negotiation:'Nego.', won:'Won ✓', lost:'Lost ✗' };
    document.getElementById('dash-pipeline').innerHTML =
      (pipeline.stages || []).map(s => `
        <div class="p-4 text-center ${s.stage==='won'?'bg-green-900/20':s.stage==='lost'?'bg-red-900/20':''}">
          <div class="text-lg font-bold text-white">${s.count}</div>
          <div class="text-xs text-gray-500 mt-0.5">${stageLabel[s.stage]||s.stage}</div>
          <div class="text-xs text-blue-400 font-semibold mt-1">${formatCurrency(s.total_value)}</div>
        </div>
      `).join('');

    // Recent contacts
    const recentEl = document.getElementById('dash-recent-contacts');
    const recent   = contacts.slice(0, 5);
    recentEl.innerHTML = !recent.length
      ? `<div class="py-8 text-center text-sm text-gray-600">ยังไม่มี contact</div>`
      : recent.map(c => `
          <div class="flex items-center gap-3 px-5 py-3 hover:bg-navy-700/40 transition">
            <div class="w-8 h-8 rounded-full bg-navy-600 text-xs font-bold text-white
                        flex items-center justify-center flex-shrink-0">
              ${esc(initials(c.name))}
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold text-gray-200 truncate">${esc(c.name)}</div>
              <div class="text-xs text-gray-500 truncate">${esc(c.company || c.email || '—')}</div>
            </div>
            ${badge(c.status, STATUS_BADGE)}
          </div>
        `).join('');
  } catch (err) {
    console.error('loadDashboard:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ██  DEALS — Kanban Board
// ═══════════════════════════════════════════════════════════════════════════════

// Stage config: key, label, colors
const STAGES = [
  { key: 'new',         label: 'New',         dot: '#64748b', colBorder: 'border-slate-500',   colBg: 'bg-slate-500/10',   headerText: 'text-slate-300' },
  { key: 'contacted',   label: 'Contacted',   dot: '#3b82f6', colBorder: 'border-blue-500',    colBg: 'bg-blue-500/10',    headerText: 'text-blue-300'  },
  { key: 'proposal',    label: 'Proposal',    dot: '#eab308', colBorder: 'border-yellow-500',  colBg: 'bg-yellow-500/10',  headerText: 'text-yellow-300'},
  { key: 'negotiation', label: 'Negotiation', dot: '#f97316', colBorder: 'border-orange-500',  colBg: 'bg-orange-500/10',  headerText: 'text-orange-300'},
  { key: 'won',         label: 'Won ✓',       dot: '#22c55e', colBorder: 'border-green-500',   colBg: 'bg-green-500/10',   headerText: 'text-green-300' },
  { key: 'lost',        label: 'Lost ✗',      dot: '#ef4444', colBorder: 'border-red-500',     colBg: 'bg-red-500/10',     headerText: 'text-red-300'   },
];

// ─── loadDeals() — โหลดแล้ว render kanban + summary ─────────────────────────
async function loadDeals() {
  document.getElementById('kanban-board').innerHTML =
    `<div class="flex items-center gap-3 py-16 text-gray-600">
       <div class="spinner"></div><span class="text-sm">กำลังโหลด...</span>
     </div>`;
  try {
    const res   = await fetch(`${API}/deals`);
    const deals = await res.json();

    renderKanban(deals);
    _updateSummary(deals);

    // sidebar badge
    const badgeEl = document.getElementById('badge-deals');
    badgeEl.textContent = deals.length;
    badgeEl.classList.toggle('hidden', deals.length === 0);
  } catch {
    document.getElementById('kanban-board').innerHTML =
      `<div class="py-16 text-gray-600 text-sm">⚠️ โหลดข้อมูลไม่สำเร็จ</div>`;
  }
}

// ─── _updateSummary() — อัปเดต summary bar ───────────────────────────────────
function _updateSummary(deals) {
  const active = deals.filter(d => !['won','lost'].includes(d.stage));
  const won    = deals.filter(d => d.stage === 'won');
  const closed = deals.filter(d => ['won','lost'].includes(d.stage));

  const pipelineVal = active.reduce((s, d) => s + parseFloat(d.value||0), 0);
  const wonCount    = won.length;
  const winRate     = closed.length ? Math.round(wonCount / closed.length * 100) : 0;

  document.getElementById('summary-pipeline').textContent = formatCurrency(pipelineVal);
  document.getElementById('summary-won').textContent      = `${wonCount} deals`;
  document.getElementById('summary-winrate').textContent  = `${winRate}%`;

  // dashboard card
  const dvEl = document.getElementById('dash-deal-value');
  if (dvEl) dvEl.textContent = formatCurrency(pipelineVal);
}

// ─── renderKanban() — สร้าง 6 columns ───────────────────────────────────────
function renderKanban(deals) {
  const board = document.getElementById('kanban-board');

  // จัดกลุ่ม deals ตาม stage
  const grouped = {};
  STAGES.forEach(s => { grouped[s.key] = []; });
  deals.forEach(d => {
    if (grouped[d.stage]) grouped[d.stage].push(d);
  });

  board.innerHTML = STAGES.map(s => {
    const stagDeals = grouped[s.key];
    const total     = stagDeals.reduce((sum, d) => sum + parseFloat(d.value||0), 0);

    return `
      <div class="kanban-col">
        <!-- Column header -->
        <div class="bg-navy-800 border ${s.colBorder} border-t-2 rounded-t-xl px-3 py-3
                    border-b-0 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full flex-shrink-0"
                  style="background:${s.dot}"></span>
            <span class="text-xs font-bold ${s.headerText} uppercase tracking-wide">
              ${s.label}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-gray-500">
              ${formatCurrency(total)}
            </span>
            <span class="bg-navy-700 text-gray-400 text-xs font-bold
                         px-2 py-0.5 rounded-full min-w-[22px] text-center">
              ${stagDeals.length}
            </span>
          </div>
        </div>

        <!-- Cards -->
        <div class="kanban-cards bg-navy-900/50 border border-navy-700
                    border-t-0 rounded-b-xl p-2 space-y-2">
          ${stagDeals.length
            ? stagDeals.map(d => _dealCard(d, s)).join('')
            : `<div class="py-8 text-center text-xs text-gray-700">ไม่มี deal</div>`
          }
          <!-- Add shortcut -->
          <button onclick="openAddDealModal('${s.key}')"
            class="w-full py-2 text-xs text-gray-700 hover:text-gray-400
                   hover:bg-navy-800 rounded-lg transition border border-dashed
                   border-navy-700 hover:border-navy-500">
            + เพิ่ม deal ใน ${s.label}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── _dealCard() — HTML ของ deal card แต่ละอัน ──────────────────────────────
function _dealCard(d, stage) {
  const closeSoon = d.close_date && new Date(d.close_date) < new Date(Date.now() + 7*86400000);
  const stageOptions = STAGES.map(s =>
    `<option value="${s.key}" ${s.key === d.stage ? 'selected' : ''}>${s.label}</option>`
  ).join('');

  return `
    <div class="deal-card bg-navy-800 border border-navy-700 rounded-xl p-3 group">

      <!-- Title + actions -->
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="text-sm font-semibold text-gray-200 leading-snug flex-1 min-w-0 truncate"
             title="${esc(d.title)}">
          ${esc(d.title)}
        </div>
        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
          <button onclick="openEditDealModal(${d.id})"
            class="p-1 rounded text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition"
            title="แก้ไข">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button onclick="deleteDeal(${d.id})"
            class="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition"
            title="ลบ">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Contact -->
      ${d.contact_name ? `
        <div class="flex items-center gap-1.5 mb-2">
          <div class="w-4 h-4 rounded-full bg-navy-600 text-[9px] font-bold text-white
                      flex items-center justify-center flex-shrink-0">
            ${esc(initials(d.contact_name))}
          </div>
          <span class="text-xs text-gray-500 truncate">${esc(d.contact_name)}</span>
        </div>` : ''}

      <!-- Value + Close date -->
      <div class="flex items-center justify-between mb-2.5">
        <span class="text-sm font-bold text-blue-400">${formatCurrency(d.value)}</span>
        ${d.close_date ? `
          <span class="text-xs ${closeSoon ? 'text-amber-400 font-semibold' : 'text-gray-600'}">
            ${closeSoon ? '⚠️ ' : ''}${formatDate(d.close_date)}
          </span>` : ''}
      </div>

      <!-- Inline Stage select -->
      <select onchange="updateDealStage(${d.id}, this.value)"
        class="stage-select w-full bg-navy-900 border border-navy-700 rounded-lg
               px-2.5 py-1.5 text-xs text-gray-400 cursor-pointer
               focus:outline-none focus:border-blue-500 transition">
        ${stageOptions}
      </select>
    </div>
  `;
}

// ─── updateDealStage() — เปลี่ยน stage จาก card โดยตรง ──────────────────────
async function updateDealStage(id, newStage) {
  try {
    // ดึงข้อมูล deal เดิมก่อน แล้ว PUT กลับพร้อม stage ใหม่
    const getRes = await fetch(`${API}/deals/${id}`);
    if (!getRes.ok) throw new Error();
    const deal = await getRes.json();

    const res = await fetch(`${API}/deals/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        title:      deal.title,
        value:      deal.value,
        stage:      newStage,
        contact_id: deal.contact_id,
        close_date: deal.close_date,
        notes:      deal.notes,
      }),
    });
    if (!res.ok) throw new Error();

    showToast(`🔄 ย้ายไป ${newStage}`);
    loadDeals();
    loadDashboard();
  } catch {
    showToast('❌ เปลี่ยน stage ไม่สำเร็จ');
    loadDeals(); // revert UI
  }
}

// ─── Deal Modal — state ───────────────────────────────────────────────────────
let dealModalMode = 'add';
let dealModalId   = null;

// ─── openAddDealModal() — เปิด modal ว่าง (stage optional) ──────────────────
async function openAddDealModal(defaultStage = 'new') {
  dealModalMode = 'add';
  dealModalId   = null;

  document.getElementById('deal-modal-title').textContent  = 'New Deal';
  document.getElementById('deal-btn-text').textContent     = 'บันทึก';
  _resetDealFields();
  document.getElementById('dm-stage').value = defaultStage;

  await _loadDealContactDropdown();
  _openDealModal();
}

// ─── openEditDealModal() — โหลดข้อมูล + เปิด modal ────────────────────────
async function openEditDealModal(id) {
  dealModalMode = 'edit';
  dealModalId   = id;

  document.getElementById('deal-modal-title').textContent = 'แก้ไข Deal';
  document.getElementById('deal-btn-text').textContent    = 'บันทึกการแก้ไข';
  _resetDealFields();

  await _loadDealContactDropdown();
  _openDealModal();
  _setDealLoading(true);

  try {
    const res  = await fetch(`${API}/deals/${id}`);
    if (!res.ok) throw new Error();
    const d    = await res.json();

    document.getElementById('dm-title').value      = d.title      || '';
    document.getElementById('dm-contact').value    = d.contact_id || '';
    document.getElementById('dm-value').value      = d.value      || '';
    document.getElementById('dm-stage').value      = d.stage      || 'new';
    document.getElementById('dm-close-date').value = d.close_date
      ? d.close_date.split('T')[0] : '';
    document.getElementById('dm-notes').value      = d.notes      || '';
  } catch {
    showToast('❌ โหลดข้อมูลไม่สำเร็จ');
    closeDealModal();
  } finally {
    _setDealLoading(false);
  }
}

// ─── saveDeal() — POST หรือ PUT ───────────────────────────────────────────────
async function saveDeal() {
  const title      = document.getElementById('dm-title').value.trim();
  const contact_id = document.getElementById('dm-contact').value || null;

  // Validate
  _clearDealErrors();
  let valid = true;
  if (!title) {
    _showDealError('dm-title', 'dm-err-title', 'กรุณากรอกชื่อ Deal');
    valid = false;
  }
  if (!contact_id) {
    _showDealError('dm-contact', 'dm-err-contact', 'กรุณาเลือก Contact');
    valid = false;
  }
  if (!valid) return;

  const payload = {
    title,
    contact_id,
    value:      Number(document.getElementById('dm-value').value)      || 0,
    stage:      document.getElementById('dm-stage').value,
    close_date: document.getElementById('dm-close-date').value         || null,
    notes:      document.getElementById('dm-notes').value.trim()       || null,
  };

  _setDealLoading(true);
  try {
    const url    = dealModalMode === 'edit' ? `${API}/deals/${dealModalId}` : `${API}/deals`;
    const method = dealModalMode === 'edit' ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) { const e = await res.json(); showToast(`❌ ${e.error}`); return; }

    showToast(dealModalMode === 'edit' ? '✅ แก้ไข Deal สำเร็จ!' : '✅ เพิ่ม Deal สำเร็จ!');
    closeDealModal();
    loadDeals();
    loadDashboard();
  } catch {
    showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่');
  } finally {
    _setDealLoading(false);
  }
}

// ─── deleteDeal() ─────────────────────────────────────────────────────────────
async function deleteDeal(id) {
  if (!confirm('ลบ Deal นี้?')) return;
  try {
    await fetch(`${API}/deals/${id}`, { method: 'DELETE' });
    showToast('🗑️ ลบ Deal แล้ว');
    loadDeals();
    loadDashboard();
  } catch { showToast('❌ ลบไม่สำเร็จ'); }
}

// ─── Deal Modal Helpers ───────────────────────────────────────────────────────

function closeDealModal() {
  document.getElementById('deal-modal').classList.add('hidden');
  document.body.style.overflow = '';
  _clearDealErrors();
}

function _openDealModal() {
  document.getElementById('deal-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('dm-title').focus(), 50);
}

function _resetDealFields() {
  ['dm-title','dm-value','dm-notes','dm-close-date'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('dm-stage').value   = 'new';
  document.getElementById('dm-contact').value = '';
  _clearDealErrors();
}

function _clearDealErrors() {
  ['dm-err-title','dm-err-contact'].forEach(id => {
    const el = document.getElementById(id);
    el.textContent = ''; el.classList.add('hidden');
  });
  ['dm-title','dm-contact'].forEach(id =>
    document.getElementById(id).classList.remove('input-error')
  );
}

function _showDealError(inputId, errId, msg) {
  document.getElementById(inputId).classList.add('input-error');
  const el = document.getElementById(errId);
  el.textContent = msg; el.classList.remove('hidden');
}

function _setDealLoading(loading) {
  const btn  = document.getElementById('deal-submit-btn');
  const spin = document.getElementById('deal-btn-spinner');
  const text = document.getElementById('deal-btn-text');
  btn.disabled = loading;
  spin.classList.toggle('hidden', !loading);
  text.textContent = loading ? 'กำลังบันทึก...'
    : (dealModalMode === 'edit' ? 'บันทึกการแก้ไข' : 'บันทึก');
}

async function _loadDealContactDropdown() {
  try {
    const res      = await fetch(`${API}/contacts`);
    const contacts = await res.json();
    const sel      = document.getElementById('dm-contact');
    sel.innerHTML  = '<option value="">— เลือก Contact —</option>' +
      contacts.map(c =>
        `<option value="${c.id}">${esc(c.name)}${c.company ? ` · ${esc(c.company)}` : ''}</option>`
      ).join('');
  } catch { console.error('_loadDealContactDropdown'); }
}


// ═══════════════════════════════════════════════════════════════════════════════
// REFRESH ALL
// ═══════════════════════════════════════════════════════════════════════════════

async function refreshAll() {
  await Promise.all([loadDashboard(), loadContacts(), loadDeals()]);
  showToast('🔄 รีเฟรชข้อมูลแล้ว');
}

// compat stub — deals section เดิมเรียก loadPipeline ผ่าน showSection
function loadPipeline() { loadDeals(); }

// ═══════════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════════
loadDashboard();
loadContacts();
loadDeals();
