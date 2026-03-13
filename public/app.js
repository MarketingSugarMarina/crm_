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

// ปิด modal เมื่อกด Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL SEARCH
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

// ─── loadContacts() — GET /api/contacts แล้ว render ตาราง ────────────────────
async function loadContacts() {
  document.getElementById('contacts-tbody').innerHTML = loadingRow(7);
  try {
    const res  = await fetch(`${API}/contacts`);
    const data = await res.json();
    renderContacts(data);
    // อัปเดต sidebar badge
    const badgeEl = document.getElementById('badge-contacts');
    badgeEl.textContent = data.length;
    badgeEl.classList.toggle('hidden', data.length === 0);
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

// ─── filterContacts() — กรองตาม status + keyword ─────────────────────────────
async function filterContacts() {
  const status = document.getElementById('filter-status')?.value  || '';
  const search = document.getElementById('filter-search')?.value.trim() || '';

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const query = params.toString() ? `?${params}` : '';

  document.getElementById('contacts-tbody').innerHTML = loadingRow(7);

  try {
    const res  = await fetch(`${API}/contacts${query}`);
    const data = await res.json();
    renderContacts(data);
  } catch {
    document.getElementById('contacts-tbody').innerHTML = emptyRow(7, '⚠️', 'โหลดข้อมูลไม่สำเร็จ');
  }
}

// ─── renderContacts() — render rows ──────────────────────────────────────────
function renderContacts(contacts) {
  const count = document.getElementById('contacts-count');
  if (count) count.textContent = `${contacts.length} รายการ`;

  const label = document.getElementById('contacts-count-label');
  if (label) label.textContent = `(${contacts.length} รายการ)`;

  const tbody = document.getElementById('contacts-tbody');
  if (!contacts.length) {
    tbody.innerHTML = emptyRow(7, '👤', 'ไม่พบ contact');
    return;
  }

  tbody.innerHTML = contacts.map(c => `
    <tr class="border-b border-navy-700/50 hover:bg-navy-700/30 transition group">
      <td class="px-5 py-3.5">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-navy-600 text-xs font-bold text-white
                      flex items-center justify-center flex-shrink-0">
            ${esc(initials(c.name))}
          </div>
          <span class="text-sm font-semibold text-gray-200">${esc(c.name)}</span>
        </div>
      </td>
      <td class="px-4 py-3.5 text-sm text-gray-400 max-w-[140px] truncate">
        ${esc(c.company || '—')}
      </td>
      <td class="px-4 py-3.5 text-sm text-gray-400">${esc(c.email || '—')}</td>
      <td class="px-4 py-3.5 text-sm text-gray-400 whitespace-nowrap">${esc(c.phone || '—')}</td>
      <td class="px-4 py-3.5">${badge(c.status, STATUS_BADGE)}</td>
      <td class="px-4 py-3.5 text-xs text-gray-600 max-w-[120px] truncate">${esc(c.tags || '—')}</td>
      <td class="px-4 py-3.5">
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <!-- Edit button -->
          <button onclick="openEditModal(${c.id})"
            class="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition"
            title="แก้ไข">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <!-- Delete button -->
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
// ██  DEALS
// ═══════════════════════════════════════════════════════════════════════════════

async function loadDeals() {
  document.getElementById('deals-tbody').innerHTML = loadingRow(6);
  try {
    const res   = await fetch(`${API}/deals`);
    const deals = await res.json();
    renderDeals(deals);
    const badgeEl = document.getElementById('badge-deals');
    badgeEl.textContent = deals.length;
    badgeEl.classList.toggle('hidden', deals.length === 0);
  } catch {
    document.getElementById('deals-tbody').innerHTML = emptyRow(6, '⚠️', 'โหลดข้อมูลไม่สำเร็จ');
  }
}

function renderDeals(deals) {
  const tbody = document.getElementById('deals-tbody');
  if (!deals.length) { tbody.innerHTML = emptyRow(6, '💼', 'ยังไม่มี deal'); return; }
  tbody.innerHTML = deals.map(d => `
    <tr class="border-b border-navy-700/50 hover:bg-navy-700/30 transition group">
      <td class="px-5 py-3.5 text-sm font-semibold text-gray-200">${esc(d.title)}</td>
      <td class="px-4 py-3.5 text-sm font-semibold text-blue-400 whitespace-nowrap">
        ${formatCurrency(d.value)}
      </td>
      <td class="px-4 py-3.5">${badge(d.stage, STAGE_BADGE)}</td>
      <td class="px-4 py-3.5">
        ${d.contact_name
          ? `<div class="text-sm text-gray-300">${esc(d.contact_name)}</div>
             <div class="text-xs text-gray-600">${esc(d.contact_company||'')}</div>`
          : `<span class="text-gray-600">—</span>`}
      </td>
      <td class="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">${formatDate(d.close_date)}</td>
      <td class="px-4 py-3.5 text-right">
        <button onclick="deleteDeal(${d.id})"
          class="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10
                 transition opacity-0 group-hover:opacity-100" title="ลบ">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join('');
}

async function loadPipeline() {
  try {
    const res  = await fetch(`${API}/deals/pipeline`);
    const data = await res.json();
    const stageLabel = { new:'New', contacted:'Contacted', proposal:'Proposal',
                         negotiation:'Negotiation', won:'Won ✓', lost:'Lost ✗' };
    document.getElementById('pipeline-grid').innerHTML =
      (data.stages||[]).map(s => `
        <div class="p-4 text-center border-r border-navy-700
          ${s.stage==='won'?'bg-green-900/20':s.stage==='lost'?'bg-red-900/20':''}">
          <div class="text-2xl font-bold text-white">${s.count}</div>
          <div class="text-xs font-semibold text-gray-500 mt-0.5 uppercase tracking-wide">
            ${stageLabel[s.stage]||s.stage}
          </div>
          <div class="text-xs text-blue-400 font-semibold mt-1">${formatCurrency(s.total_value)}</div>
        </div>
      `).join('');
    document.getElementById('pipeline-total').textContent =
      `Active: ${formatCurrency(data.pipeline_value)}`;
  } catch (err) { console.error('loadPipeline:', err); }
}

async function loadContactsDropdown() {
  try {
    const res      = await fetch(`${API}/contacts`);
    const contacts = await res.json();
    document.querySelectorAll('#d-contact').forEach(sel => {
      sel.innerHTML = '<option value="">— เลือก Contact —</option>' +
        contacts.map(c =>
          `<option value="${c.id}">${esc(c.name)}${c.company?` · ${esc(c.company)}`:''}</option>`
        ).join('');
    });
  } catch (err) { console.error('loadContactsDropdown:', err); }
}

async function createDeal() {
  const title      = document.getElementById('d-title').value.trim();
  const value      = document.getElementById('d-value').value;
  const stage      = document.getElementById('d-stage').value;
  const contact_id = document.getElementById('d-contact').value || null;
  const close_date = document.getElementById('d-close-date').value || null;

  if (!title) { showToast('⚠️ กรุณากรอกชื่อ Deal'); return; }

  try {
    const res = await fetch(`${API}/deals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, value: Number(value)||0, stage, contact_id, close_date }),
    });
    if (!res.ok) { const e = await res.json(); showToast(`❌ ${e.error}`); return; }

    document.getElementById('d-title').value      = '';
    document.getElementById('d-value').value      = '';
    document.getElementById('d-close-date').value = '';
    document.getElementById('add-deal-form').classList.add('hidden');
    showToast('✅ เพิ่ม Deal สำเร็จ!');
    loadDeals();
    loadPipeline();
    loadDashboard();
  } catch { showToast('❌ เกิดข้อผิดพลาด'); }
}

async function deleteDeal(id) {
  if (!confirm('ลบ Deal นี้?')) return;
  try {
    await fetch(`${API}/deals/${id}`, { method: 'DELETE' });
    showToast('🗑️ ลบ Deal แล้ว');
    loadDeals(); loadPipeline(); loadDashboard();
  } catch { showToast('❌ ลบไม่สำเร็จ'); }
}

function toggleAddDealForm() {
  const el = document.getElementById('add-deal-form');
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) {
    loadContactsDropdown();
    document.getElementById('d-title').focus();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REFRESH ALL
// ═══════════════════════════════════════════════════════════════════════════════

async function refreshAll() {
  await Promise.all([loadDashboard(), loadContacts(), loadDeals()]);
  showToast('🔄 รีเฟรชข้อมูลแล้ว');
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════════
loadDashboard();
loadContacts();
loadDeals();
