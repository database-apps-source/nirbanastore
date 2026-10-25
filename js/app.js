'use strict';
const GAS_URL = window.APP_CONFIG.GAS_URL;

// ============================================================
// FETCH HELPERS (pola gas-pro-api: text/plain untuk POST, hindari preflight CORS)
// ============================================================
async function apiGet(action) {
  try {
    const res = await fetch(`${GAS_URL}?action=${action}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  } catch (err) {
    console.error('GET gagal:', err.message);
    return null;
  }
}
async function apiPost(action, data) {
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data })
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: 'Gagal terhubung ke server: ' + err.message };
  }
}

let STATE = { produk: [], testimoni: [], pengaturan: {}, filter: 'Semua' };

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  initHeroSlideshow();
  initAccordion();
  initFloatingButterfly();
  initOrderModal();
  initTestiModal();

  const [produk, testimoni, pengaturan] = await Promise.all([
    apiGet('produk.list'), apiGet('testimoni.list'), apiGet('pengaturan.publik')
  ]);
  STATE.produk = produk || [];
  STATE.testimoni = testimoni || [];
  STATE.pengaturan = pengaturan || {};

  applySettings();
  renderProducts();
  renderTestimonials();
  initFilterPills();
});

// ============================================================
// PENGATURAN PUBLIK (banner, WA footer, disclaimer)
// ============================================================
function applySettings() {
  const p = STATE.pengaturan;
  if (p.judulHalaman) document.title = p.judulHalaman;
  if (p.teksBanner) document.getElementById('bannerTeks').textContent = p.teksBanner;
  document.getElementById('bannerPromo').style.display = p.bannerAktif ? '' : 'none';
  if (p.teksDisclaimer) document.getElementById('footerDisclaimer').textContent = p.teksDisclaimer;
  const waLink = `https://wa.me/${p.nomorWhatsAppAdmin}?text=${encodeURIComponent('Halo, saya ingin bertanya tentang layanan Nirbana Store.')}`;
  document.getElementById('waFooterLink').href = waLink;
  document.getElementById('floatingWa').href = waLink;
}

// ============================================================
// HERO SLIDESHOW OTOMATIS
// ============================================================
function initHeroSlideshow() {
  const slides = [...document.querySelectorAll('.hero-slide')];
  const dotsWrap = document.getElementById('heroDots');
  slides.forEach((_, i) => {
    const d = document.createElement('span');
    if (i === 0) d.classList.add('is-active');
    d.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(d);
  });
  let idx = 0;
  function goTo(i) {
    slides[idx].classList.remove('is-active');
    dotsWrap.children[idx].classList.remove('is-active');
    idx = i;
    slides[idx].classList.add('is-active');
    dotsWrap.children[idx].classList.add('is-active');
  }
  setInterval(() => goTo((idx + 1) % slides.length), 5000);
}

// ============================================================
// PRODUK — kartu dengan slideshow gambar otomatis
// ============================================================
function renderProducts() {
  const grid = document.getElementById('productGrid');
  const list = STATE.produk.filter(p => STATE.filter === 'Semua' || p.kategori === STATE.filter);
  if (!list.length) { grid.innerHTML = '<p class="center">Belum ada produk pada kategori ini.</p>'; return; }

  grid.innerHTML = list.map((p, idx) => {
    const gambar = p.gambar && p.gambar.length ? p.gambar : [];
    const slidesHtml = gambar.length
      ? gambar.map((src, i) => `<div class="slide ${i === 0 ? 'is-active' : ''}"><img src="${src}" alt="${p.nama}" loading="lazy"></div>`).join('')
      : `<div class="slide is-active">${iconForKategori(p.kategori)}</div>`;
    return `
    <article class="product-card" data-id="${p.id}" data-media-idx="0" data-media-count="${gambar.length || 1}">
      <div class="product-media">
        ${p.lencana ? `<span class="product-badge">${p.lencana}</span>` : ''}
        ${slidesHtml}
      </div>
      <div class="product-body">
        <span class="product-cat">${p.kategori}</span>
        <h3>${p.nama}</h3>
        <p class="product-desc">${p.deskripsi || ''}</p>
        <div class="product-price-row">
          <span class="product-price">Rp${formatRupiah(p.harga)}</span>
          ${p.hargaCoret ? `<span class="product-price-strike">Rp${formatRupiah(p.hargaCoret)}</span>` : ''}
        </div>
        <button class="btn btn-primary btn-shine" data-open-order data-produk="${p.id}">Pesan Layanan</button>
      </div>
    </article>`;
  }).join('');

  // slideshow otomatis per kartu (hanya yang punya >1 gambar)
  grid.querySelectorAll('.product-card').forEach(card => {
    const count = Number(card.dataset.mediaCount);
    if (count <= 1) return;
    setInterval(() => {
      const slides = card.querySelectorAll('.slide');
      let i = Number(card.dataset.mediaIdx);
      slides[i].classList.remove('is-active');
      i = (i + 1) % slides.length;
      slides[i].classList.add('is-active');
      card.dataset.mediaIdx = i;
    }, 2800 + Math.random() * 800);
  });

  attachOrderButtons();
}
function iconForKategori(k) { return k === 'Digital' ? '💾' : '📄'; }
function formatRupiah(n) { return Number(n || 0).toLocaleString('id-ID'); }

function initFilterPills() {
  document.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      STATE.filter = btn.dataset.filter;
      renderProducts();
    });
  });
}

// ============================================================
// TESTIMONI — flip otomatis, glow hover, modal lengkap
// ============================================================
function renderTestimonials() {
  const grid = document.getElementById('testiGrid');
  if (!STATE.testimoni.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = STATE.testimoni.slice(0, 6).map((t, i) => `
    <div class="testi-card" data-idx="${i}">
      <div class="testi-flip">
        <div class="testi-face testi-front">
          <div class="testi-stars">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>
          <div class="testi-name">${t.nama}</div>
          <div class="testi-role">${t.peran || ''}</div>
          <p class="testi-text">"${t.isi}"</p>
          <span class="testi-tap">Ketuk untuk baca lengkap</span>
        </div>
        <div class="testi-face testi-back">
          <div>
            <div style="font-size:2rem">🦋</div>
            <strong>${t.nama}</strong>
            <p style="color:#dfe4ff">Pelanggan puas Nirbana Store</p>
          </div>
        </div>
      </div>
    </div>`).join('');

  // flip otomatis bergiliran agar terasa "hidup"
  const cards = [...grid.querySelectorAll('.testi-card')];
  cards.forEach((card, i) => {
    setInterval(() => card.classList.toggle('is-flipped'), 4500 + i * 300);
    card.addEventListener('click', () => openTestiModal(STATE.testimoni[i]));
  });
}

function initTestiModal() {
  document.getElementById('testiModalOverlay').addEventListener('click', e => {
    if (e.target.id === 'testiModalOverlay') closeTestiModal();
  });
}
function openTestiModal(t) {
  const card = document.getElementById('testiModalCard');
  card.innerHTML = `
    <div style="font-size:2.2rem">🦋</div>
    <div class="testi-stars" style="justify-content:center;display:flex;margin-bottom:.5rem">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>
    <h3 style="color:var(--primary)">${t.nama}</h3>
    <p class="muted">${t.peran || ''}</p>
    <p style="margin-top:1rem;color:var(--neutral-dark)">"${t.isi}"</p>
    <button class="btn btn-ghost" style="margin-top:1.25rem" id="btnCloseTesti">Tutup</button>`;
  document.getElementById('testiModalOverlay').classList.add('is-open');
  document.getElementById('btnCloseTesti').addEventListener('click', closeTestiModal);
}
function closeTestiModal() { document.getElementById('testiModalOverlay').classList.remove('is-open'); }

// ============================================================
// ACCORDION
// ============================================================
function initAccordion() {
  document.querySelectorAll('.accordion-head').forEach(btn => {
    btn.addEventListener('click', () => btn.parentElement.classList.toggle('is-open'));
  });
}

// ============================================================
// MODAL PEMESANAN
// ============================================================
let produkDipilih = null;
function attachOrderButtons() {
  document.querySelectorAll('[data-open-order]').forEach(btn => {
    btn.addEventListener('click', () => openOrderModal(btn.dataset.produk));
  });
}
function initOrderModal() {
  document.getElementById('btnOrderHeader').addEventListener('click', () => openOrderModal(STATE.produk[0]?.id));
  document.getElementById('btnCloseOrder').addEventListener('click', closeOrderModal);
  document.getElementById('orderModalOverlay').addEventListener('click', e => { if (e.target.id === 'orderModalOverlay') closeOrderModal(); });
  document.getElementById('orderForm').addEventListener('submit', handleOrderSubmit);
  document.getElementById('btnSalinRek').addEventListener('click', () => {
    const p = STATE.pengaturan;
    navigator.clipboard.writeText(document.getElementById('rekeningTeks').textContent);
    const b = document.getElementById('btnSalinRek'); b.textContent = 'Tersalin!'; setTimeout(() => b.textContent = 'Salin', 1500);
  });
}
async function openOrderModal(produkId) {
  produkDipilih = STATE.produk.find(p => p.id === produkId) || STATE.produk[0];
  if (!produkDipilih) return;
  document.getElementById('osNama').textContent = produkDipilih.nama;
  document.getElementById('osMeta').textContent = `⚡ ${produkDipilih.kategori} • Pengerjaan ${produkDipilih.fitur[0] || '-'}`;
  document.getElementById('osHarga').textContent = 'Rp' + formatRupiah(produkDipilih.harga);
  document.getElementById('rekeningTeks').textContent = 'Memuat informasi rekening...';
  document.getElementById('orderModalOverlay').classList.add('is-open');

  // rekening HANYA diambil di langkah checkout ini (bukan dari halaman publik umum), sesuai PRD §4
  const info = await apiGet('checkout.info');
  if (info) document.getElementById('rekeningTeks').innerHTML = `${info.namaBank}: ${info.nomorRekening}<br>a.n ${info.atasNama}`;
}
function closeOrderModal() { document.getElementById('orderModalOverlay').classList.remove('is-open'); }

async function handleOrderSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btnKirimPesanan');
  const nama = document.getElementById('fNama').value.trim();
  const wa = document.getElementById('fWa').value.trim();
  if (nama.length < 3) return alert('Nama minimal 3 karakter.');
  if (!/^0?8[0-9]{8,12}$/.test(wa.replace(/^0/, '8'))) { /* validasi ringan, backend tetap jadi sumber kebenaran */ }

  btn.disabled = true; btn.textContent = 'Mengirim...';
  const hasil = await apiPost('pesanan.buat', { nama, whatsapp: wa, produkId: produkDipilih.id, produkNama: produkDipilih.nama });
  btn.disabled = false; btn.textContent = '💬 Kirim Pesanan via WhatsApp';

  if (!hasil.success) { alert(hasil.message); return; }

  const pesan = `Halo Nirbana Store, saya ${nama} ingin memesan *${produkDipilih.nama}* (Rp${formatRupiah(produkDipilih.harga)}). ID Pesanan: ${hasil.data.idPesanan}`;
  const link = `https://wa.me/${STATE.pengaturan.nomorWhatsAppAdmin}?text=${encodeURIComponent(pesan)}`;
  window.open(link, '_blank');
  closeOrderModal();
  e.target.reset();
}

// ============================================================
// KUPU-KUPU HIDUP MENGIKUTI KURSOR
// ============================================================
function initFloatingButterfly() {
  const canvas = document.getElementById('butterfly-canvas');
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize(); addEventListener('resize', resize);

  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const butterfly = { x: target.x, y: target.y, angle: 0, wing: 0, trail: [] };
  let hasPointer = false;

  addEventListener('pointermove', e => { target.x = e.clientX; target.y = e.clientY; hasPointer = true; });
  addEventListener('touchmove', e => { if (e.touches[0]) { target.x = e.touches[0].clientX; target.y = e.touches[0].clientY; hasPointer = true; } }, { passive: true });

  let t = 0;
  function loop() {
    t += 0.05;
    // terbang mengikuti kursor dengan sedikit "melayang" alami (lag + goyangan sayap)
    const wanderX = hasPointer ? Math.sin(t * 1.3) * 14 : Math.sin(t * 0.6) * 60;
    const wanderY = hasPointer ? Math.cos(t * 1.7) * 10 : Math.cos(t * 0.5) * 40;
    const tx = (hasPointer ? target.x : innerWidth / 2 + Math.sin(t * 0.3) * 200) - 28 + wanderX;
    const ty = (hasPointer ? target.y : innerHeight / 2 + Math.cos(t * 0.3) * 120) - 40 + wanderY;

    const dx = tx - butterfly.x, dy = ty - butterfly.y;
    butterfly.x += dx * 0.08;
    butterfly.y += dy * 0.08;
    const speed = Math.hypot(dx, dy);
    if (speed > 1) butterfly.angle = Math.atan2(dy, dx);
    butterfly.wing = Math.sin(t * (10 + Math.min(speed, 20) * 0.4)) * 0.9;

    butterfly.trail.push({ x: butterfly.x, y: butterfly.y });
    if (butterfly.trail.length > 8) butterfly.trail.shift();

    ctx.clearRect(0, 0, innerWidth, innerHeight);
    drawButterfly(ctx, butterfly);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function drawButterfly(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle * 0.15); // sedikit miring sesuai arah terbang

  const flap = b.wing; // -1..1
  const bodyGrad = ctx.createLinearGradient(0, -14, 0, 14);
  bodyGrad.addColorStop(0, '#3a2b1a'); bodyGrad.addColorStop(1, '#1a120a');

  [-1, 1].forEach(side => {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(flap * 0.55);
    const wingGrad = ctx.createLinearGradient(0, -20, 26, 10);
    wingGrad.addColorStop(0, '#FF9E2C'); wingGrad.addColorStop(.5, '#FFC51A'); wingGrad.addColorStop(1, '#0B2F8A');
    ctx.fillStyle = wingGrad;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(1, -2);
    ctx.bezierCurveTo(10, -24, 30, -16, 24, 2);
    ctx.bezierCurveTo(28, 14, 10, 20, 1, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.ellipse(13, -6, 4, 2.4, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(-5, -20, -8, -24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(5, -20, 8, -24); ctx.stroke();
  ctx.restore();
}
