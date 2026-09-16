/* ================= 1. KONFIGURASI & STATE ================= */
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGhQ-tJytCoEQGz2whhSP8ML2L632IYVy9y2Jeb0117SgDCv-rYy1-uzWxFFJpMjbctA/exec";

// Default Data Induk
let appData = {
  transactions: [],
  finances: [],
  notes: [],
  users: [{ id: 1, name: "Pemilik", username: "admin", password: "123", role: "Admin" }],
  outlet: { name: "", address: "", phone: "" },
  calcDocs: [{ id: 1, title: 'Perhitungan(1)', rows: [] }]
};

let currentUser = null;
let currentCalcDocId = 1;
let calcInput = "0";
let calcActiveOp = "+";

/* ================= 2. INISIALISASI AWAL ================= */
document.addEventListener("DOMContentLoaded", () => {
  const savedData = localStorage.getItem("appDataTerpadu");
  if (savedData) {
    appData = JSON.parse(savedData);
  }
  
  // Cek apakah ada sesi login tersimpan
  const savedSession = localStorage.getItem("activeSession");
  if (savedSession) {
    currentUser = JSON.parse(savedSession);
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainApp").style.display = "block";
    initApp();
  } else {
    refreshOutletUI();
  }
});

function initApp() {
  refreshOutletUI();
  updateUIDasar();
  renderDashboardLaundry();
  calculateFinance();
  renderNotesList();
  renderKaryawanList();
  loadCalcDoc();
  syncFromCloud(); // Tarik data terbaru dari Cloud di latar belakang
  
  // Set filter bulan default (Bulan Ini)
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  document.getElementById("homeMonthFilter").value = `${yyyy}-${mm}`;
}

/* ================= 3. FUNGSI SINKRONISASI CLOUD ================= */
async function syncFromCloud() {
  try {
    const res = await fetch(WEB_APP_URL);
    const data = await res.json();
    if (data && data.users) { // Validasi sederhana
      appData = data;
      localStorage.setItem("appDataTerpadu", JSON.stringify(appData));
      updateUIDasar();
      renderDashboardLaundry();
      calculateFinance();
    }
  } catch (err) {
    console.log("Sinkronisasi latar belakang gagal atau offline.");
  }
}

async function saveToCloud() {
  localStorage.setItem("appDataTerpadu", JSON.stringify(appData));
  showLoading();
  try {
    await fetch(WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(JSON.stringify(appData))
    });
    hideLoading();
  } catch (err) {
    hideLoading();
    showToast("Disimpan offline. Akan disinkronkan saat online.");
  }
}

/* ================= 4. AUTH (LOGIN / LOGOUT) & NAVIGASI ================= */
function prosesLogin() {
  const userIn = document.getElementById("loginUsername").value.trim();
  const passIn = document.getElementById("loginPassword").value;
  
  const user = appData.users.find(u => u.username === userIn && u.password === passIn);
  
  if (user) {
    currentUser = user;
    localStorage.setItem("activeSession", JSON.stringify(user));
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainApp").style.display = "block";
    showToast(`Selamat datang, ${user.name}!`);
    initApp();
  } else {
    showToast("Username atau Password salah!");
  }
}

function prosesLogout() {
  if(confirm("Anda yakin ingin keluar?")) {
    currentUser = null;
    localStorage.removeItem("activeSession");
    location.reload();
  }
}

function updateUIDasar() {
  // Sembunyikan fitur admin jika yang login adalah Karyawan biasa
  const adminElements = document.querySelectorAll(".admin-only");
  adminElements.forEach(el => {
    el.style.display = (currentUser && currentUser.role === "Admin") ? "flex" : "none";
  });
  
  // Tampilkan inisial profil
  if (currentUser) {
    const initial = currentUser.name.charAt(0).toUpperCase();
    document.getElementById("headerProfileIcon").textContent = initial;
    document.getElementById("bigProfileIcon").textContent = initial;
  }
}

function showPage(pageId) {
  // Blokir akses karyawan ke halaman keuangan
  if (currentUser && currentUser.role !== "Admin" && (pageId === "financePage" || pageId === "financeReportPage")) {
    showToast("Akses Ditolak! Hanya Admin yang bisa melihat Keuangan.");
    return;
  }

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");

  document.querySelectorAll(".nav-button[data-page]").forEach(btn => {
    btn.classList.remove("active");
    if (btn.dataset.page === pageId) btn.classList.add("active");
  });
  window.scrollTo(0, 0);
  
  if(pageId === 'dashboardPage') renderDashboardLaundry();
  if(pageId === 'financePage') calculateFinance();
}

/* ================= 5. FUNGSI UTILITAS ================= */
function formatRupiah(num) { return "Rp " + Number(num).toLocaleString("id-ID"); }
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}
function showLoading() { document.getElementById("loadingModal").style.display = "flex"; }
function hideLoading() { document.getElementById("loadingModal").style.display = "none"; }
function closeAllModals() { document.querySelectorAll(".modal-overlay").forEach(m => m.style.display = "none"); }
/* ================= 6. LOGIKA LAUNDRY ================= */
function renderDashboardLaundry() {
  const today = new Date().toISOString().split('T')[0];
  let todayIncome = 0;
  let todayTrx = 0;
  let pendingCount = 0;
  
  appData.transactions.forEach(t => {
    if (t.date.startsWith(today)) todayTrx++;
    if (t.status === 'Selesai' && t.date.startsWith(today)) todayIncome += Number(t.total);
    if (t.status !== 'Selesai' && t.status !== 'Batal') pendingCount++;
  });
  
  document.getElementById("todayIncome").textContent = formatRupiah(todayIncome);
  document.getElementById("todayTransactions").textContent = todayTrx;
  document.getElementById("pendingTransactions").textContent = pendingCount;
  
  // Ambil total pelanggan unik
  const uniqueCust = new Set(appData.transactions.map(t => t.customerName.toLowerCase()));
  document.getElementById("totalCustomers").textContent = uniqueCust.size;
}

// Fitur transaksi baru (Simulasi Sederhana untuk Kasir)
function openTransactionModal() {
  // Dalam versi nyata, ini akan membuka form lengkap
  const nama = prompt("Nama Pelanggan:");
  if(!nama) return;
  const layanan = prompt("Layanan (cth: Cuci Kering):", "Cuci Komplit");
  const nominal = prompt("Total Harga (Rp):", "15000");
  
  if (nama && nominal) {
    const newTrx = {
      id: Date.now(),
      date: new Date().toISOString(),
      customerName: nama,
      service: layanan,
      total: Number(nominal),
      status: "Antrian",
      cashier: currentUser ? currentUser.name : "System"
    };
    appData.transactions.unshift(newTrx);
    saveToCloud();
    renderDashboardLaundry();
    showToast("Transaksi berhasil disimpan oleh " + newTrx.cashier);
  }
}

/* ================= 7. LOGIKA KEUANGAN PRIBADI & LABA BERSIH ================= */
function openExpenseModal(cat) {
  document.getElementById("expenseCategory").value = cat;
  document.getElementById("expenseModalTitle").textContent = `Catat: ${cat}`;
  document.getElementById("expenseDate").value = new Date().toISOString().split('T')[0];
  document.getElementById("expenseModal").style.display = "flex";
}
function closeExpenseModal() { document.getElementById("expenseModal").style.display = "none"; document.getElementById("expenseForm").reset(); }

document.getElementById("expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const newExp = {
    id: Date.now(),
    date: document.getElementById("expenseDate").value,
    category: document.getElementById("expenseCategory").value,
    desc: document.getElementById("expenseDesc").value,
    amount: Number(document.getElementById("expenseAmount").value)
  };
  appData.finances.unshift(newExp);
  saveToCloud();
  closeExpenseModal();
  calculateFinance();
  showToast("Pengeluaran dicatat");
});

function calculateFinance() {
  const selectedMonth = document.getElementById("homeMonthFilter").value;
  const categories = ['HARIAN', 'LAIN2', 'LAUNDRY', 'TABUNGAN / ARISAN'];
  let totalPengeluaran = 0;
  
  // Hitung Pengeluaran
  categories.forEach(cat => {
    const sum = appData.finances.filter(f => {
      const matchMonth = selectedMonth ? f.date.startsWith(selectedMonth) : true;
      return matchMonth && f.category === cat;
    }).reduce((acc, curr) => acc + curr.amount, 0);
    
    document.getElementById(`sub-${cat}`).textContent = formatRupiah(sum);
    if(cat !== 'TABUNGAN / ARISAN') totalPengeluaran += sum;
  });
  
  document.getElementById("totalPengeluaran").textContent = formatRupiah(totalPengeluaran);
  
  // Hitung Laba Bersih Laundry (Omzet Laundry - Biaya Laundry)
  // Omzet = Semua transaksi Laundry
  const omzetLaundry = appData.transactions.filter(t => {
    return selectedMonth ? t.date.startsWith(selectedMonth) : true;
  }).reduce((acc, curr) => acc + curr.total, 0);
  
  const biayaLaundry = appData.finances.filter(f => f.category === 'LAUNDRY' && (selectedMonth ? f.date.startsWith(selectedMonth) : true)).reduce((acc, curr) => acc + curr.amount, 0);
  
  const labaBersih = omzetLaundry - biayaLaundry;
  document.getElementById("labaBersihLaundry").textContent = formatRupiah(labaBersih);
  
  renderFinanceTable(selectedMonth);
}

function renderFinanceTable(month) {
  const filterCat = document.getElementById("dataFilterFinance") ? document.getElementById("dataFilterFinance").value : 'ALL';
  const tbody = document.getElementById("tableBodyFinance");
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const filtered = appData.finances.filter(f => {
    const matchMonth = month ? f.date.startsWith(month) : true;
    const matchCat = filterCat === 'ALL' ? true : f.category === filterCat;
    return matchMonth && matchCat;
  });
  
  filtered.forEach(f => {
    tbody.innerHTML += `
      <tr>
        <td>${f.date.substring(5)}</td>
        <td><b>${f.category}</b></td>
        <td>${f.desc}</td>
        <td style="color:var(--red); font-weight:bold;">${formatRupiah(f.amount)}</td>
        <td><button class="btn-danger-small" onclick="deleteFinance(${f.id})">✕</button></td>
      </tr>
    `;
  });
}

function deleteFinance(id) {
  if(confirm("Hapus catatan keuangan ini?")) {
    appData.finances = appData.finances.filter(f => f.id !== id);
    saveToCloud();
    calculateFinance();
  }
}
/* ================= 8. LOGIKA DIARI / CATATAN (DENGAN WAKTU) ================= */
function openNotesModal() {
  document.getElementById("notesModal").style.display = "flex";
  renderNotesList();
}
function closeNotesModal() { document.getElementById("notesModal").style.display = "none"; }
function openAddNoteForm() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("noteDateTime").value = now.toISOString().slice(0, 16);
  document.getElementById("addNoteModal").style.display = "flex";
}
function closeAddNoteForm() { document.getElementById("addNoteModal").style.display = "none"; document.getElementById("noteForm").reset(); }

document.getElementById("noteForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const dt = document.getElementById("noteDateTime").value;
  const content = document.getElementById("noteContent").value;
  appData.notes.unshift({ id: Date.now(), datetime: dt, content: content });
  saveToCloud();
  closeAddNoteForm();
  renderNotesList();
  showToast("Catatan Diari disimpan");
});

function renderNotesList() {
  const c = document.getElementById("notesListContainer");
  c.innerHTML = "";
  document.getElementById("sub-CATATAN").textContent = `${appData.notes.length} Catatan`;
  
  appData.notes.forEach(n => {
    const dateObj = new Date(n.datetime);
    const dateStr = dateObj.toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
    c.innerHTML += `
      <div style="background:#f8fafc; border:1px solid #bae6fd; border-radius:10px; padding:12px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
          <small style="color:var(--primary); font-weight:bold;">${dateStr}</small>
          <button class="btn-danger-small" onclick="deleteNote(${n.id})">Hapus</button>
        </div>
        <p style="font-size:0.9rem;">${n.content}</p>
      </div>
    `;
  });
}
function deleteNote(id) { if(confirm("Hapus catatan ini?")){ appData.notes = appData.notes.filter(n=>n.id!==id); saveToCloud(); renderNotesList(); } }


/* ================= 9. PENGATURAN USAHA (WHITE-LABEL) & KARYAWAN ================= */
function refreshOutletUI() {
  const name = appData.outlet.name || "Aplikasi Terpadu";
  document.getElementById("loginOutletName").textContent = name;
  document.getElementById("headerOutletName").textContent = name;
  if(document.getElementById("dispOutletName")) {
    document.getElementById("dispOutletName").textContent = name;
    document.getElementById("dispOutletAddress").textContent = appData.outlet.address || "Alamat belum diatur";
    document.getElementById("dispOutletPhone").textContent = appData.outlet.phone || "-";
  }
}
function openOutletModal() {
  document.getElementById("inputOutletName").value = appData.outlet.name;
  document.getElementById("inputOutletPhone").value = appData.outlet.phone;
  document.getElementById("inputOutletAddress").value = appData.outlet.address;
  document.getElementById("outletModal").style.display = "flex";
}
function closeOutletModal() { document.getElementById("outletModal").style.display = "none"; }
document.getElementById("outletForm").addEventListener("submit", (e) => {
  e.preventDefault();
  appData.outlet.name = document.getElementById("inputOutletName").value;
  appData.outlet.phone = document.getElementById("inputOutletPhone").value;
  appData.outlet.address = document.getElementById("inputOutletAddress").value;
  saveToCloud();
  refreshOutletUI();
  closeOutletModal();
  showToast("Profil Usaha Diperbarui");
});

// Karyawan
function renderKaryawanList() {
  const c = document.getElementById("karyawanList");
  if(!c) return;
  c.innerHTML = "";
  appData.users.forEach(u => {
    c.innerHTML += `
      <div style="background:#fff; border:1px solid var(--border); padding:12px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <b>${u.name}</b> <span style="font-size:0.7rem; background:var(--pastel-blue); color:var(--primary); padding:2px 6px; border-radius:4px;">${u.role}</span>
          <p style="font-size:0.8rem; color:var(--text-muted);">Username: ${u.username}</p>
        </div>
        <button class="btn-danger-small" onclick="deleteKaryawan(${u.id})">Hapus</button>
      </div>
    `;
  });
}
function openKaryawanModal() { document.getElementById("karyawanModal").style.display = "flex"; }
function closeKaryawanModal() { document.getElementById("karyawanModal").style.display = "none"; document.getElementById("karyawanForm").reset(); }
document.getElementById("karyawanForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("inputKarName").value;
  const user = document.getElementById("inputKarUser").value;
  const pass = document.getElementById("inputKarPass").value;
  const role = document.getElementById("inputKarRole").value;
  
  if(appData.users.find(u => u.username === user)) return showToast("Username sudah dipakai!");
  
  appData.users.push({ id: Date.now(), name, username: user, password: pass, role });
  saveToCloud();
  closeKaryawanModal();
  renderKaryawanList();
  showToast("Akun Karyawan Ditambahkan");
});
function deleteKaryawan(id) {
  if(appData.users.length <= 1) return showToast("Minimal harus ada 1 akun!");
  if(confirm("Hapus akun ini?")) { appData.users = appData.users.filter(u=>u.id!==id); saveToCloud(); renderKaryawanList(); }
}

/* ================= 10. KALKULATOR ================= */
function getCalcDoc() { return appData.calcDocs.find(d => d.id === currentCalcDocId) || appData.calcDocs[0]; }
function loadCalcDoc() { updateCalcScreen(); }
function updateCalcScreen() {
  document.getElementById("calcScreen").value = Number(calcInput).toLocaleString('id-ID');
  document.getElementById("activeOpSymbol").textContent = calcActiveOp;
}
function calcAppendNum(num) {
  if(calcInput === "0" && num !== ".") calcInput = num;
  else { if(num==="." && calcInput.includes(".")) return; calcInput += num; }
  updateCalcScreen();
}
function calcBackSpace() { calcInput = calcInput.length > 1 ? calcInput.slice(0,-1) : "0"; updateCalcScreen(); }
function calcClear() { getCalcDoc().rows = []; calcInput = "0"; calcActiveOp = "+"; saveToCloud(); updateCalcScreen(); renderCalcRows(); }
function calcAddOp(op) {
  const val = parseFloat(calcInput);
  if(!isNaN(val) && (val !== 0 || calcInput !== "0")) {
    getCalcDoc().rows.push({ op: calcActiveOp, val }); calcInput = "0"; saveToCloud();
  }
  calcActiveOp = op; renderCalcRows(); updateCalcScreen();
}
function calcEquals() {
  const val = parseFloat(calcInput);
  if(!isNaN(val) && (val !== 0 || calcInput !== "0")) {
    getCalcDoc().rows.push({ op: calcActiveOp, val }); calcInput = "0";
  }
  getCalcDoc().rows.push({ isResult: true }); calcInput = "0"; calcActiveOp = "+"; saveToCloud(); renderCalcRows(); updateCalcScreen();
}
function renderCalcRows() {
  const c = document.getElementById("calcRowsContainer");
  if(!c) return; c.innerHTML = "";
  let total = 0;
  getCalcDoc().rows.forEach(r => {
    if(r.isResult) {
      c.innerHTML += `<div style="text-align:right; color:var(--primary); font-weight:bold; border-top:2px solid var(--border); padding-top:5px;">= ${total.toLocaleString('id-ID')}</div><br>`; total = 0;
    } else {
      if(r.op==='+') total+=r.val; else if(r.op==='-') total-=r.val; else if(r.op==='×') total*=r.val; else if(r.op==='÷') total/=r.val;
      c.innerHTML += `<div style="display:flex; justify-content:space-between; color:var(--text-muted); font-size:0.9rem;"><span>${r.op}</span><span>${r.val.toLocaleString('id-ID')}</span></div>`;
    }
  });
  c.scrollTop = c.scrollHeight;
}
/* ================= LOGIKA UTAMA LAUNDRY (DIPERBARUI) ================= */

// Daftar Layanan Bawaan Arsy Laundry (Bisa ditambah/ubah di menu Layanan)
if (!appData.services || Object.keys(appData.services).length === 0) {
  appData.services = {
    "Cuci Kering": { price: 5000, unit: "kg", duration: "3 Hari" },
    "Cuci Setrika": { price: 10000, unit: "kg", duration: "1 Hari" },
    "Bed Cover": { price: 25000, unit: "pcs", duration: "1 Hari" },
    "Setrika Express": { price: 6000, unit: "kg", duration: "4 Jam" }
  };
}

let activeNewTransactionItems = [];

// Buka Modal Transaksi Baru
function openTransactionModal() {
  activeNewTransactionItems = [];
  renderActiveTransactionItems();
  
  // Pastikan modal transaksi ada atau buat tampilannya
  let modal = document.getElementById("transactionModalFull");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "transactionModalFull";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 450px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header">
          <h3>Transaksi Baru Laundry</h3>
          <button onclick="closeFullTransactionModal()" class="btn-close">✕</button>
        </div>
        <form id="fullTransactionForm" onsubmit="saveFullTransaction(event)">
          <div class="form-group">
            <label>Nama Pelanggan</label>
            <input type="text" id="trxCustomerName" placeholder="Contoh: Budi" required autocomplete="off">
          </div>
          
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <label style="margin:0;">Pilihan Layanan</label>
              <button type="button" class="btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="promptAddServiceToTrx()">+ Pilih Layanan</button>
            </div>
            <div id="trxItemsContainer" style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:10px; min-height:60px;">
              <span style="color:var(--text-muted); font-size:0.8rem;">Belum ada layanan dipilih</span>
            </div>
          </div>

          <div class="form-group">
            <label>Status Awal</label>
            <select id="trxStatus">
              <option value="Antrian">Antrian</option>
              <option value="Proses">Proses</option>
              <option value="Siap Diambil">Siap Diambil</option>
              <option value="Selesai">Selesai</option>
            </select>
          </div>

          <div style="background:#f0f9ff; padding:12px; border-radius:10px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:bold; font-size:0.9rem;">Total Tagihan:</span>
            <b id="trxGrandTotalDisplay" style="color:var(--primary); font-size:1.1rem;">Rp 0</b>
          </div>

          <div class="modal-buttons">
            <button type="button" class="btn-secondary" onclick="closeFullTransactionModal()">Batal</button>
            <button type="submit" class="btn-primary">Simpan Transaksi</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.style.display = "flex";
}

function closeFullTransactionModal() {
  const modal = document.getElementById("transactionModalFull");
  if(modal) modal.style.display = "none";
}

function promptAddServiceToTrx() {
  const serviceNames = Object.keys(appData.services);
  let choice = prompt("Pilih Layanan:\n" + serviceNames.map((s, i) => `${i+1}. ${s} (Rp ${appData.services[s].price}/${appData.services[s].unit})`).join("\n") + "\n\nKetik nomor layanan:");
  
  let idx = parseInt(choice) - 1;
  if (!isNaN(idx) && serviceNames[idx]) {
    let srvName = serviceNames[idx];
    let srv = appData.services[srvName];
    activeNewTransactionItems.push({
      serviceType: srvName,
      weight: 1,
      total: srv.price
    });
    renderActiveTransactionItems();
  }
}

function renderActiveTransactionItems() {
  const container = document.getElementById("trxItemsContainer");
  const totalDisplay = document.getElementById("trxGrandTotalDisplay");
  if(!container) return;

  if(activeNewTransactionItems.length === 0) {
    container.innerHTML = `<span style="color:var(--text-muted); font-size:0.8rem;">Belum ada layanan dipilih</span>`;
    if(totalDisplay) totalDisplay.textContent = formatRupiah(0);
    return;
  }

  let grandTotal = 0;
  container.innerHTML = activeNewTransactionItems.map((item, idx) => {
    grandTotal += item.total;
    let srv = appData.services[item.serviceType] || { unit: 'kg' };
    return `
      <div style="background:#fff; border:1px solid var(--border); border-radius:8px; padding:8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <b style="font-size:0.85rem; color:var(--primary);">${item.serviceType}</b>
          <div style="display:flex; align-items:center; gap:5px; margin-top:4px;">
            <input type="number" step="any" value="${item.weight}" style="width:60px; padding:4px; text-align:center; font-size:0.8rem;" oninput="updateTrxWeight(${idx}, this.value)">
            <span style="font-size:0.75rem; color:var(--text-muted);">${srv.unit}</span>
          </div>
        </div>
        <div style="text-align:right;">
          <b style="font-size:0.85rem;" id="trxItemTotal_${idx}">${formatRupiah(item.total)}</b>
          <br><button type="button" onclick="removeTrxItem(${idx})" style="color:var(--red); background:none; border:none; font-size:0.75rem; cursor:pointer;">Hapus</button>
        </div>
      </div>
    `;
  }).join("");

  if(totalDisplay) totalDisplay.textContent = formatRupiah(grandTotal);
}

function updateTrxWeight(idx, val) {
  let w = parseFloat(val) || 0;
  let item = activeNewTransactionItems[idx];
  let srv = appData.services[item.serviceType];
  item.weight = w;
  item.total = Math.round(w * srv.price);
  
  document.getElementById(`trxItemTotal_${idx}`).textContent = formatRupiah(item.total);
  
  let grandTotal = activeNewTransactionItems.reduce((sum, it) => sum + it.total, 0);
  document.getElementById("trxGrandTotalDisplay").textContent = formatRupiah(grandTotal);
}

function removeTrxItem(idx) {
  activeNewTransactionItems.splice(idx, 1);
  renderActiveTransactionItems();
}

function saveFullTransaction(e) {
  e.preventDefault();
  const name = document.getElementById("trxCustomerName").value.trim();
  const status = document.getElementById("trxStatus").value;
  
  if(!name || activeNewTransactionItems.length === 0) {
    showToast("Lengkapi nama dan minimal 1 layanan!");
    return;
  }

  let grandTotal = activeNewTransactionItems.reduce((sum, it) => sum + it.total, 0);

  const newTrx = {
    id: Date.now(),
    date: new Date().toISOString(),
    customerName: name,
    items: JSON.parse(JSON.stringify(activeNewTransactionItems)),
    total: grandTotal,
    status: status,
    paymentStatus: "Belum Lunas",
    paidAmount: 0,
    cashier: currentUser ? currentUser.name : "Admin"
  };

  appData.transactions.unshift(newTrx);
  saveToCloud();
  closeFullTransactionModal();
  renderDashboardLaundry();
  renderAllTransactions();
  calculateFinance();
  showToast("Transaksi Laundry Berhasil Disimpan!");
}

/* Tampilkan Daftar Transaksi di Tab Laundry */
let currentTrxFilter = 'Antrian';
function filterTransactionsTab(status, btn) {
  currentTrxFilter = status;
  document.querySelectorAll('.trans-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAllTransactions();
}

function renderAllTransactions() {
  const container = document.getElementById("allTransactions");
  if(!container) return;

  const searchInput = document.getElementById("transactionSearchInput");
  const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

  let filtered = appData.transactions.filter(t => {
    let matchStatus = true;
    if (currentTrxFilter === 'Antrian') matchStatus = (t.status === 'Antrian' || t.status === 'Pending');
    else if (currentTrxFilter === 'Proses') matchStatus = (t.status === 'Proses');
    else if (currentTrxFilter === 'Siap Diambil') matchStatus = (t.status === 'Siap Diambil');
    else if (currentTrxFilter === 'Selesai') matchStatus = (t.status === 'Selesai' || t.status === 'Lunas');

    let matchSearch = t.customerName.toLowerCase().includes(query);
    return matchStatus && matchSearch;
  });

  if(filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted); font-size:0.85rem;">Tidak ada transaksi</div>`;
    return;
  }

  container.innerHTML = filtered.map(t => {
    let statusClass = 'status-antrian';
    if(t.status === 'Proses') statusClass = 'status-proses';
    if(t.status === 'Siap Diambil') statusClass = 'status-siap';
    if(t.status === 'Selesai') statusClass = 'status-selesai';

    return `
      <div class="trx-card">
        <div class="trx-info">
          <h4>TRX/${String(t.id).slice(-4)} - <b>${escapeHTML(t.customerName)}</b></h4>
          <p>Total: <b>${formatRupiah(t.total)}</b> • ${new Date(t.date).toLocaleDateString('id-ID')}</p>
          <span class="trx-status ${statusClass}" style="margin-top:6px; display:inline-block;">${t.status}</span>
        </div>
        <div>
          <button class="btn-secondary" style="padding:6px 10px; font-size:0.75rem;" onclick="proposeNextStatus(${t.id})">Proses ➔</button>
        </div>
      </div>
    `;
  }).join("");
}

function proposeNextStatus(id) {
  let t = appData.transactions.find(item => item.id === id);
  if(!t) return;
  
  if(t.status === 'Antrian') t.status = 'Proses';
  else if(t.status === 'Proses') t.status = 'Siap Diambil';
  else if(t.status === 'Siap Diambil') t.status = 'Selesai';
  
  saveToCloud();
  renderAllTransactions();
  renderDashboardLaundry();
  calculateFinance();
  showToast("Status diperbarui menjadi: " + t.status);
}

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
