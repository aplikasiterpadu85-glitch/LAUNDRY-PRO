const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbztgW5hFuF2stW7Q4MCwplr4ufA8cNmTOhOMqr0SELpZ3IDPSal2fPMFd2MNR2gj52P/exec";
const $ = id => document.getElementById(id);
const formatRp = num => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

// Inisialisasi Database
let db = JSON.parse(localStorage.getItem('arsy_db')) || {};
if (!db.users || db.users.length === 0) db.users = [{ id: '1', name: 'Admin', pin: '1985', role: 'Admin' }];
if (!db.outlet) db.outlet = { name: "Arsy Laundry", phone: "08123456789", city: "Mojokerto", address: "Mlirip" };
if (!db.services) db.services = []; 
if (!db.transactions) db.transactions = []; 
if (!db.customers) db.customers = [];

let currentUser = JSON.parse(localStorage.getItem('arsy_user'));

window.onload = () => { 
    if (currentUser) { initApp(); } 
    else { if($('loginModal'))$('loginModal').classList.add('show'); } 
};

function loginApp() { 
    const user = db.users.find(u => u.pin === $('loginPin').value); 
    if (user) { 
        currentUser = user; localStorage.setItem('arsy_user', JSON.stringify(currentUser)); 
        closeModal('loginModal'); if($('loginPin'))$('loginPin').value = ""; 
        if($('loginError'))$('loginError').style.display = 'none'; initApp(); 
    } else { if($('loginError'))$('loginError').style.display = 'block'; } 
}

function logout() { localStorage.removeItem('arsy_user'); window.location.reload(); }

function initApp() { 
    if($('mainBottomNav'))$('mainBottomNav').style.display = 'flex'; 
    applyRoleRestrictions(); updateUI(); 
}

function applyRoleRestrictions() { 
    document.querySelectorAll('.admin-only').forEach(el => { if (currentUser.role === 'Admin') el.classList.remove('admin-only'); else el.style.display = 'none'; }); 
    if($('akunProfileInitial'))$('akunProfileInitial').textContent = currentUser.name.substring(0, 2).toUpperCase(); 
    if($('akunUserRoleText'))$('akunUserRoleText').textContent = currentUser.role; 
    if($('headerProfileIcon'))$('headerProfileIcon').textContent = currentUser.name.substring(0, 2).toUpperCase(); 
}

function showToast(msg) { const t = $('toast'); if(!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function closeModal(id) { if($(id))$(id).classList.remove('show'); }
function showPage(pageId, btn = null) { 
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); 
    if($(pageId))$(pageId).classList.add('active'); 
    if (btn && btn.classList.contains('nav-button')) { document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active')); btn.classList.add('active'); } 
}
function saveLocal() { localStorage.setItem('arsy_db', JSON.stringify(db)); }
function updateUI() { 
    document.querySelectorAll('.dynamic-outlet-name').forEach(el => el.textContent = db.outlet.name); 
    if($('akunOutletAddress'))$('akunOutletAddress').textContent = `${db.outlet.address}, ${db.outlet.city}`; 
    if($('akunOutletPhone'))$('akunOutletPhone').textContent = db.outlet.phone; 
    renderTransactions('Semua'); updateDashboardStats(); renderCustomers(); renderServices();
}

function updateDashboardStats() { 
    const todayStr = new Date().toLocaleDateString('id-ID'); 
    const todayTrx = (db.transactions||[]).filter(t => new Date(t.date).toLocaleDateString('id-ID') === todayStr); 
    const income = todayTrx.reduce((s, t) => { if(t.isPaid || t.payStatus === 'Lunas') return s + t.total; if(t.payStatus === 'DP' && t.dpAmount) return s + Number(t.dpAmount); return s; }, 0);
    if($('todayIncome'))$('todayIncome').textContent = formatRp(income); 
    if($('todayTransactions'))$('todayTransactions').textContent = todayTrx.length; 
    if($('pendingTransactions'))$('pendingTransactions').textContent = (db.transactions||[]).filter(t => t.status !== 'Selesai' && t.status !== 'Batal').length; 
    if($('totalCustomers'))$('totalCustomers').textContent = (db.customers||[]).length; 
}

// Menangani klik dari Dashboard ke Tab Transaksi
function openDashboardDetail(type) {
    showPage('transactionsPage');
    if(type === 'omset' || type === 'transaksi') filterTransactionsTab('Semua', document.querySelectorAll('.trans-tab')[0]);
    else if(type === 'pending') filterTransactionsTab('Antrian', document.querySelectorAll('.trans-tab')[1]);
}

function filterTransactionsTab(filter, btn) {
    if(btn) { document.querySelectorAll('.trans-tab').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
    renderTransactions(filter);
}

function renderTransactions(filter = 'Semua') { 
    let trxs = db.transactions || []; if(filter !== 'Semua') trxs = trxs.filter(t => t.status === filter); 
    const html = trxs.map(t => `<div class="transaction-item" onclick="openTrxDetail('${t.id}')" style="cursor:pointer;"><div class="item-main"><h3 style="margin-bottom:2px;">${t.customer}</h3><p style="font-size:12px; color:var(--muted); margin-bottom:4px;">${t.id}</p><span class="status status-${t.status.toLowerCase().replace(' ','')}">${t.status}</span></div><div class="item-price" style="text-align:right;">${formatRp(t.total)}<br><small style="color:${t.isPaid?'#16a34a':(t.payStatus==='DP'?'#d97706':'#ea8b00')}; font-weight:bold;">${t.isPaid?'Lunas':(t.payStatus==='DP'?'DP':'Belum Lunas')}</small></div></div>`).join(''); 
    if($('allTransactions'))$('allTransactions').innerHTML = html || '<div class="empty-state">Belum ada transaksi di tab ini.</div>'; 
    if($('recentTransactions') && filter === 'Semua') {$('recentTransactions').innerHTML = trxs.slice(0,5).map(t => `<div class="transaction-item" onclick="openTrxDetail('${t.id}')" style="cursor:pointer;"><div class="item-main"><h3 style="margin-bottom:4px;">${t.customer}</h3><span class="status status-${t.status.toLowerCase().replace(' ','')}">${t.status}</span></div><div class="item-price">${formatRp(t.total)}</div></div>`).join('') || '<div class="empty-state">Belum ada transaksi.</div>'; } 
}

function renderAllTransactions() {
    const q = $('transactionSearchInput') ?$('transactionSearchInput').value.toLowerCase() : '';
    let trxs = (db.transactions || []).filter(t => t.customer.toLowerCase().includes(q));
    const html = trxs.map(t => `<div class="transaction-item" onclick="openTrxDetail('${t.id}')" style="cursor:pointer;"><div class="item-main"><h3 style="margin-bottom:2px;">${t.customer}</h3><p style="font-size:12px; color:var(--muted); margin-bottom:4px;">${t.id}</p><span class="status status-${t.status.toLowerCase().replace(' ','')}">${t.status}</span></div><div class="item-price" style="text-align:right;">${formatRp(t.total)}</div></div>`).join('');
    if($('allTransactions'))$('allTransactions').innerHTML = html || '<div class="empty-state">Tidak ditemukan.</div>';
}

function renderCustomers() { 
    if(!$('customersListContainer')) return; const custs = db.customers \vert{}\vert{} [];$('customersListContainer').innerHTML = custs.map(c => `<div style="background:white; padding:12px 15px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px;"><div style="width:40px; height:40px; border-radius:50%; background:#e1edff; color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:18px;">${c.name.charAt(0).toUpperCase()}</div><div><h3 style="font-size:15px; color:var(--text);">${c.name}</h3><p style="font-size:12px; color:var(--muted);">Total Transaksi: ${c.totalTrx}</p></div></div>`).join('') || '<div class="empty-state">Belum ada pelanggan.</div>'; 
}
function renderServices() { 
    if(!$('servicesList')) return; const srvs = db.services \vert{}\vert{} []; if(srvs.length === 0) {$('servicesList').innerHTML = '<div class="empty-state">Belum ada layanan.</div>'; return; } 
    $('servicesList').innerHTML = srvs.map(s => `<div class="service-item"><div style="flex:1;"><h3 style="font-size:15px; margin-bottom:4px; color:var(--text);">${s.name}</h3></div><div style="text-align:right;"><div style="font-weight:bold; color:var(--primary); font-size:14px;">${formatRp(s.price)} / ${s.unit}</div></div></div>`).join(''); 
}
// Pengaturan & Modal Umum
function openTransactionModal() { if($('transactionModal')) $('transactionModal').classList.add('show'); }
function saveTransaction(e) { e.preventDefault(); showToast("Transaksi disimpan!"); closeModal('transactionModal'); updateUI(); }
function openSelectServiceModal() { if($('selectServiceModal')) $('selectServiceModal').classList.add('show'); }
function openServiceModal() { if($('serviceModal')) $('serviceModal').classList.add('show'); }
function saveService(e) { e.preventDefault(); showToast("Layanan disimpan!"); closeModal('serviceModal'); }
function saveOutlet(e) { e.preventDefault(); showToast("Data Outlet diperbarui!"); }
function openUserModal() { if($('userModal')) $('userModal').classList.add('show'); }
function saveUser(e) { e.preventDefault(); showToast("Data Karyawan disimpan!"); closeModal('userModal'); }
function connectPrinter() { showToast("Menyambungkan ke Printer Bluetooth..."); }
function openTrxDetail(id) { showToast("Buka detail transaksi: " + id); }

// Menu Laporan
function bukaDetailLaporan(type) { 
    if($('laporanMenuView')) $('laporanMenuView').style.display = 'none'; 
    if($('laporanDetailView')) $('laporanDetailView').style.display = 'block'; 
    showToast("Memuat laporan " + type);
}
function kembaliKeMenuLaporan() { 
    if($('laporanDetailView')) $('laporanDetailView').style.display = 'none'; 
    if($('laporanMenuView')) $('laporanMenuView').style.display = 'block'; 
}
function terapkanFilterLaporan() { showToast("Filter laporan diterapkan"); }

// Integrasi Menu Keuangan Istri (Sisi Titi)
function switchFinTab(tab) {
    if(tab === 'calc') { 
        if($('finCalcView')) $('finCalcView').style.display='flex'; 
        if($('finHomeView')) $('finHomeView').style.display='none'; 
    } else { 
        if($('finHomeView')) $('finHomeView').style.display='block'; 
        if($('finCalcView')) $('finCalcView').style.display='none'; 
    }
}
function openFinModal(type) { showToast('Membuka detail keuangan: ' + type); }
function openDiariModal() { showToast('Membuka catatan diari harian.'); }
function calcFinance() { showToast('Menghitung data bulan ini...'); }

// Logika Kalkulator Keuangan
function calcNum(num) { const sc = $('calcScreen'); if(sc) { if(sc.value === '0') sc.value = num; else sc.value += num; } }
function calcClear() { if($('calcScreen')) $('calcScreen').value = '0'; }
function calcBackSpace() { const sc = $('calcScreen'); if(sc) sc.value = sc.value.slice(0, -1) || '0'; }
function calcAction(op) { if($('calcOp')) $('calcOp').innerText = op; }
