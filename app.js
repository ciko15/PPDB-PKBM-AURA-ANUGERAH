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
      let urlToShow = "";

      if (target === 'ijazah') {
        urlToShow = currentSiswa.urlIjazah;
        btnAi.textContent = "Cek dengan AI (Ijazah)";
        btnAi.dataset.target = "ijazah";
      } else if (target === 'kk') {
        urlToShow = currentSiswa.urlKK;
        btnAi.textContent = "Cek dengan AI (KK)";
        btnAi.dataset.target = "kk";
      } else {
        urlToShow = currentSiswa.urlBayar;
        btnAi.textContent = "Cek Bukti Bayar";
        btnAi.dataset.target = "bayar";
      }

      const docImage = document.getElementById('doc-image');
      const docIframe = document.getElementById('doc-iframe');

      if (!urlToShow) {
        docImage.style.display = 'none';
        docIframe.style.display = 'none';
        docLoader.style.display = 'none';
        return;
      }

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
        docIframe.style.display = 'block';
        docIframe.src = previewUrl;
      } else {
        // If it's not a drive url or is base64, try using img first, iframe as fallback
        if (urlToShow.toLowerCase().includes('.pdf') || urlToShow.includes('application/pdf')) {
          docImage.style.display = 'none';
          docIframe.style.display = 'block';
          docIframe.src = urlToShow;
        } else {
          docIframe.style.display = 'none';
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
  } catch (err) {
    Swal.fire('Error', err.message, 'error');
  }
  hideLoader();
}

let syncInterval = null;

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
      currentUser = null;
      pageLogin.classList.remove('hidden');
      pageDashboard.classList.add('hidden');
    }
  });
}

function showDashboard() {
  pageLogin.classList.add('hidden');
  pageDashboard.classList.remove('hidden');
  activeUserName.textContent = currentUser.nama;
  if (activeUserRole) activeUserRole.textContent = currentUser.role;
  if (activeUserAvatar) activeUserAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.nama)}&background=0284c7&color=fff`;

  if (currentUser.role === 'Admin' || currentUser.role === 'Super Admin') {
    menuUsers.classList.remove('hidden');
  } else {
    menuUsers.classList.add('hidden');
  }

  document.querySelector('#main-menu li[data-target="section-dashboard"]').click();

  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(backgroundSync, 10000);
}

async function backgroundSync() {
  if (!currentUser || pageDashboard.classList.contains('hidden')) return;
  try {
    const data = await callAPI({ action: "getSiswa", pendingOnly: false });
    // Cek perbedaan sederhana untuk trigger update
    if (JSON.stringify(data) !== JSON.stringify(siswaDataList)) {
      siswaDataList = data;
      const activeMenu = document.querySelector('#main-menu li.active');
      if (activeMenu) {
        const target = activeMenu.dataset.target;
        if (target === 'section-dashboard') loadDashboardData(true);
        else if (target === 'section-list') loadAllSiswa(true);
        else if (target === 'section-validasi') fetchSiswaData(false, true); // Update sidebar list silently
      }
    }
  } catch (e) {
    console.error("Auto sync failed:", e);
  }
}

// ======================= DASHBOARD DATA =======================
async function loadDashboardData(silent = false) {
  if (!silent) showLoader("Memuat Dashboard...");
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
  if (!silent) hideLoader();
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
        createdBy: currentUser.username
      }
    };

    const res = await callAPI(payload);

    // Tampilkan notifikasi kecil agar layar tidak terkunci (toast)
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: res.message || "Data Berhasil Disimpan!",
      showConfirmButton: false,
      timer: 3000
    });

    if (siswaId) {
      cancelEdit();
      document.querySelector('li[data-target="section-list"]').click();
    } else {
      formInputSiswa.reset();
    }
  } catch (err) {
    Swal.fire('Gagal', err.message, 'error');
  }
}

function loadSiswaForEdit(id) {
  const s = siswaDataList.find(x => x.id === id);
  if (!s) return;

  // Ubah ke menu Pendaftaran Baru
  menuInput.click();

  // Set nilai di form dengan pengamanan String()
  try {
    document.getElementById('reg-id').value = s.id;
    document.getElementById('reg-tgl-daftar').value = s.tglDaftar ? String(s.tglDaftar).split('T')[0] : '';
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
    document.getElementById('reg-tgl-lahir').value = s.tglLahir ? String(s.tglLahir).split('T')[0] : '';
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
}

const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});


// ======================= ANTREAN VALIDASI =======================
async function fetchSiswaData(onlyPending, silent = false) {
  if (!silent) siswaListEl.innerHTML = '<li class="loading-text">Memuat data...</li>';
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
  if (!silent) tableSiswaBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Memuat data...</td></tr>';
  try {
    const data = await callAPI({ action: "getSiswa", pendingOnly: false });
    siswaDataList = data; // Simpan untuk Edit Mode
    const searchInput = document.getElementById('search-siswa');
    if (searchInput) searchInput.value = '';
    renderSiswaTable(siswaDataList);
  } catch (err) {
    tableSiswaBody.innerHTML = `<tr><td colspan="7">${err.message}</td></tr>`;
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
    const isEditable = (currentUser.role === 'Admin' || currentUser.role === 'Super Admin' || currentUser.username === s.createdBy);

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
        <button class="btn btn-primary" onclick="loadSiswaForEdit('${s.id}')" style="padding:4px 8px; font-size:0.8rem; opacity:${isEditable ? '1' : '0.5'}" ${isEditable ? '' : 'disabled'}>
          Edit
        </button>
        ${currentUser.role === 'Admin' || currentUser.role === 'Super Admin' ? `<button class="btn btn-danger" onclick="deleteSiswaData('${s.id}')" style="padding:4px 8px; font-size:0.8rem;">Hapus</button>` : ''}
      </td>
    `;
    tableSiswaBody.appendChild(tr);
  });
}

function showSiswaDetail(id) {
  const s = siswaDataList.find(x => x.id === id);
  if (!s) return;

  const htmlContent = `
    <div style="text-align: left; font-size: 0.9rem; line-height: 1.5; margin-top: 1rem;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px; font-weight: bold; width: 40%; border-bottom: 1px solid #eee;">Nama Lengkap</td><td style="padding: 6px; border-bottom: 1px solid #eee;">: ${s.nama || '-'}</td></tr>
        <tr><td style="padding: 6px; font-weight: bold; border-bottom: 1px solid #eee;">NIK</td><td style="padding: 6px; border-bottom: 1px solid #eee;">: ${s.nik || '-'}</td></tr>
        <tr><td style="padding: 6px; font-weight: bold; border-bottom: 1px solid #eee;">NISN</td><td style="padding: 6px; border-bottom: 1px solid #eee;">: ${s.nisn || '-'}</td></tr>
        <tr><td style="padding: 6px; font-weight: bold; border-bottom: 1px solid #eee;">Jenis Kelamin</td><td style="padding: 6px; border-bottom: 1px solid #eee;">: ${s.jk || '-'}</td></tr>
        <tr><td style="padding: 6px; font-weight: bold; border-bottom: 1px solid #eee;">Tempat, Tgl Lahir</td><td style="padding: 6px; border-bottom: 1px solid #eee;">: ${s.tempatLahir || '-'}, ${s.tglLahir ? String(s.tglLahir).split('T')[0] : '-'}</td></tr>
        <tr><td style="padding: 6px; font-weight: bold; border-bottom: 1px solid #eee;">Program / Jenjang</td><td style="padding: 6px; border-bottom: 1px solid #eee;">: ${s.program || '-'}</td></tr>
        <tr><td style="padding: 6px; font-weight: bold; border-bottom: 1px solid #eee;">Nama Ibu Kandung</td><td style="padding: 6px; border-bottom: 1px solid #eee;">: ${s.namaIbu || '-'}</td></tr>
        <tr><td style="padding: 6px; font-weight: bold; border-bottom: 1px solid #eee;">Nama Ayah Kandung</td><td style="padding: 6px; border-bottom: 1px solid #eee;">: ${s.namaAyah || '-'}</td></tr>
        <tr><td style="padding: 6px; font-weight: bold; border-bottom: 1px solid #eee;">Status Validasi</td><td style="padding: 6px; border-bottom: 1px solid #eee;">: <b>${s.status || 'Pending'}</b></td></tr>
        <tr><td style="padding: 6px; font-weight: bold;">Tgl Daftar</td><td style="padding: 6px;">: ${s.tglDaftar ? String(s.tglDaftar).split('T')[0] : '-'}</td></tr>
      </table>
    </div>
  `;

  Swal.fire({
    title: 'Detail Peserta Didik',
    html: htmlContent,
    icon: 'info',
    confirmButtonText: 'Tutup',
    confirmButtonColor: '#3085d6',
    width: '500px'
  });
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
  showLoader("Menyimpan user...");
  try {
    await callAPI({ action: "addUser", username: u, password: p, nama: n, role: r });
    hideLoader();
    document.getElementById('form-add-user').reset();
    loadAllUsers();
  } catch (err) {
    hideLoader(); Swal.fire('Error', err.message, 'error');
  }
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


