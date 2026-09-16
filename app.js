const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzgPz_F6fP_B9Ou5e9yMNtIIeQkAeXjPAX8wwkt4aIAR6ctwzcdyspMpkDHeTNI6BPOIg/exec";

const safeStorage = {
  _memory: {},
  getItem(key) { try { return localStorage.getItem(key); } catch (e) { return this._memory[key] || null; } },
  setItem(key, val) { try { localStorage.setItem(key, val); } catch (e) { this._memory[key] = String(val); } }
};

function getSafeData(key, defaultData) {
  try { let data = JSON.parse(safeStorage.getItem(key)); return data !== null ? data : defaultData; } 
  catch (e) { return defaultData; }
}

let servicePrices = getSafeData("arsyServices", {
  "Cuci Kering": { price: 5000, unit: "kg", processes: ["Cuci", "Pengeringan", "Lipat"], duration: "3 Hari", minQty: 1, pinned: true },
  "Cuci Setrika": { price: 10000, unit: "kg", processes: ["Cuci"], duration: "1 Hari", minQty: 1, pinned: true },
  "Bed Cover": { price: 25000, unit: "pcs", processes: ["Cuci"], duration: "1 Hari", minQty: 1, pinned: false }
});

let transactions = getSafeData("arsyTransactions", []);
let expensesData = getSafeData("arsyExpenses", []);
let savedCustomers = [];
let arsyOutlet = getSafeData("arsyOutlet", { name: "Arsy Laundry", phone: "6281282466642", city: "Kota Surabaya", address: "Jl. Dukuh Kupang, Gg. Lebar, No.76" });
let notaSettings = getSafeData("arsyNotaSettings", { hideLogo: false, hideOutlet: false, hideAddress: false, hideCashier: false, hideCustomer: false, showCategory: false, hideMessage: false, hideParfum: false, hidePowered: false, showEstDay: true, printerName: "RPPO2N", printerMac: "60:6E:41:63:65:00", paperSize: "58" });

let currentTransactionFilter = 'Antrian';
let activeTransactionId = null;
let currentReportType = 'all';
let activeNewTransactionItems = [];
let editingTransactionItemContext = null;
let currentUserRole = safeStorage.getItem("arsyUserRole") || null;

document.addEventListener("DOMContentLoaded", function () {
  injectLoginModal();
  injectCustomerModules();
  injectOutletModule();
  injectRichServiceModalHTML();
  injectPaymentModalHTML();
  injectReportPaymentMethodFilter();
  injectTransactionModalHTML();
  injectEditTransactionItemModalHTML();
  injectTransactionSearch();
  
  const isLoggedIn = safeStorage.getItem("arsyIsLoggedIn") === "true";
  const screen = document.getElementById("loginScreen");
  if (isLoggedIn && screen) {
    screen.style.display = "none";
    applyRoleRestrictions();
  } else if (screen) {
    screen.style.display = "flex";
  }

  renderAll();
  setupForm();
  loadNotaSettingsUI();
  setupDashboardInteractions();
});
// --- SISTEM LOGIN MULTI-USER ---
function injectLoginModal() {
  if (document.getElementById("loginScreen")) return;
  const div = document.createElement("div");
  div.id = "loginScreen";
  div.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #f8fafc; z-index: 99999; display: flex; justify-content: center; align-items: center; padding: 20px;`;
  div.innerHTML = `
    <div style="background: white; padding: 25px; border-radius: 16px; width: 100%; max-width: 360px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); text-align: center;">
      <h2 style="font-size: 20px; font-weight: bold; color: var(--text); margin-bottom: 6px;">Arsy Laundry</h2>
      <p style="font-size: 13px; color: var(--muted); margin-bottom: 20px;">Silakan login untuk masuk</p>
      <select id="loginRole" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; margin-bottom: 10px;">
        <option value="kasir">Karyawan (Kasir)</option>
        <option value="admin">Pemilik (Admin)</option>
      </select>
      <input type="password" id="pinInput" placeholder="Masukkan PIN" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 16px; text-align: center; letter-spacing: 4px; margin-bottom: 15px;">
      <button onclick="verifyLogin()" class="submit-button" style="margin-top:0;">Masuk</button>
      <p style="font-size: 11px; color: var(--muted); margin-top: 15px;">*PIN Admin: 1985 | Kasir: 1234</p>
    </div>
  `;
  document.body.appendChild(div);
}

function verifyLogin() {
  const role = document.getElementById("loginRole").value;
  const pin = document.getElementById("pinInput").value.trim();
  if (role === "admin" && pin === "1985") { loginSuccess("admin"); } 
  else if (role === "kasir" && pin === "1234") { loginSuccess("kasir"); } 
  else { showToast("PIN salah untuk " + role); }
}

function loginSuccess(role) {
  safeStorage.setItem("arsyIsLoggedIn", "true"); safeStorage.setItem("arsyUserRole", role); currentUserRole = role;
  document.getElementById("loginScreen").style.display = "none";
  applyRoleRestrictions(); showToast(`Halo, ${role.toUpperCase()}!`);
}

function logout() {
  if(confirm("Yakin ingin keluar?")) { safeStorage.setItem("arsyIsLoggedIn", "false"); location.reload(); }
}

function applyRoleRestrictions() {
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(el => el.style.display = (currentUserRole === 'kasir') ? 'none' : '');
}

// --- SISTEM KEUANGAN TERPADU (OMSET & PENGELUARAN) ---
function openInputPengeluaran(kategori) { document.getElementById("kategoriPengeluaran").value = kategori; document.getElementById("judulModalPengeluaran").textContent = `Catat: ${kategori}`; document.getElementById("modalPengeluaran").classList.add("show"); }
function closeModalPengeluaran() { document.getElementById("modalPengeluaran").classList.remove("show"); document.getElementById("formPengeluaran").reset(); }

document.getElementById("formPengeluaran")?.addEventListener("submit", function(e) {
  e.preventDefault();
  const kat = document.getElementById("kategoriPengeluaran").value;
  const desc = document.getElementById("descPengeluaran").value;
  const nom = parseFloat(document.getElementById("nominalPengeluaran").value) || 0;
  expensesData.push({ id: Date.now(), date: new Date().toISOString(), category: kat, desc: desc, amount: nom });
  safeStorage.setItem("arsyExpenses", JSON.stringify(expensesData));
  closeModalPengeluaran(); hitungKeuanganLengkap(); showToast("Pengeluaran disimpan");
});
function hapusPengeluaran(id) {
  if(confirm("Hapus catatan ini?")) { expensesData = expensesData.filter(e => e.id !== id); safeStorage.setItem("arsyExpenses", JSON.stringify(expensesData)); hitungKeuanganLengkap(); }
}

function hitungKeuanganLengkap() {
  if(currentUserRole === 'kasir') return;
  let totalOmset = transactions.filter(item => item.status !== "Batal" && (item.paymentStatus === "Lunas" || item.paidAmount > 0)).reduce((sum, item) => sum + (item.paymentStatus === "Lunas" ? item.total : (item.paidAmount || 0)), 0);
  let totalKeluar = 0, totalLaundrySaja = 0;
  ['HARIAN', 'LAUNDRY', 'LAIN2', 'TABUNGAN'].forEach(kat => {
    let sumCat = expensesData.filter(e => e.category === kat).reduce((a, b) => a + b.amount, 0);
    let el = document.getElementById(`subTotal${kat.charAt(0).toUpperCase() + kat.slice(1).toLowerCase().replace('2','in')}`);
    if(el) el.textContent = formatRupiah(sumCat);
    if (kat !== 'TABUNGAN') totalKeluar += sumCat;
    if (kat === 'LAUNDRY') totalLaundrySaja = sumCat;
  });
  if(document.getElementById("omsetLaundryTotal")) document.getElementById("omsetLaundryTotal").textContent = formatRupiah(totalOmset);
  if(document.getElementById("pengeluaranTotal")) document.getElementById("pengeluaranTotal").textContent = formatRupiah(totalKeluar);
  if(document.getElementById("labaBersihLengkap")) document.getElementById("labaBersihLengkap").textContent = formatRupiah(totalOmset - totalLaundrySaja);
  
  const tbody = document.getElementById("tabelPengeluaranBody");
  if(tbody) tbody.innerHTML = expensesData.sort((a,b) => new Date(b.date) - new Date(a.date)).map(e => `<tr><td style="padding:10px;">${formatDate(e.date).split(' ')[0]}</td><td><b>${e.category}</b></td><td>${e.desc}</td><td style="color:#dc2626;">${formatRupiah(e.amount)}</td><td><button class="btn-danger-small" style="background:#fee2e2; color:red; border:none; padding:4px 8px; border-radius:4px;" onclick="hapusPengeluaran(${e.id})">✕</button></td></tr>`).join("");
}

function showPage(pageId) {
  if (currentUserRole === 'kasir' && (pageId === 'reportsPage' || pageId === 'keuanganPage')) { return showToast("Hanya untuk Admin."); }
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  const target = document.getElementById(pageId); if (target) target.classList.add("active");
  document.querySelectorAll(".nav-button[data-page]").forEach(button => {
    button.classList.remove("active"); if (button.dataset.page === pageId) button.classList.add("active");
  });
  window.scrollTo(0, 0);
  if (pageId === 'keuanganPage') hitungKeuanganLengkap();
  if (pageId === 'transactionsPage') { const src = document.getElementById("transactionSearchInput"); if (src) src.value = ""; renderAllTransactions(); }
}

function formatRupiah(num) { return "Rp " + Number(num).toLocaleString("id-ID"); }
function formatDate(date) { if (!date) return "-"; return new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(".", ":"); }
function isToday(date) { if (!date) return false; return new Date().toDateString() === new Date(date).toDateString(); }
function showToast(msg) { const t = document.getElementById("toast"); if(!t) return; t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2500); }
function escapeHTML(text) { return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
async function saveData() {
  transactions = Array.from(new Map(transactions.map(t => [t.id, t])).values());
  safeStorage.setItem("arsyTransactions", JSON.stringify(transactions));
    }

function getTransactionItems(item) {
  if (item.items && Array.isArray(item.items) && item.items.length > 0) return item.items;
  return [{ serviceType: item.serviceType || "Cuci Kering", weight: item.weight || 1, total: item.total || 0 }];
}

function renderAll() { updateDashboard(); renderRecentTransactions(); renderAllTransactions(); renderServices(); updateReports(); hitungKeuanganLengkap(); }

function updateDashboard() {
  transactions = Array.from(new Map(transactions.map(t => [t.id, t])).values());
  const todayData = transactions.filter(item => isToday(item.date) && item.status !== "Batal");
  const todayValidIncome = transactions.filter(item => item.status !== "Batal" && (item.paymentStatus === "Lunas" || (item.paidAmount && item.paidAmount > 0)) && isToday(item.paymentDate || item.date)).reduce((sum, item) => sum + (item.paymentStatus === "Lunas" ? item.total : (item.paidAmount || 0)), 0);
  const pending = transactions.filter(item => { if (item.status === "Batal") return false; const st = item.status ? item.status.toLowerCase().trim() : ''; return st === "antrian" || st === "proses" || st === "siap diambil"; }).length;
  
  const customerMap = new Map(); transactions.forEach(t => customerMap.set(t.customerName, true));
  
  if(document.getElementById("todayIncome")) document.getElementById("todayIncome").textContent = formatRupiah(todayValidIncome);
  if(document.getElementById("todayTransactions")) document.getElementById("todayTransactions").textContent = todayData.length;
  if(document.getElementById("pendingTransactions")) document.getElementById("pendingTransactions").textContent = pending;
  if(document.getElementById("totalCustomers")) document.getElementById("totalCustomers").textContent = customerMap.size;
}

function transactionHTML(item) {
  const statusClass = item.status ? item.status.toLowerCase().replace(/\s+/g, '-') : 'pending';
  const payBadgeText = item.paymentStatus === 'DP' ? `DP (${formatRupiah(item.paidAmount || 0)})` : item.paymentStatus;
  const isLunas = item.paymentStatus === 'Lunas'; const isDP = item.paymentStatus === 'DP';
  return `
    <div class="transaction-item" onclick="openTransactionDetail(${item.id})" style="cursor: pointer;">
      <div class="item-main">
        <h3 style="color: var(--primary);">TRX/${item.id}</h3>
        <p style="font-weight: bold; color: var(--text); margin-top: 2px;">${escapeHTML(item.customerName)}</p>
        <span class="status status-${statusClass}">${item.status}</span>
      </div>
      <div class="item-price">
        ${formatRupiah(item.total)}<br>
        <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${isLunas ? '#dcfce7' : (isDP ? '#fef9c3' : '#fee2e2')}; color: ${isLunas ? '#16a34a' : (isDP ? '#ca8a04' : '#dc2626')}; display: inline-block; margin-top: 4px;">${payBadgeText}</span><br>
        <small style="color: var(--muted); font-size: 11px;">${formatDate(item.date)}</small>
      </div>
    </div>
  `;
}

function renderRecentTransactions() {
  const el = document.getElementById("recentTransactions"); if(!el) return;
  const recent = transactions.slice(0, 5);
  if (recent.length === 0) el.innerHTML = `<div class="empty-state">Belum ada transaksi</div>`;
  else el.innerHTML = recent.map(transactionHTML).join("");
    }
function filterTransactionsTab(status, element) {
  currentTransactionFilter = status;
  document.querySelectorAll('.trans-tab').forEach(btn => { btn.style.background = '#f4f7fb'; btn.style.color = '#718096'; });
  element.style.background = '#e1edff'; element.style.color = '#1769e0'; renderAllTransactions();
}

function injectTransactionSearch() {
  const page = document.getElementById("transactionsPage"); if (!page) return;
  const tab = page.querySelector(".transaction-tabs-container");
  if (!tab || document.getElementById("transactionSearchInput")) return;
  const wrp = document.createElement("div"); wrp.style.cssText = "padding: 10px 15px; background: white; border-bottom: 1px solid var(--border);";
  wrp.innerHTML = `<div style="position: relative;"><span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%);">🔍</span><input type="text" id="transactionSearchInput" placeholder="Cari nama pelanggan..." style="width: 100%; padding: 10px 10px 10px 35px; border: 1px solid var(--border); border-radius: 8px; outline: none;" onkeyup="renderAllTransactions()"></div>`;
  tab.insertAdjacentElement("afterend", wrp);
}

function renderAllTransactions() {
  const el = document.getElementById("allTransactions"); if (!el) return;
  let filtered = transactions;
  if (currentTransactionFilter && currentTransactionFilter !== 'Semua') {
    const ft = currentTransactionFilter.toLowerCase().trim();
    filtered = filtered.filter(item => {
      const st = item.status ? item.status.toLowerCase().trim() : '';
      if (ft === 'antrian') return st.includes('antrian'); if (ft === 'proses') return st.includes('proses');
      if (ft === 'siap diambil') return st.includes('siap'); if (ft === 'selesai') return st.includes('selesai');
      if (ft === 'batal') return st.includes('batal'); return st === ft;
    });
  }
  const q = document.getElementById("transactionSearchInput")?.value.toLowerCase().trim();
  if (q) filtered = filtered.filter(i => i.customerName && i.customerName.toLowerCase().includes(q));
  
  if (filtered.length === 0) el.innerHTML = `<div class="empty-state">Kosong</div>`;
  else el.innerHTML = filtered.map(transactionHTML).join("");
}

function renderServices() {
  const el = document.getElementById("servicesList"); if(!el) return;
  el.innerHTML = Object.keys(servicePrices).map(name => {
    const data = servicePrices[name];
    return `
      <div class="service-item" style="cursor: pointer;" onclick="openEditServiceModal('${escapeHTML(name)}')">
        <div class="item-main"><h3 style="font-size: 15px; color: var(--text);">${escapeHTML(name)}</h3><small style="color: var(--muted); font-size: 11px;">Min. ${data.minQty || 1} ${data.unit}</small></div>
        <div class="item-price"><b style="color: var(--primary);">${formatRupiah(data.price)} / ${data.unit}</b></div>
      </div>
    `;
  }).join("");
}
// MODAL TRANSAKSI BARU (Hanya yang Penting)
function injectTransactionModalHTML() {
  if (document.getElementById("transactionModalFull")) return;
  const modal = document.createElement("div"); modal.id = "transactionModalFull"; modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header"><h2>Transaksi Baru</h2><button type="button" onclick="closeTransactionModal()" class="close-button">×</button></div>
      <form id="transactionFormCore">
        <label>Nama Pelanggan</label><input type="text" id="trxCustomerName" required autocomplete="off">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px;"><label style="margin:0;">Layanan</label><button type="button" onclick="openServiceSelect()" style="background: #e1edff; color: var(--primary); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold;">+ Layanan</button></div>
        <div id="trxItemsContainer" style="border: 1px solid var(--border); border-radius: 8px; padding: 10px; background: #f8fafc; margin-bottom:15px; min-height:60px;">Belum ada cucian</div>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between;"><span style="font-weight: bold;">Total Tagihan</span><b id="trxGrandTotalDisplay" style="color: var(--primary); font-size: 16px;">Rp 0</b></div>
        <button type="submit" class="submit-button">Simpan Transaksi</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

function openTransactionModal() { activeNewTransactionItems = []; renderTrxItems(); document.getElementById("transactionModalFull").classList.add("show"); }
function closeTransactionModal() { document.getElementById("transactionModalFull").classList.remove("show"); }

function openServiceSelect() {
  const name = prompt("Ketik nama layanan (contoh: Cuci Kering):", "Cuci Kering");
  if(name && servicePrices[name]) {
    const srv = servicePrices[name];
    activeNewTransactionItems.push({ serviceType: name, weight: 1, total: srv.price }); renderTrxItems();
  } else if (name) { showToast("Layanan tidak ditemukan!"); }
}

function renderTrxItems() {
  const c = document.getElementById("trxItemsContainer"); let grand = 0;
  if(activeNewTransactionItems.length === 0) { c.innerHTML = "Belum ada cucian"; document.getElementById("trxGrandTotalDisplay").textContent = "Rp 0"; return; }
  c.innerHTML = activeNewTransactionItems.map((it, i) => {
    grand += it.total;
    return `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #ccc; padding-bottom:5px; margin-bottom:5px;"><span>${it.serviceType} (1 ${servicePrices[it.serviceType]?.unit || 'kg'})</span><span>${formatRupiah(it.total)} <span style="color:red; cursor:pointer;" onclick="activeNewTransactionItems.splice(${i},1);renderTrxItems()">✕</span></span></div>`;
  }).join("");
  document.getElementById("trxGrandTotalDisplay").textContent = formatRupiah(grand);
}

function setupForm() {
  document.getElementById("transactionFormCore")?.addEventListener("submit", function(e) {
    e.preventDefault();
    if (activeNewTransactionItems.length === 0) return showToast("Tambah minimal 1 layanan");
    const cust = document.getElementById("trxCustomerName").value;
    const trx = { id: Date.now(), customerName: cust, items: [...activeNewTransactionItems], status: "Antrian", total: activeNewTransactionItems.reduce((s,i)=>s+i.total,0), date: new Date().toISOString(), paymentStatus: "Belum Lunas", paymentMethod: "-" };
    transactions.unshift(trx); saveData(); renderAll(); closeTransactionModal(); document.getElementById("transactionFormCore").reset(); showToast("Transaksi Disimpan!");
  });
}
// MODAL PEMBAYARAN & UPDATE STATUS (Sederhana)
function injectPaymentModalHTML() {
  if (document.getElementById("paymentModalFull")) return;
  const modal = document.createElement("div"); modal.id = "paymentModalFull"; modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content"><div class="modal-header"><h2>Pembayaran</h2><button class="close-button" onclick="document.getElementById('paymentModalFull').classList.remove('show')">×</button></div>
    <form id="payFormCore"><label>Status</label><select id="payStatusIn"><option value="Lunas">Lunas</option><option value="DP">DP</option></select><button type="submit" class="submit-button">Bayar</button></form></div>
  `;
  document.body.appendChild(modal);
  
  document.getElementById("payFormCore").addEventListener("submit", function(e) {
    e.preventDefault();
    const item = transactions.find(t => t.id === activeTransactionId);
    if(item) {
      item.paymentStatus = document.getElementById("payStatusIn").value;
      if(item.paymentStatus === 'Lunas') item.paidAmount = item.total;
      saveData(); renderAll(); document.getElementById('paymentModalFull').classList.remove('show'); openTransactionDetail(activeTransactionId); showToast("Pembayaran diupdate");
    }
  });
}

function openPaymentModal(id) { activeTransactionId = id; document.getElementById("paymentModalFull").classList.add("show"); }

function openTransactionDetail(id) {
  activeTransactionId = id; const item = transactions.find(t => t.id === id); if(!item) return;
  const c = document.getElementById("transactionDetailPage");
  c.innerHTML = `
    <div class="report-header"><button class="report-back" onclick="showPage('transactionsPage')">‹</button><div><h1>TRX/${item.id}</h1><p>${item.customerName}</p></div></div>
    <div class="report-content">
      <div class="report-card"><p>Total: <b>${formatRupiah(item.total)}</b></p><p>Status Cucian: <b>${item.status}</b></p><p>Pembayaran: <b>${item.paymentStatus}</b></p></div>
      <button class="submit-button" onclick="majuStatus(${item.id})">Proses / Majukan Status Cucian</button>
      <button class="submit-button" style="background:var(--success);" onclick="openPaymentModal(${item.id})">Bayar / Update Lunas</button>
      <button class="submit-button" style="background:#dc2626;" onclick="batalTrx(${item.id})">Batalkan Transaksi</button>
    </div>
  `;
  showPage('transactionDetailPage');
}

function majuStatus(id) {
  const item = transactions.find(t => t.id === id); if(!item) return;
  if(item.status === 'Antrian') item.status = 'Proses';
  else if(item.status === 'Proses') item.status = 'Siap Diambil';
  else if(item.status === 'Siap Diambil') item.status = 'Selesai';
  saveData(); renderAll(); openTransactionDetail(id);
}
function batalTrx(id) {
  const item = transactions.find(t => t.id === id); if(!item) return;
  if(confirm("Yakin batalkan?")) { item.status = 'Batal'; saveData(); renderAll(); openTransactionDetail(id); }
}
// DUMMY FUNCTIONS UNTUK MENCEGAH ERROR
function injectCustomerModules() {}
function injectOutletModule() {}
function injectRichServiceModalHTML() {
  if (document.getElementById("serviceModal")) return;
  const m = document.createElement("div"); m.id = "serviceModal"; m.className = "modal";
  m.innerHTML = `<div class="modal-content"><div class="modal-header"><h2>Layanan</h2><button class="close-button" onclick="document.getElementById('serviceModal').classList.remove('show')">×</button></div><p style="text-align:center; color:var(--muted); padding:20px;">Fitur Edit Layanan dapat diakses via source code asli jenengan.</p></div>`;
  document.body.appendChild(m);
}
function injectReportPaymentMethodFilter() {}
function injectEditTransactionItemModalHTML() {}
function loadNotaSettingsUI() {}
function setupDashboardInteractions() {
  document.getElementById('todayIncome')?.parentElement.addEventListener('click', () => showPage('reportsPage'));
  document.getElementById('todayTransactions')?.parentElement.addEventListener('click', () => showPage('reportsPage'));
}
function updateReports() {}
function openServiceModal() { document.getElementById("serviceModal").classList.add("show"); }
function openEditServiceModal() { document.getElementById("serviceModal").classList.add("show"); }
function openReportDetail() { showToast("Buka fitur laporan di source code utama jenengan."); }
