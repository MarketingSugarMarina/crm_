// app.js — MyCRM Frontend Logic
'use strict';

const API = '/api';

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

function showSection(name, btn) {
  // ซ่อนทุก section
  document.querySelectorAll('section[id^="section-"]').forEach(s => s.classList.add('hidden'));
  // ล้าง active state ของ nav
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.remove('bg-navy-700', 'text-white');
    b.classList.add('text-gray-400');
  });

  // แสดง section ที่เลือก
  document.getElementById(`section-${name}`).classList.remove('hidden');

  // set active nav
  if (btn) {
    btn.classList.add('bg-navy-700', 'text-white');
    btn.classList.remove('text-gray-400');
  }

  // อัปเดต topbar title
  const titles = { dashboard: 'Dashboard', contacts: 'Contacts', deals: 'Deals' };
  document.getElementById('topbar-title').textContent = titles[name] || name;

  // โหลด data ตาม section
  if (name === 'deals') {
    loadPipeline();
    loadContactsDropdown();
  }
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
// TOGGLE FORMS
// ═══════════════════════════════════════════════════════════════════════════════

function toggleAddContactForm() {
  const el = document.getElementById('add-contact-form');
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) document.getElementById('c-name').focus();
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
  return new Date(d).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit',
  });
}

// ─── Status badge classes ─────────────────────────────────────────────────────
const STATUS_BADGE = {
  lead:       'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  prospect:   'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  customer:   'bg-green-500/15 text-green-400 border border-green-500/30',
  inactive:   'bg-gray-500/15 text-gray-500 border border-gray-600/30',
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

// ─── Loading / Empty state helpers ───────────────────────────────────────────
function loadingRow(cols) {
  return `<tr><td colspan="${cols}" class="px-5 py-16 text-center">
    <div class="flex flex-col items-center gap-3">
      <div class="spinner"></div>
      <span class="text-sm text-gray-600">กำลังโหลด...</span>
    </div>
  </td></tr>`;
}

function emptyRow(cols, icon, msg) {
  return `<tr><td colspan="${cols}" class="px-5 py-16 text-center">
    <div class="flex flex-col items-center gap-2 text-gray-600">
      <span class="text-4xl">${icon}</span>
      <span class="text-sm">${msg}</span>
    </div>
  </td></tr>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH (global topbar)
// ═══════════════════════════════════════════════════════════════════════════════

let searchDebounce;
function handleSearch() {
  clearTimeout(searchDebounce);
  const q = document.getElementById('global-search').value.trim();
  searchDebounce = setTimeout(() => {
    // sync ลง filter-search ใน contacts section ด้วย
    const fs = document.getElementById('filter-search');
    if (fs) { fs.value = q; filterContacts(); }
  }, 300);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
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

    // Stat cards
    const byStatus = {};
    (stats.by_status || []).forEach(r => { byStatus[r.status] = r.count; });

    document.getElementById('dash-total-contacts').textContent = stats.total ?? 0;
    document.getElementById('dash-leads').textContent     = byStatus.lead     ?? 0;
    document.getElementById('dash-customers').textContent  = byStatus.customer ?? 0;
    document.getElementById('dash-deal-value').textContent = formatCurrency(pipeline.pipeline_value);

    // Sidebar badges
    const badgeC = document.getElementById('badge-contacts');
    badgeC.textContent = stats.total;
    badgeC.classList.toggle('hidden', !stats.total);

    // Pipeline mini
    const stageLabel = {
      new:'New', contacted:'Contacted', proposal:'Proposal',
      negotiation:'Nego.', won:'Won ✓', lost:'Lost ✗',
    };
    const pGrid = document.getElementById('dash-pipeline');
    pGrid.innerHTML = (pipeline.stages || []).map(s => `
      <div class="p-4 text-center ${s.stage === 'won' ? 'bg-green-900/20' : s.stage === 'lost' ? 'bg-red-900/20' : ''}">
        <div class="text-lg font-bold text-white">${s.count}</div>
        <div class="text-xs text-gray-500 mt-0.5 truncate">${stageLabel[s.stage] || s.stage}</div>
        <div class="text-xs text-blue-400 font-semibold mt-1">${formatCurrency(s.total_value)}</div>
      </div>
    `).join('');

    // Recent contacts (แสดง 5 รายการล่าสุด)
    const recentEl = document.getElementById('dash-recent-contacts');
    const recent   = contacts.slice(0, 5);
    if (!recent.length) {
      recentEl.innerHTML = `<div class="flex items-center justify-center py-8 text-gray-600 text-sm">ยังไม่มี contact</div>`;
    } else {
      recentEl.innerHTML = recent.map(c => `
        <div class="flex items-center gap-3 px-5 py-3 hover:bg-navy-700/50 transition">
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
    }
  } catch (err) {
    console.error('loadDashboard:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACTS
// ═══════════════════════════════════════════════════════════════════════════════

async function filterContacts() {
  const status = document.getElementById('filter-status')?.value || '';
  const search = document.getElementById('filter-search')?.value.trim() || '';

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const query = params.toString() ? `?${params}` : '';

  document.getElementById('contacts-tbody').innerHTML = loadingRow(6);

  try {
    const res  = await fetch(`${API}/contacts${query}`);
    const data = await res.json();
    renderContacts(data);
  } catch (err) {
    console.error('filterContacts:', err);
    document.getElementById('contacts-tbody').innerHTML =
      emptyRow(6, '⚠️', 'โหลดข้อมูลไม่สำเร็จ');
  }
}

async function loadContacts() {
  document.getElementById('contacts-tbody').innerHTML = loadingRow(6);
  try {
    const res  = await fetch(`${API}/contacts`);
    const data = await res.json();
    renderContacts(data);
    // อัปเดต badge
    const badgeEl = document.getElementById('badge-contacts');
    badgeEl.textContent = data.length;
    badgeEl.classList.toggle('hidden', data.length === 0);
  } catch (err) {
    document.getElementById('contacts-tbody').innerHTML = emptyRow(6, '⚠️', 'โหลดข้อมูลไม่สำเร็จ');
  }
}

function renderContacts(contacts) {
  // อัปเดต count label
  const countEl = document.getElementById('contacts-count');
  if (countEl) countEl.textContent = `— ${contacts.length} รายการ`;

  const labelEl = document.getElementById('contacts-count-label');
  if (labelEl) labelEl.textContent = `(${contacts.length} รายการ)`;

  const tbody = document.getElementById('contacts-tbody');

  if (!contacts.length) {
    tbody.innerHTML = emptyRow(6, '👤', 'ไม่พบ contact');
    return;
  }

  tbody.innerHTML = contacts.map(c => `
    <tr class="border-b border-navy-700/50 hover:bg-navy-700/30 transition">
      <td class="px-5 py-3.5">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-navy-600 text-xs font-bold text-white
                      flex items-center justify-center flex-shrink-0">
            ${esc(initials(c.name))}
          </div>
          <div class="min-w-0">
            <div class="text-sm font-semibold text-gray-200 truncate">${esc(c.name)}</div>
          </div>
        </div>
      </td>
      <td class="px-4 py-3.5 text-sm text-gray-400 max-w-[140px] truncate">
        ${esc(c.company || '—')}
      </td>
      <td class="px-4 py-3.5 text-sm text-gray-400 max-w-[180px] truncate">
        ${esc(c.email || '—')}
      </td>
      <td class="px-4 py-3.5 text-sm text-gray-400 whitespace-nowrap">
        ${esc(c.phone || '—')}
      </td>
      <td class="px-4 py-3.5">${badge(c.status, STATUS_BADGE)}</td>
      <td class="px-4 py-3.5 text-right">
        <button onclick="deleteContact(${c.id})"
          class="text-xs text-gray-600 hover:text-red-400 font-medium transition px-2 py-1
                 rounded hover:bg-red-500/10">
          ลบ
        </button>
      </td>
    </tr>
  `).join('');
}

async function createContact() {
  const name    = document.getElementById('c-name').value.trim();
  const email   = document.getElementById('c-email').value.trim();
  const phone   = document.getElementById('c-phone').value.trim();
  const company = document.getElementById('c-company').value.trim();
  const status  = document.getElementById('c-status').value;

  if (!name)  { showToast('⚠️ กรุณากรอกชื่อ'); return; }
  if (!email) { showToast('⚠️ กรุณากรอก Email'); return; }

  try {
    const res = await fetch(`${API}/contacts`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, phone, company, status }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(`❌ ${err.error}`);
      return;
    }
    ['c-name','c-email','c-phone','c-company'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('add-contact-form').classList.add('hidden');
    showToast('✅ เพิ่ม Contact สำเร็จ!');
    loadContacts();
    loadDashboard(); // อัปเดต stat cards
  } catch (err) {
    showToast('❌ เกิดข้อผิดพลาด');
    console.error(err);
  }
}

async function deleteContact(id) {
  if (!confirm('ลบ Contact นี้?')) return;
  try {
    const res = await fetch(`${API}/contacts/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    showToast('🗑️ ลบ Contact แล้ว');
    loadContacts();
    loadDashboard();
  } catch {
    showToast('❌ ลบไม่สำเร็จ');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEALS
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
  } catch (err) {
    document.getElementById('deals-tbody').innerHTML = emptyRow(6, '⚠️', 'โหลดข้อมูลไม่สำเร็จ');
  }
}

function renderDeals(deals) {
  const tbody = document.getElementById('deals-tbody');

  if (!deals.length) {
    tbody.innerHTML = emptyRow(6, '💼', 'ยังไม่มี deal');
    return;
  }

  tbody.innerHTML = deals.map(d => `
    <tr class="border-b border-navy-700/50 hover:bg-navy-700/30 transition">
      <td class="px-5 py-3.5">
        <div class="text-sm font-semibold text-gray-200">${esc(d.title)}</div>
      </td>
      <td class="px-4 py-3.5 text-sm font-semibold text-blue-400 whitespace-nowrap">
        ${formatCurrency(d.value)}
      </td>
      <td class="px-4 py-3.5">${badge(d.stage, STAGE_BADGE)}</td>
      <td class="px-4 py-3.5">
        ${d.contact_name
          ? `<div class="text-sm text-gray-300">${esc(d.contact_name)}</div>
             <div class="text-xs text-gray-600">${esc(d.contact_company || '')}</div>`
          : `<span class="text-gray-600">—</span>`}
      </td>
      <td class="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">
        ${formatDate(d.close_date)}
      </td>
      <td class="px-4 py-3.5 text-right">
        <button onclick="deleteDeal(${d.id})"
          class="text-xs text-gray-600 hover:text-red-400 font-medium transition px-2 py-1
                 rounded hover:bg-red-500/10">
          ลบ
        </button>
      </td>
    </tr>
  `).join('');
}

async function loadPipeline() {
  try {
    const res  = await fetch(`${API}/deals/pipeline`);
    const data = await res.json();

    const stageLabel = {
      new:'New', contacted:'Contacted', proposal:'Proposal',
      negotiation:'Negotiation', won:'Won ✓', lost:'Lost ✗',
    };
    const grid = document.getElementById('pipeline-grid');
    grid.innerHTML = (data.stages || []).map(s => `
      <div class="p-4 text-center
        ${s.stage === 'won'  ? 'bg-green-900/20 border-r border-navy-700' :
          s.stage === 'lost' ? 'bg-red-900/20 border-r border-navy-700'   :
                               'border-r border-navy-700'}">
        <div class="text-2xl font-bold text-white">${s.count}</div>
        <div class="text-xs font-semibold text-gray-500 mt-0.5 uppercase tracking-wide">
          ${stageLabel[s.stage] || s.stage}
        </div>
        <div class="text-xs text-blue-400 font-semibold mt-1">${formatCurrency(s.total_value)}</div>
      </div>
    `).join('');

    document.getElementById('pipeline-total').textContent =
      `Active Pipeline: ${formatCurrency(data.pipeline_value)}`;
  } catch (err) {
    console.error('loadPipeline:', err);
  }
}

async function loadContactsDropdown() {
  try {
    const res      = await fetch(`${API}/contacts`);
    const contacts = await res.json();
    // อัปเดตทั้ง 2 dropdown (deals section + add deal form)
    document.querySelectorAll('#d-contact').forEach(select => {
      select.innerHTML = '<option value="">— เลือก Contact —</option>' +
        contacts.map(c =>
          `<option value="${c.id}">${esc(c.name)}${c.company ? ` · ${esc(c.company)}` : ''}</option>`
        ).join('');
    });
  } catch (err) {
    console.error('loadContactsDropdown:', err);
  }
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
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, value: Number(value) || 0, stage, contact_id, close_date }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(`❌ ${err.error}`);
      return;
    }
    document.getElementById('d-title').value      = '';
    document.getElementById('d-value').value      = '';
    document.getElementById('d-close-date').value = '';
    document.getElementById('add-deal-form').classList.add('hidden');
    showToast('✅ เพิ่ม Deal สำเร็จ!');
    loadDeals();
    loadPipeline();
    loadDashboard();
  } catch (err) {
    showToast('❌ เกิดข้อผิดพลาด');
    console.error(err);
  }
}

async function deleteDeal(id) {
  if (!confirm('ลบ Deal นี้?')) return;
  try {
    const res = await fetch(`${API}/deals/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    showToast('🗑️ ลบ Deal แล้ว');
    loadDeals();
    loadPipeline();
    loadDashboard();
  } catch {
    showToast('❌ ลบไม่สำเร็จ');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REFRESH
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
