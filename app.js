const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGhQ-tJytCoEQGz2whhSP8ML2L632IYVy9y2Jeb0117SgDCv-rYy1-uzWxFFJpMjbctA/exec";

let appData = {
  transactions: [], finances: [], notes: [],
  users: [{ id: 1, name: "Pemilik", username: "admin", password: "123", role: "Admin" }],
  outlet: { name: "", address: "", phone: "" },
  calcDocs: [{ id: 1, title: 'Perhitungan(1)', rows: [] }],
  services: {
    "Cuci Kering": { price: 5000, unit: "kg" },
    "Cuci Setrika": { price: 10000, unit: "kg" },
    "Bed Cover": { price: 25000, unit: "pcs" }
  }
};

let currentUser = null;
let activeNewTransactionItems = [];
let calcInput = "0"; let calcActiveOp = "+";

document.addEventListener("DOMContentLoaded", () => {
  const savedData = localStorage.getItem("appDataTerpadu");
  if (savedData) { try { appData = JSON.parse(savedData); } catch(e){} }
  const savedSession = localStorage.getItem("activeSession");
  if (savedSession) { try { currentUser = JSON.parse(savedSession); } catch(e){} }

  if (currentUser) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainApp").style.display = "block";
    initApp();
  } else { refreshOutletUI(); }
});

function initApp() {
  refreshOutletUI(); updateUIDasar(); renderDashboardLaundry();
  calculateFinance(); renderNotesList(); renderKaryawanList(); renderServices();
  loadCalcDoc(); syncFromCloud();
  
  const now = new Date();
  document.getElementById("homeMonthFilter").value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  
  // Setup Dropdown Form Transaksi
  const srvSelect = document.getElementById("trxServiceSelect");
  if(srvSelect) {
    srvSelect.innerHTML = Object.keys(appData.services).map(s => `<option value="${s}">${s} - Rp${appData.services[s].price}/${appData.services[s].unit}</option>`).join("");
  }
}
async function syncFromCloud() {
  try {
    const res = await fetch(WEB_APP_URL);
    const data = await res.json();
    if (data && data.users) {
      appData = data; if(!appData.services) appData.services = {};
      localStorage.setItem("appDataTerpadu", JSON.stringify(appData));
      initApp(); // Refresh all UI
    }
  } catch (err) { console.log("Offline mode."); }
}

async function saveToCloud() {
  localStorage.setItem("appDataTerpadu", JSON.stringify(appData));
  document.getElementById("loadingModal").style.display = "flex";
  try {
    await fetch(WEB_APP_URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(JSON.stringify(appData))
    });
    document.getElementById("loadingModal").style.display = "none";
  } catch (err) {
    document.getElementById("loadingModal").style.display = "none";
    showToast("Tersimpan secara lokal (Offline)");
  }
}

function prosesLogin() {
  const userIn = document.getElementById("loginUsername").value.trim();
  const passIn = document.getElementById("loginPassword").value;
  const user = appData.users.find(u => u.username === userIn && u.password === passIn);
  if (user) {
    currentUser = user; localStorage.setItem("activeSession", JSON.stringify(user));
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainApp").style.display = "block";
    showToast(`Halo, ${user.name}!`); initApp();
  } else { showToast("Username/Password salah!"); }
}

function prosesLogout() { if(confirm("Keluar dari aplikasi?")) { localStorage.removeItem("activeSession"); location.reload(); } }

function updateUIDasar() {
  document.querySelectorAll(".admin-only").forEach(el => el.style.display = (currentUser && currentUser.role === "Admin") ? "flex" : "none");
  if (currentUser) {
    let ini = currentUser.name.charAt(0).toUpperCase();
    document.getElementById("headerProfileIcon").textContent = ini;
    document.getElementById("bigProfileIcon").textContent = ini;
  }
}

function showPage(pageId) {
  if (currentUser && currentUser.role !== "Admin" && (pageId === "financePage" || pageId === "financeReportPage" || pageId === "reportsPage")) {
    return showToast("Khusus Admin.");
  }
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
  document.querySelectorAll(".nav-button[data-page]").forEach(btn => {
    btn.classList.remove("active"); if (btn.dataset.page === pageId) btn.classList.add("active");
  });
  window.scrollTo(0, 0);
  if(pageId === 'dashboardPage') renderDashboardLaundry();
  if(pageId === 'transactionsPage') renderAllTransactions();
}
function formatRupiah(num) { return "Rp " + Number(num).toLocaleString("id-ID"); }
function showToast(msg) { let t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 3000); }

/* DASHBOARD */
function renderDashboardLaundry() {
  const today = new Date().toISOString().split('T')[0];
  let income = 0, trx = 0, pending = 0;
  appData.transactions.forEach(t => {
    if (t.date.startsWith(today) && t.status !== 'Batal') trx++;
    if (t.status === 'Selesai' && t.date.startsWith(today)) income += Number(t.total);
    if (t.status !== 'Selesai' && t.status !== 'Batal') pending++;
  });
  document.getElementById("todayIncome").textContent = formatRupiah(income);
  document.getElementById("todayTransactions").textContent = trx;
  document.getElementById("pendingTransactions").textContent = pending;
  document.getElementById("totalCustomers").textContent = new Set(appData.transactions.map(t => t.customerName.toLowerCase())).size;
}

/* LAYANAN (DENGAN FORM ASLI) */
function renderServices() {
  const c = document.getElementById("servicesList"); if (!c) return;
  const keys = Object.keys(appData.services);
  if (keys.length === 0) { c.innerHTML = `<p style="text-align:center; color:#888;">Belum ada layanan</p>`; return; }
  c.innerHTML = keys.map(k => {
    let s = appData.services[k];
    return `<div style="background:#fff; border:1px solid #ddd; padding:12px; border-radius:10px; margin-bottom:8px; display:flex; justify-content:space-between;">
      <div><b>${k}</b><p style="font-size:0.8rem; color:#666;">${formatRupiah(s.price)} / ${s.unit}</p></div>
      <button class="btn-danger-small" onclick="hapusLayanan('${k}')">Hapus</button>
    </div>`;
  }).join("");
}
function openServiceModal() { document.getElementById("addServiceModal").style.display = "flex"; }
function closeAddServiceModal() { document.getElementById("addServiceModal").style.display = "none"; document.getElementById("addServiceForm").reset(); }
function saveNewService(e) {
  e.preventDefault();
  const name = document.getElementById("newSrvName").value;
  appData.services[name] = { price: Number(document.getElementById("newSrvPrice").value), unit: document.getElementById("newSrvUnit").value };
  saveToCloud(); closeAddServiceModal(); renderServices(); showToast("Layanan disimpan");
  initApp(); // Refresh dropdown
}
function hapusLayanan(name) { if(confirm("Hapus "+name+"?")) { delete appData.services[name]; saveToCloud(); renderServices(); initApp(); } }
/* TRANSAKSI BARU (FORM PENUH) */
function openTransactionModal() {
  activeNewTransactionItems = [];
  document.getElementById("fullTransactionForm").reset();
  renderActiveTransactionItems();
  document.getElementById("transactionModalFull").style.display = "flex";
}
function closeFullTransactionModal() { document.getElementById("transactionModalFull").style.display = "none"; }

function addServiceToCart() {
  let srvName = document.getElementById("trxServiceSelect").value;
  let qty = parseFloat(document.getElementById("trxServiceQty").value) || 1;
  if(!srvName) return showToast("Buat layanan dulu di menu Layanan!");
  
  let srv = appData.services[srvName];
  activeNewTransactionItems.push({ name: srvName, qty: qty, price: srv.price, total: srv.price * qty, unit: srv.unit });
  renderActiveTransactionItems();
}

function renderActiveTransactionItems() {
  const c = document.getElementById("trxItemsContainer");
  let grand = 0;
  if(activeNewTransactionItems.length === 0) { c.innerHTML = "<small color='#888'>Belum ada cucian ditambahkan.</small>"; } 
  else {
    c.innerHTML = activeNewTransactionItems.map((it, i) => {
      grand += it.total;
      return `<div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.85rem; border-bottom:1px dashed #ccc; padding-bottom:5px;">
        <span><b>${it.name}</b> (${it.qty} ${it.unit})</span>
        <span>${formatRupiah(it.total)} <span style="color:red; margin-left:5px; cursor:pointer;" onclick="activeNewTransactionItems.splice(${i},1);renderActiveTransactionItems();">✕</span></span>
      </div>`;
    }).join("");
  }
  document.getElementById("trxGrandTotalDisplay").textContent = formatRupiah(grand);
}

function saveFullTransaction(e) {
  e.preventDefault();
  const cust = document.getElementById("trxCustomerName").value;
  if(activeNewTransactionItems.length === 0) return showToast("Tambahkan minimal 1 layanan!");
  
  const newTrx = {
    id: Date.now(), date: new Date().toISOString(), customerName: cust,
    items: [...activeNewTransactionItems],
    total: activeNewTransactionItems.reduce((sum, it) => sum + it.total, 0),
    paymentStatus: document.getElementById("trxPaymentStatus").value,
    status: "Antrian", cashier: currentUser.name
  };
  
  appData.transactions.unshift(newTrx);
  saveToCloud(); closeFullTransactionModal(); renderDashboardLaundry(); renderAllTransactions(); calculateFinance();
  showToast("Transaksi Berhasil Dibuat!");
}
/* DAFTAR TRANSAKSI & UBAH STATUS (SEPERTI ARSY LAUNDRY) */
let currentTrxFilter = 'Antrian';
function filterTransactionsTab(status, btn) {
  currentTrxFilter = status;
  document.querySelectorAll('.trans-tab').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  renderAllTransactions();
}

function renderAllTransactions() {
  const c = document.getElementById("allTransactions"); if(!c) return;
  const q = document.getElementById("transactionSearchInput").value.toLowerCase();
  
  let filtered = appData.transactions.filter(t => {
    let matchStatus = false;
    if(currentTrxFilter === 'Antrian' && (t.status === 'Antrian' || t.status === 'Batal')) matchStatus = true;
    else if (t.status === currentTrxFilter) matchStatus = true;
    return matchStatus && t.customerName.toLowerCase().includes(q);
  });

  if(filtered.length === 0) { c.innerHTML = `<p style="text-align:center; color:#888; padding:20px;">Kosong</p>`; return; }

  c.innerHTML = filtered.map(t => {
    let payBadge = t.paymentStatus === 'Lunas' ? 'badge-lunas' : 'badge-belum';
    let statBadge = 'badge-antrian';
    if(t.status==='Proses') statBadge='badge-proses'; if(t.status==='Siap Diambil') statBadge='badge-siap'; if(t.status==='Selesai') statBadge='badge-selesai';
    
    // Tentukan Tombol Aksi Berdasarkan Status
    let actBtn = "";
    if(t.status !== 'Batal') {
      if(t.status === 'Antrian') actBtn = `<button class="btn-secondary" onclick="ubahStatusTrx(${t.id}, 'Proses')">Proses Cucian</button> <button class="btn-danger-small" onclick="ubahStatusTrx(${t.id}, 'Batal')">Batal</button>`;
      else if(t.status === 'Proses') actBtn = `<button class="btn-secondary" onclick="ubahStatusTrx(${t.id}, 'Siap Diambil')">Siap Diambil</button> <button class="btn-danger-small" onclick="ubahStatusTrx(${t.id}, 'Antrian')">Batal Proses</button>`;
      else if(t.status === 'Siap Diambil') actBtn = `<button class="btn-success-small" onclick="ubahStatusTrx(${t.id}, 'Selesai')">Selesaikan</button>`;
    }

    return `
      <div class="trx-card">
        <div class="trx-header">
          <div><h4>${t.customerName}</h4><span class="badge ${statBadge}">${t.status}</span> <span class="badge ${payBadge}" onclick="toggleLunas(${t.id})" style="cursor:pointer;">${t.paymentStatus} 🔄</span></div>
          <b style="color:var(--primary);">${formatRupiah(t.total)}</b>
        </div>
        <div style="font-size:0.75rem; color:#666; margin-bottom:8px;">${t.items.map(i=>i.name).join(", ")}</div>
        <div class="trx-actions">
          <button class="btn-secondary" onclick="showToast('Fitur Cetak Nota Bluetooth Segera Hadir')"><i class="fas fa-print"></i> Nota</button>
          ${actBtn}
        </div>
      </div>
    `;
  }).join("");
}

function ubahStatusTrx(id, newStat) {
  let t = appData.transactions.find(x => x.id === id);
  if(t) { t.status = newStat; saveToCloud(); renderAllTransactions(); renderDashboardLaundry(); calculateFinance(); }
}

function toggleLunas(id) {
  let t = appData.transactions.find(x => x.id === id);
  if(t) { t.paymentStatus = t.paymentStatus === 'Lunas' ? 'Belum Lunas' : 'Lunas'; saveToCloud(); renderAllTransactions(); }
}
/* KEUANGAN & LABA BERSIH */
function openExpenseModal(cat) {
  document.getElementById("expenseCategory").value = cat; document.getElementById("expenseModalTitle").textContent = `Catat: ${cat}`;
  document.getElementById("expenseModal").style.display = "flex";
}
document.getElementById("expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  appData.finances.unshift({ id: Date.now(), date: document.getElementById("expenseDate").value, category: document.getElementById("expenseCategory").value, desc: document.getElementById("expenseDesc").value, amount: Number(document.getElementById("expenseAmount").value) });
  saveToCloud(); document.getElementById("expenseModal").style.display = "none"; calculateFinance(); showToast("Disimpan");
});

function calculateFinance() {
  const m = document.getElementById("homeMonthFilter").value;
  let tOut = 0;
  ['HARIAN', 'LAIN2', 'LAUNDRY', 'TABUNGAN'].forEach(cat => {
    let sum = appData.finances.filter(f => (m ? f.date.startsWith(m) : true) && f.category === cat).reduce((a, b) => a + b.amount, 0);
    document.getElementById(`sub-${cat}`).textContent = formatRupiah(sum);
    if(cat !== 'TABUNGAN') tOut += sum;
  });
  document.getElementById("totalPengeluaran").textContent = formatRupiah(tOut);
  
  let omzet = appData.transactions.filter(t => (m ? t.date.startsWith(m) : true) && t.status !== 'Batal').reduce((a, b) => a + b.total, 0);
  let bLndry = appData.finances.filter(f => f.category === 'LAUNDRY' && (m ? f.date.startsWith(m) : true)).reduce((a, b) => a + b.amount, 0);
  document.getElementById("labaBersihLaundry").textContent = formatRupiah(omzet - bLndry);
  
  const tbody = document.getElementById("tableBodyFinance");
  if(tbody) tbody.innerHTML = appData.finances.filter(f => m ? f.date.startsWith(m) : true).map(f => `<tr><td>${f.date.substring(5)}</td><td><b>${f.category}</b></td><td>${f.desc}</td><td style="color:red;">${formatRupiah(f.amount)}</td><td><button onclick="deleteFinance(${f.id})">✕</button></td></tr>`).join("");
}
function deleteFinance(id) { if(confirm("Hapus?")) { appData.finances = appData.finances.filter(f => f.id !== id); saveToCloud(); calculateFinance(); } }

/* DIARI HARIAN */
function openNotesModal() { document.getElementById("notesModal").style.display="flex"; renderNotesList(); }
document.getElementById("noteForm").addEventListener("submit", (e) => {
  e.preventDefault(); appData.notes.unshift({ id: Date.now(), datetime: document.getElementById("noteDateTime").value, content: document.getElementById("noteContent").value });
  saveToCloud(); document.getElementById("addNoteModal").style.display="none"; renderNotesList();
});
function renderNotesList() {
  const c = document.getElementById("notesListContainer"); document.getElementById("sub-CATATAN").textContent = `${appData.notes.length} Catatan`;
  if(c) c.innerHTML = appData.notes.map(n => `<div style="background:#f8fafc; padding:10px; border:1px solid #bae6fd; margin-bottom:8px; border-radius:8px;"><b>${n.datetime.replace('T',' ')}</b><p>${n.content}</p><button onclick="deleteNote(${n.id})" style="color:red; background:none; border:none; margin-top:5px;">Hapus</button></div>`).join("");
}
function deleteNote(id) { appData.notes = appData.notes.filter(n=>n.id!==id); saveToCloud(); renderNotesList(); }
/* PELANGGAN */
function renderCustomersList() {
  const c = document.getElementById("customersListContainer"); if(!c) return;
  const cm = {};
  appData.transactions.forEach(t => {
    if(!cm[t.customerName]) cm[t.customerName] = { c: 0, s: 0 };
    cm[t.customerName].c++; cm[t.customerName].s += t.total;
  });
  c.innerHTML = Object.keys(cm).map(k => `<div style="background:#fff; border:1px solid #ddd; padding:12px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between;"><div><b>${k}</b><p style="font-size:0.75rem;">${cm[k].c} Transaksi</p></div><b style="color:var(--primary);">${formatRupiah(cm[k].s)}</b></div>`).join("");
}

/* OUTLET & KARYAWAN */
function refreshOutletUI() {
  const name = appData.outlet.name || "Aplikasi Kasir";
  document.getElementById("loginOutletName").textContent = name; document.getElementById("headerOutletName").textContent = name;
  if(document.getElementById("dispOutletName")) { document.getElementById("dispOutletName").textContent = name; document.getElementById("dispOutletAddress").textContent = appData.outlet.address; }
}
function openOutletModal() { document.getElementById("outletModal").style.display="flex"; document.getElementById("inputOutletName").value=appData.outlet.name; }
document.getElementById("outletForm").addEventListener("submit", (e) => { e.preventDefault(); appData.outlet.name=document.getElementById("inputOutletName").value; saveToCloud(); refreshOutletUI(); document.getElementById("outletModal").style.display="none"; });

function renderKaryawanList() {
  const c = document.getElementById("karyawanList"); if(!c) return;
  c.innerHTML = appData.users.map(u => `<div style="background:#fff; padding:10px; border:1px solid #ddd; margin-bottom:8px; border-radius:8px; display:flex; justify-content:space-between;"><div><b>${u.name}</b> (${u.role})<br><small>${u.username}</small></div><button onclick="appData.users=appData.users.filter(x=>x.id!==${u.id});saveToCloud();renderKaryawanList();" style="color:red; background:none; border:none;">Hapus</button></div>`).join("");
}
function openKaryawanModal() { document.getElementById("karyawanModal").style.display="flex"; }
document.getElementById("karyawanForm").addEventListener("submit", (e) => {
  e.preventDefault(); appData.users.push({ id: Date.now(), name: document.getElementById("inputKarName").value, username: document.getElementById("inputKarUser").value, password: document.getElementById("inputKarPass").value, role: document.getElementById("inputKarRole").value });
  saveToCloud(); document.getElementById("karyawanModal").style.display="none"; renderKaryawanList();
});

/* KALKULATOR */
function getCalcDoc() { return appData.calcDocs[0]; }
function loadCalcDoc() { updateCalcScreen(); renderCalcRows(); }
function updateCalcScreen() { document.getElementById("calcScreen").value = Number(calcInput).toLocaleString('id-ID'); document.getElementById("activeOpSymbol").textContent = calcActiveOp; }
function calcAppendNum(num) { if(calcInput === "0" && num !== ".") calcInput = num; else { if(num==="." && calcInput.includes(".")) return; calcInput += num; } updateCalcScreen(); }
function calcBackSpace() { calcInput = calcInput.length > 1 ? calcInput.slice(0,-1) : "0"; updateCalcScreen(); }
function calcClear() { getCalcDoc().rows = []; calcInput = "0"; calcActiveOp = "+"; saveToCloud(); updateCalcScreen(); renderCalcRows(); }
function calcAddOp(op) { const val = parseFloat(calcInput); if(!isNaN(val) && (val !== 0 || calcInput !== "0")) { getCalcDoc().rows.push({ op: calcActiveOp, val }); calcInput = "0"; saveToCloud(); } calcActiveOp = op; renderCalcRows(); updateCalcScreen(); }
function calcEquals() { const val = parseFloat(calcInput); if(!isNaN(val) && (val !== 0 || calcInput !== "0")) { getCalcDoc().rows.push({ op: calcActiveOp, val }); } getCalcDoc().rows.push({ isResult: true }); calcInput = "0"; calcActiveOp = "+"; saveToCloud(); renderCalcRows(); updateCalcScreen(); }
function renderCalcRows() {
  const c = document.getElementById("calcRowsContainer"); if(!c) return; let t = 0;
  c.innerHTML = getCalcDoc().rows.map(r => {
    if(r.isResult) { let res = t; t = 0; return `<div style="text-align:right; font-weight:bold; color:var(--primary); border-top:1px solid #ccc; padding-top:5px;">= ${res.toLocaleString('id-ID')}</div>`; }
    else { if(r.op==='+') t+=r.val; else if(r.op==='-') t-=r.val; else if(r.op==='×') t*=r.val; else if(r.op==='÷') t/=r.val; return `<div style="display:flex; justify-content:space-between; color:#666;"><span>${r.op}</span><span>${r.val.toLocaleString('id-ID')}</span></div>`; }
  }).join("");
  c.scrollTop = c.scrollHeight;
}
