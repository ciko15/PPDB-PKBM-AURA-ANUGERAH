// =============================================================================
// FITUR CBT UJIAN ONLINE BEESMART V3 PATTERN (MODAL, TIMER, GRID SOAL, AUTO-SCORING)
// =============================================================================

// ==================== SEARCHABLE SELECT COMPONENT (NATIVE) ====================
function makeSearchableSelect(selectEl, config = {}) {
  if (!selectEl) return;
  const placeholder = config.searchPlaceholder || 'Ketik untuk mencari...';

  // Jika sudah pernah dibuat, update data & trigger text
  let wrap = selectEl.nextElementSibling;
  if (wrap && wrap.classList.contains('searchable-select-wrap')) {
    updateSearchableSelectInstance(selectEl, wrap, placeholder);
    return;
  }

  // Sembunyikan elemen select asli tapi tetap simpan di DOM untuk form submit
  selectEl.style.display = 'none';

  wrap = document.createElement('div');
  wrap.className = 'searchable-select-wrap';

  wrap.innerHTML = `
    <div class="searchable-select-trigger" tabindex="0">
      <span class="selected-text"></span>
      <svg class="arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </div>
    <div class="searchable-select-dropdown">
      <div class="searchable-select-search-box">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="text" placeholder="${placeholder}" autocomplete="off">
      </div>
      <ul class="searchable-select-options"></ul>
    </div>
  `;

  selectEl.parentNode.insertBefore(wrap, selectEl.nextSibling);

  const trigger = wrap.querySelector('.searchable-select-trigger');
  const dropdown = wrap.querySelector('.searchable-select-dropdown');
  const searchInput = wrap.querySelector('.searchable-select-search-box input');
  const optionsList = wrap.querySelector('.searchable-select-options');

  function openDropdown() {
    // Tutup dropdown lain
    document.querySelectorAll('.searchable-select-dropdown.open').forEach(d => {
      if (d !== dropdown) {
        d.classList.remove('open');
        d.previousElementSibling?.classList.remove('active');
      }
    });
    dropdown.classList.add('open');
    trigger.classList.add('active');
    searchInput.value = '';
    filterOptions('');
    setTimeout(() => searchInput.focus(), 50);
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
    trigger.classList.remove('active');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('open')) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  searchInput.addEventListener('input', (e) => {
    filterOptions(e.target.value.toLowerCase().trim());
  });

  searchInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  function filterOptions(keyword) {
    const items = optionsList.querySelectorAll('.searchable-select-option');
    let hasMatch = false;
    items.forEach(item => {
      const text = item.getAttribute('data-text') || '';
      if (!keyword || text.toLowerCase().includes(keyword)) {
        item.style.display = '';
        hasMatch = true;
      } else {
        item.style.display = 'none';
      }
    });

    let emptyEl = optionsList.querySelector('.searchable-select-empty');
    if (!hasMatch) {
      if (!emptyEl) {
        emptyEl = document.createElement('li');
        emptyEl.className = 'searchable-select-empty';
        emptyEl.textContent = 'Tidak ada pilihan yang cocok';
        optionsList.appendChild(emptyEl);
      }
      emptyEl.style.display = '';
    } else if (emptyEl) {
      emptyEl.style.display = 'none';
    }
  }

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      closeDropdown();
    }
  });

  updateSearchableSelectInstance(selectEl, wrap, placeholder);
}

function updateSearchableSelectInstance(selectEl, wrap, placeholder) {
  const triggerText = wrap.querySelector('.selected-text');
  const optionsList = wrap.querySelector('.searchable-select-options');
  if (!triggerText || !optionsList) return;

  optionsList.innerHTML = '';

  const allOptions = Array.from(selectEl.querySelectorAll('option'));
  let selectedOption = allOptions.find(o => o.selected) || allOptions[0];

  triggerText.textContent = selectedOption ? selectedOption.textContent : (selectEl.getAttribute('placeholder') || '-- Pilih --');

  allOptions.forEach(opt => {
    const li = document.createElement('li');
    li.className = 'searchable-select-option' + (opt.value === selectEl.value ? ' selected' : '');
    li.textContent = opt.textContent;
    li.setAttribute('data-value', opt.value);
    li.setAttribute('data-text', opt.textContent);

    li.addEventListener('click', (e) => {
      e.stopPropagation();
      selectEl.value = opt.value;
      triggerText.textContent = opt.textContent;

      optionsList.querySelectorAll('.searchable-select-option').forEach(el => el.classList.remove('selected'));
      li.classList.add('selected');

      wrap.querySelector('.searchable-select-dropdown')?.classList.remove('open');
      wrap.querySelector('.searchable-select-trigger')?.classList.remove('active');

      // Trigger event onchange asli
      const event = new Event('change', { bubbles: true });
      selectEl.dispatchEvent(event);
    });

    optionsList.appendChild(li);
  });
}


const INSTITUSI_CONFIG = {
  nama: 'PKBM AURA ANUGERAH',
  yayasan: 'YAYASAN AURA ANUGERAH',
  npsn: '69910495',
  jalan: 'JL. Yahim KOMP.Buton Samping Hotel Citra Buana',
  alamat: 'JL. Yahim KOMP.Buton Samping Hotel Citra Buana',
  kecamatan: 'SENTANI',
  kabupaten: 'JAYAPURA',
  provinsi: 'PAPUA',
  kodePos: '99352'
};

// Canvas TTD Digital logic
let userTtdCanvas = null;
let userTtdCtx = null;
let isDrawingTtd = false;

function initUserTtdCanvas() {
  userTtdCanvas = document.getElementById('usr-ttd-canvas');
  if (!userTtdCanvas) return;
  userTtdCtx = userTtdCanvas.getContext('2d');
  userTtdCtx.lineWidth = 2.5;
  userTtdCtx.lineCap = 'round';
  userTtdCtx.lineJoin = 'round';
  userTtdCtx.strokeStyle = '#0f172a';

  function getPos(e) {
    const rect = userTtdCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function startDraw(e) {
    isDrawingTtd = true;
    const pos = getPos(e);
    userTtdCtx.beginPath();
    userTtdCtx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!isDrawingTtd) return;
    e.preventDefault();
    const pos = getPos(e);
    userTtdCtx.lineTo(pos.x, pos.y);
    userTtdCtx.stroke();
  }

  function stopDraw() {
    isDrawingTtd = false;
  }

  userTtdCanvas.addEventListener('mousedown', startDraw);
  userTtdCanvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stopDraw);

  userTtdCanvas.addEventListener('touchstart', startDraw, { passive: false });
  userTtdCanvas.addEventListener('touchmove', draw, { passive: false });
  userTtdCanvas.addEventListener('touchend', stopDraw);

  // File upload TTD
  const fileInput = document.getElementById('usr-ttd-file');
  const previewDiv = document.getElementById('usr-ttd-preview');
  const previewImg = document.getElementById('usr-ttd-preview-img');
  const hiddenDataUrl = document.getElementById('usr-ttd-dataurl');

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (hiddenDataUrl) hiddenDataUrl.value = evt.target.result;
          if (previewImg) previewImg.src = evt.target.result;
          if (previewDiv) previewDiv.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }
}

function clearUserTtdCanvas() {
  if (userTtdCanvas && userTtdCtx) {
    userTtdCtx.clearRect(0, 0, userTtdCanvas.width, userTtdCanvas.height);
  }
  const hiddenDataUrl = document.getElementById('usr-ttd-dataurl');
  if (hiddenDataUrl) hiddenDataUrl.value = '';
  const previewDiv = document.getElementById('usr-ttd-preview');
  if (previewDiv) previewDiv.style.display = 'none';
  const fileInput = document.getElementById('usr-ttd-file');
  if (fileInput) fileInput.value = '';
}

function isCanvasBlank(canvas) {
  if (!canvas) return true;
  const context = canvas.getContext('2d');
  const pixelBuffer = new Uint32Array(
    context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
  );
  return !pixelBuffer.some(color => color !== 0);
}

// Inisialisasi TTD saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initUserTtdCanvas, 500);
});

// ==================== STATE ENGINE CBT BEESMART ====================
let cbtActiveSession = null;
let cbtTimerInterval = null;
let cbtFontSizeLevel = 16;

function saveCbtActiveSessionToStorage() {
  if (cbtActiveSession) {
    try {
      // Catat timestamp waktu saat disimpan agar durasi countdown presisi
      cbtActiveSession.lastSavedTime = Date.now();
      localStorage.setItem('ppdb_cbt_active_session', JSON.stringify(cbtActiveSession));
    } catch (e) { }
  } else {
    try { localStorage.removeItem('ppdb_cbt_active_session'); } catch (e) { }
  }
}

// Template Generator Soal Ujian Otomatis berdasarkan Modul / Mata Pelajaran
function generateSoalPaketModul(buku) {
  const mapel = (buku && buku.mapel) ? buku.mapel : 'Umum';
  const jenjang = (buku && buku.jenjang) ? buku.jenjang : 'Paket C';
  const judul = (buku && buku.nama) ? buku.nama : 'Modul Pembelajaran';

  return [
    {
      id: 1,
      pertanyaan: 'Berdasarkan materi yang dipelajari pada ' + judul + ', apakah tujuan utama dari pembelajaran modul kesetaraan ' + jenjang + ' ini?',
      opsi: [
        { k: 'A', t: 'Meningkatkan pemahaman konsep dasar dan kompetensi literasi terapan di masyarakat.' },
        { k: 'B', t: 'Hanya sekadar menghafalkan definisi materi tanpa praktik langsung.' },
        { k: 'C', t: 'Memperoleh sertifikat tanpa memahami isi modul materi pembelajaran.' },
        { k: 'D', t: 'Menghindari proses evaluasi pembelajaran mandiri.' }
      ],
      kunci: 'A'
    },
    {
      id: 2,
      pertanyaan: 'Dalam konteks mata pelajaran ' + mapel + ', metode pemecahan masalah yang paling tepat ketika menghadapi studi kasus nyata adalah:',
      opsi: [
        { k: 'A', t: 'Menyimpulkan langsung tanpa meninjau fakta atau data yang relevan.' },
        { k: 'B', t: 'Melakukan analisis terstruktur, mengidentifikasi akar masalah, lalu menyusun alternatif solusi.' },
        { k: 'C', t: 'Menunggu arahan orang lain tanpa inisiatif analisis mandiri.' },
        { k: 'D', t: 'Mengabaikan teori yang telah dipelajari di dalam bahan ajar modul.' }
      ],
      kunci: 'B'
    },
    {
      id: 3,
      pertanyaan: 'Prinsip integritas dan tanggung jawab peserta didik ' + INSTITUSI_CONFIG.nama + ' dalam pengerjaan evaluasi CBT adalah:',
      opsi: [
        { k: 'A', t: 'Mengerjakan dengan jujur, mandiri, dan teliti sesuai batas waktu pengerjaan.' },
        { k: 'B', t: 'Berbagi kunci jawaban dengan peserta lain saat jam ujian berlangsung.' },
        { k: 'C', t: 'Meninggalkan sesi ujian sebelum menjawab soal yang tersedia.' },
        { k: 'D', t: 'Menyalin jawaban dari sumber luar tanpa verifikasi logika.' }
      ],
      kunci: 'A'
    },
    {
      id: 4,
      pertanyaan: 'Ciri khas pendidikan kesetaraan ' + jenjang + ' yang membedakannya dengan jalur formal konvensional adalah:',
      opsi: [
        { k: 'A', t: 'Fleksibilitas pembelajaran mandiri berbasis modul vokasional dan kontekstual.' },
        { k: 'B', t: 'Tidak adanya bimbingan dari tutor maupun evaluasi hasil belajar.' },
        { k: 'C', t: 'Hanya diadakan sekali dalam setahun tanpa materi terstruktur.' },
        { k: 'D', t: 'Peserta didik tidak diperbolehkan belajar melalui modul digital.' }
      ],
      kunci: 'A'
    },
    {
      id: 5,
      pertanyaan: 'Langkah yang paling tepat setelah menyelesaikan seluruh bab dalam ' + judul + ' adalah:',
      opsi: [
        { k: 'A', t: 'Melakukan refleksi kompetensi, mengulang bagian yang belum dipahami, dan mengonfirmasi hasil ujian ke penguji.' },
        { k: 'B', t: 'Menghapus modul belajar dan tidak membuka kembali catatan.' },
        { k: 'C', t: 'Mengabaikan evaluasi nilai hasil ujian dari tutor PKBM.' },
        { k: 'D', t: 'Mengganti jenjang belajar tanpa menyelesaikan modul yang sedang berjalan.' }
      ],
      kunci: 'A'
    }
  ];
}

function bukaModalPilihUjianCBT(presetBukuId, presetNamaSiswa) {
  const modal = document.getElementById('modal-pilih-cbt');
  if (!modal) return;

  const selectSiswa = document.getElementById('cbt-pilih-siswa');
  const selectBuku = document.getElementById('cbt-pilih-buku');

  // Populate Siswa
  if (selectSiswa) {
    selectSiswa.innerHTML = '<option value="">-- Pilih Siswa --</option>';
    if (typeof siswaDataList !== 'undefined' && siswaDataList.length > 0) {
      siswaDataList.forEach(s => {
        const sel = (presetNamaSiswa && s.nama === presetNamaSiswa) ? 'selected' : '';
        const kelasLabel = s.kelas ? ` · ${s.kelas}` : '';
        selectSiswa.innerHTML += `<option value="${s.id}" ${sel}>${s.nama} (${s.program || 'Paket C'}${kelasLabel})</option>`;
      });
    } else {
      selectSiswa.innerHTML += '<option value="SISWA-01" selected>Peserta Didik (Umum)</option>';
    }
  }

  // Populate Paket Ujian / Modul CBT
  if (selectBuku) {
    selectBuku.innerHTML = '<option value="">-- Pilih Paket Ujian / Modul CBT --</option>';

    // 1. Paket Soal Kustom dari Bank Soal (UTS, UAS, USP, Placement, Evaluasi Modul)
    if (typeof cbtBankSoalList !== 'undefined' && cbtBankSoalList.length > 0) {
      const optGroupCustom = document.createElement('optgroup');
      optGroupCustom.label = '📝 Paket Ujian Resmi (UTS, UAS, USP & Bank Soal)';
      cbtBankSoalList.forEach(pkt => {
        const jenis = pkt.jenisUjian || 'Ujian';
        const kelas = pkt.kelas && pkt.kelas !== 'Semua Kelas' ? ` · ${pkt.kelas}` : '';
        const opt = document.createElement('option');
        opt.value = 'PAKET:' + pkt.id;
        opt.textContent = `[${jenis}] ${pkt.judul} (${pkt.jenjang}${kelas})`;
        optGroupCustom.appendChild(opt);
      });
      selectBuku.appendChild(optGroupCustom);
    }

    // 2. Evaluasi Mandiri Berbasis Katalog Buku Modul
    if (typeof bukuList !== 'undefined' && bukuList.length > 0) {
      const optGroupBuku = document.createElement('optgroup');
      optGroupBuku.label = '📚 Ujian Mandiri Per Modul Bacaan';
      bukuList.forEach(b => {
        const sel = (presetBukuId && String(b.id) === String(presetBukuId)) ? 'selected' : '';
        const opt = document.createElement('option');
        opt.value = 'BUKU:' + b.id;
        if (sel) opt.selected = true;
        opt.textContent = `${b.nama} [${b.jenjang} · ${b.kelas || 'Kesetaraan'}]`;
        optGroupBuku.appendChild(opt);
      });
      selectBuku.appendChild(optGroupBuku);
    }
  }

  // Aktifkan Searchable Dropdown untuk Pemilihan Siswa & Modul Ujian
  if (typeof makeSearchableSelect === 'function') {
    if (selectSiswa) makeSearchableSelect(selectSiswa, { searchPlaceholder: 'Cari nama peserta ujian...' });
    if (selectBuku) makeSearchableSelect(selectBuku, { searchPlaceholder: 'Cari paket ujian / modul CBT...' });
  }

  const initialVal = selectBuku ? selectBuku.value : '';
  updateCbtInfoPaket(initialVal);

  const inputToken = document.getElementById('cbt-input-token');
  if (inputToken) inputToken.value = '';

  // Jika siswa, sembunyikan bocoran token dari info-card agar siswa memasukkan token resmi dari guru
  const tokenRow = document.getElementById('cbt-info-token-row');
  if (tokenRow) {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'Siswa') {
      tokenRow.style.display = 'none';
    } else {
      tokenRow.style.display = 'flex';
    }
  }

  modal.classList.remove('hidden');
}

function closeModalPilihCBT() {
  const modal = document.getElementById('modal-pilih-cbt');
  if (modal) modal.classList.add('hidden');
}

function updateCbtInfoPaket(pilihanId) {
  const elDurasi = document.getElementById('cbt-info-durasi');
  const elJumlah = document.getElementById('cbt-info-jumlah');
  const elToken = document.getElementById('cbt-info-token');

  if (!pilihanId) {
    if (elDurasi) elDurasi.textContent = '15 - 90 Menit';
    if (elJumlah) elJumlah.textContent = 'Sesuai Paket Ujian';
    if (elToken) elToken.textContent = 'BEESMART';
    return;
  }

  if (pilihanId.startsWith('PAKET:')) {
    const pktId = pilihanId.replace('PAKET:', '');
    const pkt = (typeof cbtBankSoalList !== 'undefined') ? cbtBankSoalList.find(x => x.id === pktId) : null;
    if (pkt) {
      if (elDurasi) elDurasi.textContent = `${pkt.durasiMenit || 30} Menit`;
      if (elJumlah) elJumlah.textContent = `${pkt.soalList ? pkt.soalList.length : 0} Butir Soal`;
      if (elToken) elToken.textContent = pkt.token || pkt.kode || 'BEESMART';
      return;
    }
  }

  // Default untuk buku modul
  if (elDurasi) elDurasi.textContent = '15 Menit';
  if (elJumlah) elJumlah.textContent = '5 Butir Pilihan Ganda (PG)';
  if (elToken) elToken.textContent = 'AURA' + (new Date().getFullYear());
}

function prosesMulaiCBT() {
  const siswaId = document.getElementById('cbt-pilih-siswa').value;
  const pilihanUjian = document.getElementById('cbt-pilih-buku').value;
  const inputToken = (document.getElementById('cbt-input-token')?.value || '').trim().toUpperCase();

  if (!siswaId || !pilihanUjian) {
    Swal.fire('Perhatian', 'Pilih peserta didik dan paket ujian terlebih dahulu!', 'warning');
    return;
  }

  const s = (typeof siswaDataList !== 'undefined' ? siswaDataList.find(x => String(x.id) === String(siswaId)) : null) || { id: siswaId, nama: 'Peserta Didik', program: 'Paket C' };

  if (pilihanUjian.startsWith('PAKET:')) {
    const pktId = pilihanUjian.replace('PAKET:', '');
    const pkt = (typeof cbtBankSoalList !== 'undefined') ? cbtBankSoalList.find(x => x.id === pktId) : null;
    if (!pkt) {
      Swal.fire('Error', 'Paket soal tidak ditemukan!', 'error');
      return;
    }

    // Cek Status Ujian (wajib AKTIF)
    if (pkt.statusUjian && pkt.statusUjian === 'NON AKTIF') {
      Swal.fire('Ujian Terkunci', 'Paket ujian ini saat ini berstatus <b>NON AKTIF</b> (ditutup oleh Guru/Pengawas).', 'warning');
      return;
    }

    // Verifikasi Token Ujian
    const requiredToken = (pkt.token || pkt.kode || 'BEESMART').toUpperCase();
    if (inputToken !== requiredToken) {
      Swal.fire({
        icon: 'error',
        title: 'Token Salah!',
        html: `Token yang Anda masukkan (<b>${inputToken || '-'}</b>) tidak sesuai.<br>Silakan periksa kembali token yang diberikan pengawas ujian.`
      });
      return;
    }

    closeModalPilihCBT();
    launchCbtDariPaketSoal(pkt, s);
  } else {
    const rawBukuId = pilihanUjian.replace('BUKU:', '');
    const b = (typeof bukuList !== 'undefined' ? bukuList.find(x => String(x.id) === String(rawBukuId)) : null);
    if (!b) {
      Swal.fire('Error', 'Buku modul ujian tidak ditemukan!', 'error');
      return;
    }
    closeModalPilihCBT();
    launchCbtBeesmart(b, s);
  }
}

function launchCbtDariPaketSoal(pkt, student) {
  const soalList = (pkt.soalList && pkt.soalList.length > 0)
    ? pkt.soalList
    : generateSoalPaketModul({ nama: pkt.judul, jenjang: pkt.jenjang, kategori: 'Umum' });

  const durasiMenit = pkt.durasiMenit || 30;
  const durasiDetik = durasiMenit * 60;
  const tokenPaket = pkt.token || pkt.kode || 'BEESMART';

  cbtActiveSession = {
    sessionId: 'CBT-' + Date.now(),
    paketId: pkt.id,
    bukuId: pkt.bukuId || pkt.id,
    bukuJudul: pkt.judul,
    program: pkt.jenjang || student.program || 'Paket C',
    siswaId: student.id,
    namaSiswa: student.nama,
    soalList: soalList,
    jawabanSiswa: {},
    raguSiswa: {},
    currentNo: 1,
    sisaDetik: durasiDetik,
    totalDetik: durasiDetik,
    kkm: pkt.kkm || 70,
    jenisUjian: pkt.jenisUjian || 'Ujian'
  };

  const headerMapel = document.getElementById('cbt-header-mapel');
  const headerSiswa = document.getElementById('cbt-header-siswa');
  if (headerMapel) headerMapel.textContent = `${pkt.judul} (${pkt.jenjang}${pkt.kelas ? ' · ' + pkt.kelas : ''})`;
  if (headerSiswa) headerSiswa.textContent = `Peserta: ${student.nama} · Token: ${tokenPaket}`;

  renderCbtGridNomor();
  tampilkanSoalCBT(1);
  saveCbtActiveSessionToStorage();
  startCbtCountdown();

  const modal = document.getElementById('modal-cbt-ujian');
  if (modal) modal.classList.remove('hidden');
}

function launchCbtBeesmart(book, student) {
  // Cek apakah ada paket soal kustom yang dibuat guru di Bank Soal
  let customPaket = null;
  if (typeof cbtBankSoalList !== 'undefined') {
    customPaket = cbtBankSoalList.find(p => String(p.bukuId) === String(book.id) && p.soalList && p.soalList.length > 0);
  }

  const soalList = (customPaket && customPaket.soalList && customPaket.soalList.length > 0)
    ? customPaket.soalList
    : generateSoalPaketModul(book);

  const durasiMenit = (customPaket && customPaket.durasiMenit) ? customPaket.durasiMenit : 15;
  const durasiDetik = durasiMenit * 60;
  const tokenPaket = (customPaket && customPaket.token) ? customPaket.token : 'BEESMART';

  cbtActiveSession = {
    sessionId: 'CBT-' + Date.now(),
    paketId: customPaket ? customPaket.id : null,
    bukuId: book.id,
    bukuJudul: customPaket ? customPaket.judul : book.nama,
    program: student.program || book.jenjang || 'Paket C',
    siswaId: student.id,
    namaSiswa: student.nama,
    soalList: soalList,
    jawabanSiswa: {},
    raguSiswa: {},
    currentNo: 1,
    sisaDetik: durasiDetik,
    totalDetik: durasiDetik
  };

  // Setup Header CBT UI
  const headerMapel = document.getElementById('cbt-header-mapel');
  const headerSiswa = document.getElementById('cbt-header-siswa');
  if (headerMapel) headerMapel.textContent = `${book.nama} (${cbtActiveSession.program})`;
  if (headerSiswa) headerSiswa.textContent = `Peserta: ${student.nama} · Token: BEESMART`;

  // Render Grid Nomor Soal
  renderCbtGridNomor();

  // Tampilkan Soal Pertama
  tampilkanSoalCBT(1);

  // Buka Modal CBT
  const modalCbt = document.getElementById('modal-cbt-ujian');
  if (modalCbt) modalCbt.classList.remove('hidden');

  // Simpan state awal CBT ke storage
  saveCbtActiveSessionToStorage();

  // Jalankan Countdown Timer ala Beesmart
  startCbtCountdown();

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function startCbtCountdown() {
  if (cbtTimerInterval) clearInterval(cbtTimerInterval);
  const timerEl = document.getElementById('cbt-countdown-timer');

  cbtTimerInterval = setInterval(() => {
    if (!cbtActiveSession) {
      clearInterval(cbtTimerInterval);
      return;
    }

    cbtActiveSession.sisaDetik--;

    const m = Math.floor(cbtActiveSession.sisaDetik / 60);
    const s = cbtActiveSession.sisaDetik % 60;
    if (timerEl) {
      timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (cbtActiveSession.sisaDetik <= 120) {
        timerEl.style.color = '#fef08a';
      }
    }

    // Auto-save sisa waktu ujian setiap 5 detik agar jika browser error/mati lampu, waktu tetap akurat
    if (cbtActiveSession.sisaDetik % 5 === 0) {
      saveCbtActiveSessionToStorage();
    }

    if (cbtActiveSession.sisaDetik <= 0) {
      clearInterval(cbtTimerInterval);
      saveCbtActiveSessionToStorage();
      Swal.fire({
        title: 'Waktu Ujian Habis!',
        text: 'Waktu pengerjaan telah berakhir. Jawaban Anda akan diproses secara otomatis.',
        icon: 'info',
        confirmButtonColor: '#059669',
        allowOutsideClick: false
      }).then(() => {
        selesaikanDanHitungNilaiCBT(true);
      });
    }
  }, 1000);
}

function tampilkanSoalCBT(no) {
  if (!cbtActiveSession) return;
  cbtActiveSession.currentNo = no;

  const soal = cbtActiveSession.soalList.find(s => s.id === no);
  if (!soal) return;

  const noEl = document.getElementById('cbt-current-no');
  if (noEl) noEl.textContent = no;

  const soalTextEl = document.getElementById('cbt-soal-text');
  if (soalTextEl) {
    soalTextEl.style.fontSize = cbtFontSizeLevel + 'px';
    soalTextEl.textContent = soal.pertanyaan;
  }

  // Media Lampiran Soal (Gambar, Video Lokal, atau Embed Video YouTube)
  const mediaContainer = document.getElementById('cbt-media-soal-container');
  if (mediaContainer) {
    if (soal.media && soal.media.url) {
      mediaContainer.style.display = 'block';
      if (soal.media.type === 'youtube') {
        const ytId = getYouTubeVideoId(soal.media.url);
        mediaContainer.innerHTML = `
          <div style="background: var(--surface-2); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); width: 100%; max-width: 640px; box-sizing: border-box;">
            <div style="font-size: 12px; font-weight: 700; color: #ef4444; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> Video Pembelajaran (YouTube):
            </div>
            <div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 6px; background: #000;">
              <iframe src="https://www.youtube-nocookie.com/embed/${ytId}?rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position: absolute; top:0; left:0; width: 100%; height: 100%;"></iframe>
            </div>
          </div>
        `;
      } else if (soal.media.type === 'video') {
        mediaContainer.innerHTML = `
          <div style="background: var(--surface-2); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); display: inline-block; max-width: 100%;">
            <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">📽️ Video Lampiran Soal:</div>
            <video controls src="${soal.media.url}" style="max-height: 320px; max-width: 100%; border-radius: 6px; display: block;"></video>
          </div>
        `;
      } else {
        mediaContainer.innerHTML = `
          <div style="background: var(--surface-2); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); display: inline-block; max-width: 100%;">
            <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">🖼️ Gambar Lampiran Soal:</div>
            <img src="${soal.media.url}" style="max-height: 320px; max-width: 100%; object-fit: contain; border-radius: 6px; display: block;" alt="Lampiran Soal">
          </div>
        `;
      }
    } else {
      mediaContainer.style.display = 'none';
      mediaContainer.innerHTML = '';
    }
  }

  // Status Ragu-Ragu
  const isRagu = !!cbtActiveSession.raguSiswa[no];
  const raguBadge = document.getElementById('cbt-ragu-badge');
  const raguCheck = document.getElementById('cbt-check-ragu');
  if (raguBadge) raguBadge.style.display = isRagu ? 'inline-block' : 'none';
  if (raguCheck) raguCheck.checked = isRagu;

  // Render Pilihan Jawaban (Dengan Teks Lengkap & Media Gambar/Video Opsi)
  const opsiContainer = document.getElementById('cbt-opsi-container');
  const jawabanTerpilih = cbtActiveSession.jawabanSiswa[no];

  if (opsiContainer) {
    opsiContainer.innerHTML = soal.opsi.map(op => {
      const isSelected = jawabanTerpilih === op.k;
      const opMedia = op.media;
      return `
        <div class="cbt-opsi-item ${isSelected ? 'selected' : ''}" onclick="pilihJawabanCBT(${no}, '${op.k}')">
          <div class="cbt-opsi-radio">${op.k}</div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
            <div class="cbt-opsi-text" style="font-size: ${cbtFontSizeLevel - 1}px;">${op.t || ''}</div>
            ${opMedia && opMedia.url ? `
              <div style="display: inline-block; background: var(--surface-2); padding: 6px; border-radius: 6px; border: 1px solid var(--border-color); max-width: 100%;">
                ${opMedia.type === 'video'
                  ? `<video controls src="${opMedia.url}" style="max-height: 160px; max-width: 100%; border-radius: 4px; display: block;"></video>`
                  : `<img src="${opMedia.url}" style="max-height: 160px; max-width: 100%; object-fit: contain; border-radius: 4px; display: block;" alt="Media Opsi ${op.k}">`
                }
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Update Tombol Navigasi Prev/Next/Finish
  const totalSoal = cbtActiveSession.soalList.length;
  const btnPrev = document.getElementById('btn-cbt-prev');
  const btnNext = document.getElementById('btn-cbt-next');
  const btnFinish = document.getElementById('btn-cbt-finish');

  if (btnPrev) btnPrev.style.visibility = (no === 1) ? 'hidden' : 'visible';
  if (no === totalSoal) {
    if (btnNext) btnNext.style.display = 'none';
    if (btnFinish) btnFinish.style.display = 'inline-flex';
  } else {
    if (btnNext) btnNext.style.display = 'inline-flex';
    if (btnFinish) btnFinish.style.display = 'none';
  }

  renderCbtGridNomor();
}

function pilihJawabanCBT(no, opsiKey) {
  if (!cbtActiveSession) return;
  cbtActiveSession.jawabanSiswa[no] = opsiKey;
  saveCbtActiveSessionToStorage();
  tampilkanSoalCBT(no);
}

function toggleRaguRagu(isRagu) {
  if (!cbtActiveSession) return;
  const no = cbtActiveSession.currentNo;
  cbtActiveSession.raguSiswa[no] = isRagu;
  saveCbtActiveSessionToStorage();
  const raguBadge = document.getElementById('cbt-ragu-badge');
  if (raguBadge) raguBadge.style.display = isRagu ? 'inline-block' : 'none';
  renderCbtGridNomor();
}

function navigasiSoalCBT(step) {
  if (!cbtActiveSession) return;
  const nextNo = cbtActiveSession.currentNo + step;
  if (nextNo >= 1 && nextNo <= cbtActiveSession.soalList.length) {
    cbtActiveSession.currentNo = nextNo;
    saveCbtActiveSessionToStorage();
    tampilkanSoalCBT(nextNo);
  }
}

function renderCbtGridNomor() {
  if (!cbtActiveSession) return;
  const grid = document.getElementById('cbt-grid-nomor');
  if (!grid) return;

  const total = cbtActiveSession.soalList.length;
  let terjawabCount = 0;

  grid.innerHTML = cbtActiveSession.soalList.map(s => {
    const isAnswered = !!cbtActiveSession.jawabanSiswa[s.id];
    const isRagu = !!cbtActiveSession.raguSiswa[s.id];
    const isActive = s.id === cbtActiveSession.currentNo;

    if (isAnswered) terjawabCount++;

    let kelas = 'cbt-btn-no';
    if (isActive) kelas += ' active';
    if (isRagu) kelas += ' ragu';
    else if (isAnswered) kelas += ' answered';

    return `
      <button class="${kelas}" onclick="tampilkanSoalCBT(${s.id})">
        ${s.id}
        ${isAnswered ? `<span style="position: absolute; bottom: 2px; right: 4px; font-size: 10px; font-weight: 800;">${cbtActiveSession.jawabanSiswa[s.id]}</span>` : ''}
      </button>
    `;
  }).join('');

  const progressCount = document.getElementById('cbt-progress-count');
  if (progressCount) progressCount.textContent = `${terjawabCount} / ${total} Terjawab`;
}

function adjustCbtFontSize(delta) {
  cbtFontSizeLevel = Math.max(13, Math.min(22, cbtFontSizeLevel + delta));
  if (cbtActiveSession) {
    tampilkanSoalCBT(cbtActiveSession.currentNo);
  }
}

function toggleDaftarSoalPanel() {
  const drawer = document.getElementById('cbt-daftar-soal-drawer');
  if (drawer) drawer.classList.toggle('open');
}

function konfirmasiSelesaiCBT() {
  if (!cbtActiveSession) return;
  const total = cbtActiveSession.soalList.length;
  const terjawab = Object.keys(cbtActiveSession.jawabanSiswa).length;
  const sisa = total - terjawab;

  let warningText = 'Apakah Anda yakin ingin menyelesaikan ujian ini?';
  if (sisa > 0) {
    warningText = `Perhatian: Masih ada ${sisa} nomor soal yang belum Anda jawab!`;
  }

  Swal.fire({
    title: 'Konfirmasi Selesai Ujian CBT',
    html: `
      <div style="text-align: left; font-size: 13.5px; color: var(--text-color);">
        <p>${warningText}</p>
        <div style="background: var(--surface-2); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
          <div>📝 <b>Soal Terjawab:</b> ${terjawab} dari ${total} butir</div>
          <div style="margin-top: 4px;">⚠️ <b>Status Ragu:</b> ${Object.keys(cbtActiveSession.raguSiswa).filter(k => cbtActiveSession.raguSiswa[k]).length} nomor</div>
        </div>
      </div>
    `,
    icon: sisa > 0 ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: 'Ya, Kumpulkan Jawaban Selesai',
    cancelButtonText: 'Lanjutkan Mengerjakan',
    confirmButtonColor: '#059669'
  }).then(res => {
    if (res.isConfirmed) {
      selesaikanDanHitungNilaiCBT(false);
    }
  });
}

function selesaikanDanHitungNilaiCBT(isTimeUp) {
  if (!cbtActiveSession) return;
  if (cbtTimerInterval) clearInterval(cbtTimerInterval);

  const session = { ...cbtActiveSession };
  const total = session.soalList.length;
  let benar = 0;

  session.soalList.forEach(s => {
    if (session.jawabanSiswa[s.id] === s.kunci) {
      benar++;
    }
  });

  const skorNilai = Math.round((benar / total) * 100);
  let predikat = 'Perlu Bimbingan (D)';
  if (skorNilai >= 85) predikat = 'Sangat Baik (A)';
  else if (skorNilai >= 75) predikat = 'Baik (B)';
  else if (skorNilai >= 60) predikat = 'Cukup (C)';

  // Ambil penguji aktif (Tutor/Guru/Admin dengan jabatan)
  let pengujiNama = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nama : 'Tutor Evaluator PKBM';
  let pengujiJabatan = 'Tutor / Guru Penguji';
  let pengujiNip = '';
  let pengujiTtd = '';

  try {
    const storedUsers = JSON.parse(localStorage.getItem('ppdb_users_meta') || '[]');
    const activeMeta = storedUsers.find(x => currentUser && (x.username === currentUser.username || x.nama === currentUser.nama));
    if (activeMeta) {
      pengujiNama = activeMeta.nama;
      pengujiJabatan = activeMeta.jabatan || pengujiJabatan;
      pengujiNip = activeMeta.nip || '';
      pengujiTtd = activeMeta.ttd || '';
    } else {
      const kepala = storedUsers.find(x => x.jabatan === 'Kepala PKBM' || x.role === 'Admin');
      if (kepala) {
        pengujiJabatan = kepala.jabatan || 'Kepala PKBM';
        pengujiTtd = kepala.ttd || '';
        pengujiNip = kepala.nip || '';
      }
    }
  } catch (e) {}

  const hasilUjianBaru = {
    id: 'EX-' + Date.now(),
    tanggal: new Date().toLocaleDateString('id-ID'),
    siswaId: session.siswaId,
    namaSiswa: session.namaSiswa,
    program: session.program,
    bukuJudul: session.bukuJudul,
    nilai: skorNilai,
    predikat: predikat,
    catatan: `Ujian CBT Mandiri (${benar} dari ${total} soal benar). ${isTimeUp ? '[Waktu Selesai Otomatis]' : '[Selesai Tepat Waktu]'}`,
    penguji: `${pengujiNama} (${pengujiJabatan})`,
    pengujiJabatan: pengujiJabatan,
    pengujiNip: pengujiNip,
    pengujiTtd: pengujiTtd
  };

  if (typeof ujianHasilList !== 'undefined') {
    ujianHasilList.unshift(hasilUjianBaru);
  }
  saveUjianListToStorage();
  renderUjianTable();

  // 🔔 Kirim Web Push Notification ke Admin & Siswa terkait status hasil ujian
  if (typeof window.sendAppPushNotification === 'function') {
    // 1. Notifikasi ke Admin: Siswa telah menyelesaikan ujian
    window.sendAppPushNotification({
      title: 'Ujian Diselesaikan 📝',
      body: `Siswa ${hasilUjianBaru.namaSiswa} telah menyelesaikan ujian ${hasilUjianBaru.bukuJudul} dengan skor ${skorNilai} (${predikat}).`,
      url: '/portal',
      targetRole: 'Admin',
      tag: 'exam-finished-admin'
    });

    // 2. Notifikasi ke Siswa itu sendiri jika punya akun login: Hasil Ujian Tersedia
    if (session.siswaUsername) {
      window.sendAppPushNotification({
        title: 'Hasil Ujian CBT Anda 🎓',
        body: `Ujian ${hasilUjianBaru.bukuJudul} selesai: Nilai Anda ${skorNilai} (${predikat}). Klik untuk melihat sertifikat.`,
        url: '/portal',
        targetUsername: session.siswaUsername,
        tag: 'exam-score-student'
      });
    }
  }

  // Tutup Modal CBT & Bersihkan State Sesi Ujian
  const modalCbt = document.getElementById('modal-cbt-ujian');
  if (modalCbt) modalCbt.classList.add('hidden');
  if (cbtTimerInterval) clearInterval(cbtTimerInterval);
  cbtActiveSession = null;
  saveCbtActiveSessionToStorage(); // Menghapus key ppdb_cbt_active_session dari localStorage

  // Dialog Skor Hasil CBT
  Swal.fire({
    title: 'Hasil Ujian CBT Mandiri 🎉',
    html: `
      <div style="text-align: center; color: var(--text-color);">
        <p>Selamat <b>${hasilUjianBaru.namaSiswa}</b>, ujian modul CBT telah berhasil diselesaikan!</p>
        <div style="margin: 16px auto; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 16px; max-width: 380px;">
          <div style="font-size: 13px; color: #166534;">Mata Uji: <b>${hasilUjianBaru.bukuJudul}</b></div>
          <div style="font-size: 36px; font-weight: 900; color: #15803d; margin: 8px 0;">${skorNilai}</div>
          <div style="font-size: 14px; font-weight: 700; color: #166534;">${predikat} · ${benar}/${total} Soal Benar</div>
          <div style="font-size: 12px; color: #15803d; margin-top: 4px;">${skorNilai >= 70 ? 'STATUS: LULUS KOMPETEN ✅' : 'STATUS: REMEDIAL ⚠️'}</div>
        </div>
        <p style="font-size: 12px; color: var(--text-muted);">Nilai telah otomatis tersimpan ke rapor dan siap dicetak sertifikat kelulusan modulnya.</p>
      </div>
    `,
    icon: skorNilai >= 70 ? 'success' : 'info',
    showCancelButton: true,
    confirmButtonText: '📜 Lihat Sertifikat & Transkrip',
    cancelButtonText: 'Tutup',
    confirmButtonColor: '#059669'
  }).then(r => {
    if (r.isConfirmed) {
      cetakSertifikatResmiMyAura(hasilUjianBaru.id);
    }
  });
}


// =============================================================================
// SISTEM KELOLA BANK SOAL CBT (PEMBUATAN PAKET SOAL & BUTIR SOAL PILIHAN GANDA)
// =============================================================================

let cbtBankSoalList = [];
let editingButirList = [];
let activePaketSoalId = null;

function initBankSoalData() {
  try {
    const saved = localStorage.getItem('cbt_bank_soal_list');
    if (saved) {
      cbtBankSoalList = JSON.parse(saved);
    }
  } catch (e) {}

  if (!cbtBankSoalList || cbtBankSoalList.length === 0) {
    cbtBankSoalList = [
      {
        id: 'PKT-001',
        kode: 'CBT-PKC-01',
        token: 'AURA2026',
        jenjang: 'Paket C',
        bukuId: 'BK-001',
        judul: 'Evaluasi Akhir Modul 1: Bahasa Indonesia Menggapai Cita-Cita',
        durasiMenit: 15,
        kkm: 70,
        pembuat: 'Tutor Penguji PKBM',
        tanggal: new Date().toLocaleDateString('id-ID'),
        soalList: [
          {
            id: 1,
            pertanyaan: 'Apakah tujuan utama dari pembelajaran modul kesetaraan Bahasa Indonesia Paket C ini?',
            opsi: [
              { k: 'A', t: 'Meningkatkan pemahaman konsep dasar dan kompetensi literasi terapan di masyarakat.' },
              { k: 'B', t: 'Hanya sekadar menghafalkan definisi materi tanpa praktik langsung.' },
              { k: 'C', t: 'Memperoleh sertifikat tanpa memahami isi modul materi pembelajaran.' },
              { k: 'D', t: 'Menghindari proses evaluasi pembelajaran mandiri.' }
            ],
            kunci: 'A'
          },
          {
            id: 2,
            pertanyaan: 'Metode pemecahan masalah yang paling tepat ketika menganalisis teks eksposisi dan artikel ilmiah adalah:',
            opsi: [
              { k: 'A', t: 'Menyimpulkan langsung tanpa meninjau fakta atau data yang relevan.' },
              { k: 'B', t: 'Melakukan analisis terstruktur, mengidentifikasi argumen, lalu menyusun alternatif simpulan.' },
              { k: 'C', t: 'Menunggu arahan orang lain tanpa inisiatif analisis mandiri.' },
              { k: 'D', t: 'Mengabaikan fakta empiris di dalam bahan bacaan.' }
            ],
            kunci: 'B'
          },
          {
            id: 3,
            pertanyaan: 'Prinsip integritas peserta didik PKBM Aura Anugerah dalam pengerjaan evaluasi CBT adalah:',
            opsi: [
              { k: 'A', t: 'Mengerjakan dengan jujur, mandiri, dan teliti sesuai alokasi waktu.' },
              { k: 'B', t: 'Berbagi kunci jawaban dengan peserta lain saat jam ujian berlangsung.' },
              { k: 'C', t: 'Meninggalkan sesi ujian sebelum menjawab butir soal.' },
              { k: 'D', t: 'Menyalin jawaban dari internet tanpa verifikasi materi.' }
            ],
            kunci: 'A'
          },
          {
            id: 4,
            pertanyaan: 'Karakteristik modul pendidikan kesetaraan yang membedakannya dengan materi formal adalah:',
            opsi: [
              { k: 'A', t: 'Fleksibilitas belajar mandiri yang berbasis aplikasi praktis kontekstual.' },
              { k: 'B', t: 'Tidak adanya bimbingan dari tutor maupun evaluasi berkala.' },
              { k: 'C', t: 'Materi tidak terstruktur dan tidak berpedoman kurikulum.' },
              { k: 'D', t: 'Peserta didik tidak diperbolehkan belajar mandiri secara daring.' }
            ],
            kunci: 'A'
          },
          {
            id: 5,
            pertanyaan: 'Langkah tepat yang dilakukan peserta didik setelah menyelesaikan seluruh unit pada modul adalah:',
            opsi: [
              { k: 'A', t: 'Melakukan refleksi kompetensi, mengulang bab yang belum tuntas, dan mengikuti tes evaluasi CBT.' },
              { k: 'B', t: 'Menutup modul belajar tanpa melakukan review pemahaman.' },
              { k: 'C', t: 'Mengabaikan hasil skor ujian dari tutor PKBM.' },
              { k: 'D', t: 'Pindah ke modul lain sebelum menyelesaikan ujian modul saat ini.' }
            ],
            kunci: 'A'
          }
        ]
      },
      {
        id: 'PKT-002',
        kode: 'CBT-PKB-01',
        token: 'BEESMART',
        jenjang: 'Paket B',
        bukuId: 'BK-002',
        judul: 'Evaluasi Pembelajaran Mandiri Modul IPA Terpadu',
        durasiMenit: 20,
        kkm: 70,
        pembuat: 'Tutor Penguji PKBM',
        tanggal: new Date().toLocaleDateString('id-ID'),
        soalList: [
          {
            id: 1,
            pertanyaan: 'Komponen biotik dalam suatu ekosistem alamiah dicirikan oleh adanya:',
            opsi: [
              { k: 'A', t: 'Makhluk hidup seperti tumbuhan, hewan, dan mikroorganisme pengurai.' },
              { k: 'B', t: 'Batu-batuan, air tanah, dan udara lembap.' },
              { k: 'C', t: 'Cahaya matahari dan tingkat keasaman tanah saja.' },
              { k: 'D', t: 'Suhu lingkungan dan intensitas angin pegunungan.' }
            ],
            kunci: 'A'
          },
          {
            id: 2,
            pertanyaan: 'Upaya pelestarian keanekaragaman hayati secara in-situ dapat dilakukan melalui:',
            opsi: [
              { k: 'A', t: 'Pendirian taman nasional dan cagar alam di habitat aslinya.' },
              { k: 'B', t: 'Penangkaran hewan langka di kebun binatang kota.' },
              { k: 'C', t: 'Penebangan hutan secara terbuka tanpa reboisasi.' },
              { k: 'D', t: 'Pembangunan pusat perbelanjaan di wilayah hutan lindung.' }
            ],
            kunci: 'A'
          },
          {
            id: 3,
            pertanyaan: 'Perubahan wujud zat dari cair menjadi gas akibat peningkatan suhu dinamakan proses:',
            opsi: [
              { k: 'A', t: 'Penguapan (evaporasi).' },
              { k: 'B', t: 'Penyubliman.' },
              { k: 'C', t: 'Pembekuan.' },
              { k: 'D', t: 'Pengembunan (kondensasi).' }
            ],
            kunci: 'A'
          }
        ]
      }
    ];
    saveBankSoalToStorage();
  }
}

function saveBankSoalToStorage() {
  try {
    localStorage.setItem('cbt_bank_soal_list', JSON.stringify(cbtBankSoalList));
  } catch (e) {}
}

function switchUjianSubTab(tabName) {
  const tabBank = document.getElementById('subtab-bank-soal');
  const tabHasil = document.getElementById('subtab-hasil-ujian');
  const tabSiswa = document.getElementById('subtab-siswa-cbt');
  const btnBank = document.getElementById('tab-btn-bank-soal');
  const btnHasil = document.getElementById('tab-btn-hasil-ujian');
  const btnSiswa = document.getElementById('tab-btn-siswa-cbt');

  // Reset tab active indicators
  [btnBank, btnHasil, btnSiswa].forEach(b => {
    if (b) {
      b.style.borderBottom = '2px solid transparent';
      b.style.color = 'var(--text-muted)';
      b.style.fontWeight = '600';
    }
  });

  if (tabBank) tabBank.classList.add('hidden');
  if (tabHasil) tabHasil.classList.add('hidden');
  if (tabSiswa) tabSiswa.classList.add('hidden');

  if (tabName === 'bank-soal') {
    if (tabBank) tabBank.classList.remove('hidden');
    if (btnBank) {
      btnBank.style.borderBottom = '2px solid var(--primary-color)';
      btnBank.style.color = 'var(--primary-color)';
      btnBank.style.fontWeight = '700';
    }
    renderBankSoalTable();
  } else if (tabName === 'siswa-cbt') {
    if (tabSiswa) tabSiswa.classList.remove('hidden');
    if (btnSiswa) {
      btnSiswa.style.borderBottom = '2px solid #059669';
      btnSiswa.style.color = '#059669';
      btnSiswa.style.fontWeight = '700';
    }
    renderUjianKhususSiswa();
  } else {
    if (tabHasil) tabHasil.classList.remove('hidden');
    if (btnHasil) {
      btnHasil.style.borderBottom = '2px solid var(--primary-color)';
      btnHasil.style.color = 'var(--primary-color)';
      btnHasil.style.fontWeight = '700';
    }
    if (typeof loadUjianData === 'function') loadUjianData();
  }
}

function toggleStatusUjianPaket(id) {
  const pkt = cbtBankSoalList.find(x => x.id === id);
  if (!pkt) return;

  const current = (pkt.statusUjian || 'AKTIF');
  pkt.statusUjian = (current === 'AKTIF') ? 'NON AKTIF' : 'AKTIF';
  saveBankSoalToStorage();
  renderBankSoalTable();

  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: pkt.statusUjian === 'AKTIF' ? 'success' : 'info',
    title: `Ujian ${pkt.kode} sekarang ${pkt.statusUjian}!`,
    showConfirmButton: false,
    timer: 2500
  });
}

function regenerateTokenPaketSoal(id) {
  const pkt = cbtBankSoalList.find(x => x.id === id);
  if (!pkt) return;

  const newToken = 'AURA' + Math.floor(1000 + Math.random() * 9000);
  pkt.token = newToken;
  saveBankSoalToStorage();
  renderBankSoalTable();

  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: `Token Ujian Diperbarui: ${newToken}`,
    showConfirmButton: false,
    timer: 3000
  });
}

function generateRandomTokenPaket() {
  const tokenEl = document.getElementById('paket-token-input');
  if (tokenEl) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    tokenEl.value = res;
  }
}

function renderUjianKhususSiswa() {
  const gridContainer = document.getElementById('grid-siswa-ujian-cards');
  const countBadge = document.getElementById('count-siswa-cbt');
  const badgeIdentitas = document.getElementById('siswa-cbt-identity-badge');
  if (!gridContainer) return;

  // Cek profil siswa login
  let studentProgram = 'Paket C';
  let studentKelas = 'Kelas X';
  let studentNama = 'Peserta Didik';
  let studentId = '';

  if (typeof currentUser !== 'undefined' && currentUser && currentUser.dataSiswa) {
    const ds = currentUser.dataSiswa;
    studentProgram = ds.program || studentProgram;
    studentKelas = ds.kelas || studentKelas;
    studentNama = ds.nama || currentUser.nama || studentNama;
    studentId = ds.id || '';
  }

  if (badgeIdentitas) {
    badgeIdentitas.textContent = `Peserta: ${studentNama} (${studentProgram} · ${studentKelas})`;
  }

  // Filter paket soal: statusUjian == 'AKTIF', dan jenjang cocok, serta kelas cocok (atau Semua Kelas)
  const availableExams = cbtBankSoalList.filter(pkt => {
    const isAktif = (pkt.statusUjian || 'AKTIF') === 'AKTIF';
    const matchJenjang = !pkt.jenjang || pkt.jenjang === studentProgram;
    const matchKelas = !pkt.kelas || pkt.kelas === 'Semua Kelas' || pkt.kelas === studentKelas;
    return isAktif && matchJenjang && matchKelas;
  });

  if (countBadge) countBadge.textContent = availableExams.length;

  if (availableExams.length === 0) {
    gridContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; background: var(--surface-color); border: 2px dashed var(--border-color); border-radius: 12px; color: var(--text-muted);">
        <i data-lucide="check-circle" style="width: 48px; height: 48px; margin-bottom: 12px; color: #059669; opacity: 0.8;"></i>
        <h4 style="margin: 0; color: var(--text-color); font-size: 16px;">Belum Ada Jadwal Ujian Aktif</h4>
        <p style="margin: 6px 0 0; font-size: 13px;">Tidak ada paket ujian yang sedang dibuka untuk jenjang <b>${studentProgram} (${studentKelas})</b> saat ini. Hubungi Guru atau Pengawas jika ada jadwal ujian Anda.</p>
      </div>
    `;
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    return;
  }

  gridContainer.innerHTML = availableExams.map(pkt => {
    const countButir = pkt.soalList ? pkt.soalList.length : 0;
    return `
      <div class="card" style="background: var(--surface-color); border: 1.5px solid var(--border-color); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-sm); transition: transform 0.2s, border-color 0.2s;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 10px;">
            <span style="font-family: monospace; font-weight: 800; background: #ecfdf5; color: #047857; padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid #a7f3d0;">
              ${pkt.kode}
            </span>
            <span class="tag pusat" style="font-size: 11px;">🟢 Siap Dikerjakan</span>
          </div>
          <h3 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 700; color: var(--text-color); line-height: 1.4;">${pkt.judul}</h3>
          <p style="margin: 0 0 12px 0; font-size: 12px; color: var(--text-muted);">${pkt.instruksi || 'Pilihlah salah satu jawaban yang paling tepat.'}</p>

          <div style="background: var(--surface-2); border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">⏱️ Durasi Waktu:</span>
              <strong style="color: var(--text-color);">${pkt.durasiMenit || 15} Menit</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">📝 Jumlah Pertanyaan:</span>
              <strong style="color: var(--text-color);">${countButir} Butir Soal</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">🎯 Standar Kelulusan (KKM):</span>
              <strong style="color: #059669;">Nilai ${pkt.kkm || 70}</strong>
            </div>
          </div>
        </div>

        <button type="button" class="btn" onclick="mulaiUjianLangsungSiswa('${pkt.id}')" style="width: 100%; justify-content: center; background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; font-weight: 700; height: 40px; border: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); font-size: 13.5px; cursor: pointer;">
          <i data-lucide="play" style="width: 16px; height: 16px;"></i> Masuk & Kerjakan Ujian
        </button>
      </div>
    `;
  }).join('');

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function mulaiUjianLangsungSiswa(paketId) {
  const pkt = cbtBankSoalList.find(x => x.id === paketId);
  if (!pkt) return;

  // Buka modal konfirmasi dengan token
  bukaModalPilihUjianCBT(null, 'PAKET:' + pkt.id);
}

function renderBankSoalTable() {
  const tbody = document.getElementById('table-bank-soal-body');
  if (!tbody) return;

  const query = (document.getElementById('search-bank-soal')?.value || '').toLowerCase().trim();
  const jenjangFilter = document.getElementById('filter-soal-jenjang')?.value || '';

  const filtered = cbtBankSoalList.filter(pkt => {
    const mQuery = !query || pkt.judul.toLowerCase().includes(query) || pkt.kode.toLowerCase().includes(query) || (pkt.pembuat || '').toLowerCase().includes(query) || (pkt.jenisUjian || '').toLowerCase().includes(query);
    const mJenjang = !jenjangFilter || pkt.jenjang === jenjangFilter;
    return mQuery && mJenjang;
  });

  const countEl = document.getElementById('count-paket-soal');
  if (countEl) countEl.textContent = cbtBankSoalList.length;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">Tidak ada paket soal CBT yang cocok. Silakan klik tombol <b>Buat Paket Soal Baru</b> di atas.</td></tr>';
    return;
  }

  const jenisBadges = {
    'UTS': '<span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 700;">📝 UTS / PTS</span>',
    'UAS': '<span class="badge" style="background: #fef3c7; color: #b45309; font-weight: 700;">🎓 UAS / PAS</span>',
    'Ujian Sekolah': '<span class="badge" style="background: #f3e8ff; color: #7e22ce; font-weight: 700;">🏛️ USP / Kelulusan</span>',
    'Placement Test': '<span class="badge" style="background: #fee2e2; color: #b91c1c; font-weight: 700;">🎯 Placement</span>',
    'Evaluasi Modul': '<span class="badge" style="background: #ecfdf5; color: #047857; font-weight: 700;">📖 Evaluasi Modul</span>'
  };

  tbody.innerHTML = filtered.map((pkt, idx) => {
    const countButir = pkt.soalList ? pkt.soalList.length : 0;
    const badgeJenis = jenisBadges[pkt.jenisUjian] || jenisBadges['Evaluasi Modul'];
    const targetKelas = pkt.kelas || 'Semua Kelas';
    const isAktif = (pkt.statusUjian || 'AKTIF') === 'AKTIF';

    return [
      '<tr>',
        '<td>' + (idx + 1) + '</td>',
        '<td>',
          '<div style="display: flex; align-items: center; gap: 4px;">',
            '<span style="font-family: monospace; font-weight: 800; background: #eff6ff; color: #1e40af; padding: 2px 8px; border-radius: 4px; letter-spacing: 1px;">' + pkt.kode + '</span>',
          '</div>',
          '<div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">',
            '<span style="font-size: 11px; color: var(--text-muted);">Token:</span>',
            '<span style="font-family: monospace; font-weight: 800; background: #fef3c7; color: #b45309; padding: 1px 6px; border-radius: 4px; letter-spacing: 1.5px; font-size: 11.5px;">' + (pkt.token || 'BEESMART') + '</span>',
            '<button type="button" class="btn btn-sm btn-icon" onclick="regenerateTokenPaketSoal(\'' + pkt.id + '\')" title="Refresh / Buat Token Baru" style="width: 22px; height: 22px; padding: 0;">',
              '<i data-lucide="refresh-cw" style="width: 12px; height: 12px;"></i>',
            '</button>',
          '</div>',
        '</td>',
        '<td>',
          '<div style="margin-bottom: 3px;">' + badgeJenis + '</div>',
          '<strong style="color: var(--text-color); font-size: 13.5px;">' + pkt.judul + '</strong>',
          '<div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">Tgl: ' + (pkt.tanggal || '-') + ' · KKM: ' + (pkt.kkm || 70) + '</div>',
        '</td>',
        '<td>',
          '<span class="tag def">' + pkt.jenjang + '</span>',
          '<div style="font-size: 11px; color: var(--text-muted); margin-top: 3px;">' + targetKelas + '</div>',
        '</td>',
        '<td><span style="font-weight: 700; color: var(--primary-color);">⏱️ ' + pkt.durasiMenit + ' Menit</span></td>',
        '<td>',
          '<span class="badge" style="background: ' + (countButir > 0 ? '#dcfce7' : '#fee2e2') + '; color: ' + (countButir > 0 ? '#15803d' : '#b91c1c') + '; font-weight: 700;">',
            countButir + ' Butir Soal',
          '</span>',
        '</td>',
        '<td>',
          '<button type="button" class="btn btn-sm" onclick="toggleStatusUjianPaket(\'' + pkt.id + '\')" style="background: ' + (isAktif ? '#059669' : '#dc2626') + '; color: #ffffff; border: none; font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 6px; cursor: pointer;" title="Klik untuk mengubah status buka/tutup ujian">',
            (isAktif ? '🟢 AKTIF' : '🔴 NON AKTIF'),
          '</button>',
        '</td>',
        '<td><small style="color: var(--text-muted);">' + (pkt.pembuat || 'Tutor') + '</small></td>',
        '<td style="text-align: right;">',
          '<div style="display: inline-flex; gap: 6px;">',
            '<button class="btn btn-sm" style="background: #059669; color: #fff; border: none; font-size: 12px; padding: 5px 10px;" onclick="bukaKelolaButirSoal(\'' + pkt.id + '\')" title="Kelola Pertanyaan & Kunci Jawaban">',
              '📝 Butir Soal (' + countButir + ')',
            '</button>',
            '<button class="btn btn-sm btn-icon" onclick="editPaketSoal(\'' + pkt.id + '\')" title="Edit Paket Ujian">',
              '<i data-lucide="edit" style="width: 14px; height: 14px;"></i>',
            '</button>',
            '<button class="btn btn-sm btn-icon btn-danger-text" onclick="hapusPaketSoal(\'' + pkt.id + '\')" title="Hapus Paket Soal">',
              '<i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>',
            '</button>',
          '</div>',
        '</td>',
      '</tr>'
    ].join('');
  }).join('');

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function onJenisUjianChange(jenis) {
  const grpBuku = document.getElementById('group-paket-buku');
  const judulInput = document.getElementById('paket-judul');
  const durasiInput = document.getElementById('paket-durasi-menit');

  if (jenis === 'UTS') {
    if (durasiInput) durasiInput.value = '60';
    if (judulInput && (!judulInput.value || judulInput.value.startsWith('Evaluasi'))) {
      judulInput.value = 'Penilaian Tengah Semester (PTS) Ganjil';
    }
  } else if (jenis === 'UAS') {
    if (durasiInput) durasiInput.value = '90';
    if (judulInput && (!judulInput.value || judulInput.value.startsWith('Evaluasi'))) {
      judulInput.value = 'Penilaian Akhir Semester (PAS) Genap';
    }
  } else if (jenis === 'Ujian Sekolah') {
    if (durasiInput) durasiInput.value = '90';
    if (judulInput && (!judulInput.value || judulInput.value.startsWith('Evaluasi'))) {
      judulInput.value = 'Ujian Satuan Pendidikan (USP) Kelulusan';
    }
  } else if (jenis === 'Placement Test') {
    if (durasiInput) durasiInput.value = '45';
    if (judulInput && (!judulInput.value || judulInput.value.startsWith('Evaluasi'))) {
      judulInput.value = 'Asesmen Diagnostik / Penempatan Siswa Baru';
    }
  } else {
    // Evaluasi Modul
    if (durasiInput) durasiInput.value = '15';
  }
}

function showModalTambahSoal() {
  const form = document.getElementById('form-paket-soal');
  if (form) form.reset();

  document.getElementById('paket-soal-id').value = '';
  document.getElementById('modal-paket-soal-title').textContent = 'Buat Paket Soal CBT Baru';
  document.getElementById('paket-kode-token').value = 'CBT-' + Math.random().toString(36).substring(2, 7).toUpperCase();
  document.getElementById('paket-jenis-ujian').value = 'Evaluasi Modul';
  document.getElementById('paket-jenjang').value = 'Paket C';
  document.getElementById('paket-kelas').value = 'Kelas X';

  filterBukuSelectForPaket('Paket C');

  const modal = document.getElementById('modal-form-paket-soal');
  if (modal) modal.classList.remove('hidden');
}

function closeModalFormPaketSoal() {
  const modal = document.getElementById('modal-form-paket-soal');
  if (modal) modal.classList.add('hidden');
}

function filterBukuSelectForPaket(jenjang) {
  // Sinkronkan pilihan target kelas
  const selKelas = document.getElementById('paket-kelas');
  if (selKelas) {
    if (jenjang === 'Paket A') {
      selKelas.innerHTML = `
        <option value="Semua Kelas">Semua Kelas Paket A</option>
        <option value="Kelas IV">Kelas IV (Paket A)</option>
        <option value="Kelas V">Kelas V (Paket A)</option>
        <option value="Kelas VI">Kelas VI (Paket A)</option>
      `;
    } else if (jenjang === 'Paket B') {
      selKelas.innerHTML = `
        <option value="Semua Kelas">Semua Kelas Paket B</option>
        <option value="Kelas VII">Kelas VII (Paket B)</option>
        <option value="Kelas VIII">Kelas VIII (Paket B)</option>
        <option value="Kelas IX">Kelas IX (Paket B)</option>
      `;
    } else {
      selKelas.innerHTML = `
        <option value="Semua Kelas">Semua Kelas Paket C</option>
        <option value="Kelas X" selected>Kelas X (Paket C)</option>
        <option value="Kelas XI">Kelas XI (Paket C)</option>
        <option value="Kelas XII">Kelas XII (Paket C)</option>
      `;
    }
  }

  const selBuku = document.getElementById('paket-buku-id');
  if (!selBuku) return;

  selBuku.innerHTML = '<option value="">-- Pilih Buku / Modul Pelajaran (Opsional untuk UTS/UAS) --</option>';
  if (typeof bukuList !== 'undefined') {
    const list = bukuList.filter(b => !jenjang || b.jenjang === jenjang || b.jenjang === 'Umum');
    list.forEach(b => {
      selBuku.innerHTML += '<option value="' + b.id + '">' + b.nama + ' [' + (b.mapel || b.kategori || 'Umum') + ' · ' + (b.kelas || 'Semua') + ']</option>';
    });
  }

  if (typeof makeSearchableSelect === 'function') {
    makeSearchableSelect(selBuku, { searchPlaceholder: 'Cari modul pelajaran...' });
  }
}

function isiJudulOtomatisDariBuku(bukuId) {
  if (!bukuId) return;
  const b = (typeof bukuList !== 'undefined') ? bukuList.find(x => String(x.id) === String(bukuId)) : null;
  if (b) {
    const judulInput = document.getElementById('paket-judul');
    const jenis = document.getElementById('paket-jenis-ujian')?.value || 'Evaluasi Modul';
    if (judulInput && !judulInput.value) {
      if (jenis === 'UTS') {
        judulInput.value = 'PTS / UTS ' + (b.mapel || b.kategori || '') + ' - ' + b.nama;
      } else if (jenis === 'UAS') {
        judulInput.value = 'PAS / UAS ' + (b.mapel || b.kategori || '') + ' - ' + b.nama;
      } else {
        judulInput.value = 'Evaluasi Akhir Modul: ' + b.nama;
      }
    }
  }
}

function editPaketSoal(id) {
  const pkt = cbtBankSoalList.find(x => x.id === id);
  if (!pkt) return;

  document.getElementById('paket-soal-id').value = pkt.id;
  document.getElementById('modal-paket-soal-title').textContent = 'Edit Paket Soal CBT';
  document.getElementById('paket-kode-token').value = pkt.kode || '';
  document.getElementById('paket-jenis-ujian').value = pkt.jenisUjian || 'Evaluasi Modul';
  document.getElementById('paket-jenjang').value = pkt.jenjang || 'Paket C';
  document.getElementById('paket-kelas').value = pkt.kelas || 'Semua Kelas';
  filterBukuSelectForPaket(pkt.jenjang);
  document.getElementById('paket-buku-id').value = pkt.bukuId || '';
  document.getElementById('paket-judul').value = pkt.judul || '';
  document.getElementById('paket-durasi-menit').value = pkt.durasiMenit || 15;
  document.getElementById('paket-kkm').value = pkt.kkm || 70;
  document.getElementById('paket-instruksi').value = pkt.instruksi || '';
  document.getElementById('paket-token-input').value = pkt.token || 'BEESMART';
  document.getElementById('paket-status-ujian').value = pkt.statusUjian || 'AKTIF';

  const modal = document.getElementById('modal-form-paket-soal');
  if (modal) modal.classList.remove('hidden');
}

function simpanPaketSoalBaru() {
  const id = document.getElementById('paket-soal-id').value;
  const kode = document.getElementById('paket-kode-token').value.trim().toUpperCase();
  const token = (document.getElementById('paket-token-input')?.value.trim().toUpperCase()) || 'BEESMART';
  const statusUjian = document.getElementById('paket-status-ujian')?.value || 'AKTIF';
  const jenisUjian = document.getElementById('paket-jenis-ujian').value;
  const jenjang = document.getElementById('paket-jenjang').value;
  const kelas = document.getElementById('paket-kelas').value;
  const bukuId = document.getElementById('paket-buku-id').value;
  const judul = document.getElementById('paket-judul').value.trim();
  const durasiMenit = parseInt(document.getElementById('paket-durasi-menit').value, 10) || 15;
  const kkm = parseInt(document.getElementById('paket-kkm').value, 10) || 70;
  const instruksi = document.getElementById('paket-instruksi').value.trim();

  const pembuat = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nama : 'Tutor PKBM';

  if (!judul) {
    Swal.fire('Peringatan', 'Judul paket soal ujian wajib diisi!', 'warning');
    return;
  }

  if (id) {
    const pkt = cbtBankSoalList.find(x => x.id === id);
    if (pkt) {
      pkt.kode = kode;
      pkt.token = token;
      pkt.statusUjian = statusUjian;
      pkt.jenisUjian = jenisUjian;
      pkt.jenjang = jenjang;
      pkt.kelas = kelas;
      pkt.bukuId = bukuId;
      pkt.judul = judul;
      pkt.durasiMenit = durasiMenit;
      pkt.kkm = kkm;
      pkt.instruksi = instruksi;
    }
  } else {
    const newPaket = {
      id: 'PKT-' + Date.now(),
      kode: kode || ('CBT-' + Date.now().toString().slice(-4)),
      token: token || 'BEESMART',
      statusUjian: statusUjian,
      jenisUjian: jenisUjian,
      jenjang: jenjang,
      kelas: kelas,
      bukuId: bukuId,
      judul: judul,
      durasiMenit: durasiMenit,
      kkm: kkm,
      instruksi: instruksi,
      pembuat: pembuat,
      tanggal: new Date().toLocaleDateString('id-ID'),
      soalList: []
    };
    cbtBankSoalList.unshift(newPaket);
  }

  saveBankSoalToStorage();
  closeModalFormPaketSoal();
  renderBankSoalTable();

  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: 'Paket Ujian (' + jenisUjian + ') Berhasil Disimpan!',
    showConfirmButton: false,
    timer: 3000
  });
}

function hapusPaketSoal(id) {
  Swal.fire({
    title: 'Hapus Paket Soal Ini?',
    text: 'Paket soal beserta seluruh butir pertanyaan di dalamnya akan dihapus.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus',
    confirmButtonColor: 'var(--danger-color)',
    cancelButtonText: 'Batal'
  }).then(res => {
    if (res.isConfirmed) {
      cbtBankSoalList = cbtBankSoalList.filter(x => x.id !== id);
      saveBankSoalToStorage();
      renderBankSoalTable();
      Swal.fire('Terhapus', 'Paket soal telah dihapus dari bank CBT.', 'success');
    }
  });
}

// ==================== KELOLA BUTIR SOAL PILIHAN GANDA (BEESMART PATTERN) ====================

function bukaKelolaButirSoal(paketId) {
  activePaketSoalId = paketId;
  const pkt = cbtBankSoalList.find(x => x.id === paketId);
  if (!pkt) return;

  editingButirList = JSON.parse(JSON.stringify(pkt.soalList || []));

  document.getElementById('kelola-butir-paket-title').textContent = 'Kelola Butir Soal: ' + pkt.kode;
  document.getElementById('kelola-butir-paket-sub').textContent = pkt.judul + ' (' + pkt.jenjang + ')';

  renderDaftarButirSoalEditor();

  const modal = document.getElementById('modal-kelola-butir-soal');
  if (modal) modal.classList.remove('hidden');

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function closeModalKelolaButirSoal() {
  const modal = document.getElementById('modal-kelola-butir-soal');
  if (modal) modal.classList.add('hidden');
  activePaketSoalId = null;
}

function renderDaftarButirSoalEditor() {
  const container = document.getElementById('container-list-butir-soal');
  const totalLabel = document.getElementById('kelola-butir-total-label');
  if (!container) return;

  if (totalLabel) totalLabel.textContent = 'Total: ' + editingButirList.length + ' Butir Soal';

  if (editingButirList.length === 0) {
    container.innerHTML = [
      '<div style="text-align: center; padding: 36px 16px; border: 2px dashed var(--border-color); border-radius: 8px; color: var(--text-muted); background: var(--surface-2);">',
        '<i data-lucide="help-circle" style="width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.5;"></i>',
        '<div style="font-weight: 600;">Belum ada butir soal pada paket ujian ini.</div>',
        '<div style="font-size: 12px; margin-top: 4px;">Klik tombol <b>Tambah Butir Soal</b> di kanan atas untuk membuat pertanyaan pilihan ganda (A, B, C, D).</div>',
      '</div>'
    ].join('');
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
    return;
  }

  container.innerHTML = editingButirList.map((s, idx) => {
    const mediaSoal = s.media || null;
    return [
      '<div class="card-butir-soal" style="background: var(--surface-color); border: 1.5px solid var(--border-color); border-radius: 10px; padding: 18px; box-shadow: 0 2px 10px rgba(0,0,0,0.12);">',
        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed var(--border-color); flex-wrap: wrap; gap: 8px;">',
          '<span style="font-weight: 800; font-size: 14px; color: var(--accent); display: flex; align-items: center; gap: 8px;">',
            '<span style="background: var(--primary-light); color: var(--primary-color); padding: 4px 10px; border-radius: 6px; font-weight: 800;">Butir #' + (idx + 1) + '</span>',
            '<span style="font-size: 12px; color: var(--text-muted); font-weight: normal;">Pilihan Ganda</span>',
          '</span>',
          '<div style="display: flex; align-items: center; gap: 10px;">',
            '<span style="font-size: 12.5px; font-weight: 700; color: #10b981;">Kunci Jawaban:</span>',
            '<select class="form-control" style="width: 105px; height: 34px; padding: 2px 10px; font-weight: 800; font-size: 13.5px; color: #10b981; background: var(--surface-2); border: 1.5px solid #10b981; border-radius: 6px; cursor: pointer;" onchange="updateKunciButir(' + idx + ', this.value)">',
              '<option value="A" ' + (s.kunci === 'A' ? 'selected' : '') + '>Kunci A</option>',
              '<option value="B" ' + (s.kunci === 'B' ? 'selected' : '') + '>Kunci B</option>',
              '<option value="C" ' + (s.kunci === 'C' ? 'selected' : '') + '>Kunci C</option>',
              '<option value="D" ' + (s.kunci === 'D' ? 'selected' : '') + '>Kunci D</option>',
            '</select>',
            '<button type="button" class="btn btn-sm btn-icon" onclick="hapusButirSoal(' + idx + ')" title="Hapus Soal Ini" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px;">',
              '<i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>',
            '</button>',
          '</div>',
        '</div>',

        '<!-- Teks Pertanyaan -->',
        '<div style="margin-bottom: 12px;">',
          '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">',
            '<label style="font-size: 13px; font-weight: 700; color: var(--text-color); margin: 0;">Teks Pertanyaan / Soal:</label>',
            '<div style="display: flex; gap: 6px;">',
              '<label class="btn btn-sm" style="font-size: 11.5px; padding: 3px 8px; cursor: pointer; background: var(--surface-2); border: 1px solid var(--border-color); color: var(--text-color); display: inline-flex; align-items: center; gap: 4px; border-radius: 6px;">',
                '<i data-lucide="image" style="width: 13px; height: 13px; color: #0284c7;"></i>+ Gambar/Foto',
                '<input type="file" accept="image/*" style="display: none;" onchange="handleUploadMediaSoal(' + idx + ', this, \'image\')">',
              '</label>',
              '<label class="btn btn-sm" style="font-size: 11.5px; padding: 3px 8px; cursor: pointer; background: var(--surface-2); border: 1px solid var(--border-color); color: var(--text-color); display: inline-flex; align-items: center; gap: 4px; border-radius: 6px;">',
                '<i data-lucide="video" style="width: 13px; height: 13px; color: #ea580c;"></i>+ Video',
                '<input type="file" accept="video/mp4,video/webm" style="display: none;" onchange="handleUploadMediaSoal(' + idx + ', this, \'video\')">',
              '</label>',
              '<button type="button" class="btn btn-sm" onclick="promptYouTubeMediaSoal(' + idx + ')" style="font-size: 11.5px; padding: 3px 8px; cursor: pointer; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; display: inline-flex; align-items: center; gap: 4px; border-radius: 6px;" title="Embed Video dari Link YouTube">',
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>+ YouTube',
              '</button>',
            '</div>',
          '</div>',
          '<textarea rows="3" class="form-control" style="width: 100%; border: 1.5px solid var(--border-color); border-radius: 8px; padding: 10px 14px; background: var(--surface-2); color: var(--text-color); font-size: 14px; line-height: 1.6; box-sizing: border-box; resize: vertical;" oninput="updatePertanyaanButir(' + idx + ', this.value)" placeholder="Ketikkan teks pertanyaan lengkap di sini...">' + (s.pertanyaan || '') + '</textarea>',
        '</div>',

        '<!-- Preview Media Soal (Jika ada Gambar / Video) -->',
        (mediaSoal ? [
          '<div style="margin-bottom: 12px; background: var(--surface-2); border: 1px dashed var(--border-color); border-radius: 8px; padding: 10px; display: inline-flex; flex-direction: column; gap: 6px; width: 100%; max-width: 540px; box-sizing: border-box;">',
            '<div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">',
              '<span style="font-size: 12px; font-weight: 700; color: ' + (mediaSoal.type === 'youtube' ? '#ef4444' : 'var(--text-muted)') + '; display: flex; align-items: center; gap: 4px;">',
                (mediaSoal.type === 'youtube'
                  ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> Video YouTube Tersemat'
                  : '<i data-lucide="' + (mediaSoal.type === 'video' ? 'video' : 'image') + '" style="width: 14px; height: 14px;"></i> Media Lampiran Soal (' + (mediaSoal.type === 'video' ? 'Video' : 'Gambar') + ')'
                ),
              '</span>',
              '<div style="display: flex; gap: 6px;">',
                (mediaSoal.type === 'youtube' ? '<button type="button" class="btn btn-sm" onclick="promptYouTubeMediaSoal(' + idx + ')" style="background: var(--surface-color); color: var(--text-color); border: 1px solid var(--border-color); font-size: 11px; padding: 2px 8px; border-radius: 4px;">Ganti Link</button>' : ''),
                '<button type="button" class="btn btn-sm" onclick="hapusMediaSoal(' + idx + ')" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: none; font-size: 11px; padding: 2px 8px; border-radius: 4px;">Hapus Media</button>',
              '</div>',
            '</div>',
            (mediaSoal.type === 'youtube'
              ? '<div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 6px; background: #000; margin-top: 4px;"><iframe src="https://www.youtube-nocookie.com/embed/' + getYouTubeVideoId(mediaSoal.url) + '?rel=0" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position: absolute; top:0; left:0; width: 100%; height: 100%;"></iframe></div>'
              : (mediaSoal.type === 'video'
                ? '<video src="' + mediaSoal.url + '" controls style="max-height: 220px; max-width: 100%; border-radius: 6px;"></video>'
                : '<img src="' + mediaSoal.url + '" style="max-height: 220px; max-width: 100%; object-fit: contain; border-radius: 6px; display: block;" alt="Lampiran Soal ' + (idx + 1) + '">'
              )
            ),
          '</div>'
        ].join('') : ''),

        '<!-- Pilihan Opsi A, B, C, D (Flex/Grid Rapi, Multi-Line Textarea, Tanpa Terpotong) -->',
        '<div style="margin-top: 10px;">',
          '<label style="font-size: 12.5px; font-weight: 700; color: var(--text-color); margin-bottom: 8px; display: block;">Pilihan Jawaban (A, B, C, D):</label>',
          '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 12px;">',
            ['A', 'B', 'C', 'D'].map(k => {
              const op = (s.opsi || []).find(o => o.k === k) || { k, t: '' };
              const isKunci = s.kunci === k;
              const opMedia = op.media || null;
              return [
                '<div style="display: flex; flex-direction: column; gap: 6px; background: var(--surface-2); border: 1.5px solid ' + (isKunci ? '#10b981' : 'var(--border-color)') + '; border-radius: 8px; padding: 10px 12px; transition: border-color 0.2s;">',
                  '<div style="display: flex; align-items: flex-start; gap: 10px;">',
                    '<span style="font-weight: 800; font-size: 13px; width: 28px; height: 28px; border-radius: 50%; background: ' + (isKunci ? '#10b981' : 'rgba(255,255,255,0.08)') + '; color: ' + (isKunci ? '#fff' : 'var(--text-color)') + '; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">' + k + '</span>',
                    '<div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">',
                      '<textarea rows="2" class="form-control" style="width: 100%; border: 1px solid var(--border-color); background: var(--surface-color); font-size: 13.5px; padding: 6px 10px; color: var(--text-color); border-radius: 6px; resize: vertical; line-height: 1.5; box-sizing: border-box;" placeholder="Teks jawaban opsi ' + k + '..." oninput="updateTeksOpsiButir(' + idx + ', \'' + k + '\', this.value)">' + (op.t || '') + '</textarea>',
                      '<div style="display: flex; justify-content: space-between; align-items: center;">',
                        '<label style="cursor: pointer; font-size: 11px; color: var(--primary-color); display: inline-flex; align-items: center; gap: 4px; user-select: none;">',
                          '<i data-lucide="image" style="width: 12px; height: 12px;"></i>+ Media Opsi ' + k,
                          '<input type="file" accept="image/*,video/mp4" style="display: none;" onchange="handleUploadMediaOpsi(' + idx + ', \'' + k + '\', this)">',
                        '</label>',
                        (isKunci ? '<span style="font-size: 11px; font-weight: 800; color: #10b981;">✓ Kunci Jawaban Benar</span>' : ''),
                      '</div>',
                    '</div>',
                  '</div>',
                  (opMedia ? [
                    '<div style="margin-left: 38px; position: relative; display: inline-block; background: var(--surface-color); border: 1px solid var(--border-color); border-radius: 6px; padding: 4px; margin-top: 4px;">',
                      (opMedia.type === 'video'
                        ? '<video src="' + opMedia.url + '" controls style="max-height: 120px; max-width: 100%; border-radius: 4px;"></video>'
                        : '<img src="' + opMedia.url + '" style="max-height: 120px; max-width: 100%; object-fit: contain; border-radius: 4px; display: block;" alt="Media Opsi ' + k + '">'
                      ),
                      '<button type="button" onclick="hapusMediaOpsi(' + idx + ', \'' + k + '\')" style="position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.7); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Hapus Media Opsi">&times;</button>',
                    '</div>'
                  ].join('') : ''),
                '</div>'
              ].join('');
            }).join(''),
          '</div>',
        '</div>',
      '</div>'
    ].join('');
  }).join('');

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function tambahButirSoalBaruUI() {
  const nextNo = editingButirList.length + 1;
  editingButirList.push({
    id: nextNo,
    pertanyaan: '',
    media: null,
    opsi: [
      { k: 'A', t: '', media: null },
      { k: 'B', t: '', media: null },
      { k: 'C', t: '', media: null },
      { k: 'D', t: '', media: null }
    ],
    kunci: 'A'
  });
  renderDaftarButirSoalEditor();

  const container = document.getElementById('container-list-butir-soal');
  if (container) {
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 50);
  }
}

function updateKunciButir(idx, val) {
  if (editingButirList[idx]) {
    editingButirList[idx].kunci = val;
    renderDaftarButirSoalEditor();
  }
}

function updatePertanyaanButir(idx, val) {
  if (editingButirList[idx]) {
    editingButirList[idx].pertanyaan = val;
  }
}

function updateTeksOpsiButir(idx, k, val) {
  if (editingButirList[idx]) {
    let op = editingButirList[idx].opsi.find(o => o.k === k);
    if (!op) {
      op = { k, t: val, media: null };
      editingButirList[idx].opsi.push(op);
    } else {
      op.t = val;
    }
  }
}

// Handler Upload Media Lampiran Gambar / Video pada Soal
function handleUploadMediaSoal(idx, fileInput, mediaType) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    if (!editingButirList[idx]) return;
    const isVid = mediaType === 'video' || file.type.startsWith('video');
    editingButirList[idx].media = {
      type: isVid ? 'video' : 'image',
      url: e.target.result,
      name: file.name
    };
    renderDaftarButirSoalEditor();
  };
  reader.readAsDataURL(file);
}

function hapusMediaSoal(idx) {
  if (editingButirList[idx]) {
    editingButirList[idx].media = null;
    renderDaftarButirSoalEditor();
  }
}

// Helper untuk mengekstrak Video ID YouTube dari berbagai macam format URL
function getYouTubeVideoId(url) {
  if (!url) return '';
  url = url.trim();
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : url;
}

// Prompt untuk input link Video YouTube pada butir soal
async function promptYouTubeMediaSoal(idx) {
  if (!editingButirList[idx]) return;
  const currentUrl = (editingButirList[idx].media && editingButirList[idx].media.type === 'youtube')
    ? editingButirList[idx].media.url
    : '';

  const { value: url } = await Swal.fire({
    title: 'Embed Video YouTube 📽️',
    text: 'Tempelkan URL video YouTube (contoh: https://www.youtube.com/watch?v=... atau https://youtu.be/...)',
    input: 'url',
    inputValue: currentUrl,
    inputPlaceholder: 'https://www.youtube.com/watch?v=...',
    showCancelButton: true,
    confirmButtonText: 'Simpan Video',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#ef4444',
    inputValidator: (value) => {
      if (!value) {
        return 'Link URL YouTube tidak boleh kosong!';
      }
      const yId = getYouTubeVideoId(value);
      if (!yId || yId.length !== 11) {
        return 'Format URL YouTube tidak valid! Pastikan link video YouTube benar.';
      }
    }
  });

  if (url) {
    const videoId = getYouTubeVideoId(url);
    editingButirList[idx].media = {
      type: 'youtube',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      videoId: videoId,
      name: `YouTube: ${videoId}`
    };
    renderDaftarButirSoalEditor();
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Video YouTube berhasil disematkan!',
      showConfirmButton: false,
      timer: 2000
    });
  }
}

// Handler Upload Media Lampiran Gambar / Video pada Pilihan Opsi A, B, C, D
function handleUploadMediaOpsi(idx, k, fileInput) {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    if (!editingButirList[idx]) return;
    let op = editingButirList[idx].opsi.find(o => o.k === k);
    if (!op) {
      op = { k, t: '', media: null };
      editingButirList[idx].opsi.push(op);
    }
    const isVid = file.type.startsWith('video');
    op.media = {
      type: isVid ? 'video' : 'image',
      url: e.target.result,
      name: file.name
    };
    renderDaftarButirSoalEditor();
  };
  reader.readAsDataURL(file);
}

function hapusMediaOpsi(idx, k) {
  if (editingButirList[idx]) {
    let op = editingButirList[idx].opsi.find(o => o.k === k);
    if (op) {
      op.media = null;
      renderDaftarButirSoalEditor();
    }
  }
}

function hapusButirSoal(idx) {
  editingButirList.splice(idx, 1);
  editingButirList.forEach((s, i) => { s.id = i + 1; });
  renderDaftarButirSoalEditor();
}

function simpanSemuaButirSoal() {
  if (!activePaketSoalId) return;
  const pkt = cbtBankSoalList.find(x => x.id === activePaketSoalId);
  if (!pkt) return;

  for (let i = 0; i < editingButirList.length; i++) {
    const s = editingButirList[i];
    if (!s.pertanyaan.trim()) {
      Swal.fire('Perhatian', 'Pertanyaan pada nomor ' + (i + 1) + ' belum diisi!', 'warning');
      return;
    }
    for (let op of s.opsi) {
      if (!op.t.trim()) {
        Swal.fire('Perhatian', 'Pilihan opsi ' + op.k + ' pada nomor ' + (i + 1) + ' belum diisi!', 'warning');
        return;
      }
    }
  }

  pkt.soalList = JSON.parse(JSON.stringify(editingButirList));
  saveBankSoalToStorage();
  closeModalKelolaButirSoal();
  renderBankSoalTable();

  Swal.fire({
    title: 'Butir Soal Berhasil Disimpan! 🎉',
    text: 'Paket soal ' + pkt.kode + ' kini memiliki ' + pkt.soalList.length + ' butir pertanyaan CBT yang siap diujikan kepada siswa.',
    icon: 'success',
    confirmButtonColor: '#059669'
  });
}

// ==================== FITUR EXCEL: DOWNLOAD TEMPLATE & IMPORT SOAL (BEESMART PATTERN) ====================

function downloadTemplateExcelSoal() {
  if (typeof XLSX === 'undefined') {
    Swal.fire('Error', 'Library SheetJS (XLSX) belum siap dimuat.', 'error');
    return;
  }

  const templateData = [
    {
      'NO': 1,
      'PERTANYAAN': 'Berdasarkan materi yang dipelajari, apakah tujuan utama modul kesetaraan ini?',
      'OPSI_A': 'Meningkatkan literasi dan pemahaman kompetensi terapan.',
      'OPSI_B': 'Menghafal rumus tanpa pemahaman konsep.',
      'OPSI_C': 'Menghindari proses evaluasi pembelajaran mandiri.',
      'OPSI_D': 'Mendapatkan nilai tanpa membaca isi modul.',
      'KUNCI': 'A'
    },
    {
      'NO': 2,
      'PERTANYAAN': 'Langkah awal yang tepat ketika menyelesaikan tugas evaluasi akhir bab adalah:',
      'OPSI_A': 'Mengabaikan petunjuk pengerjaan modul.',
      'OPSI_B': 'Membaca soal dengan teliti dan menganalisis opsi jawaban secara logis.',
      'OPSI_C': 'Memilih sembarang jawaban secara tergesa-gesa.',
      'OPSI_D': 'Menutup sesi sebelum memeriksa kembali jawaban yang belum yakin.',
      'KUNCI': 'B'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TemplateSoal');

  // Auto-width columns
  ws['!cols'] = [
    { wch: 6 },
    { wch: 45 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 8 }
  ];

  const fileName = 'Template_Import_Soal_BeeSmart.xlsx';
  XLSX.writeFile(wb, fileName);

  Swal.fire({
    icon: 'success',
    title: 'Template Berhasil Diunduh! 📥',
    text: `Berkas ${fileName} telah disimpan. Silakan isi butir soal dengan format kolom: NO, PERTANYAAN, OPSI_A, OPSI_B, OPSI_C, OPSI_D, KUNCI (A/B/C/D).`
  });
}

function handleImportExcelSoal(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  if (typeof XLSX === 'undefined') {
    Swal.fire('Error', 'Library SheetJS (XLSX) belum siap dimuat.', 'error');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rows || rows.length === 0) {
        Swal.fire('Data Kosong', 'Berkas Excel tidak berisi data soal.', 'warning');
        input.value = '';
        return;
      }

      const importedSoal = [];
      rows.forEach((row, idx) => {
        const pertanyaan = String(row['PERTANYAAN'] || row['pertanyaan'] || row['SOAL'] || row['soal'] || '').trim();
        const opsiA = String(row['OPSI_A'] || row['opsi_a'] || row['A'] || row['PILIHAN_A'] || '').trim();
        const opsiB = String(row['OPSI_B'] || row['opsi_b'] || row['B'] || row['PILIHAN_B'] || '').trim();
        const opsiC = String(row['OPSI_C'] || row['opsi_c'] || row['C'] || row['PILIHAN_C'] || '').trim();
        const opsiD = String(row['OPSI_D'] || row['opsi_d'] || row['D'] || row['PILIHAN_D'] || '').trim();
        const kunci = String(row['KUNCI'] || row['kunci'] || row['JAWABAN'] || row['jawaban'] || 'A').trim().toUpperCase();

        if (pertanyaan && opsiA && opsiB) {
          importedSoal.push({
            id: importedSoal.length + 1,
            pertanyaan: pertanyaan,
            opsi: [
              { k: 'A', t: opsiA },
              { k: 'B', t: opsiB },
              { k: 'C', t: opsiC || '-' },
              { k: 'D', t: opsiD || '-' }
            ],
            kunci: ['A', 'B', 'C', 'D'].includes(kunci) ? kunci : 'A'
          });
        }
      });

      if (importedSoal.length === 0) {
        Swal.fire('Format Tidak Sesuai', 'Pastikan kolom Excel memuat header: PERTANYAAN, OPSI_A, OPSI_B, OPSI_C, OPSI_D, KUNCI.', 'warning');
        input.value = '';
        return;
      }

      // Gabungkan dengan butir soal yang ada saat ini
      const startIndex = editingButirList.length;
      importedSoal.forEach((s, i) => {
        s.id = startIndex + i + 1;
        editingButirList.push(s);
      });

      renderDaftarButirSoalEditor();
      input.value = '';

      Swal.fire({
        icon: 'success',
        title: 'Import Soal Berhasil! 📊',
        text: `${importedSoal.length} butir soal dari Excel berhasil ditambahkan ke paket ini.`
      });
    } catch (err) {
      console.error('Import error:', err);
      Swal.fire('Gagal Import', 'Terjadi kesalahan membaca file Excel: ' + (err.message || err), 'error');
      input.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

// ==================== RESTORE CBT STATE ON REFRESH / RELOAD / CRASH ====================
function restoreActiveCbtSessionIfAny() {
  try {
    const raw = localStorage.getItem('ppdb_cbt_active_session');
    if (!raw) return;
    const session = JSON.parse(raw);
    if (!session || !session.soalList || session.soalList.length === 0) return;

    // Hitung penyesuaian waktu: jika mati lampu atau tertutup, kurangi selisih waktu mati
    if (session.lastSavedTime) {
      const elapsedSeconds = Math.floor((Date.now() - session.lastSavedTime) / 1000);
      // Hanya kurangi jika jeda wajar (maksimal sisa detiknya habis)
      session.sisaDetik = Math.max(0, (session.sisaDetik || 0) - elapsedSeconds);
    }

    if (session.sisaDetik <= 0) {
      // Waktu sudah habis saat offline
      cbtActiveSession = session;
      selesaikanDanHitungNilaiCBT(true);
      return;
    }

    cbtActiveSession = session;
    console.log('[Auto-Restore] Melanjutkan sesi ujian CBT:', session.bukuJudul, 'Soal No:', session.currentNo, 'Sisa Waktu:', session.sisaDetik, 'detik');

    // Setup Header CBT UI
    const headerMapel = document.getElementById('cbt-header-mapel');
    const headerSiswa = document.getElementById('cbt-header-siswa');
    if (headerMapel) headerMapel.textContent = `${session.bukuJudul} (${session.program || 'Paket C'})`;
    if (headerSiswa) headerSiswa.textContent = `Peserta: ${session.namaSiswa} · Token: BEESMART`;

    // Render Grid Nomor Soal dengan status jawaban yang tersimpan
    renderCbtGridNomor();

    // Tampilkan nomor soal terakhir yang sedang dikerjakan
    tampilkanSoalCBT(session.currentNo || 1);

    // Buka Modal CBT
    const modalCbt = document.getElementById('modal-cbt-ujian');
    if (modalCbt) modalCbt.classList.remove('hidden');

    // Lanjutkan Countdown Timer dari posisi sisaDetik terakhir
    startCbtCountdown();

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }

    // Tampilkan toast pemberitahuan ramah bahwa ujian dipulihkan
    if (typeof Swal !== 'undefined') {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true
      });
      Toast.fire({
        icon: 'info',
        title: 'Sesi Ujian Dipulihkan',
        text: 'Jawaban dan sisa waktu pengerjaan Anda tetap aman tersimpan.'
      });
    }
  } catch (err) {
    console.warn('Gagal memulihkan sesi ujian CBT:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initBankSoalData();
    renderBankSoalTable();
    // Pulihkan sesi ujian jika reload halaman
    restoreActiveCbtSessionIfAny();
  }, 600);
});
