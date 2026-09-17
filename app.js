const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbztgW5hFuF2stW7Q4MCwplr4ufA8cNmTOhOMqr0SELpZ3IDPSal2fPMFd2MNR2gj52P/exec";

// Helper
const $ = id => document.getElementById(id);
const formatRp = num => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

// --- PERSIAPAN DATABASE ---
let db = JSON.parse(localStorage.getItem('arsy_db')) || {};
if (!db.users || db.users.length === 0) db.users = [{ id: '1', name: 'Admin', pin: '1985', role: 'Admin' }];
if (!db.expenses) db.expenses = [];
if (!db.notes) db.notes = [];
if (!db.calcDocs) db.calcDocs = [{id:1, rows:[]}];
if (!db.outlet) db.outlet = { name: "Arsy Laundry", phone: "08123456789", city: "Mojokerto", address: "Mlirip" };
if (!db.services) db.services = [];
if (!db.transactions) db.transactions = [];

let currentUser = JSON.parse(localStorage.getItem('arsy_user'));
let calcInput = "0", calcOp = "+", isCalcResult = false;

window.onload = () => {
    if (currentUser) {
        initApp();
    } else {
        $('loginModal').classList.add('show');
    }
    
    // Fitur Enter Keyboard HP untuk Login
    const pinInput = $('loginPin');
    if (pinInput) {
        pinInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); loginApp(); }
        });
    }
};

// --- AUTHENTIKASI & MULTI-USER ---
function loginApp() {
    const pin = $('loginPin').value;
    const user = db.users.find(u => u.pin === pin);
    if (user) {
        currentUser = user;
        localStorage.setItem('arsy_user', JSON.stringify(currentUser));
        $('loginModal').classList.remove('show');
        $('loginPin').value = "";
        $('loginError').style.display = 'none';
        initApp();
    } else {
        $('loginError').style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('arsy_user');
    window.location.reload(); 
}

function initApp() {
    $('mainBottomNav').style.display = 'flex';
    applyRoleRestrictions();
    updateUI();
    fetchCloudData();
}

function applyRoleRestrictions() {
    const adminEls = document.querySelectorAll('.admin-only');
    adminEls.forEach(el => {
        if (currentUser.role === 'Admin') {
            el.classList.remove('admin-only'); 
        } else {
            el.style.display = 'none';
        }
    });
    
    if($('akunProfileInitial')) $('akunProfileInitial').textContent = currentUser.name.substring(0, 2).toUpperCase();
    if($('akunUserRoleText')) $('akunUserRoleText').textContent = currentUser.role;
    if($('headerProfileIcon')) $('headerProfileIcon').textContent = currentUser.name.substring(0, 2).toUpperCase();
}

// --- SINKRONISASI CLOUD ---
async function fetchCloudData() {
    try {
        const res = await fetch(WEB_APP_URL);
        const data = await res.json();
        if(data && data.outlet) {
            db = { ...db, ...data };
            if(!db.users || db.users.length === 0) db.users = [{ id: '1', name: 'Admin', pin: '1985', role: 'Admin' }];
            saveLocal();
            updateUI();
        }
    } catch (e) { console.log("Offline mode active."); }
}

async function saveToCloud() {
    saveLocal();
    showToast("Menyimpan ke Cloud...");
    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'saveAll', ...db })
        });
        showToast("Tersimpan ke Cloud ✔️");
    } catch (e) { showToast("Gagal menyimpan. Cek Internet ❌"); }
}

function saveLocal() { localStorage.setItem('arsy_db', JSON.stringify(db)); }
function showToast(msg) {
    const t = $('toast'); 
    if(!t) return;
    t.textContent = msg; 
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}
function closeModal(id) { $(id).classList.remove('show'); }
function showPage(pageId, btn = null) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if($(pageId)) $(pageId).classList.add('active');
    if (btn && btn.classList.contains('nav-button')) {
        document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}

// --- RENDER SEMUA UI ---
function updateUI() {
    document.querySelectorAll('.dynamic-outlet-name').forEach(el => el.textContent = db.outlet.name);
    if($('akunOutletAddress')) $('akunOutletAddress').textContent = `${db.outlet.address}, ${db.outlet.city}`;
    if($('akunOutletPhone')) $('akunOutletPhone').textContent = db.outlet.phone;
    
    if($('outName')) {
        $('outName').value = db.outlet.name; $('outPhone').value = db.outlet.phone;
        $('outCity').value = db.outlet.city; $('outAddress').value = db.outlet.address;
    }
    
    renderUsers();
    calcFinance();
    renderServices();
    renderTransactions('Semua');
    updateDashboardStats();
}

// --- PENGATURAN OUTLET & USER ---
function saveOutlet(e) {
    e.preventDefault();
    db.outlet = { name:$('outName').value, phone:$('outPhone').value, city:$('outCity').value, address:$('outAddress').value };
    saveToCloud(); updateUI(); showPage('akunPage');
}
function openUserModal() { $('userName').value=''; $('userPin').value=''; $('userModal').classList.add('show'); }
function saveUser(e) {
    e.preventDefault();
    db.users.push({ id: Date.now().toString(), name: $('userName').value, role: $('userRole').value, pin: $('userPin').value });
    saveToCloud(); renderUsers(); closeModal('userModal');
}
function deleteUser(id) {
    if(db.users.length <= 1) return alert("Minimal harus ada 1 karyawan/admin!");
    if(confirm("Hapus karyawan ini?")) { db.users = db.users.filter(u => u.id !== id); saveToCloud(); renderUsers(); }
}
function renderUsers() {
    const c = $('usersListContainer');
    if(!c) return;
    c.innerHTML = db.users.map(u => `
        <div style="background:white; padding:15px; border-radius:12px; border:1px solid var(--border); margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div><h3 style="font-size:15px;">${u.name}</h3><span style="font-size:11px; background:#e1edff; padding:2px 6px; border-radius:6px; color:#1769e0; font-weight:bold;">${u.role}</span><p style="font-size:12px; color:var(--muted); margin-top:5px;">PIN: ${u.pin}</p></div>
            <button onclick="deleteUser('${u.id}')" style="background:#fee2e2; color:#dc2626; border:none; padding:8px; border-radius:8px; font-weight:bold;">Hapus</button>
        </div>
    `).join('');
    }
// ==========================================
// LAUNDRY LOGIC (LAYANAN FULL DETAIL)
// ==========================================
function openServiceModal() { 
    if($('serviceForm')) $('serviceForm').reset();
    $('srvPrice').value = '0'; 
    $('srvMinQty').value = '1';
    $('srvDuration').value = '1 Hari';
    $('serviceModal').classList.add('show'); 
}

function saveService(e) {
    e.preventDefault();
    if(!db.services) db.services = [];
    
    // Ambil data centang proses laundry
    let processes = [];
    document.querySelectorAll('.srvProcess:checked').forEach(cb => processes.push(cb.value));

    db.services.push({ 
        id: Date.now().toString(), 
        name: $('srvName').value, 
        processes: processes,
        price: Number($('srvPrice').value), 
        unit: $('srvUnit').value,
        duration: $('srvDuration').value,
        minQty: Number($('srvMinQty').value),
        isPinned: $('srvPinned').checked
    });
    
    saveToCloud(); 
    renderServices(); 
    closeModal('serviceModal'); 
}

function renderServices() {
    if(!$('servicesList')) return;
    const srvs = db.services || [];
    
    if(srvs.length === 0) {
        $('servicesList').innerHTML = '<div class="empty-state">Belum ada layanan.<br>Klik tombol <b>+ Tambah</b> di atas.</div>';
        return;
    }

    // Urutkan: Yang disematkan (Favorit) muncul paling atas
    const sortedSrvs = [...srvs].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    
    $('servicesList').innerHTML = sortedSrvs.map(s => {
        const processesText = (s.processes && s.processes.length > 0) ? s.processes.join(' - ') : 'Tanpa Proses';
        const pinnedBadge = s.isPinned ? '<span style="background:#e1edff; color:#1769e0; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:8px;">Disematkan</span>' : '';
        
        return `
        <div class="service-item" style="display:flex; flex-direction:column; align-items:stretch; padding:15px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div style="flex:1;">
                    <h3 style="font-size:15px; margin-bottom:4px; color:var(--text);">${s.name} ${pinnedBadge}</h3>
                    <p style="font-size:12px; color:var(--muted); margin-bottom:2px;">${processesText}</p>
                    <p style="font-size:12px; color:var(--muted);">Min. ${s.minQty || 1} ${s.unit} • ${s.duration || '-'}</p>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:bold; color:var(--primary); font-size:14px;">${formatRp(s.price)} / ${s.unit}</div>
                    <button onclick="delService('${s.id}')" style="background:transparent; color:#ef4444; border:none; font-size:12px; font-weight:bold; cursor:pointer; margin-top:8px; padding:0;">Ketuk untuk hapus</button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function delService(id) { 
    if(confirm("Hapus layanan ini?")) { db.services = db.services.filter(s => s.id !== id); saveToCloud(); renderServices(); } 
}

// ==========================================
// TRANSAKSI
// ==========================================
function openTransactionModal() {
    if(!db.services || db.services.length === 0) return alert("Tambahkan layanan terlebih dahulu di menu Layanan!");
    
    // Urutkan opsi select juga, favorit di atas
    const sortedSrvs = [...db.services].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    $('trxService').innerHTML = sortedSrvs.map(s => `<option value="${s.id}">${s.name} - ${formatRp(s.price)}/${s.unit}</option>`).join('');
    
    $('trxCustomer').value=''; $('trxQty').value=''; 
    $('transactionModal').classList.add('show');
}
function saveTransaction(e) {
    e.preventDefault();
    if(!db.transactions) db.transactions = [];
    const srv = db.services.find(s => s.id === $('trxService').value);
    const qty = Number($('trxQty').value);
    db.transactions.unshift({
        id: 'TRX-' + Date.now(), date: new Date().toISOString(), customer: $('trxCustomer').value,
        service: srv.name, qty: qty, total: srv.price * qty, status: 'Antrian'
    });
    saveToCloud(); renderTransactions('Semua'); closeModal('transactionModal'); updateDashboardStats();
}
function renderTransactions(filter = 'Semua') {
    let trxs = db.transactions || [];
    if(filter !== 'Semua') trxs = trxs.filter(t => t.status === filter);
    
    const html = trxs.map(t => `
        <div class="transaction-item">
            <div class="item-main">
                <h3>${t.customer}</h3><p>${t.service} (${t.qty})</p>
                <span class="status status-${t.status.toLowerCase().replace(' ','')}">${t.status}</span>
            </div>
            <div class="item-price" style="text-align:right;">
                ${formatRp(t.total)}<br><small style="color:var(--muted); font-weight:normal;">${t.date.substring(0,10)}</small><br>
                <button onclick="updateTrxStatus('${t.id}')" style="margin-top:8px; background:var(--primary); color:white; padding:6px 12px; border-radius:6px; font-size:11px; font-weight:bold;">Update Status</button>
            </div>
        </div>
    `).join('');
    
    if($('allTransactions')) $('allTransactions').innerHTML = html || '<div class="empty-state">Belum ada transaksi di tab ini.</div>';
    if($('recentTransactions') && filter === 'Semua') {
        $('recentTransactions').innerHTML = trxs.slice(0,5).map(t => `
            <div class="transaction-item">
                <div class="item-main"><h3>${t.customer}</h3><p>${t.service}</p><span class="status status-${t.status.toLowerCase().replace(' ','')}">${t.status}</span></div>
                <div class="item-price">${formatRp(t.total)}</div>
            </div>
        `).join('') || '<div class="empty-state">Belum ada transaksi.</div>';
    }
}
function updateTrxStatus(id) {
    const t = db.transactions.find(x => x.id === id);
    const statusFlow = ['Antrian', 'Proses', 'Siap Diambil', 'Selesai'];
    const next = statusFlow[statusFlow.indexOf(t.status) + 1] || 'Selesai';
    if(confirm(`Ubah status transaksi ${t.customer} menjadi "${next}"?`)) { 
        t.status = next; saveToCloud(); renderTransactions('Semua'); updateDashboardStats(); 
    }
}
function filterTransactionsTab(status, btn) {
    document.querySelectorAll('.trans-tab').forEach(b => { b.style.background = '#f4f7fb'; b.style.color = 'var(--muted)'; });
    btn.style.background = '#e1edff'; btn.style.color = 'var(--primary)';
    renderTransactions(status);
}
function updateDashboardStats() {
    const today = new Date().toISOString().substring(0,10);
    const todayTrx = (db.transactions||[]).filter(t => t.date.startsWith(today));
    if($('todayIncome')) $('todayIncome').textContent = formatRp(todayTrx.reduce((s, t) => s + t.total, 0));
    if($('todayTransactions')) $('todayTransactions').textContent = todayTrx.length;
    if($('pendingTransactions')) $('pendingTransactions').textContent = (db.transactions||[]).filter(t => t.status !== 'Selesai').length;
}

// ==========================================
// KEUANGAN SISI TITI
// ==========================================
function switchFinTab(tab) {
    $('finHomeView').style.display = tab === 'home' ? 'block' : 'none';
    $('finCalcView').style.display = tab === 'calc' ? 'flex' : 'none';
    $('finReportView').style.display = tab === 'report' ? 'block' : 'none';
}
function calcFinance() {
    if(!$('finMonth')) return;
    const month = $('finMonth').value || new Date().toISOString().substring(0,7);
    $('finMonth').value = month;
    const mExp = (db.expenses || []).filter(x => x.date && x.date.startsWith(month));
    
    const sum = cat => mExp.filter(x => x.category === cat).reduce((t, x) => t + Number(x.amount), 0);
    const harian = sum('HARIAN'), lain = sum('LAIN2'), laundry = sum('LAUNDRY'), tabungan = sum('TABUNGAN / ARISAN');
    
    const totalExp = harian + lain + laundry;
    $('finSubHarian').textContent = formatRp(harian); $('finSubLain').textContent = formatRp(lain);
    $('finSubLaundry').textContent = formatRp(laundry); $('finSubTabungan').textContent = formatRp(tabungan);
    $('finTotalExp').textContent = formatRp(totalExp); $('finTotalAll').textContent = formatRp(totalExp + tabungan);
    $('finSubDiari').textContent = `${(db.notes || []).length} Catatan`;

    $('finReportBody').innerHTML = mExp.map(x => `
        <tr>
            <td>${x.date.substring(5,10)}</td>
            <td><b>${x.category}</b><br><small style="color:var(--muted);">${x.desc}</small></td>
            <td style="font-weight:bold; color:${x.category.includes('TABUNGAN')?'#16a34a':'#dc2626'};">${formatRp(x.amount)}</td>
            <td><button onclick="delFinance('${x.id}')" style="background:#fee2e2; border:none; color:red; padding:4px 8px; border-radius:4px; font-weight:bold;">✕</button></td>
        </tr>
    `).join('');
}
function openFinModal(cat) {
    $('finCat').value = cat; $('finModalTitle').textContent = `Catat: ${cat}`;
    $('finDate').value = new Date().toISOString().split('T')[0];
    $('finDesc').value = ''; $('finAmount').value = '';
    $('finInputModal').classList.add('show');
}
function saveFinance(e) {
    e.preventDefault();
    if(!db.expenses) db.expenses = [];
    db.expenses.push({ id: Date.now().toString(), date: $('finDate').value, category: $('finCat').value, desc: $('finDesc').value, amount: Number($('finAmount').value) });
    $('finMonth').value = $('finDate').value.substring(0,7);
    saveToCloud(); calcFinance(); closeModal('finInputModal');
}
function delFinance(id) { if(confirm("Hapus pengeluaran ini?")) { db.expenses = db.expenses.filter(x => x.id !== id); saveToCloud(); calcFinance(); } }

function openDiariModal() {
    $('noteDate').value = new Date().toISOString().split('T')[0]; $('noteContent').value = '';
    renderNotes(); $('diariModal').classList.add('show');
}
function saveNote(e) {
    e.preventDefault();
    if(!db.notes) db.notes = [];
    db.notes.unshift({ id: Date.now().toString(), date: $('noteDate').value, content: $('noteContent').value });
    $('noteContent').value = ''; saveToCloud(); renderNotes(); calcFinance();
}
function delNote(id) { if(confirm("Hapus catatan ini?")) { db.notes = db.notes.filter(n => n.id !== id); saveToCloud(); renderNotes(); calcFinance(); } }
function renderNotes() {
    if(!$('notesListContainer')) return;
    $('notesListContainer').innerHTML = (db.notes || []).map(n => `
        <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span style="font-size:12px; font-weight:bold; color:#0284c7;">📅 ${n.date}</span><button onclick="delNote('${n.id}')" style="color:red; background:none; border:none; font-weight:bold;">✕</button></div>
            <p style="font-size:13px; color:var(--text); white-space:pre-wrap;">${n.content}</p>
        </div>
    `).join('');
}

// --- KALKULATOR TAPE ---
function updateCalc() { if(!$('calcScreen')) return; $('calcScreen').value = Number(calcInput).toLocaleString('id-ID'); if($('calcOp')) $('calcOp').textContent = calcOp; renderCalcTape(); }
function calcNum(num) {
    if(isCalcResult) { calcInput = num; isCalcResult = false; }
    else { calcInput = calcInput === "0" && num !== "." ? num : calcInput + num; }
    updateCalc();
}
function calcAction(op) {
    if(op === 'perc') { calcInput = String(Number(calcInput)/100); return updateCalc(); }
    let val = Number(calcInput);
    if(val !== 0) {
        if(!db.calcDocs[0]) db.calcDocs[0] = {id:1, rows:[]};
        db.calcDocs[0].rows.push({ op: calcOp, val: val });
        calcInput = "0"; saveLocal();
    }
    calcOp = op; updateCalc();
}
function calcBackSpace() { calcInput = calcInput.length > 1 ? calcInput.slice(0,-1) : "0"; updateCalc(); }
function calcClear() { calcInput = "0"; calcOp = "+"; if(db.calcDocs[0]) db.calcDocs[0].rows = []; saveLocal(); updateCalc(); }
function calcEquals() {
    let val = Number(calcInput);
    if(!db.calcDocs[0]) db.calcDocs[0] = {id:1, rows:[]};
    if(val !== 0) { db.calcDocs[0].rows.push({ op: calcOp, val: val }); calcInput = "0"; }
    if(db.calcDocs[0].rows.length > 0 && !db.calcDocs[0].rows[db.calcDocs[0].rows.length-1].isResult) {
        db.calcDocs[0].rows.push({ isResult: true });
        isCalcResult = true; calcOp = "+"; saveLocal(); updateCalc();
    }
}
function renderCalcTape() {
    let total = 0;
    if(!$('calcRowsContainer')) return;
    $('calcRowsContainer').innerHTML = (db.calcDocs[0]?.rows || []).map((r, i) => {
        if(r.isResult) return `<div style="border-top:2px solid #0284c7; background:#e0f2fe; padding:6px; font-weight:bold; color:#0284c7; display:flex; justify-content:space-between;"><span>= ${total.toLocaleString('id-ID')}</span><button onclick="delCalcRow(${i})" style="color:red; background:none;">✕</button></div>`;
        if(r.op === '+') total += r.val; else if(r.op === '-') total -= r.val; else if(r.op === '×') total *= r.val; else if(r.op === '÷') total /= r.val;
        return `<div style="padding:6px; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between; font-size:14px; font-weight:bold; color:#334155;"><span>${r.op} ${r.val.toLocaleString('id-ID')}</span><button onclick="delCalcRow(${i})" style="color:red; background:none;">✕</button></div>`;
    }).join('');
    let c = $('calcRowsContainer'); c.scrollTop = c.scrollHeight;
}
function delCalcRow(i) { db.calcDocs[0].rows.splice(i, 1); saveLocal(); updateCalc(); }
        
