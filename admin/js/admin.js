'use strict';
const GAS_URL = window.APP_CONFIG.GAS_URL;
let TOKEN = sessionStorage.getItem('nirbana_token') || '';

async function api(action, data) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data: data || {}, token: TOKEN })
  });
  const json = await res.json();
  if (!json.success && json.message === 'Sesi tidak valid, silakan login ulang.') logout();
  return json;
}

// ============================================================
// LOGIN
// ============================================================
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const user = document.getElementById('lUser').value.trim();
  const sandi = document.getElementById('lPass').value;
  const hasil = await api('admin.login', { user, sandi });
  const err = document.getElementById('loginError');
  if (!hasil.success) { err.textContent = '[!] // ERROR: ' + hasil.message; err.style.display = 'block'; return; }
  TOKEN = hasil.data.token;
  sessionStorage.setItem('nirbana_token', TOKEN);
  boot();
});
document.getElementById('btnLogout').addEventListener('click', logout);
function logout() { sessionStorage.removeItem('nirbana_token'); TOKEN = ''; location.reload(); }

if (TOKEN) boot(); // sesi masih ada (sessionStorage)

function boot() {
  document.getElementById('loginGate').style.display = 'none';
  document.getElementById('shell').style.display = 'grid';
  initNav();
  loadDashboard();
}

// ============================================================
// NAVIGASI
// ============================================================
function initNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('is-active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('is-active'));
      btn.classList.add('is-active');
      document.getElementById('view-' + btn.dataset.view).classList.add('is-active');
      const loaders = { produk: loadProduk, pesanan: loadPesanan, testimoni: loadTestimoni, notifikasi: loadNotifikasi, pengaturan: loadPengaturan };
      if (loaders[btn.dataset.view]) loaders[btn.dataset.view]();
    });
  });
}
function closeModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('is-open')); }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModals));

function rupiah(n) { return 'Rp' + Number(n || 0).toLocaleString('id-ID'); }

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  const r = await api('admin.dashboard');
  if (!r.success) return;
  const d = r.data;
  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">[SEC-01] PESANAN_HARI_INI</div><div class="kpi-value">${d.pesananHariIni}</div></div>
    <div class="kpi-card"><div class="kpi-label">[SEC-02] PESANAN_BULAN_INI</div><div class="kpi-value">${d.pesananBulanIni}</div></div>
    <div class="kpi-card"><div class="kpi-label">[SEC-03] PENDAPATAN_DIBAYAR</div><div class="kpi-value" style="font-size:1.3rem">${rupiah(d.pendapatanBulanIni)}</div></div>
    <div class="kpi-card"><div class="kpi-label">[SEC-04] TINGKAT_KONVERSI</div><div class="kpi-value">${d.konversi}%</div></div>`;

  drawBarChart(document.getElementById('chartBar'), d.grafik);

  document.getElementById('tblTerbaru').querySelector('tbody').innerHTML = d.terbaru.map(p => `
    <tr><td>${p.IDPesanan}</td><td>${p.IDProduk}</td><td>${p.Nama}</td><td><span class="chip ${p.Status === 'Dibayar' || p.Status === 'Selesai' ? 'on' : ''}">${p.Status}</span></td></tr>`).join('');
}
function drawBarChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth || 600, h = 180;
  canvas.width = w * 2; canvas.height = h * 2; canvas.getContext('2d').scale(2, 2);
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...data.map(d => d.jumlah), 1);
  const barW = w / data.length * 0.5;
  data.forEach((d, i) => {
    const x = (w / data.length) * i + (w / data.length - barW) / 2;
    const barH = (d.jumlah / max) * (h - 36);
    ctx.fillStyle = i === data.length - 1 ? '#FFFFFF' : '#3a3a3a';
    ctx.fillRect(x, h - 20 - barH, barW, barH);
    ctx.fillStyle = '#AAAAAA'; ctx.font = '10px JetBrains Mono'; ctx.textAlign = 'center';
    ctx.fillText(d.jumlah, x + barW / 2, h - 24 - barH);
    ctx.fillText('[' + d.bulan.toUpperCase() + ']', x + barW / 2, h - 6);
  });
}

// ============================================================
// PRODUK
// ============================================================
async function loadProduk() {
  const r = await api('admin.produk.list');
  if (!r.success) return;
  document.getElementById('tblProduk').querySelector('tbody').innerHTML = r.data.map(p => `
    <tr>
      <td>${p.Urutan}</td><td>${p.Nama}</td><td><span class="chip">${p.Kategori}</span></td><td>${rupiah(p.Harga)}</td>
      <td><span class="chip ${p.StatusAktif ? 'on' : ''}">${p.StatusAktif ? '● AKTIF' : '○ NONAKTIF'}</span></td>
      <td class="row-actions">
        <button class="btn-ghost" data-edit='${JSON.stringify(p).replace(/'/g, '&#39;')}'>[EDIT]</button>
        <button class="btn-ghost" data-toggle="${p._row}" data-aktif="${!p.StatusAktif}">${p.StatusAktif ? '[NONAKTIFKAN]' : '[AKTIFKAN]'}</button>
      </td>
    </tr>`).join('');
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openProdukModal(JSON.parse(b.dataset.edit))));
  document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
    await api('admin.produk.setStatus', { _row: Number(b.dataset.toggle), aktif: b.dataset.aktif === 'true' });
    loadProduk();
  }));
}
document.getElementById('btnTambahProduk').addEventListener('click', () => openProdukModal(null));
function openProdukModal(p) {
  document.getElementById('mpTitle').textContent = p ? 'EDIT_PRODUK' : 'TAMBAH_PRODUK';
  document.getElementById('pRow').value = p ? p._row : '';
  document.getElementById('pNama').value = p ? p.Nama : '';
  document.getElementById('pKategori').value = p ? p.Kategori : 'Jasa';
  document.getElementById('pLencana').value = p ? p.Lencana : '';
  document.getElementById('pHarga').value = p ? p.Harga : '';
  document.getElementById('pHargaCoret').value = p ? p.HargaCoret : '';
  document.getElementById('pDeskripsi').value = p ? p.Deskripsi : '';
  document.getElementById('pFitur').value = p ? p.Fitur : '';
  document.getElementById('pGambar').value = p ? p.Gambar : '';
  document.getElementById('pUrutan').value = p ? p.Urutan : 1;
  document.getElementById('modalProduk').classList.add('is-open');
}
document.getElementById('formProduk').addEventListener('submit', async e => {
  e.preventDefault();
  const row = document.getElementById('pRow').value;
  const data = {
    Nama: document.getElementById('pNama').value, Kategori: document.getElementById('pKategori').value,
    Lencana: document.getElementById('pLencana').value, Harga: Number(document.getElementById('pHarga').value),
    HargaCoret: Number(document.getElementById('pHargaCoret').value || 0), Deskripsi: document.getElementById('pDeskripsi').value,
    Fitur: document.getElementById('pFitur').value, Gambar: document.getElementById('pGambar').value,
    Urutan: Number(document.getElementById('pUrutan').value || 1)
  };
  if (row) data._row = Number(row);
  await api('admin.produk.simpan', data);
  closeModals(); loadProduk();
});

// ============================================================
// PESANAN
// ============================================================
async function loadPesanan() {
  const filter = {
    cari: document.getElementById('fCari').value, status: document.getElementById('fStatus').value,
    dari: document.getElementById('fDari').value, sampai: document.getElementById('fSampai').value
  };
  const r = await api('admin.pesanan.list', filter);
  if (!r.success) return;
  document.getElementById('badgePesanan').textContent = '[' + r.data.filter(p => p.Status === 'Baru').length + ']';
  document.getElementById('tblPesanan').querySelector('tbody').innerHTML = r.data.map(p => `
    <tr>
      <td>${p.IDPesanan}</td><td>${Utilities_formatDate(p.Waktu)}</td><td>${p.IDProduk}</td><td>${p.Nama}</td><td>${p.WhatsApp}</td>
      <td><span class="chip ${p.Status === 'Dibayar' || p.Status === 'Selesai' ? 'on' : ''}">${p.Status}</span></td>
      <td>
        <select class="ubah-status" data-row="${p._row}" style="width:auto;margin:0">
          ${['Baru', 'Dibayar', 'Selesai', 'Batal'].map(s => `<option ${s === p.Status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
    </tr>`).join('');
  document.querySelectorAll('.ubah-status').forEach(sel => sel.addEventListener('change', async () => {
    await api('admin.pesanan.ubahStatus', { _row: Number(sel.dataset.row), status: sel.value });
    loadPesanan();
  }));
}
function Utilities_formatDate(v) { try { return new Date(v).toLocaleString('id-ID'); } catch (e) { return v; } }
document.getElementById('btnTerapkanFilter').addEventListener('click', loadPesanan);
document.getElementById('btnEksporXlsx').addEventListener('click', () => eksporPesanan('xlsx'));
document.getElementById('btnEksporPdf').addEventListener('click', () => eksporPesanan('pdf'));
async function eksporPesanan(format) {
  const filter = { cari: document.getElementById('fCari').value, status: document.getElementById('fStatus').value };
  const r = await api('admin.pesanan.ekspor', { filter, format });
  if (!r.success) return alert(r.message);
  window.open(r.data.url, '_blank');
}

// ============================================================
// TESTIMONI
// ============================================================
async function loadTestimoni() {
  const r = await api('admin.testimoni.list');
  if (!r.success) return;
  document.getElementById('testiAdminGrid').innerHTML = r.data.map(t => `
    <div class="testi-admin-card">
      <div class="stars">${'★'.repeat(Number(t.Rating) || 5)}</div>
      <strong>${t.Nama}</strong><br><small>${t.Peran || ''}</small>
      <p>"${t.Isi}"</p>
      <div class="row-actions">
        <button class="btn-ghost" data-edit='${JSON.stringify(t).replace(/'/g, '&#39;')}'>[EDIT]</button>
        <button class="btn-ghost" data-tampil="${t._row}" data-v="${!t.Tampilkan}">${t.Tampilkan ? '[SEMBUNYIKAN]' : '[TAMPILKAN]'}</button>
        <button class="btn-danger" data-hapus="${t._row}">[HAPUS]</button>
      </div>
    </div>`).join('');
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openTestiModal(JSON.parse(b.dataset.edit))));
  document.querySelectorAll('[data-tampil]').forEach(b => b.addEventListener('click', async () => { await api('admin.testimoni.setTampil', { _row: Number(b.dataset.tampil), tampil: b.dataset.v === 'true' }); loadTestimoni(); }));
  document.querySelectorAll('[data-hapus]').forEach(b => b.addEventListener('click', async () => { if (confirm('Hapus testimoni ini?')) { await api('admin.testimoni.hapus', { _row: Number(b.dataset.hapus) }); loadTestimoni(); } }));
}
document.getElementById('btnTambahTestimoni').addEventListener('click', () => openTestiModal(null));
function openTestiModal(t) {
  document.getElementById('tRow').value = t ? t._row : '';
  document.getElementById('tNama').value = t ? t.Nama : '';
  document.getElementById('tPeran').value = t ? t.Peran : '';
  document.getElementById('tIsi').value = t ? t.Isi : '';
  document.getElementById('tRating').value = t ? t.Rating : 5;
  document.getElementById('modalTestimoni').classList.add('is-open');
}
document.getElementById('formTestimoni').addEventListener('submit', async e => {
  e.preventDefault();
  const row = document.getElementById('tRow').value;
  const data = { Nama: document.getElementById('tNama').value, Peran: document.getElementById('tPeran').value, Isi: document.getElementById('tIsi').value, Rating: Number(document.getElementById('tRating').value) };
  if (row) data._row = Number(row);
  await api('admin.testimoni.simpan', data);
  closeModals(); loadTestimoni();
});

// ============================================================
// NOTIFIKASI WA + CRM
// ============================================================
async function loadNotifikasi() {
  const r = await api('admin.notif.config');
  if (r.success) {
    document.getElementById('tokenTersamar').textContent = '// token saat ini: ' + r.data.tokenTersamar;
    document.getElementById('nToggleAktif').checked = r.data.aktif;
  }
  const crm = await api('admin.crm.list', {});
  renderCrm(crm.data || []);
}
document.getElementById('btnSimpanToken').addEventListener('click', async () => {
  const v = document.getElementById('nTokenFonnte').value.trim();
  if (!v) return;
  await api('admin.notif.simpanToken', { token: v });
  document.getElementById('nTokenFonnte').value = '';
  loadNotifikasi();
});
document.getElementById('nToggleAktif').addEventListener('change', async e => { await api('admin.notif.toggle', { aktif: e.target.checked }); });
document.getElementById('btnTes').addEventListener('click', async () => {
  const r = await api('admin.notif.tes', { nomorTes: document.getElementById('nNomorTes').value });
  alert(r.message);
});
document.getElementById('btnCrmSync').addEventListener('click', async () => { await api('admin.crm.sync'); loadNotifikasi(); });
document.getElementById('crmCari').addEventListener('input', async e => { const r = await api('admin.crm.list', { cari: e.target.value }); renderCrm(r.data || []); });
function renderCrm(rows) {
  document.getElementById('crmBody').innerHTML = rows.map(r => `<tr><td>${r.Nama}</td><td>${r.WhatsApp}</td><td>${r.JumlahPesan}</td></tr>`).join('');
}

// ============================================================
// PENGATURAN
// ============================================================
async function loadPengaturan() {
  const r = await api('admin.pengaturan.list');
  if (!r.success) return;
  document.querySelectorAll('[data-k]').forEach(el => {
    const v = r.data[el.dataset.k];
    if (el.dataset.bool) el.checked = v === 'TRUE'; else el.value = v || '';
  });
}
document.getElementById('btnSimpanPengaturan').addEventListener('click', async () => {
  const data = {};
  document.querySelectorAll('[data-k]').forEach(el => { data[el.dataset.k] = el.dataset.bool ? (el.checked ? 'TRUE' : 'FALSE') : el.value; });
  const r = await api('admin.pengaturan.simpan', data);
  alert(r.message);
});
document.getElementById('btnFlushCache').addEventListener('click', async () => { const r = await api('admin.cache.flush'); alert(r.message); });
document.getElementById('btnGantiSandi').addEventListener('click', async () => {
  const sandiBaru = document.getElementById('pSandiBaru').value;
  if (sandiBaru.length < 8) return alert('Kata sandi baru minimal 8 karakter.');
  const r = await api('admin.gantiSandi', { sandiBaru });
  alert(r.message);
  if (r.success) logout();
});
