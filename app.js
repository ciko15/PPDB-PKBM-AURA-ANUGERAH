// Konfigurasi API Endpoint (Ubah USE_LOCAL_SERVER = true jika menjalankan server Node.js lokal 'npm start')
const USE_LOCAL_SERVER = false;
const LOCAL_API_URL = "http://localhost:3001/api";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx8tzFBAyd8aTe1_Or-7skj5lOBQ_K_CoXCAVz_WDqCxkiZg6gTi480I468psGy4wzJ/exec";
const API_URL = USE_LOCAL_SERVER ? LOCAL_API_URL : SCRIPT_URL;

let currentUser = null;
let siswaDataList = [];
let usersDataList = [];
let currentSiswa = null;

// Helper konversi format tanggal (mendukung Excel Serial Number misal 45091, ISO string, atau Date object) ke 'yyyy-MM-dd'
function formatToDateInput(val) {
  if (!val && val !== 0) return '';
  
  // Jika nilai adalah angka (Excel Serial Date, misal 45091 atau 38710)
  if (typeof val === 'number' || (!isNaN(val) && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    if (num > 1000) {
      // Excel epoch dimulai dari 30 Dec 1899
      const utcDays = Math.floor(num - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      const y = dateInfo.getUTCFullYear();
      const m = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateInfo.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();
  if (!str) return '';

  // Jika format sudah yyyy-MM-dd atau yyyy-MM-ddTHH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  // Jika format dd/MM/yyyy atau dd-MM-yyyy
  const parts = str.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) { // yyyy/mm/dd
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) { // dd/mm/yyyy
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  // Coba parse standar Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

// ======================= LOCAL FILE STORAGE HELPERS =======================
// Menyimpan berkas (foto, ijazah, kk, bayar) secara aman di IndexedDB/localStorage
function saveFileLocal(siswaId, type, dataUrl) {
  if (!siswaId || !dataUrl) return;
  try {
    localStorage.setItem(`ppdb_doc_${type}_${siswaId}`, dataUrl);
  } catch (e) {
    console.warn(`Gagal menyimpan ${type} ke storage lokal:`, e);
  }
}

function getFileLocal(siswaId, type) {
  if (!siswaId) return null;
  try {
    return localStorage.getItem(`ppdb_doc_${type}_${siswaId}`);
  } catch (e) {
    return null;
  }
}

// Helper untuk menggabungkan data dari server tanpa menimpa berkas lokal yang sudah ada
function mergeSiswaItem(existing, incoming) {
  if (!existing) {
    const localFoto = getFileLocal(incoming.id, 'foto');
    const localIjazah = getFileLocal(incoming.id, 'ijazah');
    const localKk = getFileLocal(incoming.id, 'kk');
    const localBayar = getFileLocal(incoming.id, 'bayar');
    return {
      ...incoming,
      urlFoto: (incoming.urlFoto && incoming.urlFoto.startsWith('http')) ? incoming.urlFoto : (localFoto || incoming.urlFoto || ''),
      urlIjazah: (incoming.urlIjazah && incoming.urlIjazah.startsWith('http')) ? incoming.urlIjazah : (localIjazah || incoming.urlIjazah || ''),
      urlKK: (incoming.urlKK && incoming.urlKK.startsWith('http')) ? incoming.urlKK : (localKk || incoming.urlKK || ''),
      urlBayar: (incoming.urlBayar && incoming.urlBayar.startsWith('http')) ? incoming.urlBayar : (localBayar || incoming.urlBayar || '')
    };
  }

  // Jika incoming kosong atau "Data Terlampir", pertahankan existing berkas
  const merged = { ...incoming };
  
  const isValidUrlOrData = (val) => typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:'));
  
  const localFoto = getFileLocal(incoming.id, 'foto');
  const localIjazah = getFileLocal(incoming.id, 'ijazah');
  const localKk = getFileLocal(incoming.id, 'kk');
  const localBayar = getFileLocal(incoming.id, 'bayar');

  if (isValidUrlOrData(incoming.urlFoto)) {
    merged.urlFoto = incoming.urlFoto;
  } else if (isValidUrlOrData(existing.urlFoto)) {
    merged.urlFoto = existing.urlFoto;
  } else {
    merged.urlFoto = localFoto || '';
  }

  if (isValidUrlOrData(incoming.urlIjazah)) {
    merged.urlIjazah = incoming.urlIjazah;
  } else if (isValidUrlOrData(existing.urlIjazah)) {
    merged.urlIjazah = existing.urlIjazah;
  } else {
    merged.urlIjazah = localIjazah || '';
  }

  if (isValidUrlOrData(incoming.urlKK)) {
    merged.urlKK = incoming.urlKK;
  } else if (isValidUrlOrData(existing.urlKK)) {
    merged.urlKK = existing.urlKK;
  } else {
    merged.urlKK = localKk || '';
  }

  if (isValidUrlOrData(incoming.urlBayar)) {
    merged.urlBayar = incoming.urlBayar;
  } else if (isValidUrlOrData(existing.urlBayar)) {
    merged.urlBayar = existing.urlBayar;
  } else {
    merged.urlBayar = localBayar || '';
  }

  return merged;
}

function mergeSiswaList(currentList, incomingList) {
  if (!Array.isArray(incomingList)) return currentList || [];
  const currentMap = new Map((currentList || []).map(item => [String(item.id), item]));
  return incomingList.map(inc => {
    const ex = currentMap.get(String(inc.id));
    return mergeSiswaItem(ex, inc);
  });
}

// ======================= DOM ELEMENTS =======================
const pageLanding = document.getElementById('page-landing');
const pageDashboard = document.getElementById('page-dashboard');
const modalLogin = document.getElementById('modal-login');
const btnCloseLogin = document.getElementById('btn-close-login');
const landingBrandLogo = document.getElementById('landing-brand-logo');
const loginModalOverlay = document.getElementById('login-modal-overlay');
let loginClickCount = 0;
let loginClickTimer = null;
const globalLoader = document.getElementById('global-loader');
const loaderText = document.getElementById('loader-text');

// Form Login
const formLogin = document.getElementById('form-login');
const inputLoginUser = document.getElementById('login-username');
const inputLoginPass = document.getElementById('login-password');
const activeUserName = document.getElementById('active-user-name');
const activeUserRole = document.getElementById('active-user-role');
const activeUserAvatar = document.getElementById('active-user-avatar');
const btnLogout = document.getElementById('menu-logout');
const btnProfile = document.getElementById('user-profile-btn');

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
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);
  if (btnProfile) btnProfile.addEventListener('click', showUserProfileModal);

  document.querySelectorAll('#main-menu li').forEach(item => {
    item.addEventListener('click', (e) => {
      document.querySelectorAll('#main-menu li').forEach(li => li.classList.remove('active'));
      item.classList.add('active');
      const targetId = item.getAttribute('data-target');

      if (targetId === 'section-input') {
        resetAndOpenRegisterForm();
        return;
      }

      contentSections.forEach(sec => sec.classList.add('hidden'));
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.remove('hidden');

      // Simpan view terakhir agar saat refresh/reload tetap di tab/menu ini
      try { localStorage.setItem('ppdb_last_section', targetId); } catch (e) {}

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
      let urlToShow = "";

      if (target === 'ijazah') {
        urlToShow = currentSiswa.urlIjazah;
        btnAi.style.display = 'inline-block';
        btnAi.textContent = "Cek dengan AI (Ijazah)";
        btnAi.dataset.target = "ijazah";
      } else if (target === 'kk') {
        urlToShow = currentSiswa.urlKK;
        btnAi.style.display = 'inline-block';
        btnAi.textContent = "Cek dengan AI (KK)";
        btnAi.dataset.target = "kk";
      } else if (target === 'foto') {
        urlToShow = currentSiswa.urlFoto;
        btnAi.style.display = 'none';
        btnAi.dataset.target = "foto";
      } else {
        urlToShow = currentSiswa.urlBayar;
        btnAi.style.display = 'inline-block';
        btnAi.textContent = "Cek Bukti Bayar";
        btnAi.dataset.target = "bayar";
      }

      const docImage = document.getElementById('doc-image');
      const docIframe = document.getElementById('doc-iframe');
      const docPlaceholder = document.getElementById('doc-placeholder');
      const docPlaceholderText = document.getElementById('doc-placeholder-text');

      const isDataTerlampir = typeof urlToShow === 'string' && urlToShow.trim().toLowerCase().includes('data terlampir');
      const isValidUri = typeof urlToShow === 'string' && (urlToShow.startsWith('http://') || urlToShow.startsWith('https://') || urlToShow.startsWith('data:'));

      if (!urlToShow || isDataTerlampir || !isValidUri) {
        docImage.style.display = 'none';
        docImage.removeAttribute('src');
        docIframe.style.display = 'none';
        docIframe.removeAttribute('src');
        docLoader.style.display = 'none';
        if (docPlaceholder) {
          docPlaceholder.style.display = 'block';
          if (docPlaceholderText) {
            docPlaceholderText.textContent = isDataTerlampir
              ? "Dokumen terlampir di sistem (arsip fisik/server)"
              : "Tidak ada pratinjau dokumen untuk data ini";
          }
        }
        return;
      }

      if (docPlaceholder) docPlaceholder.style.display = 'none';

      // Attempt to convert Google Drive URL to preview URL for iframe
      let isDriveUrl = urlToShow.includes('drive.google.com');
      let previewUrl = urlToShow;
      if (isDriveUrl) {
        if (urlToShow.includes('/view')) {
          previewUrl = urlToShow.replace('/view', '/preview');
        } else if (urlToShow.includes('uc?id=')) {
          try {
            const id = new URL(urlToShow).searchParams.get('id');
            if (id) previewUrl = `https://drive.google.com/file/d/${id}/preview`;
          } catch (e) { }
        }

        docImage.style.display = 'none';
        docImage.removeAttribute('src');
        docIframe.style.display = 'block';
        docIframe.src = previewUrl;
      } else {
        // If it's not a drive url or is base64, try using img first, iframe as fallback
        if (urlToShow.toLowerCase().includes('.pdf') || urlToShow.includes('application/pdf')) {
          docImage.style.display = 'none';
          docImage.removeAttribute('src');
          docIframe.style.display = 'block';
          docIframe.src = urlToShow;
        } else {
          docIframe.style.display = 'none';
          docIframe.removeAttribute('src');
          docImage.style.display = 'block';
          docImage.src = urlToShow;
        }
      }
    });
  });

  document.getElementById('btn-cek-ai').addEventListener('click', handleAICheck);
  document.getElementById('btn-setuju').addEventListener('click', () => submitValidation('Selesai'));
  document.getElementById('btn-tolak').addEventListener('click', () => submitValidation('Perlu Perbaikan'));

  formAddUser.addEventListener('submit', handleAddUser);

  const btnToggleAddUser = document.getElementById('btn-toggle-add-user');
  const btnCancelAddUser = document.getElementById('btn-cancel-add-user');
  const wrapperFormUser = document.getElementById('wrapper-form-user');

  if (btnToggleAddUser && wrapperFormUser) {
    btnToggleAddUser.addEventListener('click', () => {
      wrapperFormUser.classList.toggle('hidden');
      if (!wrapperFormUser.classList.contains('hidden')) {
        document.getElementById('usr-username').focus();
        wrapperFormUser.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  if (btnCancelAddUser && wrapperFormUser) {
    btnCancelAddUser.addEventListener('click', () => {
      formAddUser.reset();
      wrapperFormUser.classList.add('hidden');
    });
  }

  // Drawer Detail Siswa Close Listeners
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const btnDrawerClose = document.getElementById('btn-drawer-close');
  const drawerOverlay = document.getElementById('siswa-detail-overlay');

  if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeSiswaDetailDrawer);
  if (btnDrawerClose) btnDrawerClose.addEventListener('click', closeSiswaDetailDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeSiswaDetailDrawer);

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

  // Live preview thumbnail saat pengguna memilih berkas di formulir
  const setupFileInputPreview = (inputId, previewId) => {
    const input = document.getElementById(inputId);
    const container = document.getElementById(previewId);
    if (!input || !container) return;
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          container.innerHTML = `
            <img src="${e.target.result}" style="width:44px; height:44px; object-fit:cover; border-radius:6px; border:1px solid #0284c7;">
            <span style="font-size:0.75rem; color:#0284c7; font-weight:600;">✓ Berkas dipilih (${file.name.substring(0, 20)}...)</span>
          `;
          container.style.display = 'flex';
        };
        reader.readAsDataURL(file);
      } else {
        container.innerHTML = `
          <div style="padding:4px 8px; background:#e0f2fe; color:#0369a1; border-radius:4px; font-size:0.75rem; font-weight:600;">📄 ${file.name}</div>
        `;
        container.style.display = 'flex';
      }
    });
  };

  setupFileInputPreview('reg-file-ijazah', 'preview-reg-ijazah');
  setupFileInputPreview('reg-file-kk', 'preview-reg-kk');
  setupFileInputPreview('reg-file-bayar', 'preview-reg-bayar');
  setupFileInputPreview('reg-file-foto', 'preview-reg-foto');

  // Preview untuk berkas Pendaftaran Cepat AI
  setupFileInputPreview('ai-reg-file-kk', 'ai-preview-kk');
  setupFileInputPreview('ai-reg-file-ijazah', 'ai-preview-ijazah');
  setupFileInputPreview('ai-reg-file-foto', 'ai-preview-foto');

  // Event listener tombol Pendaftaran Cepat AI
  const btnProsesAIReg = document.getElementById('btn-proses-ai-reg');
  if (btnProsesAIReg) {
    btnProsesAIReg.addEventListener('click', handleEkstrakDataAI);
  }
}

// ======================= API CALLER =======================
async function callAPI(payload) {
  async function parseFetchResponse(response) {
    const rawText = await response.text();
    let result;
    try {
      result = JSON.parse(rawText);
    } catch (parseErr) {
      if (rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
        throw new Error("Layanan Google Apps Script sedang sibuk atau memulai ulang (Cold Start). Silakan coba lagi.");
      }
      throw new Error("Respon server bukan format JSON yang valid");
    }
    if (!result.success) throw new Error(result.error || "Gagal memanggil API");
    return result.data;
  }

  try {
    const fetchOptions = {
      method: "POST",
      body: JSON.stringify(payload)
    };
    
    // Jangan kirim header application/json ke Apps Script agar tidak memicu CORS Preflight (OPTIONS)
    if (API_URL === LOCAL_API_URL) {
      fetchOptions.headers = { "Content-Type": "application/json" };
    }

    const response = await fetch(API_URL, fetchOptions);
    return await parseFetchResponse(response);
  } catch (err) {
    // Jika server lokal gagal dan fallback tersedia, coba ke SCRIPT_URL
    if (API_URL !== SCRIPT_URL) {
      console.warn("Koneksi server lokal gagal, beralih ke Apps Script URL...", err);
      const fbResponse = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      return await parseFetchResponse(fbResponse);
    }
    throw err;
  }
}

// ======================= SESSION & LOGIN =======================
function checkLocalSession() {
  const session = localStorage.getItem('ppdb_session');
  if (session) {
    currentUser = JSON.parse(session);
    showDashboard();
  } else {
    pageLanding.classList.remove('hidden');
    pageDashboard.classList.add('hidden');
    if(modalLogin) modalLogin.classList.add('hidden');
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
  } catch (err) {
    Swal.fire('Error', err.message, 'error');
  }
  hideLoader();
}

let syncInterval = null;
let isSyncing = false;

function handleLogout() {
  Swal.fire({
    title: 'Konfirmasi Logout',
    text: "Apakah Anda yakin ingin keluar dari aplikasi?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Ya, Logout',
    cancelButtonText: 'Batal'
  }).then((result) => {
    if (result.isConfirmed) {
      if (syncInterval) clearInterval(syncInterval);
      localStorage.removeItem('ppdb_session');
      localStorage.removeItem('ppdb_siswa_cache');
      localStorage.removeItem('ppdb_last_section');
      siswaDataList = [];
      currentUser = null;
      pageLanding.classList.remove('hidden');
      pageDashboard.classList.add('hidden');
      if(modalLogin) modalLogin.classList.add('hidden');
    }
  });
}

function showDashboard() {
  pageLanding.classList.add('hidden');
  if(modalLogin) modalLogin.classList.add('hidden');
  pageDashboard.classList.remove('hidden');
  activeUserName.textContent = currentUser.nama;
  if (activeUserRole) activeUserRole.textContent = currentUser.role;
  if (activeUserAvatar) activeUserAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nama)}&background=0284c7&color=fff`;

  if (currentUser.role === 'Admin' || currentUser.role === 'Super Admin') {
    menuUsers.classList.remove('hidden');
  } else {
    menuUsers.classList.add('hidden');
  }

  // Muat data dari cache lokal secara instan (0 detik)
  loadCachedSiswaData();

  // Buka view terakhir yang dibuka sebelum refresh/reload
  const lastSection = localStorage.getItem('ppdb_last_section') || 'section-dashboard';
  const targetMenuItem = document.querySelector(`#main-menu li[data-target="${lastSection}"]`) || document.querySelector('#main-menu li[data-target="section-dashboard"]');
  if (targetMenuItem) {
    targetMenuItem.click();
  } else {
    document.querySelector('#main-menu li[data-target="section-dashboard"]').click();
  }

  if (syncInterval) clearInterval(syncInterval);
  // Interval sync 30 detik agar Google Apps Script tidak terkena rate limit / concurrency throttle
  syncInterval = setInterval(backgroundSync, 30000);
}

async function backgroundSync() {
  if (!currentUser || pageDashboard.classList.contains('hidden')) return;
  if (isSyncing) return; // Cegah overlap request sync jika request sebelumnya masih berjalan
  isSyncing = true;
  try {
    const rawData = await callAPI({ action: "getSiswa", pendingOnly: false });
    const mergedData = mergeSiswaList(siswaDataList, rawData);
    // Cek perbedaan sederhana untuk trigger update
    if (JSON.stringify(mergedData) !== JSON.stringify(siswaDataList)) {
      siswaDataList = mergedData;
      try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) {}
      const activeMenu = document.querySelector('#main-menu li.active');
      if (activeMenu) {
        const target = activeMenu.dataset.target;
        if (target === 'section-dashboard') renderDashboardUI(siswaDataList);
        else if (target === 'section-list') {
          if (typeof renderSiswaTable === 'function') renderSiswaTable(siswaDataList);
        }
        else if (target === 'section-validasi') fetchSiswaData(false, true); // Update sidebar list silently
      }
    }
  } catch (e) {
    // Abaikan error background sync secara hening (agar console tidak dipenuhi pesan error)
    console.debug("Background auto-sync skip:", e.message);
  } finally {
    isSyncing = false;
  }
}

// Helper untuk menampilkan data ke tampilan Dashboard
function renderDashboardUI(data) {
  if (!data) return;
  const total = data.length;
  const pending = data.filter(s => s.status === 'Pending' || s.status === '').length;
  const aktif = data.filter(s => s.statusAktif === 'Aktif').length;
  const ditolak = data.filter(s => s.status === 'Perlu Perbaikan').length;

  const elTotal = document.getElementById('stat-total');
  const elPending = document.getElementById('stat-pending');
  const elAktif = document.getElementById('stat-aktif');
  const elDitolak = document.getElementById('stat-ditolak');

  if (elTotal) elTotal.textContent = total;
  if (elPending) elPending.textContent = pending;
  if (elAktif) elAktif.textContent = aktif;
  if (elDitolak) elDitolak.textContent = ditolak;

  // Render Aktivitas Terbaru (Max 5)
  const recentTable = document.getElementById('table-recent-body');
  if (!recentTable) return;
  recentTable.innerHTML = '';

  if (total === 0) {
    recentTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada aktivitas...</td></tr>';
  } else {
    const recentData = data.slice().reverse().slice(0, 5); // Ambil 5 data paling baru
    recentData.forEach(s => {
      let badgeColor = s.status === 'Selesai' ? 'green' : (s.status === 'Perlu Perbaikan' ? 'red' : 'orange');
      let statusBadge = `<span style="background:${badgeColor}; color:white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem;">${s.status || 'Pending'}</span>`;

      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.title = 'Klik untuk melihat detail peserta didik';
      tr.onclick = () => showSiswaDetail(s.id);
      tr.innerHTML = `
        <td><strong>${s.nama || '-'}</strong></td>
        <td>${s.program || '-'}</td>
        <td>${s.createdBy || 'N/A'}</td>
        <td>${statusBadge}</td>
      `;
      recentTable.appendChild(tr);
    });
  }
}

// Muat cache lokal agar saat reload/refresh data langsung muncul seketika (0 detik)
function loadCachedSiswaData() {
  try {
    const cached = localStorage.getItem('ppdb_siswa_cache');
    if (cached) {
      siswaDataList = JSON.parse(cached);
      renderDashboardUI(siswaDataList);
    }
  } catch (e) {
    console.warn("Gagal membaca cache:", e);
  }
}

// ======================= DASHBOARD DATA =======================
async function loadDashboardData(silent = false) {
  // Jika sudah ada data dari cache / memori, jangan block UI dengan loader layar penuh
  const hasExistingData = siswaDataList && siswaDataList.length > 0;
  
  const syncIndicator = document.getElementById('sync-indicator');
  if (syncIndicator) syncIndicator.style.display = 'flex';

  if (!silent && !hasExistingData) {
    showLoader("Memuat data...");
  }

  try {
    const rawData = await callAPI({ action: "getSiswa", pendingOnly: false });
    siswaDataList = mergeSiswaList(siswaDataList, rawData);
    // Simpan ke cache lokal untuk reload instan berikutnya
    try {
      localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList));
    } catch (e) {}

    renderDashboardUI(siswaDataList);
  } catch (err) {
    console.error("Load dashboard error:", err);
  } finally {
    if (syncIndicator) syncIndicator.style.display = 'none';
    if (!silent && !hasExistingData) hideLoader();
  }
}


// ======================= REGISTRATION & EDITING =======================
async function handleRegistrationOrEdit(e) {
  Swal.fire({ title: 'Menyimpan Data...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

  try {
    const fileIjazah = document.getElementById('reg-file-ijazah').files[0];
    const fileKk = document.getElementById('reg-file-kk').files[0];
    const fileBayar = document.getElementById('reg-file-bayar').files[0];
    const fileFoto = document.getElementById('reg-file-foto').files[0];

    const b64Ijazah = fileIjazah ? await toBase64(fileIjazah) : null;
    const b64Kk = fileKk ? await toBase64(fileKk) : null;
    const b64Bayar = fileBayar ? await toBase64(fileBayar) : null;
    const b64Foto = fileFoto ? await toBase64(fileFoto) : null;

    const siswaId = document.getElementById('reg-id').value;
    const actionStr = siswaId ? "updateSiswa" : "registerSiswa";

    const payload = {
      action: actionStr,
      data: {
        id: siswaId,
        tglDaftar: document.getElementById('reg-tgl-daftar').value,
        nama: document.getElementById('reg-nama').value,
        jk: document.getElementById('reg-jk').value,
        nik: document.getElementById('reg-nik').value,
        nisn: document.getElementById('reg-nisn').value,
        noKk: document.getElementById('reg-no-kk').value,
        urutKk: document.getElementById('reg-urut-kk').value,
        kabKota: document.getElementById('reg-kab-kota').value,
        kecamatan: document.getElementById('reg-kecamatan').value,
        desaKelurahan: document.getElementById('reg-desa-kelurahan').value,
        kelas: document.getElementById('reg-kelas').value,
        tempatLahir: document.getElementById('reg-tempat-lahir').value,
        tglLahir: document.getElementById('reg-tgl-lahir').value,
        namaIbu: document.getElementById('reg-ibu').value,
        tahunLahirIbu: document.getElementById('reg-tahun-lahir-ibu').value,
        nikIbu: document.getElementById('reg-nik-ibu').value,
        namaAyah: document.getElementById('reg-ayah').value,
        tahunLahirAyah: document.getElementById('reg-tahun-lahir-ayah').value,
        nikAyah: document.getElementById('reg-nik-ayah').value,
        namaWali: document.getElementById('reg-wali').value,
        program: document.getElementById('reg-program').value,
        jenjang: document.getElementById('reg-program').value,
        tahunLulus: document.getElementById('reg-tahun-lulus').value,
        syarat: document.getElementById('reg-syarat').value,
        dokBerkas: document.getElementById('reg-dok-berkas').value,
        ijazahFile: b64Ijazah,
        kkFile: b64Kk,
        bayarFile: b64Bayar,
        fotoFile: b64Foto,
        createdBy: currentUser ? currentUser.username : 'Public'
      }
    };

    // Ambil data siswa yang sudah ada jika dalam mode edit
    const existingSiswa = siswaId ? siswaDataList.find(x => String(x.id) === String(siswaId)) : null;

    // Siapkan object siswa baru/edit untuk optimistic update ke memori & cache lokal
    const currentTgl = document.getElementById('reg-tgl-daftar').value || new Date().toISOString().split('T')[0];
    const finalSiswaId = siswaId || ('S' + Date.now());
    if (b64Foto) saveFileLocal(finalSiswaId, 'foto', b64Foto);
    if (b64Ijazah) saveFileLocal(finalSiswaId, 'ijazah', b64Ijazah);
    if (b64Kk) saveFileLocal(finalSiswaId, 'kk', b64Kk);
    if (b64Bayar) saveFileLocal(finalSiswaId, 'bayar', b64Bayar);

    const newOrUpdatedSiswa = {
      id: finalSiswaId,
      tglDaftar: currentTgl,
      nama: document.getElementById('reg-nama').value,
      jk: document.getElementById('reg-jk').value,
      nik: document.getElementById('reg-nik').value,
      nisn: document.getElementById('reg-nisn').value,
      noKk: document.getElementById('reg-no-kk').value,
      urutKk: document.getElementById('reg-urut-kk').value,
      kabKota: document.getElementById('reg-kab-kota').value,
      kecamatan: document.getElementById('reg-kecamatan').value,
      desaKelurahan: document.getElementById('reg-desa-kelurahan').value,
      kelas: document.getElementById('reg-kelas').value,
      tempatLahir: document.getElementById('reg-tempat-lahir').value,
      tglLahir: document.getElementById('reg-tgl-lahir').value,
      namaIbu: document.getElementById('reg-ibu').value,
      tahunLahirIbu: document.getElementById('reg-tahun-lahir-ibu').value,
      nikIbu: document.getElementById('reg-nik-ibu').value,
      namaAyah: document.getElementById('reg-ayah').value,
      tahunLahirAyah: document.getElementById('reg-tahun-lahir-ayah').value,
      nikAyah: document.getElementById('reg-nik-ayah').value,
      namaWali: document.getElementById('reg-wali').value,
      program: document.getElementById('reg-program').value,
      jenjang: document.getElementById('reg-program').value,
      tahunLulus: document.getElementById('reg-tahun-lulus').value,
      syarat: document.getElementById('reg-syarat').value,
      dokBerkas: document.getElementById('reg-dok-berkas').value,
      urlFoto: b64Foto ? b64Foto : (existingSiswa ? (existingSiswa.urlFoto || getFileLocal(finalSiswaId, 'foto')) : (getFileLocal(finalSiswaId, 'foto') || "")),
      status: existingSiswa ? (existingSiswa.status || "Pending") : "Pending",
      koreksiAI: existingSiswa ? (existingSiswa.koreksiAI || "") : "",
      urlIjazah: b64Ijazah ? b64Ijazah : (existingSiswa ? (existingSiswa.urlIjazah || getFileLocal(finalSiswaId, 'ijazah')) : (getFileLocal(finalSiswaId, 'ijazah') || "")),
      urlKK: b64Kk ? b64Kk : (existingSiswa ? (existingSiswa.urlKK || getFileLocal(finalSiswaId, 'kk')) : (getFileLocal(finalSiswaId, 'kk') || "")),
      urlBayar: b64Bayar ? b64Bayar : (existingSiswa ? (existingSiswa.urlBayar || getFileLocal(finalSiswaId, 'bayar')) : (getFileLocal(finalSiswaId, 'bayar') || "")),
      statusAktif: existingSiswa ? (existingSiswa.statusAktif || "Tidak Aktif") : "Tidak Aktif",
      createdBy: existingSiswa ? (existingSiswa.createdBy || (currentUser ? currentUser.username : 'Petugas')) : (currentUser ? currentUser.username : 'Petugas')
    };

    // Update langsung ke data lokal & render seketika tanpa menunggu sinkronisasi
    if (siswaId) {
      const idx = siswaDataList.findIndex(x => String(x.id) === String(siswaId));
      if (idx !== -1) {
        siswaDataList[idx] = { ...siswaDataList[idx], ...newOrUpdatedSiswa };
      }
    } else {
      siswaDataList.push(newOrUpdatedSiswa);
    }

    try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) {}

    // Update tampilan seketika
    renderDashboardUI(siswaDataList);
    if (typeof renderSiswaTable === 'function') renderSiswaTable(siswaDataList);

    // Reset & Tutup modal seketika
    const modalReg = document.getElementById('modal-register');
    if (modalReg) modalReg.classList.add('hidden');
    if (siswaId) {
      cancelEdit();
      document.querySelector('li[data-target="section-list"]').click();
    } else {
      formInputSiswa.reset();
    }

    // Tampilkan notifikasi instan
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: siswaId ? "Perubahan berhasil disimpan!" : "Siswa berhasil didaftarkan!",
      showConfirmButton: false,
      timer: 2500
    });

    // Kirim sinkronisasi ke server Google Sheets di latar belakang
    callAPI(payload).then(res => {
      // Jika server mengembalikan link Drive yang telah disimpan, perbarui cache lokal
      if (res) {
        const targetId = siswaId || res.id;
        if (targetId) {
          const idx = siswaDataList.findIndex(x => String(x.id) === String(targetId));
          if (idx !== -1) {
            if (res.urlIjazah) siswaDataList[idx].urlIjazah = res.urlIjazah;
            if (res.urlKK) siswaDataList[idx].urlKK = res.urlKK;
            if (res.urlBayar) siswaDataList[idx].urlBayar = res.urlBayar;
            if (res.urlFoto) siswaDataList[idx].urlFoto = res.urlFoto;
            if (res.updatedUrls) {
              if (res.updatedUrls.urlIjazah) siswaDataList[idx].urlIjazah = res.updatedUrls.urlIjazah;
              if (res.updatedUrls.urlKK) siswaDataList[idx].urlKK = res.updatedUrls.urlKK;
              if (res.updatedUrls.urlBayar) siswaDataList[idx].urlBayar = res.updatedUrls.urlBayar;
              if (res.updatedUrls.urlFoto) siswaDataList[idx].urlFoto = res.updatedUrls.urlFoto;
            }
            try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) {}
          }
        }
      }
      // Refresh data di background untuk sinkronisasi penuh
      loadDashboardData(true);
      loadAllSiswa(true);
    }).catch(err => {
      console.error("Gagal sinkronisasi data ke server:", err);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'Data lokal tersimpan, gagal sync: ' + err.message,
        showConfirmButton: false,
        timer: 4000
      });
    });

  } catch (err) {
    Swal.fire('Gagal', err.message, 'error');
  }
}

// Helper untuk membuka formulir pendaftaran baru: isi tanggal hari ini dan kunci jika bukan Admin
function resetAndOpenRegisterForm() {
  cancelEdit();
  const inputTglDaftar = document.getElementById('reg-tgl-daftar');
  if (inputTglDaftar) {
    // Set tanggal hari ini (yyyy-MM-dd)
    const today = new Date().toISOString().split('T')[0];
    inputTglDaftar.value = today;

    // Hanya Admin / Super Admin yang bisa mengubah tanggal daftar
    const isAdmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin');
    if (isAdmin) {
      inputTglDaftar.removeAttribute('readonly');
      inputTglDaftar.style.backgroundColor = '';
      inputTglDaftar.style.cursor = '';
      inputTglDaftar.title = '';
    } else {
      inputTglDaftar.setAttribute('readonly', 'true');
      inputTglDaftar.style.backgroundColor = '#f1f5f9';
      inputTglDaftar.style.cursor = 'not-allowed';
      inputTglDaftar.title = 'Tanggal pendaftaran otomatis hari ini (hanya Admin yang dapat mengubah)';
    }
  }

  const modalReg = document.getElementById('modal-register');
  if (modalReg) {
    modalReg.classList.remove('hidden');
    const modalContent = modalReg.querySelector('.modal-content');
    if (modalContent) modalContent.scrollTop = 0;
  }
}

function loadSiswaForEdit(id) {
  const s = siswaDataList.find(x => String(x.id) === String(id));
  if (!s) {
    Swal.fire('Info', 'Data siswa tidak ditemukan di daftar.', 'info');
    return;
  }

  // Buka modal formulir pendaftaran/edit
  const modalReg = document.getElementById('modal-register');
  if (modalReg) {
    modalReg.classList.remove('hidden');
    const modalContent = modalReg.querySelector('.modal-content');
    if (modalContent) modalContent.scrollTop = 0;
  }

  // Set nilai di form dengan pengamanan format tanggal
  try {
    document.getElementById('reg-id').value = s.id;
    const inputTglDaftar = document.getElementById('reg-tgl-daftar');
    if (inputTglDaftar) {
      inputTglDaftar.value = formatToDateInput(s.tglDaftar);
      const isAdmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin');
      if (isAdmin) {
        inputTglDaftar.removeAttribute('readonly');
        inputTglDaftar.style.backgroundColor = '';
        inputTglDaftar.style.cursor = '';
        inputTglDaftar.title = '';
      } else {
        inputTglDaftar.setAttribute('readonly', 'true');
        inputTglDaftar.style.backgroundColor = '#f1f5f9';
        inputTglDaftar.style.cursor = 'not-allowed';
        inputTglDaftar.title = 'Hanya Admin yang dapat mengubah tanggal daftar';
      }
    }
    document.getElementById('reg-nama').value = s.nama;
    document.getElementById('reg-jk').value = s.jk;
    document.getElementById('reg-nik').value = s.nik;
    document.getElementById('reg-nisn').value = s.nisn;
    document.getElementById('reg-no-kk').value = s.noKk || '';
    document.getElementById('reg-urut-kk').value = s.urutKk || '';
    document.getElementById('reg-kab-kota').value = s.kabKota || '';
    document.getElementById('reg-kecamatan').value = s.kecamatan || '';
    document.getElementById('reg-desa-kelurahan').value = s.desaKelurahan || '';
    document.getElementById('reg-kelas').value = s.kelas || '';
    document.getElementById('reg-tempat-lahir').value = s.tempatLahir;
    document.getElementById('reg-tgl-lahir').value = formatToDateInput(s.tglLahir);
    document.getElementById('reg-ibu').value = s.namaIbu;
    document.getElementById('reg-tahun-lahir-ibu').value = s.tahunLahirIbu || '';
    document.getElementById('reg-nik-ibu').value = s.nikIbu || '';
    document.getElementById('reg-ayah').value = s.namaAyah || '';
    document.getElementById('reg-tahun-lahir-ayah').value = s.tahunLahirAyah || '';
    document.getElementById('reg-nik-ayah').value = s.nikAyah || '';
    document.getElementById('reg-wali').value = s.namaWali || '';
    document.getElementById('reg-program').value = s.program || s.jenjang || '';
    document.getElementById('reg-tahun-lulus').value = s.tahunLulus || '';
    document.getElementById('reg-syarat').value = s.syarat || '';
    document.getElementById('reg-dok-berkas').value = s.dokBerkas || '';

    // Tampilkan preview berkas jika sudah ada tersimpan sebelumnya
    const fotoSrc = s.urlFoto || getFileLocal(s.id, 'foto');
    const pFoto = document.getElementById('preview-reg-foto');
    if (pFoto) {
      if (fotoSrc && (fotoSrc.startsWith('http') || fotoSrc.startsWith('data:'))) {
        pFoto.innerHTML = `<img src="${fotoSrc}" style="width:44px; height:44px; object-fit:cover; border-radius:6px; border:1px solid #16a34a;"><span style="font-size:0.75rem; color:#16a34a; font-weight:600;">✓ Foto tersimpan (Pilih file baru jika ingin ganti)</span>`;
        pFoto.style.display = 'flex';
      } else {
        pFoto.innerHTML = '';
        pFoto.style.display = 'none';
      }
    }

    const ijazahSrc = s.urlIjazah || getFileLocal(s.id, 'ijazah');
    const pIjazah = document.getElementById('preview-reg-ijazah');
    if (pIjazah) {
      if (ijazahSrc && (ijazahSrc.startsWith('http') || ijazahSrc.startsWith('data:'))) {
        pIjazah.innerHTML = `<span style="font-size:0.75rem; color:#16a34a; font-weight:600;">✓ Berkas Ijazah tersimpan (Pilih file baru jika ingin ganti)</span>`;
        pIjazah.style.display = 'flex';
      } else {
        pIjazah.innerHTML = '';
        pIjazah.style.display = 'none';
      }
    }

    const kkSrc = s.urlKK || getFileLocal(s.id, 'kk');
    const pKK = document.getElementById('preview-reg-kk');
    if (pKK) {
      if (kkSrc && (kkSrc.startsWith('http') || kkSrc.startsWith('data:'))) {
        pKK.innerHTML = `<span style="font-size:0.75rem; color:#16a34a; font-weight:600;">✓ Berkas KK tersimpan (Pilih file baru jika ingin ganti)</span>`;
        pKK.style.display = 'flex';
      } else {
        pKK.innerHTML = '';
        pKK.style.display = 'none';
      }
    }

    const bayarSrc = s.urlBayar || getFileLocal(s.id, 'bayar');
    const pBayar = document.getElementById('preview-reg-bayar');
    if (pBayar) {
      if (bayarSrc && (bayarSrc.startsWith('http') || bayarSrc.startsWith('data:'))) {
        pBayar.innerHTML = `<span style="font-size:0.75rem; color:#16a34a; font-weight:600;">✓ Bukti Bayar tersimpan (Pilih file baru jika ingin ganti)</span>`;
        pBayar.style.display = 'flex';
      } else {
        pBayar.innerHTML = '';
        pBayar.style.display = 'none';
      }
    }
  } catch (e) {
    console.error("Error setting form values: ", e);
  }

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
  const modalReg = document.getElementById('modal-register');
  if (modalReg) modalReg.classList.add('hidden');

  // Bersihkan preview file
  ['preview-reg-ijazah', 'preview-reg-kk', 'preview-reg-bayar', 'preview-reg-foto'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = ''; el.style.display = 'none'; }
  });
}

const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});


// ======================= ANTREAN VALIDASI =======================
async function fetchSiswaData(onlyPending, silent = false) {
  if (siswaDataList && siswaDataList.length > 0) {
    renderSiswaListValidasi();
  } else if (!silent) {
    siswaListEl.innerHTML = '<li class="loading-text">Memuat data...</li>';
  }

  try {
    const rawData = await callAPI({ action: "getSiswa", pendingOnly: onlyPending });
    siswaDataList = mergeSiswaList(siswaDataList, rawData);
    try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) {}
    renderSiswaListValidasi();
  } catch (err) {
    if (!siswaDataList || siswaDataList.length === 0) {
      siswaListEl.innerHTML = '<li>Error loading data.</li>';
    }
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
    valTglLahir.value = formatToDateInput(currentSiswa.tglLahir);
    valIbu.value = currentSiswa.namaIbu || "";
    valAyah.value = currentSiswa.namaAyah || "";
    valWali.value = currentSiswa.namaWali || "";
    valJk.value = currentSiswa.jk || "";
    valProgram.value = currentSiswa.program || "";
    valTahunLulus.value = currentSiswa.tahunLulus || "";

    checkEligibility(currentSiswa);

    aiResultBox.classList.add('hidden');
    document.querySelectorAll('.form-panel input').forEach(el => el.classList.remove('error'));

    // Reset doc viewer display
    document.getElementById('doc-image').style.display = 'none';
    if (document.getElementById('doc-iframe')) document.getElementById('doc-iframe').style.display = 'none';

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
  if (!currentSiswa) return;
  const targetDoc = e.target.dataset.target || 'ijazah';
  if (targetDoc === 'bayar') {
    Swal.fire('Informasi', 'Bukti bayar dicek manual secara visual.', 'info'); return;
  }

  showLoader(`AI sedang menganalisis ${targetDoc.toUpperCase()}...`);
  try {
    // Siapkan payload dengan fallback berkas lokal jika di server belum ada Drive URL
    const enrichedDataSiswa = {
      ...currentSiswa,
      urlIjazah: (currentSiswa.urlIjazah && (currentSiswa.urlIjazah.startsWith('http') || currentSiswa.urlIjazah.startsWith('data:'))) ? currentSiswa.urlIjazah : (getFileLocal(currentSiswa.id, 'ijazah') || ""),
      urlKK: (currentSiswa.urlKK && (currentSiswa.urlKK.startsWith('http') || currentSiswa.urlKK.startsWith('data:'))) ? currentSiswa.urlKK : (getFileLocal(currentSiswa.id, 'kk') || ""),
      urlFoto: (currentSiswa.urlFoto && (currentSiswa.urlFoto.startsWith('http') || currentSiswa.urlFoto.startsWith('data:'))) ? currentSiswa.urlFoto : (getFileLocal(currentSiswa.id, 'foto') || "")
    };

    const userApiKey = localStorage.getItem('gemini_api_key') || 'AQ.Ab8RN6IsOK3hu-S-7x1mSMT91X37w4Fur-AbgFaF0WqCdaTnPA';

    const result = await callAPI({ 
      action: "runAICheck", 
      dataSiswa: enrichedDataSiswa, 
      jenisDokumen: targetDoc,
      apiKey: userApiKey
    });
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
    hideLoader(); Swal.fire('Error', err.message, 'error');
  }
}

async function submitValidation(status) {
  if (!currentSiswa) return;
  showLoader(`Menyimpan status: ${status}...`);
  try {
    const response = await callAPI({
      action: "updateStatus",
      idSiswa: currentSiswa.id,
      status: status,
      koreksiAI: aiKoreksiText.textContent || ""
    });
    hideLoader();
    Swal.fire('Berhasil', response.message, 'success');
    fetchSiswaData(true);
  } catch (err) {
    hideLoader(); Swal.fire('Error', err.message, 'error');
  }
}

// ======================= DAFTAR SISWA =======================
async function loadAllSiswa(silent = false) {
  if (siswaDataList && siswaDataList.length > 0) {
    renderSiswaTable(siswaDataList);
  } else if (!silent) {
    tableSiswaBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Memuat data...</td></tr>';
  }

  try {
    const rawData = await callAPI({ action: "getSiswa", pendingOnly: false });
    siswaDataList = mergeSiswaList(siswaDataList, rawData);
    try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) {}
    const searchInput = document.getElementById('search-siswa');
    if (searchInput && searchInput.value) {
      filterSiswaTable();
    } else {
      renderSiswaTable(siswaDataList);
    }
  } catch (err) {
    if (!siswaDataList || siswaDataList.length === 0) {
      tableSiswaBody.innerHTML = `<tr><td colspan="7">${err.message}</td></tr>`;
    }
  }
}

function filterSiswaTable() {
  const query = document.getElementById('search-siswa').value.toLowerCase();
  const filteredData = siswaDataList.filter(s => {
    return (s.nama && String(s.nama).toLowerCase().includes(query)) ||
      (s.nik && String(s.nik).toLowerCase().includes(query)) ||
      (s.nisn && String(s.nisn).toLowerCase().includes(query)) ||
      (s.program && String(s.program).toLowerCase().includes(query));
  });
  renderSiswaTable(filteredData);
}

function renderSiswaTable(data) {
  tableSiswaBody.innerHTML = '';

  if (data.length === 0) {
    tableSiswaBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Belum ada siswa yang cocok</td></tr>';
    return;
  }

  data.forEach((s, idx) => {
    const tr = document.createElement('tr');
    const isAktif = s.statusAktif === 'Aktif';
    const isEditable = currentUser ? (currentUser.role === 'Admin' || currentUser.role === 'Super Admin' || currentUser.role === 'Guru' || currentUser.username === s.createdBy) : true;

    tr.style.cursor = 'pointer';
    tr.onclick = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
      showSiswaDetail(s.id);
    };

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${s.nama}</td>
      <td>${s.program}</td>
      <td>${s.createdBy || 'N/A'}</td>
      <td>
        <button class="btn ${isAktif ? 'btn-success' : 'btn-danger'}" onclick="toggleStatusSiswa('${s.id}', '${isAktif ? 'Tidak Aktif' : 'Aktif'}')" style="padding:4px 8px; font-size:0.8rem;">
          ${isAktif ? 'Aktif' : 'Tidak Aktif'}
        </button>
      </td>
      <td style="display: flex; gap: 0.5rem; justify-content: center;">
        <button class="btn btn-primary" onclick="loadSiswaForEdit('${s.id}')" style="padding:4px 8px; font-size:0.8rem;">
          Edit
        </button>
        ${currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin') ? `<button class="btn btn-danger" onclick="deleteSiswaData('${s.id}')" style="padding:4px 8px; font-size:0.8rem;">Hapus</button>` : ''}
      </td>
    `;
    tableSiswaBody.appendChild(tr);
  });
}

function showSiswaDetail(id) {
  const s = siswaDataList.find(x => String(x.id) === String(id));
  if (!s) return;

  const drawer = document.getElementById('siswa-detail-drawer');
  const overlay = document.getElementById('siswa-detail-overlay');
  const content = document.getElementById('drawer-detail-content');
  const subtitle = document.getElementById('drawer-subtitle');

  if (subtitle) {
    subtitle.textContent = `ID: ${s.id || '-'} | Didaftarkan oleh: ${s.createdBy || 'Petugas'}`;
  }

  const badgeColor = s.status === 'Selesai' ? '#15803d' : (s.status === 'Perlu Perbaikan' ? '#b91c1c' : '#b45309');
  const badgeBg = s.status === 'Selesai' ? '#dcfce7' : (s.status === 'Perlu Perbaikan' ? '#fee2e2' : '#fef3c7');
  const statusAktifColor = s.statusAktif === 'Aktif' ? '#15803d' : '#64748b';
  const statusAktifBg = s.statusAktif === 'Aktif' ? '#dcfce7' : '#f1f5f9';

  const finalFoto = (s.urlFoto && (s.urlFoto.startsWith('http') || s.urlFoto.startsWith('data:'))) ? s.urlFoto : getFileLocal(s.id, 'foto');
  const finalIjazah = (s.urlIjazah && (s.urlIjazah.startsWith('http') || s.urlIjazah.startsWith('data:'))) ? s.urlIjazah : getFileLocal(s.id, 'ijazah');
  const finalKK = (s.urlKK && (s.urlKK.startsWith('http') || s.urlKK.startsWith('data:'))) ? s.urlKK : getFileLocal(s.id, 'kk');
  const finalBayar = (s.urlBayar && (s.urlBayar.startsWith('http') || s.urlBayar.startsWith('data:'))) ? s.urlBayar : getFileLocal(s.id, 'bayar');

  content.innerHTML = `
    <!-- Ringkasan Status Header & Foto Profil -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; gap: 1rem; align-items: center;">
      <div style="position: relative; flex-shrink: 0;">
        ${finalFoto ? 
          `<img src="${finalFoto}" alt="Foto ${s.nama}" style="width: 72px; height: 72px; border-radius: 12px; object-fit: cover; border: 2px solid #0284c7; box-shadow: 0 2px 6px rgba(0,0,0,0.1); cursor: pointer;" onclick="previewDocModal('foto', '${s.id}', '${s.nama ? s.nama.replace(/'/g, "\\'") : ''}')" title="Klik untuk perbesar">` :
          `<div style="width: 72px; height: 72px; border-radius: 12px; background: #f1f5f9; border: 2px dashed #cbd5e1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.75rem; text-align: center; padding: 4px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:2px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span>Tanpa Foto</span>
          </div>`
        }
      </div>
      <div style="flex: 1; min-width: 0;">
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; color: #0f172a; word-break: break-word;">${s.nama || '-'}</h3>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 3px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
            Status: ${s.status || 'Pending'}
          </span>
          <span style="background: ${statusAktifBg}; color: ${statusAktifColor}; padding: 3px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
            ${s.statusAktif || 'Tidak Aktif'}
          </span>
          <span style="background: #e0f2fe; color: #0369a1; padding: 3px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600;">
            ${s.program || '-'}
          </span>
        </div>
      </div>
    </div>

    <!-- Data Identitas -->
    <div class="drawer-detail-card">
      <h4>Identitas Siswa</h4>
      <div class="drawer-info-row"><span class="drawer-info-label">NIK</span><span class="drawer-info-value">${s.nik || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">NISN</span><span class="drawer-info-value">${s.nisn || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">Jenis Kelamin</span><span class="drawer-info-value">${s.jk || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">Tempat Lahir</span><span class="drawer-info-value">${s.tempatLahir || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">Tanggal Lahir</span><span class="drawer-info-value">${formatToDateInput(s.tglLahir) || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">No. Kartu Keluarga</span><span class="drawer-info-value">${s.noKk || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">Urut di KK</span><span class="drawer-info-value">${s.urutKk || '-'}</span></div>
    </div>

    <!-- Data Akademik & Program -->
    <div class="drawer-detail-card">
      <h4>Pendidikan & Program</h4>
      <div class="drawer-info-row"><span class="drawer-info-label">Jenjang / Program</span><span class="drawer-info-value">${s.program || s.jenjang || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">Kelas</span><span class="drawer-info-value">${s.kelas || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">Tahun Lulus Asal</span><span class="drawer-info-value">${s.tahunLulus || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">Tanggal Daftar</span><span class="drawer-info-value">${formatToDateInput(s.tglDaftar) || '-'}</span></div>
    </div>

    <!-- Data Orang Tua -->
    <div class="drawer-detail-card">
      <h4>Data Orang Tua & Wali</h4>
      <div class="drawer-info-row"><span class="drawer-info-label">Ibu Kandung</span><span class="drawer-info-value">${s.namaIbu || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">NIK Ibu</span><span class="drawer-info-value">${s.nikIbu || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">Ayah Kandung</span><span class="drawer-info-value">${s.namaAyah || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">NIK Ayah</span><span class="drawer-info-value">${s.nikAyah || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">Nama Wali</span><span class="drawer-info-value">${s.namaWali || '-'}</span></div>
    </div>

    <!-- Alamat Domisili -->
    <div class="drawer-detail-card">
      <h4>Wilayah & Domisili</h4>
      <div class="drawer-info-row"><span class="drawer-info-label">Kabupaten/Kota</span><span class="drawer-info-value">${s.kabKota || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">Kecamatan</span><span class="drawer-info-value">${s.kecamatan || '-'}</span></div>
      <div class="drawer-info-row"><span class="drawer-info-label">Desa / Kelurahan</span><span class="drawer-info-value">${s.desaKelurahan || '-'}</span></div>
    </div>

    <!-- Berkas & Dokumen Terlampir -->
    <div class="drawer-detail-card">
      <h4>Berkas & Dokumen</h4>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-top: 0.5rem;">
        <!-- Foto -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem; text-align: center;">
          <span style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Foto Siswa</span>
          ${finalFoto ?
            `<button type="button" onclick="previewDocModal('foto', '${s.id}', '${s.nama ? s.nama.replace(/'/g, "\\'") : ''}')" style="background: none; border: none; color: #0284c7; font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 0;">🔍 Lihat Berkas</button>` :
            `<span style="color: #94a3b8; font-size: 0.75rem;">Tidak ada</span>`
          }
        </div>
        <!-- Ijazah -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem; text-align: center;">
          <span style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Ijazah</span>
          ${finalIjazah ?
            `<button type="button" onclick="previewDocModal('ijazah', '${s.id}', '${s.nama ? s.nama.replace(/'/g, "\\'") : ''}')" style="background: none; border: none; color: #0284c7; font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 0;">🔍 Lihat Berkas</button>` :
            `<span style="color: #94a3b8; font-size: 0.75rem;">Tidak ada</span>`
          }
        </div>
        <!-- KK -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem; text-align: center;">
          <span style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Kartu Keluarga</span>
          ${finalKK ?
            `<button type="button" onclick="previewDocModal('kk', '${s.id}', '${s.nama ? s.nama.replace(/'/g, "\\'") : ''}')" style="background: none; border: none; color: #0284c7; font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 0;">🔍 Lihat Berkas</button>` :
            `<span style="color: #94a3b8; font-size: 0.75rem;">Tidak ada</span>`
          }
        </div>
        <!-- Bukti Bayar -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem; text-align: center;">
          <span style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px;">Bukti Bayar</span>
          ${finalBayar ?
            `<button type="button" onclick="previewDocModal('bayar', '${s.id}', '${s.nama ? s.nama.replace(/'/g, "\\'") : ''}')" style="background: none; border: none; color: #0284c7; font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 0;">🔍 Lihat Berkas</button>` :
            `<span style="color: #94a3b8; font-size: 0.75rem;">Tidak ada</span>`
          }
        </div>
      </div>
    </div>

    <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
      <button class="btn btn-primary" onclick="closeSiswaDetailDrawer(); loadSiswaForEdit('${s.id}')" style="flex: 1; padding: 10px;">
        ✏️ Edit Data Siswa
      </button>
    </div>
  `;

  if (drawer && overlay) {
    overlay.classList.remove('hidden');
    drawer.classList.remove('hidden');
  }
}

// ======================= MODAL LIGHTBOX PRATINJAU BERKAS =======================
let currentDocUrl = "";
let currentDocTitle = "";

function previewDocModal(type, siswaId, namaSiswa) {
  const s = siswaDataList.find(x => String(x.id) === String(siswaId));
  let url = "";
  let label = "Dokumen";

  if (type === 'foto') {
    url = (s && s.urlFoto && (s.urlFoto.startsWith('http') || s.urlFoto.startsWith('data:'))) ? s.urlFoto : getFileLocal(siswaId, 'foto');
    label = "Foto Siswa";
  } else if (type === 'ijazah') {
    url = (s && s.urlIjazah && (s.urlIjazah.startsWith('http') || s.urlIjazah.startsWith('data:'))) ? s.urlIjazah : getFileLocal(siswaId, 'ijazah');
    label = "Berkas Ijazah";
  } else if (type === 'kk') {
    url = (s && s.urlKK && (s.urlKK.startsWith('http') || s.urlKK.startsWith('data:'))) ? s.urlKK : getFileLocal(siswaId, 'kk');
    label = "Kartu Keluarga (KK)";
  } else if (type === 'bayar') {
    url = (s && s.urlBayar && (s.urlBayar.startsWith('http') || s.urlBayar.startsWith('data:'))) ? s.urlBayar : getFileLocal(siswaId, 'bayar');
    label = "Bukti Pembayaran";
  }

  if (!url) {
    Swal.fire('Informasi', 'Berkas belum tersedia atau belum diunggah.', 'info');
    return;
  }

  currentDocUrl = url;
  currentDocTitle = `${label}_${namaSiswa || siswaId}`;

  const modal = document.getElementById('modal-doc-viewer');
  const titleEl = document.getElementById('doc-modal-title');
  const imgEl = document.getElementById('doc-modal-img');
  const iframeEl = document.getElementById('doc-modal-iframe');

  if (titleEl) titleEl.textContent = `${label} - ${namaSiswa || 'Siswa'}`;

  const isDrive = url.includes('drive.google.com');
  const isPdf = url.toLowerCase().includes('.pdf') || url.includes('application/pdf');

  if (isDrive) {
    let previewUrl = url;
    if (url.includes('/view')) {
      previewUrl = url.replace('/view', '/preview');
    } else if (url.includes('uc?id=')) {
      try {
        const id = new URL(url).searchParams.get('id');
        if (id) previewUrl = `https://drive.google.com/file/d/${id}/preview`;
      } catch (e) {}
    }
    imgEl.style.display = 'none';
    imgEl.removeAttribute('src');
    iframeEl.style.display = 'block';
    iframeEl.src = previewUrl;
  } else if (isPdf) {
    imgEl.style.display = 'none';
    imgEl.removeAttribute('src');
    iframeEl.style.display = 'block';
    iframeEl.src = url;
  } else {
    iframeEl.style.display = 'none';
    iframeEl.removeAttribute('src');
    imgEl.style.display = 'block';
    imgEl.src = url;
  }

  if (modal) modal.classList.remove('hidden');
}

function closeDocViewerModal() {
  const modal = document.getElementById('modal-doc-viewer');
  const imgEl = document.getElementById('doc-modal-img');
  const iframeEl = document.getElementById('doc-modal-iframe');
  if (imgEl) imgEl.removeAttribute('src');
  if (iframeEl) iframeEl.removeAttribute('src');
  if (modal) modal.classList.add('hidden');
}

function downloadCurrentDocModal() {
  if (!currentDocUrl) return;
  const link = document.createElement('a');
  link.href = currentDocUrl;
  link.download = (currentDocTitle ? currentDocTitle.replace(/[^a-zA-Z0-9_\-]/g, '_') : 'berkas_dokumen') + (currentDocUrl.startsWith('data:image/png') ? '.png' : (currentDocUrl.includes('.pdf') ? '.pdf' : '.jpg'));
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function closeSiswaDetailDrawer() {
  const drawer = document.getElementById('siswa-detail-drawer');
  const overlay = document.getElementById('siswa-detail-overlay');
  if (drawer) drawer.classList.add('hidden');
  if (overlay) overlay.classList.add('hidden');
}

async function toggleStatusSiswa(id, newStatus) {
  Swal.fire({
    title: 'Konfirmasi Perubahan Status',
    html: `Apakah Anda yakin ingin mengubah status siswa menjadi <b>${newStatus}</b>?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Ya, Ubah Status',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      showLoader("Menyimpan...");
      try {
        await callAPI({ action: "updateStatusAktif", idSiswa: id, statusAktif: newStatus });
        hideLoader();
        loadAllSiswa();
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: `Status berhasil diubah menjadi ${newStatus}`,
          showConfirmButton: false,
          timer: 3000
        });
      } catch (err) {
        hideLoader(); Swal.fire('Error', err.message, 'error');
      }
    }
  });
}

async function deleteSiswaData(id) {
  Swal.fire({
    title: 'Hapus Data?',
    text: "Anda yakin ingin menghapus data siswa ini secara permanen?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal'
  }).then(async (result) => {
    if (result.isConfirmed) {
      showLoader("Menghapus data...");
      try {
        await callAPI({ action: "deleteSiswa", idSiswa: id });
        hideLoader();
        Swal.fire('Terhapus', 'Data siswa berhasil dihapus.', 'success');
        loadAllSiswa();
      } catch (err) {
        hideLoader(); Swal.fire('Error', err.message, 'error');
      }
    }
  });
}


// ======================= KELOLA PENGGUNA & PROFIL =======================
function showUserProfileModal() {
  if (!currentUser) return;
  const htmlContent = `
    <div style="text-align: left; font-size: 0.9rem; line-height: 1.5;">
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nama)}&background=0284c7&color=fff&size=100" style="border-radius: 50%; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h3 style="margin-top: 10px; margin-bottom: 2px;">${currentUser.nama}</h3>
        <p style="color: #64748b; margin: 0;">${currentUser.role}</p>
      </div>
      <form id="form-update-profile" onsubmit="event.preventDefault();">
        <div class="form-group">
          <label>Username (Tidak dapat diubah)</label>
          <input type="text" value="${currentUser.username}" readonly style="background: #f1f5f9; cursor: not-allowed; border: 1px solid #cbd5e1;">
        </div>
        <div class="form-group" style="margin-top: 1rem;">
          <label>Role Akses (Tidak dapat diubah)</label>
          <input type="text" value="${currentUser.role}" readonly style="background: #f1f5f9; cursor: not-allowed; border: 1px solid #cbd5e1;">
        </div>
        <div class="form-group" style="margin-top: 1rem;">
          <label>Nama Lengkap</label>
          <input type="text" id="prof-nama" value="${currentUser.nama}" required style="border: 1px solid #cbd5e1;">
        </div>
        <div class="form-group" style="margin-top: 1rem;">
          <label>Password Baru (Opsional)</label>
          <input type="password" id="prof-pass" placeholder="Ketik password baru jika ingin mengubah" style="border: 1px solid #cbd5e1;">
        </div>
      </form>
    </div>
  `;

  Swal.fire({
    title: 'Profil Pengguna',
    html: htmlContent,
    showCancelButton: true,
    confirmButtonText: 'Simpan Perubahan',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#10b981',
    preConfirm: async () => {
      const newNama = document.getElementById('prof-nama').value;
      const newPass = document.getElementById('prof-pass').value;

      if (!newNama) {
        Swal.showValidationMessage('Nama lengkap tidak boleh kosong');
        return false;
      }

      showLoader("Menyimpan Profil...");
      try {
        await callAPI({ action: "updateUser", username: currentUser.username, nama: newNama, password: newPass });
        // Update local session
        currentUser.nama = newNama;
        localStorage.setItem('ppdb_session', JSON.stringify(currentUser));
        // Update UI
        activeUserName.textContent = currentUser.nama;
        activeUserAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nama)}&background=0284c7&color=fff`;
        hideLoader();
        return true;
      } catch (err) {
        hideLoader();
        Swal.showValidationMessage(`Error: ${err.message}`);
        return false;
      }
    }
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Profil berhasil diperbarui',
        showConfirmButton: false,
        timer: 3000
      });
    }
  });
}

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

  // Langsung tampilkan user baru ke tabel seketika (Optimistic UI)
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${u}</td><td>${n}</td><td>${r}</td>
    <td><button class="btn btn-danger" onclick="deleteUser('${u}')" style="padding:4px 8px; font-size:0.8rem;">Hapus</button></td>
  `;
  tableUsersBody.appendChild(tr);

  // Reset & sembunyikan form seketika
  document.getElementById('form-add-user').reset();
  const wrapper = document.getElementById('wrapper-form-user');
  if (wrapper) wrapper.classList.add('hidden');

  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: 'Pengguna berhasil ditambahkan',
    showConfirmButton: false,
    timer: 2500
  });

  // Kirim data ke Google Sheets di background tanpa memblokir layar
  callAPI({ action: "addUser", username: u, password: p, nama: n, role: r })
    .then(() => {
      loadAllUsers(true);
    })
    .catch(err => {
      console.error(err);
      Swal.fire('Error Sync', err.message, 'error');
      loadAllUsers(true);
    });
}

async function deleteUser(username) {
  if (!confirm("Hapus pengguna " + username + "?")) return;
  showLoader("Menghapus user...");
  try {
    await callAPI({ action: "deleteUser", username: username });
    hideLoader(); loadAllUsers();
  } catch (err) {
    hideLoader(); Swal.fire('Error', err.message, 'error');
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

// ======================= EXPORT / IMPORT EXCEL & CSV =======================
function exportDataToExcel() {
  if (!siswaDataList || siswaDataList.length === 0) {
    Swal.fire('Info', 'Tidak ada data untuk diekspor', 'info');
    return;
  }

  const dataToExport = siswaDataList.map((s) => ({
    'No.': s.id || '',
    'Tanggal Daftar': s.tglDaftar ? String(s.tglDaftar).split('T')[0] : '',
    'NISN': s.nisn || '',
    'NIK': s.nik || '',
    'No. Kartu Keluarga': s.noKk || '',
    'Urut KK': s.urutKk || '',
    'Kabupaten/Kota': s.kabKota || '',
    'Kecamatan': s.kecamatan || '',
    'Desa Kelurahan': s.desaKelurahan || '',
    'Nama Lengkap': s.nama || '',
    'Tempat Lahir': s.tempatLahir || '',
    'Tanggal Lahir': s.tglLahir ? String(s.tglLahir).split('T')[0] : '',
    'Nama Ayah Kandung': s.namaAyah || '',
    'Tahun Lahir Ayah': s.tahunLahirAyah || '',
    'NIK Ayah': s.nikAyah || '',
    'Nama Ibu Kandung': s.namaIbu || '',
    'Tahun Lahir Ibu': s.tahunLahirIbu || '',
    'NIK Ibu': s.nikIbu || '',
    'Jenjang': s.program || s.jenjang || '',
    'Syarat': s.syarat || '',
    'Dok Berkas': s.dokBerkas || '',
    'Kelas': s.kelas || '',
    'Foto': ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Peserta_Didik");
  XLSX.writeFile(workbook, "Data_Peserta_Didik.xlsx");
}

function importDataFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Read as 2D array

      if (jsonData.length < 1) {
        Swal.fire('Error', 'File kosong atau tidak memiliki data', 'error');
        event.target.value = '';
        return;
      }

      let headerRowIndex = -1;
      let headers = [];
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i] || [];
        const strRow = row.map(h => String(h || '').trim().toLowerCase());
        if (strRow.some(h => h.includes('nama') || h.includes('nik') || h.includes('nisn'))) {
          headerRowIndex = i;
          headers = strRow;
          break;
        }
      }

      if (headerRowIndex === -1) {
        Swal.fire('Error', 'Format file tidak dikenali. Pastikan ada baris header (Nama Lengkap, NIK, dll).', 'error');
        event.target.value = '';
        return;
      }

      const dataList = [];

      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0 || row.every(cell => !cell)) continue; // skip empty rows

        const dataObj = {};

        headers.forEach((header, index) => {
          const val = String(row[index] || '').trim();
          if (header === 'no' || header === 'no.') dataObj.id = val;
          else if (header.includes('nik') && !header.includes('ayah') && !header.includes('ibu')) dataObj.nik = val;
          else if (header.includes('nisn')) dataObj.nisn = val;
          else if (header.includes('nama') && !header.includes('ibu') && !header.includes('ayah') && !header.includes('wali')) dataObj.nama = val;
          else if (header.includes('program') || header.includes('jenjang')) dataObj.program = val;
          else if (header.includes('kelamin') || header.includes('jk')) dataObj.jk = val;
          else if (header.includes('tempat lahir')) dataObj.tempatLahir = val;
          else if (header.includes('tanggal lahir') || header.includes('tgl lahir')) dataObj.tglLahir = val;
          else if (header.includes('nama ibu')) dataObj.namaIbu = val;
          else if (header.includes('nik ibu')) dataObj.nikIbu = val;
          else if (header.includes('nama ayah')) dataObj.namaAyah = val;
          else if (header.includes('nik ayah')) dataObj.nikAyah = val;
          else if (header.includes('tanggal daftar') || header.includes('tgl daftar')) dataObj.tglDaftar = val;
          else if (header.includes('kartu keluarga') || header.includes('no kk') || header === 'kk') dataObj.noKk = val;
          else if (header.includes('urut kk')) dataObj.urutKk = val;
          else if (header.includes('kabupaten') || header.includes('kota')) dataObj.kabKota = val;
          else if (header.includes('kecamatan')) dataObj.kecamatan = val;
          else if (header.includes('desa') || header.includes('kelurahan')) dataObj.desaKelurahan = val;
          else if (header === 'tahun lahir') {
            if (index > 0 && headers[index - 1].includes('ayah')) dataObj.tahunLahirAyah = val;
            else if (index > 0 && headers[index - 1].includes('ibu')) dataObj.tahunLahirIbu = val;
          }
          else if (header.includes('syarat')) dataObj.syarat = val;
          else if (header.includes('dok berkas')) dataObj.dokBerkas = val;
          else if (header.includes('kelas')) dataObj.kelas = val;
        });

        if (dataObj.nama) {
          dataObj.createdBy = currentUser.username;
          dataList.push(dataObj);
        }
      }

      if (dataList.length === 0) {
        Swal.fire('Error', 'Tidak ada data valid yang bisa diimpor. Pastikan ada kolom "Nama Lengkap" atau "Nama".', 'error');
        event.target.value = '';
        return;
      }

      Swal.fire({
        title: 'Konfirmasi Import',
        text: `Ditemukan ${dataList.length} data untuk diimpor. Lanjutkan?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Import',
        cancelButtonText: 'Batal'
      }).then(async (result) => {
        if (result.isConfirmed) {
          showLoader(`Mengimpor ${dataList.length} data...`);
          try {
            const res = await callAPI({ action: 'importSiswaBatch', dataList: dataList });
            hideLoader();
            Swal.fire('Selesai', res.message, 'success');
            loadAllSiswa();
          } catch (err) {
            hideLoader();
            Swal.fire('Error', err.message, 'error');
          }
        }
      });

    } catch (err) {
      Swal.fire('Error', 'Gagal memproses file. Pastikan format benar: ' + err.message, 'error');
    }

    event.target.value = ''; // Reset file input
  };

  reader.readAsArrayBuffer(file);
}

// ======================= HIDDEN LOGIN MECHANISM =======================
if (landingBrandLogo) {
  landingBrandLogo.addEventListener('click', () => {
    loginClickCount++;
    if (loginClickTimer) clearTimeout(loginClickTimer);
    
    if (loginClickCount >= 5) {
      modalLogin.classList.remove('hidden');
      loginClickCount = 0;
    } else {
      loginClickTimer = setTimeout(() => {
        loginClickCount = 0;
      }, 1000); // Reset count after 1 second of inactivity
    }
  });
}

if (btnCloseLogin) {
  btnCloseLogin.addEventListener('click', () => {
    modalLogin.classList.add('hidden');
  });
}

if (loginModalOverlay) {
  loginModalOverlay.addEventListener('click', () => {
    modalLogin.classList.add('hidden');
  });
}

if (registerModalOverlay && modalRegister) {
  registerModalOverlay.addEventListener('click', () => {
    cancelEdit();
  });
}

// ======================= PENDAFTARAN CEPAT AI (GEMINI) =======================
// Penyimpanan sementara berkas yang diunggah pada sesi Pendaftaran Cepat AI
let aiUploadedFiles = {
  kk: null,
  ijazah: null,
  foto: null
};

async function handleEkstrakDataAI() {
  const nikInput = document.getElementById('ai-reg-nik');
  const fileKkInput = document.getElementById('ai-reg-file-kk');
  const fileIjazahInput = document.getElementById('ai-reg-file-ijazah');
  const fileFotoInput = document.getElementById('ai-reg-file-foto');

  const nikTarget = (nikInput ? nikInput.value : "").trim();
  const fileKk = fileKkInput && fileKkInput.files[0] ? fileKkInput.files[0] : null;
  const fileIjazah = fileIjazahInput && fileIjazahInput.files[0] ? fileIjazahInput.files[0] : null;
  const fileFoto = fileFotoInput && fileFotoInput.files[0] ? fileFotoInput.files[0] : null;

  if (!fileKk) {
    Swal.fire({
      icon: 'warning',
      title: 'Berkas KK Diperlukan',
      text: 'Silakan pilih foto / scan Kartu Keluarga (KK) terlebih dahulu untuk dianalisis oleh AI.'
    });
    return;
  }

  showLoader('Gemini AI sedang membaca dan mengekstrak data dari dokumen KK & Ijazah...');

  try {
    const kkBase64 = await toBase64(fileKk);
    const ijazahBase64 = fileIjazah ? await toBase64(fileIjazah) : "";
    const fotoBase64 = fileFoto ? await toBase64(fileFoto) : "";

    aiUploadedFiles = {
      kk: kkBase64,
      ijazah: ijazahBase64,
      foto: fotoBase64
    };

    const userApiKey = localStorage.getItem('gemini_api_key') || 'AQ.Ab8RN6IsOK3hu-S-7x1mSMT91X37w4Fur-AbgFaF0WqCdaTnPA';

    const result = await callAPI({
      action: "ekstrakDataAI",
      nikTarget: nikTarget,
      kkBase64: kkBase64,
      ijazahBase64: ijazahBase64,
      apiKey: userApiKey
    });

    hideLoader();

    if (!result || result.status !== "SUCCESS" || !result.data) {
      const errMsg = result && (result.message || result.koreksi) ? (result.message || result.koreksi) : "Gagal mengekstrak data dari dokumen.";
      Swal.fire({
        icon: 'error',
        title: 'Ekstraksi AI Gagal',
        text: errMsg
      });
      return;
    }

    const data = result.data;

    // Masukkan data hasil ekstraksi ke formulir Step 2
    const today = new Date().toISOString().split('T')[0];
    const outTglDaftar = document.getElementById('ai-out-tgl-daftar');
    if (outTglDaftar) outTglDaftar.value = today;

    const setField = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setField('ai-out-nama', data.nama || '');
    setField('ai-out-nik', data.nik || nikTarget || '');
    setField('ai-out-no-kk', data.noKk || '');
    setField('ai-out-urut-kk', data.urutKk || '');
    
    // Normalisasi Jenis Kelamin
    const elJk = document.getElementById('ai-out-jk');
    if (elJk) {
      if (data.jk && (data.jk.toLowerCase().includes('perempuan') || data.jk.toLowerCase().startsWith('p'))) {
        elJk.value = 'Perempuan';
      } else {
        elJk.value = 'Laki-laki';
      }
    }

    setField('ai-out-tempat-lahir', data.tempatLahir || '');
    setField('ai-out-tgl-lahir', data.tglLahir || '');
    setField('ai-out-ibu', data.namaIbu || '');
    setField('ai-out-nik-ibu', data.nikIbu || '');
    setField('ai-out-ayah', data.namaAyah || '');
    setField('ai-out-nik-ayah', data.nikAyah || '');
    setField('ai-out-kab-kota', data.kabKota || '');
    setField('ai-out-kecamatan', data.kecamatan || '');
    setField('ai-out-desa-kelurahan', data.desaKelurahan || '');
    setField('ai-out-nisn', data.nisn || '');
    setField('ai-out-tahun-lulus', data.tahunLulus || '');

    // Tampilkan formulir review hasil ekstraksi
    const container = document.getElementById('ai-extracted-container');
    if (container) {
      container.style.display = 'block';
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    Swal.fire({
      icon: 'success',
      title: 'Data Berhasil Diekstrak!',
      text: 'Silakan pilih Program / Jenjang dan tinjau kelengkapan data sebelum menyimpan.',
      timer: 3000,
      showConfirmButton: false
    });

  } catch (err) {
    hideLoader();
    console.error("AI Extraction Error:", err);
    Swal.fire('Error', 'Terjadi kesalahan saat memproses dokumen: ' + err.message, 'error');
  }
}

async function handleAISiswaSubmit() {
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const program = getVal('ai-out-program');
  const nama = getVal('ai-out-nama');
  const nik = getVal('ai-out-nik');

  if (!program) {
    Swal.fire('Peringatan', 'Mohon pilih Pilihan Program / Jenjang (Paket A / B / C).', 'warning');
    return;
  }

  if (!nama) {
    Swal.fire('Peringatan', 'Nama lengkap siswa tidak boleh kosong.', 'warning');
    return;
  }

  Swal.fire({
    title: 'Mendaftarkan Calon Siswa...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    const finalSiswaId = 'S' + Date.now();
    const tglDaftar = getVal('ai-out-tgl-daftar') || new Date().toISOString().split('T')[0];
    const b64Kk = aiUploadedFiles.kk;
    const b64Ijazah = aiUploadedFiles.ijazah;
    const b64Foto = aiUploadedFiles.foto;

    // Simpan berkas ke penyimpanan offline / lokal seketika
    if (b64Foto) saveFileLocal(finalSiswaId, 'foto', b64Foto);
    if (b64Ijazah) saveFileLocal(finalSiswaId, 'ijazah', b64Ijazah);
    if (b64Kk) saveFileLocal(finalSiswaId, 'kk', b64Kk);

    const newSiswa = {
      id: finalSiswaId,
      tglDaftar: tglDaftar,
      nama: nama,
      jk: getVal('ai-out-jk') || 'Laki-laki',
      nik: nik,
      nisn: getVal('ai-out-nisn'),
      noKk: getVal('ai-out-no-kk'),
      urutKk: getVal('ai-out-urut-kk'),
      kabKota: getVal('ai-out-kab-kota'),
      kecamatan: getVal('ai-out-kecamatan'),
      desaKelurahan: getVal('ai-out-desa-kelurahan'),
      kelas: program,
      tempatLahir: getVal('ai-out-tempat-lahir'),
      tglLahir: getVal('ai-out-tgl-lahir'),
      namaIbu: getVal('ai-out-ibu'),
      tahunLahirIbu: '',
      nikIbu: getVal('ai-out-nik-ibu'),
      namaAyah: getVal('ai-out-ayah'),
      tahunLahirAyah: '',
      nikAyah: getVal('ai-out-nik-ayah'),
      namaWali: '',
      program: program,
      jenjang: program,
      tahunLulus: getVal('ai-out-tahun-lulus'),
      syarat: 'Lengkap',
      dokBerkas: 'KK' + (b64Ijazah ? ', Ijazah' : ''),
      urlFoto: b64Foto || '',
      status: 'Pending',
      koreksiAI: 'Hasil ekstraksi otomatis Gemini AI',
      urlIjazah: b64Ijazah || '',
      urlKK: b64Kk || '',
      urlBayar: '',
      statusAktif: 'Aktif',
      createdBy: currentUser ? currentUser.username : 'AI Quick Reg'
    };

    // Optimistic Update ke state memori & cache lokal
    siswaDataList.push(newSiswa);
    try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) {}

    // Update UI seketika
    renderDashboardUI(siswaDataList);
    if (typeof renderSiswaTable === 'function') renderSiswaTable(siswaDataList);

    // Kirim sinkronisasi ke backend Google Sheets di latar belakang
    const payload = {
      action: "registerSiswa",
      data: {
        ...newSiswa,
        ijazahFile: b64Ijazah,
        kkFile: b64Kk,
        fotoFile: b64Foto
      }
    };

    callAPI(payload).then(res => {
      if (res) {
        const targetId = res.id || finalSiswaId;
        const idx = siswaDataList.findIndex(x => String(x.id) === String(targetId) || String(x.id) === String(finalSiswaId));
        if (idx !== -1) {
          if (res.urlIjazah) siswaDataList[idx].urlIjazah = res.urlIjazah;
          if (res.urlKK) siswaDataList[idx].urlKK = res.urlKK;
          if (res.urlFoto) siswaDataList[idx].urlFoto = res.urlFoto;
          try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) {}
        }
      }
    }).catch(err => {
      console.warn("Background sync AI registration:", err);
    });

    Swal.fire({
      icon: 'success',
      title: 'Pendaftaran Berhasil!',
      text: `Calon siswa "${nama}" berhasil didaftarkan ke program ${program}. Data sudah masuk ke daftar siswa.`,
      confirmButtonText: 'Buka Daftar Siswa'
    }).then(() => {
      resetAIRegForm();
      const tabList = document.querySelector('li[data-target="section-list"]');
      if (tabList) tabList.click();
    });

  } catch (err) {
    console.error("AI Submit Error:", err);
    Swal.fire('Error', 'Gagal mendaftarkan siswa: ' + err.message, 'error');
  }
}

function resetAIRegForm() {
  const nikInput = document.getElementById('ai-reg-nik');
  if (nikInput) nikInput.value = '';

  const fileKk = document.getElementById('ai-reg-file-kk');
  if (fileKk) fileKk.value = '';
  const prevKk = document.getElementById('ai-preview-kk');
  if (prevKk) { prevKk.innerHTML = ''; prevKk.style.display = 'none'; }

  const fileIjazah = document.getElementById('ai-reg-file-ijazah');
  if (fileIjazah) fileIjazah.value = '';
  const prevIjazah = document.getElementById('ai-preview-ijazah');
  if (prevIjazah) { prevIjazah.innerHTML = ''; prevIjazah.style.display = 'none'; }

  const fileFoto = document.getElementById('ai-reg-file-foto');
  if (fileFoto) fileFoto.value = '';
  const prevFoto = document.getElementById('ai-preview-foto');
  if (prevFoto) { prevFoto.innerHTML = ''; prevFoto.style.display = 'none'; }

  const container = document.getElementById('ai-extracted-container');
  if (container) container.style.display = 'none';

  aiUploadedFiles = { kk: null, ijazah: null, foto: null };
}

