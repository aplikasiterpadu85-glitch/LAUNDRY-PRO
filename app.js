const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbztgW5hFuF2stW7Q4MCwplr4ufA8cNmTOhOMqr0SELpZ3IDPSal2fPMFd2MNR2gj52P/exec";
const $ = id => document.getElementById(id);
const formatRp = num => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

let db = JSON.parse(localStorage.getItem('arsy_db')) || {};
if (!db.users || db.users.length === 0) db.users = [{ id: '1', name: 'Admin', pin: '1985', role: 'Admin' }];
if (!db.outlet) db.outlet = { name: "Arsy Laundry", phone: "08123456789", city: "Mojokerto", address: "Mlirip" };
if (!db.services) db.services = []; if (!db.transactions) db.transactions = []; if (!db.customers) db.customers = [];
if (!db.notaCustom) db.notaCustom = { hideLogo: true, hideOutlet: false, hideAddress: false, hideCashier: true, hideCustomer: false, showCat: false, hideMsg: true, hidePerfume: true, hidePowered: true, showDay: true };

let currentUser = JSON.parse(localStorage.getItem('arsy_user'));
let tempTrxServices = []; let currentViewTrxId = null;

window.onload = () => { if (currentUser) { initApp(); } else { $('loginModal').classList.add('show'); } if ($('loginPin')) { $('loginPin').addEventListener('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); loginApp(); } }); } };
function loginApp() { const user = db.users.find(u => u.pin === $('loginPin').value); if (user) { currentUser = user; localStorage.setItem('arsy_user', JSON.stringify(currentUser)); $('loginModal').classList.remove('show'); $('loginPin').value = ""; $('loginError').style.display = 'none'; initApp(); } else { $('loginError').style.display = 'block'; } }
function logout() { localStorage.removeItem('arsy_user'); window.location.reload(); }
function initApp() { $('mainBottomNav').style.display = 'flex'; applyRoleRestrictions(); updateUI(); fetchCloudData(); }
function applyRoleRestrictions() { document.querySelectorAll('.admin-only').forEach(el => { if (currentUser.role === 'Admin') el.classList.remove('admin-only'); else el.style.display = 'none'; }); if($('akunProfileInitial')) $('akunProfileInitial').textContent = currentUser.name.substring(0, 2).toUpperCase(); if($('akunUserRoleText')) $('akunUserRoleText').textContent = currentUser.role; if($('headerProfileIcon')) $('headerProfileIcon').textContent = currentUser.name.substring(0, 2).toUpperCase(); }
async function fetchCloudData() { try { const res = await fetch(WEB_APP_URL); const data = await res.json(); if(data && data.outlet) { db = { ...db, ...data }; if(!db.users || db.users.length === 0) db.users = [{ id: '1', name: 'Admin', pin: '1985', role: 'Admin' }]; saveLocal(); updateUI(); } } catch (e) { console.log("Offline mode"); } }
async function saveToCloud() { saveLocal(); showToast("Menyimpan data..."); try { await fetch(WEB_APP_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'saveAll', ...db }) }); showToast("Berhasil tersimpan ✔️"); } catch (e) { showToast("Tersimpan Offline ✔️"); } }
function saveLocal() { localStorage.setItem('arsy_db', JSON.stringify(db)); }
function showToast(msg) { const t = $('toast'); if(!t) return; t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }
function closeModal(id) { $(id).classList.remove('show'); }
function updateUI() { document.querySelectorAll('.dynamic-outlet-name').forEach(el => el.textContent = db.outlet.name); if($('akunOutletAddress')) $('akunOutletAddress').textContent = `${db.outlet.address}, ${db.outlet.city}`; if($('akunOutletPhone')) $('akunOutletPhone').textContent = db.outlet.phone; if($('outName')) { $('outName').value = db.outlet.name; $('outPhone').value = db.outlet.phone; $('outCity').value = db.outlet.city; $('outAddress').value = db.outlet.address; } if($('nHideLogo')) { const nc = db.notaCustom; $('nHideLogo').checked = nc.hideLogo; $('nHideOutlet').checked = nc.hideOutlet; $('nHideAddress').checked = nc.hideAddress; $('nHideCashier').checked = nc.hideCashier; $('nHideCustomer').checked = nc.hideCustomer; $('nShowCat').checked = nc.showCat; $('nHideMsg').checked = nc.hideMsg; $('nHidePerfume').checked = nc.hidePerfume; $('nHidePowered').checked = nc.hidePowered; $('nShowDay').checked = nc.showDay; } renderUsers(); renderServices(); renderTransactions('Semua'); updateDashboardStats(); renderCustomers(); }
function saveOutlet(e) { e.preventDefault(); db.outlet = { name:$('outName').value, phone:$('outPhone').value, city:$('outCity').value, address:$('outAddress').value }; saveToCloud(); updateUI(); showPage('akunPage'); }
function saveNotaCustom(e) { e.preventDefault(); db.notaCustom = { hideLogo: $('nHideLogo').checked, hideOutlet: $('nHideOutlet').checked, hideAddress: $('nHideAddress').checked, hideCashier: $('nHideCashier').checked, hideCustomer: $('nHideCustomer').checked, showCat: $('nShowCat').checked, hideMsg: $('nHideMsg').checked, hidePerfume: $('nHidePerfume').checked, hidePowered: $('nHidePowered').checked, showDay: $('nShowDay').checked }; saveToCloud(); showToast("Pengaturan Nota Disimpan!"); showPage('akunPage'); }
function showNotaPreview() { let html = `<div style="text-align:center; margin-bottom:10px; border-bottom:1px dashed #000; padding-bottom:10px;">`; if(!$('nHideLogo').checked) html += `<div style="font-size:32px; margin-bottom:5px;">🧺</div>`; if(!$('nHideOutlet').checked) html += `<h3 style="margin:0; font-size:16px;">${db.outlet.name}</h3>`; if(!$('nHideAddress').checked) html += `<p style="margin:0; font-size:12px;">${db.outlet.address}, ${db.outlet.city}<br>${db.outlet.phone}</p>`; html += `</div><div style="font-size:12px; margin-bottom:10px;">No: TRX/123456789<br>Waktu: 17 Sep 2026, 13:45<br>Est. Selesai: 18 Sep 2026, 13:45</div>`; if(!$('nHideCustomer').checked) html += `<div style="border-top:1px dashed #000; border-bottom:1px dashed #000; padding:5px 0; margin-bottom:10px; font-size:12px;">Pelanggan: Budi</div>`; html += `<div style="font-size:12px; margin-bottom:10px;">Cuci Kering Lipat<br>3 kg x Rp 5.000 = Rp 15.000</div><div style="border-top:1px dashed #000; padding-top:10px; font-size:12px; text-align:right;">Total: Rp 15.000<br>Status: Belum Lunas</div>`; if(!$('nHideMsg').checked) html += `<div style="text-align:center; margin-top:15px; font-size:12px;">Terima kasih atas kunjungan Anda</div>`; if(!$('nHidePowered').checked) html += `<div style="text-align:center; margin-top:10px; font-size:10px; color:#666;">Powered by Arsy</div>`; $('notaPreviewContent').innerHTML = html; $('previewNotaModal').classList.add('show'); }
function openUserModal() { $('userName').value=''; $('userPin').value=''; $('userModal').classList.add('show'); }
function saveUser(e) { e.preventDefault(); db.users.push({ id: Date.now().toString(), name: $('userName').value, role: $('userRole').value, pin: $('userPin').value }); saveToCloud(); renderUsers(); closeModal('userModal'); }
function deleteUser(id) { if(db.users.length <= 1) return alert("Minimal harus ada 1 admin!"); if(confirm("Hapus karyawan ini?")) { db.users = db.users.filter(u => u.id !== id); saveToCloud(); renderUsers(); } }
function renderUsers() { const c = $('usersListContainer'); if(!c) return; c.innerHTML = db.users.map(u => `<div style="background:white; padding:15px; border-radius:12px; border:1px solid var(--border); margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;"><div><h3 style="font-size:15px;">${u.name}</h3><span style="font-size:11px; background:#e1edff; padding:2px 6px; border-radius:6px; color:#1769e0; font-weight:bold;">${u.role}</span><p style="font-size:12px; color:var(--muted); margin-top:5px;">PIN: ${u.pin}</p></div><button onclick="deleteUser('${u.id}')" style="background:#fee2e2; color:#dc2626; border:none; padding:8px; border-radius:8px; font-weight:bold;">Hapus</button></div>`).join(''); }
function renderCustomers() { if(!$('customersListContainer')) return; const custs = db.customers || []; $('customersListContainer').innerHTML = custs.map(c => `<div style="background:white; padding:12px 15px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px;"><div style="width:40px; height:40px; border-radius:50%; background:#e1edff; color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:18px;">${c.name.charAt(0).toUpperCase()}</div><div><h3 style="font-size:15px; color:var(--text);">${c.name}</h3><p style="font-size:12px; color:var(--muted);">Total Transaksi: ${c.totalTrx}</p></div></div>`).join('') || '<div class="empty-state">Belum ada pelanggan.</div>'; if($('totalCustomers')) $('totalCustomers').textContent = custs.length; }

// --- DASHBOARD KLIK PAKSA FIX ---
function updateDashboardStats() { 
    const todayStr = new Date().toLocaleDateString('id-ID'); 
    const allTrxs = db.transactions || [];
    let todayIncomeTotal = 0;
    let todayTrxCount = 0;
    let lateCount = 0; // Menghitung yang terlambat
    const now = new Date();

    allTrxs.forEach(t => {
        const tDate = new Date(t.date).toLocaleDateString('id-ID');
        if (tDate === todayStr) todayTrxCount++;
        
        if (t.isPaid || (t.payStatus === 'DP' && Number(t.dpAmount) > 0)) {
            const payDateStr = t.payDate ? new Date(t.payDate).toLocaleDateString('id-ID') : tDate;
            if (payDateStr === todayStr) {
                if (t.isPaid) todayIncomeTotal += Number(t.total);
                else if (t.payStatus === 'DP') todayIncomeTotal += Number(t.dpAmount || 0);
            }
        }

        // LOGIKA MENGHITUNG KARTU "BELUM SELESAI" (TERLAMBAT)
        if(t.status !== 'Selesai' && t.status !== 'Siap Diambil' && t.status !== 'Batal') {
            let maxDays = 1;
            (t.services || []).forEach(srv => {
                const dbSrv = (db.services || []).find(ds => ds.name === srv.name);
                if(dbSrv && dbSrv.duration) {
                    const days = parseInt(dbSrv.duration);
                    if(!isNaN(days) && days > maxDays) maxDays = days;
                }
            });
            const deadline = new Date(new Date(t.date).getTime() + (maxDays * 24 * 60 * 60 * 1000));
            if(now > deadline) lateCount++;
        }
    });

    if($('todayIncome')) $('todayIncome').textContent = formatRp(todayIncomeTotal); 
    if($('todayTransactions')) $('todayTransactions').textContent = todayTrxCount; 
    if($('pendingTransactions')) $('pendingTransactions').textContent = lateCount; // Pakai hitungan Terlambat
    if($('totalCustomers')) $('totalCustomers').textContent = (db.customers||[]).length; 

    // Inject event listener ke kartu dashboard
    setTimeout(() => {
        document.querySelectorAll('div').forEach(el => {
            const text = el.innerText || "";
            if(el.classList.contains('dashboard-card') || el.style.background === 'white') {
                if(text.includes('Omzet Hari Ini') || text.includes('Transaksi Hari Ini')) {
                    el.style.cursor = 'pointer'; el.classList.add('dashboard-card');
                    el.onclick = () => { openDashboardDetail(text.includes('Omzet') ? 'omset' : 'transaksi'); };
                }
                if(text.includes('Belum Selesai')) {
                    el.style.cursor = 'pointer'; el.classList.add('dashboard-card');
                    el.onclick = () => { openDashboardDetail('pending'); };
                }
                if(text.includes('Total Pelanggan')) {
                    el.style.cursor = 'pointer'; el.classList.add('dashboard-card');
                    el.onclick = () => { showPage('customerPage'); };
                }
            }
        });
    }, 500);
}


function openServiceModal() { if($('serviceForm')) $('serviceForm').reset(); $('srvPrice').value = '0'; $('srvMinQty').value = '1'; $('srvDuration').value = '1 Hari'; $('serviceModal').classList.add('show'); }
function saveService(e) { e.preventDefault(); if(!db.services) db.services = []; let processes = []; document.querySelectorAll('.srvProcess:checked').forEach(cb => processes.push(cb.value)); db.services.push({ id: Date.now().toString(), name: $('srvName').value, processes: processes, price: Number($('srvPrice').value), unit: $('srvUnit').value, duration: $('srvDuration').value, minQty: Number($('srvMinQty').value), isPinned: $('srvPinned').checked }); saveToCloud(); renderServices(); closeModal('serviceModal'); }
// GANTI FUNGSI INI
function renderServices() {
    if(!$('servicesList')) return;
    const srvs = db.services || [];
    if(srvs.length === 0) {
        $('servicesList').innerHTML = '<div class="empty-state">Belum ada layanan.</div>';
        return;
    }
    
    const sortedSrvs = [...srvs].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    $('servicesList').innerHTML = sortedSrvs.map(s => {
        const processesText = (s.processes && s.processes.length > 0) ? s.processes.join(' - ') : 'Tanpa Proses';
        const pinnedBadge = s.isPinned ? '<span style="background:#e1edff; color:#1769e0; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:8px;">Disematkan</span>' : '';
        
        // Desain UI dirapikan menggunakan Flexbox agar tidak berantakan
        return `
        <div class="service-item" style="display:flex; justify-content:space-between; align-items:center; padding:15px; margin-bottom:10px; background:white; border-radius:12px; border:1px solid var(--border);">
            <div style="flex:1;">
                <h3 style="font-size:15px; margin-bottom:4px; color:var(--text);">${s.name} ${pinnedBadge}</h3>
                <p style="font-size:12px; color:var(--muted);">${processesText}</p>
                <p style="font-size:11px; color:var(--primary); margin-top:4px; font-weight:bold;">Durasi: ${s.duration || '1 Hari'}</p>
            </div>
            <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                <div style="font-weight:bold; color:var(--primary); font-size:14px;">${formatRp(s.price)} / ${s.unit}</div>
                <div style="display:flex; gap:6px;">
                    <button onclick="editServicePrice('${s.id}')" style="background:#fef08a; color:#ca8a04; border:none; font-size:11px; font-weight:bold; padding:5px 10px; border-radius:6px; cursor:pointer;">Edit Harga</button>
                    <button onclick="delService('${s.id}')" style="background:#fee2e2; color:#ef4444; border:none; font-size:11px; font-weight:bold; padding:5px 10px; border-radius:6px; cursor:pointer;">Hapus</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// TAMBAHKAN FUNGSI BARU INI DI BAWAHNYA
function editServicePrice(id) {
    const srv = db.services.find(s => s.id === id);
    if(srv) {
        const newPrice = prompt(`Masukkan harga baru untuk layanan:\n${srv.name}`, srv.price);
        if(newPrice !== null && newPrice !== "" && !isNaN(newPrice)) {
            srv.price = Number(newPrice);
            saveToCloud();
            renderServices();
            showToast("Harga berhasil diperbarui!");
        }
    }
}

function delService(id) { if(confirm("Hapus layanan ini?")) { db.services = db.services.filter(s => s.id !== id); saveToCloud(); renderServices(); } }
function openTransactionModal() { $('trxCustomer').value = ''; $('trxStatus').value = 'Antrian'; tempTrxServices = []; renderTempServices(); $('transactionModal').classList.add('show'); }
function renderTempServices() { const container = $('trxTempServices'); if(tempTrxServices.length === 0) { container.innerHTML = '<p style="font-size:12px; color:var(--muted); text-align:center; margin:10px 0;">Belum ada layanan dipilih.</p>'; $('trxTempTotal').textContent = 'Rp 0'; return; } let total = 0; container.innerHTML = tempTrxServices.map((s, i) => { total += s.total; return `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border); padding-bottom:8px; margin-bottom:8px;"><div><h4 style="font-size:13px; color:var(--text);">${s.name}</h4><p style="font-size:11px; color:var(--muted);">${s.qty} ${s.unit} x ${formatRp(s.price)}</p></div><div style="display:flex; align-items:center; gap:10px;"><span style="font-size:13px; font-weight:bold;">${formatRp(s.total)}</span><button type="button" onclick="removeTempService(${i})" style="color:#ef4444; background:none; border:none;"><i class="fas fa-times-circle"></i></button></div></div>`; }).join(''); $('trxTempTotal').textContent = formatRp(total); }
function openSelectServiceModal() { $('searchServiceInput').value = ''; renderSelectServices(); $('selectServiceModal').classList.add('show'); }
function renderSelectServices() { const q = $('searchServiceInput').value.toLowerCase(); const srvs = (db.services||[]).filter(s => s.name.toLowerCase().includes(q)).sort((a,b)=>(b.isPinned?1:0)-(a.isPinned?1:0)); $('selectServiceList').innerHTML = srvs.map(s => `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid var(--border);"><div><h4 style="font-size:14px; margin-bottom:2px;">${s.name}</h4><p style="font-size:12px; color:var(--primary); font-weight:bold;">${formatRp(s.price)} / ${s.unit}</p></div><button type="button" onclick="openInputQty('${s.id}', '${s.name.replace(/'/g,"\\'")}', ${s.price}, '${s.unit}')" style="background:var(--primary); color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:bold;">+ Pilih</button></div>`).join(''); }
function openInputQty(id, name, price, unit) { $('iqId').value = id; $('iqName').textContent = name; $('iqPrice').value = price; $('iqUnit').value = unit; $('iqUnitText').textContent = unit; $('iqQty').value = '1'; $('inputQtyModal').classList.add('show'); }
function addTempService() { const qty = Number($('iqQty').value); if(qty <= 0) return alert('Jumlah tidak valid'); const price = Number($('iqPrice').value); tempTrxServices.push({ id: $('iqId').value, name: $('iqName').textContent, qty: qty, price: price, unit: $('iqUnit').value, total: qty * price }); closeModal('inputQtyModal'); closeModal('selectServiceModal'); renderTempServices(); }
function removeTempService(i) { tempTrxServices.splice(i,1); renderTempServices(); }
function saveTransaction(e) { e.preventDefault(); if(tempTrxServices.length === 0) return alert("Tambahkan minimal 1 layanan!"); if(!db.transactions) db.transactions = []; if(!db.customers) db.customers = []; const customerName = $('trxCustomer').value.trim(); const total = tempTrxServices.reduce((sum, s) => sum + s.total, 0); let cust = db.customers.find(c => c.name.toLowerCase() === customerName.toLowerCase()); if(!cust) db.customers.push({ id: Date.now().toString(), name: customerName, totalTrx: 1 }); else cust.totalTrx = (cust.totalTrx || 0) + 1; const newTrxId = 'TRX/' + Date.now().toString().slice(3); db.transactions.unshift({ id: newTrxId, date: new Date().toISOString(), customer: customerName, services: [...tempTrxServices], total: total, status: $('trxStatus').value, isPaid: false, payMethod: '-' }); saveToCloud(); renderTransactions('Semua'); renderCustomers(); updateDashboardStats(); closeModal('transactionModal'); showToast("Transaksi Berhasil Dibuat! ✔️"); setTimeout(() => { openTrxDetail(newTrxId); }, 200); }
// --- KODE PENGGANTI (PASTE DARI SINI) ---
// 1. GANTI FUNGSI showPage
function showPage(pageId, btn = null) { 
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); 
    if($(pageId))$(pageId).classList.add('active'); 
    
    if (btn && btn.classList.contains('nav-button')) { 
        document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active')); 
        btn.classList.add('active'); 
        
        // JIKA MENEKAN TOMBOL "DAFTAR" DI MENU BAWAH, RESET TAMPILAN KE NORMAL
        if(pageId === 'transactionsPage') {
            document.querySelectorAll('.trans-tab').forEach(b => { 
                b.style.background = '#f4f7fb'; 
                b.style.color = 'var(--muted)'; 
            });
            renderTransactions('Semua');
        }
    } 
}

// 2. GANTI FUNGSI openDashboardDetail
function openDashboardDetail(type) {
    showPage('transactionsPage');
    if(type === 'omset') {
        renderTransactions('OmzetHariIni');
    } else if(type === 'transaksi') {
        renderTransactions('TransaksiHariIni');
    } else if(type === 'pending') {
        renderTransactions('BelumSelesai');
    }
}

// 3. GANTI FUNGSI renderTransactions
function renderTransactions(filter = 'Semua') { 
    let trxs = db.transactions || []; 
    const todayStr = new Date().toLocaleDateString('id-ID');
    
    // ==== UI PINTAR: Sembunyikan tab dan buat Header Khusus ====
    const tabContainer = document.querySelector('.trans-tab') ? document.querySelector('.trans-tab').parentElement : null;
    let customHeader = document.getElementById('customTrxHeader');
    
    if (!customHeader && tabContainer) {
        customHeader = document.createElement('div');
        customHeader.id = 'customTrxHeader';
        customHeader.className = 'report-header'; // Pakai style bawaan CSS jenengan
        customHeader.style.padding = '15px';
        customHeader.style.borderBottom = '1px solid var(--border)';
        customHeader.innerHTML = `
            <button class="report-back" onclick="showPage('dashboardPage')" style="margin:0;">‹</button>
            <h2 id="customTrxTitle" style="font-size:16px; font-weight:bold; margin-left:15px; margin-top:0px;"></h2>
        `;
        tabContainer.parentNode.insertBefore(customHeader, tabContainer);
    }

    if (customHeader && tabContainer) {
        // Jika mode filter dari Dashboard
        if (['OmzetHariIni', 'TransaksiHariIni', 'BelumSelesai'].includes(filter)) {
            tabContainer.style.display = 'none';
            customHeader.style.display = 'flex';
            if(filter === 'OmzetHariIni') document.getElementById('customTrxTitle').textContent = 'Omzet Hari Ini';
            if(filter === 'TransaksiHariIni') document.getElementById('customTrxTitle').textContent = 'Transaksi Hari Ini';
            if(filter === 'BelumSelesai') document.getElementById('customTrxTitle').textContent = 'Belum Selesai';
        } else {
            // Jika mode normal (Tab Semua/Antrian/Proses)
            tabContainer.style.display = 'flex';
            customHeader.style.display = 'none';
        }
    }

    // ==== LOGIKA FILTER DATA ====
    if(filter === 'OmzetHariIni') {
        trxs = trxs.filter(t => {
            const tDate = new Date(t.date).toLocaleDateString('id-ID');
            const payDateStr = t.payDate ? new Date(t.payDate).toLocaleDateString('id-ID') : tDate;
            return (t.isPaid || (t.payStatus === 'DP' && Number(t.dpAmount) > 0)) && payDateStr === todayStr;
        });
    } 
    else if(filter === 'TransaksiHariIni') {
        trxs = trxs.filter(t => new Date(t.date).toLocaleDateString('id-ID') === todayStr);
    }
        else if(filter === 'BelumSelesai') {
        trxs = trxs.filter(t => {
            // Abaikan yang sudah beres atau batal
            if(t.status === 'Selesai' || t.status === 'Siap Diambil' || t.status === 'Batal') return false;
            
            // Hitung estimasi selesai
            let maxDays = 1; 
            (t.services || []).forEach(srv => {
                const dbSrv = (db.services || []).find(ds => ds.name === srv.name);
                if(dbSrv && dbSrv.duration) {
                    const days = parseInt(dbSrv.duration); 
                    if(!isNaN(days) && days > maxDays) maxDays = days;
                }
            });
            
            const trxDate = new Date(t.date);
            const deadline = new Date(trxDate.getTime() + (maxDays * 24 * 60 * 60 * 1000));
            const now = new Date();
            
            // Tampilkan HANYA jika waktu sekarang melebihi waktu deadline
            return now > deadline; 
        });
    }

    else if(filter !== 'Semua') {
        trxs = trxs.filter(t => t.status === filter);
    }
    
    // ==== RENDER HTML TAMPILAN TRANSAKSI ====
    const html = trxs.map(t => { 
        const d = new Date(t.date);
        const dateStr = d.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'}) + ', ' + d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
        
        return `
            <div class="transaction-item" onclick="openTrxDetail('${t.id}')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:white; padding:12px 15px; border-radius:10px; border:1px solid var(--border); margin-bottom:10px;">
                <div class="item-main">
                    <h3 style="margin-bottom:2px; font-size:14px; color:var(--text);">${t.customer}</h3>
                    <p style="font-size:11px; color:var(--muted); margin-bottom:4px;">${t.id} • ${dateStr}</p>
                    <span class="status status-${t.status.toLowerCase().replace(' ','')}">${t.status}</span>
                </div>
                <div class="item-price" style="text-align:right;">
                    <span style="font-size:14px; font-weight:bold; color:var(--primary);">${formatRp(t.total)}</span><br>
                    <small style="color:${t.isPaid?'#16a34a':(t.payStatus==='DP'?'#d97706':'#ea8b00')}; font-weight:bold;">${t.isPaid?'Lunas':(t.payStatus==='DP'?'DP':'Belum Lunas')}</small>
                </div>
            </div>`; 
    }).join(''); 
    
    if($('allTransactions'))$('allTransactions').innerHTML = html || '<div class="empty-state">Tidak ada transaksi di daftar ini.</div>'; 
    if($('recentTransactions') && filter === 'Semua') {$('recentTransactions').innerHTML = trxs.slice(0,5).map(t => {
            const d = new Date(t.date);
            const dateStr = d.toLocaleDateString('id-ID', {day:'numeric', month:'short'}) + ', ' + d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
            return `
                <div class="transaction-item" onclick="openTrxDetail('${t.id}')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; background:white; padding:12px 15px; border-radius:10px; border:1px solid var(--border); margin-bottom:10px;">
                    <div class="item-main">
                        <h3 style="margin-bottom:2px; font-size:14px; color:var(--text);">${t.customer}</h3>
                        <p style="font-size:11px; color:var(--muted); margin-bottom:4px;">${t.id} • ${dateStr}</p>
                        <span class="status status-${t.status.toLowerCase().replace(' ','')}">${t.status}</span>
                    </div>
                    <div class="item-price" style="text-align:right;">
                        <span style="font-size:14px; font-weight:bold; color:var(--primary);">${formatRp(t.total)}</span>
                    </div>
                </div>`;
        }).join('') || '<div class="empty-state">Belum ada transaksi.</div>'; 
    } 
}
    


// --- WA NOTA ASLI ARSY LAUNDRY FIX ---
function shareWhatsApp(id) { 
    const t = db.transactions.find(x => x.id === id); if(!t) return; 
    const d = new Date(t.date); 
    const wkt = d.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'}) + ', ' + d.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}); 
    let srvsText = ''; 
    (t.services || [{name: t.service, qty: t.qty, unit: t.unit, price: t.price, total: t.total}]).forEach(s => { srvsText += `${s.name}\n${s.qty} x ${formatRp(s.price)} = ${formatRp(s.total)}\n`; }); 
    const text = `*${db.outlet.name}*\n${db.outlet.address}, ${db.outlet.city}\n${db.outlet.phone}\n-------------------------\nPelanggan: *${t.customer}*\nNo. Transaksi: ${t.id}\nWaktu: ${wkt}\n-------------------------\nLayanan:\n${srvsText}-------------------------\nTotal: *${formatRp(t.total)}*\nStatus: *${t.isPaid ? 'Lunas' : 'Belum Lunas'}*`; 
    if (navigator.share) navigator.share({ title: 'Nota ' + db.outlet.name, text: text }).catch(() => {}); else window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`); 
                            }
let editingTrxId = null; // Tambahkan penanda ini di luar fungsi

// GANTI FUNGSI INI KESELURUHAN
function openTrxDetail(id) { 
    currentViewTrxId = id; if($('trxMenuDropdown'))$('trxMenuDropdown').style.display = 'none'; 
    const t = db.transactions.find(x => x.id === id); if(!t) return; 
    
    // Format Tanggal Masuk
    const entryDate = new Date(t.date); 
    const dateStr = entryDate.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'}) + ', ' + entryDate.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}); 
    
    // HITUNG ESTIMASI SELESAI
    let maxDays = 1; 
    const srvs = t.services || [{name: t.service, qty: t.qty, unit: t.unit, price: t.price, total: t.total}];
    srvs.forEach(s => {
        const dbSrv = (db.services || []).find(ds => ds.name === s.name);
        if(dbSrv && dbSrv.duration) {
            const days = parseInt(dbSrv.duration); 
            if(!isNaN(days) && days > maxDays) maxDays = days;
        }
    });
    const estDateObj = new Date(entryDate.getTime() + (maxDays * 24 * 60 * 60 * 1000));
    const estDateStr = estDateObj.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'});

    // Logika Warna Status
    let color = '#1769e0'; if(t.status==='Proses') color = '#ea8b00'; if(t.status==='Siap Diambil' || t.status==='Selesai') color = '#16a34a'; if(t.status==='Batal') color = '#dc2626'; 
    const flow = ['Antrian', 'Proses', 'Siap Diambil', 'Selesai']; const cIdx = flow.indexOf(t.status); const nextSt = flow[cIdx + 1]; 
    let btnNext = (nextSt && t.status !== 'Batal') ? `<button onclick="updateStatusFromDetail('${t.id}', '${nextSt}')" class="submit-button" style="margin-top:15px; background:${color}; font-size:15px;">${nextSt === 'Proses' ? 'Proses Transaksi' : (nextSt === 'Siap Diambil' ? 'Transaksi Siap Diambil' : 'Selesaikan Transaksi')}</button>` : ''; 
    let btnPrev = (cIdx > 0 && t.status !== 'Batal') ? `<button onclick="updateStatusFromDetail('${t.id}', '${flow[cIdx-1]}')" class="submit-button" style="margin-top:10px; background:white; color:var(--text); border:1px solid var(--border);">Kembalikan Status</button>` : ''; 
    
    let btnPay = ''; 
    if(t.status !== 'Batal') { 
        if(t.isPaid || t.payStatus === 'Lunas' || t.payStatus === 'DP') {
            btnPay = `
            <button onclick="openPaymentModal('${t.id}')" class="submit-button" style="background:#f8fafc; color:var(--text); border:1px solid var(--border); margin-bottom:10px;">Ubah Pembayaran</button>
            <button onclick="batalkanPembayaran('${t.id}')" class="submit-button" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; margin-bottom:10px;">Batalkan Pembayaran</button>`;
        } else {
            btnPay = `<button onclick="openPaymentModal('${t.id}')" class="submit-button" style="background:#16a34a; margin-bottom:10px;">Bayar Tagihan</button>`;
        }
    } 
    
    let srvsHtml = srvs.map((s, idx) => `
        <div style="padding-top:12px; border-top:1px dashed var(--border); margin-top:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <h4 style="font-size:14px; color:var(--text);">${s.name}</h4>
                <div style="font-weight:bold; font-size:14px;">${formatRp(s.total)}</div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:12px; color:var(--muted); background:#f8fafc; padding:4px 8px; border-radius:6px; border:1px solid var(--border); display:flex; align-items:center; gap:8px;">
                    <span onclick="editTrxServiceQty('${t.id}', ${idx})" style="color:var(--primary); font-weight:bold; cursor:pointer;"><i class="fas fa-edit"></i> Qty</span>
                    <span>|</span>
                    <span>${s.qty} ${s.unit || 'kg'} x ${formatRp(s.price)}</span>
                </div>
                <button onclick="removeTrxService('${t.id}', ${idx})" style="background:transparent; color:#ef4444; border:none; font-size:12px; font-weight:bold;"><i class="fas fa-trash"></i> Hapus</button>
            </div>
        </div>
    `).join(''); 
    
    // Inject Estimasi Selesai di HTML
    const html = `
    <div style="background:white; border-radius:12px; border:1px solid var(--border); padding:15px; margin-bottom:15px;">
        <p style="font-size:12px; color:var(--muted); margin-bottom:4px;">No. Transaksi: <span style="color:var(--text); font-weight:bold;">${t.id}</span></p>
        <p style="font-size:12px; color:var(--muted); margin-bottom:4px;">Status: <span style="color:${color}; font-weight:bold;">${t.status}</span></p>
        <p style="font-size:12px; color:var(--muted); margin-bottom:4px;">Kasir: <span style="color:var(--text); font-weight:bold;">${currentUser.name}</span></p>
        <p style="font-size:12px; color:var(--muted); margin-bottom:4px;">Masuk: <span style="color:var(--text); font-weight:bold;">${dateStr}</span></p>
        <p style="font-size:12px; color:var(--muted); margin-bottom:0; padding-top:4px; border-top:1px dashed var(--border);">Estimasi Selesai: <span style="color:#d97706; font-weight:bold;">${estDateStr}</span></p>
    </div>
    
    <div style="background:white; border-radius:12px; border:1px solid var(--border); padding:15px; margin-bottom:15px;">
        <p style="font-size:11px; color:var(--muted); font-weight:bold; margin-bottom:12px;">INFO PELANGGAN</p>
        <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:50%; background:#e1edff; color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:18px;">${t.customer.charAt(0).toUpperCase()}</div>
            <h3 style="font-size:16px;">${t.customer}</h3>
        </div>
    </div>
    
    <div style="background:white; border-radius:12px; border:1px solid var(--border); padding:15px; margin-bottom:15px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <p style="font-size:11px; color:var(--muted); font-weight:bold; margin:0;">LAYANAN LAUNDRY</p>
            <button onclick="editingTrxId='${t.id}'; openSelectServiceModal()" style="background:#e1edff; color:var(--primary); border:none; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:bold;">+ Tambah</button>
        </div>
        ${srvsHtml}
    </div>
    
    ${btnNext}${btnPrev}
    
    <div style="background:white; border-radius:12px; border:1px solid var(--border); padding:15px; margin-top:20px; margin-bottom:15px;">
        <p style="font-size:11px; color:var(--muted); font-weight:bold; margin-bottom:12px;">INFO PEMBAYARAN</p>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span style="font-size:13px; color:var(--text); font-weight:bold;">Total Transaksi</span><span style="font-size:15px; font-weight:bold;">${formatRp(t.total)}</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;"><span style="font-size:13px; color:var(--text); font-weight:bold;">Status</span><span style="font-size:11px; font-weight:bold; color:${t.isPaid?'#16a34a':(t.payStatus==='DP'?'#d97706':'#ea8b00')}; background:${t.isPaid?'#dcfce7':(t.payStatus==='DP'?'#fef3c7':'#fff0d2')}; padding:4px 8px; border-radius:6px;">${t.isPaid?'Lunas':(t.payStatus==='DP'?'DP':'Belum Lunas')}</span></div>
    </div>
    
    ${btnPay}
    <button onclick="shareWhatsApp('${t.id}')" class="submit-button" style="background:#16a34a; margin-bottom:20px;"><i class="fab fa-whatsapp"></i> Kirim Nota via WA</button>`; 
    
    $('trxDetailContent').innerHTML = html; showPage('trxDetailPage'); 
}

    
// TAMBAHKAN 3 FUNGSI BARU INI DI BAWAHNYA
function editTrxServiceQty(trxId, idx) {
    const t = db.transactions.find(x => x.id === trxId);
    if(!t) return;
    const s = t.services[idx];
    const newQty = prompt(`Ubah jumlah/berat untuk ${s.name} (${s.unit}):`, s.qty);
    if(newQty !== null && newQty !== "" && !isNaN(newQty)) {
        s.qty = Number(newQty);
        s.total = s.qty * s.price;
        t.total = t.services.reduce((sum, srv) => sum + srv.total, 0); // Hitung ulang total transaksi
        saveToCloud(); openTrxDetail(trxId); updateDashboardStats();
        showToast("Jumlah layanan diubah!");
    }
}

function removeTrxService(trxId, idx) {
    const t = db.transactions.find(x => x.id === trxId);
    if(!t) return;
    if(t.services.length <= 1) return alert("Transaksi harus memiliki minimal 1 layanan! Jika ingin dibatalkan, gunakan menu Batalkan Transaksi di pojok kanan atas.");
    if(confirm("Hapus layanan ini dari transaksi?")) {
        t.services.splice(idx, 1);
        t.total = t.services.reduce((sum, srv) => sum + srv.total, 0); // Hitung ulang total
        saveToCloud(); openTrxDetail(trxId); updateDashboardStats();
        showToast("Layanan dihapus!");
    }
}

function batalkanPembayaran(id) {
    if(confirm("Yakin ingin membatalkan pembayaran ini? Status akan kembali menjadi Belum Lunas.")) {
        const t = db.transactions.find(x => x.id === id);
        if(t) {
            t.isPaid = false;
            t.payStatus = 'Belum Lunas';
            t.payMethod = '-';
            t.dpAmount = 0;
            saveToCloud(); openTrxDetail(id); renderTransactions('Semua'); updateDashboardStats();
            showToast("Pembayaran dibatalkan!");
        }
    }
}

// FUNGSI MODAL PEMBAYARAN
function openPaymentModal(id) {
    const t = db.transactions.find(x => x.id === id); if(!t) return;
    currentViewTrxId = id;
    $('payTotalAmount').textContent = formatRp(t.total);
    $('payStatusSelect').value = t.isPaid ? 'Lunas' : 'Belum Lunas';
    $('payMethodSelect').value = t.payMethod && t.payMethod !== '-' ? t.payMethod : 'Tunai';
    $('paymentModal').classList.add('show');
}
function confirmPayment() {
    if(!currentViewTrxId) return;
    const t = db.transactions.find(x => x.id === currentViewTrxId); if(!t) return;
    
    const status = $('payStatusSelect').value;
    const dibayar = Number($('payAmountInput').value) || 0;

    t.payDate = new Date().toISOString(); // Catat waktu pembayaran hari ini

    if (status === 'Lunas') {
        if (dibayar > 0 && dibayar < t.total) {
            alert("Uang yang dibayar kurang dari total tagihan!");
            return;
        }
        t.isPaid = true;
        t.payStatus = 'Lunas';
        t.dpAmount = dibayar;
    } else if (status === 'DP') {
        if (dibayar <= 0 || dibayar >= t.total) {
            alert("Jumlah DP harus lebih dari 0 dan kurang dari total tagihan!");
            return;
        }
        t.isPaid = false;
        t.payStatus = 'DP';
        t.dpAmount = dibayar;
    } else {
        t.isPaid = false;
        t.payStatus = 'Belum Lunas';
        t.dpAmount = 0;
    }
    
    t.payMethod = $('payMethodSelect').value;
    saveToCloud(); closeModal('paymentModal');
    openTrxDetail(currentViewTrxId); renderTransactions('Semua'); updateDashboardStats();
    showToast("Pembayaran Berhasil Disimpan! ✔️");
}


function toggleTrxMenu() { const m = $('trxMenuDropdown'); if(m) m.style.display = m.style.display === 'none' ? 'block' : 'none'; }
function cancelTransaction() { if(!currentViewTrxId) return; if(confirm("Yakin membatalkan transaksi ini?")) { const t = db.transactions.find(x => x.id === currentViewTrxId); if(t) { t.status = 'Batal'; saveToCloud(); openTrxDetail(currentViewTrxId); renderTransactions('Semua'); updateDashboardStats(); if($('trxMenuDropdown')) $('trxMenuDropdown').style.display = 'none'; showToast("Transaksi Dibatalkan!"); } } }
function updateStatusFromDetail(id, newStatus) { const t = db.transactions.find(x => x.id === id); if(t) { t.status = newStatus; saveToCloud(); openTrxDetail(id); renderTransactions('Semua'); updateDashboardStats(); } }
function filterTransactionsTab(status, btn) { document.querySelectorAll('.trans-tab').forEach(b => { b.style.background = '#f4f7fb'; b.style.color = 'var(--muted);'; }); btn.style.background = '#e1edff'; btn.style.color = 'var(--primary)'; renderTransactions(status); }
// --- LOGIKA LAPORAN ARSY LAUNDRY ---
let currentLaporanType = '';

function bukaDetailLaporan(type) {
    currentLaporanType = type;
    if($('laporanMenuView'))$('laporanMenuView').style.display = 'none';
    if($('laporanDetailView'))$('laporanDetailView').style.display = 'block';
    
    let judul = 'Detail Laporan';
    if(type === 'omset') judul = 'Laporan Omzet Transaksi';
    else if(type === 'masuk') judul = 'Laporan Transaksi Masuk';
    else if(type === 'lunas') judul = 'Laporan Transaksi Lunas';
    else if(type === 'selesai') judul = 'Laporan Transaksi Selesai';
    else if(type === 'batal') judul = 'Laporan Transaksi Batal';
    
    if($('judulDetailLaporan'))$('judulDetailLaporan').textContent = judul;
    renderDetailLaporan();
}

function kembaliKeMenuLaporan() {
    if($('laporanDetailView'))$('laporanDetailView').style.display = 'none';
    if($('laporanMenuView'))$('laporanMenuView').style.display = 'block';
}

function renderDetailLaporan() {
    let trxs = db.transactions || [];
    
    // 1. Ambil nilai filter dari HTML
    const tglMulai = $('filterTanggalMulai') ?$('filterTanggalMulai').value : '';
    const tglAkhir = $('filterTanggalAkhir') ?$('filterTanggalAkhir').value : '';
    const metodeBayar = $('filterMetodeBayar') ?$('filterMetodeBayar').value : 'Semua';
    const statusBayar = $('filterStatusBayar') ?$('filterStatusBayar').value : 'Semua';

    // 2. Filter berdasarkan Jenis Laporan (Omzet, Masuk, Lunas, dsb)
    if(currentLaporanType === 'lunas') {
        trxs = trxs.filter(t => t.isPaid === true);
    } else if(currentLaporanType === 'selesai') {
        trxs = trxs.filter(t => t.status === 'Selesai');
    } else if(currentLaporanType === 'batal') {
        trxs = trxs.filter(t => t.status === 'Batal');
    } else if(currentLaporanType === 'omset') {
        trxs = trxs.filter(t => t.isPaid || (t.payStatus === 'DP' && Number(t.dpAmount) > 0));
    }
    // Jika 'masuk', tidak perlu filter jenis laporan khusus, tampilkan semua

    // 3. Terapkan Filter Tanggal
    if(tglMulai) {
        trxs = trxs.filter(t => new Date(t.date) >= new Date(tglMulai + 'T00:00:00'));
    }
    if(tglAkhir) {
        trxs = trxs.filter(t => new Date(t.date) <= new Date(tglAkhir + 'T23:59:59'));
    }

    // 4. Terapkan Filter Metode Pembayaran
    if(metodeBayar !== 'Semua') {
        trxs = trxs.filter(t => t.payMethod === metodeBayar);
    }

    // 5. Terapkan Filter Status Pembayaran
    if(statusBayar !== 'Semua') {
        const isCariLunas = statusBayar === 'Lunas';
        trxs = trxs.filter(t => t.isPaid === isCariLunas);
    }

    // 6. Hitung Total Nominal (berbeda untuk omzet dan lainnya)
    let totalNominal = trxs.reduce((sum, t) => {
        if(currentLaporanType === 'omset') {
            if(t.isPaid) return sum + Number(t.total);
            if(t.payStatus === 'DP') return sum + Number(t.dpAmount || 0);
        }
        return sum + Number(t.total || 0);
    }, 0);

    // 7. Update UI untuk Ringkasan
    if($('totalNominalLaporan'))$('totalNominalLaporan').textContent = formatRp(totalNominal);
    if($('totalItemLaporan'))$('totalItemLaporan').textContent = trxs.length;

    // 8. Render List ke HTML
    const container = $('listDetailLaporan');
    if(!container) return;
    
    if(trxs.length === 0) {
        container.innerHTML = '<div class="empty-state" style="text-align:center; padding:20px; background:white; border-radius:8px; border:1px solid var(--border);">Tidak ada data transaksi yang sesuai filter.</div>';
        return;
    }

    container.innerHTML = trxs.map(t => {
        let statusColor = '#1769e0';
        if(t.status === 'Proses') statusColor = '#ea8b00';
        if(t.status === 'Siap Diambil' || t.status === 'Selesai') statusColor = '#16a34a';
        if(t.status === 'Batal') statusColor = '#dc2626';

        return `
            <div onclick="openTrxDetail('${t.id}')" style="background:white; padding:12px 15px; border-radius:10px; border:1px solid var(--border); cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4 style="font-size:14px; color:var(--text); margin-bottom:2px;">${t.customer}</h4>
                    <p style="font-size:11px; color:var(--muted); margin:0;">${t.id} • <span style="color:${statusColor}; font-weight:bold;">${t.status}</span></p>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:13px; font-weight:bold; color:var(--primary);">${formatRp(t.total)}</span>
                    <p style="font-size:10px; color:var(--muted); margin:0;">${t.isPaid ? 'Lunas (' + (t.payMethod || '-') + ')' : 'Belum Lunas'}</p>
                </div>
            </div>
        `;
    }).join('');
}

// Fungsi tambahan untuk me-reset filter setiap kali membuka menu detail laporan baru
function bukaDetailLaporan(type) {
    currentLaporanType = type;
    if($('laporanMenuView'))$('laporanMenuView').style.display = 'none';
    if($('laporanDetailView'))$('laporanDetailView').style.display = 'block';
    
    let judul = 'Detail Laporan';
    if(type === 'omset') judul = 'Laporan Omzet Transaksi';
    else if(type === 'masuk') judul = 'Laporan Transaksi Masuk';
    else if(type === 'lunas') judul = 'Laporan Transaksi Lunas';
    else if(type === 'selesai') judul = 'Laporan Transaksi Selesai';
    else if(type === 'batal') judul = 'Laporan Transaksi Batal';
    
    if($('judulDetailLaporan'))$('judulDetailLaporan').textContent = judul;
    
    // Reset nilai input filter
    if($('filterTanggalMulai'))$('filterTanggalMulai').value = '';
    if($('filterTanggalAkhir'))$('filterTanggalAkhir').value = '';
    if($('filterMetodeBayar'))$('filterMetodeBayar').value = 'Semua';
    if($('filterStatusBayar'))$('filterStatusBayar').value = 'Semua';

    renderDetailLaporan();
}
