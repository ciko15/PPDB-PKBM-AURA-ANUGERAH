// Konfigurasi URL Apps Script Web App
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx8tzFBAyd8aTe1_Or-7skj5lOBQ_K_CoXCAVz_WDqCxkiZg6gTi480I468psGy4wzJ/exec";

let currentUser = null;
let siswaDataList = [];
let usersDataList = [];
let currentSiswa = null;

// ======================= DOM ELEMENTS =======================
const pageLogin = document.getElementById('page-login');
const pageDashboard = document.getElementById('page-dashboard');
const globalLoader = document.getElementById('global-loader');
const loaderText = document.getElementById('loader-text');

// Form Login
const formLogin = document.getElementById('form-login');
const inputLoginUser = document.getElementById('login-username');
const inputLoginPass = document.getElementById('login-password');
const activeUserName = document.getElementById('active-user-name');
const btnLogout = document.getElementById('btn-logout');

// Navigation
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');
const menuDashboard = document.getElementById('menu-dashboard');
const menuUsers = document.getElementById('menu-users');
const menuInput = document.getElementById('menu-input');

// Section Input Pendaftaran
const formInputSiswa = document.getElementById('form-input-siswa');
const formInputTitle = document.getElementById('form-input-title');
const btnSubmitReg = document.getElementById('btn-submit-reg');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

// Section Antrean Validasi
const siswaListEl = document.getElementById('siswa-list');
const emptyStateEl = document.getElementById('no-selection');
const validationPanelEl = document.getElementById('validation-panel');

const valNama = document.getElementById('input-nama');
const valNik = document.getElementById('input-nik');
const valNisn = document.getElementById('input-nisn');
const valTempatLahir = document.getElementById('input-tempat-lahir');
const valTglLahir = document.getElementById('input-tgl-lahir');
const valIbu = document.getElementById('input-ibu');
const valAyah = document.getElementById('input-ayah');
const valWali = document.getElementById('input-wali');
const valJk = document.getElementById('input-jk');
const valProgram = document.getElementById('input-program');
const valTahunLulus = document.getElementById('input-tahun-lulus');

const eligBox = document.getElementById('eligibility-box');
const eligTitle = document.getElementById('elig-status-title');
const eligText = document.getElementById('elig-status-text');

const docImage = document.getElementById('doc-image');
const docLoader = document.getElementById('doc-loader');

const aiResultBox = document.getElementById('ai-result-box');
const aiStatusTitle = document.getElementById('ai-status-title');
const aiKoreksiText = document.getElementById('ai-koreksi-text');

// Section Daftar Peserta Didik
const tableSiswaBody = document.getElementById('table-siswa-body');

// Section Kelola Pengguna
const formAddUser = document.getElementById('form-add-user');
const tableUsersBody = document.getElementById('table-users-body');


// ======================= INITIALIZATION =======================
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkLocalSession();
});

function setupEventListeners() {
  formLogin.addEventListener('submit', handleLogin);
  btnLogout.addEventListener('click', handleLogout);

  document.querySelectorAll('#main-menu li').forEach(item => {
    item.addEventListener('click', (e) => {
      document.querySelectorAll('#main-menu li').forEach(li => li.classList.remove('active'));
      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      
      contentSections.forEach(sec => sec.classList.add('hidden'));
      document.getElementById(targetId).classList.remove('hidden');

      if (targetId === 'section-dashboard') loadDashboardData();
      if (targetId === 'section-validasi') fetchSiswaData(true);
      if (targetId === 'section-list') loadAllSiswa();
      if (targetId === 'section-users') loadAllUsers();
    });
  });

  formInputSiswa.addEventListener('submit', handleRegistrationOrEdit);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      const target = e.target.getAttribute('data-target');
      docLoader.style.display = 'block';
      
      const btnAi = document.getElementById('btn-cek-ai');
      if (target === 'ijazah') {
        docImage.src = currentSiswa.urlIjazah;
        btnAi.textContent = "Cek dengan AI (Ijazah)";
        btnAi.dataset.target = "ijazah";
      } else if (target === 'kk') {
        docImage.src = currentSiswa.urlKK;
        btnAi.textContent = "Cek dengan AI (KK)";
        btnAi.dataset.target = "kk";
      } else {
        docImage.src = currentSiswa.urlBayar;
        btnAi.textContent = "Cek Bukti Bayar"; 
        btnAi.dataset.target = "bayar";
      }
    });
  });

  document.getElementById('btn-cek-ai').addEventListener('click', handleAICheck);
  document.getElementById('btn-setuju').addEventListener('click', () => submitValidation('Selesai'));
  document.getElementById('btn-tolak').addEventListener('click', () => submitValidation('Perlu Perbaikan'));

  formAddUser.addEventListener('submit', handleAddUser);

  // Mobile Menu Toggle
  const btnMenuMobile = document.getElementById('btn-menu-mobile');
  const sidebarNav = document.getElementById('sidebar-nav');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  
  if (btnMenuMobile && sidebarNav && sidebarOverlay) {
    btnMenuMobile.addEventListener('click', () => {
      sidebarNav.classList.add('show');
      sidebarOverlay.classList.remove('hidden');
    });

    sidebarOverlay.addEventListener('click', () => {
      sidebarNav.classList.remove('show');
      sidebarOverlay.classList.add('hidden');
    });

    document.querySelectorAll('#main-menu li').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          sidebarNav.classList.remove('show');
          sidebarOverlay.classList.add('hidden');
        }
      });
    });
  }
}

// ======================= API CALLER =======================
async function callAPI(payload) {
  if (SCRIPT_URL === "TARUH_URL_WEB_APP_ANDA_DISINI") {
    return handleDummyAPI(payload);
  }

  const response = await fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.error || "Gagal memanggil API");
  return result.data;
}

// ======================= SESSION & LOGIN =======================
function checkLocalSession() {
  const session = localStorage.getItem('ppdb_session');
  if (session) {
    currentUser = JSON.parse(session);
    showDashboard();
  } else {
    pageLogin.classList.remove('hidden');
    pageDashboard.classList.add('hidden');
  }
}

async function handleLogin(e) {
  const user = inputLoginUser.value;
  const pass = inputLoginPass.value;
  showLoader("Mencoba Masuk...");
  
  try {
    const data = await callAPI({ action: "login", username: user, password: pass });
    if (data && data.username) {
      currentUser = data;
      localStorage.setItem('ppdb_session', JSON.stringify(data));
      showDashboard();
    }
  } catch(err) {
    alert(err.message);
  }
  hideLoader();
}

function handleLogout() {
  localStorage.removeItem('ppdb_session');
  currentUser = null;
  pageLogin.classList.remove('hidden');
  pageDashboard.classList.add('hidden');
}

function showDashboard() {
  pageLogin.classList.add('hidden');
  pageDashboard.classList.remove('hidden');
  activeUserName.textContent = currentUser.nama + " (" + currentUser.role + ")";
  
  if (currentUser.role === 'Admin') {
    menuUsers.classList.remove('hidden');
  } else {
    menuUsers.classList.add('hidden');
  }
  
  document.querySelector('#main-menu li[data-target="section-dashboard"]').click();
}

// ======================= DASHBOARD DATA =======================
async function loadDashboardData() {
  showLoader("Memuat Dashboard...");
  try {
    const data = await callAPI({ action: "getSiswa", pendingOnly: false });
    siswaDataList = data;
    
    // Hitung Stat
    const total = data.length;
    const pending = data.filter(s => s.status === 'Pending' || s.status === '').length;
    const aktif = data.filter(s => s.statusAktif === 'Aktif').length;
    const ditolak = data.filter(s => s.status === 'Perlu Perbaikan').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-aktif').textContent = aktif;
    document.getElementById('stat-ditolak').textContent = ditolak;

    // Render Aktivitas Terbaru (Max 5)
    const recentTable = document.getElementById('table-recent-body');
    recentTable.innerHTML = '';
    
    if (total === 0) {
      recentTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada aktivitas...</td></tr>';
    } else {
      const recentData = data.slice().reverse().slice(0, 5); // Ambil 5 data paling baru
      recentData.forEach(s => {
        let badgeColor = s.status === 'Selesai' ? 'green' : (s.status === 'Perlu Perbaikan' ? 'red' : 'orange');
        let statusBadge = `<span style="background:${badgeColor}; color:white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${s.status || 'Pending'}</span>`;
        
        recentTable.innerHTML += `
          <tr>
            <td>${s.nama}</td>
            <td>${s.program}</td>
            <td>${s.createdBy || 'N/A'}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      });
    }
  } catch (err) {
    console.error(err);
  }
  hideLoader();
}


// ======================= REGISTRATION & EDITING =======================
async function handleRegistrationOrEdit(e) {
  showLoader("Menyimpan Data...");
  
  try {
    const fileIjazah = document.getElementById('reg-file-ijazah').files[0];
    const fileKk = document.getElementById('reg-file-kk').files[0];
    const fileBayar = document.getElementById('reg-file-bayar').files[0];

    const b64Ijazah = fileIjazah ? await toBase64(fileIjazah) : null;
    const b64Kk = fileKk ? await toBase64(fileKk) : null;
    const b64Bayar = fileBayar ? await toBase64(fileBayar) : null;

    const siswaId = document.getElementById('reg-id').value;
    const actionStr = siswaId ? "updateSiswa" : "registerSiswa";

    const payload = {
      action: actionStr,
      data: {
        id: siswaId,
        nama: document.getElementById('reg-nama').value,
        jk: document.getElementById('reg-jk').value,
        nik: document.getElementById('reg-nik').value,
        nisn: document.getElementById('reg-nisn').value,
        tempatLahir: document.getElementById('reg-tempat-lahir').value,
        tglLahir: document.getElementById('reg-tgl-lahir').value,
        namaIbu: document.getElementById('reg-ibu').value,
        namaAyah: document.getElementById('reg-ayah').value,
        namaWali: document.getElementById('reg-wali').value,
        program: document.getElementById('reg-program').value,
        tahunLulus: document.getElementById('reg-tahun-lulus').value,
        ijazahFile: b64Ijazah,
        kkFile: b64Kk,
        bayarFile: b64Bayar,
        createdBy: currentUser.username // Akan dipakai jika register baru
      }
    };

    const res = await callAPI(payload);
    alert(res.message || "Data Berhasil Disimpan!");
    
    if (siswaId) {
      cancelEdit(); // Reset form and go back to list
      document.querySelector('li[data-target="section-list"]').click();
    } else {
      formInputSiswa.reset();
    }
  } catch(err) {
    alert("Gagal: " + err.message);
  }
  
  hideLoader();
}

function loadSiswaForEdit(id) {
  const s = siswaDataList.find(x => x.id === id);
  if(!s) return;

  // Ubah ke menu Pendaftaran Baru
  menuInput.click();
  
  // Set nilai di form
  document.getElementById('reg-id').value = s.id;
  document.getElementById('reg-nama').value = s.nama;
  document.getElementById('reg-jk').value = s.jk;
  document.getElementById('reg-nik').value = s.nik;
  document.getElementById('reg-nisn').value = s.nisn;
  document.getElementById('reg-tempat-lahir').value = s.tempatLahir;
  document.getElementById('reg-tgl-lahir').value = s.tglLahir ? s.tglLahir.split('T')[0] : '';
  document.getElementById('reg-ibu').value = s.namaIbu;
  document.getElementById('reg-ayah').value = s.namaAyah || '';
  document.getElementById('reg-wali').value = s.namaWali || '';
  document.getElementById('reg-program').value = s.program;
  document.getElementById('reg-tahun-lulus').value = s.tahunLulus;

  // Ubah tampilan
  formInputTitle.textContent = "Edit Data Siswa: " + s.nama;
  btnSubmitReg.textContent = "Simpan Perubahan";
  btnCancelEdit.classList.remove('hidden');
}

function cancelEdit() {
  formInputSiswa.reset();
  document.getElementById('reg-id').value = "";
  formInputTitle.textContent = "Formulir Pendaftaran Siswa Baru";
  btnSubmitReg.textContent = "Daftarkan Siswa";
  btnCancelEdit.classList.add('hidden');
}

const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});


// ======================= ANTREAN VALIDASI =======================
async function fetchSiswaData(onlyPending) {
  siswaListEl.innerHTML = '<li class="loading-text">Memuat data...</li>';
  try {
    const data = await callAPI({ action: "getSiswa", pendingOnly: onlyPending });
    siswaDataList = data;
    renderSiswaListValidasi();
  } catch (err) {
    siswaListEl.innerHTML = '<li>Error loading data.</li>';
  }
}

function renderSiswaListValidasi() {
  siswaListEl.innerHTML = '';
  const pendingData = siswaDataList.filter(s => s.status === 'Pending' || s.status === '');
  if (pendingData.length === 0) {
    siswaListEl.innerHTML = '<li class="loading-text">Semua data sudah divalidasi! 🎉</li>';
    emptyStateEl.classList.remove('hidden');
    validationPanelEl.classList.add('hidden');
    return;
  }

  pendingData.forEach(siswa => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="siswa-name">${siswa.nama}</span><span class="siswa-id">Program: ${siswa.program}</span>`;
    li.onclick = () => selectSiswa(siswa.id, li);
    siswaListEl.appendChild(li);
  });
}

function selectSiswa(id, listItemElement) {
  document.querySelectorAll('.inner-sidebar li').forEach(el => el.classList.remove('active'));
  listItemElement.classList.add('active');

  currentSiswa = siswaDataList.find(s => s.id === id);
  if (currentSiswa) {
    valNama.value = currentSiswa.nama || "";
    valNik.value = currentSiswa.nik || "";
    valNisn.value = currentSiswa.nisn || "";
    valTempatLahir.value = currentSiswa.tempatLahir || "";
    valTglLahir.value = currentSiswa.tglLahir ? currentSiswa.tglLahir.split('T')[0] : "";
    valIbu.value = currentSiswa.namaIbu || "";
    valAyah.value = currentSiswa.namaAyah || "";
    valWali.value = currentSiswa.namaWali || "";
    valJk.value = currentSiswa.jk || "";
    valProgram.value = currentSiswa.program || "";
    valTahunLulus.value = currentSiswa.tahunLulus || "";

    checkEligibility(currentSiswa);
    
    aiResultBox.classList.add('hidden');
    document.querySelectorAll('.form-panel input').forEach(el => el.classList.remove('error'));
    document.querySelector('.tab-btn[data-target="ijazah"]').click();

    emptyStateEl.classList.add('hidden');
    validationPanelEl.classList.remove('hidden');
  }
}

function checkEligibility(siswa) {
  let isEligible = true;
  let errorMsgs = [];
  const currentYear = new Date().getFullYear();

  if (siswa.tglLahir) {
    const age = Math.abs(new Date(Date.now() - new Date(siswa.tglLahir).getTime()).getUTCFullYear() - 1970);
    if (age < 7 && siswa.program === 'Paket A') {
      isEligible = false;
      errorMsgs.push(`Usia ${age} tahun belum memenuhi syarat Paket A (Minimal 7 tahun).`);
    }
  }

  if (siswa.program === 'Paket B' || siswa.program === 'Paket C') {
    if (siswa.tahunLulus) {
      const jeda = currentYear - parseInt(siswa.tahunLulus);
      if (jeda < 3) {
        isEligible = false;
        errorMsgs.push(`Jeda kelulusan Ijazah baru ${jeda} tahun. Syarat masuk minimal 3 tahun.`);
      }
    } else {
      errorMsgs.push("Tahun lulus ijazah sebelumnya belum diisi.");
      isEligible = false; // Jika strict
    }
  }

  eligBox.classList.remove('hidden');
  if (isEligible) {
    eligBox.className = 'eligibility-box';
    eligTitle.textContent = "✅ Memenuhi Syarat Regulasi";
    eligText.textContent = "Siswa memenuhi syarat.";
  } else {
    eligBox.className = 'eligibility-box error';
    eligTitle.textContent = "⚠️ Tidak Memenuhi Syarat";
    eligText.innerHTML = errorMsgs.join("<br>");
  }
}

async function handleAICheck(e) {
  if(!currentSiswa) return;
  const targetDoc = e.target.dataset.target || 'ijazah';
  if(targetDoc === 'bayar') {
    alert("Bukti bayar dicek manual secara visual."); return;
  }
  
  showLoader(`AI sedang menganalisis ${targetDoc.toUpperCase()}...`);
  try {
    const result = await callAPI({ action: "runAICheck", dataSiswa: currentSiswa, jenisDokumen: targetDoc });
    hideLoader();
    
    aiResultBox.classList.remove('hidden');
    if (result.status === "TIDAK_COCOK") {
      aiResultBox.className = "ai-result-box error";
      aiStatusTitle.textContent = "⚠️ Ditemukan Ketidaksesuaian";
      aiKoreksiText.textContent = result.koreksi;
    } else if (result.status === "COCOK") {
      aiResultBox.className = "ai-result-box";
      aiStatusTitle.textContent = "✅ Data Cocok";
      aiKoreksiText.textContent = "AI tidak menemukan perbedaan.";
    } else {
      aiResultBox.className = "ai-result-box error";
      aiStatusTitle.textContent = "❌ Error API";
      aiKoreksiText.textContent = result.koreksi;
    }
  } catch (err) {
    hideLoader(); alert(err.message);
  }
}

async function submitValidation(status) {
  if(!currentSiswa) return;
  showLoader(`Menyimpan status: ${status}...`);
  try {
    const response = await callAPI({
      action: "updateStatus",
      idSiswa: currentSiswa.id,
      status: status,
      koreksiAI: aiKoreksiText.textContent || ""
    });
    hideLoader();
    alert(response.message);
    fetchSiswaData(true);
  } catch (err) {
    hideLoader(); alert(err.message);
  }
}

// ======================= DAFTAR SISWA =======================
async function loadAllSiswa() {
  tableSiswaBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Memuat data...</td></tr>';
  try {
    const data = await callAPI({ action: "getSiswa", pendingOnly: false });
    siswaDataList = data; // Simpan untuk Edit Mode
    tableSiswaBody.innerHTML = '';
    
    if(data.length === 0) {
      tableSiswaBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Belum ada siswa</td></tr>';
      return;
    }

    data.forEach((s, idx) => {
      const tr = document.createElement('tr');
      const isAktif = s.statusAktif === 'Aktif';
      const isEditable = (currentUser.role === 'Admin' || currentUser.username === s.createdBy);

      tr.innerHTML = `
        <td>${idx+1}</td>
        <td>${s.nama}</td>
        <td>${s.program}</td>
        <td>${s.createdBy || 'N/A'}</td>
        <td>
          <button class="btn ${isAktif?'btn-success':'btn-danger'}" onclick="toggleStatusSiswa('${s.id}', '${isAktif?'Tidak Aktif':'Aktif'}')" style="padding:4px 8px; font-size:0.8rem;">
            ${isAktif ? 'Aktif' : 'Tidak Aktif'}
          </button>
        </td>
        <td>
          <button class="btn btn-primary" onclick="loadSiswaForEdit('${s.id}')" style="padding:4px 8px; font-size:0.8rem; opacity:${isEditable?'1':'0.5'}" ${isEditable?'':'disabled'}>
            Edit Data
          </button>
        </td>
      `;
      tableSiswaBody.appendChild(tr);
    });
  } catch (err) {
    tableSiswaBody.innerHTML = `<tr><td colspan="6">${err.message}</td></tr>`;
  }
}

async function toggleStatusSiswa(id, newStatus) {
  if(!confirm(`Ubah status siswa menjadi ${newStatus}?`)) return;
  showLoader("Menyimpan...");
  try {
    await callAPI({ action: "updateStatusAktif", idSiswa: id, statusAktif: newStatus });
    hideLoader();
    loadAllSiswa();
  } catch (err) {
    hideLoader(); alert(err.message);
  }
}


// ======================= KELOLA PENGGUNA =======================
async function loadAllUsers() {
  tableUsersBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Memuat data...</td></tr>';
  try {
    const data = await callAPI({ action: "getUsers" });
    tableUsersBody.innerHTML = '';
    data.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.username}</td><td>${u.nama}</td><td>${u.role}</td>
        <td><button class="btn btn-danger" onclick="deleteUser('${u.username}')" style="padding:4px 8px; font-size:0.8rem;">Hapus</button></td>
      `;
      tableUsersBody.appendChild(tr);
    });
  } catch (err) {
    tableUsersBody.innerHTML = `<tr><td colspan="4">${err.message}</td></tr>`;
  }
}

async function handleAddUser() {
  const u = document.getElementById('usr-username').value;
  const p = document.getElementById('usr-pass').value;
  const n = document.getElementById('usr-nama').value;
  const r = document.getElementById('usr-role').value;
  showLoader("Menyimpan user...");
  try {
    await callAPI({ action: "addUser", username: u, password: p, nama: n, role: r });
    hideLoader();
    document.getElementById('form-add-user').reset();
    loadAllUsers();
  } catch(err) {
    hideLoader(); alert(err.message);
  }
}

async function deleteUser(username) {
  if(!confirm("Hapus pengguna " + username + "?")) return;
  showLoader("Menghapus user...");
  try {
    await callAPI({ action: "deleteUser", username: username });
    hideLoader(); loadAllUsers();
  } catch(err) {
    hideLoader(); alert(err.message);
  }
}


// ======================= UTILS =======================
function showLoader(text) {
  loaderText.textContent = text;
  globalLoader.classList.remove('hidden');
}
function hideLoader() {
  globalLoader.classList.add('hidden');
}


// ======================= DUMMY API HANDLER =======================
async function handleDummyAPI(payload) {
  await new Promise(r => setTimeout(r, 800)); // Simulate delay
  
  if (payload.action === 'login') {
    if (payload.username === 'admin' && payload.password === 'admin') {
      return { username: 'admin', nama: 'Administrator', role: 'Admin' };
    }
    if (payload.username === 'guru' && payload.password === 'guru') {
      return { username: 'guru', nama: 'Guru Staff', role: 'Guru' };
    }
    throw new Error("Username atau password salah (Gunakan admin/admin atau guru/guru).");
  }
  
  if (payload.action === 'getSiswa') {
    return [
      { id:"S001", nama:"Budi Santoso", nik:"32001", nisn:"123", tempatLahir: "Bandung", tglLahir: "2010-05-15", namaIbu: "Siti", namaAyah: "Agus", namaWali: "", jk: "Laki-laki", program: "Paket B", tahunLulus: "2023", urlIjazah:"https://via.placeholder.com/600", urlKK:"https://via.placeholder.com/600", urlBayar:"https://via.placeholder.com/600?text=Bukti+Bayar", status: "Pending", statusAktif: "Tidak Aktif", createdBy: "admin" },
      { id:"S002", nama:"Ani Suryani", nik:"", nisn:"", tempatLahir: "", tglLahir: "", namaIbu: "", namaAyah: "", namaWali: "", jk: "Perempuan", program: "Paket C", tahunLulus: "", urlIjazah:"", urlKK:"", urlBayar:"", status: "Pending", statusAktif: "Aktif", createdBy: "guru" }
    ];
  }
  
  if (payload.action === 'runAICheck') {
    return {status:"TIDAK_COCOK", koreksi:"Dummy AI: Nama tidak sesuai dengan dokumen."};
  }
  
  if (payload.action === 'updateStatus' || payload.action === 'updateStatusAktif' || payload.action === 'registerSiswa' || payload.action === 'updateSiswa' || payload.action === 'addUser' || payload.action === 'deleteUser') {
    return { message: "Simulasi Dummy Berhasil. (Tidak ada data real yang berubah)" };
  }
  
  if (payload.action === 'getUsers') {
    return [
      {username: "admin", nama: "Administrator", role: "Admin"},
      {username: "guru", nama: "Guru Staff", role: "Guru"}
    ];
  }
  
  throw new Error("Action not found in dummy mode.");
}
