const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbztgW5hFuF2stW7Q4MCwplr4ufA8cNmTOhOMqr0SELpZ3IDPSal2fPMFd2MNR2gj52P/exec";

// DOM Selector Helper
const $ = id => document.getElementById(id);
const formatRp = num => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

// Default Database Structure
let db = JSON.parse(localStorage.getItem('arsy_db')) || {
    transactions: [], customers: [], expenses: [], notes: [], calcDocs: [{id:1, rows:[]}], services: [],
    outlet: { name: "Arsy Laundry", phone: "08123456789", city: "Mojokerto", address: "Mlirip" },
    users: [{ id: '1', name: 'Admin', pin: '1985', role: 'Admin' }]
};
let currentUser = JSON.parse(localStorage.getItem('arsy_user'));

// Kalkulator State
let calcInput = "0", calcOp = "+", isCalcResult = false;

window.onload = () => {
    if (currentUser) {
        initApp();
    } else {
        $('loginModal').classList.add('show');
    }
};

// --- AUTH & SYNC SYSTEM ---
function loginApp() {
    const pin = $('loginPin').value;
    const user = db.users.find(u => u.pin === pin);
    if (user) {
        currentUser = user;
        localStorage.setItem('arsy_user', JSON.stringify(currentUser));
        $('loginModal').classList.remove('show');
        $('loginPin').value = "";
        initApp();
    } else {
        $('loginError').style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('arsy_user');
    currentUser = null;
    $('loginModal').classList.add('show');
    $('mainBottomNav').style.display = 'none';
}

function initApp() {
    $('mainBottomNav').style.display = 'flex';
    applyRoleRestrictions();
    updateUI();
    fetchCloudData(); // Sync diam-diam di background
}

function applyRoleRestrictions() {
    const adminEls = document.querySelectorAll('.admin-only');
    adminEls.forEach(el => {
        el.style.display = (currentUser.role === 'Admin') ? '' : 'none';
    });
    $('akunProfileInitial').textContent = currentUser.name.substring(0, 2).toUpperCase();
    $('akunUserRoleText').textContent = currentUser.role;
    $('headerProfileIcon').textContent = currentUser.name.substring(0, 2).toUpperCase();
}

async function fetchCloudData() {
    try {
        const res = await fetch(WEB_APP_URL);
        const data = await res.json();
        if(data && data.outlet) {
            db = { ...db, ...data };
            if(db.users.length === 0) db.users = [{ id: '1', name: 'Admin', pin: '1985', role: 'Admin' }];
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
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}
function closeModal(id) { $(id).classList.remove('show'); }
function showPage(pageId, btn = null) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    $(pageId).classList.add('active');
    if (btn && btn.classList.contains('nav-button')) {
        document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}

function updateUI() {
    document.querySelectorAll('.dynamic-outlet-name').forEach(el => el.textContent = db.outlet.name);
    $('akunOutletAddress').textContent = `${db.outlet.address}, ${db.outlet.city}`;
    $('akunOutletPhone').textContent = db.outlet.phone;
    
    // Set form outlet
    $('outName').value = db.outlet.name; $('outPhone').value = db.outlet.phone;
    $('outCity').value = db.outlet.city; $('outAddress').value = db.outlet.address;

    renderUsers();
    calcFinance();
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
    const newUser = { id: Date.now().toString(), name: $('userName').value, role: $('userRole').value, pin: $('userPin').value };
    db.users.push(newUser);
    saveToCloud(); renderUsers(); closeModal('userModal');
}
function deleteUser(id) {
    if(db.users.length <= 1) return alert("Minimal harus ada 1 karyawan/admin!");
    if(confirm("Hapus karyawan ini?")) {
        db.users = db.users.filter(u => u.id !== id);
        saveToCloud(); renderUsers();
    }
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
// KEUANGAN SISI TITI & DIARI
// ==========================================
function switchFinTab(tab) {
    $('finHomeView').style.display = tab === 'home' ? 'block' : 'none';
    $('finCalcView').style.display = tab === 'calc' ? 'flex' : 'none';
    $('finReportView').style.display = tab === 'report' ? 'block' : 'none';
}

function calcFinance() {
    const month = $('finMonth').value || new Date().toISOString().substring(0,7);
    $('finMonth').value = month;
    const mExp = db.expenses.filter(x => x.date.startsWith(month));
    
    const sum = cat => mExp.filter(x => x.category === cat).reduce((t, x) => t + Number(x.amount), 0);
    const harian = sum('HARIAN'), lain = sum('LAIN2'), laundry = sum('LAUNDRY'), tabungan = sum('TABUNGAN');
    
    const totalExp = harian + lain + laundry;
    $('finSubHarian').textContent = formatRp(harian); $('finSubLain').textContent = formatRp(lain);
    $('finSubLaundry').textContent = formatRp(laundry); $('finSubTabungan').textContent = formatRp(tabungan);
    $('finTotalExp').textContent = formatRp(totalExp); $('finTotalAll').textContent = formatRp(totalExp + tabungan);
    $('finSubDiari').textContent = `${db.notes.length} Catatan`;

    // Render Laporan Detail
    $('finReportBody').innerHTML = mExp.map(x => `
        <tr>
            <td>${x.date.substring(5,10)}</td>
            <td><b>${x.category}</b><br><small style="color:var(--muted);">${x.desc}</small></td>
            <td style="font-weight:bold; color:${x.category==='TABUNGAN'?'#16a34a':'#dc2626'};">${formatRp(x.amount)}</td>
            <td><button onclick="delFinance('${x.id}')" style="background:#fee2e2; border:none; color:red; padding:4px 8px; border-radius:4px; font-weight:bold;">✕</button></td>
        </tr>
    `).join('');
}

function openFinModal(cat) {
    $('finCat').value = cat;
    $('finModalTitle').textContent = `Catat: ${cat}`;
    $('finDate').value = new Date().toISOString().split('T')[0];
    $('finDesc').value = ''; $('finAmount').value = '';
    $('finInputModal').classList.add('show');
}
function saveFinance(e) {
    e.preventDefault();
    db.expenses.push({ id: Date.now().toString(), date: $('finDate').value, category: $('finCat').value, desc: $('finDesc').value, amount: Number($('finAmount').value) });
    $('finMonth').value = $('finDate').value.substring(0,7);
    saveToCloud(); calcFinance(); closeModal('finInputModal');
}
function delFinance(id) {
    if(confirm("Hapus pengeluaran ini?")) { db.expenses = db.expenses.filter(x => x.id !== id); saveToCloud(); calcFinance(); }
}

// DIARI
function openDiariModal() {
    $('noteDate').value = new Date().toISOString().split('T')[0];
    $('noteContent').value = '';
    renderNotes(); $('diariModal').classList.add('show');
}
function saveNote(e) {
    e.preventDefault();
    db.notes.unshift({ id: Date.now().toString(), date: $('noteDate').value, content: $('noteContent').value });
    $('noteContent').value = ''; saveToCloud(); renderNotes(); calcFinance();
}
function delNote(id) {
    if(confirm("Hapus catatan ini?")) { db.notes = db.notes.filter(n => n.id !== id); saveToCloud(); renderNotes(); calcFinance(); }
}
function renderNotes() {
    $('notesListContainer').innerHTML = db.notes.map(n => `
        <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><span style="font-size:12px; font-weight:bold; color:#0284c7;">📅 ${n.date}</span><button onclick="delNote('${n.id}')" style="color:red; background:none; border:none; font-weight:bold;">✕</button></div>
            <p style="font-size:13px; color:var(--text); white-space:pre-wrap;">${n.content}</p>
        </div>
    `).join('');
}

// KALKULATOR TAPE
function updateCalc() { $('calcScreen').value = Number(calcInput).toLocaleString('id-ID'); $('calcOp').textContent = calcOp; renderCalcTape(); }
function calcNum(num) {
    if(isCalcResult) { calcInput = num; isCalcResult = false; }
    else { calcInput = calcInput === "0" && num !== "." ? num : calcInput + num; }
    updateCalc();
}
function calcAction(op) {
    if(op === 'perc') { calcInput = String(Number(calcInput)/100); return updateCalc(); }
    let val = Number(calcInput);
    if(val !== 0) {
        db.calcDocs[0].rows.push({ op: calcOp, val: val });
        calcInput = "0"; saveLocal();
    }
    calcOp = op; updateCalc();
}
function calcBackSpace() { calcInput = calcInput.length > 1 ? calcInput.slice(0,-1) : "0"; updateCalc(); }
function calcClear() { calcInput = "0"; calcOp = "+"; db.calcDocs[0].rows = []; saveLocal(); updateCalc(); }
function calcEquals() {
    let val = Number(calcInput);
    if(val !== 0) { db.calcDocs[0].rows.push({ op: calcOp, val: val }); calcInput = "0"; }
    if(db.calcDocs[0].rows.length > 0 && !db.calcDocs[0].rows[db.calcDocs[0].rows.length-1].isResult) {
        db.calcDocs[0].rows.push({ isResult: true });
        isCalcResult = true; calcOp = "+"; saveLocal(); updateCalc();
    }
}
function renderCalcTape() {
    let total = 0;
    $('calcRowsContainer').innerHTML = db.calcDocs[0].rows.map((r, i) => {
        if(r.isResult) return `<div style="border-top:2px solid #0284c7; background:#e0f2fe; padding:6px; font-weight:bold; color:#0284c7; display:flex; justify-content:space-between;"><span>= ${total.toLocaleString('id-ID')}</span><button onclick="delCalcRow(${i})" style="color:red; background:none;">✕</button></div>`;
        if(r.op === '+') total += r.val; else if(r.op === '-') total -= r.val; else if(r.op === '×') total *= r.val; else if(r.op === '÷') total /= r.val;
        return `<div style="padding:6px; border-bottom:1px dashed #cbd5e1; display:flex; justify-content:space-between; font-size:14px; font-weight:bold; color:#334155;"><span>${r.op} ${r.val.toLocaleString('id-ID')}</span><button onclick="delCalcRow(${i})" style="color:red; background:none;">✕</button></div>`;
    }).join('');
    let c = $('calcRowsContainer'); c.scrollTop = c.scrollHeight;
}
function delCalcRow(i) { db.calcDocs[0].rows.splice(i, 1); saveLocal(); updateCalc(); }
  
