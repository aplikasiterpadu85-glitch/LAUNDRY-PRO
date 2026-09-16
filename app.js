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
let activeNewTransactionItems = [];
let activeTransactionId = null;
let currentTransactionFilter = 'Antrian';
let currentUserRole = safeStorage.getItem("arsyUserRole") || null;

document.addEventListener("DOMContentLoaded", function () {
  injectLoginModal();
  injectSelectServiceModalHTML();
  injectTransactionModalHTML();
  injectPaymentModalHTML();
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
function openInputPengeluaran(kategori) { 
  document.getElementById("kategoriPengeluaran").value = kategori; 
  document.getElementById("judulModalPengeluaran").textContent = `Catat: ${kategori}`; 
  document.getElementById("modalPengeluaran").classList.add("show"); 
}

function closeModalPengeluaran() { 
  document.getElementById("modalPengeluaran").classList.remove("show"); 
  document.getElementById("formPengeluaran").reset(); 
}

document.getElementById("formPengeluaran")?.addEventListener("submit", function(e) {
  e.preventDefault();
  const kat = document.getElementById("kategoriPengeluaran").value;
  const desc = document.getElementById("descPengeluaran").value;
  const nom = parseFloat(document.getElementById("nominalPengeluaran").value) || 0;
  expensesData.push({ id: Date.now(), date: new Date().toISOString(), category: kat, desc: desc, amount: nom });
  safeStorage.setItem("arsyExpenses", JSON.stringify(expensesData));
  closeModalPengeluaran(); 
  hitungKeuanganLengkap(); 
  showToast("Pengeluaran disimpan");
});

function hapusPengeluaran(id) {
  if(confirm("Hapus catatan ini?")) { 
    expensesData = expensesData.filter(e => e.id !== id); 
    safeStorage.setItem("arsyExpenses", JSON.stringify(expensesData)); 
    hitungKeuanganLengkap(); 
  }
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
  if(tbody) {
    tbody.innerHTML = expensesData.sort((a,b) => new Date(b.date) - new Date(a.date)).map(e => `
      <tr>
        <td style="padding:10px;">${formatDate(e.date).split(' ')[0]}</td>
        <td><b>${e.category}</b></td>
        <td>${e.desc}</td>
        <td style="color:#dc2626;">${formatRupiah(e.amount)}</td>
        <td><button style="background:#fee2e2; color:red; border:none; padding:4px 8px; border-radius:4px;" onclick="hapusPengeluaran(${e.id})">✕</button></td>
      </tr>
    `).join("");
  }
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

function renderAll() { updateDashboard(); renderRecentTransactions(); renderAllTransactions(); renderServices(); hitungKeuanganLengkap(); }

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
 // --- MODAL PILIH LAYANAN ---
function injectSelectServiceModalHTML() {
  if (document.getElementById("selectServiceModal")) return;
  const modal = document.createElement("div");
  modal.id = "selectServiceModal";
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content" style="background: white; padding: 20px; border-radius: 16px; width: 92%; max-width: 420px; max-height: 85vh; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="font-size: 18px; font-weight: bold; color: var(--text);">Pilih Layanan</h3>
        <button type="button" onclick="closeSelectServiceModal()" style="background:none; border:none; font-size:22px; cursor:pointer;">×</button>
      </div>
      <div style="margin-bottom: 12px;">
        <input type="text" id="searchServiceInput" placeholder="🔍 Cari layanan..." onkeyup="filterServiceListModal(this.value)" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; outline: none;">
      </div>
      <div id="modalServiceListContainer" style="overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 8px; max-height: 50vh;"></div>
    </div>
  `;
  document.body.appendChild(modal);
}

function openServiceSelect() {
  injectSelectServiceModalHTML();
  renderModalServiceList(servicePrices);
  document.getElementById("searchServiceInput").value = "";
  document.getElementById("selectServiceModal").classList.add("show");
}

function closeSelectServiceModal() {
  const modal = document.getElementById("selectServiceModal");
  if (modal) modal.classList.remove("show");
}

function renderModalServiceList(servicesObj) {
  const container = document.getElementById("modalServiceListContainer");
  if (!container) return;
  const keys = Object.keys(servicesObj);
  if (keys.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--muted); padding: 20px;">Belum ada layanan.</p>`;
    return;
  }
  container.innerHTML = keys.map(name => {
    const srv = servicesObj[name];
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px;">
        <div>
          <strong style="font-size: 14px; color: var(--text); display: block;">${escapeHTML(name)}</strong>
          <span style="font-size: 12px; color: var(--primary); font-weight: bold;">${formatRupiah(srv.price)} / ${srv.unit}</span>
        </div>
        <button type="button" onclick="selectServiceForTransaction('${escapeHTML(name)}')" style="background: #e1edff; color: var(--primary); border: none; padding: 6px 14px; border-radius: 6px; font-weight: bold; font-size: 12px;">+ Pilih</button>
      </div>
    `;
  }).join("");
}

function filterServiceListModal(keyword) {
  const q = keyword.toLowerCase().trim();
  const filtered = {};
  Object.keys(servicePrices).forEach(name => {
    if (name.toLowerCase().includes(q)) filtered[name] = servicePrices[name];
  });
  renderModalServiceList(filtered);
}

function selectServiceForTransaction(name) {
  const srv = servicePrices[name];
  if (!srv) return;
  activeNewTransactionItems.push({
    serviceType: name,
    weight: srv.minQty || 1,
    total: srv.price * (srv.minQty || 1)
  });
  renderTrxItems();
  closeSelectServiceModal();
  showToast(`Ditambahkan`);
}

// --- MODAL TRANSAKSI BARU (DENGAN TOMBOL -/+) ---
function injectTransactionModalHTML() {
  const existingModal = document.getElementById("transactionModalFull");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div"); 
  modal.id = "transactionModalFull"; 
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content" style="padding: 20px; border-radius: 16px; background: white; max-width: 400px; width: 90%;">
      <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <h2 style="font-size:18px;">Transaksi Baru</h2>
        <button type="button" onclick="closeTransactionModal()" class="close-button" style="background:none; border:none; font-size:24px;">×</button>
      </div>
      <form id="transactionFormCore">
        <div style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:bold; display:block; margin-bottom:4px;">Nama Pelanggan</label>
          <input type="text" id="trxCustomerName" placeholder="Contoh: Budi" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;" required autocomplete="off">
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; margin-bottom: 8px;">
          <label style="font-size:13px; font-weight:bold; margin:0;">Layanan Laundry</label>
          <button type="button" onclick="openServiceSelect()" style="background: transparent; color: var(--primary); padding: 4px 10px; border: 1px solid var(--border); border-radius: 20px; font-size: 12px; font-weight: bold;">+ Tambah Layanan</button>
        </div>
        <div id="trxItemsContainer" style="border: 1px dashed var(--border); border-radius: 8px; padding: 15px; background: #f8fafc; margin-bottom:15px; min-height:60px; text-align:center; color:var(--muted); font-size:13px;">
          Belum ada layanan dipilih
        </div>
        <div style="margin-bottom:15px;">
          <label style="font-size:13px; font-weight:bold; display:block; margin-bottom:4px;">Status</label>
          <select id="trxStatusSelect" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; outline:none; background:white;">
            <option value="Antrian">Antrian</option>
            <option value="Proses">Proses</option>
            <option value="Siap Diambil">Siap Diambil</option>
            <option value="Selesai">Selesai</option>
          </select>
        </div>
        <div style="background: white; border-top: 1px solid var(--border); padding-top: 15px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items:center;">
          <span style="font-weight: bold; font-size: 14px;">Total</span>
          <b id="trxGrandTotalDisplay" style="color: var(--primary); font-size: 18px;">Rp 0</b>
        </div>
        <button type="submit" class="submit-button" style="width:100%; padding:12px; border-radius:8px; font-size:14px;">Simpan Transaksi</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

function openTransactionModal() { 
  activeNewTransactionItems = []; 
  renderTrxItems(); 
  document.getElementById("transactionModalFull").classList.add("show"); 
}

function closeTransactionModal() { 
  document.getElementById("transactionModalFull").classList.remove("show"); 
}

function renderTrxItems() {
  const c = document.getElementById("trxItemsContainer");
  let grand = 0;
  if (activeNewTransactionItems.length === 0) {
    c.style.textAlign = "center"; c.style.padding = "15px";
    c.innerHTML = "Belum ada layanan dipilih";
    document.getElementById("trxGrandTotalDisplay").textContent = "Rp 0";
    return;
  }
  c.style.textAlign = "left"; c.style.padding = "10px";
  c.innerHTML = activeNewTransactionItems.map((it, i) => {
    const srv = servicePrices[it.serviceType];
    const price = srv ? srv.price : 0;
    const unit = srv ? srv.unit : "kg";
    grand += it.total;
    return `
      <div style="background: white; border: 1px solid var(--border); border-radius: 8px; padding: 10px; margin-bottom: 8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="font-size:14px;">${escapeHTML(it.serviceType)}</strong>
          <button type="button" onclick="activeNewTransactionItems.splice(${i},1);renderTrxItems()" style="background:none; border:none; font-weight:bold; font-size:12px; color: #dc2626; cursor:pointer;">Hapus</button>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="display:flex; align-items:center; border: 1px solid var(--border); border-radius:6px; overflow:hidden;">
              <button type="button" onclick="updateTrxItemQty(${i}, -1)" style="width:30px; height:30px; background:#f4f7fb; border:none; color:var(--primary); font-size:16px; font-weight:bold;">-</button>
              <input type="text" value="${it.weight}" readonly style="width:40px; height:30px; text-align:center; border:none; border-left:1px solid var(--border); border-right:1px solid var(--border); font-size:14px;">
              <button type="button" onclick="updateTrxItemQty(${i}, 1)" style="width:30px; height:30px; background:#f4f7fb; border:none; color:var(--primary); font-size:16px; font-weight:bold;">+</button>
            </div>
            <span style="font-size:12px; color:var(--muted);">${unit} x ${formatRupiah(price)}</span>
          </div>
          <strong style="font-size:14px;">${formatRupiah(it.total)}</strong>
        </div>
      </div>
    `;
  }).join("");
  document.getElementById("trxGrandTotalDisplay").textContent = formatRupiah(grand);
}

function updateTrxItemQty(index, change) {
  const it = activeNewTransactionItems[index];
  const srv = servicePrices[it.serviceType];
  if (!srv) return;
  const min = srv.minQty || 1;
  let newQty = it.weight + change;
  if (newQty < min) newQty = min;
  it.weight = newQty;
  it.total = newQty * srv.price;
  renderTrxItems();
}

function setupForm() {
  document.getElementById("transactionFormCore")?.addEventListener("submit", function(e) {
    e.preventDefault();
    if (activeNewTransactionItems.length === 0) return showToast("Tambah minimal 1 layanan");
    
    const cust = document.getElementById("trxCustomerName").value;
    const statusTerpilih = document.getElementById("trxStatusSelect").value;
    
    const trx = { 
      id: Date.now(), 
      customerName: cust, 
      items: [...activeNewTransactionItems], 
      status: statusTerpilih, 
      total: activeNewTransactionItems.reduce((s,i)=>s+i.total,0), 
      date: new Date().toISOString(), 
      paymentStatus: "Belum Lunas", 
      paymentMethod: "-" 
    };
    transactions.unshift(trx); 
    saveData(); 
    renderAll(); 
    closeTransactionModal(); 
    document.getElementById("transactionFormCore").reset(); 
    showToast("Transaksi Disimpan!");
  });
}

// --- DETAIL TRANSAKSI LENGKAP ---
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
  activeTransactionId = id; 
  const item = transactions.find(t => t.id === id); 
  if(!item) return;
  const c = document.getElementById("transactionDetailPage");
  const isLunas = item.paymentStatus === 'Lunas';
  
  c.innerHTML = `
    <div class="report-header">
      <button class="report-back" onclick="showPage('transactionsPage')">‹</button>
      <div><h1 style="font-size: 16px;">Detail Transaksi</h1><p>Rincian status dan pembayaran</p></div>
      <button style="background:none; border:none; font-size:20px; cursor:pointer; margin-left:auto;" onclick="batalTrx(${item.id})">⋮</button>
    </div>
    <div class="report-content" style="background: #f4f7fb; min-height: 100vh; padding: 15px;">
      <div style="background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px; font-size:13px; line-height: 1.6;">
        <div>No. Transaksi: <span style="color:var(--text); font-weight:bold;">TRX/${item.id}</span></div>
        <div>Status Pengerjaan: <span style="color:var(--text); font-weight:bold;">${item.status}</span></div>
        <div>Kasir: ${currentUserRole === 'admin' ? 'Admin' : 'Kasir'}</div>
        <div>Transaksi Masuk: ${formatDate(item.date)}</div>
      </div>
      
      <div style="background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
        <p style="font-size:11px; color:var(--muted); margin-bottom:4px; font-weight:bold;">INFO PELANGGAN</p>
        <div style="font-weight:bold; font-size:14px; color:var(--primary);">${escapeHTML(item.customerName)}</div>
      </div>
      
      <div style="background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <p style="font-size:11px; color:var(--muted); font-weight:bold; margin:0;">LAYANAN LAUNDRY</p>
        </div>
        ${item.items.map(it => {
            const pricePerUnit = servicePrices[it.serviceType]?.price || 0;
            return `
            <div style="border-bottom: 1px dashed var(--border); padding-bottom:10px; margin-bottom:10px;">
                <strong style="display:block; font-size:14px; margin-bottom:4px;">${escapeHTML(it.serviceType)}</strong>
                <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--muted);">
                    <span>${it.weight} x ${formatRupiah(pricePerUnit)} : ${formatRupiah(it.total)}</span>
                </div>
            </div>`;
        }).join('')}
        <button class="submit-button" onclick="majuStatus(${item.id})" style="background: var(--primary); margin-top:10px; width:100%;">Proses Transaksi</button>
      </div>

      <div style="background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
        <p style="font-size:11px; color:var(--muted); font-weight:bold; margin-bottom:10px;">INFO PEMBAYARAN</p>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span style="font-size:13px; font-weight:bold;">Total Transaksi</span>
            <strong style="font-size:15px; color:var(--primary);">${formatRupiah(item.total)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;">
            <span style="font-size:13px; font-weight:bold;">Status Pembayaran</span>
            <span style="font-size:11px; font-weight:bold; padding:4px 8px; border-radius:15px; background:${isLunas?'#dcfce7':'#fee2e2'}; color:${isLunas?'#16a34a':'#dc2626'};">${item.paymentStatus}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
            <span style="font-size:13px; font-weight:bold;">Metode Pembayaran</span>
            <span style="font-size:13px; font-weight:bold;">-</span>
        </div>
        
        ${!isLunas ? `<button class="submit-button" onclick="openPaymentModal(${item.id})" style="background: #16a34a; margin-top:0; margin-bottom:10px; width:100%;">Bayar</button>` : ''}
        
        <div style="display:flex; gap:10px; margin-bottom:10px;">
            <button class="submit-button" style="flex:1; margin-top:0; background:white; color:var(--text); border:1px solid var(--border);" onclick="showToast('Cetak Nota')">Cetak Nota</button>
            <button class="submit-button" style="flex:1; margin-top:0; background:white; color:var(--text); border:1px solid var(--border);" onclick="showToast('Cetak Label')">Cetak Label</button>
        </div>
        <button class="submit-button" style="margin-top:0; background:#16a34a; width:100%;" onclick="showToast('Membuka WhatsApp...')">Kirim Nota WhatsApp</button>
      </div>
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

function openServiceModal() { showToast("Gunakan menu layanan utama."); }
function openEditServiceModal() { showToast("Gunakan menu layanan utama."); }
                                              
