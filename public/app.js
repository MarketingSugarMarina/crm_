// app.js — Frontend logic สำหรับ NavyCRM
const API = '/api';

// state สำหรับ filter
let currentStatusFilter = '';
let currentSearch       = '';

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

function showPanel(name, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  document.getElementById(`panel-${name}`).classList.add('active');
  if (btn) btn.classList.add('active');

  document.getElementById('topbar-title').textContent =
    name === 'contacts' ? 'Contacts' : 'Deals';

  // clear search when switching tabs
  document.getElementById('global-search').value = '';
  currentSearch = '';

  if (name === 'deals') {
    loadContactsDropdown();
    loadPipeline();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════════════════

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2800);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════════

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str || '');
  return d.innerHTML;
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
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

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

let searchDebounce;
function handleSearch() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    currentSearch = document.getElementById('global-search').value.trim();
    // ดูว่า panel ไหน active อยู่
    if (document.getElementById('panel-contacts').classList.contains('active')) {
      loadContacts();
    } else {
      // deals ไม่มี search API แต่ filter ใน client ได้
      loadDeals();
    }
  }, 300);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACTS
// ═══════════════════════════════════════════════════════════════════════════════

async function loadContacts() {
  try {
    // สร้าง query string จาก search + status filter
    const params = new URLSearchParams();
    if (currentSearch)       params.set('search', currentSearch);
    if (currentStatusFilter) params.set('status', currentStatusFilter);

    const query = params.toString() ? `?${params}` : '';
    const res   = await fetch(`${API}/contacts${query}`);
    const data  = await res.json();

    renderContacts(data);
    loadContactStats(); // อัปเดต stat cards
  } catch (err) {
    console.error('loadContacts:', err);
    document.getElementById('contacts-tbody').innerHTML =
      `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load contacts</p></div></td></tr>`;
  }
}

async function loadContactStats() {
  try {
    const res  = await fetch(`${API}/contacts/stats`);
    const data = await res.json();

    // อัปเดต stat cards
    document.getElementById('stat-total').textContent    = data.total;
    document.getElementById('badge-contacts').textContent = data.total;

    const byStatus = {};
    (data.by_status || []).forEach(r => { byStatus[r.status] = r.count; });
    document.getElementById('stat-lead').textContent     = byStatus.lead     || 0;
    document.getElementById('stat-prospect').textContent = byStatus.prospect || 0;
    document.getElementById('stat-customer').textContent = byStatus.customer || 0;
  } catch (err) {
    console.error('loadContactStats:', err);
  }
}

function filterContacts(status, chipEl) {
  currentStatusFilter = status;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  if (chipEl) chipEl.classList.add('active');
  loadContacts();
}

function renderContacts(contacts) {
  const tbody = document.getElementById('contacts-tbody');

  if (!contacts.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <div class="empty-icon">👤</div>
      <p>ยังไม่มี contact${currentSearch ? ` ที่ตรงกับ "${esc(currentSearch)}"` : ''}</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = contacts.map(c => `
    <tr>
      <td>
        <div class="name-cell">
          <div class="avatar">${esc(initials(c.name))}</div>
          <div>
            <div class="name-primary">${esc(c.name)}</div>
            <div class="name-sub">${esc(c.company || '')}</div>
          </div>
        </div>
      </td>
      <td style="color:var(--muted)">${esc(c.email || '—')}</td>
      <td style="color:var(--muted)">${esc(c.phone || '—')}</td>
      <td><span class="badge badge-${esc(c.status)}">${esc(c.status)}</span></td>
      <td style="font-size:0.78rem;color:var(--muted)">${esc(c.tags || '—')}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteContact(${c.id})">ลบ</button>
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
    showToast('✅ เพิ่ม Contact สำเร็จ!');
    loadContacts();
  } catch (err) {
    showToast('❌ เกิดข้อผิดพลาด');
    console.error(err);
  }
}

async function deleteContact(id) {
  if (!confirm('ลบ Contact นี้? (Deals ที่ผูกอยู่จะถูก unlink)')) return;
  try {
    await fetch(`${API}/contacts/${id}`, { method: 'DELETE' });
    showToast('🗑️ ลบ Contact แล้ว');
    loadContacts();
  } catch (err) {
    showToast('❌ ลบไม่สำเร็จ');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEALS
// ═══════════════════════════════════════════════════════════════════════════════

async function loadDeals() {
  try {
    const res  = await fetch(`${API}/deals`);
    let deals  = await res.json();

    // client-side search filter
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      deals   = deals.filter(d =>
        d.title.toLowerCase().includes(q) ||
        (d.contact_name || '').toLowerCase().includes(q)
      );
    }

    renderDeals(deals);

    // อัปเดต sidebar badge
    const allRes   = await fetch(`${API}/deals`);
    const allDeals = await allRes.json();
    document.getElementById('badge-deals').textContent = allDeals.length;
  } catch (err) {
    console.error('loadDeals:', err);
    document.getElementById('deals-tbody').innerHTML =
      `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚠️</div><p>Failed to load deals</p></div></td></tr>`;
  }
}

async function loadPipeline() {
  try {
    const res  = await fetch(`${API}/deals/pipeline`);
    const data = await res.json();

    const stageLabel = {
      new: 'New', contacted: 'Contacted', proposal: 'Proposal',
      negotiation: 'Negotiation', won: 'Won ✓', lost: 'Lost ✗',
    };

    const grid = document.getElementById('pipeline-grid');
    grid.innerHTML = (data.stages || []).map(s => `
      <div class="pipeline-stage ${s.stage === 'won' ? 'won' : s.stage === 'lost' ? 'lost' : ''}">
        <div class="ps-count">${s.count}</div>
        <div class="ps-label">${stageLabel[s.stage] || s.stage}</div>
        <div class="ps-value">${formatCurrency(s.total_value)}</div>
      </div>
    `).join('');

    document.getElementById('pipeline-total').textContent =
      `Pipeline: ${formatCurrency(data.pipeline_value)}`;
  } catch (err) {
    console.error('loadPipeline:', err);
  }
}

async function loadContactsDropdown() {
  try {
    const res      = await fetch(`${API}/contacts`);
    const contacts = await res.json();
    const select   = document.getElementById('d-contact');
    select.innerHTML = '<option value="">— เลือก Contact —</option>' +
      contacts.map(c => `<option value="${c.id}">${esc(c.name)}${c.company ? ` · ${esc(c.company)}` : ''}</option>`).join('');
  } catch (err) {
    console.error('loadContactsDropdown:', err);
  }
}

function renderDeals(deals) {
  const tbody = document.getElementById('deals-tbody');

  if (!deals.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
      <div class="empty-icon">💼</div>
      <p>ยังไม่มี deal</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = deals.map(d => `
    <tr>
      <td>
        <div class="name-primary" style="font-weight:600">${esc(d.title)}</div>
      </td>
      <td style="font-weight:600;color:var(--accent)">${formatCurrency(d.value)}</td>
      <td><span class="badge badge-${esc(d.stage)}">${esc(d.stage)}</span></td>
      <td>
        ${d.contact_name
          ? `<div style="font-size:0.85rem">${esc(d.contact_name)}</div>
             <div style="font-size:0.75rem;color:var(--muted)">${esc(d.contact_company || '')}</div>`
          : `<span style="color:var(--muted)">—</span>`
        }
      </td>
      <td style="font-size:0.82rem;color:var(--muted)">${formatDate(d.close_date)}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteDeal(${d.id})">ลบ</button>
      </td>
    </tr>
  `).join('');
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
    showToast('✅ เพิ่ม Deal สำเร็จ!');
    loadDeals();
    loadPipeline();
  } catch (err) {
    showToast('❌ เกิดข้อผิดพลาด');
    console.error(err);
  }
}

async function deleteDeal(id) {
  if (!confirm('ลบ Deal นี้?')) return;
  try {
    await fetch(`${API}/deals/${id}`, { method: 'DELETE' });
    showToast('🗑️ ลบ Deal แล้ว');
    loadDeals();
    loadPipeline();
  } catch (err) {
    showToast('❌ ลบไม่สำเร็จ');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════════
loadContacts();
loadDeals(); // pre-load badge count
