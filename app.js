const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyBoxGrm5UEJnN5D2AZqdVC0MO7JCYiuL2tf_R0jCOdhisBtyNopbp7NoiCP_olsbLj/exec";

const safeStorage = {
  _memory: {},
  getItem(key) {
    try { return localStorage.getItem(key); }
    catch (e) { return this._memory[key] || null; }
  },
  setItem(key, val) {
    try { localStorage.setItem(key, val); }
    catch (e) { this._memory[key] = String(val); }
  },
  removeItem(key) {
    try { localStorage.removeItem(key); }
    catch (e) { delete this._memory[key]; }
  }
};

function getSafeData(key, defaultData) {
  try {
    let data = JSON.parse(safeStorage.getItem(key));
    return data !== null ? data : defaultData;
  } catch (e) {
    return defaultData;
  }
}

let servicePrices = getSafeData("arsyServices", {
  "Cuci Kering": { price: 5000, unit: "kg", processes: ["Cuci", "Pengeringan", "Lipat"], duration: "3 Hari", minQty: 1, pinned: true },
  "Cuci Setrika": { price: 10000, unit: "kg", processes: ["Cuci"], duration: "1 Hari", minQty: 1, pinned: true },
  "Bed Cover": { price: 25000, unit: "pcs", processes: ["Cuci"], duration: "1 Hari", minQty: 1, pinned: false },
  "sepatu": { price: 25000, unit: "set", processes: ["Cuci"], duration: "1 Hari", minQty: 1, pinned: false },
  "karpet": { price: 40000, unit: "m²", processes: ["Cuci"], duration: "1 Hari", minQty: 1, pinned: false },
  "sofa": { price: 50000, unit: "pcs", processes: ["Cuci"], duration: "7 Hari", minQty: 1, pinned: false },
  "Setrika express": { price: 6000, unit: "kg", processes: ["Setrika"], duration: "4 Jam", minQty: 1, pinned: false }
});

let transactions = getSafeData("arsyTransactions", []);
transactions = Array.from(new Map(transactions.map(t => [t.id, t])).values());

let savedCustomers = [];
let expensesData = getSafeData("arsyExpenses", []);
let currentUserRole = safeStorage.getItem("arsyUserRole") || null;

let arsyOutlet = getSafeData("arsyOutlet", {
  name: "Arsy Laundry",
  phone: "6281282466642",
  city: "Kota Surabaya",
  address: "Jl. Dukuh Kupang, Gg. Lebar, No.76"
});

let notaSettings = getSafeData("arsyNotaSettings", {
  hideLogo: false, hideOutlet: false, hideAddress: false, hideCashier: false,
  hideCustomer: false, showCategory: false, hideMessage: false, hideParfum: false,
  hidePowered: false, showEstDay: true, printerName: "RPPO2N",
  printerMac: "60:6E:41:63:65:00", paperSize: "58"
});

let currentTransactionFilter = 'Antrian';
let activeTransactionId = null;
let currentReportType = 'all';
let activeNewTransactionItems = [];
let editingTransactionItemContext = null;

function formatRupiah(number) { return "Rp " + Number(number).toLocaleString("id-ID"); }
function formatDate(date) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  }).replace(".", ":");
}
function isToday(date) {
  if (!date) return false;
  return new Date().toDateString() === new Date(date).toDateString();
}
function showToast(message) {
  const toast = document.getElementById("toast");
  if(!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(function () { toast.classList.remove("show"); }, 2500);
}
function escapeHTML(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function injectLoginModal() {
  if (document.getElementById("loginScreen")) return;
  const isLoggedIn = safeStorage.getItem("arsyIsLoggedIn") === "true";
  
  const div = document.createElement("div");
  div.id = "loginScreen";
  div.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #f8fafc; z-index: 99999; display: ${isLoggedIn ? 'none' : 'flex'}; justify-content: center; align-items: center; padding: 20px;`;
  div.innerHTML = `
    <div style="background: white; padding: 25px; border-radius: 16px; width: 100%; max-width: 360px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); text-align: center;">
      <h2 style="font-size: 20px; font-weight: bold; color: var(--text); margin-bottom: 6px;">Arsy Laundry</h2>
      <p style="font-size: 13px; color: var(--muted); margin-bottom: 20px;">Pilih Akses dan Masukkan PIN</p>
      <select id="loginRole" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; margin-bottom: 12px; outline:none; background:white;">
        <option value="kasir">Karyawan (Kasir)</option>
        <option value="admin">Pemilik (Admin)</option>
      </select>
      <input type="password" id="pinInput" placeholder="Masukkan PIN" style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 16px; text-align: center; letter-spacing: 4px; margin-bottom: 15px; outline:none;" maxlength="6">
      <button onclick="verifyPin()" style="background: var(--primary); color: white; width: 100%; padding: 12px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; font-size: 14px;">Masuk</button>
      <p style="font-size: 11px; color: var(--muted); margin-top: 15px;">*PIN Admin: 1985 | Kasir: 1234</p>
    </div>
  `;
  document.body.appendChild(div);
}

function verifyPin() {
  const role = document.getElementById("loginRole").value;
  const pinInputEl = document.getElementById("pinInput");
  const pin = pinInputEl ? pinInputEl.value.trim() : "";
  
  if (role === "admin" && pin === "1985") {
    loginSuccess("admin");
  } else if (role === "kasir" && pin === "1234") {
    loginSuccess("kasir");
  } else {
    showToast("PIN salah untuk akses " + role.toUpperCase());
  }
}

function loginSuccess(role) {
  safeStorage.setItem("arsyIsLoggedIn", "true");
  safeStorage.setItem("arsyUserRole", role);
  currentUserRole = role;
  
  const screen = document.getElementById("loginScreen");
  if(screen) screen.style.display = "none";
  applyRoleRestrictions();
  showToast(`Berhasil masuk sebagai ${role.toUpperCase()}`);
}

function logout() {
  if(confirm("Yakin ingin keluar dari sistem?")) {
    safeStorage.setItem("arsyIsLoggedIn", "false");
    safeStorage.removeItem("arsyUserRole");
    location.reload();
  }
}

function applyRoleRestrictions() {
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(el => {
    el.style.display = (currentUserRole === 'kasir') ? 'none' : '';
  });
  const reportNavBtn = document.querySelector('.nav-button[data-page="reportsPage"]');
  if (reportNavBtn) reportNavBtn.style.display = (currentUserRole === 'kasir') ? 'none' : 'flex';
}

function injectOutletModule() {
  if (!document.getElementById("outletPage")) {
    const div = document.createElement("div");
    div.id = "outletPage";
    div.className = "page";
    div.innerHTML = `
      <div style="padding: 15px; background: white; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border);">
        <button onclick="showPage('akunPage')" style="background:none; border:none; font-size:18px; cursor:pointer;"><i class="fas fa-arrow-left"></i></button>
        <h2 style="font-size: 16px; font-weight: bold; color: var(--text);">Ubah Data Outlet</h2>
      </div>
      <div style="padding: 15px;">
        <form id="outletForm" onsubmit="saveOutletForm(event)">
          <div style="margin-bottom: 12px;"><label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 4px;">Nama Outlet</label><input type="text" id="outletName" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;" required></div>
          <div style="margin-bottom: 12px;"><label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 4px;">No. Handphone</label><input type="text" id="outletPhone" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;" required></div>
          <div style="margin-bottom: 12px;"><label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 4px;">Kota/Kabupaten</label><input type="text" id="outletCity" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;" required></div>
          <div style="margin-bottom: 16px;"><label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 4px;">Alamat</label><textarea id="outletAddress" rows="3" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;" required></textarea></div>
          <button type="submit" class="submit-button" style="background: var(--primary); color: white; width: 100%; padding: 12px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer;">Simpan</button>
        </form>
      </div>
    `;
    document.body.appendChild(div);
  }
}

function loadOutletDataUI() {
  if(document.getElementById("outletName")) document.getElementById("outletName").value = arsyOutlet.name;
  if(document.getElementById("outletPhone")) document.getElementById("outletPhone").value = arsyOutlet.phone;
  if(document.getElementById("outletCity")) document.getElementById("outletCity").value = arsyOutlet.city;
  if(document.getElementById("outletAddress")) document.getElementById("outletAddress").value = arsyOutlet.address;
}

function saveOutletForm(e) {
  e.preventDefault();
  arsyOutlet.name = document.getElementById("outletName").value.trim();
  arsyOutlet.phone = document.getElementById("outletPhone").value.trim();
  arsyOutlet.city = document.getElementById("outletCity").value.trim();
  arsyOutlet.address = document.getElementById("outletAddress").value.trim();
  safeStorage.setItem("arsyOutlet", JSON.stringify(arsyOutlet));
  saveData();
  showToast("Data outlet berhasil disimpan");
  showPage('akunPage');
}

function openOutletPage() { loadOutletDataUI(); showPage('outletPage'); }
function injectCustomerModules() {
  if (!document.getElementById("customerPage")) {
    const div = document.createElement("div"); div.id = "customerPage"; div.className = "page";
    div.innerHTML = `
      <div style="padding: 15px; background: white; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border);">
        <button onclick="showPage('dashboardPage')" style="background:none; border:none; font-size:18px; cursor:pointer;"><i class="fas fa-arrow-left"></i></button>
        <h2 style="font-size: 16px; font-weight: bold; color: var(--text);">Daftar Pelanggan</h2>
      </div>
      <div style="padding: 15px;" id="customersListContainer"></div>
    `;
    document.body.appendChild(div);
  }

  if (!document.getElementById("customerDetailPage")) {
    const div = document.createElement("div"); div.id = "customerDetailPage"; div.className = "page";
    div.innerHTML = `
      <div style="padding: 15px; background: white; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border);">
        <button onclick="showPage('customerPage')" style="background:none; border:none; font-size:18px; cursor:pointer;"><i class="fas fa-arrow-left"></i></button>
        <h2 id="customerDetailTitle" style="font-size: 16px; font-weight: bold; color: var(--text);">Riwayat Pelanggan</h2>
      </div>
      <div style="padding: 15px;" id="customerDetailContent"></div>
    `;
    document.body.appendChild(div);
  }

  if (!document.getElementById("dashboardDetailPage")) {
    const div = document.createElement("div"); div.id = "dashboardDetailPage"; div.className = "page";
    div.innerHTML = `
      <div style="padding: 15px; background: white; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--border);">
        <button onclick="showPage('dashboardPage')" style="background:none; border:none; font-size:18px; cursor:pointer;"><i class="fas fa-arrow-left"></i></button>
        <h2 id="dashDetailTitle" style="font-size: 16px; font-weight: bold; color: var(--text);">Rincian</h2>
      </div>
      <div style="padding: 15px;" id="dashDetailContent"></div>
    `;
    document.body.appendChild(div);
  }
}

function setupCustomerAutocomplete() {
  const input = document.getElementById("customerName");
  if (!input) return;
  let datalist = document.getElementById("customerListOptions");
  if (!datalist) {
    datalist = document.createElement("datalist"); datalist.id = "customerListOptions";
    input.parentNode.appendChild(datalist); input.setAttribute("list", "customerListOptions");
  }
  const namesSet = new Set();
  savedCustomers.forEach(c => { if(c.name) namesSet.add(c.name); });
  transactions.forEach(t => { if(t.customerName) namesSet.add(t.customerName); });
  datalist.innerHTML = Array.from(namesSet).map(name => `<option value="${escapeHTML(name)}">`).join("");
}

function renderCustomers() {
  const container = document.getElementById("customersListContainer");
  if (!container) return;
  const customerMap = new Map();
  savedCustomers.forEach(c => customerMap.set(c.name, { name: c.name, count: 0, totalSpent: 0 }));
  transactions.forEach(t => {
    if (!t.customerName) return;
    if (!customerMap.has(t.customerName)) customerMap.set(t.customerName, { name: t.customerName, count: 0, totalSpent: 0 });
    const data = customerMap.get(t.customerName);
    data.count++;
    if (t.status !== "Batal") data.totalSpent += t.total;
  });
  const customers = Array.from(customerMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'id'));
  if (customers.length === 0) { container.innerHTML = `<div class="empty-state">Belum ada data pelanggan</div>`; return; }
  container.innerHTML = customers.map(c => `
    <div style="background: white; border-radius: 13px; padding: 15px; margin-top: 10px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="openCustomerDetail('${escapeHTML(c.name)}')">
      <div><h3 style="font-size: 15px; font-weight: bold; color: var(--text);">${escapeHTML(c.name)}</h3><p style="font-size: 12px; color: var(--muted); margin-top: 2px;">${c.count} transaksi • Total: ${formatRupiah(c.totalSpent)}</p></div>
      <div style="color: var(--primary); font-size: 13px; font-weight: 500;">Detail &rarr;</div>
    </div>
  `).join("");
}

function openCustomerDetail(name) {
  const titleEl = document.getElementById("customerDetailTitle");
  if (titleEl) titleEl.textContent = `Riwayat: ${name}`;
  const contentEl = document.getElementById("customerDetailContent");
  if (!contentEl) return;
  const custTransactions = transactions.filter(t => t.customerName === name);
  const totalSpent = custTransactions.filter(t => t.status !== "Batal").reduce((sum, t) => sum + t.total, 0);
  contentEl.innerHTML = `
    <div style="background: white; padding: 15px; border-radius: 13px; border: 1px solid var(--border); margin-bottom: 16px;">
      <p style="font-size: 12px; color: var(--muted); font-weight: bold;">NAMA PELANGGAN</p>
      <h3 style="font-size: 18px; font-weight: bold; color: var(--primary); margin-top: 4px;">${escapeHTML(name)}</h3>
      <p style="font-size: 13px; color: var(--text); margin-top: 8px;">Total Transaksi: <b>${custTransactions.length}</b></p>
      <p style="font-size: 13px; color: var(--text); margin-top: 4px;">Total Belanja: <b>${formatRupiah(totalSpent)}</b></p>
    </div>
    <h4 style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: var(--text);">Daftar Transaksi</h4>
    ${custTransactions.length === 0 ? '<div class="empty-state">Belum ada transaksi</div>' : custTransactions.map(transactionHTML).join("")}
    <button type="button" class="submit-button" style="background: #dc2626; color: white; width: 100%; font-weight: bold; margin-top: 20px; border: none; padding: 12px; border-radius: 8px; cursor: pointer;" onclick="deleteCustomer('${escapeHTML(name)}')">Hapus Pelanggan</button>
  `;
  showPage("customerDetailPage");
}

function deleteCustomer(name) {
  if (confirm(`Hapus pelanggan "${name}" beserta seluruh riwayat transaksinya?`)) {
    savedCustomers = savedCustomers.filter(c => c.name !== name);
    transactions = transactions.filter(t => t.customerName !== name);
    saveData(); renderAll(); showPage('customerPage'); showToast("Pelanggan dihapus");
  }
}

function openDashboardDetail(type) {
  const titleEl = document.getElementById("dashDetailTitle");
  const contentEl = document.getElementById("dashDetailContent");
  if (!contentEl) return;
  let filtered = [], titleText = "", summaryHTML = "";
  if (type === 'omset') {
    titleText = "Rincian Omset Hari Ini";
    filtered = transactions.filter(item => item.status !== "Batal" && (item.paymentStatus === "Lunas" || (item.paidAmount && item.paidAmount > 0)) && isToday(item.paymentDate || item.date));
    let totalOmset = filtered.reduce((sum, item) => sum + (item.paymentStatus === "Lunas" ? item.total : (item.paidAmount || 0)), 0);
    summaryHTML = `<div style="background: white; padding: 15px; border-radius: 13px; border: 1px solid var(--border); margin-bottom: 16px;"><p style="font-size: 12px; color: var(--muted); font-weight: bold;">OMSET HARI INI</p><b style="font-size: 18px; color: var(--primary);">${formatRupiah(totalOmset)}</b></div>`;
  } else if (type === 'transaksi') {
    titleText = "Rincian Transaksi Hari Ini";
    filtered = transactions.filter(item => isToday(item.date) && item.status !== "Batal");
    summaryHTML = `<div style="background: white; padding: 15px; border-radius: 13px; border: 1px solid var(--border); margin-bottom: 16px;"><p style="font-size: 12px; color: var(--muted); font-weight: bold;">TOTAL TRANSAKSI HARI INI</p><b style="font-size: 18px; color: var(--primary);">${filtered.length} Transaksi</b></div>`;
  } else if (type === 'pending') {
    titleText = "Rincian Belum Selesai";
    filtered = transactions.filter(item => {
      if (item.status === "Batal") return false;
      const st = item.status ? item.status.toLowerCase().trim() : '';
      return st === "antrian" || st === "pending" || st === "proses" || st === "diproses" || st === "siap diambil" || st === "diambil";
    });
    summaryHTML = `<div style="background: white; padding: 15px; border-radius: 13px; border: 1px solid var(--border); margin-bottom: 16px;"><p style="font-size: 12px; color: var(--muted); font-weight: bold;">BELUM SELESAI</p><b style="font-size: 18px; color: var(--primary);">${filtered.length} Transaksi</b></div>`;
  }
  if (titleEl) titleEl.textContent = titleText;
  contentEl.innerHTML = `${summaryHTML}<h4 style="font-size: 14px; font-weight: bold; margin-bottom: 10px;">Daftar Transaksi</h4>${filtered.length === 0 ? '<div class="empty-state">Kosong</div>' : filtered.map(transactionHTML).join("")}`;
  showPage("dashboardDetailPage");
}

function setupDashboardInteractions() {
  [
    { id: 'todayIncome', handler: () => openDashboardDetail('omset') },
    { id: 'todayTransactions', handler: () => openDashboardDetail('transaksi') },
    { id: 'pendingTransactions', handler: () => openDashboardDetail('pending') },
    { id: 'totalCustomers', handler: () => showPage('customerPage') }
  ].forEach(({ id, handler }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const card = el.parentElement.parentElement.children.length <= 3 ? el.parentElement.parentElement : el.parentElement;
    if (card) { card.style.cursor = 'pointer'; card.onclick = (e) => { e.stopPropagation(); handler(); }; }
  });
  }
function getSortedServiceNames() {
  return Object.keys(servicePrices).sort((a, b) => {
    let pinA = servicePrices[a].pinned ? 1 : 0;
    let pinB = servicePrices[b].pinned ? 1 : 0;
    if (pinA !== pinB) return pinB - pinA;
    return a.localeCompare(b, 'id', { sensitivity: 'base' });
  });
}

function renderServices() {
  const element = document.getElementById("servicesList");
  if(!element) return;
  element.innerHTML = getSortedServiceNames().map(name => {
    const data = servicePrices[name];
    const processStr = data.processes ? data.processes.join(" - ") : "Cuci";
    const pinBadge = data.pinned ? `<span style="font-size: 10px; background: #e1edff; color: var(--primary); padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: bold;">Favorit</span>` : "";
    return `
      <div class="service-item" style="background: white; border-radius: 13px; padding: 15px; margin-top: 10px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="openEditServiceModal('${escapeHTML(name)}')">
        <div class="item-main"><h3 style="font-size: 15px; font-weight: bold; color: var(--text);">${escapeHTML(name)} ${pinBadge}</h3><p style="font-size: 12px; color: var(--muted); margin-top: 2px;">${processStr}</p><small style="color: var(--muted); font-size: 11px;">Min. ${data.minQty || 1} ${data.unit} • ${data.duration || '1 Hari'}</small></div>
        <div class="item-price" style="text-align: right;"><b style="color: var(--primary);">${formatRupiah(data.price)} / ${data.unit}</b><br><span style="font-size: 11px; color: var(--primary);">Ketuk ubah</span></div>
      </div>
    `;
  }).join("");
}

function injectRichServiceModalHTML() {
  const modalEl = document.getElementById("serviceModal");
  if (!modalEl) return;
  modalEl.innerHTML = `
    <div class="modal-content" style="background: white; padding: 20px; border-radius: 16px; width: 90%; max-width: 400px; max-height: 90vh; overflow-y: auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <h3 id="serviceModalTitle" style="font-size:18px; font-weight:bold;">Tambah Layanan</h3>
        <button type="button" onclick="closeServiceModal()" style="background:none; border:none; font-size:22px; cursor:pointer;">&times;</button>
      </div>
      <form id="richServiceForm" onsubmit="saveRichService(event)">
        <input type="hidden" id="editServiceOldName" value="">
        <div style="margin-bottom:12px;"><label style="font-size:13px; font-weight:bold; display:block; margin-bottom:4px;">Nama Layanan</label><input type="text" id="srvName" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;" required></div>
        <div style="margin-bottom:12px;"><label style="font-size:13px; font-weight:bold; display:block; margin-bottom:6px;">Proses</label><div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
          <label style="font-size:13px;"><input type="checkbox" name="srvProcess" value="Cuci"> Cuci</label>
          <label style="font-size:13px;"><input type="checkbox" name="srvProcess" value="Pengeringan"> Pengeringan</label>
          <label style="font-size:13px;"><input type="checkbox" name="srvProcess" value="Setrika"> Setrika</label>
          <label style="font-size:13px;"><input type="checkbox" name="srvProcess" value="Lipat"> Lipat</label>
        </div></div>
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <div style="flex:1;"><label style="font-size:13px; font-weight:bold; display:block; margin-bottom:4px;">Harga (Rp)</label><input type="number" id="srvPrice" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;" required></div>
          <div style="flex:1;"><label style="font-size:13px; font-weight:bold; display:block; margin-bottom:4px;">Satuan</label><select id="srvUnit" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;"><option value="kg">kg</option><option value="pcs">pcs</option><option value="set">set</option><option value="m²">m²</option></select></div>
        </div>
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <div style="flex:1;"><label style="font-size:13px; font-weight:bold; display:block; margin-bottom:4px;">Durasi</label><input type="text" id="srvDuration" value="1 Hari" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;"></div>
          <div style="flex:1;"><label style="font-size:13px; font-weight:bold; display:block; margin-bottom:4px;">Min. Qty</label><input type="number" id="srvMinQty" value="1" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px;"></div>
        </div>
        <div style="margin-bottom: 16px;"><label style="font-size: 13px; display: flex; align-items: center; gap: 8px; font-weight: bold;"><input type="checkbox" id="srvPinned" style="width: 18px; height: 18px;"> Sematkan di Urutan Atas</label></div>
        <div style="display:flex; gap:10px;"><button type="submit" style="flex:2; background:var(--primary); color:white; padding:12px; border-radius:8px; font-weight:bold; border:none; cursor:pointer;">Simpan</button><button type="button" id="btnDeleteService" style="flex:1; background:#dc2626; color:white; padding:12px; border-radius:8px; font-weight:bold; border:none; cursor:pointer; display:none;" onclick="deleteCurrentService()">Hapus</button></div>
      </form>
    </div>
  `;
}

function openServiceModal() {
  const modal = document.getElementById("serviceModal");
  if (!modal) return;
  document.getElementById("serviceModalTitle").textContent = "Tambah Layanan";
  document.getElementById("editServiceOldName").value = "";
  document.getElementById("srvName").value = ""; document.getElementById("srvPrice").value = "";
  document.getElementById("srvDuration").value = "1 Hari"; document.getElementById("srvMinQty").value = "1";
  document.getElementById("srvUnit").value = "kg"; document.getElementById("srvPinned").checked = false;
  document.querySelectorAll("input[name='srvProcess']").forEach(cb => cb.checked = false);
  document.getElementById("btnDeleteService").style.display = "none";
  modal.classList.add("show");
}

function openEditServiceModal(name) {
  const srv = servicePrices[name];
  if (!srv) return;
  const modal = document.getElementById("serviceModal");
  if (!modal) return;
  document.getElementById("serviceModalTitle").textContent = "Ubah Layanan";
  document.getElementById("editServiceOldName").value = name;
  document.getElementById("srvName").value = name; document.getElementById("srvPrice").value = srv.price;
  document.getElementById("srvDuration").value = srv.duration || "1 Hari"; document.getElementById("srvMinQty").value = srv.minQty || 1;
  document.getElementById("srvUnit").value = srv.unit || "kg"; document.getElementById("srvPinned").checked = !!srv.pinned;
  const processes = srv.processes || [];
  document.querySelectorAll("input[name='srvProcess']").forEach(cb => { cb.checked = processes.includes(cb.value); });
  document.getElementById("btnDeleteService").style.display = "block";
  modal.classList.add("show");
}

function closeServiceModal() { const modal = document.getElementById("serviceModal"); if (modal) modal.classList.remove("show"); }

function saveRichService(e) {
  e.preventDefault();
  const oldName = document.getElementById("editServiceOldName").value.trim();
  const newName = document.getElementById("srvName").value.trim();
  const price = Number(document.getElementById("srvPrice").value);
  const unit = document.getElementById("srvUnit").value;
  const duration = document.getElementById("srvDuration").value.trim() || "1 Hari";
  const minQty = Number(document.getElementById("srvMinQty").value) || 1;
  const pinned = document.getElementById("srvPinned").checked;
  const processes = [];
  document.querySelectorAll("input[name='srvProcess']:checked").forEach(cb => processes.push(cb.value));
  if (!newName || isNaN(price)) { showToast("Lengkapi nama & harga"); return; }
  if (oldName && oldName !== newName) delete servicePrices[oldName];
  servicePrices[newName] = { price, unit, processes, duration, minQty, pinned };
  safeStorage.setItem("arsyServices", JSON.stringify(servicePrices));
  saveData(); renderServices(); closeServiceModal(); showToast("Layanan disimpan");
}

function deleteCurrentService() {
  const name = document.getElementById("editServiceOldName").value.trim();
  if (confirm(`Hapus layanan "${name}"?`)) {
    delete servicePrices[name];
    safeStorage.setItem("arsyServices", JSON.stringify(servicePrices));
    saveData(); renderServices(); closeServiceModal(); showToast("Layanan dihapus");
  }
}

function injectTransactionModalHTML() {
  let modal = document.getElementById("transactionModal");
  if (!modal) { modal = document.createElement("div"); modal.id = "transactionModal"; modal.className = "modal"; document.body.appendChild(modal); }
  modal.innerHTML = `
    <div class="modal-content" style="background: white; padding: 20px; border-radius: 16px; width: 90%; max-width: 450px; max-height: 90vh; overflow-y: auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <h3 style="font-size:18px; font-weight:bold;">Transaksi Baru</h3>
        <button type="button" onclick="closeTransactionModal()" style="background:none; border:none; font-size:22px; cursor:pointer;">&times;</button>
      </div>
      <form id="transactionForm">
        <div style="margin-bottom: 12px;"><label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 4px;">Nama Pelanggan</label><input type="text" id="customerName" placeholder="Contoh: Budi" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;" required autocomplete="off"></div>
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;"><label style="font-size: 13px; font-weight: bold;">Layanan Laundry</label><button type="button" onclick="openAddServiceToTransactionModal()" style="background: #e1edff; color: var(--primary); border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer;">+ Tambah Layanan</button></div>
          <div id="transactionItemsContainer" style="border: 1px solid var(--border); border-radius: 8px; padding: 10px; background: #f8fafc; min-height: 70px;"><div style="color: var(--muted); font-size: 13px; text-align: center; padding: 15px;">Belum ada layanan dipilih</div></div>
        </div>
        <div style="margin-bottom: 12px;"><label style="font-size: 13px; font-weight: bold; display: block; margin-bottom: 4px;">Status</label><select id="status" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;"><option value="Antrian">Antrian</option><option value="Proses">Proses</option><option value="Siap Diambil">Siap Diambil</option><option value="Selesai">Selesai</option></select></div>
        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;"><span style="font-weight: bold; font-size: 14px;">Total</span><b id="transactionTotalDisplay" style="color: var(--primary); font-size: 16px;">Rp 0</b></div>
        <button type="submit" class="submit-button" style="background: var(--primary); color: white; width: 100%; padding: 12px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer;">Simpan Transaksi</button>
      </form>
    </div>
  `;

  if (!document.getElementById("addServiceSelectModal")) {
    let subModal = document.createElement("div"); subModal.id = "addServiceSelectModal"; subModal.className = "modal";
    subModal.innerHTML = `
      <div class="modal-content" style="background: white; padding: 20px; border-radius: 16px; width: 90%; max-width: 350px; max-height: 80vh; display: flex; flex-direction: column;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"><h3 style="font-size:16px; font-weight:bold;">Pilih Layanan</h3><button type="button" onclick="closeAddServiceSelectModal()" style="background:none; border:none; font-size:20px; cursor:pointer;">&times;</button></div>
        <input type="text" id="serviceSearchInputModal" placeholder="Cari layanan..." style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 12px; outline: none;" onkeyup="filterServiceSelectionList()">
        <div id="serviceSelectionList" style="overflow-y: auto; flex: 1;"></div>
      </div>
    `;
    document.body.appendChild(subModal);
  }
}

function openAddServiceToTransactionModal() {
  const modal = document.getElementById("addServiceSelectModal");
  const input = document.getElementById("serviceSearchInputModal");
  if(input) input.value = "";
  modal.dataset.target = "new";
  filterServiceSelectionList();
  modal.classList.add("show");
}

function closeAddServiceSelectModal() { document.getElementById("addServiceSelectModal").classList.remove("show"); }

function filterServiceSelectionList() {
  const input = document.getElementById("serviceSearchInputModal");
  const container = document.getElementById("serviceSelectionList");
  if (!input || !container) return;
  const query = input.value.toLowerCase().trim();
  const sortedNames = getSortedServiceNames().filter(name => name.toLowerCase().includes(query));
  if (sortedNames.length === 0) { container.innerHTML = `<div style="text-align: center; padding: 15px; color: var(--muted); font-size: 13px;">Tidak ditemukan</div>`; return; }
  const isExisting = document.getElementById("addServiceSelectModal").dataset.target === "existing";
  container.innerHTML = sortedNames.map(name => {
    const srv = servicePrices[name];
    const onClickAction = isExisting ? `addServiceToExistingTransactionConfirm('${escapeHTML(name)}')` : `addServiceToCurrentTransaction('${escapeHTML(name)}')`;
    return `
      <div onclick="${onClickAction}" style="padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <div><b style="font-size: 14px;">${escapeHTML(name)}</b><div style="font-size: 12px; color: var(--muted);">${formatRupiah(srv.price)} / ${srv.unit}</div></div>
        <span style="color: var(--primary); font-size: 13px; font-weight: bold;">+ Pilih</span>
      </div>
    `;
  }).join("");
}

function addServiceToCurrentTransaction(serviceName) {
  const srv = servicePrices[serviceName];
  if (!srv) return;
  activeNewTransactionItems.push({ serviceType: serviceName, weight: srv.minQty || 1, total: (srv.minQty || 1) * srv.price });
  closeAddServiceSelectModal(); renderActiveTransactionItems();
}

function removeActiveTransactionItem(index) { activeNewTransactionItems.splice(index, 1); renderActiveTransactionItems(); }

function updateActiveItemWeight(index, val) {
  let w = parseFloat(val.replace(',', '.')) || 0;
  activeNewTransactionItems[index].weight = w;
  const srv = servicePrices[activeNewTransactionItems[index].serviceType];
  activeNewTransactionItems[index].total = Math.round(w * (srv ? srv.price : 0));
  renderActiveTransactionItems(false);
}

function renderActiveTransactionItems() {
  const container = document.getElementById("transactionItemsContainer");
  const totalDisplay = document.getElementById("transactionTotalDisplay");
  if (!container) return;
  if (activeNewTransactionItems.length === 0) {
    container.innerHTML = `<div style="color: var(--muted); font-size: 13px; text-align: center; padding: 15px;">Belum ada layanan dipilih</div>`;
    if (totalDisplay) totalDisplay.textContent = formatRupiah(0);
    return;
  }
  let grandTotal = 0;
  container.innerHTML = activeNewTransactionItems.map((item, idx) => {
    grandTotal += item.total;
    const srv = servicePrices[item.serviceType];
    return `
      <div style="background: white; border: 1px solid var(--border); border-radius: 8px; padding: 10px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;"><b style="font-size: 13px; color: var(--primary);">${escapeHTML(item.serviceType)}</b><button type="button" onclick="removeActiveTransactionItem(${idx})" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 12px;">Hapus</button></div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 6px;"><input type="number" step="any" value="${item.weight}" oninput="updateActiveItemWeight(${idx}, this.value)" style="width: 70px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 6px;"><span style="font-size: 12px; color: var(--muted);">${srv ? srv.unit : 'kg'}</span></div>
          <b style="font-size: 13px;">${formatRupiah(item.total)}</b>
        </div>
      </div>
    `;
  }).join("");
  if (totalDisplay) totalDisplay.textContent = formatRupiah(grandTotal);
}

function openTransactionModal() {
  activeNewTransactionItems = []; setupCustomerAutocomplete(); renderActiveTransactionItems();
  const modal = document.getElementById("transactionModal"); if (modal) modal.classList.add("show");
}

function closeTransactionModal() { const modal = document.getElementById("transactionModal"); if (modal) modal.classList.remove("show"); }
function transactionHTML(item) {
  const statusClass = item.status ? item.status.toLowerCase().replace(/\s+/g, '-') : 'pending';
  const paymentStatus = item.paymentStatus || 'Belum Lunas';
  const isLunas = paymentStatus === 'Lunas';
  const isDP = paymentStatus === 'DP';
  const payBadgeText = isDP ? `DP (${formatRupiah(item.paidAmount || 0)})` : paymentStatus;
  
  return `
    <div class="transaction-item" onclick="openTransactionDetail(${item.id})" style="cursor: pointer; background: white; margin-top: 10px; border-radius: 13px; padding: 15px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
      <div class="item-main"><h3 style="font-size: 15px; color: var(--primary);">TRX/${item.id}</h3><p style="font-weight: bold; color: var(--text); margin-top: 2px;">${escapeHTML(item.customerName)}</p><span class="status status-${statusClass}" style="margin-top: 6px; display: inline-block;">${item.status}</span></div>
      <div class="item-price" style="text-align: right;">${formatRupiah(item.total)}<br><span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${isLunas ? '#dcfce7' : (isDP ? '#fef9c3' : '#fee2e2')}; color: ${isLunas ? '#16a34a' : (isDP ? '#ca8a04' : '#dc2626')}; font-weight: bold; display: inline-block; margin-top: 4px;">${payBadgeText}</span><br><small style="color: var(--muted); font-size: 11px;">${formatDate(item.date)}</small></div>
    </div>
  `;
}

function renderRecentTransactions() {
  const element = document.getElementById("recentTransactions"); if(!element) return;
  const recent = transactions.slice(0, 5);
  element.innerHTML = recent.length === 0 ? `<div class="empty-state">Belum ada transaksi</div>` : recent.map(transactionHTML).join("");
}

function renderAllTransactions() {
  const element = document.getElementById("allTransactions"); if (!element) return;
  let filtered = transactions;
  if (currentTransactionFilter && currentTransactionFilter !== 'Semua') {
    const filterTarget = currentTransactionFilter.toLowerCase().trim();
    filtered = filtered.filter(item => {
      const itemStatus = item.status ? item.status.toLowerCase().trim() : '';
      if (filterTarget === 'antrian') return itemStatus.includes('antrian') || itemStatus.includes('pending');
      if (filterTarget === 'proses') return itemStatus.includes('proses');
      if (filterTarget === 'siap diambil') return itemStatus.includes('siap') || itemStatus.includes('diambil');
      if (filterTarget === 'selesai') return itemStatus.includes('selesai') || itemStatus.includes('lunas');
      if (filterTarget === 'batal') return itemStatus.includes('batal');
      return itemStatus === filterTarget;
    });
  }
  const searchInput = document.getElementById("transactionSearchInput");
  if (searchInput && searchInput.value) {
    const query = searchInput.value.toLowerCase().trim();
    filtered = filtered.filter(item => item.customerName && item.customerName.toLowerCase().includes(query));
  }
  element.innerHTML = filtered.length === 0 ? `<div class="empty-state">Belum ada transaksi</div>` : filtered.map(transactionHTML).join("");
}

function getTransactionItems(item) {
  if (item.items && Array.isArray(item.items) && item.items.length > 0) return item.items;
  return [{ serviceType: item.serviceType || "Cuci Kering", weight: item.weight || 1, total: item.total || 0 }];
}

function openTransactionDetail(id) {
  activeTransactionId = id;
  const item = transactions.find(t => t.id === id); if (!item) return;
  const container = document.getElementById("detailContent");
  const isLunas = item.paymentStatus === "Lunas";
  const isDP = item.paymentStatus === "DP";
  const isBatal = item.status === "Batal";
  const remaining = item.total - (item.paidAmount || 0);
  const hideNextButton = (isBatal || item.status === "Selesai") ? "display: none;" : "";

  let transactionItems = getTransactionItems(item);
  let itemsHTML = transactionItems.map((it, idx) => {
    const unitPrice = it.weight ? (it.total / it.weight) : it.total;
    const srv = servicePrices[it.serviceType] || { unit: 'kg' };
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border);">
        <div><strong>${escapeHTML(it.serviceType)}</strong><p style="font-size: 12px; color: var(--muted);">${it.weight} ${srv.unit} x ${formatRupiah(unitPrice)} : <b>${formatRupiah(it.total)}</b></p></div>
        <button type="button" onclick="deleteTransactionItem(${item.id}, ${idx})" style="background: #fee2e2; color: #dc2626; border: none; width: 32px; height: 32px; border-radius: 6px; cursor: pointer;">✕</button>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="report-card" style="margin-bottom: 16px;">
      <p><b>No. Transaksi:</b> TRX/${item.id}</p>
      <p><b>Status:</b> <span class="report-status ${item.status.toLowerCase().replace(/\s+/g, '-')}">${item.status}</span></p>
      <p><b>Kasir:</b> ${currentUserRole === 'admin' ? 'Admin' : 'Kasir'}</p>
    </div>
    <div class="report-card" style="margin-bottom: 16px;">
      <p class="report-label">PELANGGAN</p><strong style="font-size: 16px; color: var(--primary);">${escapeHTML(item.customerName)}</strong>
    </div>
    <div class="report-card" style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><p class="report-label" style="margin: 0;">LAYANAN</p></div>
      ${itemsHTML}
    </div>
    <button type="button" class="submit-button" style="margin-bottom: 12px; background: #1769e0; ${hideNextButton}" onclick="proceedNextStatus(${item.id})">Proses Status Selanjutnya</button>
    <div class="report-card" style="margin-bottom: 16px;">
      <p class="report-label">PEMBAYARAN</p>
      <div style="display: flex; justify-content: space-between; margin: 6px 0;"><span>Total</span><b>${formatRupiah(item.total)}</b></div>
      <div style="display: flex; justify-content: space-between; margin: 6px 0;"><span>Status</span><span>${item.paymentStatus || 'Belum Lunas'}</span></div>
    </div>
    <button type="button" class="submit-button" style="background: #16a34a; margin-bottom: 12px;" onclick="openPaymentModal(${item.id})">Bayar</button>
    <button type="button" class="submit-button" style="background: #25d366; color: white; width: 100%; font-weight: bold;" onclick="sendWhatsAppReceipt(${item.id})">Kirim Nota WhatsApp</button>
  `;
  showPage("transactionDetailPage");
}

function proceedNextStatus(id) {
  const item = transactions.find(t => t.id === id); if (!item) return;
  const st = item.status ? item.status.toLowerCase().trim() : '';
  if (st === "antrian") item.status = "Proses";
  else if (st === "proses") item.status = "Siap Diambil";
  else if (st.includes("siap")) item.status = "Selesai";
  saveData(); renderAll(); openTransactionDetail(id); showToast("Status diperbarui");
}

function deleteTransactionItem(txId, itemIdx) {
  const tx = transactions.find(t => t.id === txId); if (!tx) return;
  const items = getTransactionItems(tx);
  if (items.length <= 1) { showToast("Minimal harus ada 1 layanan"); return; }
  if (confirm("Hapus layanan ini?")) {
    items.splice(itemIdx, 1); tx.total = items.reduce((s, i) => s + i.total, 0);
    saveData(); renderAll(); openTransactionDetail(txId); showToast("Layanan dihapus");
  }
}

function generateWhatsAppReceiptText(item) {
  let text = `*${arsyOutlet.name}*\n${arsyOutlet.address}\n\n*Pelanggan: ${item.customerName}*\nNo: TRX/${item.id}\nWaktu: ${formatDate(item.date)}\n--------------------------------\n`;
  getTransactionItems(item).forEach(it => { text += `${it.serviceType} (${it.weight}) : ${formatRupiah(it.total)}\n`; });
  text += `--------------------------------\n*Total: ${formatRupiah(item.total)}*\nStatus: ${item.paymentStatus}\n\n_Terima Kasih_`;
  return text;
}

function sendWhatsAppReceipt(id) {
  const item = transactions.find(t => t.id === id); if (!item) return;
  window.open(`intent://send?text=${encodeURIComponent(generateWhatsAppReceiptText(item))}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end`, '_top');
      }
function injectPaymentModalHTML() {
  let modalEl = document.getElementById("paymentModal");
  if (!modalEl) { modalEl = document.createElement("div"); modalEl.id = "paymentModal"; modalEl.className = "modal"; document.body.appendChild(modalEl); }
  modalEl.innerHTML = `
    <div class="modal-content" style="background: white; padding: 20px; border-radius: 16px; width: 90%; max-width: 400px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;"><h3 style="font-size:18px; font-weight:bold;">Pembayaran</h3><button type="button" onclick="closePaymentModal()" style="background:none; border:none; font-size:22px; cursor:pointer;">&times;</button></div>
      <form id="paymentForm">
        <div style="margin-bottom: 12px;"><label style="font-size: 13px;">Status Pembayaran</label><select id="payStatusSelect" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;"><option value="Lunas">Lunas</option><option value="DP">DP</option></select></div>
        <div style="margin-bottom: 12px;"><label style="font-size: 13px;">Metode</label><select id="payMethodSelect" style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 8px;"><option value="Tunai">Tunai</option><option value="Transfer">Transfer</option><option value="QRIS">QRIS</option></select></div>
        <button type="submit" class="submit-button" style="background: var(--success); color: white; width: 100%; padding: 12px; border-radius: 8px; font-weight: bold; border: none;">Simpan Pembayaran</button>
      </form>
    </div>
  `;
}

function openPaymentModal(id) { activeTransactionId = id; document.getElementById("paymentModal").classList.add("show"); }
function closePaymentModal() { document.getElementById("paymentModal").classList.remove("show"); }

document.addEventListener("DOMContentLoaded", function () {
  const payForm = document.getElementById("paymentForm");
  if (payForm) {
    payForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const item = transactions.find(t => t.id === activeTransactionId);
      if (item) {
        item.paymentStatus = document.getElementById("payStatusSelect").value;
        item.paymentMethod = document.getElementById("payMethodSelect").value;
        if (item.paymentStatus === "Lunas") { item.paidAmount = item.total; item.paymentDate = new Date().toISOString(); }
        saveData(); renderAll(); closePaymentModal(); openTransactionDetail(activeTransactionId); showToast("Pembayaran disimpan");
      }
    });
  }
});

// --- KEUANGAN SISI TITI ---
function injectKeuanganPageHTML() {
  if(document.getElementById("keuanganPage")) return;
  const sec = document.createElement("section"); sec.id = "keuanganPage"; sec.className = "page report-page admin-only";
  sec.innerHTML = `
    <div class="report-header" style="display:flex; align-items:center; gap:15px; padding:20px; background:white; border-bottom:1px solid var(--border);">
      <button class="report-back" onclick="showPage('dashboardPage')" style="font-size:24px; background:none; border:none; cursor:pointer;">‹</button>
      <div><h1 style="font-size:18px; margin:0; font-weight:bold;">Keuangan Sisi Titi</h1><p style="margin:0; font-size:12px; color:var(--muted);">Laba Bersih & Pengeluaran</p></div>
    </div>
    <div class="report-content" style="padding:20px; background:#f4f7fb; min-height:100vh;">
      <div style="background:#e0f2fe; border:1px solid #7dd3fc; padding:20px; border-radius:16px; text-align:center; margin-bottom:15px;">
        <span style="font-size:12px; color:#0369a1; display:block; margin-bottom:8px; font-weight:bold;">LABA BERSIH (Omset - Biaya Laundry)</span>
        <strong id="labaBersihLengkap" style="font-size:28px; color:#0369a1;">Rp 0</strong>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px;">
        <div style="background:#dcfce7; padding:15px; border-radius:16px;"><span style="font-size:11px; font-weight:bold;">Total Omset</span><strong id="omsetLaundryTotal" style="font-size:16px; color:#15803d;">Rp 0</strong></div>
        <div style="background:#fee2e2; padding:15px; border-radius:16px;"><span style="font-size:11px; font-weight:bold;">Total Pengeluaran</span><strong id="pengeluaranTotal" style="color:#dc2626; font-size:16px;">Rp 0</strong></div>
      </div>
      <h2 style="font-size:16px; margin-bottom:12px; font-weight:bold;">Catat Pengeluaran</h2>
      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:24px;">
        <button onclick="openInputPengeluaran('HARIAN')" style="display:flex; justify-content:space-between; padding:16px; background:white; border:1px solid var(--border); border-radius:12px; cursor:pointer;"><span>📆 Harian</span><span id="subTotalHarian">Rp 0</span></button>
        <button onclick="openInputPengeluaran('LAUNDRY')" style="display:flex; justify-content:space-between; padding:16px; background:white; border:1px solid var(--border); border-radius:12px; cursor:pointer;"><span>🧺 Biaya Laundry</span><span id="subTotalLaundry">Rp 0</span></button>
        <button onclick="openInputPengeluaran('LAIN-LAIN')" style="display:flex; justify-content:space-between; padding:16px; background:white; border:1px solid var(--border); border-radius:12px; cursor:pointer;"><span>📚 Lain-lain</span><span id="subTotalLain">Rp 0</span></button>
        <button onclick="openInputPengeluaran('TABUNGAN')" style="display:flex; justify-content:space-between; padding:16px; background:white; border:1px solid var(--border); border-radius:12px; cursor:pointer;"><span>📔 Tabungan</span><span id="subTotalTabungan">Rp 0</span></button>
      </div>
      <h2 style="font-size:16px; margin-bottom:12px; font-weight:bold;">Riwayat Pengeluaran</h2>
      <div style="background:white; border:1px solid var(--border); border-radius:16px; overflow:hidden;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
          <tbody id="tabelPengeluaranBody"></tbody>
        </table>
      </div>
    </div>
  `;
  document.body.appendChild(sec);

  const modal = document.createElement("div"); modal.id = "modalPengeluaranFinance"; modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content" style="background: white; padding: 24px; border-radius: 20px; width: 90%; max-width: 360px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h3 id="judulModalPengeluaran" style="font-size:18px; font-weight:bold;">Catat Pengeluaran</h3><button type="button" onclick="closeModalPengeluaran()" style="background:none; border:none; font-size:24px; cursor:pointer;">&times;</button></div>
      <form id="formPengeluaranFinance" onsubmit="savePengeluaran(event)">
        <input type="hidden" id="kategoriPengeluaran">
        <div style="margin-bottom:16px;"><label style="font-size:13px; font-weight:bold; display:block; margin-bottom:6px;">Keterangan</label><input type="text" id="descPengeluaran" style="width:100%; padding:12px; border:1px solid var(--border); border-radius:10px;" required></div>
        <div style="margin-bottom:24px;"><label style="font-size:13px; font-weight:bold; display:block; margin-bottom:6px;">Nominal (Rp)</label><input type="number" id="nominalPengeluaran" style="width:100%; padding:12px; border:1px solid var(--border); border-radius:10px;" required></div>
        <button type="submit" style="width:100%; background:var(--primary); color:white; padding:14px; border-radius:10px; font-weight:bold; border:none; cursor:pointer;">Simpan</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
}

function openInputPengeluaran(kat) {
  document.getElementById("kategoriPengeluaran").value = kat;
  document.getElementById("judulModalPengeluaran").textContent = `Catat: ${kat}`;
  document.getElementById("descPengeluaran").value = ""; document.getElementById("nominalPengeluaran").value = "";
  document.getElementById("modalPengeluaranFinance").classList.add("show");
}
function closeModalPengeluaran() { document.getElementById("modalPengeluaranFinance").classList.remove("show"); }

function savePengeluaran(e) {
  e.preventDefault();
  const kat = document.getElementById("kategoriPengeluaran").value;
  const desc = document.getElementById("descPengeluaran").value;
  const nom = parseFloat(document.getElementById("nominalPengeluaran").value) || 0;
  expensesData.push({ id: Date.now(), date: new Date().toISOString(), category: kat, desc, amount: nom });
  safeStorage.setItem("arsyExpenses", JSON.stringify(expensesData));
  closeModalPengeluaran(); hitungKeuanganLengkap(); showToast("Pengeluaran disimpan");
}

function hapusPengeluaran(id) {
  if(confirm("Hapus catatan ini?")) {
    expensesData = expensesData.filter(e => e.id !== id);
    safeStorage.setItem("arsyExpenses", JSON.stringify(expensesData));
    hitungKeuanganLengkap();
  }
}

function hitungKeuanganLengkap() {
  if(currentUserRole === 'kasir') return;
  let totalOmset = transactions.filter(item => item.status !== "Batal" && (item.paymentStatus === "Lunas" || (item.paidAmount && item.paidAmount > 0))).reduce((sum, item) => sum + (item.paymentStatus === "Lunas" ? item.total : (item.paidAmount || 0)), 0);
  let totalKeluar = 0, totalLaundrySaja = 0;
  ['HARIAN', 'LAUNDRY', 'LAIN-LAIN', 'TABUNGAN'].forEach(kat => {
    let sumCat = expensesData.filter(e => e.category === kat).reduce((a, b) => a + b.amount, 0);
    let idEl = (kat === 'LAIN-LAIN') ? 'subTotalLain' : `subTotal${kat.charAt(0) + kat.slice(1).toLowerCase()}`;
    let el = document.getElementById(idEl);
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
      <tr><td style="padding:12px; border-bottom:1px solid var(--border);"><strong>${e.category}</strong><br><small>${formatDate(e.date).split(' ')[0]} - ${escapeHTML(e.desc)}</small></td><td style="padding:12px; border-bottom:1px solid var(--border); text-align:right;"><strong style="color:#dc2626;">${formatRupiah(e.amount)}</strong><br><button onclick="hapusPengeluaran(${e.id})" style="background:none; border:none; color:var(--muted); font-size:11px; cursor:pointer;">Hapus</button></td></tr>
    `).join("");
  }
}

// --- INISIALISASI UTAMA ---
function updateDashboard() {
  transactions = Array.from(new Map(transactions.map(t => [t.id, t])).values());
  const todayData = transactions.filter(item => isToday(item.date) && item.status !== "Batal");
  const todayValidIncome = transactions.filter(item => item.status !== "Batal" && (item.paymentStatus === "Lunas" || (item.paidAmount && item.paidAmount > 0)) && isToday(item.paymentDate || item.date)).reduce((sum, item) => sum + (item.paymentStatus === "Lunas" ? item.total : (item.paidAmount || 0)), 0);
  const pending = transactions.filter(item => {
    if (item.status === "Batal") return false;
    const st = item.status ? item.status.toLowerCase().trim() : '';
    return st === "antrian" || st === "proses" || st === "siap diambil";
  }).length;
  const customerMap = new Map(); transactions.forEach(t => customerMap.set(t.customerName, true));
  
  if(document.getElementById("todayIncome")) document.getElementById("todayIncome").textContent = formatRupiah(todayValidIncome);
  if(document.getElementById("todayTransactions")) document.getElementById("todayTransactions").textContent = todayData.length;
  if(document.getElementById("pendingTransactions")) document.getElementById("pendingTransactions").textContent = pending;
  if(document.getElementById("totalCustomers")) document.getElementById("totalCustomers").textContent = customerMap.size;
  setupDashboardInteractions();
}

function renderAll() {
  updateDashboard(); renderRecentTransactions(); renderAllTransactions();
  renderCustomers(); renderServices(); setupCustomerAutocomplete(); hitungKeuanganLengkap();
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

async function saveData() {
  transactions = Array.from(new Map(transactions.map(t => [t.id, t])).values());
  safeStorage.setItem("arsyTransactions", JSON.stringify(transactions));
}

document.addEventListener("DOMContentLoaded", function () {
  injectLoginModal(); injectCustomerModules(); injectOutletModule();
  injectRichServiceModalHTML(); injectPaymentModalHTML(); injectTransactionModalHTML();
  
  renderAll();
  
  setTimeout(() => {
    injectKeuanganPageHTML();
    const cards = document.querySelectorAll(".welcome-card");
    cards.forEach(c => {
      if(c.textContent.includes("Keuangan") || c.textContent.includes("Laba") || c.textContent.includes("Pengeluaran")) {
        c.classList.add("admin-only"); c.style.cursor = "pointer";
        c.onclick = function(e) { e.preventDefault(); showPage('keuanganPage'); };
      }
    });
    const akunPage = document.getElementById("akunPage");
    if(akunPage && !akunPage.innerHTML.includes("logout()")) {
       const div = document.createElement("div"); div.style.padding = "15px";
       div.innerHTML = `<button onclick="logout()" class="submit-button" style="background:#fee2e2; color:#dc2626; width:100%; padding:12px; border-radius:10px; font-weight:bold; border:none; cursor:pointer;">Keluar (Logout)</button>`;
       akunPage.appendChild(div);
    }
    applyRoleRestrictions();
  }, 500);
});
                                                       
