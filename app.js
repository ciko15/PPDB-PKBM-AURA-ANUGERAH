// Konfigurasi API Endpoint (Ubah USE_LOCAL_SERVER = true jika menjalankan server Node.js lokal 'npm start')
const USE_LOCAL_SERVER = false;
const LOCAL_API_URL = "http://localhost:3001/api";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzVPoi7lg1ZW6SkD78awPwTLVB51HZQHGiV4R5hUmVD-hURswjVzVzNANX6wJGToYwT/exec";
const API_URL = USE_LOCAL_SERVER ? LOCAL_API_URL : SCRIPT_URL;

let currentUser = null;
let siswaDataList = [];
let usersDataList = [];
let currentSiswa = null;

// Penyimpanan sementara berkas yang diunggah pada sesi Pendaftaran Cepat AI
let aiUploadedFiles = {
  kk: null,
  ijazah: null,
  foto: null
};
let aiValidationResult = null;

// Elemen modal pendaftaran
const modalRegister = document.getElementById('modal-register');
const btnCloseRegister = document.getElementById('btn-close-register');
const registerModalOverlay = document.getElementById('register-modal-overlay');

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


// ======================= THEME SWITCHER (DARK / LIGHT) =======================
function getSystemPreferredTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function initTheme() {
  // Default mengikuti tema preferensi device / OS pengguna jika belum tersimpan secara manual
  const savedTheme = localStorage.getItem('app_theme');
  const activeTheme = savedTheme || getSystemPreferredTheme();
  document.documentElement.setAttribute('data-theme', activeTheme);
  updateThemeIcons(activeTheme);

  // Pasang listener jika preferensi tema device OS berubah dan user belum memilih manual
  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('app_theme')) {
          const autoTheme = e.matches ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', autoTheme);
          updateThemeIcons(autoTheme);
        }
      });
    } catch (err) { }
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || getSystemPreferredTheme();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  try {
    localStorage.setItem('app_theme', newTheme);
  } catch (e) { }
  updateThemeIcons(newTheme);
}

function updateThemeIcons(theme) {
  const isDark = theme === 'dark';
  const navBtn = document.getElementById('btn-theme-nav');
  const landingBtn = document.getElementById('btn-theme-landing');
  const sidebarBtn = document.getElementById('who-toggle-theme');
  const themeText = document.getElementById('theme-text-sidebar');

  if (landingBtn) {
    landingBtn.innerHTML = `<i data-lucide="${isDark ? 'sun' : 'moon'}" style="width: 18px; height: 18px;"></i>`;
    landingBtn.setAttribute('title', isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap');
  }
  if (navBtn) {
    navBtn.innerHTML = `<i data-lucide="${isDark ? 'sun' : 'moon'}" style="width: 18px; height: 18px;"></i>`;
    navBtn.setAttribute('title', isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap');
  }
  if (sidebarBtn) {
    sidebarBtn.innerHTML = `<i data-lucide="${isDark ? 'sun' : 'moon'}" style="width: 16px; height: 16px;"></i> <span id="theme-text-sidebar">${isDark ? 'Mode Terang' : 'Mode Gelap'}</span>`;
  }
  if (themeText && !sidebarBtn) {
    themeText.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Riwayat navigasi section untuk aksi tombol kembali (<)
const mobileSectionHistory = ['section-dashboard'];

function handleMobileBackAction() {
  // 1. Jika ada drawer detail siswa yang sedang terbuka, tutup drawer terlebih dahulu
  const drawer = document.getElementById('siswa-detail-drawer');
  if (drawer && !drawer.classList.contains('hidden')) {
    closeSiswaDetailDrawer();
    return;
  }

  // 2. Jika sheet menu lainnya sedang terbuka, tutup sheet
  const moreSheet = document.getElementById('mobile-more-sheet');
  if (moreSheet && !moreSheet.classList.contains('hidden')) {
    toggleMobileMoreMenu(false);
    return;
  }

  // 3. Jika sidebar navigation terbuka, tutup sidebar
  const sidebarNav = document.getElementById('sidebar-nav');
  if (sidebarNav && sidebarNav.classList.contains('show')) {
    sidebarNav.classList.remove('show');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
    return;
  }

  // 4. Jika ada riwayat section sebelumnya, kembali ke section sebelumnya
  if (mobileSectionHistory.length > 1) {
    mobileSectionHistory.pop(); // Hapus section saat ini
    const prevSectionId = mobileSectionHistory[mobileSectionHistory.length - 1];
    switchMobileTab(prevSectionId, null, false);
    return;
  }

  // 5. Jika berada di section-dashboard paling awal, kembali ke browser history atau konfirmasi logout
  if (window.history.length > 1) {
    window.history.back();
  } else {
    handleLogout();
  }
}
window.handleMobileBackAction = handleMobileBackAction;

// ======================= MOBILE NAVIGATION TABS (PERSIS ROSTERING TEKNIK) =======================
function switchMobileTab(targetId, btnEl, recordHistory = true) {
  // Catat ke riwayat navigasi untuk tombol kembali (<)
  if (recordHistory) {
    if (mobileSectionHistory[mobileSectionHistory.length - 1] !== targetId) {
      mobileSectionHistory.push(targetId);
    }
  }

  // Sembunyikan semua section
  contentSections.forEach(sec => sec.classList.add('hidden'));
  const targetEl = document.getElementById(targetId);
  if (targetEl) targetEl.classList.remove('hidden');

  // Update status aktif pada desktop sidebar li
  document.querySelectorAll('#main-menu li').forEach(li => {
    if (li.getAttribute('data-target') === targetId) {
      li.classList.add('active');
    } else {
      li.classList.remove('active');
    }
  });

  // Update status aktif pada mobile bottom tabs
  document.querySelectorAll('.mobile-tab-btn').forEach(btn => btn.classList.remove('on'));
  if (btnEl) {
    btnEl.classList.add('on');
  } else {
    const matchingBtn = document.querySelector(`.mobile-tab-btn[data-target="${targetId}"]`);
    if (matchingBtn) matchingBtn.classList.add('on');
  }

  try { localStorage.setItem('ppdb_last_section', targetId); } catch (e) { }

  if (targetId === 'section-dashboard') {
    loadDashboardData();
    muatLogNotifikasiDashboard();
  }
  if (targetId === 'section-list') loadAllSiswa();
  if (targetId === 'section-materi') loadBukuData();
  if (targetId === 'section-ujian') loadUjianData();
  if (targetId === 'section-users') loadAllUsers();
  if (targetId === 'section-api-keys') loadApiKeys();
  if (targetId === 'section-kegiatan') loadKegiatanData();
  if (targetId === 'section-info-tk') loadTKData();
  if (targetId === 'section-notifikasi') loadPushNotificationSection();
  if (targetId === 'section-more-menu') loadMoreMenuSection();

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    setTimeout(window.lucide.createIcons, 50);
  }
}

function loadMoreMenuSection() {
  const userNameEl = document.getElementById('menu-section-user-name');
  const userRoleEl = document.getElementById('menu-section-user-role');
  if (userNameEl && currentUser) {
    userNameEl.textContent = currentUser.nama || 'Pengguna';
  }
  if (userRoleEl && currentUser) {
    userRoleEl.textContent = `Peran: ${currentUser.role || 'Peserta'} · PKBM Aura Anugerah`;
  }

  const btnUsers = document.getElementById('more-menu-admin-users');
  const btnApi = document.getElementById('more-menu-admin-api');
  if (btnUsers) {
    if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin')) {
      btnUsers.classList.remove('hidden');
    } else {
      btnUsers.classList.add('hidden');
    }
  }
  if (btnApi) {
    if (currentUser && currentUser.role === 'Super Admin') {
      btnApi.classList.remove('hidden');
    } else {
      btnApi.classList.add('hidden');
    }
  }
}

function toggleMobileMoreMenu(forceState) {
  switchMobileTab('section-more-menu');
}
function toggleDropdownMenu(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;
  dropdown.classList.toggle('open');
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    setTimeout(window.lucide.createIcons, 20);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  setupEventListeners();
  checkLocalSession();
  initServiceWorkerAndPush();
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
});

function setupEventListeners() {
  formLogin.addEventListener('submit', handleLogin);
  if (btnLogout) btnLogout.addEventListener('click', handleLogout);
  if (btnProfile) btnProfile.addEventListener('click', showUserProfileModal);

  document.querySelectorAll('#main-menu li.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      document.querySelectorAll('#main-menu li.nav-item').forEach(li => li.classList.remove('active'));
      item.classList.add('active');

      // Pastikan parent dropdown tetap terbuka
      const parentDropdown = item.closest('.menu-dropdown');
      if (parentDropdown) {
        parentDropdown.classList.add('open');
      }

      const targetId = item.getAttribute('data-target');

      if (targetId === 'section-input') {
        resetAndOpenRegisterForm();
        return;
      }

      contentSections.forEach(sec => sec.classList.add('hidden'));
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.remove('hidden');

      // Simpan view terakhir agar saat refresh/reload tetap di tab/menu ini
      try { localStorage.setItem('ppdb_last_section', targetId); } catch (e) { }

      if (targetId === 'section-dashboard') {
        loadDashboardData();
        muatLogNotifikasiDashboard();
      }
      if (targetId === 'section-list') loadAllSiswa();
      if (targetId === 'section-materi') loadBukuData();
      if (targetId === 'section-ujian') loadUjianData();
      if (targetId === 'section-users') loadAllUsers();
      if (targetId === 'section-api-keys') loadApiKeys();
      if (targetId === 'section-kegiatan') loadKegiatanData();
      if (targetId === 'section-info-tk') loadTKData();

      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        setTimeout(window.lucide.createIcons, 50);
      }
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

  const btnCekAi = document.getElementById('btn-cek-ai');
  if (btnCekAi) btnCekAi.addEventListener('click', handleAICheck);

  const btnSetuju = document.getElementById('btn-setuju');
  if (btnSetuju) btnSetuju.addEventListener('click', () => submitValidation('Selesai'));

  const btnTolak = document.getElementById('btn-tolak');
  if (btnTolak) btnTolak.addEventListener('click', () => submitValidation('Perlu Perbaikan'));

  if (formAddUser) formAddUser.addEventListener('submit', handleAddUser);

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

  // Listener untuk Form Tambah Kunci API (Super Admin)
  const btnToggleAddKey = document.getElementById('btn-toggle-add-key');
  const btnCancelAddKey = document.getElementById('btn-cancel-add-key');
  const wrapperFormKey = document.getElementById('wrapper-form-key');
  const formAddKey = document.getElementById('form-add-key');

  if (btnToggleAddKey && wrapperFormKey) {
    btnToggleAddKey.addEventListener('click', () => {
      wrapperFormKey.classList.toggle('hidden');
      if (!wrapperFormKey.classList.contains('hidden')) {
        document.getElementById('key-email').focus();
        wrapperFormKey.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  if (btnCancelAddKey && wrapperFormKey) {
    btnCancelAddKey.addEventListener('click', () => {
      if (formAddKey) formAddKey.reset();
      wrapperFormKey.classList.add('hidden');
    });
  }

  if (formAddKey) {
    formAddKey.addEventListener('submit', handleAddApiKey);
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

// State kamera aktif
let activeCameraStream = null;
let activeCameraTargetInputId = null;

// Buka kamera (Mendukung Kamera Laptop / PC Webcam & Kamera HP)
async function openCameraCapture(targetInputId, facingMode = 'environment', title = 'Ambil Foto', fallbackCamInputId = null) {
  activeCameraTargetInputId = targetInputId;

  // Cek apakah browser mendukung WebRTC MediaDevices
  if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
    const modal = document.getElementById('modal-live-camera');
    const video = document.getElementById('camera-video-stream');
    const titleEl = document.getElementById('camera-modal-title');
    if (titleEl) {
      titleEl.innerHTML = `<i data-lucide="camera" style="width: 18px; height: 18px; color: var(--primary);"></i> ${title}`;
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      // Prioritaskan facingMode sesuai parameter, fallback ke default jika di PC tidak ada kamera belakang
      let constraints = {
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      };

      try {
        activeCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        // Fallback coba kamera apa saja yang tersedia (misal webcam laptop biasa)
        activeCameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      if (video) {
        video.srcObject = activeCameraStream;
      }
      if (modal) {
        modal.classList.remove('hidden');
      }
      return;
    } catch (err) {
      console.warn("getUserMedia tidak dapat diakses, beralih ke input kamera bawaan:", err);
    }
  }

  // Fallback untuk perangkat atau browser tanpa izin WebRTC: picu input capture kamera bawaan
  if (fallbackCamInputId) {
    const fallbackInput = document.getElementById(fallbackCamInputId);
    if (fallbackInput) {
      fallbackInput.click();
      return;
    }
  }
  Swal.fire('Info Kamera', 'Akses kamera tidak diizinkan atau tidak didukung pada browser ini. Anda dapat mengunggah berkas foto secara manual.', 'info');
}

// Tutup modal kamera dan hentikan video stream
function closeLiveCameraModal() {
  if (activeCameraStream) {
    activeCameraStream.getTracks().forEach(track => track.stop());
    activeCameraStream = null;
  }
  const video = document.getElementById('camera-video-stream');
  if (video) video.srcObject = null;
  const modal = document.getElementById('modal-live-camera');
  if (modal) modal.classList.add('hidden');
}

// Ambil jepretan foto dari stream kamera dan masukkan ke input file
function capturePhotoFromStream() {
  const video = document.getElementById('camera-video-stream');
  const canvas = document.getElementById('camera-canvas-capture');
  if (!video || !canvas || !activeCameraTargetInputId) {
    closeLiveCameraModal();
    return;
  }

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    if (!blob) {
      closeLiveCameraModal();
      return;
    }
    const fileName = `foto-kamera-${Date.now()}.jpg`;
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    const target = document.getElementById(activeCameraTargetInputId);
    if (target) {
      const dt = new DataTransfer();
      dt.items.add(file);
      target.files = dt.files;
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
    closeLiveCameraModal();
  }, 'image/jpeg', 0.9);
}

// Helper untuk menyalin file dari input kamera ke input dokumen utama
function syncCameraToInput(camInput, targetInputId) {
  if (!camInput || !camInput.files || camInput.files.length === 0) return;
  const target = document.getElementById(targetInputId);
  if (!target) return;
  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(camInput.files[0]);
    target.files = dataTransfer.files;
    target.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (err) {
    console.error("Gagal sinkronisasi kamera ke input berkas:", err);
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
    if (!result.success) {
      console.error("API response error detail:", result);
      throw new Error(result.error || (typeof result.data === 'object' && result.data && result.data.error) || "Gagal memanggil API");
    }
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

// ======================= CLIENT ROUTING & SESSION =======================
function handleClientRouting() {
  const path = window.location.pathname.toLowerCase();
  const session = localStorage.getItem('ppdb_session');

  if (session) {
    currentUser = JSON.parse(session);
    showDashboard();
    return;
  }

  // Deteksi jika aplikasi dibuka dari hasil instalasi (PWA Standalone App di HP / Desktop)
  const isInstalledApp = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');

  // Rute rahasia '/portal' (atau '/portal-pkbm') membuka Form Login
  // Jika dibuka sebagai aplikasi terinstal, otomatis langsung buka Portal Login
  const isPortal = isInstalledApp || path === '/portal' || path === '/portal/' || path.startsWith('/portal/') ||
    path === '/portal-pkbm' || path === '/portal-pkbm/' || path.startsWith('/portal-pkbm');
  if (isPortal) {
    pageLanding.classList.remove('hidden');
    pageDashboard.classList.add('hidden');
    if (modalLogin) {
      modalLogin.classList.remove('hidden');
      setTimeout(() => {
        generateCaptchaLogin();
        try {
          const remUser = localStorage.getItem('ppdb_remember_username');
          if (remUser && inputLoginUser) {
            inputLoginUser.value = remUser;
            const remCheck = document.getElementById('login-remember-me');
            if (remCheck) remCheck.checked = true;
          }
        } catch (e) { }
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }, 60);
    }
  } else {
    // Publik via web browser standar: '/' atau '/pkbm'
    pageLanding.classList.remove('hidden');
    pageDashboard.classList.add('hidden');
    if (modalLogin) modalLogin.classList.add('hidden');
  }

  // Render konten kegiatan publik dan profil PKBM di Landing Page
  renderLandingKegiatan();
  renderLandingTK();
}

// ======================= CAPTCHA LOGIN (PKBM AURA ANUGERAH) =======================
let currentCaptchaCode = '';

function generateCaptchaLogin() {
  const canvas = document.getElementById('login-captcha-canvas');
  if (!canvas) return;

  // 5 karakter acak huruf besar-kecil + angka, tanpa karakter membingungkan (0, O, 1, l, I)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let text = '';
  for (let i = 0; i < 5; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  currentCaptchaCode = text;

  const captchaInput = document.getElementById('login-captcha-input');
  if (captchaInput) captchaInput.value = '';

  canvas.width = 130;
  canvas.height = 42;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Reset & Clear
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background terang bertekstur
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Garis kisi latar lembut
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 15) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Noise Dots
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = `rgba(${Math.floor(Math.random() * 100)},${Math.floor(Math.random() * 100)},${Math.floor(Math.random() * 100)},0.25)`;
    ctx.beginPath();
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Noise Lines
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = `rgba(${Math.floor(Math.random() * 100)},${Math.floor(Math.random() * 100)},${Math.floor(Math.random() * 100)},0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.stroke();
  }

  // Render teks 5 karakter dengan warna elegan & sedikit rotasi
  const colors = ['#1e3a8a', '#15803d', '#b91c1c', '#7c3aed', '#0f766e', '#0369a1'];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const x = 16 + i * 22;
    const y = 26 + (Math.random() * 4 - 2);
    const angle = (Math.random() - 0.5) * 0.35;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.font = 'bold 22px monospace, "Courier New", sans-serif';
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.textBaseline = 'middle';
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }
}
window.generateCaptchaLogin = generateCaptchaLogin;

// Helper Password Visibility Toggle (Lucide Icons)
function togglePasswordVisibility() {
  const pwdInput = document.getElementById('login-password');
  const btnToggle = document.getElementById('btn-toggle-password');
  if (!pwdInput || !btnToggle) return;

  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    btnToggle.innerHTML = '<i data-lucide="eye-off" style="width: 18px; height: 18px;"></i>';
  } else {
    pwdInput.type = 'password';
    btnToggle.innerHTML = '<i data-lucide="eye" style="width: 18px; height: 18px;"></i>';
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

function showLoginError(msg) {
  const errorBox = document.getElementById('login-error-alert');
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
}

function clearLoginError() {
  const errorBox = document.getElementById('login-error-alert');
  if (errorBox) {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  }
}

function handleForgotPassword(e) {
  if (e) e.preventDefault();
  Swal.fire({
    title: 'Lupa Password Akun?',
    html: `
      <div style="font-size: 0.92rem; color: #475569; text-align: left; line-height: 1.6;">
        <p>Silakan hubungi bagian Administrasi / Petugas IT PKBM Aura Anugerah untuk reset password akun Anda:</p>
        <ul style="margin: 8px 0 14px 20px;">
          <li><b>Untuk Siswa:</b> Password bawaan adalah Tanggal Lahir (format DDMMYYYY).</li>
          <li><b>Untuk Petugas/Guru:</b> Hubungi Admin Sekretariat PKBM Sentani.</li>
        </ul>
        <div style="text-align: center; margin-top: 10px;">
          <a href="https://wa.me/628123456789?text=Halo%20Admin%20PKBM,%20saya%20butuh%20bantuan%20reset%20password%20akun" target="_blank" class="btn p" style="display: inline-flex; align-items: center; gap: 6px;">
            💬 Hubungi Admin via WhatsApp
          </a>
        </div>
      </div>
    `,
    confirmButtonText: 'Tutup',
    confirmButtonColor: '#2e7d32'
  });
}
window.handleForgotPassword = handleForgotPassword;

window.navigateToRoute = function (routePath) {
  try {
    window.history.pushState({}, '', routePath);
  } catch (e) { }
  handleClientRouting();
};

window.addEventListener('popstate', () => {
  handleClientRouting();
});

function checkLocalSession() {
  handleClientRouting();
}

async function handleLogin(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  clearLoginError();

  const user = (inputLoginUser ? inputLoginUser.value : "").trim();
  const pass = (inputLoginPass ? inputLoginPass.value : "").trim();
  const captchaInput = document.getElementById('login-captcha-input');
  const userCaptcha = (captchaInput ? captchaInput.value : "").trim();
  const btnSubmit = document.getElementById('btn-login');

  // 1. Validasi Sisi Klien: Username dan password wajib diisi
  if (!user || !pass) {
    showLoginError("Username dan password wajib diisi.");
    if (!user && inputLoginUser) inputLoginUser.focus();
    else if (!pass && inputLoginPass) inputLoginPass.focus();
    return;
  }

  // 2. Validasi Captcha Sisi Klien
  if (!userCaptcha || userCaptcha !== currentCaptchaCode) {
    showLoginError("Kode keamanan tidak sesuai. Silakan coba lagi.");
    if (captchaInput) {
      captchaInput.value = '';
      captchaInput.focus();
    }
    generateCaptchaLogin();
    return;
  }

  // Saat submit berhasil validasi: tombol nonaktif dan teks berubah "Memproses…" (cegah klik ganda)
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Memproses…";
  }

  showLoader("Mencoba Masuk...");

  try {
    const data = await callAPI({ action: "login", username: user, password: pass });
    if (data && data.username) {
      currentUser = data;

      // Fitur Ingat Saya
      const rememberCheckbox = document.getElementById('login-remember-me');
      if (rememberCheckbox && rememberCheckbox.checked) {
        try { localStorage.setItem('ppdb_remember_username', user); } catch (e) { }
      } else {
        try { localStorage.removeItem('ppdb_remember_username'); } catch (e) { }
      }

      localStorage.setItem('ppdb_session', JSON.stringify(data));
      showDashboard();
    }
  } catch (err) {
    showLoginError(err.message || "Gagal masuk. Periksa username dan password Anda.");
    generateCaptchaLogin();
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Masuk Aplikasi";
    }
    hideLoader();
  }
}

let syncInterval = null;
let isSyncing = false;

function handleLogout() {
  Swal.fire({
    title: 'Konfirmasi Logout',
    text: "Apakah Anda yakin ingin keluar dari aplikasi?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: 'var(--danger-color)',
    cancelButtonColor: '#64748b',
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

      // Sembunyikan halaman dashboard
      pageDashboard.classList.add('hidden');
      pageLanding.classList.remove('hidden');

      // Arahkan URL ke /portal jika belum
      if (window.location.pathname !== '/portal') {
        window.history.pushState({}, '', '/portal');
      }

      // Otomatis buka form login
      if (modalLogin) {
        modalLogin.classList.remove('hidden');
        setTimeout(generateCaptchaLogin, 60);
      }
    }
  });
}

function showDashboard() {
  pageLanding.classList.add('hidden');
  if (modalLogin) modalLogin.classList.add('hidden');
  pageDashboard.classList.remove('hidden');
  if (activeUserName) activeUserName.textContent = currentUser.nama;
  if (activeUserRole) activeUserRole.textContent = currentUser.role;
  if (activeUserAvatar) activeUserAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nama)}&background=0284c7&color=fff`;

  const whoNameEl = document.getElementById('who-user-name');
  const whoRoleEl = document.getElementById('who-user-role');
  if (whoNameEl) whoNameEl.textContent = currentUser.nama;
  if (whoRoleEl) whoRoleEl.textContent = currentUser.role;

  const menuApiKeys = document.getElementById('menu-api-keys');
  const menuInput = document.getElementById('menu-input');
  const menuAiReg = document.getElementById('menu-ai-reg');
  const menuValidasi = document.getElementById('menu-validasi');
  const menuList = document.getElementById('menu-list');
  const menuAbsensi = document.getElementById('menu-absensi');
  const menuBayar = document.getElementById('menu-bayar');
  const menuPortalSiswa = document.getElementById('menu-portal-siswa');
  const menuPengumumanSiswa = document.getElementById('menu-pengumuman-siswa');

  const menuMateri = document.getElementById('menu-materi');
  const menuUjian = document.getElementById('menu-ujian');
  const menuSiswaMateri = document.getElementById('menu-siswa-materi');
  const menuSiswaUjian = document.getElementById('menu-siswa-ujian');

  const dropSekolah = document.getElementById('dropdown-sekolah');
  const dropAkademik = document.getElementById('dropdown-akademik');
  const dropPortalSiswa = document.getElementById('dropdown-portal-siswa');
  const dropPengaturan = document.getElementById('dropdown-pengaturan');

  if (currentUser.role === 'Siswa') {
    // Sembunyikan menu petugas
    menuDashboard.classList.add('hidden');
    if (dropSekolah) dropSekolah.classList.add('hidden');
    if (dropAkademik) dropAkademik.classList.add('hidden');
    if (dropPengaturan) dropPengaturan.classList.add('hidden');

    // Tampilkan portal siswa
    if (dropPortalSiswa) dropPortalSiswa.classList.remove('hidden');
    if (menuPortalSiswa) menuPortalSiswa.classList.remove('hidden');

    renderPortalSiswaData(currentUser.dataSiswa);
    loadBukuData();
    loadUjianData();
    if (menuPortalSiswa) menuPortalSiswa.click();
    return;
  }

  // Jika Petugas (Admin, Guru, Super Admin):
  menuDashboard.classList.remove('hidden');
  if (dropSekolah) dropSekolah.classList.remove('hidden');
  if (dropAkademik) dropAkademik.classList.remove('hidden');
  if (dropPortalSiswa) dropPortalSiswa.classList.add('hidden');

  loadBukuData();
  loadUjianData();

  const mobileTabDashboard = document.querySelector('.mobile-tab-btn[data-target="section-dashboard"]');
  const mobileTabList = document.querySelector('.mobile-tab-btn[data-target="section-list"]');
  const mobileTabAiReg = document.querySelector('.mobile-tab-btn[data-target="section-ai-reg"]');
  const mobileSheetValidasi = document.querySelector('button[onclick*="section-validasi"]');
  const mobileSheetUsers = document.getElementById('mobile-sheet-btn-users');
  const mobileSheetApi = document.getElementById('mobile-sheet-btn-api');

  if (currentUser.role === 'Siswa') {
    if (mobileTabDashboard) mobileTabDashboard.style.display = 'none';
    if (mobileTabList) mobileTabList.style.display = 'none';
    if (mobileTabAiReg) mobileTabAiReg.style.display = 'none';
    if (mobileSheetValidasi) mobileSheetValidasi.style.display = 'none';
    if (mobileSheetUsers) mobileSheetUsers.style.display = 'none';
    if (mobileSheetApi) mobileSheetApi.style.display = 'none';
  } else {
    if (mobileTabDashboard) mobileTabDashboard.style.display = '';
    if (mobileTabList) mobileTabList.style.display = '';
    if (mobileTabAiReg) mobileTabAiReg.style.display = '';
    if (mobileSheetValidasi) mobileSheetValidasi.style.display = '';

    if (currentUser.role === 'Super Admin') {
      if (dropPengaturan) dropPengaturan.classList.remove('hidden');
      menuUsers.classList.remove('hidden');
      if (menuApiKeys) menuApiKeys.classList.remove('hidden');
      if (mobileSheetUsers) mobileSheetUsers.style.display = '';
      if (mobileSheetApi) mobileSheetApi.style.display = '';
    } else if (currentUser.role === 'Admin') {
      if (dropPengaturan) dropPengaturan.classList.remove('hidden');
      menuUsers.classList.remove('hidden');
      if (menuApiKeys) menuApiKeys.classList.add('hidden');
      if (mobileSheetUsers) mobileSheetUsers.style.display = '';
      if (mobileSheetApi) mobileSheetApi.style.display = 'none';
    } else {
      if (dropPengaturan) dropPengaturan.classList.add('hidden');
      menuUsers.classList.add('hidden');
      if (menuApiKeys) menuApiKeys.classList.add('hidden');
      if (mobileSheetUsers) mobileSheetUsers.style.display = 'none';
      if (mobileSheetApi) mobileSheetApi.style.display = 'none';
    }
  }

  // Muat data dari cache lokal secara instan (0 detik)
  loadCachedSiswaData();

  // Buka view terakhir yang dibuka sebelum refresh/reload
  const lastSection = localStorage.getItem('ppdb_last_section') || 'section-dashboard';
  const targetMenuItem = document.querySelector(`#main-menu li[data-target="${lastSection}"]`) || document.querySelector('#main-menu li[data-target="section-dashboard"]');
  if (targetMenuItem && !targetMenuItem.classList.contains('hidden')) {
    targetMenuItem.click();
  } else {
    document.querySelector('#main-menu li[data-target="section-dashboard"]').click();
  }

  // Jika sebelum reload pengguna sedang dalam sesi membaca modul, pulihkan langsung ke posisi terakhir
  setTimeout(() => {
    restoreActiveBelajarSessionIfAny();
  }, 400);

  // Langsung cek notifikasi lintas perangkat saat pertama kali dashboard terbuka
  if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin')) {
    setTimeout(cekNotifikasiBaruLintasPerangkat, 1500);
  }

  if (syncInterval) clearInterval(syncInterval);
  // Interval sync 15 detik agar pemberitahuan siswa belajar/ujian di perangkat lain segera masuk
  syncInterval = setInterval(backgroundSync, 15000);
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
      try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }
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

    // Auto-sync log notifikasi aktivitas belajar/ujian untuk Admin & Super Admin setiap interval sync
    if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin')) {
      cekNotifikasiBaruLintasPerangkat();
    }
  } catch (e) {
    // Abaikan error background sync secara hening
    console.debug("Background auto-sync skip:", e.message);
  } finally {
    isSyncing = false;
  }
}

// Cek notifikasi baru yang dicatat di database Google Sheets dari HP/Siswa lain
let lastKnownNotifTimestamp = localStorage.getItem('ppdb_last_notif_time') || '';

async function cekNotifikasiBaruLintasPerangkat() {
  try {
    const logs = await callAPI({ action: 'getNotificationLogs', limit: 10 });
    if (!logs || !Array.isArray(logs) || logs.length === 0) return;

    // Simpan ke log lokal dan update panel dashboard
    simpanDaftarNotifikasiOnline(logs);
    renderLogNotifikasiDashboard(logs);
    updateNotifikasiBadgeUI();

    const latest = logs[0];
    if (latest && latest.timestamp && latest.timestamp !== lastKnownNotifTimestamp) {
      if (lastKnownNotifTimestamp !== '') {
        // Ada aktivitas belajar / ujian baru dari siswa di perangkat lain!
        
        // 1. Munculkan Toast Popup mengambang di layar HP (In-App Toast Popup)
        if (typeof Swal !== 'undefined') {
          const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 6000,
            timerProgressBar: true,
            didOpen: (toast) => {
              toast.addEventListener('mouseenter', Swal.stopTimer);
              toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
          });
          Toast.fire({
            imageUrl: window.location.origin + '/icon-192.png',
            imageWidth: 42,
            imageHeight: 42,
            imageAlt: 'Logo SIGAP AURA',
            title: latest.title || 'Pemberitahuan Aktivitas Siswa',
            text: latest.body || ''
          });
        }

        // 2. Munculkan Notifikasi Banner Sistem HP (jika izin notifikasi browser telah diizinkan)
        try {
          if (Notification.permission === 'granted') {
            if (swRegistration && swRegistration.showNotification) {
              const iconFull = window.location.origin + '/icon-192.png';
              swRegistration.showNotification(latest.title || 'SIGAP AURA', {
                body: latest.body || 'Aktivitas belajar baru terdeteksi.',
                icon: iconFull,
                badge: iconFull,
                tag: latest.tag || 'notif-' + Date.now(),
                data: { url: latest.url || '/portal' },
                vibrate: [100, 50, 100]
              });
            } else if (typeof Notification !== 'undefined') {
              new Notification(latest.title || 'SIGAP AURA', {
                body: latest.body || '',
                icon: window.location.origin + '/icon-192.png'
              });
            }
          }
        } catch (notifErr) {
          console.debug('System notification skipped:', notifErr.message);
        }
      }
      lastKnownNotifTimestamp = latest.timestamp;
      try { localStorage.setItem('ppdb_last_notif_time', lastKnownNotifTimestamp); } catch (e) { }
    }
  } catch (err) { }
}

function simpanDaftarNotifikasiOnline(onlineLogs) {
  try {
    localStorage.setItem('ppdb_notif_logs', JSON.stringify(onlineLogs));
  } catch (e) { }
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
    } catch (e) { }

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

    try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }

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
            try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }
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
    try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }
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

    const userApiKey = localStorage.getItem('gemini_api_key') || '';

    const result = await callAPI({
      action: "runAICheck",
      dataSiswa: enrichedDataSiswa,
      jenisDokumen: targetDoc,
      apiKey: userApiKey
    });
    hideLoader();

    aiResultBox.classList.remove('hidden');
    const normStatus = String(result.status || '').toUpperCase();
    if (normStatus === "TIDAK_COCOK" || normStatus === "TIDAK SESUAI") {
      aiResultBox.className = "ai-result-box error";
      aiStatusTitle.textContent = "⚠️ Ditemukan Ketidaksesuaian";
      aiKoreksiText.innerHTML = result.koreksi ? result.koreksi.replace(/\n/g, '<br>') : "Ada ketidaksesuaian pada dokumen.";

      // Simpan langsung ke state currentSiswa & cache lokal
      currentSiswa.status = "Tidak Sesuai";
      currentSiswa.koreksiAI = result.koreksi || "";
      const idx = siswaDataList.findIndex(x => String(x.id) === String(currentSiswa.id));
      if (idx !== -1) {
        siswaDataList[idx].status = "Tidak Sesuai";
        siswaDataList[idx].koreksiAI = result.koreksi || "";
        try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }
      }
      // Otomatis sinkronkan status ke backend
      callAPI({
        action: "updateStatus",
        idSiswa: currentSiswa.id,
        status: "Tidak Sesuai",
        koreksiAI: result.koreksi || ""
      }).catch(err => console.warn("Sync updateStatus:", err));

    } else if (normStatus === "COCOK" || normStatus === "SESUAI") {
      aiResultBox.className = "ai-result-box";
      aiStatusTitle.textContent = "✅ Data Cocok (Sesuai)";
      aiKoreksiText.textContent = result.koreksi || "AI mengonfirmasi seluruh data identitas sesuai dengan dokumen fisik.";

      // Simpan langsung ke state currentSiswa & cache lokal
      currentSiswa.status = "Sesuai";
      currentSiswa.koreksiAI = result.koreksi || "Semua data sesuai dokumen.";
      const idx = siswaDataList.findIndex(x => String(x.id) === String(currentSiswa.id));
      if (idx !== -1) {
        siswaDataList[idx].status = "Sesuai";
        siswaDataList[idx].koreksiAI = result.koreksi || "Semua data sesuai dokumen.";
        try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }
      }
      // Otomatis sinkronkan status ke backend
      callAPI({
        action: "updateStatus",
        idSiswa: currentSiswa.id,
        status: "Sesuai",
        koreksiAI: result.koreksi || "Semua data sesuai dokumen."
      }).catch(err => console.warn("Sync updateStatus:", err));

    } else {
      aiResultBox.className = "ai-result-box error";
      aiStatusTitle.textContent = "❌ Error API";
      aiKoreksiText.textContent = result.koreksi || result.message || "Gagal melakukan pengecekan.";
    }
  } catch (err) {
    hideLoader(); Swal.fire('Error', err.message, 'error');
  }
}

async function submitValidation(status) {
  if (!currentSiswa) return;
  // Normalisasi status ke format standar (Sesuai / Tidak Sesuai)
  const normalizedStatus = (status === 'Selesai' || status === 'Valid' || status === 'Sesuai') ? 'Sesuai' : 'Tidak Sesuai';
  showLoader(`Menyimpan status: ${normalizedStatus}...`);
  try {
    const response = await callAPI({
      action: "updateStatus",
      idSiswa: currentSiswa.id,
      status: normalizedStatus,
      koreksiAI: aiKoreksiText.innerText || aiKoreksiText.textContent || ""
    });

    currentSiswa.status = normalizedStatus;
    currentSiswa.koreksiAI = aiKoreksiText.innerText || aiKoreksiText.textContent || "";
    const idx = siswaDataList.findIndex(x => String(x.id) === String(currentSiswa.id));
    if (idx !== -1) {
      siswaDataList[idx].status = normalizedStatus;
      siswaDataList[idx].koreksiAI = currentSiswa.koreksiAI;
      try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }
    }

    hideLoader();
    Swal.fire('Berhasil', response.message || 'Status berhasil disimpan!', 'success');
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
    try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }
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

// State Pagination & Filter Siswa ala Dev-Smart
let currentSiswaPage = 1;
let siswaPageSize = 10;
let currentFilteredSiswaList = [];

function changeSiswaPageSize(size) {
  siswaPageSize = size === 'all' ? 'all' : parseInt(size, 10);
  currentSiswaPage = 1;
  const filterLimit = document.getElementById('filter-siswa-limit');
  const selectPagSize = document.getElementById('select-pagination-size');
  if (filterLimit) filterLimit.value = String(size);
  if (selectPagSize) selectPagSize.value = String(size);
  filterSiswaTable();
}

function goToSiswaPage(pageNum) {
  currentSiswaPage = pageNum;
  renderSiswaPage();
}

function filterSiswaTable() {
  const query = (document.getElementById('search-siswa')?.value || '').toLowerCase().trim();
  const programFilter = document.getElementById('filter-program-siswa')?.value || '';
  const statusFilter = document.getElementById('filter-status-siswa')?.value || '';
  const aiFilter = document.getElementById('filter-ai-siswa')?.value || '';

  currentFilteredSiswaList = siswaDataList.filter(s => {
    const matchQuery = !query ||
      (s.nama && String(s.nama).toLowerCase().includes(query)) ||
      (s.nik && String(s.nik).toLowerCase().includes(query)) ||
      (s.nisn && String(s.nisn).toLowerCase().includes(query)) ||
      (s.program && String(s.program).toLowerCase().includes(query)) ||
      (s.createdBy && String(s.createdBy).toLowerCase().includes(query));

    const matchProgram = !programFilter || (s.program && s.program.includes(programFilter));
    const matchStatus = !statusFilter || (statusFilter === 'Aktif' ? s.statusAktif === 'Aktif' : s.statusAktif !== 'Aktif');

    let matchAi = true;
    if (aiFilter) {
      const rawAiStatus = String(s.status || '').toLowerCase();
      const hasCorrection = s.koreksiAI && s.koreksiAI.trim() !== '';
      if (aiFilter === 'sesuai') {
        matchAi = rawAiStatus === 'sesuai' || rawAiStatus === 'cocok' || (rawAiStatus === 'selesai' && !hasCorrection);
      } else if (aiFilter === 'tidak sesuai') {
        matchAi = rawAiStatus === 'tidak sesuai' || rawAiStatus === 'tidak_cocok' || rawAiStatus === 'perlu perbaikan' || (hasCorrection && !s.koreksiAI.includes('cocok'));
      } else if (aiFilter === 'pending') {
        matchAi = rawAiStatus === 'pending';
      } else if (aiFilter === 'belum') {
        matchAi = !rawAiStatus || rawAiStatus === 'belum dicek' || rawAiStatus === '';
      }
    }

    return matchQuery && matchProgram && matchStatus && matchAi;
  });

  currentSiswaPage = 1;
  renderSiswaPage();
}

function renderSiswaPage() {
  const total = currentFilteredSiswaList.length;
  let pageData = currentFilteredSiswaList;
  let totalPages = 1;

  if (siswaPageSize !== 'all') {
    totalPages = Math.max(1, Math.ceil(total / siswaPageSize));
    if (currentSiswaPage > totalPages) currentSiswaPage = totalPages;
    const startIdx = (currentSiswaPage - 1) * siswaPageSize;
    const endIdx = startIdx + siswaPageSize;
    pageData = currentFilteredSiswaList.slice(startIdx, endIdx);

    const startShow = total === 0 ? 0 : startIdx + 1;
    const endShow = Math.min(endIdx, total);
    const pageInfo = document.getElementById('pagination-info');
    if (pageInfo) {
      pageInfo.textContent = `Menampilkan ${startShow} - ${endShow} dari ${total} peserta didik`;
    }
  } else {
    const pageInfo = document.getElementById('pagination-info');
    if (pageInfo) {
      pageInfo.textContent = `Menampilkan semua (${total}) peserta didik`;
    }
  }

  renderSiswaTableRows(pageData, siswaPageSize === 'all' ? 0 : (currentSiswaPage - 1) * siswaPageSize);
  renderSiswaPaginationControls(totalPages);
}

function renderSiswaPaginationControls(totalPages) {
  const controls = document.getElementById('siswa-pagination-controls');
  if (!controls) return;

  if (siswaPageSize === 'all' || totalPages <= 1) {
    controls.innerHTML = '';
    return;
  }

  let html = '';
  // Prev button
  html += `<button type="button" ${currentSiswaPage === 1 ? 'disabled' : ''} onclick="goToSiswaPage(${currentSiswaPage - 1})" title="Halaman Sebelumnya">
    <i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i>
  </button>`;

  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentSiswaPage - 2 && i <= currentSiswaPage + 2)) {
      html += `<button type="button" class="${i === currentSiswaPage ? 'active' : ''}" onclick="goToSiswaPage(${i})">${i}</button>`;
    } else if (i === currentSiswaPage - 3 || i === currentSiswaPage + 3) {
      html += `<span class="dots">...</span>`;
    }
  }

  // Next button
  html += `<button type="button" ${currentSiswaPage === totalPages ? 'disabled' : ''} onclick="goToSiswaPage(${currentSiswaPage + 1})" title="Halaman Selanjutnya">
    <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
  </button>`;

  controls.innerHTML = html;
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function renderSiswaTable(data) {
  currentFilteredSiswaList = data || siswaDataList;
  currentSiswaPage = 1;
  renderSiswaPage();
}

function renderSiswaTableRows(data, offset = 0) {
  tableSiswaBody.innerHTML = '';

  if (data.length === 0) {
    tableSiswaBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 32px; color: var(--text-muted);">Belum ada peserta didik yang cocok</td></tr>';
    return;
  }

  data.forEach((s, idx) => {
    const tr = document.createElement('tr');
    const isAktif = s.statusAktif === 'Aktif';
    const isEditable = currentUser ? (currentUser.role === 'Admin' || currentUser.role === 'Super Admin' || currentUser.role === 'Guru' || currentUser.username === s.createdBy) : true;

    // Status Pemeriksaan AI
    let aiStatusBadge = '<span style="color: #94a3b8; font-size: 0.8rem;">Belum Dicek</span>';
    const rawAiStatus = String(s.status || '').toLowerCase();
    const hasCorrection = s.koreksiAI && s.koreksiAI.trim() !== '';

    if (rawAiStatus === 'sesuai' || rawAiStatus === 'cocok' || (rawAiStatus === 'selesai' && !hasCorrection)) {
      aiStatusBadge = `<span onclick="event.stopPropagation(); showAICheckPopup('${s.id}')" style="background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; border: 1px solid #bbf7d0;" title="Klik untuk lihat detail pemeriksaan">✅ Sesuai</span>`;
    } else if (rawAiStatus === 'tidak sesuai' || rawAiStatus === 'tidak_cocok' || rawAiStatus === 'perlu perbaikan' || (hasCorrection && !s.koreksiAI.includes('cocok'))) {
      aiStatusBadge = `<span onclick="event.stopPropagation(); showAICheckPopup('${s.id}')" style="background: #fee2e2; color: #b91c1c; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; border: 1px solid #fecaca; box-shadow: 0 1px 2px rgba(220,38,38,0.1);" title="Klik untuk baca poin ketidaksesuaian">⚠️ Tidak Sesuai</span>`;
    } else if (rawAiStatus === 'pending') {
      aiStatusBadge = `<span style="background: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600;">⏳ Pending</span>`;
    }

    // Tag status persis Rostering Teknik
    const statusTag = isAktif
      ? `<span class="tag pusat" style="cursor: pointer;" onclick="toggleStatusSiswa('${s.id}', 'Tidak Aktif')" title="Klik untuk ubah status">Aktif</span>`
      : `<span class="tag ess" style="cursor: pointer;" onclick="toggleStatusSiswa('${s.id}', 'Aktif')" title="Klik untuk ubah status">Tidak Aktif</span>`;

    tr.className = "hoverable-row";
    tr.style.cursor = 'pointer';
    tr.onclick = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.type === 'checkbox') return;
      showSiswaDetail(s.id);
    };

    tr.innerHTML = `
      <td style="text-align: center;" onclick="event.stopPropagation();">
        <input type="checkbox" class="siswa-select-cb" value="${s.id}" onchange="updateSelectedSiswaCount()">
      </td>
      <td>${offset + idx + 1}</td>
      <td><b>${s.nama}</b></td>
      <td>${s.program || '-'}</td>
      <td>${aiStatusBadge}</td>
      <td style="font-size: 12px; color: var(--text-muted);">${s.createdBy || 'N/A'}</td>
      <td>${statusTag}</td>
      <td style="vertical-align: middle;" onclick="event.stopPropagation();">
        <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
          <button class="btn btn-icon" onclick="runSingleRowAICheck('${s.id}')" title="Periksa AI">
            <i data-lucide="wand-2" style="width: 15px; height: 15px; color: var(--accent);"></i>
          </button>
          <button class="btn btn-icon" onclick="loadSiswaForEdit('${s.id}')" title="Edit Data">
            <i data-lucide="pencil" style="width: 15px; height: 15px;"></i>
          </button>
          ${currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin') ? `
          <button class="btn btn-icon btn-danger-text" onclick="deleteSiswaData('${s.id}')" title="Hapus Siswa">
            <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
          </button>` : ''}
        </div>
      </td>
    `;
    tableSiswaBody.appendChild(tr);
  });
  updateSelectedSiswaCount();
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// ======================= BATCH & SINGLE ROW AI VERIFICATION =======================
function showAICheckPopup(siswaId) {
  const s = siswaDataList.find(x => String(x.id) === String(siswaId));
  if (!s) return;

  const isCocok = s.status === 'Sesuai' || s.status === 'Cocok';
  const title = isCocok ? '✅ Hasil Pemeriksaan AI: Sesuai' : '⚠️ Hasil Pemeriksaan AI: Perlu Tindak Lanjut';
  const statusColor = isCocok ? '#15803d' : '#b91c1c';
  const statusBg = isCocok ? '#dcfce7' : '#fee2e2';

  const rawKoreksi = (s.koreksiAI && s.koreksiAI.trim() !== '') ? s.koreksiAI : (isCocok ? 'Semua data cocok dengan dokumen fisik.' : 'Terdapat ketidaksesuaian data pada dokumen.');

  // Format poin-poin agar terbaca sangat jelas
  let formattedContent = rawKoreksi;
  formattedContent = formattedContent
    .replace(/([0-9]+\.\s)/g, '<br><strong style="color: #0f172a;">$1</strong>')
    .replace(/^<br>/, '');

  // Ekstrak penyesuaian otomatis dari teks koreksiAI jika s.suggestedFix belum ada di memory
  if (!s.suggestedFix && rawKoreksi) {
    const extractedFix = {};
    // Cek Tanggal Lahir (contoh: "...tercantum '22-09-2003'..." atau "tertulis 22-09-2003 (2003-09-22)")
    const tglIsoMatch = rawKoreksi.match(/(\d{4}-\d{2}-\d{2})/);
    const tglDmyMatch = rawKoreksi.match(/['"]?(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})['"]?/);
    const tglTextMatch = rawKoreksi.match(/tertulis\s+['"]?(\d{1,2}\s+[A-Za-z]+\s+\d{4})['"]?/i);

    if (tglDmyMatch) {
      const d = tglDmyMatch[1].padStart(2, '0');
      const m = tglDmyMatch[2].padStart(2, '0');
      const y = tglDmyMatch[3];
      extractedFix.tglLahir = `${y}-${m}-${d}`;
    } else if (tglIsoMatch) {
      extractedFix.tglLahir = tglIsoMatch[1];
    } else if (tglTextMatch) {
      extractedFix.tglLahir = tglTextMatch[1];
    }

    // Cek Nama jika ada "...tertulis 'NAMA' pada dokumen..."
    const namaMatch = rawKoreksi.match(/Nama(?:\s+Lengkap)?[^.]*?(?:tertulis|tertera|tercantum)\s+['"]([^'"]+)['"]/i);
    if (namaMatch && namaMatch[1]) {
      extractedFix.nama = namaMatch[1];
    }
    // Cek Nama Ibu
    const ibuMatch = rawKoreksi.match(/Nama\s+Ibu(?:\s+Kandung)?[^.]*?(?:tertulis|tertera|tercantum)\s+['"]([^'"]+)['"]/i);
    if (ibuMatch && ibuMatch[1]) {
      extractedFix.namaIbu = ibuMatch[1];
    }
    // Cek Tempat Lahir
    const tempatMatch = rawKoreksi.match(/Tempat\s+Lahir[^.]*?(?:tertulis|tertera|tercantum)\s+['"]([^'"]+)['"]/i);
    if (tempatMatch && tempatMatch[1]) {
      extractedFix.tempatLahir = tempatMatch[1];
    }
    // Cek NIK
    const nikMatch = rawKoreksi.match(/NIK[^.]*?(?:tertulis|tertera|tercantum)\s+['"]?(\d{16})['"]?/i);
    if (nikMatch && nikMatch[1]) {
      extractedFix.nik = nikMatch[1];
    }

    if (Object.keys(extractedFix).length > 0) {
      s.suggestedFix = extractedFix;
    }
  }

  const hasFix = !isCocok && s.suggestedFix && Object.values(s.suggestedFix).some(v => v !== null && v !== undefined && String(v).trim() !== '');
  const hasRekomendasi = !isCocok && (s.rekomendasiResmi || (s.tipeMasalah === 'REKOMENDASI_RESMI') || /beda nama|instansi terkait|surat keterangan/i.test(rawKoreksi));

  let fixPreviewHtml = '';
  if (hasFix) {
    const fixes = s.suggestedFix;
    let listItems = [];
    if (fixes.nama) listItems.push(`<li><b>Nama:</b> <span style="color:#dc2626; text-decoration:line-through;">${s.nama || '-'}</span> ➔ <span style="color:#16a34a; font-weight:700;">${fixes.nama}</span></li>`);
    if (fixes.nik && fixes.nik !== s.nik) listItems.push(`<li><b>NIK:</b> <span style="color:#dc2626; text-decoration:line-through;">${s.nik || '-'}</span> ➔ <span style="color:#16a34a; font-weight:700;">${fixes.nik}</span></li>`);
    if (fixes.tempatLahir && fixes.tempatLahir !== s.tempatLahir) listItems.push(`<li><b>Tempat Lahir:</b> <span style="color:#dc2626; text-decoration:line-through;">${s.tempatLahir || '-'}</span> ➔ <span style="color:#16a34a; font-weight:700;">${fixes.tempatLahir}</span></li>`);
    if (fixes.tglLahir) listItems.push(`<li><b>Tgl Lahir:</b> <span style="color:#dc2626; text-decoration:line-through;">${s.tglLahir ? String(s.tglLahir).split('T')[0] : '-'}</span> ➔ <span style="color:#16a34a; font-weight:700;">${fixes.tglLahir}</span></li>`);
    if (fixes.namaIbu && fixes.namaIbu !== s.namaIbu) listItems.push(`<li><b>Nama Ibu:</b> <span style="color:#dc2626; text-decoration:line-through;">${s.namaIbu || '-'}</span> ➔ <span style="color:#16a34a; font-weight:700;">${fixes.namaIbu}</span></li>`);

    if (listItems.length > 0) {
      fixPreviewHtml = `
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; margin-top: 12px; text-align: left;">
          <div style="font-weight: 700; color: #1e40af; font-size: 0.88rem; display: flex; align-items: center; gap: 6px;">
            <span>⚡ Penyesuaian Nilai dari Dokumen Fisik:</span>
          </div>
          <ul style="margin: 6px 0 0 16px; padding: 0; font-size: 0.85rem; color: #1e293b;">
            ${listItems.join('')}
          </ul>
          <div style="font-size: 0.78rem; color: #64748b; margin-top: 6px;">
            *Klik tombol <b>"⚡ Terapkan Koreksi AI"</b> di bawah untuk langsung memperbarui data ke dokumen fisik.
          </div>
        </div>
      `;
    }
  }

  let rekomendasiHtml = '';
  if (hasRekomendasi) {
    const textRek = s.rekomendasiResmi || 'Terdapat perbedaan data identitas resmi (misal antara KK dan Ijazah). Disarankan siswa/wali melampirkan Surat Keterangan Beda Nama dari Kelurahan/Disdukcapil atau Sekolah Asal.';
    rekomendasiHtml = `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-top: 12px; text-align: left;">
        <div style="font-weight: 700; color: #92400e; font-size: 0.88rem; display: flex; align-items: center; gap: 6px;">
          <span>🏛️ Rekomendasi Resmi Pihak Terkait:</span>
        </div>
        <div style="font-size: 0.85rem; color: #78350f; margin-top: 4px; line-height: 1.5;">
          ${textRek}
        </div>
      </div>
    `;
  }

  Swal.fire({
    title: `<span style="font-size: 1.2rem; color: ${statusColor}; font-weight: 700;">${title}</span>`,
    html: `
      <div style="text-align: left; font-size: 0.92rem; line-height: 1.6; color: #1e293b; margin-top: 10px;">
        <div style="background: #f1f5f9; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; border: 1px solid #cbd5e1;">
          <div style="font-size: 0.82rem; color: #64748b; font-weight: 600;">CALON PESERTA DIDIK:</div>
          <div style="font-size: 1.05rem; font-weight: 700; color: #0f172a;">${s.nama || '-'}</div>
          <div style="font-size: 0.85rem; color: #475569; margin-top: 2px;">
            NIK: <b>${s.nik || '-'}</b> | Program: <b>${s.program || '-'}</b>
          </div>
        </div>

        <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span>${isCocok ? '📋 Bukti Otentikasi & Verifikasi (Evidence Audit):' : '⚠️ Rincian Temuan AI:'}</span>
          ${isCocok ? '<span style="font-size: 0.75rem; background: #bbf7d0; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Terverifikasi Sah</span>' : '<span style="font-size: 0.75rem; background: #fecaca; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Perlu Penyesuaian</span>'}
        </div>
        <div style="background: ${statusBg}; border: 1px solid ${isCocok ? '#86efac' : '#fca5a5'}; border-radius: 8px; padding: 14px; font-size: 0.9rem; line-height: 1.65; max-height: 250px; overflow-y: auto;">
          ${formattedContent}
        </div>

        ${fixPreviewHtml}
        ${rekomendasiHtml}
      </div>
    `,
    showCloseButton: true,
    showDenyButton: hasFix,
    showCancelButton: true,
    denyButtonText: '⚡ Terapkan Koreksi AI',
    denyButtonColor: '#10b981',
    confirmButtonText: '✏️ Buka & Edit Siswa',
    cancelButtonText: 'Tutup',
    confirmButtonColor: '#0284c7',
    width: '620px'
  }).then((res) => {
    if (res.isDenied) {
      applyAISuggestedFix(s.id);
    } else if (res.isConfirmed) {
      loadSiswaForEdit(s.id);
    }
  });
}

async function applyAISuggestedFix(siswaId) {
  const s = siswaDataList.find(x => String(x.id) === String(siswaId));
  if (!s || !s.suggestedFix) return;

  const fixes = s.suggestedFix;
  const oldNama = s.nama;

  showLoader(`Menerapkan koreksi data otomatis untuk ${s.nama}...`);

  try {
    if (fixes.nama) s.nama = fixes.nama;
    if (fixes.nik) s.nik = fixes.nik;
    if (fixes.tempatLahir) s.tempatLahir = fixes.tempatLahir;
    if (fixes.tglLahir) s.tglLahir = fixes.tglLahir;
    if (fixes.namaIbu) s.namaIbu = fixes.namaIbu;

    // Status otomatis berubah jadi Sesuai karena sudah disinkronkan dengan dokumen
    s.status = 'Sesuai';
    s.koreksiAI = `1. Data berhasil disesuaikan dengan dokumen fisik resmi.\n2. Verifikasi identitas: Nama, NIK, Tempat/Tgl Lahir, dan Ibu Kandung telah sinkron.`;
    delete s.suggestedFix;

    // Simpan ke local cache
    try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }

    // Simpan update ke backend Spreadsheet
    await callAPI({
      action: "updateSiswa",
      data: {
        id: s.id,
        nama: s.nama,
        nik: s.nik,
        tempatLahir: s.tempatLahir,
        tglLahir: s.tglLahir,
        namaIbu: s.namaIbu
      }
    });

    await callAPI({
      action: "updateStatus",
      idSiswa: s.id,
      status: 'Sesuai',
      koreksiAI: s.koreksiAI
    });

    hideLoader();
    renderSiswaTable(siswaDataList);

    Swal.fire({
      icon: 'success',
      title: 'Koreksi Berhasil Diterapkan!',
      html: `Data calon siswa <b>${s.nama}</b> berhasil diperbarui sesuai dokumen fisik dan status otomatis berubah menjadi <b>✅ Sesuai</b>.`,
      confirmButtonColor: '#10b981'
    });

  } catch (err) {
    hideLoader();
    Swal.fire('Error', 'Gagal menerapkan koreksi otomatis: ' + err.message, 'error');
  }
}

function toggleSelectAllSiswa(checked) {
  document.querySelectorAll('.siswa-select-cb').forEach(cb => {
    cb.checked = checked;
  });
  updateSelectedSiswaCount();
}

function updateSelectedSiswaCount() {
  const selected = document.querySelectorAll('.siswa-select-cb:checked');
  const btnBatch = document.getElementById('btn-batch-ai');
  const checkAll = document.getElementById('check-all-siswa');
  const allCbs = document.querySelectorAll('.siswa-select-cb');

  if (checkAll && allCbs.length > 0) {
    checkAll.checked = selected.length === allCbs.length;
  }

  if (btnBatch) {
    if (selected.length > 0) {
      btnBatch.innerHTML = `🤖 Periksa AI (${selected.length} Siswa Terpilih)`;
      btnBatch.style.display = 'inline-flex';
    } else {
      btnBatch.innerHTML = `🤖 Periksa AI (Batch Terpilih)`;
    }
  }
}

// Helper mengecek apakah siswa sudah pernah diperiksa AI sebelumnya
function isSiswaAlreadyChecked(s) {
  if (!s) return false;
  const rawStatus = String(s.status || '').toLowerCase().trim();
  const hasHistory = (s.koreksiAI && s.koreksiAI.trim() !== '' && !s.koreksiAI.includes('Menunggu'));
  const isPending = (rawStatus === 'pending' || rawStatus === '' || rawStatus === 'belum dicek');
  return (!isPending || hasHistory) && (rawStatus === 'sesuai' || rawStatus === 'cocok' || rawStatus === 'tidak sesuai' || rawStatus === 'tidak_cocok' || rawStatus === 'perlu perbaikan' || hasHistory);
}

async function runSingleRowAICheck(siswaId) {
  const s = siswaDataList.find(x => String(x.id) === String(siswaId));
  if (!s) return;

  // Jika sudah pernah dicek sebelumnya, minta konfirmasi 1 per 1 dan tampilkan riwayat hasil pengecekannya
  if (isSiswaAlreadyChecked(s)) {
    const isCocok = s.status === 'Sesuai' || s.status === 'Cocok';
    const statusText = isCocok ? '✅ Sesuai / Cocok' : '⚠️ Tidak Sesuai / Perlu Perbaikan';
    const statusColor = isCocok ? '#15803d' : '#b91c1c';
    const statusBg = isCocok ? '#dcfce7' : '#fee2e2';
    const prevResult = s.koreksiAI ? s.koreksiAI : (isCocok ? 'Semua data cocok dengan dokumen fisik.' : 'Ada catatan ketidaksesuaian.');

    const recheckConfirm = await Swal.fire({
      title: 'Periksa Ulang Dokumen AI?',
      html: `
        <div style="text-align: left; font-size: 0.9rem; line-height: 1.5; color: #1e293b;">
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px;">
            <div>Calon Siswa: <b>${s.nama}</b></div>
            <div style="font-size: 0.8rem; color: #64748b;">NIK: ${s.nik || '-'} | Program: ${s.program || '-'}</div>
          </div>

          <div style="margin-bottom: 6px; font-weight: 600; color: #475569;">
            ℹ️ Siswa ini <b>sudah pernah diperiksa sebelumnya</b>:
          </div>

          <div style="background: ${statusBg}; border: 1px solid ${isCocok ? '#86efac' : '#fca5a5'}; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px;">
            <div style="font-weight: 700; color: ${statusColor}; margin-bottom: 4px;">Status Saat Ini: ${statusText}</div>
            <div style="font-size: 0.85rem; color: #334155; max-height: 140px; overflow-y: auto; white-space: pre-line;">
              ${prevResult}
            </div>
          </div>

          <p style="margin: 0; font-size: 0.85rem; color: #64748b;">
            Apakah Anda yakin ingin menjalankan pemindaian AI ulang untuk berkas siswa ini?
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '🔄 Ya, Periksa Ulang Sekarang',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#0284c7'
    });

    if (!recheckConfirm.isConfirmed) return;
  }

  const urlIjazah = (s.urlIjazah && (s.urlIjazah.startsWith('http') || s.urlIjazah.startsWith('data:'))) ? s.urlIjazah : (getFileLocal(s.id, 'ijazah') || "");
  const urlKK = (s.urlKK && (s.urlKK.startsWith('http') || s.urlKK.startsWith('data:'))) ? s.urlKK : (getFileLocal(s.id, 'kk') || "");

  if (!urlKK && !urlIjazah) {
    Swal.fire({
      icon: 'warning',
      title: 'Berkas Tidak Ditemukan',
      text: `Siswa "${s.nama}" belum memiliki unggahan berkas KK atau Ijazah untuk diperiksa oleh AI.`
    });
    return;
  }

  const targetDoc = urlKK ? 'kk' : 'ijazah';
  showLoader(`Gemini AI sedang memeriksa berkas ${targetDoc.toUpperCase()} untuk ${s.nama}...`);

  try {
    const userApiKey = localStorage.getItem('gemini_api_key') || '';
    const enrichedDataSiswa = {
      ...s,
      urlIjazah: urlIjazah,
      urlKK: urlKK,
      urlFoto: (s.urlFoto && (s.urlFoto.startsWith('http') || s.urlFoto.startsWith('data:'))) ? s.urlFoto : (getFileLocal(s.id, 'foto') || "")
    };

    const result = await callAPI({
      action: "runAICheck",
      dataSiswa: enrichedDataSiswa,
      jenisDokumen: targetDoc,
      apiKey: userApiKey
    });

    hideLoader();

    const normStatus = String(result.status || '').toUpperCase();
    const finalStatus = (normStatus === 'COCOK' || normStatus === 'SESUAI') ? 'Sesuai' : 'Tidak Sesuai';
    const finalKoreksi = result.koreksi || (finalStatus === 'Sesuai' ? 'Semua data sesuai dokumen.' : 'Ada ketidaksesuaian data.');

    // Simpan ke state lokal
    s.status = finalStatus;
    s.koreksiAI = finalKoreksi;
    s.tipeMasalah = result.tipeMasalah || null;
    s.rekomendasiResmi = result.rekomendasiResmi || null;
    s.suggestedFix = result.suggestedFix || null;
    try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }

    // Simpan ke backend
    callAPI({
      action: "updateStatus",
      idSiswa: s.id,
      status: finalStatus,
      koreksiAI: finalKoreksi
    }).catch(err => console.warn("Sync updateStatus:", err));

    renderSiswaTable(siswaDataList);

    // Tampilkan popup terperinci lengkap dengan opsi Terapkan Koreksi / Rekomendasi
    showAICheckPopup(s.id);

  } catch (err) {
    hideLoader();
    Swal.fire('Error', 'Pemeriksaan AI gagal: ' + err.message, 'error');
  }
}

async function runBatchAICheck() {
  const selectedCbs = Array.from(document.querySelectorAll('.siswa-select-cb:checked'));

  if (selectedCbs.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'Pilih Siswa Terlebih Dahulu',
      text: 'Silakan centang satu atau beberapa siswa pada tabel untuk melakukan pemeriksaan AI secara bersamaan.'
    });
    return;
  }

  // Pisahkan antara siswa yang masih PENDING dan yang SUDAH PERNAH DICEK
  const selectedSiswaList = selectedCbs.map(cb => siswaDataList.find(x => String(x.id) === String(cb.value))).filter(Boolean);
  const pendingSiswaList = selectedSiswaList.filter(s => !isSiswaAlreadyChecked(s));
  const alreadyCheckedList = selectedSiswaList.filter(s => isSiswaAlreadyChecked(s));

  let targetListToProcess = [];

  if (alreadyCheckedList.length > 0) {
    // Ada siswa yang sudah pernah diperiksa sebelumnya
    const htmlInfo = `
      <div style="text-align: left; font-size: 0.9rem; line-height: 1.5; color: #1e293b;">
        <p style="margin-bottom: 8px;">Dari <b>${selectedSiswaList.length}</b> siswa terpilih:</p>
        <ul style="margin: 0 0 12px 18px; padding: 0;">
          <li><span style="color: #b45309; font-weight: 600;">⏳ Belum Pernah Dicek / Pending:</span> <b>${pendingSiswaList.length}</b> siswa</li>
          <li><span style="color: #0369a1; font-weight: 600;">📋 Sudah Pernah Dicek Sebelumnya:</span> <b>${alreadyCheckedList.length}</b> siswa</li>
        </ul>

        <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.84rem; max-height: 110px; overflow-y: auto; margin-bottom: 12px;">
          <div style="font-weight: 600; color: #475569; margin-bottom: 4px;">Daftar siswa yang sudah pernah dicek:</div>
          ${alreadyCheckedList.map(s => `• <b>${s.nama}</b> (Hasil: <span style="font-weight:600; color:${s.status === 'Sesuai' ? '#15803d' : '#b91c1c'}">${s.status || 'Perlu Perbaikan'}</span>)`).join('<br>')}
        </div>

        <p style="margin: 0; font-size: 0.85rem; color: #475569;">
          <b>Rekomendasi:</b> Periksa hanya yang <b>masih Pending</b> agar hemat kuota AI, atau periksa ulang semuanya jika ada dokumen baru.
        </p>
      </div>
    `;

    const choice = await Swal.fire({
      title: 'Pilihan Pemeriksaan AI Batch',
      html: htmlInfo,
      icon: 'question',
      showDenyButton: alreadyCheckedList.length > 0 && pendingSiswaList.length > 0,
      showCancelButton: true,
      confirmButtonText: pendingSiswaList.length > 0 ? `⚡ Periksa Yang Pending Saja (${pendingSiswaList.length})` : `🔄 Periksa Ulang Semua (${alreadyCheckedList.length})`,
      denyButtonText: `🔄 Periksa Ulang Semua (${selectedSiswaList.length})`,
      cancelButtonText: 'Batal',
      confirmButtonColor: '#16a34a',
      denyButtonColor: '#0284c7'
    });

    if (choice.isConfirmed) {
      targetListToProcess = pendingSiswaList.length > 0 ? pendingSiswaList : alreadyCheckedList;
    } else if (choice.isDenied) {
      targetListToProcess = selectedSiswaList;
    } else {
      return;
    }
  } else {
    // Semua yang dipilih berstatus pending (belum dicek)
    const resultConfirm = await Swal.fire({
      title: 'Periksa AI Batch?',
      text: `Jalankan pemeriksaan dokumen AI untuk ${selectedSiswaList.length} siswa pending terpilih?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Jalankan Pemeriksaan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#16a34a'
    });
    if (!resultConfirm.isConfirmed) return;
    targetListToProcess = selectedSiswaList;
  }

  if (targetListToProcess.length === 0) {
    Swal.fire('Info', 'Tidak ada siswa yang perlu diproses.', 'info');
    return;
  }

  const total = targetListToProcess.length;
  let suksesCount = 0;
  let gagalCount = 0;
  const userApiKey = localStorage.getItem('gemini_api_key') || '';

  for (let i = 0; i < total; i++) {
    const s = targetListToProcess[i];
    if (!s) continue;

    showLoader(`Memeriksa [${i + 1}/${total}]: ${s.nama}...`);

    const urlIjazah = (s.urlIjazah && (s.urlIjazah.startsWith('http') || s.urlIjazah.startsWith('data:'))) ? s.urlIjazah : (getFileLocal(s.id, 'ijazah') || "");
    const urlKK = (s.urlKK && (s.urlKK.startsWith('http') || s.urlKK.startsWith('data:'))) ? s.urlKK : (getFileLocal(s.id, 'kk') || "");

    if (!urlKK && !urlIjazah) {
      s.status = 'Tidak Sesuai';
      s.koreksiAI = '1. Berkas belum diunggah: Siswa belum memiliki dokumen KK atau Ijazah.';
      gagalCount++;
      continue;
    }

    const targetDoc = urlKK ? 'kk' : 'ijazah';
    const enrichedDataSiswa = {
      ...s,
      urlIjazah: urlIjazah,
      urlKK: urlKK,
      urlFoto: (s.urlFoto && (s.urlFoto.startsWith('http') || s.urlFoto.startsWith('data:'))) ? s.urlFoto : (getFileLocal(s.id, 'foto') || "")
    };

    try {
      const result = await callAPI({
        action: "runAICheck",
        dataSiswa: enrichedDataSiswa,
        jenisDokumen: targetDoc,
        apiKey: userApiKey
      });

      const normStatus = String(result.status || '').toUpperCase();
      const finalStatus = (normStatus === 'COCOK' || normStatus === 'SESUAI') ? 'Sesuai' : 'Tidak Sesuai';
      const finalKoreksi = result.koreksi || (finalStatus === 'Sesuai' ? 'Semua data sesuai dokumen.' : 'Ada ketidaksesuaian data.');

      s.status = finalStatus;
      s.koreksiAI = finalKoreksi;
      s.tipeMasalah = result.tipeMasalah || null;
      s.rekomendasiResmi = result.rekomendasiResmi || null;
      s.suggestedFix = result.suggestedFix || null;

      // Update backend
      callAPI({
        action: "updateStatus",
        idSiswa: s.id,
        status: finalStatus,
        koreksiAI: finalKoreksi
      }).catch(e => { });

      suksesCount++;
    } catch (e) {
      console.warn("Batch item error:", e);
      gagalCount++;
    }

    // Update UI progres
    renderSiswaTable(siswaDataList);
  }

  hideLoader();
  try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }

  Swal.fire({
    icon: 'success',
    title: 'Pemeriksaan AI Selesai!',
    text: `Berhasil memeriksa ${suksesCount} siswa (${gagalCount > 0 ? gagalCount + ' terkendala/tanpa berkas' : 'semua selesai'}). Status dan catatan permasalahan telah otomatis tersimpan di database.`
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

    <!-- Hasil Pemeriksaan AI & Catatan Koreksi -->
    <div class="drawer-detail-card" style="border-left: 4px solid ${s.status === 'Sesuai' ? '#16a34a' : (s.status === 'Tidak Sesuai' ? '#dc2626' : '#f59e0b')};">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <h4 style="margin: 0;">Pemeriksaan AI</h4>
        <span style="background: ${s.status === 'Sesuai' ? '#dcfce7' : (s.status === 'Tidak Sesuai' ? '#fee2e2' : '#fef3c7')}; color: ${s.status === 'Sesuai' ? '#15803d' : (s.status === 'Tidak Sesuai' ? '#b91c1c' : '#b45309')}; font-size: 0.8rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">
          ${s.status === 'Sesuai' ? '✅ Sesuai' : (s.status === 'Tidak Sesuai' ? '⚠️ Tidak Sesuai' : (s.status || 'Pending'))}
        </span>
      </div>
      <div style="font-size: 0.88rem; color: #334155; line-height: 1.6; white-space: pre-line; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem;">
        ${s.koreksiAI && s.koreksiAI.trim() !== '' ? s.koreksiAI : '<span style="color: #94a3b8; font-style: italic;">Belum ada catatan pemeriksaan AI untuk siswa ini.</span>'}
      </div>
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
      } catch (e) { }
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
        if (activeUserName) activeUserName.textContent = currentUser.nama;
        if (activeUserAvatar) activeUserAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nama)}&background=0284c7&color=fff`;
        const whoNameEl = document.getElementById('who-user-name');
        if (whoNameEl) whoNameEl.textContent = currentUser.nama;
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

// =================== KELOLA API GEMINI (SUPER ADMIN) ===================
async function loadApiKeys() {
  const tbody = document.getElementById('table-api-keys-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Memuat data kunci API dari Google Sheets...</td></tr>';

  try {
    const list = await callAPI({ action: "getApiKeys" });
    tbody.innerHTML = '';

    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#64748b;">Belum ada kunci API terdaftar.</td></tr>';
      return;
    }

    let totalKeys = list.length;
    let totalQuota = 0;
    let totalUsed = 0;
    let totalRemaining = 0;

    list.forEach((item, idx) => {
      totalQuota += (item.limit || 1500);
      totalUsed += (item.terpakai || 0);
      totalRemaining += (item.sisa || 0);

      const percent = Math.min(100, Math.round(((item.terpakai || 0) / (item.limit || 1500)) * 100));
      const barColor = percent > 85 ? '#ef4444' : percent > 50 ? '#f59e0b' : '#10b981';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="text-align:center; font-weight:600;">${idx + 1}</td>
        <td>
          <div style="font-weight:700; color:#0f172a;">${item.email || '-'}</div>
          <div style="font-size:0.75rem; color:#64748b;">ID: ${item.id}</div>
        </td>
        <td>
          <code style="background:#f1f5f9; padding:3px 6px; border-radius:4px; font-size:0.82rem; color:#334155;">${item.maskedKey || item.apiKey}</code>
        </td>
        <td style="font-weight:600; color:#1e293b;">
          ${item.terpakai || 0}
          <div style="width:100%; background:#e2e8f0; height:6px; border-radius:3px; margin-top:4px; overflow:hidden;">
            <div style="width:${percent}%; background:${barColor}; height:100%;"></div>
          </div>
        </td>
        <td style="color:#64748b;">${item.limit || 1500} / hari</td>
        <td style="font-weight:700; color:#16a34a;">
          ${item.sisa || 0}
        </td>
        <td>
          <span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:4px; font-size:0.78rem; font-weight:600;">
            ${item.status || 'Aktif'}
          </span>
        </td>
        <td>
          <div style="display:flex; gap:4px;">
            <button class="btn btn-warning" onclick="resetApiKeyUsage('${item.id}')" style="padding:4px 8px; font-size:0.75rem;" title="Reset hitungan pemakaian jadi 0">🔄 Reset</button>
            <button class="btn btn-danger" onclick="deleteApiKey('${item.id}', '${item.email}')" style="padding:4px 8px; font-size:0.75rem;">Hapus</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Update Ringkasan Dashboard Kuota
    const elTotal = document.getElementById('api-stat-total-keys');
    const elQuota = document.getElementById('api-stat-total-quota');
    const elUsed = document.getElementById('api-stat-total-used');
    const elRem = document.getElementById('api-stat-total-remaining');

    if (elTotal) elTotal.textContent = totalKeys;
    if (elQuota) elQuota.textContent = totalQuota.toLocaleString() + ' Cek';
    if (elUsed) elUsed.textContent = totalUsed.toLocaleString() + ' Cek';
    if (elRem) elRem.textContent = totalRemaining.toLocaleString() + ' Cek';

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center;">Gagal memuat kunci API: ${err.message}</td></tr>`;
  }
}

async function handleAddApiKey() {
  const email = document.getElementById('key-email').value;
  const token = document.getElementById('key-token').value;
  const limit = document.getElementById('key-limit').value || 1500;

  if (!email || !token) {
    Swal.fire('Form Belum Lengkap', 'Mohon isi Email Akun dan API Key Gemini.', 'warning');
    return;
  }

  showLoader("Mendaftarkan kunci API baru ke database...");

  try {
    await callAPI({
      action: "addApiKey",
      email: email,
      apiKey: token,
      limitHarian: limit
    });

    hideLoader();

    // Reset & Sembunyikan Form
    document.getElementById('form-add-key').reset();
    const wrapper = document.getElementById('wrapper-form-key');
    if (wrapper) wrapper.classList.add('hidden');

    Swal.fire({
      icon: 'success',
      title: 'Kunci API Berhasil Ditambahkan!',
      text: `Akun ${email} sekarang aktif di rotasi otomatis AI.`,
      timer: 2500,
      showConfirmButton: false
    });

    loadApiKeys();

  } catch (err) {
    hideLoader();
    Swal.fire('Error', 'Gagal menambahkan kunci API: ' + err.message, 'error');
  }
}

async function deleteApiKey(idKey, email) {
  const confirm = await Swal.fire({
    title: 'Hapus Kunci API?',
    html: `Apakah Anda yakin ingin menghapus kunci API untuk <b>${email}</b> dari database rotasi?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#dc2626'
  });

  if (!confirm.isConfirmed) return;

  showLoader("Menghapus kunci API...");
  try {
    await callAPI({ action: "deleteApiKey", idKey: idKey });
    hideLoader();
    Swal.fire('Terhapus', 'Kunci API telah dihapus dari database.', 'success');
    loadApiKeys();
  } catch (err) {
    hideLoader();
    Swal.fire('Error', err.message, 'error');
  }
}

async function resetApiKeyUsage(idKey) {
  showLoader("Mereset hitungan kuota...");
  try {
    await callAPI({ action: "resetKeyUsage", idKey: idKey });
    hideLoader();
    Swal.fire('Reset Berhasil', 'Hitungan terpakai kunci API ini telah dikembalikan ke 0.', 'success');
    loadApiKeys();
  } catch (err) {
    hideLoader();
    Swal.fire('Error', err.message, 'error');
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
// ======================= EXPORT / IMPORT EXCEL & CSV & PDF =======================
function exportDataToExcel() {
  if (!siswaDataList || siswaDataList.length === 0) {
    Swal.fire('Info', 'Tidak ada data untuk diekspor', 'info');
    return;
  }

  const dataToExport = siswaDataList.map((s, idx) => ({
    'No.': idx + 1,
    'ID Siswa': s.id || '',
    'Tanggal Daftar': s.tglDaftar ? String(s.tglDaftar).split('T')[0] : '',
    'NISN': s.nisn || '',
    'NIK': s.nik || '',
    'No. Kartu Keluarga': s.noKk || '',
    'Urut KK': s.urutKk || '',
    'Nama Lengkap': s.nama || '',
    'Tempat Lahir': s.tempatLahir || '',
    'Tanggal Lahir': s.tglLahir ? String(s.tglLahir).split('T')[0] : '',
    'Jenjang/Program': s.program || s.jenjang || '',
    'Status Siswa': s.statusAktif || 'Aktif',
    'Status Validasi AI': s.status || 'Belum Dicek',
    'Catatan AI': s.koreksiAI || '',
    'Nama Ibu Kandung': s.namaIbu || '',
    'NIK Ibu': s.nikIbu || '',
    'Nama Ayah Kandung': s.namaAyah || '',
    'NIK Ayah': s.nikAyah || '',
    'Kabupaten/Kota': s.kabKota || '',
    'Kecamatan': s.kecamatan || '',
    'Desa Kelurahan': s.desaKelurahan || '',
    'Syarat': s.syarat || '',
    'Dok Berkas': s.dokBerkas || '',
    'Didaftarkan Oleh': s.createdBy || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataToExport);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data_Peserta_Didik");
  XLSX.writeFile(workbook, `Data_Peserta_Didik_PKBM_Aura_Anugerah_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportDataToPDF() {
  if (!siswaDataList || siswaDataList.length === 0) {
    Swal.fire('Info', 'Tidak ada data untuk diekspor ke PDF', 'info');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    Swal.fire('Error', 'Library jsPDF belum selesai dimuat, silakan muat ulang halaman.', 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Header / Kop Dokumen
  doc.setFillColor(30, 58, 138); // Deep Navy
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('PKBM AURA ANUGERAH - REKAPITULASI PESERTA DIDIK', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Pendidikan Kesetaraan Paket A · Paket B · Paket C | Terakreditasi & Terverifikasi', 14, 18);

  const tglCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  doc.text(`Dicetak pada: ${tglCetak}`, 283, 18, { align: 'right' });

  // Siapkan data tabel
  const tableRows = siswaDataList.map((s, idx) => {
    let tglLahirFormatted = '-';
    if (s.tglLahir) {
      const d = String(s.tglLahir).split('T')[0];
      const p = d.split('-');
      if (p.length === 3) tglLahirFormatted = `${p[2]}/${p[1]}/${p[0]}`;
      else tglLahirFormatted = d;
    }
    const ttl = (s.tempatLahir ? s.tempatLahir + ', ' : '') + tglLahirFormatted;

    // Bersihkan status AI
    let aiStatusClean = 'Belum Dicek';
    const rawSt = String(s.status || '').toLowerCase();
    if (rawSt === 'sesuai' || rawSt === 'cocok' || (rawSt === 'selesai' && (!s.koreksiAI || !s.koreksiAI.includes('tidak')))) {
      aiStatusClean = 'Sesuai';
    } else if (rawSt.includes('tidak') || rawSt.includes('perlu') || (s.koreksiAI && s.koreksiAI.includes('Terdapat ketidaksesuaian'))) {
      aiStatusClean = 'Perlu Cek';
    } else if (rawSt === 'pending') {
      aiStatusClean = 'Pending';
    }

    return [
      idx + 1,
      s.nik || '-',
      s.nisn || '-',
      s.nama || '-',
      s.program || s.jenjang || '-',
      ttl,
      s.namaIbu || '-',
      s.statusAktif || 'Aktif',
      aiStatusClean
    ];
  });

  // Buat Tabel dengan AutoTable
  doc.autoTable({
    head: [['No', 'NIK', 'NISN', 'Nama Peserta Didik', 'Program', 'Tempat, Tanggal Lahir', 'Nama Ibu Kandung', 'Status', 'Validasi AI']],
    body: tableRows,
    startY: 29,
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235], // Blue 600
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      valign: 'middle'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 32 },
      2: { halign: 'center', cellWidth: 24 },
      3: { cellWidth: 46 },
      4: { halign: 'center', cellWidth: 25 },
      5: { cellWidth: 45 },
      6: { cellWidth: 40 },
      7: { halign: 'center', cellWidth: 22 },
      8: { halign: 'center', cellWidth: 25 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { top: 28, left: 14, right: 14, bottom: 16 },
    didDrawPage: function (data) {
      // Footer Nomor Halaman
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `PKBM Aura Anugerah - Halaman ${data.pageNumber} dari ${pageCount}`,
        14,
        doc.internal.pageSize.height - 8
      );
      doc.text(
        `Total Data: ${siswaDataList.length} Peserta Didik`,
        doc.internal.pageSize.width - 14,
        doc.internal.pageSize.height - 8,
        { align: 'right' }
      );
    }
  });

  const fileName = `Data_Peserta_Didik_PKBM_Aura_Anugerah_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
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

// ======================= MODAL CLOSE MECHANISM =======================

// Overlay click modal login: form login tetap aktif di rute /portal atau /portal-pkbm
if (loginModalOverlay) {
  loginModalOverlay.addEventListener('click', (e) => {
    // Jika berada di rute login portal khusus, jangan tutup sembarangan
    if (window.location.pathname.includes('portal')) {
      e.stopPropagation();
    } else if (modalLogin) {
      modalLogin.classList.add('hidden');
    }
  });
}

if (btnCloseLogin) {
  btnCloseLogin.addEventListener('click', () => {
    if (modalLogin) modalLogin.classList.add('hidden');
    if (window.location.pathname.includes('portal')) {
      try { window.history.pushState({}, '', '/pkbm'); } catch (e) { }
    }
  });
}

// Tombol X (Tutup) Modal Formulir Pendaftaran Siswa
if (btnCloseRegister && modalRegister) {
  btnCloseRegister.addEventListener('click', () => {
    cancelEdit();
  });
}

// Klik luar overlay Modal Formulir Pendaftaran Siswa
if (registerModalOverlay && modalRegister) {
  registerModalOverlay.addEventListener('click', () => {
    cancelEdit();
  });
}

// ======================= PENDAFTARAN CEPAT AI (GEMINI) =======================

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

    const userApiKey = localStorage.getItem('gemini_api_key') || '';

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

    // Simpan hasil validasi kesesuaian dari AI (Sesuai / Tidak Sesuai)
    aiValidationResult = {
      status: (result.validationStatus === 'Tidak Sesuai') ? 'Tidak Sesuai' : 'Sesuai',
      details: result.validationDetails || (result.validationStatus === 'Tidak Sesuai' ? 'Terdapat ketidakcocokan antara KK dan Ijazah.' : 'Semua data sesuai dengan dokumen resmi.')
    };

    // Tampilkan formulir review hasil ekstraksi
    const container = document.getElementById('ai-extracted-container');
    if (container) {
      container.style.display = 'block';
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Tampilkan banner hasil pemeriksaan dokumen (Sesuai / Tidak Sesuai)
    const banner = document.getElementById('ai-cross-check-banner');
    const headerBadge = document.getElementById('ai-extract-header-badge');
    if (banner) {
      const isMatch = aiValidationResult.status === 'Sesuai';
      banner.style.display = 'block';
      banner.style.background = isMatch ? '#f0fdf4' : '#fef2f2';
      banner.style.border = `1px solid ${isMatch ? '#86efac' : '#fca5a5'}`;
      banner.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <span style="font-size: 1.25rem;">${isMatch ? '✅' : '⚠️'}</span>
          <div>
            <strong style="color: ${isMatch ? '#15803d' : '#b91c1c'}; font-size: 0.95rem;">
              Status Dokumen: ${isMatch ? 'Data Sesuai' : 'Ditemukan Ketidaksesuaian Antara Berkas'}
            </strong>
            <div style="font-size: 0.85rem; color: #334155; margin-top: 4px; line-height: 1.5; white-space: pre-line;">
              ${aiValidationResult.details}
            </div>
            ${!isMatch ? `
              <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <button type="button" onclick="applyQuickFixInAIRegistration()" class="btn btn-success" style="padding: 5px 12px; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; background: #16a34a;">
                  ⚡ Terapkan Koreksi dari Dokumen Fisik (KK)
                </button>
                <small style="color: #64748b;">ℹ️ Klik untuk menyinkronkan data di form bawah dan ubah status jadi Sesuai.</small>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      if (headerBadge) {
        headerBadge.textContent = isMatch ? '✅ Sesuai' : '⚠️ Perlu Perhatian';
        headerBadge.style.background = isMatch ? '#dcfce7' : '#fee2e2';
        headerBadge.style.color = isMatch ? '#15803d' : '#b91c1c';
      }
    }

    // Tampilkan pratinjau berkas yang berhasil diunggah di Step 2
    renderAIStep2Previews();

    Swal.fire({
      icon: aiValidationResult.status === 'Sesuai' ? 'success' : 'warning',
      title: aiValidationResult.status === 'Sesuai' ? 'Data Berhasil Diekstrak & Sesuai!' : 'Data Diekstrak (Ada Ketidaksesuaian)',
      text: aiValidationResult.status === 'Sesuai'
        ? 'Seluruh data cocok dengan dokumen resmi.'
        : 'Periksa catatan perbedaan pada banner sebelum menyimpan.',
      timer: 3000,
      showConfirmButton: false
    });

  } catch (err) {
    hideLoader();
    console.error("AI Extraction Error:", err);
    Swal.fire('Error', 'Terjadi kesalahan saat memproses dokumen: ' + err.message, 'error');
  }
}

function applyQuickFixInAIRegistration() {
  if (!aiValidationResult || !aiValidationResult.details) return;

  const raw = aiValidationResult.details;
  let updatedAny = false;

  // 1. Cek Tanggal Lahir
  const tglIsoMatch = raw.match(/(\d{4}-\d{2}-\d{2})/);
  const tglDmyMatch = raw.match(/['"]?(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})['"]?/);

  let targetTgl = null;
  if (tglDmyMatch) {
    const d = tglDmyMatch[1].padStart(2, '0');
    const m = tglDmyMatch[2].padStart(2, '0');
    const y = tglDmyMatch[3];
    targetTgl = `${y}-${m}-${d}`;
  } else if (tglIsoMatch) {
    targetTgl = tglIsoMatch[1];
  }

  if (targetTgl) {
    const tglInput = document.getElementById('ai-out-tgl-lahir');
    if (tglInput) {
      tglInput.value = targetTgl;
      tglInput.style.backgroundColor = '#dcfce7';
      tglInput.style.borderColor = '#22c55e';
      updatedAny = true;
    }
  }

  // 2. Ubah status validasi menjadi Sesuai
  aiValidationResult.status = 'Sesuai';
  aiValidationResult.details = `1. Data telah diselaraskan dengan dokumen fisik resmi (KK).\n2. Tanggal lahir terverifikasi: ${targetTgl || '-'}\n3. Seluruh identitas telah cocok.`;

  // Update UI Banner
  const banner = document.getElementById('ai-cross-check-banner');
  const headerBadge = document.getElementById('ai-extract-header-badge');
  if (banner) {
    banner.style.background = '#f0fdf4';
    banner.style.border = '1px solid #86efac';
    banner.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <span style="font-size: 1.25rem;">✅</span>
        <div>
          <strong style="color: #15803d; font-size: 0.95rem;">
            Status Dokumen: Berhasil Disinkronkan (Sesuai)
          </strong>
          <div style="font-size: 0.85rem; color: #166534; margin-top: 4px; line-height: 1.5; white-space: pre-line;">
            ${aiValidationResult.details}
          </div>
        </div>
      </div>
    `;
  }

  if (headerBadge) {
    headerBadge.textContent = '✅ Sesuai';
    headerBadge.style.background = '#dcfce7';
    headerBadge.style.color = '#15803d';
  }

  Swal.fire({
    icon: 'success',
    title: 'Data Berhasil Disinkronkan!',
    html: `Kolom tanggal lahir berhasil disesuaikan dengan dokumen KK (<b>${targetTgl}</b>) dan status pendaftaran menjadi <b>✅ Sesuai</b>. Silakan lanjutkan klik <b>Simpan Data Siswa</b>.`,
    confirmButtonColor: '#16a34a'
  });
}

function renderAIStep2Previews() {
  const updateBox = (boxId, badgeId, b64, label) => {
    const box = document.getElementById(boxId);
    const badge = document.getElementById(badgeId);
    if (!box) return;

    if (b64) {
      if (badge) {
        badge.textContent = "✓ Terlampir";
        badge.style.color = "#15803d";
        badge.style.fontWeight = "600";
      }
      if (b64.startsWith('data:image')) {
        box.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${b64}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid #0284c7;">
            <span style="font-size: 0.8rem; color: #0284c7; font-weight: 600;">Berkas siap disimpan</span>
          </div>`;
      } else {
        box.innerHTML = `<span style="font-size: 0.8rem; color: #0284c7; font-weight: 600;">📄 Dokumen PDF terlampir</span>`;
      }
    } else {
      if (badge) {
        badge.textContent = "(Belum ada)";
        badge.style.color = "#94a3b8";
        badge.style.fontWeight = "normal";
      }
      box.innerHTML = `<span style="font-size: 0.78rem; color: #94a3b8; font-style: italic;">Belum diunggah</span>`;
    }
  };

  updateBox('ai-preview-box-kk', 'ai-status-badge-kk', aiUploadedFiles.kk, 'KK');
  updateBox('ai-preview-box-ijazah', 'ai-status-badge-ijazah', aiUploadedFiles.ijazah, 'Ijazah');
  updateBox('ai-preview-box-foto', 'ai-status-badge-foto', aiUploadedFiles.foto, 'Foto');
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

    // Periksa apakah ada file pengganti / tambahan yang diunggah di Step 2
    const step2Kk = document.getElementById('ai-step2-file-kk');
    const step2Ijazah = document.getElementById('ai-step2-file-ijazah');
    const step2Foto = document.getElementById('ai-step2-file-foto');

    let b64Kk = (step2Kk && step2Kk.files[0]) ? await toBase64(step2Kk.files[0]) : aiUploadedFiles.kk;
    let b64Ijazah = (step2Ijazah && step2Ijazah.files[0]) ? await toBase64(step2Ijazah.files[0]) : aiUploadedFiles.ijazah;
    let b64Foto = (step2Foto && step2Foto.files[0]) ? await toBase64(step2Foto.files[0]) : aiUploadedFiles.foto;

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
      status: (aiValidationResult && aiValidationResult.status) ? aiValidationResult.status : 'Sesuai',
      koreksiAI: (aiValidationResult && aiValidationResult.details) ? aiValidationResult.details : 'Data berhasil diekstrak dan sesuai dokumen resmi.',
      urlIjazah: b64Ijazah || '',
      urlKK: b64Kk || '',
      urlBayar: '',
      statusAktif: 'Aktif',
      createdBy: currentUser ? currentUser.username : 'AI Quick Reg'
    };

    // Optimistic Update ke state memori & cache lokal secara seketika
    siswaDataList.push(newSiswa);
    try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }

    // Update UI seketika
    renderDashboardUI(siswaDataList);
    if (typeof renderSiswaTable === 'function') renderSiswaTable(siswaDataList);

    // Langsung reset formulir agar user bisa langsung mendaftarkan siswa baru lagi
    resetAIRegForm();

    // Notifikasi Toast Instan (Non-blocking, tidak menahan layar)
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `Siswa "${nama}" berhasil didaftarkan!`,
      text: 'Data langsung tersimpan. Sinkronisasi Google Drive berjalan di latar belakang.',
      showConfirmButton: false,
      timer: 3500
    });

    // Kirim sinkronisasi ke backend Google Sheets di latar belakang tanpa menghalangi user
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
          try { localStorage.setItem('ppdb_siswa_cache', JSON.stringify(siswaDataList)); } catch (e) { }
        }
      }
    }).catch(err => {
      console.warn("Background sync AI registration:", err);
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

  // Reset input berkas Step 2
  const s2Kk = document.getElementById('ai-step2-file-kk');
  if (s2Kk) s2Kk.value = '';
  const s2Ijazah = document.getElementById('ai-step2-file-ijazah');
  if (s2Ijazah) s2Ijazah.value = '';
  const s2Foto = document.getElementById('ai-step2-file-foto');
  if (s2Foto) s2Foto.value = '';

  const container = document.getElementById('ai-extracted-container');
  if (container) container.style.display = 'none';

  const banner = document.getElementById('ai-cross-check-banner');
  if (banner) { banner.style.display = 'none'; banner.innerHTML = ''; }

  aiUploadedFiles = { kk: null, ijazah: null, foto: null };
  aiValidationResult = null;
}

// ======================= FITUR PORTAL SISWA & AKADEMIK (MYAURA) =======================
function renderPortalSiswaData(siswa) {
  if (!siswa) return;
  const elNama = document.getElementById('siswa-portal-nama');
  const elNik = document.getElementById('siswa-portal-nik');
  const elNisn = document.getElementById('siswa-portal-nisn');
  const elTtl = document.getElementById('siswa-portal-ttl');
  const elIbu = document.getElementById('siswa-portal-ibu');
  const elAlamat = document.getElementById('siswa-portal-alamat');
  const elProgram = document.getElementById('siswa-portal-program');
  const elStatus = document.getElementById('siswa-portal-status-badge');
  const elCatatan = document.getElementById('siswa-portal-catatan');

  if (elNama) elNama.textContent = siswa.nama || '-';
  if (elNik) elNik.textContent = siswa.nik || '-';
  if (elNisn) elNisn.textContent = siswa.nisn || '-';
  if (elTtl) elTtl.textContent = `${siswa.tempatLahir ? siswa.tempatLahir + ', ' : ''}${siswa.tglLahir || '-'}`;
  if (elIbu) elIbu.textContent = siswa.namaIbu || '-';
  if (elAlamat) elAlamat.textContent = siswa.alamat || 'Sentani, Jayapura';
  if (elProgram) elProgram.textContent = siswa.program || 'Paket C (Setara SMA)';

  if (elStatus) {
    const st = String(siswa.statusValidasi || '').toLowerCase();
    if (st === 'sesuai' || st === 'cocok' || st === 'diterima' || st === 'selesai') {
      elStatus.innerHTML = '<span style="color: #059669;">✅ Terverifikasi & Diterima</span>';
      if (elCatatan) elCatatan.textContent = 'Semua dokumen pendaftaran telah sesuai dengan arsip kependudukan.';
    } else if (st.includes('tidak') || st.includes('perlu')) {
      elStatus.innerHTML = '<span style="color: #e11d48;">⚠️ Perlu Penyesuaian Dokumen</span>';
      if (elCatatan) elCatatan.textContent = siswa.catatanAI || 'Silakan hubungi admin sekolah untuk verifikasi dokumen Ijazah / KK.';
    } else {
      elStatus.innerHTML = '<span style="color: #d97706;">⏳ Menunggu Verifikasi AI</span>';
      if (elCatatan) elCatatan.textContent = 'Dokumen Anda sedang dalam antrean pemeriksaan oleh tim verifikator.';
    }
  }
}

function cetakKartuPendaftaranSiswa() {
  if (!currentUser || currentUser.role !== 'Siswa') {
    Swal.fire('Info', 'Fitur ini untuk mencetak kartu tanda bukti peserta didik.', 'info');
    return;
  }
  const s = currentUser.dataSiswa || {};
  if (!window.jspdf || !window.jspdf.jsPDF) {
    window.print();
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

  // Kop Hijau Emerald ala Rostering & PKBM
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, 148, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('PKBM AURA ANUGERAH', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('KARTU TANDA PESERTA DIDIK KESETARAAN', 14, 18);
  doc.text('Tahun Ajaran 2026/2027 · Sentani Jayapura', 14, 23);

  // Body Kartu
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('BIODATA PESERTA DIDIK', 14, 38);

  const startY = 46;
  const lineGap = 8;
  const rows = [
    ['Nama Lengkap', s.nama || '-'],
    ['Nomor Induk Kependudukan (NIK)', s.nik || '-'],
    ['NISN', s.nisn || '-'],
    ['Program Belajar', s.program || 'Paket Kesetaraan'],
    ['Tempat, Tanggal Lahir', `${s.tempatLahir ? s.tempatLahir + ', ' : ''}${s.tglLahir || '-'}`],
    ['Nama Ibu Kandung', s.namaIbu || '-'],
    ['Status Berkas', s.statusValidasi || 'Aktif Terdaftar']
  ];

  rows.forEach((r, idx) => {
    doc.setFont('helvetica', 'normal');
    doc.text(r[0], 14, startY + (idx * lineGap));
    doc.text(':', 66, startY + (idx * lineGap));
    doc.setFont('helvetica', 'bold');
    doc.text(String(r[1]), 70, startY + (idx * lineGap));
  });

  // Footer Kartu
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Simpan kartu ini sebagai bukti resmi pendaftaran & identitas belajar di PKBM Aura Anugerah.', 14, 120);

  doc.save(`Kartu_Siswa_${s.nama || 'PKBM'}.pdf`);
}

function catatAbsensiCepat() {
  Swal.fire({
    title: 'Catat Kehadiran Belajar',
    html: `
      <div style="text-align: left; font-size: 0.9rem;">
        <label style="display:block; margin-bottom: 4px; font-weight:600;">Pilih Peserta Didik / Tutor:</label>
        <select id="swal-absen-nama" class="swal2-input" style="width: 100%; margin: 0 0 12px 0;">
          ${siswaDataList.map(s => `<option value="${s.nama}">${s.nama} (${s.program || 'Paket'})</option>`).join('')}
        </select>
        <label style="display:block; margin-bottom: 4px; font-weight:600;">Status Kehadiran:</label>
        <select id="swal-absen-status" class="swal2-input" style="width: 100%; margin: 0 0 12px 0;">
          <option value="Hadir">Hadir Tatap Muka</option>
          <option value="Daring">Hadir Daring (Online)</option>
          <option value="Izin">Izin / Sakit</option>
        </select>
        <label style="display:block; margin-bottom: 4px; font-weight:600;">Keterangan Modul / Materi:</label>
        <input id="swal-absen-ket" class="swal2-input" placeholder="Contoh: Modul 3 PPKn" style="width: 100%; margin: 0;">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Simpan Kehadiran',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#059669',
    preConfirm: () => {
      const nama = document.getElementById('swal-absen-nama').value;
      const status = document.getElementById('swal-absen-status').value;
      const ket = document.getElementById('swal-absen-ket').value;
      return { nama, status, ket };
    }
  }).then((res) => {
    if (res.isConfirmed && res.value) {
      const tbody = document.getElementById('table-absensi-body');
      const now = new Date();
      const tgl = now.toLocaleDateString('id-ID');
      const waktu = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>1</td>
        <td>${tgl}</td>
        <td><strong>${res.value.nama}</strong></td>
        <td>Paket Kesetaraan</td>
        <td>${waktu} WIT</td>
        <td><span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 6px; font-weight:600; font-size: 0.8rem;">${res.value.status}</span></td>
        <td>${res.value.ket || 'Belajar Mandiri'}</td>
      `;
      if (tbody.children.length === 1 && tbody.children[0].innerText.includes('Belum ada')) {
        tbody.innerHTML = '';
      }
      tbody.prepend(tr);
      Swal.fire('Sukses', 'Data kehadiran berhasil dicatat.', 'success');
    }
  });
}

function catatTransaksiBaru() {
  Swal.fire({
    title: 'Catat SPP / Tabungan Siswa',
    html: `
      <div style="text-align: left; font-size: 0.9rem;">
        <label style="display:block; margin-bottom: 4px; font-weight:600;">Nama Peserta Didik:</label>
        <select id="swal-bayar-nama" class="swal2-input" style="width: 100%; margin: 0 0 12px 0;">
          ${siswaDataList.map(s => `<option value="${s.nama}">${s.nama} (${s.program || 'Paket'})</option>`).join('')}
        </select>
        <label style="display:block; margin-bottom: 4px; font-weight:600;">Jenis Transaksi:</label>
        <select id="swal-bayar-jenis" class="swal2-input" style="width: 100%; margin: 0 0 12px 0;">
          <option value="SPP Bulanan">Pembayaran SPP Bulanan</option>
          <option value="Kas Modul / Buku">Biaya Modul & Ujian</option>
          <option value="Setor Tabungan">Setor Tabungan Siswa</option>
          <option value="Tarik Tabungan">Tarik Tabungan Siswa</option>
        </select>
        <label style="display:block; margin-bottom: 4px; font-weight:600;">Nominal Pembayaran (Rp):</label>
        <input id="swal-bayar-nominal" type="number" class="swal2-input" placeholder="Contoh: 150000" style="width: 100%; margin: 0 0 12px 0;">
        <label style="display:block; margin-bottom: 4px; font-weight:600;">Metode Pembayaran:</label>
        <select id="swal-bayar-metode" class="swal2-input" style="width: 100%; margin: 0;">
          <option value="Tunai / Kasir">Tunai / Langsung di Sekolah</option>
          <option value="Transfer Bank / QRIS">Transfer Bank / QRIS</option>
        </select>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Simpan Pembayaran',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#059669',
    preConfirm: () => {
      const nama = document.getElementById('swal-bayar-nama').value;
      const jenis = document.getElementById('swal-bayar-jenis').value;
      const nominal = document.getElementById('swal-bayar-nominal').value;
      const metode = document.getElementById('swal-bayar-metode').value;
      if (!nominal) {
        Swal.showValidationMessage('Harap isi nominal uang!');
        return false;
      }
      return { nama, jenis, nominal, metode };
    }
  }).then((res) => {
    if (res.isConfirmed && res.value) {
      const tbody = document.getElementById('table-bayar-body');
      const now = new Date();
      const tgl = now.toLocaleDateString('id-ID');
      const tr = document.createElement('tr');
      const formattedUang = Number(res.value.nominal).toLocaleString('id-ID');
      tr.innerHTML = `
        <td>1</td>
        <td>${tgl}</td>
        <td><strong>${res.value.nama}</strong></td>
        <td>Paket Kesetaraan</td>
        <td><span style="background: #e0f2fe; color: #0284c7; padding: 3px 8px; border-radius: 6px; font-weight:600; font-size: 0.8rem;">${res.value.jenis}</span></td>
        <td style="font-weight:700; color:#059669;">Rp ${formattedUang}</td>
        <td>${res.value.metode}</td>
        <td>${currentUser ? currentUser.nama : 'Admin'}</td>
      `;
      if (tbody.children.length === 1 && tbody.children[0].innerText.includes('Belum ada')) {
        tbody.innerHTML = '';
      }
      tbody.prepend(tr);
      Swal.fire('Sukses', 'Transaksi berhasil disimpan dan dicatat ke pembukuan.', 'success');
    }
  });
}

// ====================================================================================
// ==================== SISTEM MATERI BELAJAR & UJIAN SISWA (ALA MYAURA) ====================
// ====================================================================================

// In-Memory Data / Storage Cache
let bukuList = [
  {
    "id": "1NzFRFPPwsyeO7OGYYtOJlkN3Zk59TGhH",
    "kode": "BK-001",
    "nama": "Menjadi Peneliti Geografi",
    "mapel": "Geografi",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "2",
    "totalHal": 35,
    "dibaca": 84,
    "rating": 4.5,
    "cover": "https://drive.google.com/thumbnail?id=1NzFRFPPwsyeO7OGYYtOJlkN3Zk59TGhH&sz=w600",
    "file": "https://drive.google.com/file/d/1NzFRFPPwsyeO7OGYYtOJlkN3Zk59TGhH/preview",
    "download": "https://drive.google.com/uc?export=download&id=1NzFRFPPwsyeO7OGYYtOJlkN3Zk59TGhH"
  },
  {
    "id": "1HpmYq6CEExGpRtnWS8r_7mNiTgLN_tvH",
    "kode": "BK-002",
    "nama": "Ragam Gejala Sosial di Masyarakat",
    "mapel": "Sosiologi",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "1",
    "totalHal": 36,
    "dibaca": 76,
    "rating": 4.6,
    "cover": "https://drive.google.com/thumbnail?id=1HpmYq6CEExGpRtnWS8r_7mNiTgLN_tvH&sz=w600",
    "file": "https://drive.google.com/file/d/1HpmYq6CEExGpRtnWS8r_7mNiTgLN_tvH/preview",
    "download": "https://drive.google.com/uc?export=download&id=1HpmYq6CEExGpRtnWS8r_7mNiTgLN_tvH"
  },
  {
    "id": "1dd4rrNnf6f7MQ9qP-5L0Te6eG63gR6DF",
    "kode": "BK-003",
    "nama": "Kerajinan Tangan Mandiri",
    "mapel": "Prakarya",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "1",
    "totalHal": 37,
    "dibaca": 68,
    "rating": 4.7,
    "cover": "https://drive.google.com/thumbnail?id=1dd4rrNnf6f7MQ9qP-5L0Te6eG63gR6DF&sz=w600",
    "file": "https://drive.google.com/file/d/1dd4rrNnf6f7MQ9qP-5L0Te6eG63gR6DF/preview",
    "download": "https://drive.google.com/uc?export=download&id=1dd4rrNnf6f7MQ9qP-5L0Te6eG63gR6DF"
  },
  {
    "id": "1So8pAZCMBm7S6_0warHKG3DZztPJtBUb",
    "kode": "BK-004",
    "nama": "Kejayaan Maritim dan Jalur Rempah Nusantara",
    "mapel": "Sejarah Indonesia",
    "jenjang": "Paket C",
    "kelas": "Kelas XI",
    "modul": "1",
    "totalHal": 38,
    "dibaca": 62,
    "rating": 4.8,
    "cover": "https://drive.google.com/thumbnail?id=1So8pAZCMBm7S6_0warHKG3DZztPJtBUb&sz=w600",
    "file": "https://drive.google.com/file/d/1So8pAZCMBm7S6_0warHKG3DZztPJtBUb/preview",
    "download": "https://drive.google.com/uc?export=download&id=1So8pAZCMBm7S6_0warHKG3DZztPJtBUb"
  },
  {
    "id": "1hIyNmzlza3iYCealntDIU7hP4-RQ-AOC",
    "kode": "BK-005",
    "nama": "Peran Pelaku Ekonomi dalam Kegiatan Pasar",
    "mapel": "Ekonomi",
    "jenjang": "Paket C",
    "kelas": "Kelas XI",
    "modul": "1",
    "totalHal": 39,
    "dibaca": 59,
    "rating": 4.9,
    "cover": "https://drive.google.com/thumbnail?id=1hIyNmzlza3iYCealntDIU7hP4-RQ-AOC&sz=w600",
    "file": "https://drive.google.com/file/d/1hIyNmzlza3iYCealntDIU7hP4-RQ-AOC/preview",
    "download": "https://drive.google.com/uc?export=download&id=1hIyNmzlza3iYCealntDIU7hP4-RQ-AOC"
  },
  {
    "id": "1iYq9gTYvojO-Rbqe_9d8_lJIVQDIGrve",
    "kode": "BK-006",
    "nama": "Prakarya dan Kewirausahaan Paket C_Modul 5",
    "mapel": "Prakarya",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "5",
    "totalHal": 40,
    "dibaca": 54,
    "rating": 4.5,
    "cover": "https://drive.google.com/thumbnail?id=1iYq9gTYvojO-Rbqe_9d8_lJIVQDIGrve&sz=w600",
    "file": "https://drive.google.com/file/d/1iYq9gTYvojO-Rbqe_9d8_lJIVQDIGrve/preview",
    "download": "https://drive.google.com/uc?export=download&id=1iYq9gTYvojO-Rbqe_9d8_lJIVQDIGrve"
  },
  {
    "id": "1MW1WH6SkWKrpyqcIbzNpD5-IZ-88U1X7",
    "kode": "BK-007",
    "nama": "Interaksi Sosial dan Dinamika Kependudukan",
    "mapel": "IPS",
    "jenjang": "Paket B",
    "kelas": "Kelas VII",
    "modul": "1",
    "totalHal": 41,
    "dibaca": 48,
    "rating": 4.6,
    "cover": "https://drive.google.com/thumbnail?id=1MW1WH6SkWKrpyqcIbzNpD5-IZ-88U1X7&sz=w600",
    "file": "https://drive.google.com/file/d/1MW1WH6SkWKrpyqcIbzNpD5-IZ-88U1X7/preview",
    "download": "https://drive.google.com/uc?export=download&id=1MW1WH6SkWKrpyqcIbzNpD5-IZ-88U1X7"
  },
  {
    "id": "1BQS2EKyv5OPassBnWVukziXOHRtJS-fB",
    "kode": "BK-008",
    "nama": "Individu, Kelompok, dan Hubungan Sosial",
    "mapel": "Sosiologi",
    "jenjang": "Paket C",
    "kelas": "Kelas X",
    "modul": "1",
    "totalHal": 42,
    "dibaca": 43,
    "rating": 4.7,
    "cover": "https://drive.google.com/thumbnail?id=1BQS2EKyv5OPassBnWVukziXOHRtJS-fB&sz=w600",
    "file": "https://drive.google.com/file/d/1BQS2EKyv5OPassBnWVukziXOHRtJS-fB/preview",
    "download": "https://drive.google.com/uc?export=download&id=1BQS2EKyv5OPassBnWVukziXOHRtJS-fB"
  },
  {
    "id": "117KaOkqZMOngNEIriGsvNmz7G1ApDqKV",
    "kode": "BK-009",
    "nama": "Dinamika Litosfer dan Dampaknya Terhadap Kehidupan",
    "mapel": "Geografi",
    "jenjang": "Paket C",
    "kelas": "Kelas XI",
    "modul": "1",
    "totalHal": 43,
    "dibaca": 39,
    "rating": 4.8,
    "cover": "https://drive.google.com/thumbnail?id=117KaOkqZMOngNEIriGsvNmz7G1ApDqKV&sz=w600",
    "file": "https://drive.google.com/file/d/117KaOkqZMOngNEIriGsvNmz7G1ApDqKV/preview",
    "download": "https://drive.google.com/uc?export=download&id=117KaOkqZMOngNEIriGsvNmz7G1ApDqKV"
  },
  {
    "id": "1r5Gij0B_HhfotJ64si09-EZDxZmcBrru",
    "kode": "BK-010",
    "nama": "Pertumbuhan dan Perkembangan Makhluk Hidup",
    "mapel": "Biologi",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "1",
    "totalHal": 44,
    "dibaca": 35,
    "rating": 4.9,
    "cover": "https://drive.google.com/thumbnail?id=1r5Gij0B_HhfotJ64si09-EZDxZmcBrru&sz=w600",
    "file": "https://drive.google.com/file/d/1r5Gij0B_HhfotJ64si09-EZDxZmcBrru/preview",
    "download": "https://drive.google.com/uc?export=download&id=1r5Gij0B_HhfotJ64si09-EZDxZmcBrru"
  },
  {
    "id": "1AKbnD7aApjMDfZEvmmz4ckyO1kmerPDO",
    "kode": "BK-011",
    "nama": "Hakikat Fisika dan Prosedur Ilmiah",
    "mapel": "Fisika",
    "jenjang": "Paket C",
    "kelas": "Kelas X",
    "modul": "1",
    "totalHal": 45,
    "dibaca": 31,
    "rating": 4.5,
    "cover": "https://drive.google.com/thumbnail?id=1AKbnD7aApjMDfZEvmmz4ckyO1kmerPDO&sz=w600",
    "file": "https://drive.google.com/file/d/1AKbnD7aApjMDfZEvmmz4ckyO1kmerPDO/preview",
    "download": "https://drive.google.com/uc?export=download&id=1AKbnD7aApjMDfZEvmmz4ckyO1kmerPDO"
  },
  {
    "id": "1A58CDQ56cIio5w_DW174MMkN-4RvS3Or",
    "kode": "BK-012",
    "nama": "Termokimia dan Energi Reaksi",
    "mapel": "Kimia",
    "jenjang": "Paket C",
    "kelas": "Kelas XI",
    "modul": "1",
    "totalHal": 46,
    "dibaca": 28,
    "rating": 4.6,
    "cover": "https://drive.google.com/thumbnail?id=1A58CDQ56cIio5w_DW174MMkN-4RvS3Or&sz=w600",
    "file": "https://drive.google.com/file/d/1A58CDQ56cIio5w_DW174MMkN-4RvS3Or/preview",
    "download": "https://drive.google.com/uc?export=download&id=1A58CDQ56cIio5w_DW174MMkN-4RvS3Or"
  },
  {
    "id": "1Dr1gmn--u33nOmswual3BVWUBFSUkilN",
    "kode": "BK-013",
    "nama": "Kerajinan Bahan Keras Nusantara",
    "mapel": "Prakarya",
    "jenjang": "Paket B",
    "kelas": "Kelas VIII",
    "modul": "1",
    "totalHal": 47,
    "dibaca": 24,
    "rating": 4.7,
    "cover": "https://drive.google.com/thumbnail?id=1Dr1gmn--u33nOmswual3BVWUBFSUkilN&sz=w600",
    "file": "https://drive.google.com/file/d/1Dr1gmn--u33nOmswual3BVWUBFSUkilN/preview",
    "download": "https://drive.google.com/uc?export=download&id=1Dr1gmn--u33nOmswual3BVWUBFSUkilN"
  },
  {
    "id": "1Q-Y-mhxx3kHMiJOmBZNCTwcaPYqcntIP",
    "kode": "BK-014",
    "nama": "Merajut Kebersamaan dalam Bingkai NKRI",
    "mapel": "PPKn",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "1",
    "totalHal": 48,
    "dibaca": 20,
    "rating": 4.8,
    "cover": "https://drive.google.com/thumbnail?id=1Q-Y-mhxx3kHMiJOmBZNCTwcaPYqcntIP&sz=w600",
    "file": "https://drive.google.com/file/d/1Q-Y-mhxx3kHMiJOmBZNCTwcaPYqcntIP/preview",
    "download": "https://drive.google.com/uc?export=download&id=1Q-Y-mhxx3kHMiJOmBZNCTwcaPYqcntIP"
  },
  {
    "id": "1kv3EcgzbCOiBdRL5s8LPxC7IDrhYx8a6",
    "kode": "BK-015",
    "nama": "Hak dan Kewajiban Warga Negara",
    "mapel": "PPKn",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "1",
    "totalHal": 49,
    "dibaca": 18,
    "rating": 4.9,
    "cover": "https://drive.google.com/thumbnail?id=1kv3EcgzbCOiBdRL5s8LPxC7IDrhYx8a6&sz=w600",
    "file": "https://drive.google.com/file/d/1kv3EcgzbCOiBdRL5s8LPxC7IDrhYx8a6/preview",
    "download": "https://drive.google.com/uc?export=download&id=1kv3EcgzbCOiBdRL5s8LPxC7IDrhYx8a6"
  },
  {
    "id": "1Gdy8_1Q3t_mA3FcCqZCjNOTFTFZHc5s0",
    "kode": "BK-016",
    "nama": "Matematika Peminatan Paket C",
    "mapel": "Matematika",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "9",
    "totalHal": 50,
    "dibaca": 15,
    "rating": 4.5,
    "cover": "https://drive.google.com/thumbnail?id=1Gdy8_1Q3t_mA3FcCqZCjNOTFTFZHc5s0&sz=w600",
    "file": "https://drive.google.com/file/d/1Gdy8_1Q3t_mA3FcCqZCjNOTFTFZHc5s0/preview",
    "download": "https://drive.google.com/uc?export=download&id=1Gdy8_1Q3t_mA3FcCqZCjNOTFTFZHc5s0"
  },
  {
    "id": "1gdIKeERm3mjQypc98KtNwinxoy6ftKyB",
    "kode": "BK-017",
    "nama": "Kupas Tuntas Karya Sastra",
    "mapel": "Bahasa Indonesia",
    "jenjang": "Paket B",
    "kelas": "Kelas IX",
    "modul": "1",
    "totalHal": 51,
    "dibaca": 12,
    "rating": 4.6,
    "cover": "https://drive.google.com/thumbnail?id=1gdIKeERm3mjQypc98KtNwinxoy6ftKyB&sz=w600",
    "file": "https://drive.google.com/file/d/1gdIKeERm3mjQypc98KtNwinxoy6ftKyB/preview",
    "download": "https://drive.google.com/uc?export=download&id=1gdIKeERm3mjQypc98KtNwinxoy6ftKyB"
  },
  {
    "id": "1Oqbq9xbMFx5ToM_jiBsQWZ21m_S_pvF9",
    "kode": "BK-018",
    "nama": "Merajut Kebersamaan dalam Bingkai NKRI",
    "mapel": "PPKn",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "1",
    "totalHal": 52,
    "dibaca": 10,
    "rating": 4.7,
    "cover": "https://drive.google.com/thumbnail?id=1Oqbq9xbMFx5ToM_jiBsQWZ21m_S_pvF9&sz=w600",
    "file": "https://drive.google.com/file/d/1Oqbq9xbMFx5ToM_jiBsQWZ21m_S_pvF9/preview",
    "download": "https://drive.google.com/uc?export=download&id=1Oqbq9xbMFx5ToM_jiBsQWZ21m_S_pvF9"
  },
  {
    "id": "1mxxeDT0VuesOAW_La8L1nT9wxNYwLF4m",
    "kode": "BK-019",
    "nama": "Penerapan Limit dan Turunan Sehari-hari",
    "mapel": "Matematika",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "1",
    "totalHal": 53,
    "dibaca": 8,
    "rating": 4.8,
    "cover": "https://drive.google.com/thumbnail?id=1mxxeDT0VuesOAW_La8L1nT9wxNYwLF4m&sz=w600",
    "file": "https://drive.google.com/file/d/1mxxeDT0VuesOAW_La8L1nT9wxNYwLF4m/preview",
    "download": "https://drive.google.com/uc?export=download&id=1mxxeDT0VuesOAW_La8L1nT9wxNYwLF4m"
  },
  {
    "id": "1MPY9BaoX_TLmJUhvFQ5hw_6--aQElQ9C",
    "kode": "BK-020",
    "nama": "Kejayaan Maritim dan Jalur Rempah Nusantara",
    "mapel": "Sejarah Indonesia",
    "jenjang": "Paket C",
    "kelas": "Kelas XI",
    "modul": "1",
    "totalHal": 54,
    "dibaca": 6,
    "rating": 4.9,
    "cover": "https://drive.google.com/thumbnail?id=1MPY9BaoX_TLmJUhvFQ5hw_6--aQElQ9C&sz=w600",
    "file": "https://drive.google.com/file/d/1MPY9BaoX_TLmJUhvFQ5hw_6--aQElQ9C/preview",
    "download": "https://drive.google.com/uc?export=download&id=1MPY9BaoX_TLmJUhvFQ5hw_6--aQElQ9C"
  },
  {
    "id": "17lHP4jlueuPgvHOLkGdQXhJGFcy2RUWU",
    "kode": "BK-021",
    "nama": "Pengayaan Pengetahuan dan Keterampilan",
    "mapel": "Sejarah",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "5",
    "totalHal": 55,
    "dibaca": 12,
    "rating": 4.5,
    "cover": "https://drive.google.com/thumbnail?id=17lHP4jlueuPgvHOLkGdQXhJGFcy2RUWU&sz=w600",
    "file": "https://drive.google.com/file/d/17lHP4jlueuPgvHOLkGdQXhJGFcy2RUWU/preview",
    "download": "https://drive.google.com/uc?export=download&id=17lHP4jlueuPgvHOLkGdQXhJGFcy2RUWU"
  },
  {
    "id": "1Y5P9-LV6zPUL0XMml0hUZqdiRXcDhcI6",
    "kode": "BK-022",
    "nama": "Exploring Wonderful Indonesia",
    "mapel": "Bahasa Inggris",
    "jenjang": "Paket B",
    "kelas": "Kelas VIII",
    "modul": "1",
    "totalHal": 56,
    "dibaca": 20,
    "rating": 4.6,
    "cover": "https://drive.google.com/thumbnail?id=1Y5P9-LV6zPUL0XMml0hUZqdiRXcDhcI6&sz=w600",
    "file": "https://drive.google.com/file/d/1Y5P9-LV6zPUL0XMml0hUZqdiRXcDhcI6/preview",
    "download": "https://drive.google.com/uc?export=download&id=1Y5P9-LV6zPUL0XMml0hUZqdiRXcDhcI6"
  },
  {
    "id": "1CRFdxH9Pyrzzmi9htUSLdhzwOKT3pyDa",
    "kode": "BK-023",
    "nama": "Harmoni Sosial dalam Keberagaman",
    "mapel": "Sosiologi",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "4",
    "totalHal": 57,
    "dibaca": 19,
    "rating": 4.7,
    "cover": "https://drive.google.com/thumbnail?id=1CRFdxH9Pyrzzmi9htUSLdhzwOKT3pyDa&sz=w600",
    "file": "https://drive.google.com/file/d/1CRFdxH9Pyrzzmi9htUSLdhzwOKT3pyDa/preview",
    "download": "https://drive.google.com/uc?export=download&id=1CRFdxH9Pyrzzmi9htUSLdhzwOKT3pyDa"
  },
  {
    "id": "1grPCd2eP8Av35bxHhoh70JYqWCJwxoU-",
    "kode": "BK-024",
    "nama": "Individu, Kelompok, dan Hubungan Sosial",
    "mapel": "Sosiologi",
    "jenjang": "Paket C",
    "kelas": "Kelas X",
    "modul": "1",
    "totalHal": 58,
    "dibaca": 12,
    "rating": 4.8,
    "cover": "https://drive.google.com/thumbnail?id=1grPCd2eP8Av35bxHhoh70JYqWCJwxoU-&sz=w600",
    "file": "https://drive.google.com/file/d/1grPCd2eP8Av35bxHhoh70JYqWCJwxoU-/preview",
    "download": "https://drive.google.com/uc?export=download&id=1grPCd2eP8Av35bxHhoh70JYqWCJwxoU-"
  },
  {
    "id": "11tCWujRmBSw8S33zkst-BJX0BnWiciRC",
    "kode": "BK-025",
    "nama": "Dinamika Litosfer dan Dampaknya Terhadap Kehidupan",
    "mapel": "Geografi",
    "jenjang": "Paket C",
    "kelas": "Kelas XI",
    "modul": "1",
    "totalHal": 59,
    "dibaca": 4,
    "rating": 4.9,
    "cover": "https://drive.google.com/thumbnail?id=11tCWujRmBSw8S33zkst-BJX0BnWiciRC&sz=w600",
    "file": "https://drive.google.com/file/d/11tCWujRmBSw8S33zkst-BJX0BnWiciRC/preview",
    "download": "https://drive.google.com/uc?export=download&id=11tCWujRmBSw8S33zkst-BJX0BnWiciRC"
  },
  {
    "id": "1C5z9vCvsCHzU0E4yaJriX64iM0i2NiAu",
    "kode": "BK-026",
    "nama": "Pertumbuhan dan Perkembangan Makhluk Hidup",
    "mapel": "Biologi",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "4",
    "totalHal": 60,
    "dibaca": 15,
    "rating": 4.5,
    "cover": "https://drive.google.com/thumbnail?id=1C5z9vCvsCHzU0E4yaJriX64iM0i2NiAu&sz=w600",
    "file": "https://drive.google.com/file/d/1C5z9vCvsCHzU0E4yaJriX64iM0i2NiAu/preview",
    "download": "https://drive.google.com/uc?export=download&id=1C5z9vCvsCHzU0E4yaJriX64iM0i2NiAu"
  },
  {
    "id": "1PIV-w4Hp48ZZw_HQiLmWBfzrM4hy98d2",
    "kode": "BK-027",
    "nama": "Pengayaan Pengetahuan dan Keterampilan",
    "mapel": "IPS",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "1",
    "totalHal": 61,
    "dibaca": 6,
    "rating": 4.6,
    "cover": "https://drive.google.com/thumbnail?id=1PIV-w4Hp48ZZw_HQiLmWBfzrM4hy98d2&sz=w600",
    "file": "https://drive.google.com/file/d/1PIV-w4Hp48ZZw_HQiLmWBfzrM4hy98d2/preview",
    "download": "https://drive.google.com/uc?export=download&id=1PIV-w4Hp48ZZw_HQiLmWBfzrM4hy98d2"
  },
  {
    "id": "15VuG2t55UYAVf8jl8h-RGW_ZPHIlBYue",
    "kode": "BK-028",
    "nama": "Termokimia dan Energi Reaksi",
    "mapel": "Kimia",
    "jenjang": "Paket C",
    "kelas": "Kelas XI",
    "modul": "1",
    "totalHal": 62,
    "dibaca": 15,
    "rating": 4.7,
    "cover": "https://drive.google.com/thumbnail?id=15VuG2t55UYAVf8jl8h-RGW_ZPHIlBYue&sz=w600",
    "file": "https://drive.google.com/file/d/15VuG2t55UYAVf8jl8h-RGW_ZPHIlBYue/preview",
    "download": "https://drive.google.com/uc?export=download&id=15VuG2t55UYAVf8jl8h-RGW_ZPHIlBYue"
  },
  {
    "id": "1XtTrp_pTEaMDCtbnlsxBw798MPbQDG1p",
    "kode": "BK-029",
    "nama": "Kerajinan Bahan Keras Nusantara",
    "mapel": "Prakarya",
    "jenjang": "Paket B",
    "kelas": "Kelas VIII",
    "modul": "1",
    "totalHal": 63,
    "dibaca": 4,
    "rating": 4.8,
    "cover": "https://drive.google.com/thumbnail?id=1XtTrp_pTEaMDCtbnlsxBw798MPbQDG1p&sz=w600",
    "file": "https://drive.google.com/file/d/1XtTrp_pTEaMDCtbnlsxBw798MPbQDG1p/preview",
    "download": "https://drive.google.com/uc?export=download&id=1XtTrp_pTEaMDCtbnlsxBw798MPbQDG1p"
  },
  {
    "id": "1jYXMti5ar5yML4gLTrT_J2M7sQeKKVrs",
    "kode": "BK-030",
    "nama": "Mengenal Seni Rupa Daerah",
    "mapel": "Seni Budaya",
    "jenjang": "Paket A",
    "kelas": "Kelas V",
    "modul": "1",
    "totalHal": 64,
    "dibaca": 11,
    "rating": 4.9,
    "cover": "https://drive.google.com/thumbnail?id=1jYXMti5ar5yML4gLTrT_J2M7sQeKKVrs&sz=w600",
    "file": "https://drive.google.com/file/d/1jYXMti5ar5yML4gLTrT_J2M7sQeKKVrs/preview",
    "download": "https://drive.google.com/uc?export=download&id=1jYXMti5ar5yML4gLTrT_J2M7sQeKKVrs"
  },
  {
    "id": "11SikqeBfYWVjowuBGXy2OiQDgHPF5Kq6",
    "kode": "BK-031",
    "nama": "Kebugaran Jasmani dan Pola Hidup Sehat",
    "mapel": "PJOK",
    "jenjang": "Paket B",
    "kelas": "Kelas IX",
    "modul": "1",
    "totalHal": 35,
    "dibaca": 9,
    "rating": 4.5,
    "cover": "https://drive.google.com/thumbnail?id=11SikqeBfYWVjowuBGXy2OiQDgHPF5Kq6&sz=w600",
    "file": "https://drive.google.com/file/d/11SikqeBfYWVjowuBGXy2OiQDgHPF5Kq6/preview",
    "download": "https://drive.google.com/uc?export=download&id=11SikqeBfYWVjowuBGXy2OiQDgHPF5Kq6"
  },
  {
    "id": "1iZ577HyKwKPbmIJy5WJ0PxSObtkETXjO",
    "kode": "BK-032",
    "nama": "Indahnya Keragaman Budaya Negeriku",
    "mapel": "PPKn",
    "jenjang": "Paket A",
    "kelas": "Kelas IV",
    "modul": "5",
    "totalHal": 36,
    "dibaca": 19,
    "rating": 4.6,
    "cover": "https://drive.google.com/thumbnail?id=1iZ577HyKwKPbmIJy5WJ0PxSObtkETXjO&sz=w600",
    "file": "https://drive.google.com/file/d/1iZ577HyKwKPbmIJy5WJ0PxSObtkETXjO/preview",
    "download": "https://drive.google.com/uc?export=download&id=1iZ577HyKwKPbmIJy5WJ0PxSObtkETXjO"
  },
  {
    "id": "1_GPvdjOliHgA-ZCBHOdICUBuBTwL8ptR",
    "kode": "BK-033",
    "nama": "Kupas Tuntas Karya Sastra",
    "mapel": "Bahasa Indonesia",
    "jenjang": "Paket B",
    "kelas": "Kelas IX",
    "modul": "1",
    "totalHal": 37,
    "dibaca": 20,
    "rating": 4.7,
    "cover": "https://drive.google.com/thumbnail?id=1_GPvdjOliHgA-ZCBHOdICUBuBTwL8ptR&sz=w600",
    "file": "https://drive.google.com/file/d/1_GPvdjOliHgA-ZCBHOdICUBuBTwL8ptR/preview",
    "download": "https://drive.google.com/uc?export=download&id=1_GPvdjOliHgA-ZCBHOdICUBuBTwL8ptR"
  },
  {
    "id": "1J1FwQI-f9SgIE9DkowTpEl8x0zFUFq03",
    "kode": "BK-034",
    "nama": "Bagaimanakah Hewan dan Tumbuhan Berkembang Biak",
    "mapel": "IPA",
    "jenjang": "Paket A",
    "kelas": "Kelas VI",
    "modul": "1",
    "totalHal": 38,
    "dibaca": 15,
    "rating": 4.8,
    "cover": "https://drive.google.com/thumbnail?id=1J1FwQI-f9SgIE9DkowTpEl8x0zFUFq03&sz=w600",
    "file": "https://drive.google.com/file/d/1J1FwQI-f9SgIE9DkowTpEl8x0zFUFq03/preview",
    "download": "https://drive.google.com/uc?export=download&id=1J1FwQI-f9SgIE9DkowTpEl8x0zFUFq03"
  },
  {
    "id": "1qjh9rVaW2nJOAIdLy_b_KD9GcXN6NIC7",
    "kode": "BK-035",
    "nama": "Penerapan Limit dan Turunan Sehari-hari",
    "mapel": "Matematika",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "1",
    "totalHal": 39,
    "dibaca": 3,
    "rating": 4.9,
    "cover": "https://drive.google.com/thumbnail?id=1qjh9rVaW2nJOAIdLy_b_KD9GcXN6NIC7&sz=w600",
    "file": "https://drive.google.com/file/d/1qjh9rVaW2nJOAIdLy_b_KD9GcXN6NIC7/preview",
    "download": "https://drive.google.com/uc?export=download&id=1qjh9rVaW2nJOAIdLy_b_KD9GcXN6NIC7"
  },
  {
    "id": "1V0B-EnripXJF7kBjI4cNynwuy7FcXI33",
    "kode": "BK-036",
    "nama": "Perubahan Sosial",
    "mapel": "Sosiologi",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "3",
    "totalHal": 40,
    "dibaca": 18,
    "rating": 4.5,
    "cover": "https://drive.google.com/thumbnail?id=1V0B-EnripXJF7kBjI4cNynwuy7FcXI33&sz=w600",
    "file": "https://drive.google.com/file/d/1V0B-EnripXJF7kBjI4cNynwuy7FcXI33/preview",
    "download": "https://drive.google.com/uc?export=download&id=1V0B-EnripXJF7kBjI4cNynwuy7FcXI33"
  },
  {
    "id": "1klxLarjDDDdwAFGl1Ww2pQHFuz37ePI7",
    "kode": "BK-037",
    "nama": "Peran Pelaku Ekonomi dalam Kegiatan Pasar",
    "mapel": "Ekonomi",
    "jenjang": "Paket C",
    "kelas": "Kelas XI",
    "modul": "1",
    "totalHal": 41,
    "dibaca": 4,
    "rating": 4.6,
    "cover": "https://drive.google.com/thumbnail?id=1klxLarjDDDdwAFGl1Ww2pQHFuz37ePI7&sz=w600",
    "file": "https://drive.google.com/file/d/1klxLarjDDDdwAFGl1Ww2pQHFuz37ePI7/preview",
    "download": "https://drive.google.com/uc?export=download&id=1klxLarjDDDdwAFGl1Ww2pQHFuz37ePI7"
  },
  {
    "id": "1cJZiFJGcClGvruVtwsRMCdT1Okmr56SQ",
    "kode": "BK-038",
    "nama": "Ragam Gejala Sosial di Masyarakat",
    "mapel": "Sosiologi",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "5",
    "totalHal": 42,
    "dibaca": 8,
    "rating": 4.7,
    "cover": "https://drive.google.com/thumbnail?id=1cJZiFJGcClGvruVtwsRMCdT1Okmr56SQ&sz=w600",
    "file": "https://drive.google.com/file/d/1cJZiFJGcClGvruVtwsRMCdT1Okmr56SQ/preview",
    "download": "https://drive.google.com/uc?export=download&id=1cJZiFJGcClGvruVtwsRMCdT1Okmr56SQ"
  },
  {
    "id": "1MMJuJqTSZxTG53Ofam-QNwfNIvwiIowL",
    "kode": "BK-039",
    "nama": "Energi dan Perubahannya",
    "mapel": "IPA",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "1",
    "totalHal": 43,
    "dibaca": 18,
    "rating": 4.8,
    "cover": "https://drive.google.com/thumbnail?id=1MMJuJqTSZxTG53Ofam-QNwfNIvwiIowL&sz=w600",
    "file": "https://drive.google.com/file/d/1MMJuJqTSZxTG53Ofam-QNwfNIvwiIowL/preview",
    "download": "https://drive.google.com/uc?export=download&id=1MMJuJqTSZxTG53Ofam-QNwfNIvwiIowL"
  },
  {
    "id": "176ZRohQm0rVvUJ_Nv3IaTKiPT3H5HWpt",
    "kode": "BK-040",
    "nama": "cb)>> 339 0 340 62 341 149 342 267 <</Cou",
    "mapel": "Matematika",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "10",
    "totalHal": 44,
    "dibaca": 14,
    "rating": 4.9,
    "cover": "https://drive.google.com/thumbnail?id=176ZRohQm0rVvUJ_Nv3IaTKiPT3H5HWpt&sz=w600",
    "file": "https://drive.google.com/file/d/176ZRohQm0rVvUJ_Nv3IaTKiPT3H5HWpt/preview",
    "download": "https://drive.google.com/uc?export=download&id=176ZRohQm0rVvUJ_Nv3IaTKiPT3H5HWpt"
  },
  {
    "id": "1zYWTe489bRHdRHIcfZtOmIakgFxbKZfZ",
    "kode": "BK-041",
    "nama": "Dinamika Litosfer dan Dampaknya Terhadap Kehidupan",
    "mapel": "Geografi",
    "jenjang": "Paket C",
    "kelas": "Kelas XI",
    "modul": "1",
    "totalHal": 45,
    "dibaca": 10,
    "rating": 4.5,
    "cover": "https://drive.google.com/thumbnail?id=1zYWTe489bRHdRHIcfZtOmIakgFxbKZfZ&sz=w600",
    "file": "https://drive.google.com/file/d/1zYWTe489bRHdRHIcfZtOmIakgFxbKZfZ/preview",
    "download": "https://drive.google.com/uc?export=download&id=1zYWTe489bRHdRHIcfZtOmIakgFxbKZfZ"
  },
  {
    "id": "12mZAV5yDJWlZP1Bi9W-ca-2E1tyWgLyt",
    "kode": "BK-042",
    "nama": "Pertumbuhan dan Perkembangan Makhluk Hidup",
    "mapel": "Biologi",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "1",
    "totalHal": 46,
    "dibaca": 15,
    "rating": 4.6,
    "cover": "https://drive.google.com/thumbnail?id=12mZAV5yDJWlZP1Bi9W-ca-2E1tyWgLyt&sz=w600",
    "file": "https://drive.google.com/file/d/12mZAV5yDJWlZP1Bi9W-ca-2E1tyWgLyt/preview",
    "download": "https://drive.google.com/uc?export=download&id=12mZAV5yDJWlZP1Bi9W-ca-2E1tyWgLyt"
  },
  {
    "id": "1EvSm6Adq8Zs_hJ9rUZp3hcHgbrS8ODvk",
    "kode": "BK-043",
    "nama": ")63.5(............................................",
    "mapel": "Ekonomi",
    "jenjang": "Paket C",
    "kelas": "Kelas 4",
    "modul": "1",
    "totalHal": 47,
    "dibaca": 20,
    "rating": 4.7,
    "cover": "https://drive.google.com/thumbnail?id=1EvSm6Adq8Zs_hJ9rUZp3hcHgbrS8ODvk&sz=w600",
    "file": "https://drive.google.com/file/d/1EvSm6Adq8Zs_hJ9rUZp3hcHgbrS8ODvk/preview",
    "download": "https://drive.google.com/uc?export=download&id=1EvSm6Adq8Zs_hJ9rUZp3hcHgbrS8ODvk"
  },
  {
    "id": "1MXlTuZdHIGje4-W5oxAJcFkbElBvOswO",
    "kode": "BK-044",
    "nama": "Termokimia dan Energi Reaksi",
    "mapel": "Kimia",
    "jenjang": "Paket C",
    "kelas": "Kelas XI",
    "modul": "1",
    "totalHal": 48,
    "dibaca": 18,
    "rating": 4.8,
    "cover": "https://drive.google.com/thumbnail?id=1MXlTuZdHIGje4-W5oxAJcFkbElBvOswO&sz=w600",
    "file": "https://drive.google.com/file/d/1MXlTuZdHIGje4-W5oxAJcFkbElBvOswO/preview",
    "download": "https://drive.google.com/uc?export=download&id=1MXlTuZdHIGje4-W5oxAJcFkbElBvOswO"
  },
  {
    "id": "11bBgDCu0UARA1kxan-kjcIMpJfFzvGzn",
    "kode": "BK-045",
    "nama": "cb)>> 235 0 236 62 237 149 238 264 <</Cou",
    "mapel": "Matematika",
    "jenjang": "Paket C",
    "kelas": "Kelas XII",
    "modul": "8",
    "totalHal": 49,
    "dibaca": 1,
    "rating": 4.9,
    "cover": "https://drive.google.com/thumbnail?id=11bBgDCu0UARA1kxan-kjcIMpJfFzvGzn&sz=w600",
    "file": "https://drive.google.com/file/d/11bBgDCu0UARA1kxan-kjcIMpJfFzvGzn/preview",
    "download": "https://drive.google.com/uc?export=download&id=11bBgDCu0UARA1kxan-kjcIMpJfFzvGzn"
  },
  {
    "id": "1u0VHC-UadeLewcNPwVblEO360Ev1lkJg",
    "kode": "BK-046",
    "nama": "Mengenal Seni Rupa Daerah",
    "mapel": "Seni Budaya",
    "jenjang": "Paket A",
    "kelas": "Kelas V",
    "modul": "1",
    "totalHal": 50,
    "dibaca": 1,
    "rating": 4.5,
    "cover": "https://drive.google.com/thumbnail?id=1u0VHC-UadeLewcNPwVblEO360Ev1lkJg&sz=w600",
    "file": "https://drive.google.com/file/d/1u0VHC-UadeLewcNPwVblEO360Ev1lkJg/preview",
    "download": "https://drive.google.com/uc?export=download&id=1u0VHC-UadeLewcNPwVblEO360Ev1lkJg"
  },
  {
    "id": "1X6puk5FU29f9swclhiZulbnUGNUpgrOV",
    "kode": "BK-047",
    "nama": "Kebugaran Jasmani dan Pola Hidup Sehat",
    "mapel": "PJOK",
    "jenjang": "Paket B",
    "kelas": "Kelas IX",
    "modul": "1",
    "totalHal": 51,
    "dibaca": 6,
    "rating": 4.6,
    "cover": "https://drive.google.com/thumbnail?id=1X6puk5FU29f9swclhiZulbnUGNUpgrOV&sz=w600",
    "file": "https://drive.google.com/file/d/1X6puk5FU29f9swclhiZulbnUGNUpgrOV/preview",
    "download": "https://drive.google.com/uc?export=download&id=1X6puk5FU29f9swclhiZulbnUGNUpgrOV"
  },
  {
    "id": "1NVCbMd-r20j974JB-E1pVebyhXmvk9SR",
    "kode": "BK-048",
    "nama": "Indahnya Keragaman Budaya Negeriku",
    "mapel": "PPKn",
    "jenjang": "Paket A",
    "kelas": "Kelas IV",
    "modul": "1",
    "totalHal": 52,
    "dibaca": 6,
    "rating": 4.7,
    "cover": "https://drive.google.com/thumbnail?id=1NVCbMd-r20j974JB-E1pVebyhXmvk9SR&sz=w600",
    "file": "https://drive.google.com/file/d/1NVCbMd-r20j974JB-E1pVebyhXmvk9SR/preview",
    "download": "https://drive.google.com/uc?export=download&id=1NVCbMd-r20j974JB-E1pVebyhXmvk9SR"
  },
  {
    "id": "1eWlE16lzk7Y0B3HOWL75b0Ew3zuLq_LV",
    "kode": "BK-049",
    "nama": "Kupas Tuntas Karya Sastra",
    "mapel": "Bahasa Indonesia",
    "jenjang": "Paket B",
    "kelas": "Kelas IX",
    "modul": "1",
    "totalHal": 53,
    "dibaca": 6,
    "rating": 4.8,
    "cover": "https://drive.google.com/thumbnail?id=1eWlE16lzk7Y0B3HOWL75b0Ew3zuLq_LV&sz=w600",
    "file": "https://drive.google.com/file/d/1eWlE16lzk7Y0B3HOWL75b0Ew3zuLq_LV/preview",
    "download": "https://drive.google.com/uc?export=download&id=1eWlE16lzk7Y0B3HOWL75b0Ew3zuLq_LV"
  },
  {
    "id": "1s0y5DDqIO2reIm2ghIoiep4chDK29Y7a",
    "kode": "BK-050",
    "nama": "Bagaimanakah Hewan dan Tumbuhan Berkembang Biak",
    "mapel": "IPA",
    "jenjang": "Paket A",
    "kelas": "Kelas VI",
    "modul": "1",
    "totalHal": 54,
    "dibaca": 2,
    "rating": 4.9,
    "cover": "https://drive.google.com/thumbnail?id=1s0y5DDqIO2reIm2ghIoiep4chDK29Y7a&sz=w600",
    "file": "https://drive.google.com/file/d/1s0y5DDqIO2reIm2ghIoiep4chDK29Y7a/preview",
    "download": "https://drive.google.com/uc?export=download&id=1s0y5DDqIO2reIm2ghIoiep4chDK29Y7a"
  }
];

let sesiBelajarLog = [];
let ujianHasilList = [];

// State Aktif Sesi Belajar
let activeBelajarSession = null;
let liveTimerInterval = null;

function loadBukuData() {
  try {
    const saved = localStorage.getItem('ppdb_buku_list');
    if (saved) {
      let parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 10) {
        // Perbaiki jika ada item dengan judul corrupted dari versi lama
        let hasCorrupted = false;
        parsed = parsed.map(item => {
          if (item.kode === 'BK-016' || (item.nama && item.nama.includes('cb)>>'))) {
            hasCorrupted = true;
            return { ...item, nama: 'Matematika Peminatan Paket C' };
          }
          return item;
        });
        bukuList = parsed;
        if (hasCorrupted) {
          localStorage.setItem('ppdb_buku_list', JSON.stringify(bukuList));
        }
      } else {
        localStorage.setItem('ppdb_buku_list', JSON.stringify(bukuList));
      }
    } else {
      localStorage.setItem('ppdb_buku_list', JSON.stringify(bukuList));
    }
  } catch (e) { }

  try {
    const savedLogs = localStorage.getItem('ppdb_belajar_log');
    if (savedLogs) sesiBelajarLog = JSON.parse(savedLogs);
  } catch (e) { }

  try {
    const savedUjian = localStorage.getItem('ppdb_ujian_list');
    if (savedUjian) ujianHasilList = JSON.parse(savedUjian);
  } catch (e) { }

  renderBukuPopuler();
  renderBukuGrid();
  renderBelajarLogTable();
  updateBelajarStats();
  renderUjianTable();
  populateUjianSelectOptions();
}

function onJenjangFilterChange() {
  const jenjang = document.getElementById('filter-buku-jenjang')?.value || '';
  const selKelas = document.getElementById('filter-buku-kelas');
  if (selKelas) {
    if (jenjang === 'Paket A') {
      selKelas.innerHTML = `
        <option value="">Semua Kelas Paket A</option>
        <option value="Kelas IV">Kelas IV</option>
        <option value="Kelas V">Kelas V</option>
        <option value="Kelas VI">Kelas VI</option>
      `;
    } else if (jenjang === 'Paket B') {
      selKelas.innerHTML = `
        <option value="">Semua Kelas Paket B</option>
        <option value="Kelas VII">Kelas VII</option>
        <option value="Kelas VIII">Kelas VIII</option>
        <option value="Kelas IX">Kelas IX</option>
      `;
    } else if (jenjang === 'Paket C') {
      selKelas.innerHTML = `
        <option value="">Semua Kelas Paket C</option>
        <option value="Kelas X">Kelas X</option>
        <option value="Kelas XI">Kelas XI</option>
        <option value="Kelas XII">Kelas XII</option>
      `;
    } else {
      selKelas.innerHTML = `
        <option value="">Semua Kelas</option>
        <option value="Kelas IV">Kelas IV</option>
        <option value="Kelas V">Kelas V</option>
        <option value="Kelas VI">Kelas VI</option>
        <option value="Kelas VII">Kelas VII</option>
        <option value="Kelas VIII">Kelas VIII</option>
        <option value="Kelas IX">Kelas IX</option>
        <option value="Kelas X">Kelas X</option>
        <option value="Kelas XI">Kelas XI</option>
        <option value="Kelas XII">Kelas XII</option>
      `;
    }
  }
  filterBukuGrid();
}

function updateBelajarStats() {
  const elTotalBuku = document.getElementById('stat-total-buku');
  const elSiswaAktif = document.getElementById('stat-siswa-aktif-belajar');
  const elJamBelajar = document.getElementById('stat-jam-belajar');

  if (elTotalBuku) elTotalBuku.textContent = bukuList.length;

  // Hitung siswa aktif belajar hari ini
  const todayStr = new Date().toLocaleDateString('id-ID');
  const todayLogs = sesiBelajarLog.filter(x => x.tanggal === todayStr);
  const uniqueStudents = new Set(todayLogs.map(x => x.namaSiswa));
  if (elSiswaAktif) elSiswaAktif.textContent = uniqueStudents.size;

  // Hitung total jam belajar
  const totalDetik = sesiBelajarLog.reduce((acc, curr) => acc + (curr.durasiDetik || 0), 0);
  const totalJam = (totalDetik / 3600).toFixed(1);
  if (elJamBelajar) elJamBelajar.textContent = `${totalJam} Jam`;
}

function filterBukuGrid() {
  const query = (document.getElementById('search-buku')?.value || '').toLowerCase().trim();
  const jenjang = document.getElementById('filter-buku-jenjang')?.value || '';
  const kelas = document.getElementById('filter-buku-kelas')?.value || '';
  const mapel = document.getElementById('filter-buku-mapel')?.value || '';

  const filtered = bukuList.filter(b => {
    const matchQuery = !query ||
      b.nama.toLowerCase().includes(query) ||
      (b.mapel || b.kategori || '').toLowerCase().includes(query) ||
      (b.kelas || '').toLowerCase().includes(query) ||
      (b.keterangan || '').toLowerCase().includes(query);
    const matchJenjang = !jenjang || b.jenjang === jenjang;
    const matchKelas = !kelas || (b.kelas && b.kelas.includes(kelas));
    const matchMapel = !mapel || (b.mapel === mapel || b.kategori === mapel);
    return matchQuery && matchJenjang && matchKelas && matchMapel;
  });

  const badgeTotal = document.getElementById('badge-total-katalog');
  if (badgeTotal) badgeTotal.textContent = `${filtered.length} Buku`;

  renderBukuGrid(filtered);
}

// Render Seksi Buku Paling Banyak Dibaca (Ala MyAura)
function renderBukuPopuler() {
  const grid = document.getElementById('grid-buku-populer');
  if (!grid) return;

  // Urutkan buku berdasarkan jumlah pembaca (dibaca) descending, ambil 4 teratas
  const sorted = [...bukuList]
    .filter(b => (b.dibaca || 0) > 0)
    .sort((a, b) => (b.dibaca || 0) - (a.dibaca || 0))
    .slice(0, 4);

  if (sorted.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: var(--text-muted); background: var(--surface-color); border-radius: var(--radius); border: 1px dashed var(--border-color); font-size: 13px;">Belum ada data buku yang dibaca siswa.</div>';
    return;
  }

  const isPetugas = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin' || currentUser.role === 'Guru');

  grid.innerHTML = sorted.map((b, idx) => {
    const rankColors = ['#f59e0b', '#64748b', '#b45309', '#0284c7'];
    const rankColor = rankColors[idx] || '#64748b';
    const coverHtml = b.cover
      ? `<img src="${b.cover}" alt="${b.nama}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentNode.innerHTML='<i data-lucide=\\'book-open\\' class=\\'book-cover-icon\\'></i>'; if(window.lucide) window.lucide.createIcons();">`
      : `<i data-lucide="book-open" class="book-cover-icon"></i>`;

    return `
      <div class="book-card" style="border: 1.5px solid ${idx === 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-color)'}; position: relative;">
        <div style="position: absolute; top: 10px; left: 10px; z-index: 5; background: ${rankColor}; color: #fff; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
          #${idx + 1} Terpopuler
        </div>
        <div class="book-cover" style="height: 150px; background: #1e293b; overflow: hidden; position: relative;">
          ${coverHtml}
          <span class="book-badge-program" style="z-index: 4;">${b.jenjang}</span>
        </div>
        <div class="book-info-body">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 11px; color: var(--primary-color); font-weight: 600; text-transform: uppercase;">${b.mapel || b.kategori || 'Umum'}</span>
            <span style="font-size: 11px; color: var(--text-muted); background: var(--surface-hover); padding: 1px 6px; border-radius: 4px;">${b.kelas || 'Kesetaraan'}</span>
          </div>
          <div class="book-title" title="${b.nama}" style="font-size: 13.5px; margin-bottom: 6px;">${b.nama}</div>
          <div class="book-desc">${b.keterangan || `Modul ${b.modul || 1} resmi Kemdikbud pembelajaran kesetaraan ${b.jenjang}.`}</div>
          <div class="book-meta">
            <span>📄 ${b.totalHal || 35} Halaman</span>
            <span style="color: #d97706; font-weight: 600;">🔥 ${b.dibaca || 0}x Dibaca</span>
          </div>
          <div style="display: flex; gap: 8px; margin-top: auto;">
            <button class="btn btn-primary" style="flex: 1; justify-content: center; font-size: 12.5px; padding: 7px 12px;" onclick="mulaiBelajarBuku('${b.id}')">
              <i data-lucide="play-circle" style="width: 14px; height: 14px;"></i> Baca Sekarang
            </button>
            ${isPetugas ? `
              <button class="btn btn-icon" onclick="showEditBukuModal('${b.id}')" title="Edit Buku">
                <i data-lucide="pencil" style="width: 13px; height: 13px;"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function renderBukuGrid(data) {
  const grid = document.getElementById('grid-buku-belajar');
  if (!grid) return;

  const list = data || bukuList;
  if (list.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); background: var(--surface-color); border-radius: var(--radius); border: 1px dashed var(--border-color);">Belum ada modul / buku pelajaran yang sesuai filter pencarian atau kelas yang dipilih.</div>';
    return;
  }

  const isPetugas = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin' || currentUser.role === 'Guru');

  grid.innerHTML = list.map(b => {
    const coverHtml = b.cover
      ? `<img src="${b.cover}" alt="${b.nama}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentNode.innerHTML='<i data-lucide=\\'book-open\\' class=\\'book-cover-icon\\'></i>'; if(window.lucide) window.lucide.createIcons();">`
      : `<i data-lucide="book-open" class="book-cover-icon"></i>`;

    return `
      <div class="book-card">
        <div class="book-cover" style="height: 150px; background: #1e293b; overflow: hidden; position: relative;">
          ${coverHtml}
          <span class="book-badge-program" style="z-index: 4;">${b.jenjang}</span>
        </div>
        <div class="book-info-body">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 11px; color: var(--primary-color); font-weight: 600; text-transform: uppercase;">${b.mapel || b.kategori || 'Umum'}</span>
            <span style="font-size: 11px; color: var(--text-muted); background: var(--surface-hover); padding: 1px 6px; border-radius: 4px;">${b.kelas || 'Kesetaraan'}</span>
          </div>
          <div class="book-title" title="${b.nama}" style="font-size: 13.5px; margin-bottom: 6px;">${b.nama}</div>
          <div class="book-desc">${b.keterangan || `Modul ${b.modul || 1} pendidikan kesetaraan ${b.jenjang} Kemendikbud.`}</div>
          <div class="book-meta">
            <span>📄 ${b.totalHal || 35} Halaman</span>
            <span>👁️ ${b.dibaca || 0}x Dibaca</span>
          </div>
          <div style="display: flex; gap: 8px; margin-top: auto;">
            <button class="btn btn-primary" style="flex: 1; justify-content: center; font-size: 12.5px; padding: 7px 12px;" onclick="mulaiBelajarBuku('${b.id}')">
              <i data-lucide="play-circle" style="width: 14px; height: 14px;"></i> Mulai Belajar
            </button>
            ${isPetugas ? `
              <button class="btn btn-icon" onclick="showEditBukuModal('${b.id}')" title="Edit Buku">
                <i data-lucide="pencil" style="width: 14px; height: 14px;"></i>
              </button>
              <button class="btn btn-icon btn-danger-text" onclick="hapusBuku('${b.id}')" title="Hapus Buku">
                <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// ==================== LIVE BELAJAR, ABSENSI, & READER ====================

function mulaiBelajarBuku(bukuId) {
  const book = bukuList.find(b => b.id === bukuId);
  if (!book) return;

  // Nama siswa yang belajar
  const studentName = currentUser ? currentUser.nama : "Peserta Didik Mandiri";

  // Buka dialog konfirmasi presensi belajar (Absen Belajar Otomatis)
  Swal.fire({
    title: 'Mulai Sesi Belajar Mandiri?',
    html: `
      <div style="text-align: left; font-size: 13.5px; line-height: 1.5; color: var(--text-color);">
        <p>Halo <b>${studentName}</b>, sistem akan mencatat kehadiran dan absensi belajar Anda secara otomatis:</p>
        <div style="background: var(--surface-2); padding: 12px; border-radius: 8px; margin: 10px 0; border: 1px solid var(--border-color);">
          <div>📚 <b>Buku:</b> ${book.nama}</div>
          <div style="margin-top: 4px;">🎯 <b>Program:</b> ${book.jenjang} - ${book.kategori}</div>
          <div style="margin-top: 4px;">⏱️ <b>Pelacak:</b> Timer durasi dan halaman akan direkam ke log guru.</div>
        </div>
        <p style="margin: 0; font-size: 12px; color: var(--text-muted);">Setelah membaca modul, Anda dapat langsung menuntaskan ke sesi Ujian & Penilaian.</p>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ya, Mulai Belajar Sekarang 📖',
    cancelButtonText: 'Nanti Dulu',
    confirmButtonColor: 'var(--primary-color)'
  }).then(res => {
    if (res.isConfirmed) {
      launchReaderSession(book, studentName);
    }
  });
}

// Variable Global PDF Reader
let currentPdfDoc = null;
let currentPdfPage = 1;
let currentPdfScale = 1.0;
let isPdfRendering = false;
let pendingPdfPage = null;

function saveActiveBelajarSessionToStorage() {
  if (activeBelajarSession) {
    try { localStorage.setItem('ppdb_active_belajar', JSON.stringify(activeBelajarSession)); } catch (e) { }
  } else {
    try { localStorage.removeItem('ppdb_active_belajar'); } catch (e) { }
  }
}

function launchReaderSession(book, studentName, initialPage = null, isResumed = false) {
  // Update view count hanya jika sesi baru
  if (!isResumed) {
    book.dibaca = (book.dibaca || 0) + 1;
    saveBukuListToStorage();
    renderBukuPopuler();
    renderBukuGrid();
  }

  const startPage = initialPage ? parseInt(initialPage, 10) : 1;

  // Inisialisasi Sesi Belajar (atau lanjutkan jika restore)
  if (!activeBelajarSession || !isResumed) {
    activeBelajarSession = {
      sessionId: 'SES-' + Date.now(),
      bukuId: book.id,
      bukuJudul: book.nama,
      namaSiswa: studentName,
      tanggal: new Date().toLocaleDateString('id-ID'),
      jamMulai: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      halamanAwal: startPage,
      halamanSekarang: startPage,
      totalHalaman: book.totalHal || 28,
      detikMulai: Date.now(),
      durasiDetik: 0,
      status: 'Aktif Belajar'
    };
  } else {
    // Sesi dilanjutkan (sesudah reload / error browser)
    activeBelajarSession.halamanSekarang = startPage;
    activeBelajarSession.detikMulai = Date.now() - ((activeBelajarSession.durasiDetik || 0) * 1000);
  }

  saveActiveBelajarSessionToStorage();

  // Setup UI Modal Reader
  document.getElementById('reader-book-title').textContent = book.nama;
  document.getElementById('reader-book-info').textContent = `${book.jenjang} · ${book.kelas || ''} · ${book.mapel || book.kategori || ''}`;
  document.getElementById('reader-page-input').value = String(startPage);
  document.getElementById('reader-total-page').textContent = book.totalHal || 28;
  document.getElementById('reader-active-student').textContent = studentName;
  updateZoomDisplay(1.0);

  // Buka modal reader
  const modalReader = document.getElementById('modal-reader');
  if (modalReader) modalReader.classList.remove('hidden');

  // Load PDF file via Native PDF.js Engine pada halaman startPage
  loadPdfDocument(book, startPage);

  // Start Live Timer
  startLiveTimer();

  // Rekam status awal ke log aktivitas presensi belajar jika bukan resume
  if (!isResumed) {
    catatLogBelajarBaru(activeBelajarSession);

    // 🔔 Kirim Notifikasi Push ke Admin & Super Admin saat siswa mulai belajar
    if (typeof sendAppPushNotification === 'function') {
      sendAppPushNotification({
        title: 'Aktivitas Belajar Dimulai 📖',
        body: `Siswa "${studentName}" baru saja mulai membaca materi: ${book.nama} (${book.jenjang} - ${book.kategori}).`,
        url: '/portal',
        targetRole: 'Admin',
        tag: 'mulai-belajar-' + book.id
      });
    }
  } else {
    updateLogBelajarSession(activeBelajarSession);
  }
}

// ==================== ENGINE PDF.JS NATIVE VIEWER ====================

async function loadPdfDocument(book, startPage = 1) {
  const spinner = document.getElementById('reader-loading-spinner');
  const canvas = document.getElementById('pdf-page-canvas');
  const textViewerEl = document.getElementById('reader-text-viewer');
  const renderWrapper = document.getElementById('pdf-render-wrapper');
  const iframeWrapper = document.getElementById('reader-iframe-wrapper');
  const driveIframe = document.getElementById('reader-drive-iframe');

  // Cari link preview Google Drive resmi
  let drivePreviewUrl = '';
  if (book.file && book.file.includes('drive.google.com')) {
    const driveMatch = book.file.match(/\/d\/([a-zA-Z0-9_-]+)/) || book.file.match(/id=([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      drivePreviewUrl = `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    } else {
      drivePreviewUrl = book.file;
    }
  } else if (book.id && (book.id.length > 20 || !book.id.startsWith('BK-'))) {
    drivePreviewUrl = `https://drive.google.com/file/d/${book.id}/preview`;
  }

  // Tautkan tombol eksternal Google Drive di header jika siswa ingin membuka di tab/aplikasi Google Drive langsung
  const btnExternal = document.getElementById('btn-reader-external');
  const iframeTip = document.getElementById('reader-iframe-tip');
  if (btnExternal) {
    if (drivePreviewUrl) {
      btnExternal.href = drivePreviewUrl.replace('/preview', '/view');
      btnExternal.style.display = 'inline-flex';
    } else {
      btnExternal.style.display = 'none';
    }
  }

  // Tentukan URL PDF untuk mode Native PDF.js Reader
  let pdfUrl = '';
  if (book.id && (book.id.length > 20 || !book.id.startsWith('BK-'))) {
    pdfUrl = `https://drive.usercontent.google.com/download?id=${book.id}&export=download`;
  } else if (book.file && book.file.startsWith('http')) {
    const driveMatch = book.file.match(/\/d\/([a-zA-Z0-9_-]+)/) || book.file.match(/id=([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      pdfUrl = `https://drive.usercontent.google.com/download?id=${driveMatch[1]}&export=download`;
    } else {
      pdfUrl = book.file;
    }
  }

  if (iframeTip) iframeTip.style.display = 'none';

  // Jika tidak ada URL PDF sama sekali, langsung ke text / iframe
  if (!pdfUrl) {
    fallbackToTextViewer(book);
    return;
  }

  // Tampilkan container mode baca PDF Native (Canvas)
  if (spinner) spinner.style.display = 'flex';
  if (canvas) canvas.style.display = 'block';
  if (renderWrapper) renderWrapper.style.display = 'flex';
  if (textViewerEl) textViewerEl.style.display = 'none';
  if (iframeWrapper) iframeWrapper.style.display = 'none';

  // Pastikan PDF.js library tersedia
  if (typeof pdfjsLib === 'undefined') {
    console.warn('PDF.js belum termuat, mencoba load ulang CDN...');
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    } catch (e) { }
  }

  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    try {
      // Timeout 8 detik untuk loading PDF native; jika jaringan sangat lambat, alihkan ke fallback preview
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('PDF loading timeout')), 8000));

      const loadingTask = pdfjsLib.getDocument({
        url: pdfUrl,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });

      Promise.race([loadingTask.promise, timeoutPromise]).then(pdf => {
        currentPdfDoc = pdf;
        const total = pdf.numPages;
        const safePage = Math.max(1, Math.min(total, startPage));
        currentPdfPage = safePage;

        if (activeBelajarSession) {
          activeBelajarSession.totalHalaman = total;
          activeBelajarSession.halamanSekarang = safePage;
          saveActiveBelajarSessionToStorage();
        }

        document.getElementById('reader-total-page').textContent = total;
        document.getElementById('reader-page-input').max = total;
        document.getElementById('reader-page-input').value = safePage;

        // Auto scale: sesuaikan lebar layar (HP = fit width)
        calculateInitialScale();
        renderCurrentPdfPage();
      }).catch(err => {
        console.warn('Menggunakan fallback Drive preview:', err.message);
        fallbackToTextViewer(book);
      });
    } catch (err) {
      console.error('PDF.js init error:', err);
      fallbackToTextViewer(book);
    }
  } else {
    fallbackToTextViewer(book);
  }
}

function calculateInitialScale() {
  const container = document.getElementById('reader-viewport-container');
  const screenWidth = container ? container.clientWidth : window.innerWidth;
  if (screenWidth <= 768) {
    // Di HP, sesuaikan skala agar memenuhi lebar layar HP dengan padding minimal
    currentPdfScale = Math.max(0.65, (screenWidth - 24) / 595); // 595 adalah standard A4 pt
  } else {
    currentPdfScale = Math.min(1.35, (screenWidth - 60) / 750);
  }
  updateZoomDisplay(currentPdfScale);
}

function fallbackToTextViewer(book) {
  const spinner = document.getElementById('reader-loading-spinner');
  const canvas = document.getElementById('pdf-page-canvas');
  const textViewerEl = document.getElementById('reader-text-viewer');
  const iframeWrapper = document.getElementById('reader-iframe-wrapper');
  const driveIframe = document.getElementById('reader-drive-iframe');

  if (spinner) spinner.style.display = 'none';
  if (canvas) canvas.style.display = 'none';

  // 1. Jika buku memiliki link Google Drive atau ID file Drive, tampilkan preview Google Drive langsung (sangat responsif & stabil di HP)
  let drivePreviewUrl = '';
  if (book.file && book.file.includes('drive.google.com')) {
    const driveMatch = book.file.match(/\/d\/([a-zA-Z0-9_-]+)/) || book.file.match(/id=([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      drivePreviewUrl = `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    } else {
      drivePreviewUrl = book.file;
    }
  } else if (book.id && (book.id.length > 20 || !book.id.startsWith('BK-'))) {
    drivePreviewUrl = `https://drive.google.com/file/d/${book.id}/preview`;
  }

  if (drivePreviewUrl && iframeWrapper && driveIframe) {
    if (textViewerEl) textViewerEl.style.display = 'none';
    iframeWrapper.style.display = 'block';
    if (driveIframe.src !== drivePreviewUrl) {
      driveIframe.src = drivePreviewUrl;
    }
    return;
  }

  // 2. Jika tidak ada link Drive, tampilkan Text Bab Pelajaran interaktif
  if (iframeWrapper) iframeWrapper.style.display = 'none';
  if (textViewerEl) {
    textViewerEl.style.display = 'block';
    renderBookChapterContent(document.getElementById('reader-chapter-content'), book, activeBelajarSession ? activeBelajarSession.halamanSekarang : 1);
  }
}

function renderCurrentPdfPage() {
  if (!currentPdfDoc) return;
  isPdfRendering = true;

  const spinner = document.getElementById('reader-loading-spinner');
  if (spinner) spinner.style.display = 'flex';

  currentPdfDoc.getPage(currentPdfPage).then(page => {
    const canvas = document.getElementById('pdf-page-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Gunakan pixelRatio untuk hasil render yang tajam di layar Retina / HP
    const pixelRatio = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: currentPdfScale * pixelRatio });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / pixelRatio}px`;
    canvas.style.height = `${viewport.height / pixelRatio}px`;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    const renderTask = page.render(renderContext);
    renderTask.promise.then(() => {
      isPdfRendering = false;
      if (spinner) spinner.style.display = 'none';

      // Update button state (disable jika di ujung)
      const btnPrev = document.getElementById('btn-reader-prev');
      const btnNext = document.getElementById('btn-reader-next');
      if (btnPrev) btnPrev.disabled = (currentPdfPage <= 1);
      if (btnNext) btnNext.disabled = (currentPdfPage >= currentPdfDoc.numPages);

      // Gulir ke atas viewport container setiap ganti halaman
      const container = document.getElementById('reader-viewport-container');
      if (container) container.scrollTo({ top: 0, behavior: 'smooth' });

      if (pendingPdfPage !== null) {
        currentPdfPage = pendingPdfPage;
        pendingPdfPage = null;
        renderCurrentPdfPage();
      }
    });
  }).catch(err => {
    console.error('Page render error:', err);
    isPdfRendering = false;
    if (spinner) spinner.style.display = 'none';
  });
}

function queueRenderPage(num) {
  if (isPdfRendering) {
    pendingPdfPage = num;
  } else {
    currentPdfPage = num;
    renderCurrentPdfPage();
  }
}

// Navigasi Halaman Buku (Next / Prev)
function navigasiHalamanBuku(step) {
  if (!activeBelajarSession) return;

  const iframeWrapper = document.getElementById('reader-iframe-wrapper');
  const isIframeMode = iframeWrapper && iframeWrapper.style.display !== 'none';

  if (currentPdfDoc) {
    const total = currentPdfDoc.numPages;
    const nextPg = currentPdfPage + step;
    if (nextPg < 1 || nextPg > total) return;

    currentPdfPage = nextPg;
    activeBelajarSession.halamanSekarang = currentPdfPage;

    document.getElementById('reader-page-input').value = currentPdfPage;
    queueRenderPage(currentPdfPage);
  } else if (isIframeMode) {
    // Mode Google Drive Iframe: Perbarui progress membaca siswa di input & log belajar
    const total = activeBelajarSession.totalHalaman || 48;
    const current = activeBelajarSession.halamanSekarang || 1;
    const nextPg = Math.max(1, Math.min(total, current + step));
    activeBelajarSession.halamanSekarang = nextPg;
    document.getElementById('reader-page-input').value = nextPg;
  } else {
    // Fallback jika mode teks
    const newPage = activeBelajarSession.halamanSekarang + step;
    if (newPage < 1 || newPage > activeBelajarSession.totalHalaman) return;

    activeBelajarSession.halamanSekarang = newPage;
    document.getElementById('reader-page-input').value = newPage;

    const book = bukuList.find(b => b.id === activeBelajarSession.bukuId);
    const chapterContentEl = document.getElementById('reader-chapter-content');
    if (book && chapterContentEl) {
      renderBookChapterContent(chapterContentEl, book, newPage);
    }
  }

  // Update Log Belajar & Auto-save Session
  updateLogBelajarSession(activeBelajarSession);
  saveActiveBelajarSessionToStorage();
}

// Lompat ke Halaman tertentu melalui input
function lompatHalamanBuku(val) {
  const target = parseInt(val, 10);
  if (isNaN(target)) return;

  const total = currentPdfDoc ? currentPdfDoc.numPages : (activeBelajarSession?.totalHalaman || 48);
  const clamped = Math.max(1, Math.min(total, target));

  if (activeBelajarSession) {
    activeBelajarSession.halamanSekarang = clamped;
  }
  document.getElementById('reader-page-input').value = clamped;

  if (currentPdfDoc) {
    currentPdfPage = clamped;
    queueRenderPage(clamped);
  } else {
    const book = bukuList.find(b => b.id === activeBelajarSession?.bukuId);
    const chapterContentEl = document.getElementById('reader-chapter-content');
    if (book && chapterContentEl) {
      renderBookChapterContent(chapterContentEl, book, clamped);
    }
  }
  updateLogBelajarSession(activeBelajarSession);
  saveActiveBelajarSessionToStorage();
}

// Zoom In / Out Handlers
function zoomBuku(delta) {
  currentPdfScale = Math.max(0.4, Math.min(3.0, currentPdfScale + delta));
  updateZoomDisplay(currentPdfScale);
  if (currentPdfDoc) {
    renderCurrentPdfPage();
  }
}

function zoomFitWidth() {
  calculateInitialScale();
  if (currentPdfDoc) {
    renderCurrentPdfPage();
  }
}

function updateZoomDisplay(scale) {
  const el = document.getElementById('reader-zoom-level');
  if (el) el.textContent = `${Math.round(scale * 100)}%`;
}

function renderBookChapterContent(container, book, pageNum) {
  container.innerHTML = `
    <div style="max-width: 680px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 8px; margin-bottom: 20px;">
        <span style="font-size: 12px; font-weight: 700; color: var(--primary-color); text-transform: uppercase;">MODUL PEMBELAJARAN PKBM AURA ANUGERAH</span>
        <span style="font-size: 12px; color: var(--text-muted);">Hal. ${pageNum} / ${book.totalHal || 30}</span>
      </div>

      <h2 style="font-size: 20px; font-weight: 700; color: var(--text-color); margin-bottom: 12px;">Bab ${pageNum}: Pengantar & Pemahaman Konsep ${book.mapel || book.kategori || ''}</h2>
      
      <p style="margin-bottom: 14px;">Selamat datang di modul pembelajaran mandiri kesetaraan ${book.jenjang}. Pada bab dan halaman ini, peserta didik diarahkan untuk memahami materi dasar secara cermat dan memecahkan persoalan kontekstual.</p>
      
      <div style="background: var(--surface-2); padding: 16px; border-radius: 8px; border-left: 4px solid var(--primary-color); margin: 20px 0;">
        <h4 style="margin: 0 0 6px 0; font-size: 14px; color: var(--text-color);">💡 Poin Pembelajaran Kunci</h4>
        <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: var(--text-muted);">
          <li>Memahami definisi, terminologi, dan latar belakang materi bab ini.</li>
          <li>Mengidentifikasi contoh studi kasus dan penerapannya di lingkungan sehari-hari.</li>
          <li>Menyiapkan ringkasan mandiri sebelum melangkah ke tes evaluasi pemahaman modul.</li>
        </ul>
      </div>

      <p style="margin-bottom: 14px;">Bagi peserta didik pendidikan kesetaraan, kemandirian dalam membaca dan menelaah setiap bab adalah kunci keberhasilan kelulusan. Diskusikan materi yang belum Anda pahami dengan tutor atau rekan belajar.</p>
      
      <div style="margin-top: 30px; padding: 14px; background: rgba(242, 169, 0, 0.1); border: 1px dashed var(--accent); border-radius: 8px; font-size: 13px; color: var(--text-color);">
        📌 <b>Aktivitas Mandiri:</b> Buatlah rangkuman penting dari halaman ini pada buku catatan Anda sebelum menekan tombol <b>Berikutnya</b> di bawah.
      </div>
    </div>
  `;
}

function startLiveTimer() {
  if (liveTimerInterval) clearInterval(liveTimerInterval);
  const timerEl = document.getElementById('reader-live-timer');

  liveTimerInterval = setInterval(() => {
    if (!activeBelajarSession) return;
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - activeBelajarSession.detikMulai) / 1000);
    activeBelajarSession.durasiDetik = elapsedSeconds;

    const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(elapsedSeconds % 60).padStart(2, '0');

    if (timerEl) timerEl.textContent = `${hours}:${minutes}:${seconds}`;

    // Sinkronkan ke log dan storage setiap 10 detik
    if (elapsedSeconds % 10 === 0) {
      updateLogBelajarSession(activeBelajarSession);
      saveActiveBelajarSessionToStorage();
    }
  }, 1000);
}

function closeReaderModal(triggerConfirm = true) {
  if (activeBelajarSession) {
    activeBelajarSession.status = 'Selesai Belajar';
    updateLogBelajarSession(activeBelajarSession);

    const session = { ...activeBelajarSession };
    const durasiMnt = Math.max(1, Math.ceil((session.durasiDetik || 0) / 60));
    const halTerbaca = session.halamanSekarang || 1;
    const totalHal = session.totalHalaman || 28;
    const persenSelesai = Math.min(100, Math.round((halTerbaca / totalHal) * 100));

    // 🔔 Kirim Notifikasi Push Detail ke Admin & Super Admin saat siswa selesai belajar
    if (typeof sendAppPushNotification === 'function') {
      sendAppPushNotification({
        title: 'Selesai Belajar Modul 🎓',
        body: `Siswa ${session.namaSiswa} telah tuntas belajar ${session.bukuJudul}. Resume: Hal. 1 s/d ${halTerbaca} (${persenSelesai}% materi), Durasi: ${durasiMnt} menit.`,
        url: '/portal',
        targetRole: 'Admin',
        tag: 'selesai-belajar-' + session.sessionId
      });
    }

    if (liveTimerInterval) clearInterval(liveTimerInterval);
    activeBelajarSession = null;
    currentPdfDoc = null;
    saveActiveBelajarSessionToStorage(); // Menghapus key session dari storage

    const modalReader = document.getElementById('modal-reader');
    if (modalReader) modalReader.classList.add('hidden');
    renderBelajarLogTable();
    updateBelajarStats();

    // Tampilkan Dialog Resume Selesai Belajar kepada Siswa
    if (triggerConfirm) {
      tampilkanResumeSelesaiBelajar(session, durasiMnt, halTerbaca, totalHal, persenSelesai);
    }
    return;
  }

  if (liveTimerInterval) clearInterval(liveTimerInterval);
  activeBelajarSession = null;
  currentPdfDoc = null;
  saveActiveBelajarSessionToStorage();
  const modalReader = document.getElementById('modal-reader');
  if (modalReader) modalReader.classList.add('hidden');
  renderBelajarLogTable();
  updateBelajarStats();
}

// Modal dialog resume hasil belajar siswa
function tampilkanResumeSelesaiBelajar(session, durasiMnt, halTerbaca, totalHal, persenSelesai) {
  const jenjangInfo = session.jenjang || 'Paket Kesetaraan';
  const kategoriInfo = session.kategori || 'Modul Belajar Mandiri';
  const waktuMulai = session.jamMulai || '-';
  const waktuSelesai = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Kesimpulan cerdas berdasarkan progress materi yang dibaca
  let statusBadge = '<span style="color: #10b981; font-weight: 700;">● TUNTAS BAIK</span>';
  let rekomendasiText = 'Telah membaca materi dengan sangat baik dan siap mengikuti Ujian CBT untuk evaluasi nilai rapor.';
  if (persenSelesai < 30) {
    statusBadge = '<span style="color: #f59e0b; font-weight: 700;">● TAHAP AWAL</span>';
    rekomendasiText = 'Baru membaca bab awal modul. Disarankan melanjutkan membaca bab berikutnya sebelum menempuh ujian evaluasi.';
  } else if (persenSelesai < 70) {
    statusBadge = '<span style="color: #0284c7; font-weight: 700;">● SEDANG BERJALAN</span>';
    rekomendasiText = 'Telah membaca lebih dari separuh modul. Pemahaman konsep sudah cukup baik untuk latihan soal mandiri.';
  }

  Swal.fire({
    title: 'Resume Hasil Belajar Siswa 🎓',
    html: `
      <div style="text-align: left; font-size: 13.5px; color: var(--text-color);">
        <p style="margin-top: 0; line-height: 1.5;">
          Selamat <b>${session.namaSiswa}</b>, aktivitas belajar Anda telah selesai dan kehadiran belajar otomatis terekam ke sistem database PKBM Aura Anugerah.
        </p>
        
        <!-- Kartu Rangkuman Detail Modul & Materi -->
        <div style="background: var(--surface-2); border: 1.5px solid var(--border-color); border-radius: 12px; padding: 14px 16px; margin: 12px 0;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; color: var(--text-muted); margin-bottom: 2px;">
            MODUL & MATERI YANG DIPELAJARI:
          </div>
          <div style="font-weight: 800; font-size: 15px; color: var(--primary-color);">
            📖 ${session.bukuJudul}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
            Program: <b>${jenjangInfo}</b> · Kategori: <b>${kategoriInfo}</b>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px;">
            <div style="background: var(--surface-color); padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
              <span style="font-size: 11px; color: var(--text-muted); display: block;">Halaman Terbaca</span>
              <b style="font-size: 14.5px; color: var(--text-color);">Hal. 1 s/d ${halTerbaca}</b>
              <div style="font-size: 11px; color: var(--primary-color); margin-top: 2px; font-weight: 600;">
                Tuntas ${persenSelesai}% (${halTerbaca} dari ${totalHal} Hal)
              </div>
            </div>

            <div style="background: var(--surface-color); padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
              <span style="font-size: 11px; color: var(--text-muted); display: block;">Durasi Belajar</span>
              <b style="font-size: 14.5px; color: var(--text-color);">${durasiMnt} Menit</b>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ⏱️ ${waktuMulai} - ${waktuSelesai} WIT
              </div>
            </div>
          </div>

          <!-- Bagian Kesimpulan & Rekomendasi Guru -->
          <div style="margin-top: 12px; font-size: 12px; line-height: 1.5; color: var(--text-color); padding: 10px; border-radius: 8px; background: rgba(22, 163, 74, 0.08); border-left: 3.5px solid var(--primary-color);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <b>💡 KESIMPULAN BELAJAR:</b>
              ${statusBadge}
            </div>
            <div>${rekomendasiText}</div>
          </div>
        </div>

        <p style="margin-bottom: 0; font-size: 12px; color: var(--text-muted); line-height: 1.45;">
          Notifikasi ringkasan ini telah otomatis dikirimkan ke HP Admin & Tutor. Apakah Anda ingin langsung memulai sesi Ujian CBT untuk materi ini?
        </p>
      </div>
    `,
    icon: 'success',
    showCancelButton: true,
    confirmButtonText: 'Laksanakan Ujian Sekarang 📝',
    cancelButtonText: 'Tutup & Istirahat',
    confirmButtonColor: 'var(--primary-color)'
  }).then(res => {
    if (res.isConfirmed) {
      showInputNilaiModal(session.bukuId, session.namaSiswa);
    }
  });
}

function selesaiBelajarDanUjian() {
  closeReaderModal(true);
}

function catatLogBelajarBaru(session) {
  sesiBelajarLog.unshift({
    id: session.sessionId,
    tanggal: session.tanggal,
    jamMulai: session.jamMulai,
    namaSiswa: session.namaSiswa,
    bukuJudul: session.bukuJudul,
    halamanTerbaca: `Hal. 1`,
    durasiDetik: 0,
    status: 'Aktif Membaca 🟢'
  });
  saveLogBelajarToStorage();
  renderBelajarLogTable();
}

function updateLogBelajarSession(session) {
  const item = sesiBelajarLog.find(x => x.id === session.sessionId);
  if (item) {
    item.halamanTerbaca = `Hal. 1 - ${session.halamanSekarang}`;
    item.durasiDetik = session.durasiDetik;
    const durasiMenit = Math.max(1, Math.ceil(session.durasiDetik / 60));
    item.status = session.status === 'Selesai Belajar' ? `Selesai (${durasiMenit} mnt) ✅` : `Aktif Membaca (${durasiMenit} mnt) 🟢`;
    saveLogBelajarToStorage();
    renderBelajarLogTable();
  }
}

function renderBelajarLogTable() {
  const tbody = document.getElementById('table-log-belajar-body');
  if (!tbody) return;

  if (sesiBelajarLog.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">Belum ada riwayat aktivitas belajar siswa.</td></tr>';
    return;
  }

  tbody.innerHTML = sesiBelajarLog.slice(0, 10).map((log, idx) => {
    const menit = Math.ceil((log.durasiDetik || 0) / 60);
    return `
      <tr>
        <td><small>${log.tanggal || '-'} ${log.jamMulai || ''}</small></td>
        <td><strong>${log.namaSiswa || 'Siswa'}</strong></td>
        <td>${log.bukuJudul || '-'}</td>
        <td><span style="background: var(--surface-2); padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${log.halamanTerbaca || 'Hal. 1'}</span></td>
        <td>${menit} Menit</td>
        <td><span style="font-size: 12px; font-weight: 600;">${log.status || 'Aktif'}</span></td>
      </tr>
    `;
  }).join('');
}

function saveBukuListToStorage() {
  try { localStorage.setItem('ppdb_buku_list', JSON.stringify(bukuList)); } catch (e) { }
}

function saveLogBelajarToStorage() {
  try { localStorage.setItem('ppdb_belajar_log', JSON.stringify(sesiBelajarLog)); } catch (e) { }
}

// ==================== MODAL TAMBAH & EDIT BUKU ====================

function showAddBukuModal() {
  document.getElementById('buku-form-title').textContent = 'Tambah Buku Pelajaran Baru';
  document.getElementById('buku-id').value = '';
  document.getElementById('buku-nama').value = '';
  document.getElementById('buku-total-hal').value = '30';
  document.getElementById('buku-keterangan').value = '';
  document.getElementById('buku-file-url').value = '';
  document.getElementById('modal-form-buku').classList.remove('hidden');
}

function showEditBukuModal(id) {
  const b = bukuList.find(x => x.id === id);
  if (!b) return;

  document.getElementById('buku-form-title').textContent = 'Edit Buku Pelajaran';
  document.getElementById('buku-id').value = b.id;
  document.getElementById('buku-nama').value = b.nama;
  document.getElementById('buku-jenjang').value = b.jenjang;
  document.getElementById('buku-kategori').value = b.kategori;
  document.getElementById('buku-total-hal').value = b.totalHal || 30;
  document.getElementById('buku-keterangan').value = b.keterangan || '';
  document.getElementById('buku-file-url').value = b.file || '';
  document.getElementById('modal-form-buku').classList.remove('hidden');
}

function closeBukuFormModal() {
  document.getElementById('modal-form-buku').classList.add('hidden');
}

function simpanBukuData() {
  const id = document.getElementById('buku-id').value;
  const nama = document.getElementById('buku-nama').value.trim();
  const jenjang = document.getElementById('buku-jenjang').value;
  const kategori = document.getElementById('buku-kategori').value;
  const totalHal = parseInt(document.getElementById('buku-total-hal').value, 10) || 30;
  const keterangan = document.getElementById('buku-keterangan').value.trim();
  const file = document.getElementById('buku-file-url').value.trim();

  if (!nama) {
    Swal.fire('Peringatan', 'Judul buku pelajaran wajib diisi!', 'warning');
    return;
  }

  if (id) {
    // Edit mode
    const idx = bukuList.findIndex(x => x.id === id);
    if (idx !== -1) {
      bukuList[idx] = { ...bukuList[idx], nama, jenjang, kategori, totalHal, keterangan, file };
    }
  } else {
    // Tambah baru
    const newBook = {
      id: 'BK-' + String(bukuList.length + 1).padStart(3, '0'),
      nama,
      jenjang,
      kategori,
      totalHal,
      keterangan,
      file,
      dibaca: 0
    };
    bukuList.unshift(newBook);
  }

  saveBukuListToStorage();
  closeBukuFormModal();
  renderBukuGrid();
  updateBelajarStats();
  populateUjianSelectOptions();
  Swal.fire('Berhasil', 'Data buku pelajaran berhasil disimpan.', 'success');
}

function hapusBuku(id) {
  Swal.fire({
    title: 'Hapus Buku Pelajaran?',
    text: 'Buku ini akan dihapus dari daftar bahan bacaan siswa.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus',
    confirmButtonColor: 'var(--danger-color)',
    cancelButtonText: 'Batal'
  }).then(res => {
    if (res.isConfirmed) {
      bukuList = bukuList.filter(x => x.id !== id);
      saveBukuListToStorage();
      renderBukuGrid();
      updateBelajarStats();
      populateUjianSelectOptions();
      Swal.fire('Dihapus', 'Buku telah berhasil dihapus.', 'success');
    }
  });
}

// ==================== RESTORE BELAJAR STATE ON REFRESH / RELOAD ====================
function restoreActiveBelajarSessionIfAny() {
  try {
    const raw = localStorage.getItem('ppdb_active_belajar');
    if (!raw) return;
    const session = JSON.parse(raw);
    if (!session || !session.bukuId) return;

    // Pastikan buku ada dalam list
    const book = bukuList.find(b => b.id === session.bukuId);
    if (!book) return;

    activeBelajarSession = session;
    console.log('[Auto-Restore] Melanjutkan sesi belajar modul:', session.bukuJudul, 'Halaman:', session.halamanSekarang);

    // Buka kembali modal reader langsung ke halaman dan durasi terakhir
    launchReaderSession(book, session.namaSiswa || 'Siswa', session.halamanSekarang || 1, true);
  } catch (err) {
    console.warn('Gagal memulihkan sesi belajar:', err);
  }
}

// ==================== SISTEM UJIAN & PENILAIAN HASIL BELAJAR ====================

function populateUjianSelectOptions() {
  const selectSiswa = document.getElementById('ujian-siswa-id');
  const selectBuku = document.getElementById('ujian-buku-id');
  if (!selectSiswa || !selectBuku) return;

  // Isi data siswa dari siswaDataList
  selectSiswa.innerHTML = '<option value="">-- Pilih Siswa --</option>' +
    siswaDataList.map(s => `<option value="${s.id}">${s.nama} (${s.program || 'Paket C'})</option>`).join('');

  // Isi data buku
  selectBuku.innerHTML = '<option value="">-- Pilih Buku / Modul --</option>' +
    bukuList.map(b => `<option value="${b.id}">${b.nama} [${b.jenjang}]</option>`).join('');
}

function hitungPredikatNilai(val) {
  const num = Number(val);
  const elPredikat = document.getElementById('ujian-predikat');
  if (!elPredikat) return;

  if (num >= 88) elPredikat.value = 'Sangat Baik (A)';
  else if (num >= 75) elPredikat.value = 'Baik (B)';
  else if (num >= 60) elPredikat.value = 'Cukup (C)';
  else elPredikat.value = 'Perlu Bimbingan (D)';
}

function showInputNilaiModal(presetBukuId = null, presetNamaSiswa = null) {
  populateUjianSelectOptions();
  const selectSiswa = document.getElementById('ujian-siswa-id');
  const selectBuku = document.getElementById('ujian-buku-id');

  if (presetBukuId && selectBuku) selectBuku.value = presetBukuId;
  if (presetNamaSiswa && selectSiswa) {
    const matchingSiswa = siswaDataList.find(s => s.nama.toLowerCase() === presetNamaSiswa.toLowerCase());
    if (matchingSiswa) selectSiswa.value = matchingSiswa.id;
  }

  document.getElementById('ujian-angka').value = '';
  document.getElementById('ujian-predikat').value = 'Baik (B)';
  document.getElementById('ujian-catatan').value = '';

  const modal = document.getElementById('modal-input-nilai');
  if (modal) modal.classList.remove('hidden');
}

function closeInputNilaiModal() {
  const modal = document.getElementById('modal-input-nilai');
  if (modal) modal.classList.add('hidden');
}

function simpanNilaiUjian() {
  const siswaId = document.getElementById('ujian-siswa-id').value;
  const bukuId = document.getElementById('ujian-buku-id').value;
  const nilaiAngka = parseInt(document.getElementById('ujian-angka').value, 10);
  const predikat = document.getElementById('ujian-predikat').value;
  const catatan = document.getElementById('ujian-catatan').value.trim();

  if (!siswaId || !bukuId || isNaN(nilaiAngka)) {
    Swal.fire('Peringatan', 'Harap lengkapi semua kolom penilaian ujian!', 'warning');
    return;
  }

  const s = siswaDataList.find(x => String(x.id) === String(siswaId));
  const b = bukuList.find(x => String(x.id) === String(bukuId));

  const newUjian = {
    id: 'EX-' + Date.now(),
    tanggal: new Date().toLocaleDateString('id-ID'),
    siswaId,
    namaSiswa: s ? s.nama : 'Peserta Didik',
    program: s ? (s.program || 'Paket C') : 'Paket C',
    bukuJudul: b ? b.nama : 'Modul Pembelajaran',
    nilai: nilaiAngka,
    predikat,
    catatan: catatan || 'Siswa telah menyelesaikan evaluasi pembelajaran.',
    penguji: currentUser ? `${currentUser.nama} (${currentUser.role})` : 'Tutor Evaluator'
  };

  ujianHasilList.unshift(newUjian);
  saveUjianListToStorage();
  closeInputNilaiModal();
  renderUjianTable();

  Swal.fire({
    title: 'Nilai Ujian Berhasil Disimpan! 🎉',
    html: `
      <div style="text-align: left; font-size: 13.5px; color: var(--text-color);">
        <p>Hasil ujian telah tersimpan ke rapor akademik siswa:</p>
        <div style="background: var(--surface-2); padding: 12px; border-radius: 8px;">
          <div>👤 <b>Nama:</b> ${newUjian.namaSiswa}</div>
          <div>📚 <b>Mata Uji:</b> ${newUjian.bukuJudul}</div>
          <div>⭐ <b>Nilai Akhir:</b> <span style="font-weight: 700; color: #16a34a; font-size: 16px;">${newUjian.nilai}</span> (${newUjian.predikat})</div>
        </div>
      </div>
    `,
    icon: 'success',
    confirmButtonColor: 'var(--primary-color)'
  });
}

function saveUjianListToStorage() {
  try { localStorage.setItem('ppdb_ujian_list', JSON.stringify(ujianHasilList)); } catch (e) { }
}

function loadUjianData() {
  try {
    const saved = localStorage.getItem('ppdb_ujian_list');
    if (saved) ujianHasilList = JSON.parse(saved);
  } catch (e) { }
  renderUjianTable();
}

function filterUjianTable() {
  const query = (document.getElementById('search-ujian')?.value || '').toLowerCase().trim();
  const program = document.getElementById('filter-ujian-program')?.value || '';
  const predikat = document.getElementById('filter-ujian-predikat')?.value || '';

  const filtered = ujianHasilList.filter(u => {
    const matchQuery = !query || u.namaSiswa.toLowerCase().includes(query) || u.bukuJudul.toLowerCase().includes(query) || (u.penguji || '').toLowerCase().includes(query);
    const matchProgram = !program || u.program === program;
    const matchPredikat = !predikat || u.predikat.includes(predikat);
    return matchQuery && matchProgram && matchPredikat;
  });

  renderUjianTable(filtered);
}

function renderUjianTable(data) {
  const tbody = document.getElementById('table-ujian-body');
  if (!tbody) return;

  let list = data || ujianHasilList;

  // Jika login sebagai siswa, hanya tampilkan nilai miliknya
  if (currentUser && currentUser.role === 'Siswa') {
    list = list.filter(u => u.namaSiswa.toLowerCase() === currentUser.nama.toLowerCase());
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 32px;">Belum ada data nilai ujian peserta didik.</td></tr>';
    return;
  }

  const isPetugas = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin' || currentUser.role === 'Guru');

  tbody.innerHTML = list.map((u, idx) => {
    const nilaiColor = u.nilai >= 75 ? '#15803d' : (u.nilai >= 60 ? '#b45309' : '#b91c1c');
    const badgeBg = u.nilai >= 75 ? '#dcfce7' : (u.nilai >= 60 ? '#fef3c7' : '#fee2e2');

    return `
      <tr>
        <td>${idx + 1}</td>
        <td><small>${u.tanggal || '-'}</small></td>
        <td><strong>${u.namaSiswa}</strong></td>
        <td><span class="tag def">${u.program}</span></td>
        <td>${u.bukuJudul}</td>
        <td>
          <span style="font-weight: 700; font-size: 15px; color: ${nilaiColor}; background: ${badgeBg}; padding: 3px 10px; border-radius: 6px;">
            ${u.nilai}
          </span>
        </td>
        <td>${u.predikat}</td>
        <td><small style="color: var(--text-muted);">${u.penguji || '-'}</small></td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-outline" onclick="cetakSertifikatUjian('${u.id}')" title="Cetak Transkrip / Sertifikat Kelulusan Modul">
            📜 Transkrip
          </button>
          ${isPetugas ? `
            <button class="btn btn-icon btn-danger-text" onclick="hapusNilaiUjian('${u.id}')" title="Hapus Nilai">
              <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function hapusNilaiUjian(id) {
  Swal.fire({
    title: 'Hapus Nilai Ujian?',
    text: 'Data nilai ujian siswa ini akan dihapus permanen.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus',
    confirmButtonColor: 'var(--danger-color)',
    cancelButtonText: 'Batal'
  }).then(res => {
    if (res.isConfirmed) {
      ujianHasilList = ujianHasilList.filter(x => x.id !== id);
      saveUjianListToStorage();
      renderUjianTable();
      Swal.fire('Terhapus', 'Nilai ujian telah dihapus.', 'success');
    }
  });
}

function cetakSertifikatUjian(id) {
  const u = ujianHasilList.find(x => x.id === id);
  if (!u) return;

  Swal.fire({
    title: 'Transkrip Kelulusan Modul Pembelajaran',
    html: `
      <div style="border: 2px solid var(--primary-color); padding: 18px; border-radius: 10px; text-align: center; background: #fff; color: #1e293b;">
        <h4 style="margin: 0; color: #0f5c7a; text-transform: uppercase;">PKBM Aura Anugerah</h4>
        <div style="font-size: 11px; color: #64748b; margin-bottom: 12px;">Sentani, Jayapura · Sistem Pendidikan Kesetaraan Terpadu</div>
        <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 10px 0;">
        <div style="font-size: 13px;">Diberikan kepada:</div>
        <div style="font-size: 17px; font-weight: 700; color: #0f172a; margin: 4px 0;">${u.namaSiswa}</div>
        <div style="font-size: 12.5px; color: #475569;">Jenjang: <b>${u.program}</b></div>
        <div style="margin: 14px auto; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 10px; max-width: 320px;">
          <div style="font-size: 12px; color: #166534;">Mata Pelajaran: <b>${u.bukuJudul}</b></div>
          <div style="font-size: 22px; font-weight: 800; color: #15803d; margin: 4px 0;">NILAI: ${u.nilai}</div>
          <div style="font-size: 12px; font-weight: 600; color: #166534;">Predikat: ${u.predikat}</div>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 12px;">Divalidasi oleh: ${u.penguji} · Tanggal: ${u.tanggal}</div>
      </div>
    `,
    showCloseButton: true,
    confirmButtonText: 'Tutup',
    confirmButtonColor: 'var(--primary-color)'
  });
}

// =========================================================================
// ==================== FITUR: INFORMASI KEGIATAN & WARTA ==================
// =========================================================================

// Data awal default kegiatan
const DEFAULT_KEGIATAN = [
  {
    id: "keg-1",
    judul: "Orientasi Belajar & Pembagian Modul Pendidikan Kesetaraan 2026",
    tanggal: "2026-10-20",
    kategori: "Akademik",
    deskripsi: "Kegiatan orientasi tatap muka perdana bagi warga belajar Paket A, B, dan C Aura Anugerah Sentani. Peserta diberikan penjelasan mengenai kurikulum merdeka kesetaraan serta tata cara asesmen modul daring dan tatap muka.",
    gambar: "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=800&q=80",
    video: "",
    author: "Admin Aura",
    authorRole: "Super Admin",
    target_display: "both", // 'portal' | 'public' | 'both'
    createdAt: new Date().toISOString()
  },
  {
    id: "keg-2",
    judul: "Simulasi Ujian Berbasis Komputer (CBT) Modul IPA & IPS",
    tanggal: "2026-10-22",
    kategori: "Ujian / Evaluasi",
    deskripsi: "Peserta didik Paket B dan Paket C melaksanakan tryout CBT online terpadu. Antusiasme tinggi terpancar dari para peserta dalam menjawab bank soal dan memahami materi pembelajaran digital.",
    gambar: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80",
    video: "",
    author: "Ibu Guru Maria",
    authorRole: "Guru",
    target_display: "both",
    createdAt: new Date().toISOString()
  },
  {
    id: "keg-3",
    judul: "Pentas Seni & Gelar Karya Mandiri Warga Belajar PKBM Sentani",
    tanggal: "2026-10-15",
    kategori: "Pentas / Kreativitas",
    deskripsi: "Pameran karya kerajinan tangan, olahan pangan lokal, serta pertunjukan seni budaya oleh siswa-siswi PKBM Aura Anugerah bersama anak-anak PAUD/TK Aura Anugerah dalam suasana yang hangat dan penuh kebersamaan.",
    gambar: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80",
    video: "",
    author: "Admin Aura",
    authorRole: "Admin",
    target_display: "public",
    createdAt: new Date().toISOString()
  }
];

let kegiatanList = [];
let kegiatanFilterActive = 'all';
let kegiatanSearchKeyword = '';

function getStoredKegiatan() {
  try {
    const raw = localStorage.getItem('ppdb_kegiatan_list');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn("Error read ppdb_kegiatan_list", e);
  }
  return DEFAULT_KEGIATAN;
}

function saveStoredKegiatan(data) {
  try {
    localStorage.setItem('ppdb_kegiatan_list', JSON.stringify(data));
  } catch (e) {
    console.warn("Error write ppdb_kegiatan_list", e);
  }
}

function loadKegiatanData() {
  kegiatanList = getStoredKegiatan();
  renderDashboardKegiatan();
}

function filterKegiatan(mode) {
  kegiatanFilterActive = mode;
  ['all', 'portal', 'public'].forEach(m => {
    const btn = document.getElementById(`btn-filter-keg-${m}`);
    if (btn) {
      if (m === mode) {
        btn.classList.add('p', 'active');
      } else {
        btn.classList.remove('p', 'active');
      }
    }
  });
  renderDashboardKegiatan();
}

function handleSearchKegiatan(val) {
  kegiatanSearchKeyword = (val || '').toLowerCase().trim();
  renderDashboardKegiatan();
}

function renderDashboardKegiatan() {
  const container = document.getElementById('dashboard-kegiatan-grid');
  if (!container) return;

  const isAdmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin');
  const isGuru = currentUser && currentUser.role === 'Guru';
  const isSiswa = currentUser && currentUser.role === 'Siswa';

  // Sembunyikan tombol tambah kegiatan untuk siswa
  const btnTambah = document.getElementById('btn-tambah-kegiatan');
  if (btnTambah) {
    if (isSiswa) {
      btnTambah.style.display = 'none';
    } else {
      btnTambah.style.display = '';
    }
  }

  // Filter berdasarkan target
  let filtered = [...kegiatanList];
  if (kegiatanFilterActive === 'portal') {
    filtered = filtered.filter(k => k.target_display === 'portal' || k.target_display === 'both');
  } else if (kegiatanFilterActive === 'public') {
    filtered = filtered.filter(k => k.target_display === 'public' || k.target_display === 'both');
  }

  // Filter kata kunci
  if (kegiatanSearchKeyword) {
    filtered = filtered.filter(k =>
      (k.judul && k.judul.toLowerCase().includes(kegiatanSearchKeyword)) ||
      (k.deskripsi && k.deskripsi.toLowerCase().includes(kegiatanSearchKeyword)) ||
      (k.kategori && k.kategori.toLowerCase().includes(kegiatanSearchKeyword)) ||
      (k.author && k.author.toLowerCase().includes(kegiatanSearchKeyword))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted); background: var(--surface-2); border-radius: 12px; border: 1px dashed var(--border-color);">
        <i data-lucide="newspaper" style="width: 48px; height: 48px; opacity: 0.4; margin-bottom: 8px;"></i>
        <h4 style="margin: 0; color: var(--text-color);">Belum Ada Informasi Kegiatan</h4>
        <p style="margin: 6px 0 0 0; font-size: 0.85rem;">Tidak ada informasi kegiatan yang cocok dengan kriteria filter.</p>
      </div>
    `;
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(k => {
    // Label visibilitas
    let visBadge = '';
    if (k.target_display === 'portal') {
      visBadge = `<span style="font-size: 11px; font-weight: 700; background: rgba(59, 130, 246, 0.15); color: #2563eb; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
        <i data-lucide="lock" style="width: 12px; height: 12px;"></i> Portal
      </span>`;
    } else if (k.target_display === 'public') {
      visBadge = `<span style="font-size: 11px; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #059669; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
        <i data-lucide="globe" style="width: 12px; height: 12px;"></i> Publik
      </span>`;
    } else {
      visBadge = `<span style="font-size: 11px; font-weight: 700; background: rgba(245, 158, 11, 0.15); color: #d97706; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
        <i data-lucide="sparkles" style="width: 12px; height: 12px;"></i> Portal & Publik
      </span>`;
    }

    // Tombol aksi (Edit & Hapus)
    let actionButtons = '';
    const canEdit = isAdmin || (isGuru && k.author === currentUser.nama);
    if (canEdit) {
      actionButtons = `
        <div style="display: flex; gap: 6px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-color); justify-content: flex-end;">
          ${isAdmin ? `
            <button class="btn btn-sm" onclick="quickToggleVisibility('${k.id}')" title="Ubah visibilitas akses luar portal" style="font-size: 11px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px;">
              <i data-lucide="eye" style="width: 13px; height: 13px;"></i> Akses Publik
            </button>
          ` : ''}
          <button class="btn btn-sm" onclick="editKegiatan('${k.id}')" style="font-size: 11px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="edit-3" style="width: 13px; height: 13px;"></i> Edit
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteKegiatan('${k.id}')" style="font-size: 11px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px; color: #ef4444;">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i> Hapus
          </button>
        </div>
      `;
    }

    return `
      <div class="stat-card" style="flex-direction: column; align-items: stretch; padding: 0; overflow: hidden; border: 1px solid var(--border-color); border-radius: 14px; transition: transform 0.2s, box-shadow 0.2s;">
        ${k.gambar ? `
          <div style="height: 160px; overflow: hidden; position: relative; background: #0f172a;">
            <img src="${k.gambar}" alt="${k.judul}" style="width: 100%; height: 100%; object-fit: cover;">
            <div style="position: absolute; top: 10px; left: 10px;">${visBadge}</div>
            <div style="position: absolute; bottom: 8px; right: 10px; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 4px;">
              ${k.kategori || 'Kegiatan'}
            </div>
          </div>
        ` : `
          <div style="height: 90px; background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(2,132,199,0.2)); display: flex; align-items: center; justify-content: space-between; padding: 12px 16px;">
            <div>${visBadge}</div>
            <span style="font-size: 11px; font-weight: 700; color: var(--primary-color); background: var(--surface-color); padding: 3px 8px; border-radius: 6px;">${k.kategori || 'Kegiatan'}</span>
          </div>
        `}
        <div style="padding: 1rem; display: flex; flex-direction: column; flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); margin-bottom: 6px;">
            <i data-lucide="calendar" style="width: 13px; height: 13px;"></i> ${k.tanggal || '-'} · 
            <i data-lucide="user" style="width: 13px; height: 13px;"></i> ${k.author || 'Admin'}
          </div>
          <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-color); margin: 0 0 8px 0; line-height: 1.35;">
            ${k.judul}
          </h3>
          <p style="font-size: 0.86rem; color: var(--text-muted); margin: 0; line-height: 1.5; flex: 1; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
            ${k.deskripsi}
          </p>
          ${k.video ? `
            <div style="margin-top: 8px;">
              <a href="${k.video}" target="_blank" style="font-size: 12px; color: #ef4444; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                <i data-lucide="video" style="width: 14px; height: 14px;"></i> Tonton Video Terkait
              </a>
            </div>
          ` : ''}
          ${actionButtons}
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Buka Modal Tambah/Edit Kegiatan dengan Kewenangan Guru vs Admin
function openModalKegiatan(editId = null) {
  const modal = document.getElementById('modal-kegiatan');
  if (!modal) return;

  const titleEl = document.getElementById('modal-kegiatan-title');
  const badgeEl = document.getElementById('keg-vis-role-badge');
  const targetSelect = document.getElementById('keg-target-display');
  const hintEl = document.getElementById('keg-vis-hint');

  const isAdmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin');
  const isGuru = currentUser && currentUser.role === 'Guru';

  document.getElementById('form-kegiatan').reset();
  document.getElementById('keg-id').value = '';
  document.getElementById('keg-tanggal').value = new Date().toISOString().split('T')[0];

  if (isGuru && !isAdmin) {
    badgeEl.textContent = "Kewenangan: Guru";
    badgeEl.style.color = "#0284c7";
    targetSelect.value = "portal";
    targetSelect.disabled = true; // Guru hanya bisa portal
    hintEl.textContent = "⚠️ Sebagai Guru, postingan Anda otomatis hanya tampil di Portal Dalam. Admin dapat mengubah aksesnya agar tampil ke publik.";
  } else {
    badgeEl.textContent = "Kewenangan: Admin (Bebas Akses)";
    badgeEl.style.color = "var(--primary-color)";
    targetSelect.disabled = false;
    hintEl.textContent = "✅ Anda sebagai Admin memiliki akses penuh untuk menentukan apakah tampil di Portal, Publik Luar, atau Keduanya.";
  }

  if (editId) {
    const k = kegiatanList.find(x => x.id === editId);
    if (k) {
      document.getElementById('keg-id').value = k.id;
      document.getElementById('keg-judul').value = k.judul || '';
      document.getElementById('keg-tanggal').value = k.tanggal || '';
      document.getElementById('keg-kategori').value = k.kategori || 'Akademik';
      document.getElementById('keg-deskripsi').value = k.deskripsi || '';
      document.getElementById('keg-gambar').value = k.gambar || '';
      document.getElementById('keg-video').value = k.video || '';
      if (!isGuru || isAdmin) {
        targetSelect.value = k.target_display || 'portal';
      }
      titleEl.innerHTML = `<i data-lucide="edit-3"></i> Edit Informasi Kegiatan`;
    }
  } else {
    titleEl.innerHTML = `<i data-lucide="newspaper"></i> Tambah Informasi Kegiatan`;
  }

  modal.classList.remove('hidden');
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

function closeModalKegiatan() {
  const modal = document.getElementById('modal-kegiatan');
  if (modal) modal.classList.add('hidden');
}

function saveKegiatan() {
  const id = document.getElementById('keg-id').value;
  const judul = document.getElementById('keg-judul').value.trim();
  const tanggal = document.getElementById('keg-tanggal').value;
  const kategori = document.getElementById('keg-kategori').value;
  const deskripsi = document.getElementById('keg-deskripsi').value.trim();
  const gambar = document.getElementById('keg-gambar').value.trim();
  const video = document.getElementById('keg-video').value.trim();
  const targetSelect = document.getElementById('keg-target-display');

  const isAdmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin');
  const isGuru = currentUser && currentUser.role === 'Guru';

  let target_display = targetSelect.value;
  if (isGuru && !isAdmin) {
    target_display = 'portal'; // Pastikan proteksi server/logic: guru tetap portal
  }

  if (!judul || !deskripsi) {
    Swal.fire('Peringatan', 'Judul dan isi deskripsi kegiatan wajib diisi!', 'warning');
    return;
  }

  if (id) {
    // Mode Update
    const idx = kegiatanList.findIndex(x => x.id === id);
    if (idx !== -1) {
      kegiatanList[idx] = {
        ...kegiatanList[idx],
        judul,
        tanggal,
        kategori,
        deskripsi,
        gambar,
        video,
        target_display: isAdmin ? target_display : kegiatanList[idx].target_display,
        updatedAt: new Date().toISOString()
      };
    }
  } else {
    // Mode Create Baru
    const newKeg = {
      id: "keg-" + Date.now(),
      judul,
      tanggal,
      kategori,
      deskripsi,
      gambar: gambar || "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=800&q=80",
      video,
      author: currentUser ? currentUser.nama : "Petugas",
      authorRole: currentUser ? currentUser.role : "Petugas",
      target_display,
      createdAt: new Date().toISOString()
    };
    kegiatanList.unshift(newKeg);
  }

  saveStoredKegiatan(kegiatanList);
  closeModalKegiatan();
  renderDashboardKegiatan();
  renderLandingKegiatan();

  // Kirim Web Push Notification jika posting warta/kegiatan baru
  if (!id && typeof sendAppPushNotification === 'function') {
    sendAppPushNotification({
      title: 'Informasi Baru PKBM Aura Anugerah 📢',
      body: `${judul}: ${deskripsi.substring(0, 90)}...`,
      url: '/portal',
      targetRole: 'Siswa',
      tag: 'kegiatan-baru'
    });
  }

  Swal.fire({
    icon: 'success',
    title: 'Berhasil Disimpan!',
    text: `Warta kegiatan "${judul}" telah disimpan dengan visibilitas: ${target_display}.`,
    timer: 1800,
    showConfirmButton: false
  });
}

function editKegiatan(id) {
  openModalKegiatan(id);
}

function deleteKegiatan(id) {
  const k = kegiatanList.find(x => x.id === id);
  if (!k) return;

  Swal.fire({
    title: 'Hapus Kegiatan?',
    text: `Apakah Anda yakin ingin menghapus "${k.judul}"?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Ya, Hapus!',
    cancelButtonText: 'Batal'
  }).then((res) => {
    if (res.isConfirmed) {
      kegiatanList = kegiatanList.filter(x => x.id !== id);
      saveStoredKegiatan(kegiatanList);
      renderDashboardKegiatan();
      renderLandingKegiatan();
      Swal.fire('Terhapus', 'Warta kegiatan telah dihapus.', 'success');
    }
  });
}

// Fitur Admin Cepat Mengubah Visibilitas Akses Kegiatan
function quickToggleVisibility(id) {
  const k = kegiatanList.find(x => x.id === id);
  if (!k) return;

  Swal.fire({
    title: 'Atur Akses Tampilan Kegiatan',
    text: `Ubah hak akses visibilitas untuk "${k.judul}":`,
    input: 'select',
    inputOptions: {
      'portal': '🔒 Hanya Portal Dalam (Siswa & Petugas)',
      'public': '🌐 Tampil di Luar Portal (Landing Page Publik)',
      'both': '🌟 Tampil di Keduanya (Portal & Landing Page)'
    },
    inputValue: k.target_display || 'portal',
    showCancelButton: true,
    confirmButtonText: 'Terapkan Akses',
    confirmButtonColor: 'var(--primary-color)',
    cancelButtonText: 'Batal'
  }).then((res) => {
    if (res.isConfirmed && res.value) {
      k.target_display = res.value;
      saveStoredKegiatan(kegiatanList);
      renderDashboardKegiatan();
      renderLandingKegiatan();
      Swal.fire('Akses Diperbarui', `Visibilitas sekarang: ${res.value.toUpperCase()}`, 'success');
    }
  });
}

// Render Warta Kegiatan di Landing Page (Hanya yg berstatus 'public' atau 'both')
function renderLandingKegiatan() {
  const grid = document.getElementById('landing-kegiatan-grid');
  if (!grid) return;

  const publicList = (kegiatanList.length > 0 ? kegiatanList : getStoredKegiatan())
    .filter(k => k.target_display === 'public' || k.target_display === 'both');

  if (publicList.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-muted); background: var(--surface-color); border-radius: 12px; border: 1px dashed var(--border-color);">
        <p style="margin: 0;">Belum ada pengumuman kegiatan yang dipublikasikan ke halaman utama.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = publicList.map(k => `
    <div class="landing-form-card" style="padding: 0; overflow: hidden; border-radius: 16px; border: 1px solid var(--border-color); display: flex; flex-direction: column; background: var(--surface-color); transition: transform 0.2s, box-shadow 0.2s;">
      ${k.gambar ? `
        <div style="height: 180px; overflow: hidden; position: relative;">
          <img src="${k.gambar}" alt="${k.judul}" style="width: 100%; height: 100%; object-fit: cover;">
          <div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px;">
            ${k.kategori || 'Kegiatan'}
          </div>
        </div>
      ` : ''}
      <div style="padding: 1.5rem; display: flex; flex-direction: column; flex: 1;">
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px;">
          📅 ${k.tanggal || '-'} · Oleh <b>${k.author || 'Admin'}</b>
        </div>
        <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-color); margin: 0 0 8px 0; line-height: 1.35;">
          ${k.judul}
        </h3>
        <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.55; margin: 0; flex: 1; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;">
          ${k.deskripsi}
        </p>
        ${k.video ? `
          <div style="margin-top: 12px;">
            <a href="${k.video}" target="_blank" class="btn btn-sm" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem;">
              ▶ Tonton Video
            </a>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}


// =========================================================================
// ==================== FITUR: INFORMASI TK & MAPS LEAFLET =================
// =========================================================================

// Data Default Profil TK Aura Anugerah (Satu kompleks dengan PKBM di Sentani)
const DEFAULT_TK_INFO = {
  nama: "TK Aura Anugerah",
  jalan: "JL. Yahim KOMP.Buton Samping Hotel Citra Buana",
  kecamatan: "Sentani",
  kabupaten: "Kabupaten Jayapura, Papua (99352)",
  deskripsi: "TK Aura Anugerah adalah Satuan Pendidikan Anak Usia Dini yang berfokus pada pembentukan karakter mandiri, nilai-nilai moralitas, kreativitas, dan kesiapan transisi PAUD ke Sekolah Dasar yang menyenangkan dan berkualitas.",
  visi: "Terwujudnya anak usia dini yang berakhlak mulia, cerdas, ceria, mandiri, dan berbudaya lokal Papua.",
  misi: "1. Menumbuhkan nilai budi pekerti dan pembiasaan ibadah.\n2. Mengembangkan kemampuan motorik, kognitif, dan bahasa melalui bermain bermakna.\n3. Membangun kolaborasi sinergis antara pendidik, orang tua, dan masyarakat.",
  wa: "628123456789",
  wa_nama: "Sekretariat TK Aura Anugerah",
  telepon: "0812-4800-0000",
  email: "tk.auraanugerah@gmail.com",
  latlong: "-2.566100,140.505700", // Koordinat Sentani Yahim Kompleks Citra Buana
  target_display: "both" // 'portal' | 'public' | 'both'
};

let infoTKData = null;
let leafletMapLanding = null;
let leafletMapDashboard = null;

function getStoredTKInfo() {
  try {
    const raw = localStorage.getItem('ppdb_tk_info');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Error read ppdb_tk_info", e);
  }
  return DEFAULT_TK_INFO;
}

function saveStoredTKInfo(data) {
  try {
    localStorage.setItem('ppdb_tk_info', JSON.stringify(data));
  } catch (e) {
    console.warn("Error write ppdb_tk_info", e);
  }
}

function loadTKData() {
  infoTKData = getStoredTKInfo();
  renderDashboardTK();
}

function renderDashboardTK() {
  const container = document.getElementById('dashboard-tk-container');
  if (!container) return;

  const s = infoTKData || getStoredTKInfo();
  const isAdmin = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin');

  // Sembunyikan tombol edit untuk non-admin
  const btnEdit = document.getElementById('btn-edit-tk-info');
  if (btnEdit) {
    btnEdit.style.display = isAdmin ? '' : 'none';
  }

  let visBadge = '';
  if (s.target_display === 'portal') {
    visBadge = `<span style="font-size: 11.5px; font-weight: 700; background: rgba(59, 130, 246, 0.15); color: #2563eb; padding: 4px 10px; border-radius: 999px;">🔒 Khusus Portal</span>`;
  } else if (s.target_display === 'public') {
    visBadge = `<span style="font-size: 11.5px; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #059669; padding: 4px 10px; border-radius: 999px;">🌐 Khusus Publik</span>`;
  } else {
    visBadge = `<span style="font-size: 11.5px; font-weight: 700; background: rgba(245, 158, 11, 0.15); color: #d97706; padding: 4px 10px; border-radius: 999px;">🌟 Tampil di Portal & Publik</span>`;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <!-- Header Info TK -->
      <div class="stat-card" style="padding: 1.75rem; border: 1px solid var(--border-color); border-radius: 16px; flex-direction: column; align-items: stretch;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
          <div>
            <span style="font-size: 0.78rem; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px;">PAUD Mitra Satu Kompleks</span>
            <h2 style="font-size: 1.6rem; font-weight: 800; color: #0284c7; margin: 4px 0 6px 0;">${s.nama}</h2>
            <div style="display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 0.9rem;">
              <i data-lucide="map-pin" style="width: 15px; height: 15px; color: #0284c7;"></i>
              <span>${s.jalan}, ${s.kecamatan}, ${s.kabupaten}</span>
            </div>
          </div>
          <div>${visBadge}</div>
        </div>

        <hr style="border: none; border-top: 1px solid var(--border-color); margin: 12px 0 16px 0;">

        <div style="margin-bottom: 1rem;">
          <h4 style="font-size: 0.92rem; font-weight: 700; color: var(--text-color); margin: 0 0 6px 0;">Deskripsi Profil:</h4>
          <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.6; margin: 0; white-space: pre-wrap;">${s.deskripsi}</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-top: 8px;">
          <div style="background: var(--surface-2); padding: 1.2rem; border-radius: 12px; border: 1px solid var(--border-color);">
            <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--primary-color); margin: 0 0 6px 0; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="target" style="width: 16px; height: 16px;"></i> Visi Sekolah
            </h4>
            <p style="font-size: 0.86rem; color: var(--text-color); line-height: 1.5; margin: 0; white-space: pre-wrap;">${s.visi}</p>
          </div>
          <div style="background: var(--surface-2); padding: 1.2rem; border-radius: 12px; border: 1px solid var(--border-color);">
            <h4 style="font-size: 0.9rem; font-weight: 700; color: #0284c7; margin: 0 0 6px 0; display: flex; align-items: center; gap: 6px;">
              <i data-lucide="compass" style="width: 16px; height: 16px;"></i> Misi Sekolah
            </h4>
            <p style="font-size: 0.86rem; color: var(--text-color); line-height: 1.5; margin: 0; white-space: pre-wrap;">${s.misi}</p>
          </div>
        </div>

        <!-- Tombol Kontak Cepat -->
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 1.25rem;">
          ${s.wa ? `
            <a href="https://wa.me/${s.wa.replace(/\D/g, '')}" target="_blank" class="btn p" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem;">
              <i data-lucide="message-circle" style="width: 15px; height: 15px;"></i> WhatsApp TK
            </a>
          ` : ''}
          ${s.telepon ? `
            <a href="tel:${s.telepon}" class="btn" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem;">
              <i data-lucide="phone" style="width: 15px; height: 15px;"></i> ${s.telepon}
            </a>
          ` : ''}
          ${s.email ? `
            <a href="mailto:${s.email}" class="btn" style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem;">
              <i data-lucide="mail" style="width: 15px; height: 15px;"></i> ${s.email}
            </a>
          ` : ''}
        </div>
      </div>

      <!-- Card Peta Leaflet Lokasi Kompleks -->
      <div class="stat-card" style="padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 16px; flex-direction: column; align-items: stretch;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-color); margin: 0; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="map" style="width: 18px; height: 18px; color: #0284c7;"></i> Peta Lokasi Sentani, Jayapura (Leaflet OSM)
          </h3>
          <span style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">${s.latlong}</span>
        </div>
        <div id="dashboard-tk-map" style="height: 380px; width: 100%; border-radius: 12px; border: 1px solid var(--border-color); z-index: 1;"></div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 0.8rem; color: var(--text-muted);">
          <span>Titik lokasi terpadu TK & PKBM Aura Anugerah (Yahim, Sentani).</span>
          <a href="https://www.google.com/maps?q=${s.latlong}" target="_blank" style="color: #0284c7; font-weight: 600; text-decoration: underline;">
            Buka di Google Maps ↗
          </a>
        </div>
      </div>
    </div>
  `;

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  // Inisialisasi peta Leaflet untuk dashboard
  setTimeout(() => {
    initLeafletMap('dashboard-tk-map', s.latlong, s.nama, s.jalan);
  }, 250);
}

// Variable penampung peta navigasi embedded
let leafletMapNavigasi = null;

// Buka Modal Navigasi Peta Embedded
function openModalNavigasiPeta(latlongStr) {
  const modal = document.getElementById('modal-navigasi-peta');
  if (!modal) return;
  modal.classList.remove('hidden');

  const coords = (latlongStr || "-2.566100,140.505700").split(',');
  const lat = parseFloat(coords[0]) || -2.5661;
  const lng = parseFloat(coords[1]) || 140.5057;

  const btnExternal = document.getElementById('btn-open-external-gmaps');
  if (btnExternal) {
    btnExternal.href = `https://www.google.com/maps?q=${lat},${lng}`;
  }

  setTimeout(() => {
    initLeafletMap('embed-navigation-map', latlongStr || "-2.566100,140.505700", "PKBM Aura Anugerah", "JL. Yahim KOMP. Buton Samping Hotel Citra Buana, Sentani", true);
  }, 250);
}

// Tutup Modal Navigasi Peta Embedded
function closeModalNavigasiPeta() {
  const modal = document.getElementById('modal-navigasi-peta');
  if (modal) modal.classList.add('hidden');
}

// Inisialisasi Lokasi & Peta Geometri PKBM Aura Anugerah di Landing Page (Publik)
function renderLandingTK() {
  const container = document.getElementById('landing-tk-container');
  if (!container) return;

  const s = infoTKData || getStoredTKInfo();

  // Data lokasi PKBM Aura Anugerah
  const pkbmNama = "PKBM Aura Anugerah";
  const pkbmAlamat = "JL. Yahim KOMP. Buton Samping Hotel Citra Buana, Sentani";
  const pkbmKab = "Kabupaten Jayapura, Papua (99352)";
  const pkbmDeskripsi = "Pusat Kegiatan Belajar Masyarakat (PKBM) Aura Anugerah menyelenggarakan program pendidikan kesetaraan Paket A (Setara SD), Paket B (Setara SMP), Paket C (Setara SMA), kursus keterampilan vokasi, keaksaraan, serta program pemberdayaan masyarakat terpadu di Sentani.";
  const pkbmVisi = "Mewujudkan masyarakat yang cerdas, berdaya saing, berakhlak mulia, dan mandiri melalui layanan pendidikan non-formal yang inklusif dan berkualitas di tanah Papua.";
  const pkbmLatlong = s.latlong || "-2.566100,140.505700";

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1.35fr; gap: 2.5rem; align-items: stretch;">
      <!-- Kolom Kiri: Detail Profil PKBM Aura Anugerah -->
      <div style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 0.8rem; font-weight: 800; color: #16a34a; background: rgba(34, 197, 94, 0.14); padding: 5px 12px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px;">
              Pendidikan Kesetaraan & Vokasi Terpadu
            </span>
          </div>
          <h3 style="font-size: 1.85rem; font-weight: 800; color: var(--text-color); margin: 0 0 12px 0;">${pkbmNama}</h3>
          <p style="font-size: 0.95rem; color: var(--text-muted); line-height: 1.65; margin-bottom: 1.5rem;">${pkbmDeskripsi}</p>

          <div style="margin-bottom: 1.5rem; font-size: 0.92rem; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; gap: 10px; align-items: flex-start;">
              <span style="font-size: 1.1rem; line-height: 1;">📍</span>
              <div>
                <b style="color: var(--text-color);">Alamat Kampus:</b>
                <div style="color: var(--text-muted); margin-top: 2px;">${pkbmAlamat}, ${pkbmKab}</div>
              </div>
            </div>
            <div style="display: flex; gap: 10px; align-items: flex-start;">
              <span style="font-size: 1.1rem; line-height: 1;">🎯</span>
              <div>
                <b style="color: var(--text-color);">Visi PKBM:</b>
                <div style="color: var(--text-muted); margin-top: 2px;">${pkbmVisi}</div>
              </div>
            </div>
            <div style="display: flex; gap: 10px; align-items: flex-start;">
              <span style="font-size: 1.1rem; line-height: 1;">🛰️</span>
              <div>
                <b style="color: var(--text-color);">Tampilan Peta:</b>
                <div style="color: var(--text-muted); margin-top: 2px;">Citra Geometri Satelit Resolusi Tinggi (ESRI Satellite Hybrid)</div>
              </div>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 1rem;">
          <button type="button" onclick="openModalNavigasiPeta('${pkbmLatlong}')" class="btn btn-landing-primary" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; font-weight: 600; font-size: 0.9rem;">
            <i data-lucide="navigation" style="width: 17px; height: 17px;"></i>
            <span>Buka Navigasi Peta (Embedded)</span>
          </button>
          <a href="#kontak" onclick="document.getElementById('kontak').scrollIntoView({behavior: 'smooth'}); return false;" class="btn btn-outline" style="display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; font-weight: 600; font-size: 0.9rem;">
            <i data-lucide="phone-call" style="width: 17px; height: 17px;"></i>
            <span>Lihat Kontak Kami</span>
          </a>
        </div>
      </div>

      <!-- Kolom Kanan: Peta Leaflet Geometri Satelit Interaktif -->
      <div style="display: flex; flex-direction: column;">
        <div id="landing-tk-map" style="height: 440px; width: 100%; border-radius: 16px; border: 1px solid var(--border-color); overflow: hidden; box-shadow: var(--shadow-sm); z-index: 1;"></div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 0.8rem; color: var(--text-muted);">
          <span>🛰️ Tampilan Geometri Satelit & Bangunan Presisi</span>
          <span style="font-weight: 600; color: var(--primary-color);">Sentani, Jayapura, Papua</span>
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    initLeafletMap('landing-tk-map', pkbmLatlong, pkbmNama, pkbmAlamat, true);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }, 300);
}

// Inisialisasi Peta Leaflet Universal (Mendukung Tampilan Geometri Satelit)
function initLeafletMap(containerId, latlongStr, title, subtitle, useGeometry = false) {
  const mapEl = document.getElementById(containerId);
  if (!mapEl || typeof L === 'undefined') return;

  const parts = (latlongStr || "-2.566100,140.505700").split(',');
  const lat = parseFloat(parts[0]) || -2.5661;
  const lng = parseFloat(parts[1]) || 140.5057;

  try {
    // Hapus map lama jika sudah pernah dibuat di container ini
    if (containerId === 'dashboard-tk-map' && leafletMapDashboard) {
      leafletMapDashboard.remove();
      leafletMapDashboard = null;
    }
    if (containerId === 'landing-tk-map' && leafletMapLanding) {
      leafletMapLanding.remove();
      leafletMapLanding = null;
    }
    if (containerId === 'embed-navigation-map' && leafletMapNavigasi) {
      leafletMapNavigasi.remove();
      leafletMapNavigasi = null;
    }

    const map = L.map(containerId).setView([lat, lng], 17);

    // Layer Peta: Geometri Citra Satelit (ESRI World Imagery) + Jalan/Label
    if (useGeometry) {
      // 1. Base Layer Citra Satelit Resolusi Tinggi
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      }).addTo(map);

      // 2. Overlay Garis Geometri Jalan & Batas Wilayah
      L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: ''
      }).addTo(map);
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors | Aura Anugerah Sentani'
      }).addTo(map);
    }

    // Marker Lokasi
    const marker = L.marker([lat, lng]).addTo(map);
    marker.bindPopup(`
      <div style="font-family: inherit; font-size: 13px; min-width: 200px; padding: 4px;">
        <b style="color: #16a34a; font-size: 14px;">${title}</b><br>
        <span style="color: #475569; display: block; margin: 4px 0;">${subtitle}</span>
        <span style="display: inline-block; background: #dcfce7; color: #16a34a; font-weight: 700; font-size: 11px; padding: 2px 8px; border-radius: 4px;">
          📍 Sentani, Jayapura, Papua
        </span>
      </div>
    `).openPopup();

    if (containerId === 'dashboard-tk-map') leafletMapDashboard = map;
    if (containerId === 'landing-tk-map') leafletMapLanding = map;
    if (containerId === 'embed-navigation-map') leafletMapNavigasi = map;

    // Refresh ukuran peta bila render terjadi di container dinamis
    setTimeout(() => {
      map.invalidateSize();
    }, 350);
  } catch (err) {
    console.warn("Leaflet map initialization notice:", err);
  }
}

// Buka Modal Edit Info TK untuk Admin
function openModalEditTK() {
  const modal = document.getElementById('modal-edit-tk');
  if (!modal) return;

  const s = infoTKData || getStoredTKInfo();

  document.getElementById('tk-nama').value = s.nama || '';
  document.getElementById('tk-jalan').value = s.jalan || '';
  document.getElementById('tk-kecamatan').value = s.kecamatan || '';
  document.getElementById('tk-kabupaten').value = s.kabupaten || '';
  document.getElementById('tk-deskripsi').value = s.deskripsi || '';
  document.getElementById('tk-visi').value = s.visi || '';
  document.getElementById('tk-misi').value = s.misi || '';
  document.getElementById('tk-wa').value = s.wa || '';
  document.getElementById('tk-telepon').value = s.telepon || '';
  document.getElementById('tk-latlong').value = s.latlong || '-2.566100,140.505700';
  document.getElementById('tk-target-display').value = s.target_display || 'both';

  modal.classList.remove('hidden');
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

function closeModalEditTK() {
  const modal = document.getElementById('modal-edit-tk');
  if (modal) modal.classList.add('hidden');
}

function resetDefaultCoordinates() {
  const input = document.getElementById('tk-latlong');
  if (input) input.value = "-2.566100,140.505700";
}

function saveInfoTK() {
  const nama = document.getElementById('tk-nama').value.trim();
  const jalan = document.getElementById('tk-jalan').value.trim();
  const kecamatan = document.getElementById('tk-kecamatan').value.trim();
  const kabupaten = document.getElementById('tk-kabupaten').value.trim();
  const deskripsi = document.getElementById('tk-deskripsi').value.trim();
  const visi = document.getElementById('tk-visi').value.trim();
  const misi = document.getElementById('tk-misi').value.trim();
  const wa = document.getElementById('tk-wa').value.trim();
  const telepon = document.getElementById('tk-telepon').value.trim();
  const latlong = document.getElementById('tk-latlong').value.trim();
  const target_display = document.getElementById('tk-target-display').value;

  if (!nama || !jalan || !latlong) {
    Swal.fire('Peringatan', 'Nama, alamat jalan, dan titik koordinat latlong wajib diisi!', 'warning');
    return;
  }

  const updatedTK = {
    nama,
    jalan,
    kecamatan,
    kabupaten,
    deskripsi,
    visi,
    misi,
    wa,
    telepon,
    email: telepon.includes('@') ? telepon : 'tk.auraanugerah@gmail.com',
    latlong,
    target_display
  };

  infoTKData = updatedTK;
  saveStoredTKInfo(infoTKData);
  closeModalEditTK();
  renderDashboardTK();
  renderLandingTK();

  Swal.fire({
    icon: 'success',
    title: 'Pengaturan Disimpan!',
    text: `Informasi & peta ${nama} berhasil diperbarui.`,
    timer: 1800,
    showConfirmButton: false
  });
}

// Ekspos fungsi ke global window agar onclick di markup HTML dapat memanggilnya
window.openModalKegiatan = openModalKegiatan;
window.closeModalKegiatan = closeModalKegiatan;
window.saveKegiatan = saveKegiatan;
window.editKegiatan = editKegiatan;
window.deleteKegiatan = deleteKegiatan;
window.filterKegiatan = filterKegiatan;
window.handleSearchKegiatan = handleSearchKegiatan;
window.quickToggleVisibility = quickToggleVisibility;
window.renderLandingKegiatan = renderLandingKegiatan;

window.openModalEditTK = openModalEditTK;
window.closeModalEditTK = closeModalEditTK;
window.saveInfoTK = saveInfoTK;
window.resetDefaultCoordinates = resetDefaultCoordinates;
window.renderLandingTK = renderLandingTK;
window.loadKegiatanData = loadKegiatanData;
window.loadTKData = loadTKData;
window.openModalNavigasiPeta = openModalNavigasiPeta;
window.closeModalNavigasiPeta = closeModalNavigasiPeta;

// =============================================================================
// WEB PUSH NOTIFICATION MANAGER (PWA IPHONE & ANDROID)
// =============================================================================

let swRegistration = null;
let isPushSubscribed = false;

// Konversi VAPID public key base64 URL safe ke Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Inisialisasi Service Worker & Status Notifikasi
async function initServiceWorkerAndPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Web Push Notification tidak didukung di browser ini.');
    updatePushUIStatus(false, 'Perangkat atau browser ini belum mendukung Web Push Notification.');
    return;
  }

  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('✅ Service Worker berhasil didaftarkan:', swRegistration.scope);

    // Periksa status langganan saat ini
    const sub = await swRegistration.pushManager.getSubscription();
    isPushSubscribed = !(sub === null);
    
    if (isPushSubscribed) {
      console.log('📱 Perangkat sudah aktif berlangganan push.');
      // Sinkronkan ke server bila user login telah berganti
      syncPushSubscriptionWithServer(sub);
      updatePushUIStatus(true, 'Browser sudah berlangganan. Notifikasi aktif untuk akun ini.');
    } else {
      updatePushUIStatus(false, 'Notifikasi belum aktif di perangkat ini. Klik "Aktifkan notifikasi" di bawah.');
    }
  } catch (err) {
    console.error('Gagal menginisialisasi Service Worker / Push:', err);
    updatePushUIStatus(false, 'Gagal inisialisasi notifikasi: ' + err.message);
  }
}

// Update tampilan teks & tombol pada section Notifikasi HP
function updatePushUIStatus(isActive, message) {
  const label = document.getElementById('push-status-label');
  const btnSub = document.getElementById('btn-subscribe-push');
  const btnUnsub = document.getElementById('btn-unsubscribe-push');

  if (label) {
    label.innerHTML = isActive 
      ? `<span style="color: #10b981; font-weight: 600;">● Aktif</span> &mdash; ${message || 'Notifikasi aktif di perangkat ini.'}`
      : `<span style="color: #94a3b8; font-weight: 600;">○ Belum Aktif</span> &mdash; ${message || 'Notifikasi belum aktif di perangkat ini.'}`;
  }

  if (btnSub) {
    if (isActive) {
      btnSub.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px;"></i> Notifikasi Aktif';
      btnSub.classList.remove('p');
      btnSub.style.background = '#10b981';
      btnSub.style.color = '#ffffff';
      btnSub.style.borderColor = '#10b981';
    } else {
      btnSub.innerHTML = '<i data-lucide="bell" style="width: 16px; height: 16px;"></i> Aktifkan notifikasi';
      btnSub.classList.add('p');
      btnSub.style.background = '';
      btnSub.style.color = '';
      btnSub.style.borderColor = '';
    }
  }

  if (btnUnsub) {
    btnUnsub.style.display = isActive ? 'inline-block' : 'none';
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    setTimeout(window.lucide.createIcons, 20);
  }
}

// Sinkronkan data subscription ke backend (baik server lokal maupun Google Apps Script online)
async function syncPushSubscriptionWithServer(subscription) {
  const userPayload = currentUser ? {
    username: currentUser.username,
    nama: currentUser.nama,
    role: currentUser.role
  } : { username: 'guest', role: 'Umum' };

  // 1. Kirim ke Node.js server (jika online/tersedia)
  try {
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription,
        user: userPayload
      })
    });
  } catch (e) { }

  // 2. Simpan juga ke Google Sheets online via callAPI (Database Utama yang selalu online)
  try {
    await callAPI({
      action: 'savePushSubscription',
      subscription: subscription,
      user: userPayload
    });
    console.log('✅ Subscription tersimpan aman ke database utama.');
  } catch (e) {
    console.warn('Sync subscription ke database utama:', e.message);
  }
}

// User menekan tombol "Aktifkan notifikasi"
async function handleSubscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    Swal.fire({
      icon: 'warning',
      title: 'Fitur Tidak Didukung',
      text: 'Browser atau perangkat Anda belum mendukung Web Push Notification.',
      confirmButtonColor: '#059669'
    });
    return;
  }

  // Khusus iOS PWA: jika di iOS Safari dan belum standalone, beri panduan Add to Home Screen
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  
  if (isIOS && !isStandalone) {
    Swal.fire({
      icon: 'info',
      title: 'Instal di iPhone / iPad',
      html: `
        <div style="text-align: left; font-size: 14px; line-height: 1.6; color: var(--text-color);">
          <p>Pada perangkat iOS (iPhone/iPad), Apple mensyaratkan aplikasi disimpan ke <b>Layar Utama</b> terlebih dahulu untuk mengaktifkan notifikasi:</p>
          <ol style="padding-left: 20px; margin-bottom: 0;">
            <li>Tekan tombol <b>Bagikan (Share)</b> <i data-lucide="share" style="width: 14px; display: inline-block;"></i> di bar bawah Safari.</li>
            <li>Gulir ke bawah dan pilih <b>"Tambahkan ke Layar Utama" (Add to Home Screen)</b>.</li>
            <li>Buka ikon <b>SIGAP AURA</b> yang baru muncul di Layar Utama HP Anda, lalu tekan tombol <em>Aktifkan Notifikasi</em> kembali.</li>
          </ol>
        </div>
      `,
      confirmButtonText: 'Saya Mengerti',
      confirmButtonColor: '#059669'
    });
    return;
  }

  try {
    // 1. Minta izin Notifikasi ke pengguna
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      Swal.fire({
        icon: 'warning',
        title: 'Izin Ditolak',
        text: 'Izin notifikasi tidak diberikan. Mohon izinkan notifikasi pada pengaturan browser / HP Anda.',
        confirmButtonColor: '#059669'
      });
      updatePushUIStatus(false, 'Izin notifikasi ditolak oleh pengguna.');
      return;
    }

    // 2. Ambil VAPID Public Key (dengan Fallback Default jika server hosting/Vercel mengembalikan index.html)
    const DEFAULT_VAPID_PUBLIC_KEY = 'BP7KCUfLkQMqYnzgQRwTBmOHxMcip_JXkNiACCoAdrg_wOTED9Awpb6nrY5x8tm9A2hAXmQbvOIzmxA3F-uylwE';
    let publicKey = DEFAULT_VAPID_PUBLIC_KEY;

    try {
      const keyResp = await fetch('/api/push-public-key');
      const textResp = await keyResp.text();
      if (textResp && !textResp.trim().startsWith('<')) {
        const keyData = JSON.parse(textResp);
        if (keyData && keyData.success && keyData.publicKey) {
          publicKey = keyData.publicKey;
        }
      }
    } catch (fetchKeyErr) {
      console.warn('Gagal fetch /api/push-public-key dari server, menggunakan static fallback key:', fetchKeyErr.message);
    }

    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    // 3. Pastikan Service Worker siap
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.ready;
    }

    // 4. Langganan push manager
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });

    // 5. Daftarkan subscription ke server
    await syncPushSubscriptionWithServer(subscription);
    isPushSubscribed = true;

    updatePushUIStatus(true, 'Browser sudah berlangganan. Notifikasi aktif untuk akun ini.');

    Swal.fire({
      icon: 'success',
      title: 'Notifikasi Aktif! 🔔',
      text: 'Perangkat ini kini akan menerima pemberitahuan otomatis seputar ujian, nilai, dan informasi kegiatan PKBM.',
      timer: 2500,
      showConfirmButton: false
    });

  } catch (err) {
    console.error('Error saat berlangganan push:', err);
    Swal.fire({
      icon: 'error',
      title: 'Gagal Mengaktifkan Notifikasi',
      text: err.message,
      confirmButtonColor: '#059669'
    });
  }
}

// User menekan tombol "Nonaktifkan di perangkat ini"
async function handleUnsubscribePush() {
  if (!swRegistration) return;

  try {
    const sub = await swRegistration.pushManager.getSubscription();
    if (sub) {
      // Hapus di server
      await fetch('/api/push-unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint })
      });
      // Hapus di browser
      await sub.unsubscribe();
    }

    isPushSubscribed = false;
    updatePushUIStatus(false, 'Notifikasi telah dinonaktifkan di perangkat ini.');

    Swal.fire({
      icon: 'info',
      title: 'Notifikasi Dinonaktifkan',
      text: 'Perangkat ini tidak lagi menerima push notification dari SIGAP AURA.',
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    console.error('Gagal unsubscribe push:', err);
    Swal.fire('Error', 'Gagal mematikan notifikasi: ' + err.message, 'error');
  }
}

// Kirim tes notifikasi ke perangkat sendiri
async function handleSendTestPush() {
  if (!isPushSubscribed) {
    Swal.fire({
      icon: 'info',
      title: 'Aktifkan Notifikasi Terlebih Dahulu',
      text: 'Silakan tekan tombol "Aktifkan notifikasi" terlebih dahulu agar HP Anda dapat menerima pesan tes.',
      confirmButtonColor: '#059669'
    });
    return;
  }

  try {
    let pushSentViaServer = false;
    const username = currentUser ? currentUser.username : null;

    try {
      const resp = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'SIGAP AURA • Tes Notifikasi Berhasil ✅',
          body: `Halo ${currentUser ? currentUser.nama : 'Peserta'}, notifikasi HP Anda sudah terhubung dengan baik ke sistem PKBM Aura Anugerah!`,
          url: '/portal',
          targetUsername: username,
          tag: 'tes-notifikasi'
        })
      });

      const textResp = await resp.text();
      if (textResp && !textResp.trim().startsWith('<')) {
        const res = JSON.parse(textResp);
        if (res && res.success) {
          pushSentViaServer = true;
        }
      }
    } catch (serverErr) {
      console.warn('Pengiriman push via server backend tidak tersedia:', serverErr.message);
    }

    // Jika server backend offline/Vercel static: Munculkan banner langsung via Service Worker HP
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.ready;
    }

    if (swRegistration && swRegistration.showNotification) {
      const iconFull = window.location.origin + '/icon-192.png';
      await swRegistration.showNotification('SIGAP AURA • Tes Notifikasi Berhasil ✅', {
        body: `Halo ${currentUser ? currentUser.nama : 'Peserta'}, notifikasi HP Anda sudah aktif dan terhubung ke PKBM Aura Anugerah!`,
        icon: iconFull,
        badge: iconFull,
        tag: 'tes-notifikasi-' + Date.now(),
        data: { url: '/portal' },
        vibrate: [100, 50, 100]
      });
    }

    Swal.fire({
      icon: 'success',
      title: 'Tes Notifikasi Berhasil! 🔔',
      text: 'Pemberitahuan push telah dikirimkan ke bilah status/layar kunci HP Anda.',
      timer: 2500,
      showConfirmButton: false
    });

  } catch (err) {
    Swal.fire('Gagal Kirim Tes', err.message, 'error');
  }
}

// Admin mengirim siaran notifikasi massal
async function handleAdminBroadcastPush() {
  const title = (document.getElementById('admin-push-title')?.value || '').trim();
  const body = (document.getElementById('admin-push-body')?.value || '').trim();
  const targetRole = document.getElementById('admin-push-target-role')?.value || '';

  if (!title || !body) {
    Swal.fire('Peringatan', 'Judul dan isi pesan notifikasi wajib diisi!', 'warning');
    return;
  }

  try {
    const resp = await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `SIGAP AURA • ${title}`,
        body: body,
        url: '/portal',
        targetRole: targetRole || undefined,
        tag: 'admin-broadcast'
      })
    });

    const textResp = await resp.text();
    let res = {};
    try {
      res = JSON.parse(textResp);
    } catch (parseErr) {
      throw new Error('Server belum mengonfigurasi endpoint pengiriman push secara publik.');
    }

    if (res.success) {
      Swal.fire({
        icon: 'success',
        title: 'Siaran Notifikasi Terkirim!',
        text: `Berhasil mengirim ke ${res.count || 0} perangkat yang terdaftar.`,
        confirmButtonColor: '#059669'
      });
      document.getElementById('admin-push-title').value = '';
      document.getElementById('admin-push-body').value = '';
    } else {
      throw new Error(res.error || 'Gagal mengirim siaran.');
    }
  } catch (err) {
    Swal.fire('Gagal Mengirim', err.message, 'error');
  }
}

// Helper umum untuk modul lain memanggil push notification
async function sendAppPushNotification(options = {}) {
  try {
    const notifItem = {
      id: 'NOTIF-' + Date.now(),
      timestamp: new Date().toISOString(),
      title: options.title || 'SIGAP AURA',
      body: options.body || 'Pemberitahuan dari PKBM Aura Anugerah.',
      url: options.url || '/portal',
      targetRole: options.targetRole || 'Semua',
      targetUsername: options.targetUsername || '',
      tag: options.tag || 'sigap-' + Date.now()
    };

    // 1. Simpan ke Log Lokal Dashboard agar Admin/Super Admin langsung bisa melihat riwayat di aplikasi
    simpanNotifikasiKeLokal(notifItem);

    // 2. Simpan ke database online Google Apps Script (Log_Notifikasi)
    try {
      callAPI({
        action: 'logNotification',
        title: notifItem.title,
        body: notifItem.body,
        url: notifItem.url,
        targetRole: notifItem.targetRole,
        tag: notifItem.tag
      }).catch(() => { });
    } catch (e) { }

    // 3. Kirim ke Node.js server jika endpoint push online tersedia
    let sent = false;
    try {
      const resp = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      const text = await resp.text();
      if (text && !text.trim().startsWith('<')) {
        sent = true;
      }
    } catch (e) { }

    // 4. Jika perangkat lokal ini memiliki izin notifikasi (baik siswa maupun admin), munculkan banner langsung di HP
    if (Notification.permission === 'granted') {
      try {
        if (!swRegistration) {
          swRegistration = await navigator.serviceWorker.ready;
        }
        if (swRegistration && swRegistration.showNotification) {
          const iconFull = window.location.origin + '/icon-192.png';
          swRegistration.showNotification(notifItem.title, {
            body: notifItem.body,
            icon: iconFull,
            badge: iconFull,
            tag: notifItem.tag,
            data: { url: notifItem.url },
            vibrate: [100, 50, 100]
          });
        }
      } catch (swErr) {
        console.warn('Direct SW notification:', swErr.message);
      }
    }

    // Perbarui badge dan tampilan notifikasi di dashboard
    updateNotifikasiBadgeUI();
    renderLogNotifikasiDashboard();

  } catch (err) {
    console.warn('Gagal memanggil push API:', err.message);
  }
}

// Simpan notifikasi ke localStorage
function simpanNotifikasiKeLokal(notifItem) {
  try {
    let logs = [];
    const raw = localStorage.getItem('ppdb_notif_logs');
    if (raw) logs = JSON.parse(raw);
    logs.unshift(notifItem);
    // Batasi 40 notifikasi terakhir
    logs = logs.slice(0, 40);
    localStorage.setItem('ppdb_notif_logs', JSON.stringify(logs));
  } catch (e) { }
}

function ambilNotifikasiLokal() {
  try {
    const raw = localStorage.getItem('ppdb_notif_logs');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Update icon lonceng & badge jumlah notifikasi di header
function updateNotifikasiBadgeUI() {
  const badge = document.getElementById('badge-notif-count');
  if (!badge) return;
  const logs = ambilNotifikasiLokal();
  if (logs.length > 0) {
    badge.textContent = logs.length > 99 ? '99+' : String(logs.length);
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

// Render daftar riwayat notifikasi di dashboard utama
function renderLogNotifikasiDashboard(customLogs) {
  const container = document.getElementById('container-log-notifikasi');
  if (!container) return;

  const logs = customLogs || ambilNotifikasiLokal();
  if (!logs || logs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 24px; background: var(--surface-2); border-radius: 10px;">
        Belum ada riwayat notifikasi aktivitas yang tercatat.
      </div>
    `;
    return;
  }

  container.innerHTML = logs.map(item => {
    const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Baru saja';
    return `
      <div style="background: var(--surface-2); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <strong style="font-size: 13.5px; color: var(--text-color); display: flex; align-items: center; gap: 6px;">
            🔔 ${item.title || 'Pemberitahuan'}
          </strong>
          <span style="font-size: 11px; color: var(--text-muted); white-space: nowrap;">${dateStr}</span>
        </div>
        <div style="font-size: 13px; color: var(--text-muted); line-height: 1.4;">${item.body || ''}</div>
        <div style="display: flex; gap: 8px; margin-top: 4px; font-size: 11.5px;">
          <span style="background: rgba(59, 130, 246, 0.12); color: #2563eb; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Target: ${item.targetRole || 'Semua'}</span>
          ${item.tag ? `<span style="background: rgba(16, 185, 129, 0.12); color: #10b981; padding: 2px 8px; border-radius: 4px;">Tag: ${item.tag}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Buka popup modal notifikasi
function bukaModalNotifikasiDashboard() {
  const modal = document.getElementById('modal-notifikasi-popup');
  const popupList = document.getElementById('popup-notifikasi-list');
  if (modal) modal.classList.remove('hidden');

  function renderList(logs) {
    if (!popupList) return;
    if (!logs || logs.length === 0) {
      popupList.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 30px;">
          Belum ada riwayat notifikasi baru.
        </div>
      `;
    } else {
      popupList.innerHTML = logs.map(item => {
        const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'Baru saja';
        return `
          <div style="background: var(--surface-2); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong style="font-size: 13.5px; color: var(--text-color);">🔔 ${item.title || 'Pemberitahuan'}</strong>
              <small style="color: var(--text-muted);">${dateStr}</small>
            </div>
            <p style="margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.4;">${item.body || ''}</p>
          </div>
        `;
      }).join('');
    }
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // Tampilkan data lokal terlebih dahulu secara instan
  const lokalLogs = ambilNotifikasiLokal();
  renderList(lokalLogs);

  // Ambil data terbaru secara background jika ada API
  if (typeof callAPI === 'function') {
    callAPI({ action: 'getNotificationLogs', limit: 25 }).then(res => {
      if (res && Array.isArray(res) && res.length > 0) {
        try {
          localStorage.setItem('ppdb_notif_logs', JSON.stringify(res));
        } catch (e) { }
        renderList(res);
        updateNotifikasiBadgeUI();
      }
    }).catch(err => {
      console.warn('Gagal memuat notifikasi online saat popup dibuka:', err.message);
    });
  }
}

function tutupModalNotifikasiDashboard() {
  const modal = document.getElementById('modal-notifikasi-popup');
  if (modal) modal.classList.add('hidden');
}

// Ambil riwayat log notifikasi dari server / spreadsheet
async function muatLogNotifikasiDashboard() {
  renderLogNotifikasiDashboard();
  updateNotifikasiBadgeUI();

  try {
    const res = await callAPI({ action: 'getNotificationLogs', limit: 25 });
    if (res && Array.isArray(res) && res.length > 0) {
      renderLogNotifikasiDashboard(res);
      // Sinkronkan ke lokal
      try {
        localStorage.setItem('ppdb_notif_logs', JSON.stringify(res));
      } catch (e) { }
      updateNotifikasiBadgeUI();
    }
  } catch (err) {
    console.warn('Muat log notifikasi online:', err.message);
  }
}

// Muat UI section notifikasi dan tampilkan panel admin jika role Admin
function loadPushNotificationSection() {
  const adminCard = document.getElementById('admin-push-broadcast-card');
  if (adminCard) {
    if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin')) {
      adminCard.classList.remove('hidden');
    } else {
      adminCard.classList.add('hidden');
    }
  }

  // Refresh status langganan
  if (swRegistration && swRegistration.pushManager) {
    swRegistration.pushManager.getSubscription().then(sub => {
      isPushSubscribed = !(sub === null);
      if (isPushSubscribed) {
        updatePushUIStatus(true, 'Browser sudah berlangganan. Notifikasi aktif untuk akun ini.');
      } else {
        updatePushUIStatus(false, 'Notifikasi belum aktif di perangkat ini. Klik "Aktifkan notifikasi" di bawah.');
      }
    });
  }
}

// Global exports
window.initServiceWorkerAndPush = initServiceWorkerAndPush;
window.handleSubscribePush = handleSubscribePush;
window.handleUnsubscribePush = handleUnsubscribePush;
window.handleSendTestPush = handleSendTestPush;
window.handleAdminBroadcastPush = handleAdminBroadcastPush;
window.sendAppPushNotification = sendAppPushNotification;
window.loadPushNotificationSection = loadPushNotificationSection;
window.muatLogNotifikasiDashboard = muatLogNotifikasiDashboard;
window.bukaModalNotifikasiDashboard = bukaModalNotifikasiDashboard;
window.tutupModalNotifikasiDashboard = tutupModalNotifikasiDashboard;

// =============================================================================
// PWA SMART INSTALL DETECTOR & PROMPT (ANDROID & IPHONE/IPAD)
// =============================================================================

let deferredPWAInstallPrompt = null;

// Cek apakah aplikasi saat ini berjalan dalam mode Standalone (Sudah Terpasang)
function isPWAInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://');
}

// Cek apakah perangkat adalah iOS (iPhone / iPad)
function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// Tangkap event standar browser Android / Chrome Desktop
window.addEventListener('beforeinstallprompt', (e) => {
  // Cegah browser menampilkan prompt bawaan yang terlalu cepat
  e.preventDefault();
  deferredPWAInstallPrompt = e;
  console.log('💡 PWA Install prompt ditangkap dan siap digunakan.');

  // Tampilkan tombol instal di UI jika belum diinstal
  if (!isPWAInstalled()) {
    showPWAInstallUI();
  }
});

// Event saat aplikasi berhasil diinstal oleh pengguna
window.addEventListener('appinstalled', () => {
  console.log('🎉 PWA SIGAP AURA berhasil diinstal!');
  deferredPWAInstallPrompt = null;
  hidePWAInstallUI();
  try {
    sessionStorage.setItem('sigap_pwa_installed_now', 'true');
  } catch (e) { }

  Swal.fire({
    icon: 'success',
    title: 'Aplikasi Berhasil Dipasang! 🎉',
    text: 'SIGAP AURA telah terpasang di layar utama HP Anda. Anda kini dapat membukanya langsung seperti aplikasi bawaan.',
    timer: 3000,
    showConfirmButton: false
  });
});

// Tampilkan tombol & banner instal di antarmuka
function showPWAInstallUI() {
  if (isPWAInstalled()) return;

  // 1. Tampilkan tombol di Landing Page Header
  const headerBtn = document.getElementById('btn-install-app-header');
  if (headerBtn) headerBtn.style.display = 'inline-flex';

  // 2. Tampilkan tombol di Form Login Modal
  const loginInstallBox = document.getElementById('login-install-app-container');
  if (loginInstallBox) loginInstallBox.style.display = 'block';

  // 3. Tampilkan Banner Mengambang di Bawah Layar setelah 2 detik
  const dismissedTime = localStorage.getItem('sigap_pwa_banner_dismissed');
  const now = Date.now();
  // Jangan tampilkan banner jika baru ditutup dalam 1 hari terakhir
  if (!dismissedTime || (now - parseInt(dismissedTime, 10)) > (24 * 60 * 60 * 1000)) {
    setTimeout(() => {
      const banner = document.getElementById('pwa-install-banner');
      if (banner && !isPWAInstalled()) {
        banner.classList.add('show');
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
          window.lucide.createIcons();
        }
      }
    }, 2000);
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// Sembunyikan semua UI promosi instal
function hidePWAInstallUI() {
  const headerBtn = document.getElementById('btn-install-app-header');
  if (headerBtn) headerBtn.style.display = 'none';

  const loginInstallBox = document.getElementById('login-install-app-container');
  if (loginInstallBox) loginInstallBox.style.display = 'none';

  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.classList.remove('show');
}

// Aksi ketika user mengklik tombol "Pasang" / "Instal Aplikasi"
async function triggerPWAInstall() {
  // Jika di iPhone / iPad: Tampilkan modal panduan iOS Add to Home Screen
  if (isIOSDevice()) {
    openIosInstallModal();
    return;
  }

  // Jika di Android / Chrome Desktop dan ada deferred prompt
  if (deferredPWAInstallPrompt) {
    try {
      deferredPWAInstallPrompt.prompt();
      const choiceResult = await deferredPWAInstallPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('User menerima instalasi PWA SIGAP AURA');
        hidePWAInstallUI();
      } else {
        console.log('User menolak prompt instalasi PWA');
      }
      deferredPWAInstallPrompt = null;
    } catch (err) {
      console.warn('Gagal memicu install prompt native:', err);
    }
  } else {
    // Jika browser Android (atau Firefox/Samsung Internet) belum mengeluarkan prompt otomatis
    Swal.fire({
      icon: 'info',
      title: 'Pasang di Layar Utama HP',
      html: `
        <div style="text-align: left; font-size: 13.5px; line-height: 1.6; color: var(--text-color);">
          <p>Untuk memasang <b>SIGAP AURA</b> di layar HP Anda:</p>
          <ol style="padding-left: 20px; margin-bottom: 0;">
            <li>Tekan tombol menu browser <b>titik tiga (⋮)</b> di pojok kanan atas browser Anda.</li>
            <li>Pilih opsi <b>"Instal aplikasi"</b> atau <b>"Tambahkan ke Layar Utama"</b>.</li>
            <li>Konfirmasi pemasangan, dan aplikasi akan langsung muncul di beranda HP Anda.</li>
          </ol>
        </div>
      `,
      confirmButtonText: 'Saya Mengerti',
      confirmButtonColor: '#16a34a'
    });
  }
}

// Tutup banner mengambang jika user memilih silang
function dismissPWAInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.classList.remove('show');
  try {
    localStorage.setItem('sigap_pwa_banner_dismissed', Date.now().toString());
  } catch (e) { }
}

// Buka modal panduan iOS
function openIosInstallModal() {
  const modal = document.getElementById('modal-ios-install');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
}

// Tutup modal panduan iOS
function closeIosInstallModal() {
  const modal = document.getElementById('modal-ios-install');
  if (modal) modal.classList.add('hidden');
}

// Inisialisasi pengecekan instalasi saat halaman dimuat
function checkAndInitPWAInstallation() {
  if (isPWAInstalled()) {
    console.log('📱 Aplikasi SIGAP AURA berjalan dalam mode Standalone Terpasang.');
    hidePWAInstallUI();
  } else {
    console.log('🌐 Aplikasi dibuka via web browser biasa (Belum Terpasang).');
    showPWAInstallUI();
  }
}

// Panggil di akhir pemuatan halaman
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndInitPWAInstallation);
} else {
  checkAndInitPWAInstallation();
}

window.triggerPWAInstall = triggerPWAInstall;
window.dismissPWAInstallBanner = dismissPWAInstallBanner;
window.openIosInstallModal = openIosInstallModal;
window.closeIosInstallModal = closeIosInstallModal;
window.isPWAInstalled = isPWAInstalled;


