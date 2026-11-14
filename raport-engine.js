// =============================================================================
// MODUL DOKUMEN AKADEMIK: BUKU RAPORT & TRANSKRIP NILAI RESMI KESETARAAN
// Sesuai Regulasi Permendikbudristek No. 21 Tahun 2022 & Kurikulum Merdeka PKBM
// Paket A (Setara SD), Paket B (Setara SMP), Paket C (Setara SMA)
// =============================================================================

let raportDataList = [];
let defaultMapelKurikulum = {
  'Paket A': [
    { nama: 'Pendidikan Agama dan Budi Pekerti', kelompok: 'Umum', kkm: 70 },
    { nama: 'Pendidikan Pancasila', kelompok: 'Umum', kkm: 70 },
    { nama: 'Bahasa Indonesia', kelompok: 'Umum', kkm: 70 },
    { nama: 'Matematika', kelompok: 'Umum', kkm: 65 },
    { nama: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', kelompok: 'Umum', kkm: 70 },
    { nama: 'Pemberdayaan & Keterampilan Wirausaha', kelompok: 'Khusus', kkm: 75 }
  ],
  'Paket B': [
    { nama: 'Pendidikan Agama dan Budi Pekerti', kelompok: 'Umum', kkm: 70 },
    { nama: 'Pendidikan Pancasila', kelompok: 'Umum', kkm: 70 },
    { nama: 'Bahasa Indonesia', kelompok: 'Umum', kkm: 70 },
    { nama: 'Matematika', kelompok: 'Umum', kkm: 65 },
    { nama: 'Ilmu Pengetahuan Alam (IPA)', kelompok: 'Umum', kkm: 68 },
    { nama: 'Ilmu Pengetahuan Sosial (IPS)', kelompok: 'Umum', kkm: 70 },
    { nama: 'Bahasa Inggris', kelompok: 'Umum', kkm: 65 },
    { nama: 'Pemberdayaan & Keterampilan Fungsional', kelompok: 'Khusus', kkm: 75 }
  ],
  'Paket C': [
    { nama: 'Pendidikan Agama dan Budi Pekerti', kelompok: 'Umum', kkm: 70 },
    { nama: 'Pendidikan Pancasila', kelompok: 'Umum', kkm: 70 },
    { nama: 'Bahasa Indonesia', kelompok: 'Umum', kkm: 72 },
    { nama: 'Matematika', kelompok: 'Umum', kkm: 68 },
    { nama: 'Bahasa Inggris', kelompok: 'Umum', kkm: 68 },
    { nama: 'Sosiologi', kelompok: 'Pilihan IPS', kkm: 70 },
    { nama: 'Geografi', kelompok: 'Pilihan IPS', kkm: 70 },
    { nama: 'Ekonomi', kelompok: 'Pilihan IPS', kkm: 70 },
    { nama: 'Keterampilan Vokasional / Komputer', kelompok: 'Khusus', kkm: 75 },
    { nama: 'Pemberdayaan Berbasis Komunitas Lokal', kelompok: 'Khusus', kkm: 75 }
  ]
};

// Pengaturan KKM Dinamis yang tersimpan di LocalStorage & Cloud
function loadKKMConfig() {
  try {
    const raw = localStorage.getItem('ppdb_kkm_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        ['Paket A', 'Paket B', 'Paket C'].forEach(jenjang => {
          if (Array.isArray(parsed[jenjang]) && parsed[jenjang].length > 0) {
            defaultMapelKurikulum[jenjang] = parsed[jenjang];
          }
        });
      }
    }
  } catch (e) {
    console.warn("Gagal load ppdb_kkm_config:", e);
  }

  // Sinkronisasi otomatis dari cloud database (Spreadsheet Pengaturan)
  if (typeof callAPI === 'function') {
    callAPI({ action: "getAppSetting", key: "ppdb_kkm_config" }).then(cloud => {
      let parsed = cloud;
      if (typeof cloud === 'string') {
        try { parsed = JSON.parse(cloud); } catch (e) {}
      }
      if (parsed && typeof parsed === 'object') {
        let changed = false;
        ['Paket A', 'Paket B', 'Paket C'].forEach(jenjang => {
          if (Array.isArray(parsed[jenjang]) && parsed[jenjang].length > 0) {
            defaultMapelKurikulum[jenjang] = parsed[jenjang];
            changed = true;
          }
        });
        if (changed) {
          try { localStorage.setItem('ppdb_kkm_config', JSON.stringify(defaultMapelKurikulum)); } catch (e) {}
        }
      }
    }).catch(err => {
      console.warn("Sinkronisasi KKM cloud:", err.message);
    });
  }
}

// Inisialisasi awal KKM
loadKKMConfig();

// Cache data base64 logo sekolah untuk disematkan pada PDF
let cachedLogoBase64 = null;

function dapatkanLogoSekolahBase64() {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const existingImg = document.querySelector('.brand-logo-img') || document.querySelector('.login-logo-img') || document.querySelector('.app-brand-logo');
    if (existingImg && existingImg.complete && existingImg.naturalWidth > 0) {
      const cvs = document.createElement('canvas');
      cvs.width = existingImg.naturalWidth;
      cvs.height = existingImg.naturalHeight;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(existingImg, 0, 0);
      cachedLogoBase64 = cvs.toDataURL('image/png');
      return cachedLogoBase64;
    }
  } catch (e) {
    console.warn("Logo base64 extract:", e.message);
  }
  return null;
}

async function loadRaportData() {
  try {
    const local = localStorage.getItem('ppdb_raport_list');
    if (local) raportDataList = JSON.parse(local);
  } catch (e) {}

  // Buat sample dummy jika belum ada data agar langsung siap dilihat
  if (!raportDataList || raportDataList.length === 0) {
    inisialisasiDummyRaport();
  }

  renderRaportTable();

  // Sinkronisasi dengan database Google Spreadsheet
  if (typeof callAPI === 'function') {
    try {
      const cloudRaport = await callAPI({ action: "getRaport" });
      if (Array.isArray(cloudRaport) && cloudRaport.length > 0) {
        raportDataList = cloudRaport;
        try { localStorage.setItem('ppdb_raport_list', JSON.stringify(raportDataList)); } catch (e) {}
        renderRaportTable();
      }
    } catch (err) {
      console.warn("Gagal sinkron data raport dari cloud:", err.message);
    }
  }
}

function inisialisasiDummyRaport() {
  raportDataList = [
    {
      id: 'RAP-2026-001',
      siswaId: '1',
      namaSiswa: 'Siswa Contoh PKBM',
      nisn: '0061234567',
      program: 'Paket C',
      tingkatKelas: 'Kelas X (Fase E)',
      tahunAjaran: '2026/2027',
      semester: 'Ganjil',
      fase: 'Fase E',
      tglRapor: new Date().toLocaleDateString('id-ID'),
      statusKenaikanLulus: 'Naik ke Kelas Berikutnya',
      catatanAkademik: 'Menunjukkan pemahaman konsep yang solid dan kemandirian belajar mandiri yang sangat baik. Sangat aktif dalam diskusi daring.',
      ekskul: [
        { kegiatan: 'Keterampilan Komputer & Desain Grafis', predikat: 'Sangat Terampil', keterangan: 'Mampu membuat desain media publikasi secara mandiri.' }
      ],
      kehadiran: { sakit: 1, izin: 1, tanpaKeterangan: 0 },
      nilaiMapel: [
        { mapel: 'Pendidikan Agama dan Budi Pekerti', kelompok: 'Umum', nilai: 85, capaian: 'Sangat baik dalam memahami dan menerapkan nilai-nilai budi pekerti dalam kehidupan sehari-hari.' },
        { mapel: 'Pendidikan Pancasila', kelompok: 'Umum', nilai: 84, capaian: 'Menunjukkan pemahaman mendalam tentang konstitusi dan norma sosial kemasyarakatan.' },
        { mapel: 'Bahasa Indonesia', kelompok: 'Umum', nilai: 88, capaian: 'Sangat terampil dalam menganalisis teks laporan hasil observasi dan menyusun karya tulis ilmiah.' },
        { mapel: 'Matematika', kelompok: 'Umum', nilai: 78, capaian: 'Mencapai kompetensi dalam perhitungan eksponen dan barisan aritmetika dengan baik.' },
        { mapel: 'Bahasa Inggris', kelompok: 'Umum', nilai: 82, capaian: 'Fasih dalam memahami narasi fungsional dan ungkapan situasional sehari-hari.' },
        { mapel: 'Sosiologi', kelompok: 'Pilihan IPS', nilai: 86, capaian: 'Kritis dalam menganalisis struktur sosial dan interaksi masyarakat di Sentani Jayapura.' },
        { mapel: 'Geografi', kelompok: 'Pilihan IPS', nilai: 80, capaian: 'Memahami dinamika geosfer dan pelestarian lingkungan hidup dengan baik.' },
        { mapel: 'Ekonomi', kelompok: 'Pilihan IPS', nilai: 83, capaian: 'Baik dalam menganalisis konsep pasar persaingan dan perbankan digital.' },
        { mapel: 'Keterampilan Vokasional / Komputer', kelompok: 'Khusus', nilai: 90, capaian: 'Sangat mahir dalam pengoperasian aplikasi perkantoran dan desain publikasi.' },
        { mapel: 'Pemberdayaan Berbasis Komunitas Lokal', kelompok: 'Khusus', nilai: 92, capaian: 'Menunjukkan inisiatif tinggi dalam kegiatan bakti sosial dan kearifan budaya Papua.' }
      ]
    }
  ];
  saveRaportToStorage();
}

function saveRaportToStorage(newRaport = null) {
  try {
    localStorage.setItem('ppdb_raport_list', JSON.stringify(raportDataList));
  } catch (e) {}

  if (newRaport && typeof callAPI === 'function') {
    callAPI({ action: "saveRaport", raport: newRaport }).catch(err => {
      console.warn("Gagal simpan raport ke cloud:", err.message);
    });
  }
}

// ==================== RENDER TABEL DAFTAR RAPORT ====================
function renderRaportTable(data = null) {
  const tbody = document.getElementById('table-raport-body');
  if (!tbody) return;

  let list = data || raportDataList;

  // Jika login sebagai Siswa, hanya tampilkan raport miliknya
  if (currentUser && currentUser.role === 'Siswa') {
    list = list.filter(r => 
      (r.namaSiswa && currentUser.nama && r.namaSiswa.toLowerCase() === currentUser.nama.toLowerCase()) ||
      (r.siswaId && currentUser.dataSiswa && String(r.siswaId) === String(currentUser.dataSiswa.id))
    );
    const btnTambah = document.getElementById('btn-tambah-raport');
    if (btnTambah) btnTambah.style.display = 'none';
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px;">Belum ada data buku raport siswa yang diterbitkan.</td></tr>';
    return;
  }

  const isPetugas = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Super Admin' || currentUser.role === 'Guru');

  tbody.innerHTML = list.map((r, idx) => {
    const jmlMapel = Array.isArray(r.nilaiMapel) ? r.nilaiMapel.length : 0;
    const totalNilai = Array.isArray(r.nilaiMapel) ? r.nilaiMapel.reduce((acc, curr) => acc + (Number(curr.nilai) || 0), 0) : 0;
    const rataRata = jmlMapel > 0 ? (totalNilai / jmlMapel).toFixed(1) : 0;

    const rataColor = rataRata >= 80 ? '#059669' : (rataRata >= 70 ? '#0284c7' : '#d97706');
    const badgeBg = rataRata >= 80 ? 'rgba(5, 150, 105, 0.1)' : 'rgba(2, 132, 199, 0.1)';

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>
          <strong>${r.namaSiswa || 'Siswa'}</strong>
          <br><small style="color: var(--text-muted);">NISN: ${r.nisn || '-'}</small>
        </td>
        <td>
          <span class="tag def">${r.program || 'Paket C'}</span>
          <br><small style="color: var(--text-muted); font-weight: 500;">${r.tingkatKelas || 'Kelas X'}</small>
        </td>
        <td>
          <span style="font-weight: 600;">${r.tahunAjaran || '2026/2027'}</span>
          <br><small class="tag" style="background: rgba(14, 165, 233, 0.12); color: #0284c7; padding: 1px 8px; font-size: 11px;">Sem. ${r.semester || 'Ganjil'}</small>
        </td>
        <td style="text-align: center; font-weight: 600;">${jmlMapel} Mapel</td>
        <td style="text-align: center;">
          <span style="font-weight: 700; font-size: 14px; color: ${rataColor}; background: ${badgeBg}; padding: 3px 10px; border-radius: 6px;">
            ${rataRata}
          </span>
        </td>
        <td style="text-align: center;">
          <span class="tag" style="background: rgba(16, 185, 129, 0.12); color: #059669; font-weight: 600;">
            ${r.statusKenaikanLulus || 'Naik Kelas'}
          </span>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-primary" onclick="cetakBukuRaportPDF('${r.id}')" title="Cetak Buku Raport Resmi PDF" style="padding: 4px 10px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px;">
            <i data-lucide="printer" style="width: 13px; height: 13px;"></i> Cetak
          </button>
          ${isPetugas ? `
            <button class="btn btn-sm btn-outline" onclick="editDataRaport('${r.id}')" title="Edit Rapor" style="padding: 4px 8px;">
              <i data-lucide="edit" style="width: 13px; height: 13px;"></i>
            </button>
            <button class="btn btn-icon btn-danger-text" onclick="hapusDataRaport('${r.id}')" title="Hapus Raport">
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

function filterRaportTable() {
  const query = (document.getElementById('search-raport')?.value || '').toLowerCase().trim();
  const program = document.getElementById('filter-raport-program')?.value || '';
  const semester = document.getElementById('filter-raport-semester')?.value || '';

  const filtered = raportDataList.filter(r => {
    const matchQuery = !query || 
      (r.namaSiswa || '').toLowerCase().includes(query) || 
      (r.nisn || '').includes(query) || 
      (r.tingkatKelas || '').toLowerCase().includes(query);
    const matchProgram = !program || r.program === program;
    const matchSemester = !semester || r.semester === semester;
    return matchQuery && matchProgram && matchSemester;
  });

  renderRaportTable(filtered);
}

// ==================== MODAL FORM INPUT RAPORT ====================
function bukaModalInputRaport() {
  const modal = document.getElementById('modal-form-raport');
  if (!modal) return;

  document.getElementById('modal-raport-title').textContent = 'Input Buku Raport Peserta Didik';
  document.getElementById('raport-edit-id').value = '';
  document.getElementById('raport-input-thn').value = '2026/2027';
  document.getElementById('raport-select-smt').value = 'Ganjil';
  document.getElementById('raport-input-catatan').value = '';
  document.getElementById('raport-input-ekskul').value = '';
  document.getElementById('raport-absen-sakit').value = '0';
  document.getElementById('raport-absen-izin').value = '0';
  document.getElementById('raport-absen-alpa').value = '0';
  document.getElementById('raport-status-keputusan').value = 'Naik ke Kelas Berikutnya';

  // Isi dropdown siswa
  const selectSiswa = document.getElementById('raport-select-siswa');
  if (selectSiswa && Array.isArray(siswaDataList)) {
    selectSiswa.innerHTML = '<option value="">-- Pilih Siswa PKBM --</option>' + 
      siswaDataList.map(s => `<option value="${s.id}">${s.nama} (${s.program || 'Paket'}) - NISN: ${s.nisn || '-'}</option>`).join('');
  }

  // Load default mapel Paket C
  muatMapelDefaultKeForm('Paket C');

  modal.classList.remove('hidden');
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

function closeModalFormRaport() {
  const modal = document.getElementById('modal-form-raport');
  if (modal) modal.classList.add('hidden');
}

function onRaportSiswaChange() {
  const selectSiswa = document.getElementById('raport-select-siswa');
  const inputProg = document.getElementById('raport-input-program');
  const selectKelas = document.getElementById('raport-select-kelas');
  if (!selectSiswa) return;

  const targetId = selectSiswa.value;
  const siswa = (siswaDataList || []).find(s => String(s.id) === String(targetId));
  if (siswa) {
    const prog = String(siswa.program || 'Paket C');
    if (inputProg) inputProg.value = prog;

    if (prog.includes('Paket A')) {
      if (selectKelas) selectKelas.value = 'Kelas VI (Fase C)';
      muatMapelDefaultKeForm('Paket A');
    } else if (prog.includes('Paket B')) {
      if (selectKelas) selectKelas.value = 'Kelas IX (Fase D)';
      muatMapelDefaultKeForm('Paket B');
    } else {
      if (selectKelas) selectKelas.value = 'Kelas X (Fase E)';
      muatMapelDefaultKeForm('Paket C');
    }
  }
}

function muatMapelDefaultKeForm(jenjang = 'Paket C') {
  const tbody = document.getElementById('raport-mapel-tbody');
  if (!tbody) return;

  const listMapel = defaultMapelKurikulum[jenjang] || defaultMapelKurikulum['Paket C'];

  tbody.innerHTML = listMapel.map((m, idx) => `
    <tr class="row-mapel-item" style="border-bottom: 1px solid var(--border-color);">
      <td style="padding: 6px;">
        <input type="text" class="form-control mapel-nama" value="${m.nama}" style="font-size: 12px; height: 32px;" required>
      </td>
      <td style="padding: 6px;">
        <select class="form-control mapel-kelompok" style="font-size: 11.5px; height: 32px;">
          <option value="Umum" ${m.kelompok === 'Umum' ? 'selected' : ''}>Umum</option>
          <option value="Pilihan MIPA" ${m.kelompok === 'Pilihan MIPA' ? 'selected' : ''}>Pilihan MIPA</option>
          <option value="Pilihan IPS" ${m.kelompok === 'Pilihan IPS' ? 'selected' : ''}>Pilihan IPS</option>
          <option value="Khusus" ${m.kelompok === 'Khusus' ? 'selected' : ''}>Keterampilan / Khusus</option>
        </select>
      </td>
      <td style="padding: 6px;">
        <input type="number" class="form-control mapel-nilai" min="0" max="100" value="80" style="font-size: 12.5px; height: 32px; text-align: center; font-weight: 700;" required>
      </td>
      <td style="padding: 6px;">
        <input type="text" class="form-control mapel-capaian" value="Mencapai kompetensi dengan sangat baik dalam pembelajaran modul dan evaluasi." style="font-size: 11.5px; height: 32px;">
      </td>
      <td style="padding: 6px; text-align: center;">
        <button type="button" class="btn btn-icon btn-danger-text" onclick="this.closest('tr').remove()" style="padding: 4px;">&times;</button>
      </td>
    </tr>
  `).join('');
}

function tambahBarisMapelRaport() {
  const tbody = document.getElementById('raport-mapel-tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.className = 'row-mapel-item';
  tr.style.borderBottom = '1px solid var(--border-color)';
  tr.innerHTML = `
    <td style="padding: 6px;">
      <input type="text" class="form-control mapel-nama" placeholder="Nama Mata Pelajaran..." style="font-size: 12px; height: 32px;" required>
    </td>
    <td style="padding: 6px;">
      <select class="form-control mapel-kelompok" style="font-size: 11.5px; height: 32px;">
        <option value="Umum">Umum</option>
        <option value="Pilihan IPS">Pilihan IPS</option>
        <option value="Pilihan MIPA">Pilihan MIPA</option>
        <option value="Khusus">Keterampilan / Khusus</option>
      </select>
    </td>
    <td style="padding: 6px;">
      <input type="number" class="form-control mapel-nilai" min="0" max="100" value="80" style="font-size: 12.5px; height: 32px; text-align: center; font-weight: 700;" required>
    </td>
    <td style="padding: 6px;">
      <input type="text" class="form-control mapel-capaian" placeholder="Deskripsi kemajuan kompetensi siswa..." value="Menunjukkan penguasaan materi yang baik dalam asesmen sumatif." style="font-size: 11.5px; height: 32px;">
    </td>
    <td style="padding: 6px; text-align: center;">
      <button type="button" class="btn btn-icon btn-danger-text" onclick="this.closest('tr').remove()" style="padding: 4px;">&times;</button>
    </td>
  `;
  tbody.appendChild(tr);
}

// Fitur Pintar: Mengambil rekap nilai CBT siswa untuk otomatis mengisi angka rapor
function tarikNilaiCBTKeRaport() {
  const selectSiswa = document.getElementById('raport-select-siswa');
  const targetId = selectSiswa ? selectSiswa.value : null;
  const siswa = (siswaDataList || []).find(s => String(s.id) === String(targetId));

  if (!siswa) {
    Swal.fire('Perhatian', 'Pilih peserta didik terlebih dahulu sebelum menarik nilai CBT.', 'warning');
    return;
  }

  const hasilSiswa = (ujianHasilList || []).filter(u => 
    (u.namaSiswa && u.namaSiswa.toLowerCase() === siswa.nama.toLowerCase()) ||
    (u.siswaId && String(u.siswaId) === String(siswa.id))
  );

  if (hasilSiswa.length === 0) {
    Swal.fire('Info CBT', `Belum ditemukan riwayat nilai ujian CBT atas nama ${siswa.nama}. Nilai default tetap dipertahankan.`, 'info');
    return;
  }

  // Petakan nilai CBT ke input baris mapel
  const rows = document.querySelectorAll('#raport-mapel-tbody tr.row-mapel-item');
  let matchedCount = 0;

  rows.forEach(row => {
    const namaInput = row.querySelector('.mapel-nama');
    const nilaiInput = row.querySelector('.mapel-nilai');
    const capaianInput = row.querySelector('.mapel-capaian');
    if (!namaInput || !nilaiInput) return;

    const nMapel = namaInput.value.toLowerCase();
    // Cari kecocokan di hasil CBT
    const cbtMatch = hasilSiswa.find(h => {
      const bJudul = (h.bukuJudul || '').toLowerCase();
      return bJudul.includes(nMapel) || nMapel.includes(bJudul);
    });

    if (cbtMatch) {
      nilaiInput.value = cbtMatch.nilai;
      matchedCount++;
      if (capaianInput) {
        if (cbtMatch.nilai >= 85) {
          capaianInput.value = 'Mencapai penguasaan kompetensi sangat memuaskan pada asesmen CBT.';
        } else if (cbtMatch.nilai >= 75) {
          capaianInput.value = 'Mencapai ketuntasan kompetensi dengan baik pada ujian sumatif modul.';
        } else {
          capaianInput.value = 'Perlu bimbingan lebih lanjut dalam pemahaman materi modul tertentu.';
        }
      }
    }
  });

  Swal.fire('Sinkronisasi Berhasil', `Berhasil menyelaraskan ${matchedCount} nilai mata pelajaran dari database CBT peserta didik.`, 'success');
}

function simpanDataRaport() {
  const selectSiswa = document.getElementById('raport-select-siswa');
  const targetId = selectSiswa ? selectSiswa.value : null;
  const siswa = (siswaDataList || []).find(s => String(s.id) === String(targetId));

  const editId = document.getElementById('raport-edit-id').value;
  const skhId = document.getElementById('raport-select-sekolah')?.value || 'utama';
  const prog = document.getElementById('raport-input-program').value || (siswa ? siswa.program : 'Paket C');
  const kls = document.getElementById('raport-select-kelas').value;
  const thn = document.getElementById('raport-input-thn').value || '2026/2027';
  const smt = document.getElementById('raport-select-smt').value;
  const catatan = document.getElementById('raport-input-catatan').value;
  const ekskulStr = document.getElementById('raport-input-ekskul').value;
  const sakit = parseInt(document.getElementById('raport-absen-sakit').value, 10) || 0;
  const izin = parseInt(document.getElementById('raport-absen-izin').value, 10) || 0;
  const alpa = parseInt(document.getElementById('raport-absen-alpa').value, 10) || 0;
  const statusKeputusan = document.getElementById('raport-status-keputusan').value;

  // Kumpulkan list mapel
  const rows = document.querySelectorAll('#raport-mapel-tbody tr.row-mapel-item');
  const mapelList = [];
  rows.forEach(r => {
    const nama = r.querySelector('.mapel-nama')?.value.trim();
    const kelompok = r.querySelector('.mapel-kelompok')?.value;
    const nilai = parseFloat(r.querySelector('.mapel-nilai')?.value) || 0;
    const capaian = r.querySelector('.mapel-capaian')?.value.trim();
    if (nama) {
      mapelList.push({ mapel: nama, kelompok: kelompok, nilai: nilai, capaian: capaian });
    }
  });

  if (mapelList.length === 0) {
    Swal.fire('Peringatan', 'Minimal harus ada 1 mata pelajaran yang dinilai.', 'warning');
    return;
  }

  const existingRaport = editId ? raportDataList.find(r => r.id === editId) : null;
  const newRaport = {
    id: editId || ('RAP-' + Date.now()),
    sekolahId: skhId,
    siswaId: targetId || (existingRaport ? existingRaport.siswaId : '1'),
    namaSiswa: (siswa ? siswa.nama : (existingRaport ? existingRaport.namaSiswa : 'Siswa PKBM')),
    nisn: (siswa ? siswa.nisn : (existingRaport ? existingRaport.nisn : '-')),
    program: prog,
    tingkatKelas: kls,
    tahunAjaran: thn,
    semester: smt,
    fase: String(kls || '').includes('Fase B') ? 'Fase B' : (String(kls || '').includes('Fase C') ? 'Fase C' : (String(kls || '').includes('Fase D') ? 'Fase D' : (String(kls || '').includes('Fase E') ? 'Fase E' : 'Fase F'))),
    tglRapor: new Date().toLocaleDateString('id-ID'),
    statusKenaikanLulus: statusKeputusan,
    catatanAkademik: catatan,
    ekskul: ekskulStr ? [{ kegiatan: ekskulStr, predikat: 'Baik', keterangan: 'Aktif' }] : [],
    kehadiran: { sakit: sakit, izin: izin, tanpaKeterangan: alpa },
    nilaiMapel: mapelList
  };

  if (editId) {
    const idx = raportDataList.findIndex(r => r.id === editId);
    if (idx !== -1) raportDataList[idx] = newRaport;
  } else {
    raportDataList.unshift(newRaport);
  }

  saveRaportToStorage(newRaport);
  renderRaportTable();
  closeModalFormRaport();

  Swal.fire({
    icon: 'success',
    title: 'Raport Berhasil Disimpan',
    text: `Buku Raport Semester ${smt} ${thn} atas nama ${newRaport.namaSiswa} telah disimpan resmi.`,
    confirmButtonColor: '#059669'
  });
}

function editDataRaport(id) {
  const r = raportDataList.find(x => x.id === id);
  if (!r) return;

  bukaModalInputRaport();
  document.getElementById('modal-raport-title').textContent = 'Edit Data Buku Raport';
  document.getElementById('raport-edit-id').value = r.id;
  const selectSekolah = document.getElementById('raport-select-sekolah');
  if (selectSekolah) selectSekolah.value = r.sekolahId || 'utama';
  document.getElementById('raport-select-siswa').value = r.siswaId || '';
  document.getElementById('raport-input-program').value = r.program || 'Paket C';
  document.getElementById('raport-select-kelas').value = r.tingkatKelas || 'Kelas X (Fase E)';
  document.getElementById('raport-input-thn').value = r.tahunAjaran || '2026/2027';
  document.getElementById('raport-select-smt').value = r.semester || 'Ganjil';
  document.getElementById('raport-input-catatan').value = r.catatanAkademik || '';
  document.getElementById('raport-input-ekskul').value = Array.isArray(r.ekskul) && r.ekskul[0] ? r.ekskul[0].kegiatan : '';
  document.getElementById('raport-absen-sakit').value = r.kehadiran ? (r.kehadiran.sakit || 0) : 0;
  document.getElementById('raport-absen-izin').value = r.kehadiran ? (r.kehadiran.izin || 0) : 0;
  document.getElementById('raport-absen-alpa').value = r.kehadiran ? (r.kehadiran.tanpaKeterangan || 0) : 0;
  document.getElementById('raport-status-keputusan').value = r.statusKenaikanLulus || 'Naik ke Kelas Berikutnya';

  // Render mapel tersimpan
  const tbody = document.getElementById('raport-mapel-tbody');
  if (tbody && Array.isArray(r.nilaiMapel)) {
    tbody.innerHTML = r.nilaiMapel.map(m => `
      <tr class="row-mapel-item" style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 6px;">
          <input type="text" class="form-control mapel-nama" value="${m.mapel}" style="font-size: 12px; height: 32px;" required>
        </td>
        <td style="padding: 6px;">
          <select class="form-control mapel-kelompok" style="font-size: 11.5px; height: 32px;">
            <option value="Umum" ${m.kelompok === 'Umum' ? 'selected' : ''}>Umum</option>
            <option value="Pilihan MIPA" ${m.kelompok === 'Pilihan MIPA' ? 'selected' : ''}>Pilihan MIPA</option>
            <option value="Pilihan IPS" ${m.kelompok === 'Pilihan IPS' ? 'selected' : ''}>Pilihan IPS</option>
            <option value="Khusus" ${m.kelompok === 'Khusus' ? 'selected' : ''}>Keterampilan / Khusus</option>
          </select>
        </td>
        <td style="padding: 6px;">
          <input type="number" class="form-control mapel-nilai" min="0" max="100" value="${m.nilai}" style="font-size: 12.5px; height: 32px; text-align: center; font-weight: 700;" required>
        </td>
        <td style="padding: 6px;">
          <input type="text" class="form-control mapel-capaian" value="${m.capaian || ''}" style="font-size: 11.5px; height: 32px;">
        </td>
        <td style="padding: 6px; text-align: center;">
          <button type="button" class="btn btn-icon btn-danger-text" onclick="this.closest('tr').remove()" style="padding: 4px;">&times;</button>
        </td>
      </tr>
    `).join('');
  }
}

function hapusDataRaport(id) {
  Swal.fire({
    title: 'Hapus Buku Raport?',
    text: 'Data buku raport ini akan dihapus dari arsip sistem.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Ya, Hapus',
    cancelButtonText: 'Batal',
    confirmButtonColor: '#e11d48'
  }).then(res => {
    if (res.isConfirmed) {
      raportDataList = raportDataList.filter(x => x.id !== id);
      saveRaportToStorage();
      renderRaportTable();
      if (typeof callAPI === 'function') {
        callAPI({ action: "deleteRaport", id: id }).catch(() => {});
      }
      Swal.fire('Terhapus', 'Buku raport telah dihapus.', 'success');
    }
  });
}

// ==================== VIEWER / PRATINJAU DOKUMEN PDF INTERAKTIF ====================
let currentPdfBlobUrl = null;

function tampilkanPratinjauPDF(doc, judulDokumen, namaFileDownload) {
  if (!doc) return;

  const modal = document.getElementById('modal-preview-pdf');
  const iframe = document.getElementById('iframe-preview-pdf');
  const titleEl = document.getElementById('modal-preview-pdf-title');
  const btnDownload = document.getElementById('btn-modal-preview-download');
  const btnPrint = document.getElementById('btn-modal-preview-print');

  if (titleEl) titleEl.textContent = judulDokumen || 'Pratinjau Dokumen PDF';

  // Hapus blob URL lama jika ada
  if (currentPdfBlobUrl) {
    URL.revokeObjectURL(currentPdfBlobUrl);
    currentPdfBlobUrl = null;
  }

  // Buat blob URL dari output jsPDF
  const pdfBlob = doc.output('blob');
  currentPdfBlobUrl = URL.createObjectURL(pdfBlob);

  if (iframe) {
    iframe.src = currentPdfBlobUrl;
  }

  if (btnDownload) {
    btnDownload.onclick = () => {
      doc.save(namaFileDownload || 'Dokumen_Akademik.pdf');
    };
  }

  if (btnPrint) {
    btnPrint.onclick = () => {
      try {
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } else {
          window.open(currentPdfBlobUrl, '_blank');
        }
      } catch (e) {
        window.open(currentPdfBlobUrl, '_blank');
      }
    };
  }

  if (modal) {
    modal.classList.remove('hidden');
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function closeModalPreviewPDF() {
  const modal = document.getElementById('modal-preview-pdf');
  const iframe = document.getElementById('iframe-preview-pdf');
  if (modal) modal.classList.add('hidden');
  if (iframe) iframe.src = '';
  if (currentPdfBlobUrl) {
    URL.revokeObjectURL(currentPdfBlobUrl);
    currentPdfBlobUrl = null;
  }
}

// ==================== GENERATOR PDF RESMI BUKU RAPORT ====================
// Berstandar A4 Portrait Permendikbudristek No. 21 Tahun 2022 (Pas 1 Halaman Rapi)
function cetakBukuRaportPDF(id, options = {}) {
  const { previewOnly = true, docInstance = null, isBatch = false } = options;
  const r = raportDataList.find(x => x.id === id);
  if (!r) return null;

  if (!window.jspdf || !window.jspdf.jsPDF) {
    if (!isBatch) Swal.fire('Error', 'Library PDF belum termuat.', 'error');
    return null;
  }

  const { jsPDF } = window.jspdf;
  const doc = docInstance || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 12;

  // Bingkai Tipis Dokumen Resmi Raport
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(7, 7, pageWidth - 14, pageHeight - 14);

  // 1. KOP SURAT RESMI LEMBAGA PKBM DENGAN LOGO RESMI
  let namaSekolahKop = 'PKBM AURA ANUGERAH';
  let npsnKop = '69910495';
  let izinKop = '421.1/043/DPMPTSP/2021';
  let alamatKop = 'JL. Yahim KOMP.Buton Samping Hotel Citra Buana, Sentani, Jayapura, Papua - Kode Pos 99352';
  let kepalaNamaKop = 'ANTHONIUS, S.Pd';
  let kepalaNipKop = 'NIY. 201804.001';
  let logoBase64 = dapatkanLogoSekolahBase64();

  // Ambil profil terbaru PKBM Aura Anugerah dari database Pengaturan jika tersedia
  try {
    const tkStored = (typeof infoTKData !== 'undefined' && infoTKData) ? infoTKData : (typeof getStoredTKInfo === 'function' ? getStoredTKInfo() : null);
    if (tkStored) {
      if (tkStored.nama) namaSekolahKop = tkStored.nama.toUpperCase();
      if (tkStored.npsn) npsnKop = tkStored.npsn;
      if (tkStored.keterangan) izinKop = tkStored.keterangan;
      if (tkStored.jalan) alamatKop = tkStored.jalan;
      if (tkStored.kepala_sekolah) kepalaNamaKop = tkStored.kepala_sekolah;
      if (tkStored.nip_kepala) kepalaNipKop = tkStored.nip_kepala;
    }
  } catch (e) {}

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', marginX + 1, 9, 18, 18);
    } catch (e) {
      console.warn("Gagal render logo kop raport:", e.message);
    }
  }

  const kopCenterX = logoBase64 ? (pageWidth / 2) + 5 : pageWidth / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('PEMERINTAH KABUPATEN JAYAPURA', kopCenterX, 12, { align: 'center' });
  doc.text('DINAS PENDIDIKAN DAN KEBUDAYAAN', kopCenterX, 16, { align: 'center' });
  doc.setFontSize(11.5);
  doc.setTextColor(5, 150, 105);
  doc.text(namaSekolahKop, kopCenterX, 21, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text(`NPSN: ${npsnKop} | Izin Operasional: ${izinKop} | Terakreditasi`, kopCenterX, 24.5, { align: 'center' });
  doc.text(alamatKop, kopCenterX, 27.5, { align: 'center' });

  // Garis Pembatas Kop Ganda
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.6);
  doc.line(marginX, 30.5, pageWidth - marginX, 30.5);
  doc.setLineWidth(0.2);
  doc.line(marginX, 31.3, pageWidth - marginX, 31.3);

  // 2. JUDUL RAPOR
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('LAPORAN HASIL BELAJAR (RAPOR)', pageWidth / 2, 36.5, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setTextColor(5, 150, 105);
  doc.text(`PROGRAM PENDIDIKAN KESETARAAN ${r.program ? r.program.toUpperCase() : 'PAKET C'} (KURIKULUM MERDEKA)`, pageWidth / 2, 40.5, { align: 'center' });

  // 3. IDENTITAS PESERTA DIDIK
  const bioY = 46;
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  // Kolom Kiri
  doc.setFont('helvetica', 'normal'); doc.text('Nama Peserta Didik', marginX, bioY);
  doc.text(':', marginX + 32, bioY);
  doc.setFont('helvetica', 'bold'); doc.text(r.namaSiswa || '-', marginX + 35, bioY);

  doc.setFont('helvetica', 'normal'); doc.text('NISN / NIK', marginX, bioY + 4);
  doc.text(':', marginX + 32, bioY + 4);
  doc.setFont('helvetica', 'bold'); doc.text(r.nisn || '-', marginX + 35, bioY + 4);

  doc.setFont('helvetica', 'normal'); doc.text('Satuan Pendidikan', marginX, bioY + 8);
  doc.text(':', marginX + 32, bioY + 8);
  doc.setFont('helvetica', 'bold'); doc.text(namaSekolahKop, marginX + 35, bioY + 8);

  // Kolom Kanan
  const colRightX = 120;
  doc.setFont('helvetica', 'normal'); doc.text('Kelas / Fase', colRightX, bioY);
  doc.text(':', colRightX + 24, bioY);
  doc.setFont('helvetica', 'bold'); doc.text(r.tingkatKelas || 'Kelas X (Fase E)', colRightX + 27, bioY);

  doc.setFont('helvetica', 'normal'); doc.text('Semester', colRightX, bioY + 4);
  doc.text(':', colRightX + 24, bioY + 4);
  doc.setFont('helvetica', 'bold'); doc.text(r.semester || 'Ganjil', colRightX + 27, bioY + 4);

  doc.setFont('helvetica', 'normal'); doc.text('Tahun Ajaran', colRightX, bioY + 8);
  doc.text(':', colRightX + 24, bioY + 8);
  doc.setFont('helvetica', 'bold'); doc.text(r.tahunAjaran || '2026/2027', colRightX + 27, bioY + 8);

  // 4. TABEL NILAI CAPAIAN HASIL BELAJAR (AUTOTABLE KOMPAK)
  const mapelRows = (r.nilaiMapel || []).map((m, i) => [
    i + 1,
    m.mapel,
    m.nilai,
    m.capaian || 'Mencapai target kompetensi dengan predikat memuaskan.'
  ]);

  doc.autoTable({
    startY: bioY + 12,
    margin: { left: marginX, right: marginX },
    head: [['No', 'Mata Pelajaran', 'Nilai Akhir', 'Capaian Kompetensi / Keterangan Kemajuan Belajar']],
    body: mapelRows,
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
      valign: 'middle',
      cellPadding: 1.8
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontSize: 7 },
      1: { cellWidth: 52, fontSize: 7.2, fontStyle: 'bold' },
      2: { cellWidth: 18, halign: 'center', fontSize: 7.8, fontStyle: 'bold' },
      3: { cellWidth: 'auto', fontSize: 6.8 }
    },
    styles: { cellPadding: 1.6, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.18 }
  });

  let currentY = doc.lastAutoTable.finalY + 3.5;

  // 5. EKSTRAKURIKULER & PEMBERDAYAAN (SATU BARIS KOMPAK)
  const ekskulRows = (Array.isArray(r.ekskul) && r.ekskul.length > 0) ? r.ekskul.map((e, idx) => [
    idx + 1,
    e.kegiatan || '-',
    e.predikat || 'Sangat Baik',
    e.keterangan || 'Mampu berkolaborasi dan menerapkan keterampilan secara mandiri.'
  ]) : [
    [1, 'Keterampilan Komputer & Kewirausahaan Mandiri', 'Baik', 'Aktif mengikuti pelatihan vokasional keterampilan kerja.']
  ];

  doc.autoTable({
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['No', 'Kegiatan Pemberdayaan / Keterampilan / Ekskul', 'Predikat', 'Keterangan']],
    body: ekskulRows,
    theme: 'grid',
    headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.8, cellPadding: 1.5 },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontSize: 6.8 },
      1: { cellWidth: 65, fontSize: 6.8 },
      2: { cellWidth: 20, halign: 'center', fontSize: 6.8 },
      3: { cellWidth: 'auto', fontSize: 6.5 }
    },
    styles: { cellPadding: 1.5, textColor: [30, 41, 59] }
  });

  currentY = doc.lastAutoTable.finalY + 3.5;

  // 6. KOTAK KETIDAKHADIRAN & CATATAN AKADEMIK (DUAL BOX KOMPAK)
  const boxAbsenW = 54;
  const boxCatatanW = pageWidth - (marginX * 2) - boxAbsenW - 4;
  const boxHeight = 19;

  // Kotak Absensi
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, currentY, boxAbsenW, boxHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(5, 150, 105);
  doc.text('KETIDAKHADIRAN', marginX + 3, currentY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  const sakit = r.kehadiran ? (r.kehadiran.sakit || 0) : 0;
  const izin = r.kehadiran ? (r.kehadiran.izin || 0) : 0;
  const alpa = r.kehadiran ? (r.kehadiran.tanpaKeterangan || 0) : 0;

  doc.text(`1. Sakit                : ${sakit} hari`, marginX + 3, currentY + 8.5);
  doc.text(`2. Izin                  : ${izin} hari`, marginX + 3, currentY + 12.5);
  doc.text(`3. Tanpa Keterangan : ${alpa} hari`, marginX + 3, currentY + 16.5);

  // Kotak Catatan Akademik & Karakter
  const catX = marginX + boxAbsenW + 4;
  doc.rect(catX, currentY, boxCatatanW, boxHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(2, 132, 199);
  doc.text('CATATAN AKADEMIK & PROFIL PELAJAR PANCASILA', catX + 3, currentY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  const catatanText = r.catatanAkademik || 'Peserta didik menunjukkan sikap disiplin, gotong royong, dan nalar kritis yang berkembang sangat memuaskan.';
  const splitCatatan = doc.splitTextToSize(catatanText, boxCatatanW - 6);
  doc.text(splitCatatan, catX + 3, currentY + 8.5);

  currentY += boxHeight + 3;

  // 7. STATUS KENAIKAN / KELULUSAN
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(5, 150, 105);
  doc.rect(marginX, currentY, pageWidth - (marginX * 2), 7, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(5, 150, 105);
  doc.text(`Keputusan: Berdasarkan hasil capaian pembelajaran, peserta didik dinyatakan: ${r.statusKenaikanLulus || 'Naik ke Kelas Berikutnya'}`, marginX + 4, currentY + 4.8);

  currentY += 10.5;

  // 8. TANDA TANGAN RESMI
  const ttdY = Math.min(currentY, 260);
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);

  // Kiri: Orang Tua / Wali
  doc.text('Mengetahui,', marginX + 5, ttdY);
  doc.text('Orang Tua / Wali Peserta Didik,', marginX + 5, ttdY + 3.5);
  doc.line(marginX + 5, ttdY + 18, marginX + 50, ttdY + 18);
  doc.setFontSize(6.5);
  doc.text('( ................................................ )', marginX + 5, ttdY + 21.5);

  // Tengah: Tutor Wali Kelas
  const tengahX = 85;
  doc.setFontSize(7);
  doc.text('Sentani, ' + (r.tglRapor || new Date().toLocaleDateString('id-ID')), tengahX, ttdY);
  doc.text('Tutor Pembimbing Akademik,', tengahX, ttdY + 3.5);
  doc.line(tengahX, ttdY + 18, tengahX + 48, ttdY + 18);
  doc.setFont('helvetica', 'bold');
  doc.text('TIM TUTOR PKBM', tengahX, ttdY + 21.5);

  // Kanan: Kepala Sekolah / Pimpinan
  const kananX = 145;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Mengetahui & Mengesahkan:', kananX, ttdY);
  doc.text(`Ketua ${namaSekolahKop},`, kananX, ttdY + 3.5);
  doc.line(kananX, ttdY + 18, kananX + 50, ttdY + 18);
  doc.setFont('helvetica', 'bold');
  doc.text(kepalaNamaKop, kananX, ttdY + 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.text(kepalaNipKop, kananX, ttdY + 24.5);

  // Footer Dokumen
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dokumen resmi Laporan Hasil Belajar diterbitkan oleh Sistem Informasi Akademik SIGAP AURA pada ${new Date().toLocaleString('id-ID')}`, marginX, pageHeight - 4.5);

  const namaFile = `Rapor_${(r.namaSiswa || 'Siswa').replace(/\s+/g, '_')}_${(r.semester || 'Smt')}_${(r.tingkatKelas || 'Kelas')}.pdf`;

  if (!isBatch) {
    if (previewOnly) {
      tampilkanPratinjauPDF(doc, `Buku Raport: ${r.namaSiswa || 'Siswa'} (${r.tingkatKelas || ''})`, namaFile);
    } else {
      doc.save(namaFile);
      Swal.fire({
        icon: 'success',
        title: 'Buku Raport Berhasil Diterbitkan',
        text: `File ${namaFile} telah diunduh siap dicetak resmi.`,
        confirmButtonColor: '#059669'
      });
    }
  }

  return doc;
}

// ==================== PENGATURAN FORMULA TRANSKRIP & TEMPLATE NOMOR ====================
let configTranskrip = {
  templateNomor: 'PKBM-AA/TR/{TAHUN}/{JENJANG}/{NO}',
  metodeRumus: 'kombinasi', // 'kombinasi' | 'murni_rapor' | 'murni_cbt'
  bobotRapor: 60,
  bobotCBT: 40,
  aktifkanQR: true
};

function loadConfigTranskrip() {
  try {
    const saved = localStorage.getItem('ppdb_config_transkrip');
    if (saved) configTranskrip = Object.assign(configTranskrip, JSON.parse(saved));
  } catch (e) {}

  if (typeof callAPI === 'function') {
    callAPI({ action: "getAppSetting", key: "config_transkrip" }).then(res => {
      if (res && res.val) {
        try {
          configTranskrip = Object.assign(configTranskrip, JSON.parse(res.val));
          localStorage.setItem('ppdb_config_transkrip', JSON.stringify(configTranskrip));
        } catch (e) {}
      }
    }).catch(() => {});
  }
}
loadConfigTranskrip();

function formatNomorDokumenTranskrip(s, indexUrut = 1) {
  const tahun = new Date().getFullYear();
  let jjg = 'PKT-C';
  const prog = String((s && s.program) ? s.program : 'Paket C');
  if (prog.includes('Paket A')) jjg = 'PKT-A';
  else if (prog.includes('Paket B')) jjg = 'PKT-B';

  const noUrut = String((s && s.id) ? s.id : indexUrut).padStart(4, '0');
  const tpl = configTranskrip.templateNomor || 'PKBM-AA/TR/{TAHUN}/{JENJANG}/{NO}';

  return tpl.replace('{TAHUN}', tahun)
            .replace('{JENJANG}', jjg)
            .replace('{NO}', noUrut);
}

function bukaModalAturFormulaTranskrip() {
  const modal = document.getElementById('modal-formula-transkrip');
  if (!modal) return;

  document.getElementById('setting-template-no-transkrip').value = configTranskrip.templateNomor || 'PKBM-AA/TR/{TAHUN}/{JENJANG}/{NO}';
  document.getElementById('setting-rumus-transkrip').value = configTranskrip.metodeRumus || 'kombinasi';
  document.getElementById('setting-bobot-rapor').value = configTranskrip.bobotRapor || 60;
  document.getElementById('setting-bobot-cbt').value = configTranskrip.bobotCBT || 40;
  document.getElementById('setting-aktifkan-qr').checked = configTranskrip.aktifkanQR !== false;

  toggleBobotFormula(configTranskrip.metodeRumus || 'kombinasi');
  modal.classList.remove('hidden');
}

function closeModalAturFormulaTranskrip() {
  const modal = document.getElementById('modal-formula-transkrip');
  if (modal) modal.classList.add('hidden');
}

function toggleBobotFormula(metode) {
  const box = document.getElementById('box-bobot-persentase');
  if (box) {
    box.style.display = (metode === 'kombinasi') ? 'grid' : 'none';
  }
}

function simpanPengaturanFormulaTranskrip() {
  const tpl = document.getElementById('setting-template-no-transkrip').value.trim() || 'PKBM-AA/TR/{TAHUN}/{JENJANG}/{NO}';
  const rumus = document.getElementById('setting-rumus-transkrip').value;
  const bRapor = parseInt(document.getElementById('setting-bobot-rapor').value, 10) || 60;
  const bCbt = parseInt(document.getElementById('setting-bobot-cbt').value, 10) || 40;
  const qr = document.getElementById('setting-aktifkan-qr').checked;

  if (rumus === 'kombinasi' && (bRapor + bCbt !== 100)) {
    Swal.fire('Peringatan', `Total pembobotan persentase harus 100% (Saat ini: ${bRapor + bCbt}%).`, 'warning');
    return;
  }

  configTranskrip = {
    templateNomor: tpl,
    metodeRumus: rumus,
    bobotRapor: bRapor,
    bobotCBT: bCbt,
    aktifkanQR: qr
  };

  try { localStorage.setItem('ppdb_config_transkrip', JSON.stringify(configTranskrip)); } catch (e) {}

  if (typeof callAPI === 'function') {
    callAPI({ action: "saveAppSetting", key: "config_transkrip", val: JSON.stringify(configTranskrip) }).catch(() => {});
  }

  closeModalAturFormulaTranskrip();
  renderTranskripTable();

  Swal.fire({
    icon: 'success',
    title: 'Pengaturan Transkrip Disimpan',
    text: 'Format penomoran dan formula kelulusan transkrip berhasil diperbarui.',
    confirmButtonColor: '#0284c7'
  });
}

// Master List Transkrip Khusus / Sekolah Luar / Import
let transkripLuarList = [];

function loadTranskripLuarData() {
  try {
    const raw = localStorage.getItem('ppdb_transkrip_luar_list');
    if (raw) transkripLuarList = JSON.parse(raw);
  } catch (e) {
    console.warn("Gagal load ppdb_transkrip_luar_list", e);
  }

  // Tarik langsung dari Cloud Database Google Sheets (Action getTranskrip / getAppSetting)
  if (typeof callAPI === 'function') {
    callAPI({ action: "getTranskrip" }).then(cloud => {
      if (Array.isArray(cloud) && cloud.length > 0) {
        transkripLuarList = cloud;
        try { localStorage.setItem('ppdb_transkrip_luar_list', JSON.stringify(transkripLuarList)); } catch (e) {}
        renderTranskripTable();
      } else {
        // Fallback getAppSetting
        callAPI({ action: "getAppSetting", key: "ppdb_transkrip_luar_list" }).then(cloudFallback => {
          if (Array.isArray(cloudFallback) && cloudFallback.length > 0) {
            transkripLuarList = cloudFallback;
            try { localStorage.setItem('ppdb_transkrip_luar_list', JSON.stringify(transkripLuarList)); } catch (e) {}
            renderTranskripTable();
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }
}

function saveTranskripLuarData(item = null, isBatch = false) {
  try {
    localStorage.setItem('ppdb_transkrip_luar_list', JSON.stringify(transkripLuarList));
  } catch (e) {
    console.warn("Gagal simpan ppdb_transkrip_luar_list", e);
  }

  // Simpan ke Google Sheets Database
  if (typeof callAPI === 'function') {
    // 1. Simpan ke sheet Transkrip_Nilai
    if (isBatch && Array.isArray(item)) {
      callAPI({ action: "saveTranskripBatch", batch: item }).catch(err => console.warn("Cloud save batch:", err));
    } else if (item && typeof item === 'object') {
      callAPI({ action: "saveTranskrip", transkrip: item }).catch(err => console.warn("Cloud save transkrip:", err));
    }
    // 2. Simpan backup ke sheet Pengaturan
    callAPI({ action: "saveAppSetting", key: "ppdb_transkrip_luar_list", val: transkripLuarList }).catch(() => {});
  }
}

// ==================== SECTION TRANSKRIP NILAI RESMI ====================
function loadTranskripData() {
  loadTranskripLuarData();
  renderTranskripTable();
}

// Helper untuk normalisasi kunci jenjang
function normalisasiJenjang(jenjangStr) {
  const str = String(jenjangStr || '').toLowerCase();
  if (str.includes('paket a') || str.includes('setara sd')) return 'Paket A';
  if (str.includes('paket b') || str.includes('setara smp')) return 'Paket B';
  return 'Paket C';
}

function renderTranskripTable(data = null) {
  const tbody = document.getElementById('table-transkrip-body');
  if (!tbody) return;

  // Gabungkan siswa PKBM Aura Anugerah dan Transkrip Siswa Sekolah Luar
  let combinedList = [];
  if (data) {
    combinedList = data;
  } else {
    // 1. Siswa Internal PKBM (Bisa multi-transkrip jika menempuh beberapa jenjang)
    (siswaDataList || []).forEach(s => {
      // Kumpulkan semua jenjang yang pernah ditempuh siswa:
      // a. Program default siswa
      const listJenjangSiswa = new Set();
      if (s.program) listJenjangSiswa.add(normalisasiJenjang(s.program));

      // b. Jenjang dari riwayat rapor siswa
      (raportDataList || []).forEach(r => {
        if (String(r.siswaId) === String(s.id) || (r.namaSiswa && s.nama && r.namaSiswa.toLowerCase() === s.nama.toLowerCase())) {
          if (r.program) listJenjangSiswa.add(normalisasiJenjang(r.program));
        }
      });

      // c. Jika ada riwayatJenjang eksplisit
      if (Array.isArray(s.riwayatJenjang)) {
        s.riwayatJenjang.forEach(rj => listJenjangSiswa.add(normalisasiJenjang(rj)));
      }

      // Pastikan minimal ada 1 jenjang
      if (listJenjangSiswa.size === 0) listJenjangSiswa.add('Paket C');

      // Masukkan baris terpisah untuk setiap jenjang yang diikuti siswa
      listJenjangSiswa.forEach(jnj => {
        combinedList.push({
          ...s,
          transkripProgram: jnj,
          program: jnj,
          isLuar: false,
          sekolahId: s.sekolahId || 'utama',
          namaSekolahAsal: 'PKBM Aura Anugerah'
        });
      });
    });

    // 2. Siswa Transkrip Manual / Import Excel
    (transkripLuarList || []).forEach(tl => {
      const jnj = normalisasiJenjang(tl.program);
      combinedList.push({
        ...tl,
        transkripProgram: jnj,
        program: jnj,
        isLuar: true,
        namaSekolahAsal: 'PKBM Aura Anugerah'
      });
    });
  }

  // Jika Siswa login, hanya tampilkan miliknya
  if (currentUser && currentUser.role === 'Siswa') {
    combinedList = combinedList.filter(s => 
      (currentUser.dataSiswa && String(s.id) === String(currentUser.dataSiswa.id)) ||
      (currentUser.nama && s.nama && currentUser.nama.toLowerCase() === s.nama.toLowerCase())
    );
  }

  if (!combinedList || combinedList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">Belum ada data peserta didik untuk transkrip nilai.</td></tr>';
    return;
  }

  tbody.innerHTML = combinedList.map((s, idx) => {
    let ipkKumulatif = '-';
    let hasNilai = false;
    const targetProgram = s.transkripProgram || normalisasiJenjang(s.program);

    if (s.isLuar && Array.isArray(s.nilaiMapel) && s.nilaiMapel.length > 0) {
      const sum = s.nilaiMapel.reduce((a, b) => a + (Number(b.nilai) || 0), 0);
      ipkKumulatif = (sum / s.nilaiMapel.length).toFixed(1);
      hasNilai = true;
    } else {
      // Ambil dari rapor siswa internal spesifik jenjang ini
      const rapList = (raportDataList || []).filter(r => {
        const matchSiswa = String(r.siswaId) === String(s.id) || 
          (r.namaSiswa && s.nama && r.namaSiswa.toLowerCase() === s.nama.toLowerCase());
        const matchProgram = normalisasiJenjang(r.program) === targetProgram;
        return matchSiswa && matchProgram;
      });

      let totalRata = 0;
      let countRata = 0;
      rapList.forEach(r => {
        if (Array.isArray(r.nilaiMapel) && r.nilaiMapel.length > 0) {
          const sum = r.nilaiMapel.reduce((a, b) => a + (Number(b.nilai) || 0), 0);
          totalRata += (sum / r.nilaiMapel.length);
          countRata++;
        }
      });
      if (countRata > 0) {
        ipkKumulatif = (totalRata / countRata).toFixed(1);
        hasNilai = true;
      }
    }

    const statusNilaiHtml = hasNilai
      ? `<span style="font-weight: 800; font-size: 14px; color: #0284c7; background: rgba(2, 132, 199, 0.1); padding: 3px 10px; border-radius: 6px;">${ipkKumulatif}</span>`
      : `<span style="font-size: 11.5px; color: var(--text-muted); font-style: italic; background: rgba(100, 116, 139, 0.1); padding: 3px 8px; border-radius: 6px;">Belum Dinilai</span>`;

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>
          <strong>${s.nama || '-'}</strong>
          <br><small style="color: var(--text-muted);">${s.tempatLahir ? s.tempatLahir + ', ' : ''}${s.tglLahir || '-'}</small>
        </td>
        <td>
          <span style="font-weight: 600;">${s.nisn || '-'}</span>
          <br><small style="color: var(--text-muted);">NIK: ${s.nik || '-'}</small>
        </td>
        <td>
          <span class="tag def" style="font-weight: 700;">${targetProgram}</span>
        </td>
        <td style="text-align: center;">
          ${statusNilaiHtml}
        </td>
        <td style="text-align: right; white-space: nowrap;">
          ${s.isLuar ? `
            <button class="btn btn-sm btn-outline" onclick="editDataTranskripLuar('${s.id}')" 
              style="padding: 4px 8px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 3px;"
              title="Edit Data Transkrip">
              <i data-lucide="edit-3" style="width: 12px; height: 12px;"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="hapusDataTranskripLuar('${s.id}')" 
              style="padding: 4px 8px; font-size: 11.5px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); display: inline-flex; align-items: center; gap: 3px;"
              title="Hapus Transkrip">
              <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
            </button>
          ` : `
            <button class="btn btn-sm btn-outline" onclick="lihatDetailTranskrip('${s.id}', '${targetProgram}')" 
              style="padding: 4px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;"
              title="Lihat Rincian Nilai Transkrip Jenjang ${targetProgram}">
              <i data-lucide="eye" style="width: 13px; height: 13px;"></i> Detail
            </button>
          `}
          <button class="btn btn-sm" onclick="cetakTranskripNilaiResmi('${s.id}', { targetProgram: '${targetProgram}' })" 
            style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 4px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;"
            title="Cetak Transkrip Nilai Kumulatif Resmi PDF Jenjang ${targetProgram}">
            <i data-lucide="printer" style="width: 13px; height: 13px;"></i> Cetak PDF
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function filterTranskripTable() {
  const query = (document.getElementById('search-transkrip')?.value || '').toLowerCase().trim();
  const program = document.getElementById('filter-transkrip-program')?.value || '';

  // Buat combined list dulu dengan multi-jenjang
  let combined = [];
  (siswaDataList || []).forEach(s => {
    const listJenjangSiswa = new Set();
    if (s.program) listJenjangSiswa.add(normalisasiJenjang(s.program));
    (raportDataList || []).forEach(r => {
      if (String(r.siswaId) === String(s.id) || (r.namaSiswa && s.nama && r.namaSiswa.toLowerCase() === s.nama.toLowerCase())) {
        if (r.program) listJenjangSiswa.add(normalisasiJenjang(r.program));
      }
    });
    if (Array.isArray(s.riwayatJenjang)) {
      s.riwayatJenjang.forEach(rj => listJenjangSiswa.add(normalisasiJenjang(rj)));
    }
    if (listJenjangSiswa.size === 0) listJenjangSiswa.add('Paket C');

    listJenjangSiswa.forEach(jnj => {
      combined.push({
        ...s,
        transkripProgram: jnj,
        program: jnj,
        isLuar: false,
        sekolahId: 'utama',
        namaSekolahAsal: 'PKBM Aura Anugerah'
      });
    });
  });

  (transkripLuarList || []).forEach(tl => {
    const jnj = normalisasiJenjang(tl.program);
    combined.push({
      ...tl,
      transkripProgram: jnj,
      program: jnj,
      isLuar: true,
      namaSekolahAsal: 'PKBM Aura Anugerah'
    });
  });

  const filtered = combined.filter(s => {
    const progStr = s.transkripProgram || s.program || '';
    const matchQuery = !query || 
      (s.nama || '').toLowerCase().includes(query) || 
      (s.nisn || '').includes(query) || 
      (s.nik || '').includes(query);
    const matchProgram = !program || (progStr && progStr.includes(program));
    return matchQuery && matchProgram;
  });

  renderTranskripTable(filtered);
}

// ==================== MODAL FORM ENTRI TRANSKRIP MANUAL ====================
function bukaModalInputTranskripLuar() {
  const modal = document.getElementById('modal-form-transkrip-luar');
  if (!modal) return;

  document.getElementById('modal-transkrip-luar-title').textContent = 'Entri Transkrip Nilai Manual';
  document.getElementById('transkrip-luar-id').value = '';
  document.getElementById('transkrip-luar-nama').value = '';
  document.getElementById('transkrip-luar-nisn').value = '';
  document.getElementById('transkrip-luar-nik').value = '';
  document.getElementById('transkrip-luar-tempat-lahir').value = 'Sentani';
  document.getElementById('transkrip-luar-tgl-lahir').value = '';
  document.getElementById('transkrip-luar-tahun').value = new Date().getFullYear();
  document.getElementById('transkrip-luar-nomor').value = '';
  document.getElementById('transkrip-luar-program').value = 'Paket C';

  muatMapelDefaultKeTranskripLuar('Paket C');

  modal.classList.remove('hidden');
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

function closeModalInputTranskripLuar() {
  const modal = document.getElementById('modal-form-transkrip-luar');
  if (modal) modal.classList.add('hidden');
}

function onJenjangTranskripLuarChange(jenjang) {
  muatMapelDefaultKeTranskripLuar(jenjang);
}

function muatMapelDefaultKeTranskripLuar(jenjang = 'Paket C', existingMapel = null) {
  const tbody = document.getElementById('transkrip-luar-mapel-tbody');
  if (!tbody) return;

  const list = existingMapel || (defaultMapelKurikulum[jenjang] || defaultMapelKurikulum['Paket C']);

  tbody.innerHTML = list.map((m, idx) => `
    <tr class="row-mapel-luar-item" style="border-bottom: 1px solid var(--border-color);">
      <td style="padding: 6px;">
        <input type="text" class="form-control mapel-luar-nama" value="${m.nama || m.mapel || ''}" style="font-size: 12px; height: 32px;" required>
      </td>
      <td style="padding: 6px;">
        <select class="form-control mapel-luar-kelompok" style="font-size: 11.5px; height: 32px;">
          <option value="Umum" ${(m.kelompok === 'Umum' || !m.kelompok) ? 'selected' : ''}>Umum</option>
          <option value="Pilihan MIPA" ${m.kelompok === 'Pilihan MIPA' ? 'selected' : ''}>Pilihan MIPA</option>
          <option value="Pilihan IPS" ${m.kelompok === 'Pilihan IPS' ? 'selected' : ''}>Pilihan IPS</option>
          <option value="Khusus" ${m.kelompok === 'Khusus' ? 'selected' : ''}>Keterampilan</option>
        </select>
      </td>
      <td style="padding: 6px;">
        <input type="number" class="form-control mapel-luar-kkm" min="0" max="100" value="${m.kkm || 70}" style="font-size: 12px; height: 32px; text-align: center;">
      </td>
      <td style="padding: 6px;">
        <input type="number" class="form-control mapel-luar-nilai" min="0" max="100" value="${m.nilai !== undefined ? m.nilai : 82}" style="font-size: 12.5px; height: 32px; text-align: center; font-weight: 700;" required>
      </td>
      <td style="padding: 6px; text-align: center;">
        <button type="button" class="btn btn-icon btn-danger-text" onclick="this.closest('tr').remove()" style="padding: 4px; color: #ef4444; border: none; background: none; font-size: 16px; cursor: pointer;">&times;</button>
      </td>
    </tr>
  `).join('');
}

function tambahBarisMapelTranskripLuar() {
  const tbody = document.getElementById('transkrip-luar-mapel-tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.className = 'row-mapel-luar-item';
  tr.style.borderBottom = '1px solid var(--border-color)';
  tr.innerHTML = `
    <td style="padding: 6px;">
      <input type="text" class="form-control mapel-luar-nama" placeholder="Nama mata pelajaran" style="font-size: 12px; height: 32px;" required>
    </td>
    <td style="padding: 6px;">
      <select class="form-control mapel-luar-kelompok" style="font-size: 11.5px; height: 32px;">
        <option value="Umum" selected>Umum</option>
        <option value="Pilihan MIPA">Pilihan MIPA</option>
        <option value="Pilihan IPS">Pilihan IPS</option>
        <option value="Khusus">Keterampilan</option>
      </select>
    </td>
    <td style="padding: 6px;">
      <input type="number" class="form-control mapel-luar-kkm" min="0" max="100" value="70" style="font-size: 12px; height: 32px; text-align: center;">
    </td>
    <td style="padding: 6px;">
      <input type="number" class="form-control mapel-luar-nilai" min="0" max="100" value="80" style="font-size: 12.5px; height: 32px; text-align: center; font-weight: 700;" required>
    </td>
    <td style="padding: 6px; text-align: center;">
      <button type="button" class="btn btn-icon btn-danger-text" onclick="this.closest('tr').remove()" style="padding: 4px; color: #ef4444; border: none; background: none; font-size: 16px; cursor: pointer;">&times;</button>
    </td>
  `;
  tbody.appendChild(tr);
}

function simpanDataTranskripLuar() {
  const id = document.getElementById('transkrip-luar-id').value;
  const skhId = 'utama';
  const program = document.getElementById('transkrip-luar-program').value;
  const nama = document.getElementById('transkrip-luar-nama').value.trim();
  const nisn = document.getElementById('transkrip-luar-nisn').value.trim();
  const nik = document.getElementById('transkrip-luar-nik').value.trim();
  const tempatLahir = document.getElementById('transkrip-luar-tempat-lahir').value.trim();
  const tglLahir = document.getElementById('transkrip-luar-tgl-lahir').value.trim();
  const tahunLulus = document.getElementById('transkrip-luar-tahun').value.trim() || String(new Date().getFullYear());
  const nomorTranskrip = document.getElementById('transkrip-luar-nomor').value.trim();

  if (!nama || !nisn) {
    Swal.fire('Peringatan', 'Nama lengkap siswa dan NISN wajib diisi!', 'warning');
    return;
  }

  // Kumpulkan baris nilai mapel
  const rows = document.querySelectorAll('.row-mapel-luar-item');
  const nilaiMapel = [];
  rows.forEach(r => {
    const mapel = r.querySelector('.mapel-luar-nama')?.value.trim();
    const kelompok = r.querySelector('.mapel-luar-kelompok')?.value || 'Umum';
    const kkm = Number(r.querySelector('.mapel-luar-kkm')?.value) || 70;
    const nilai = Number(r.querySelector('.mapel-luar-nilai')?.value) || 0;
    if (mapel) {
      nilaiMapel.push({ mapel, nama: mapel, kelompok, kkm, nilai });
    }
  });

  if (nilaiMapel.length === 0) {
    Swal.fire('Peringatan', 'Minimal harus ada 1 mata pelajaran beserta nilainya!', 'warning');
    return;
  }

  const transkripItem = {
    id: id || ('TR-' + Date.now()),
    isLuar: true,
    sekolahId: 'utama',
    namaSekolah: 'PKBM Aura Anugerah',
    nama,
    nisn,
    nik,
    tempatLahir,
    tglLahir,
    tahunLulus,
    nomorTranskrip,
    program,
    nilaiMapel,
    updatedAt: new Date().toISOString()
  };

  const existingIdx = transkripLuarList.findIndex(t => String(t.id) === String(transkripItem.id));
  if (existingIdx >= 0) {
    transkripLuarList[existingIdx] = transkripItem;
  } else {
    transkripLuarList.unshift(transkripItem);
  }

  saveTranskripLuarData(transkripItem);
  closeModalInputTranskripLuar();
  renderTranskripTable();

  Swal.fire({
    icon: 'success',
    title: 'Transkrip Disimpan',
    text: `Transkrip nilai untuk ${nama} (${program}) berhasil disimpan.`,
    confirmButtonColor: '#059669'
  });
}

function editDataTranskripLuar(id) {
  const item = (transkripLuarList || []).find(t => String(t.id) === String(id));
  if (!item) return;

  bukaModalInputTranskripLuar();
  document.getElementById('modal-transkrip-luar-title').textContent = 'Edit Transkrip Nilai Siswa';
  document.getElementById('transkrip-luar-id').value = item.id;
  document.getElementById('transkrip-luar-program').value = item.program || 'Paket C';
  document.getElementById('transkrip-luar-nama').value = item.nama || '';
  document.getElementById('transkrip-luar-nisn').value = item.nisn || '';
  document.getElementById('transkrip-luar-nik').value = item.nik || '';
  document.getElementById('transkrip-luar-tempatLahir')?.setAttribute('value', item.tempatLahir || '');
  document.getElementById('transkrip-luar-tempat-lahir').value = item.tempatLahir || '';
  document.getElementById('transkrip-luar-tgl-lahir').value = item.tglLahir || '';
  document.getElementById('transkrip-luar-tahun').value = item.tahunLulus || new Date().getFullYear();
  document.getElementById('transkrip-luar-nomor').value = item.nomorTranskrip || '';

  muatMapelDefaultKeTranskripLuar(item.program || 'Paket C', item.nilaiMapel);
}

function hapusDataTranskripLuar(id) {
  const item = (transkripLuarList || []).find(t => String(t.id) === String(id));
  if (!item) return;

  Swal.fire({
    title: 'Hapus Transkrip?',
    text: `Yakin ingin menghapus transkrip nilai ${item.nama}?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Ya, Hapus'
  }).then(res => {
    if (res.isConfirmed) {
      transkripLuarList = transkripLuarList.filter(t => String(t.id) !== String(id));
      saveTranskripLuarData();
      if (typeof callAPI === 'function') {
        callAPI({ action: "deleteTranskrip", id: id }).catch(() => {});
      }
      renderTranskripTable();
      Swal.fire('Terhapus', 'Transkrip berhasil dihapus.', 'success');
    }
  });
}

// ==================== GENERATOR TRANSKRIP NILAI RESMI PDF ====================
// Berstandar Blanko Ijazah & Transkrip Kumulatif Kemendikbudristek
function cetakTranskripNilaiResmi(siswaId, options = {}) {
  const { docInstance = null, isBatch = false, previewOnly = true, forcedSekolahId = null, targetProgram = null } = options;
  let s = (transkripLuarList || []).find(t => String(t.id) === String(siswaId)) ||
          (siswaDataList || []).find(x => String(x.id) === String(siswaId)) || 
          (raportDataList || []).find(r => String(r.siswaId) === String(siswaId)) || {
            nama: 'Siswa PKBM',
            nisn: '0061234567',
            nik: '9103012345670001',
            program: 'Paket C (Setara SMA)',
            tempatLahir: 'Sentani',
            tglLahir: '15 Mei 2005'
          };

  // Jika targetProgram ditentukan, kloning s dan gunakan program tersebut
  if (targetProgram) {
    s = { ...s, program: targetProgram };
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    if (!isBatch) Swal.fire('Error', 'Library PDF belum termuat.', 'error');
    return null;
  }

  const { jsPDF } = window.jspdf;
  const doc = docInstance || new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;

  // Resolusi identitas sekolah (Bisa PKBM Aura Anugerah atau Sekolah Mitra)
  const rapSiswa = (raportDataList || []).find(r => String(r.siswaId) === String(siswaId) || (r.namaSiswa && s.nama && r.namaSiswa.toLowerCase() === s.nama.toLowerCase()));
  const targetSekolahId = forcedSekolahId || s.sekolahId || (rapSiswa ? rapSiswa.sekolahId : 'utama') || 'utama';

  let namaInstansiKop = 'PUSAT KEGIATAN BELAJAR MASYARAKAT';
  let namaSekolahKop = 'PKBM "AURA ANUGERAH"';
  let namaLembagaBiodata = 'PKBM Aura Anugerah';
  let npsnKop = 'P2960013';
  let izinKop = 'Akte Notaris No. 54 Tanggal 06 Agustus 2020 NPSN : P2960013';
  let alamatKop = 'Sekretariat: Jalan Dobonsolo Raya, RT. 003 / RW. 001';
  let tempatSurat = 'Kabupaten Jayapura';
  let kepalaNama = 'Drs. H. ALI YANI, M.Pd.';
  let kepalaNip = 'NIP. -';
  let ttdJabatan = 'Kepala,';
  
  // Ambil profil data sekolah terbaru (PKBM Aura Anugerah) jika ada di memory/storage
  try {
    const tkStored = (typeof infoTKData !== 'undefined' && infoTKData) ? infoTKData : (typeof getStoredTKInfo === 'function' ? getStoredTKInfo() : null);
    if (tkStored) {
      if (tkStored.instansi) namaInstansiKop = tkStored.instansi;
      if (tkStored.nama) namaSekolahKop = tkStored.nama.toUpperCase();
      if (tkStored.satpen) namaLembagaBiodata = tkStored.satpen;
      if (tkStored.npsn) npsnKop = tkStored.npsn;
      if (tkStored.keterangan) izinKop = tkStored.keterangan;
      if (tkStored.jalan) alamatKop = tkStored.jalan;
      if (tkStored.tempat_surat) tempatSurat = tkStored.tempat_surat;
      if (tkStored.kepala_sekolah) kepalaNama = tkStored.kepala_sekolah;
      if (tkStored.nip_kepala) kepalaNip = tkStored.nip_kepala;
      if (tkStored.jabatan_kepala) ttdJabatan = tkStored.jabatan_kepala;
      if (tkStored.logo_kanan) logoKananBase64 = tkStored.logo_kanan;
      if (tkStored.logo_kiri) logoKiriBase64 = tkStored.logo_kiri;
    }
  } catch (e) {
    console.warn("Gagal membaca infoTKData untuk transkrip:", e);
  }

  // 2 Logo Kop: Logo Kiri Tut Wuri Handayani & Logo Kanan PKBM Aura Anugerah / Kustom
  if (!logoKiriBase64) {
    logoKiriBase64 = (typeof ASSET_LOGO_TUTWURI_B64 !== 'undefined') ? ASSET_LOGO_TUTWURI_B64 : null;
  }
  if (!logoKananBase64) {
    logoKananBase64 = (typeof ASSET_LOGO_AURA_B64 !== 'undefined') ? ASSET_LOGO_AURA_B64 : dapatkanLogoSekolahBase64();
  }

  // Bingkai / Border Keaslian Dokumen Resmi
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.6);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.rect(9.5, 9.5, pageWidth - 19, pageHeight - 19);

  // KOP RESMI DENGAN 2 GAMBAR LOGO (KIRI: TUT WURI HANDAYANI, KANAN: LOGO LEMBAGA)
  if (logoKiriBase64) {
    try {
      doc.addImage(logoKiriBase64, 'JPEG', marginX + 1, 12, 22, 22);
    } catch (e) {
      console.warn("Gagal render logo kiri kop:", e.message);
    }
  }
  if (logoKananBase64) {
    try {
      doc.addImage(logoKananBase64, 'PNG', pageWidth - marginX - 23, 12, 22, 22);
    } catch (e) {
      console.warn("Gagal render logo kanan kop:", e.message);
    }
  }

  const kopCenterX = pageWidth / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text(namaInstansiKop, kopCenterX, 16, { align: 'center' });
  doc.setFontSize(13);
  doc.setTextColor(2, 132, 199);
  doc.text(namaSekolahKop, kopCenterX, 22.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(izinKop, kopCenterX, 28, { align: 'center' });
  doc.text(alamatKop, kopCenterX, 32.5, { align: 'center' });
  doc.text('Email: pkbm.auraanugerah@gmail.com | Website: https://pkbmauraanugerah.vercel.app', kopCenterX, 36.5, { align: 'center' });

  // Garis Pembatas Kop Ganda
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.8);
  doc.line(marginX, 39.5, pageWidth - marginX, 39.5);
  doc.setLineWidth(0.3);
  doc.line(marginX, 40.5, pageWidth - marginX, 40.5);

  // JUDUL TRANSKRIP
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('TRANSKRIP NILAI', pageWidth / 2, 47.5, { align: 'center' });
  const tw = doc.getTextWidth('TRANSKRIP NILAI');
  doc.setLineWidth(0.4);
  doc.line((pageWidth / 2) - (tw / 2), 48.5, (pageWidth / 2) + (tw / 2), 48.5);

  doc.setFontSize(9);
  doc.setTextColor(2, 132, 199);
  const noDokumen = formatNomorDokumenTranskrip(s);
  doc.text(`Nomor Dokumen : ${noDokumen}`, pageWidth / 2, 53.5, { align: 'center' });

  // BIODATA SISWA
  const bioY = 60;
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  const bioFields = [
    ['Nama Lengkap Peserta Didik', s.nama || '-'],
    ['Tempat, Tanggal Lahir', `${s.tempatLahir ? s.tempatLahir + ', ' : ''}${s.tglLahir || '-'}`],
    ['Nomor Induk Siswa Nasional (NISN)', s.nisn || '-'],
    ['Nomor Induk Kependudukan (NIK)', s.nik || '-'],
    ['Program Pendidikan Kesetaraan', s.program || 'Paket C (Setara SMA)'],
    ['Satuan Pendidikan Penyelenggara', namaLembagaBiodata]
  ];

  bioFields.forEach((b, i) => {
    doc.setFont('helvetica', 'normal');
    doc.text(b[0], marginX + 4, bioY + (i * 5));
    doc.text(':', marginX + 68, bioY + (i * 5));
    doc.setFont('helvetica', 'bold');
    doc.text(String(b[1]), marginX + 72, bioY + (i * 5));
  });

  // TABEL NILAI TRANSKRIP KUMULATIF
  let transkripRows = [];

  if (s.isLuar && Array.isArray(s.nilaiMapel) && s.nilaiMapel.length > 0) {
    transkripRows = s.nilaiMapel.map((m, idx) => {
      const nilaiFinal = Number(m.nilai) || 80;
      const huruf = nilaiFinal >= 85 ? 'A' : (nilaiFinal >= 75 ? 'B' : 'C');
      const predikat = nilaiFinal >= 85 ? 'Sangat Baik (A)' : (nilaiFinal >= 75 ? 'Baik (B)' : 'Cukup (C)');
      return [
        idx + 1,
        m.nama || m.mapel,
        m.kelompok || 'Umum',
        m.kkm || 70,
        nilaiFinal,
        huruf,
        predikat
      ];
    });
  } else {
    const progStr = String(s.program || '');
    const progKey = progStr.includes('Paket A') ? 'Paket A' : (progStr.includes('Paket B') ? 'Paket B' : 'Paket C');
    const baseMapel = defaultMapelKurikulum[progKey] || defaultMapelKurikulum['Paket C'];

    // Cek apakah ada raport & CBT tersimpan untuk siswa ini (filter juga berdasarkan program yang dicetak jika ada)
    const progNorm = normalisasiJenjang(progKey);
    const rap = (raportDataList || []).find(r => {
      const matchSiswa = String(r.siswaId) === String(s.id) || (r.namaSiswa && s.nama && r.namaSiswa.toLowerCase() === s.nama.toLowerCase());
      const matchProg = !r.program || normalisasiJenjang(r.program) === progNorm;
      return matchSiswa && matchProg;
    }) || (raportDataList || []).find(r => String(r.siswaId) === String(s.id) || (r.namaSiswa && s.nama && r.namaSiswa.toLowerCase() === s.nama.toLowerCase()));
    const cbtList = (ujianHasilList || []).filter(u => String(u.siswaId) === String(s.id) || (u.namaSiswa && s.nama && u.namaSiswa.toLowerCase() === s.nama.toLowerCase()));

    transkripRows = baseMapel.map((m, idx) => {
      let nilaiRapor = null;
      if (rap && Array.isArray(rap.nilaiMapel)) {
        const match = rap.nilaiMapel.find(nm => nm.mapel.toLowerCase().includes(m.nama.toLowerCase()));
        if (match && match.nilai !== undefined && match.nilai !== null && match.nilai !== '') {
          nilaiRapor = Number(match.nilai);
        }
      }

      let nilaiCBT = null;
      const matchCbt = cbtList.find(c => (c.bukuJudul || '').toLowerCase().includes(m.nama.toLowerCase()) || m.nama.toLowerCase().includes((c.bukuJudul || '').toLowerCase()));
      if (matchCbt && matchCbt.nilai !== undefined && matchCbt.nilai !== null && matchCbt.nilai !== '') {
        nilaiCBT = Number(matchCbt.nilai);
      }

      // Hitung berdasarkan metode formula dinamis
      let nilaiFinal = null;
      if (configTranskrip.metodeRumus === 'murni_cbt') {
        nilaiFinal = nilaiCBT;
      } else if (configTranskrip.metodeRumus === 'murni_rapor') {
        nilaiFinal = nilaiRapor;
      } else {
        // Kombinasi berbobot
        if (nilaiRapor !== null && nilaiCBT !== null) {
          const bobotR = configTranskrip.bobotRapor || 60;
          const bobotC = configTranskrip.bobotCBT || 40;
          nilaiFinal = Math.round(((nilaiRapor * bobotR) + (nilaiCBT * bobotC)) / 100);
        } else if (nilaiRapor !== null) {
          nilaiFinal = nilaiRapor;
        } else if (nilaiCBT !== null) {
          nilaiFinal = nilaiCBT;
        }
      }

      if (nilaiFinal !== null) {
        const predikat = nilaiFinal >= 85 ? 'Sangat Baik (A)' : (nilaiFinal >= 75 ? 'Baik (B)' : 'Cukup (C)');
        const huruf = nilaiFinal >= 85 ? 'A' : (nilaiFinal >= 75 ? 'B' : 'C');
        return [
          idx + 1,
          m.nama,
          m.kelompok,
          m.kkm || 70,
          nilaiFinal,
          huruf,
          predikat
        ];
      } else {
        return [
          idx + 1,
          m.nama,
          m.kelompok,
          m.kkm || 70,
          '-',
          '-',
          'Belum Dinilai'
        ];
      }
    });
  }

  doc.autoTable({
    startY: bioY + 34,
    margin: { left: marginX + 2, right: marginX + 2 },
    head: [['No', 'Mata Pelajaran', 'Kelompok', 'KKM', 'Nilai Angka', 'Huruf', 'Kualifikasi']],
    body: transkripRows,
    theme: 'grid',
    headStyles: {
      fillColor: [2, 132, 199],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontSize: 7.5 },
      1: { cellWidth: 62, fontSize: 8, fontStyle: 'bold' },
      2: { cellWidth: 26, halign: 'center', fontSize: 7.5 },
      3: { cellWidth: 14, halign: 'center', fontSize: 8 },
      4: { cellWidth: 22, halign: 'center', fontSize: 8.5, fontStyle: 'bold' },
      5: { cellWidth: 16, halign: 'center', fontSize: 8.5, fontStyle: 'bold' },
      6: { cellWidth: 'auto', fontSize: 7.5 }
    },
    styles: { cellPadding: 2.5, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.2 }
  });

  // Hitung Rata-Rata Kumulatif
  const nilaiValid = transkripRows.filter(r => r[4] !== '-').map(r => Number(r[4]));
  const sumNilai = nilaiValid.reduce((acc, v) => acc + v, 0);
  const rataKumulatif = nilaiValid.length > 0 ? (sumNilai / nilaiValid.length).toFixed(1) : '-';

  let currentY = doc.lastAutoTable.finalY + 6;

  // Box Indeks Prestasi Kumulatif
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(2, 132, 199);
  doc.rect(marginX + 2, currentY, pageWidth - (marginX * 2) - 4, 12, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(2, 132, 199);
  if (rataKumulatif !== '-') {
    doc.text(`NILAI RATA-RATA KUMULATIF : ${rataKumulatif}`, marginX + 6, currentY + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Kualifikasi Kelulusan: Dinyatakan Lulus Program Kesetaraan ${s.program || 'Paket C'} dengan Predikat Memuaskan.`, marginX + 6, currentY + 9.5);
  } else {
    doc.text(`NILAI RATA-RATA KUMULATIF : - (BELUM DINILAI / BELUM ADA RAPOR)`, marginX + 6, currentY + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Kualifikasi Kelulusan: Peserta Didik masih dalam proses pembelajaran / belum memiliki entri nilai raport.`, marginX + 6, currentY + 9.5);
  }

  currentY += 20;

  // Tanda Tangan Dokumen Transkrip
  const ttdY = currentY;
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  // Foto 3x4 Kotak
  doc.setDrawColor(203, 213, 225);
  doc.rect(marginX + 8, ttdY - 2, 28, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Pas Foto', marginX + 16, ttdY + 14);
  doc.text('3 x 4 cm', marginX + 16, ttdY + 18);

  // QR Code Verifikasi Keaslian Dokumen (Tengah)
  if (configTranskrip.aktifkanQR !== false) {
    const qrX = marginX + 48;
    const qrY = ttdY - 2;
    const qrSize = 30;

    // Generate dummy QR visual box / data QR
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.rect(qrX, qrY, qrSize, qrSize, 'FD');

    // Buat visual matriks QR resmi dengan QRCode library jika tersedia, atau fallback visual
    let qrRendered = false;
    try {
      if (typeof QRCode !== 'undefined') {
        const tempDiv = document.createElement('div');
        const verifUrl = `https://pkbmauraanugerah.vercel.app/verifikasi?doc=${encodeURIComponent(noDokumen)}&nisn=${s.nisn || ''}&nama=${encodeURIComponent(s.nama || '')}`;
        const qr = new QRCode(tempDiv, {
          text: verifUrl,
          width: 128,
          height: 128,
          correctLevel: QRCode.CorrectLevel.M
        });
        const qrCanvas = tempDiv.querySelector('canvas');
        if (qrCanvas) {
          const qrDataUrl = qrCanvas.toDataURL('image/png');
          doc.addImage(qrDataUrl, 'PNG', qrX + 1, qrY + 1, qrSize - 2, qrSize - 2);
          qrRendered = true;
        }
      }
    } catch (e) {
      console.warn("QR Render fallback:", e.message);
    }

    if (!qrRendered) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(2, 132, 199);
      doc.text('VALIDASI RESMI', qrX + 4, qrY + 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(71, 85, 105);
      doc.text('TERVERIFIKASI', qrX + 5, qrY + 17);
      doc.text('DIKNAS PAPUA', qrX + 5, qrY + 21);
    }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Pindai untuk verifikasi keaslian', qrX, qrY + qrSize + 4);
  }

  // TTD Kanan
  const kananX = 135;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(`${tempatSurat || 'Kabupaten Jayapura'}, ${new Date().toLocaleDateString('id-ID')}`, kananX, ttdY);
  doc.text(ttdJabatan, kananX, ttdY + 4);
  
  doc.line(kananX, ttdY + 24, kananX + 52, ttdY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(kepalaNama, kananX, ttdY + 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(kepalaNip, kananX, ttdY + 32);

  // Watermark Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Transkrip nilai resmi diterbitkan secara sah oleh Lembaga Penyelenggara ${namaLembagaBiodata} - Dicetak pada ${new Date().toLocaleString('id-ID')}`, marginX + 2, pageHeight - 12);

  if (!isBatch) {
    const namaFile = `Transkrip_Nilai_${(s.nama || 'Siswa').replace(/\s+/g, '_')}_${(s.nisn || 'Resmi')}.pdf`;
    if (previewOnly) {
      tampilkanPratinjauPDF(doc, `Transkrip Nilai Resmi: ${s.nama || 'Siswa'} (${s.nisn || '-'})`, namaFile);
    } else {
      doc.save(namaFile);
      Swal.fire({
        icon: 'success',
        title: 'Transkrip Nilai Resmi Berhasil Diunduh',
        text: `File ${namaFile} telah diunduh dalam format PDF resmi.`,
        confirmButtonColor: '#0284c7'
      });
    }
  }

  return doc;
}

// ==================== EXPORT & PRATINJAU GLOBAL RAPORT (PER TAHUN AJARAN / KELAS) ====================
function bukaModalExportGlobalRaport() {
  const modal = document.getElementById('modal-export-global-raport');
  if (!modal) return;

  modal.classList.remove('hidden');
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function closeModalExportGlobalRaport() {
  const modal = document.getElementById('modal-export-global-raport');
  if (modal) modal.classList.add('hidden');
}

function prosesExportGlobalRaport() {
  const thn = document.getElementById('export-raport-thn')?.value || '';
  const smt = document.getElementById('export-raport-smt')?.value || '';
  const kls = document.getElementById('export-raport-kelas')?.value || '';

  // Filter raportDataList
  const filtered = (raportDataList || []).filter(r => {
    const matchThn = !thn || r.tahunAjaran === thn;
    const matchSmt = !smt || r.semester === smt;
    const matchKls = !kls || (r.tingkatKelas && r.tingkatKelas.includes(kls)) || (r.program && r.program.includes(kls));
    return matchThn && matchSmt && matchKls;
  });

  if (filtered.length === 0) {
    Swal.fire('Data Tidak Ditemukan', 'Tidak ada data raport yang sesuai kriteria filter yang Anda pilih.', 'warning');
    return;
  }

  closeModalExportGlobalRaport();

  Swal.fire({
    title: 'Menyiapkan Pratinjau Global Raport...',
    text: `Sedang menyusun raport ${filtered.length} siswa ke dalam 1 lembar rapi per siswa...`,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  setTimeout(() => {
    try {
      const { jsPDF } = window.jspdf;
      const globalDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      filtered.forEach((r, idx) => {
        if (idx > 0) {
          globalDoc.addPage('a4', 'portrait');
        }
        cetakBukuRaportPDF(r.id, { docInstance: globalDoc, isBatch: true, previewOnly: false });
      });

      const labelTa = thn ? thn.replace('/', '-') : 'SemuaTA';
      const labelSmt = smt || 'SemuaSmt';
      const namaFile = `Buku_Raport_Global_${labelTa}_${labelSmt}_${filtered.length}_Siswa.pdf`;

      Swal.close();
      tampilkanPratinjauPDF(globalDoc, `Pratinjau Raport Global (${filtered.length} Siswa · ${thn || 'Semua TA'} ${smt || ''})`, namaFile);
    } catch (err) {
      console.error("Gagal export global raport:", err);
      Swal.fire('Gagal', 'Terjadi kesalahan saat membuat dokumen global: ' + err.message, 'error');
    }
  }, 400);
}

// ==================== EXPORT & PRATINJAU GLOBAL TRANSKRIP (PER PROGRAM / TAHUN) ====================
function bukaModalExportGlobalTranskrip() {
  const modal = document.getElementById('modal-export-global-transkrip');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
}

function closeModalExportGlobalTranskrip() {
  const modal = document.getElementById('modal-export-global-transkrip');
  if (modal) modal.classList.add('hidden');
}

function prosesExportGlobalTranskrip() {
  const prog = document.getElementById('export-transkrip-program')?.value || '';
  const thn = document.getElementById('export-transkrip-tahun')?.value || new Date().getFullYear();
  const status = document.getElementById('export-transkrip-status')?.value || '';

  const list = (siswaDataList || []).filter(s => {
    const matchProg = !prog || (s.program && s.program.includes(prog));
    const matchStatus = !status || (status === 'aktif' ? (s.statusValidasi === 'diterima' || s.statusValidasi === 'sesuai' || !s.statusValidasi) : true);
    return matchProg && matchStatus;
  });

  if (list.length === 0) {
    Swal.fire('Data Kosong', 'Tidak ada siswa yang sesuai dengan filter kriteria program yang dipilih.', 'warning');
    return;
  }

  closeModalExportGlobalTranskrip();

  Swal.fire({
    title: 'Menyiapkan Transkrip Kelulusan...',
    text: `Sedang memproses transkrip ${list.length} siswa, mohon tunggu...`,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  setTimeout(() => {
    try {
      const { jsPDF } = window.jspdf;
      const globalDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      list.forEach((siswa, index) => {
        if (index > 0) {
          globalDoc.addPage('a4', 'portrait');
        }
        cetakTranskripNilaiResmi(siswa.id, { 
          docInstance: globalDoc, 
          isBatch: true
        });
      });

      const progTag = prog ? prog.replace(/\s+/g, '_') : 'Semua_Program';
      const namaFileGlobal = `Transkrip_Nilai_Global_${progTag}_${thn}.pdf`;
      Swal.close();
      tampilkanPratinjauPDF(globalDoc, `Transkrip Nilai Global (${list.length} Siswa · ${prog || 'Semua Program'} ${thn})`, namaFileGlobal);
    } catch (err) {
      console.error("Gagal pratinjau global transkrip:", err);
      Swal.fire('Gagal', 'Terjadi kesalahan saat memproses pratinjau: ' + err.message, 'error');
    }
  }, 400);
}

// ==================== UNDUH SEMUA TRANSKRIP NILAI PDF (GLOBAL BATCH FALLBACK) ====================
function unduhSemuaTranskripPDF() {
  bukaModalExportGlobalTranskrip();
}

// ==================== MODAL PREVIEW DETAIL TRANSKRIP SISWA ====================
function lihatDetailTranskrip(siswaId, targetProgram = null) {
  const modal = document.getElementById('modal-detail-transkrip');
  const container = document.getElementById('modal-transkrip-body');
  if (!modal || !container) return;

  let s = (siswaDataList || []).find(x => String(x.id) === String(siswaId)) || 
          (raportDataList || []).find(r => String(r.siswaId) === String(siswaId)) || {
            nama: 'Siswa PKBM',
            nisn: '0061234567',
            nik: '9103012345670001',
            program: 'Paket C (Setara SMA)',
            tempatLahir: 'Sentani',
            tglLahir: '15 Mei 2005'
          };

  if (targetProgram) {
    s = { ...s, program: targetProgram };
  }

  const progStr = String(s.program || '');
  const progKey = progStr.includes('Paket A') ? 'Paket A' : (progStr.includes('Paket B') ? 'Paket B' : 'Paket C');
  const baseMapel = defaultMapelKurikulum[progKey] || defaultMapelKurikulum['Paket C'];
  const progNorm = normalisasiJenjang(progKey);
  const rap = (raportDataList || []).find(r => {
    const matchSiswa = String(r.siswaId) === String(s.id) || (r.namaSiswa && s.nama && r.namaSiswa.toLowerCase() === s.nama.toLowerCase());
    const matchProg = !r.program || normalisasiJenjang(r.program) === progNorm;
    return matchSiswa && matchProg;
  }) || (raportDataList || []).find(r => String(r.siswaId) === String(s.id) || (r.namaSiswa && s.nama && r.namaSiswa.toLowerCase() === s.nama.toLowerCase()));

  let totalNilai = 0;
  let countMapelBernilai = 0;

  const rows = baseMapel.map((m, idx) => {
    let nilai = null;
    if (rap && Array.isArray(rap.nilaiMapel)) {
      const match = rap.nilaiMapel.find(nm => nm.mapel.toLowerCase().includes(m.nama.toLowerCase()));
      if (match && match.nilai !== undefined && match.nilai !== null && match.nilai !== '') {
        nilai = Number(match.nilai);
        totalNilai += nilai;
        countMapelBernilai++;
      }
    }

    if (nilai !== null) {
      const huruf = nilai >= 85 ? 'A' : (nilai >= 75 ? 'B' : 'C');
      const predikat = nilai >= 85 ? 'Sangat Baik' : (nilai >= 75 ? 'Baik' : 'Cukup');
      const badgeColor = nilai >= 85 ? '#059669' : (nilai >= 75 ? '#0284c7' : '#d97706');
      const badgeBg = nilai >= 85 ? 'rgba(5, 150, 105, 0.1)' : (nilai >= 75 ? 'rgba(2, 132, 199, 0.1)' : 'rgba(217, 119, 6, 0.1)');

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="text-align: center; padding: 8px;">${idx + 1}</td>
          <td style="padding: 8px;"><b>${m.nama}</b></td>
          <td style="text-align: center; padding: 8px;"><span class="tag def">${m.kelompok}</span></td>
          <td style="text-align: center; padding: 8px;">${m.kkm || 70}</td>
          <td style="text-align: center; padding: 8px;">
            <span style="font-weight: 800; color: ${badgeColor}; background: ${badgeBg}; padding: 2px 8px; border-radius: 4px;">${nilai}</span>
          </td>
          <td style="text-align: center; padding: 8px; font-weight: 700;">${huruf}</td>
          <td style="padding: 8px;"><span style="color: ${badgeColor}; font-weight: 600;">${predikat}</span></td>
        </tr>
      `;
    } else {
      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="text-align: center; padding: 8px;">${idx + 1}</td>
          <td style="padding: 8px;"><b>${m.nama}</b></td>
          <td style="text-align: center; padding: 8px;"><span class="tag def">${m.kelompok}</span></td>
          <td style="text-align: center; padding: 8px;">${m.kkm || 70}</td>
          <td style="text-align: center; padding: 8px;">
            <span style="font-size: 11px; color: var(--text-muted); font-style: italic;">-</span>
          </td>
          <td style="text-align: center; padding: 8px; color: var(--text-muted);">-</td>
          <td style="padding: 8px;"><span style="color: var(--text-muted); font-size: 11px; font-style: italic;">Belum Ada Nilai Rapor</span></td>
        </tr>
      `;
    }
  }).join('');

  const statusKumulatifHtml = countMapelBernilai > 0
    ? `<b style="color: #059669; font-size: 15px;">${(totalNilai / countMapelBernilai).toFixed(1)}</b> (Lulus / Memuaskan)`
    : `<b style="color: var(--text-muted); font-size: 13px; font-style: italic;">Belum Ada Nilai</b>`;

  container.innerHTML = `
    <!-- Header Ringkasan Siswa -->
    <div style="background: var(--surface-2); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-bottom: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 12.5px;">
      <div><span style="color: var(--text-muted);">Nama Peserta Didik:</span><br><b>${s.nama || '-'}</b></div>
      <div><span style="color: var(--text-muted);">NISN / NIK:</span><br><b>${s.nisn || '-'}</b> / ${s.nik || '-'}</div>
      <div><span style="color: var(--text-muted);">Program Kesetaraan:</span><br><b style="color: #0284c7;">${s.program || 'Paket C'}</b></div>
      <div><span style="color: var(--text-muted);">Indeks Nilai Kumulatif:</span><br>${statusKumulatifHtml}</div>
    </div>

    <!-- Tabel Nilai Rinci -->
    <div class="table-container" style="border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 10px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: var(--surface-2); border-bottom: 2px solid var(--border-color);">
            <th style="padding: 8px; text-align: center; width: 40px;">No</th>
            <th style="padding: 8px; text-align: left;">Mata Pelajaran</th>
            <th style="padding: 8px; text-align: center; width: 120px;">Kelompok</th>
            <th style="padding: 8px; text-align: center; width: 60px;">KKM</th>
            <th style="padding: 8px; text-align: center; width: 70px;">Nilai</th>
            <th style="padding: 8px; text-align: center; width: 60px;">Huruf</th>
            <th style="padding: 8px; text-align: left; width: 120px;">Kualifikasi</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

  const btnCetak = document.getElementById('btn-cetak-transkrip-dari-modal');
  if (btnCetak) {
    btnCetak.onclick = () => {
      closeModalDetailTranskrip();
      cetakTranskripNilaiResmi(s.id, { targetProgram: s.program });
    };
  }

  modal.classList.remove('hidden');
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

function closeModalDetailTranskrip() {
  const modal = document.getElementById('modal-detail-transkrip');
  if (modal) modal.classList.add('hidden');
}

// Ekspos semua fungsi ke window global
window.bukaModalExportGlobalRaport = bukaModalExportGlobalRaport;
window.closeModalExportGlobalRaport = closeModalExportGlobalRaport;
window.prosesExportGlobalRaport = prosesExportGlobalRaport;
window.bukaModalExportGlobalTranskrip = bukaModalExportGlobalTranskrip;
window.closeModalExportGlobalTranskrip = closeModalExportGlobalTranskrip;
window.prosesExportGlobalTranskrip = prosesExportGlobalTranskrip;

window.loadRaportData = loadRaportData;
window.renderRaportTable = renderRaportTable;
window.filterRaportTable = filterRaportTable;
window.bukaModalInputRaport = bukaModalInputRaport;
window.closeModalFormRaport = closeModalFormRaport;
window.onRaportSiswaChange = onRaportSiswaChange;
window.tambahBarisMapelRaport = tambahBarisMapelRaport;
window.tarikNilaiCBTKeRaport = tarikNilaiCBTKeRaport;
window.simpanDataRaport = simpanDataRaport;
window.editDataRaport = editDataRaport;
window.hapusDataRaport = hapusDataRaport;
window.cetakBukuRaportPDF = cetakBukuRaportPDF;
window.tampilkanPratinjauPDF = tampilkanPratinjauPDF;
window.closeModalPreviewPDF = closeModalPreviewPDF;

window.loadTranskripData = loadTranskripData;
window.renderTranskripTable = renderTranskripTable;
window.filterTranskripTable = filterTranskripTable;
window.cetakTranskripNilaiResmi = cetakTranskripNilaiResmi;
window.unduhSemuaTranskripPDF = unduhSemuaTranskripPDF;
window.lihatDetailTranskrip = lihatDetailTranskrip;
window.closeModalDetailTranskrip = closeModalDetailTranskrip;
window.bukaModalAturFormulaTranskrip = bukaModalAturFormulaTranskrip;
window.closeModalAturFormulaTranskrip = closeModalAturFormulaTranskrip;
window.toggleBobotFormula = toggleBobotFormula;
window.simpanPengaturanFormulaTranskrip = simpanPengaturanFormulaTranskrip;

// Window exports untuk fitur Transkrip Sekolah Luar
window.bukaModalInputTranskripLuar = bukaModalInputTranskripLuar;
window.closeModalInputTranskripLuar = closeModalInputTranskripLuar;
window.onJenjangTranskripLuarChange = onJenjangTranskripLuarChange;
window.tambahBarisMapelTranskripLuar = tambahBarisMapelTranskripLuar;
window.simpanDataTranskripLuar = simpanDataTranskripLuar;
window.editDataTranskripLuar = editDataTranskripLuar;
window.hapusDataTranskripLuar = hapusDataTranskripLuar;

// ==================== FITUR PENGATURAN KKM MATA PELAJARAN ====================
let currentSelectedKKMJenjang = 'Paket C';

const defaultKKMPreset = {
  'Paket A': [
    { nama: 'Pendidikan Agama dan Budi Pekerti', kelompok: 'Umum', kkm: 70 },
    { nama: 'Pendidikan Pancasila', kelompok: 'Umum', kkm: 70 },
    { nama: 'Bahasa Indonesia', kelompok: 'Umum', kkm: 70 },
    { nama: 'Matematika', kelompok: 'Umum', kkm: 65 },
    { nama: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)', kelompok: 'Umum', kkm: 70 },
    { nama: 'Pemberdayaan & Keterampilan Wirausaha', kelompok: 'Khusus', kkm: 75 }
  ],
  'Paket B': [
    { nama: 'Pendidikan Agama dan Budi Pekerti', kelompok: 'Umum', kkm: 70 },
    { nama: 'Pendidikan Pancasila', kelompok: 'Umum', kkm: 70 },
    { nama: 'Bahasa Indonesia', kelompok: 'Umum', kkm: 70 },
    { nama: 'Matematika', kelompok: 'Umum', kkm: 65 },
    { nama: 'Ilmu Pengetahuan Alam (IPA)', kelompok: 'Umum', kkm: 68 },
    { nama: 'Ilmu Pengetahuan Sosial (IPS)', kelompok: 'Umum', kkm: 70 },
    { nama: 'Bahasa Inggris', kelompok: 'Umum', kkm: 65 },
    { nama: 'Pemberdayaan & Keterampilan Fungsional', kelompok: 'Khusus', kkm: 75 }
  ],
  'Paket C': [
    { nama: 'Pendidikan Agama dan Budi Pekerti', kelompok: 'Umum', kkm: 70 },
    { nama: 'Pendidikan Pancasila', kelompok: 'Umum', kkm: 70 },
    { nama: 'Bahasa Indonesia', kelompok: 'Umum', kkm: 72 },
    { nama: 'Matematika', kelompok: 'Umum', kkm: 68 },
    { nama: 'Bahasa Inggris', kelompok: 'Umum', kkm: 68 },
    { nama: 'Sosiologi', kelompok: 'Pilihan IPS', kkm: 70 },
    { nama: 'Geografi', kelompok: 'Pilihan IPS', kkm: 70 },
    { nama: 'Ekonomi', kelompok: 'Pilihan IPS', kkm: 70 },
    { nama: 'Keterampilan Vokasional / Komputer', kelompok: 'Khusus', kkm: 75 },
    { nama: 'Pemberdayaan Berbasis Komunitas Lokal', kelompok: 'Khusus', kkm: 75 }
  ]
};

function bukaModalSettingKKM() {
  const modal = document.getElementById('modal-setting-kkm');
  if (!modal) return;
  switchKKMTab('Paket C');
  modal.classList.remove('hidden');
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

function closeModalSettingKKM() {
  const modal = document.getElementById('modal-setting-kkm');
  if (modal) modal.classList.add('hidden');
}

function switchKKMTab(jenjang) {
  currentSelectedKKMJenjang = jenjang;
  ['Paket A', 'Paket B', 'Paket C'].forEach(j => {
    const btn = document.getElementById('tab-kkm-' + j.toLowerCase().replace(' ', '-'));
    if (btn) {
      if (j === jenjang) {
        btn.classList.add('active');
        btn.style.background = '#d97706';
        btn.style.color = '#fff';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-color)';
      }
    }
  });

  const tbody = document.getElementById('tbody-setting-kkm');
  if (!tbody) return;

  const mapels = defaultMapelKurikulum[jenjang] || defaultKKMPreset[jenjang];
  tbody.innerHTML = mapels.map((m, idx) => `
    <tr class="row-kkm-item" style="border-bottom: 1px solid var(--border-color);">
      <td style="padding: 8px; text-align: center;">${idx + 1}</td>
      <td style="padding: 8px;">
        <input type="text" class="form-control kkm-mapel-nama" value="${m.nama}" style="font-size: 12px; height: 32px;" required>
      </td>
      <td style="padding: 8px; text-align: center;">
        <select class="form-control kkm-mapel-kelompok" style="font-size: 11.5px; height: 32px;">
          <option value="Umum" ${m.kelompok === 'Umum' ? 'selected' : ''}>Umum</option>
          <option value="Pilihan MIPA" ${m.kelompok === 'Pilihan MIPA' ? 'selected' : ''}>Pilihan MIPA</option>
          <option value="Pilihan IPS" ${m.kelompok === 'Pilihan IPS' ? 'selected' : ''}>Pilihan IPS</option>
          <option value="Khusus" ${m.kelompok === 'Khusus' ? 'selected' : ''}>Khusus/Keterampilan</option>
        </select>
      </td>
      <td style="padding: 8px; text-align: center;">
        <input type="number" class="form-control kkm-mapel-nilai" min="0" max="100" value="${m.kkm || 70}" style="font-size: 13px; font-weight: 700; height: 32px; text-align: center; color: #d97706;">
      </td>
    </tr>
  `).join('');
}

function simpanPengaturanKKM() {
  const jenjang = currentSelectedKKMJenjang;
  const rows = document.querySelectorAll('.row-kkm-item');
  const updatedMapel = [];

  rows.forEach(r => {
    const nama = r.querySelector('.kkm-mapel-nama')?.value.trim();
    const kelompok = r.querySelector('.kkm-mapel-kelompok')?.value || 'Umum';
    const kkm = Number(r.querySelector('.kkm-mapel-nilai')?.value) || 70;
    if (nama) {
      updatedMapel.push({ nama, kelompok, kkm });
    }
  });

  if (updatedMapel.length === 0) {
    Swal.fire('Peringatan', 'Minimal harus ada 1 mata pelajaran!', 'warning');
    return;
  }

  defaultMapelKurikulum[jenjang] = updatedMapel;

  try {
    localStorage.setItem('ppdb_kkm_config', JSON.stringify(defaultMapelKurikulum));
  } catch (e) {
    console.warn("Gagal simpan ppdb_kkm_config:", e);
  }

  if (typeof callAPI === 'function') {
    callAPI({ action: "saveAppSetting", key: "ppdb_kkm_config", val: defaultMapelKurikulum }).catch(() => {});
  }

  closeModalSettingKKM();
  renderTranskripTable();

  Swal.fire({
    icon: 'success',
    title: 'Standar KKM Berhasil Disimpan',
    text: `KKM untuk ${jenjang} telah diperbarui dan langsung diterapkan ke seluruh dokumen nilai.`,
    confirmButtonColor: '#d97706'
  });
}

function resetKKMToDefault() {
  Swal.fire({
    title: 'Reset KKM ke Standar?',
    text: `Nilai KKM untuk ${currentSelectedKKMJenjang} akan dikembalikan ke standar kurikulum kementerian.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#d97706',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Ya, Reset',
    cancelButtonText: 'Batal'
  }).then(res => {
    if (res.isConfirmed) {
      defaultMapelKurikulum[currentSelectedKKMJenjang] = JSON.parse(JSON.stringify(defaultKKMPreset[currentSelectedKKMJenjang]));
      try {
        localStorage.setItem('ppdb_kkm_config', JSON.stringify(defaultMapelKurikulum));
      } catch (e) {}
      switchKKMTab(currentSelectedKKMJenjang);
      Swal.fire('Berhasil', 'KKM telah direset ke nilai acuan default.', 'success');
    }
  });
}

// ==================== FITUR IMPORT DATA TRANSKRIP DARI EXCEL ====================
function bukaModalImportTranskripExcel() {
  const modal = document.getElementById('modal-import-transkrip-excel');
  if (!modal) return;
  const fileInput = document.getElementById('input-file-excel-transkrip');
  if (fileInput) fileInput.value = '';
  const previewBox = document.getElementById('import-excel-preview-box');
  if (previewBox) previewBox.style.display = 'none';

  modal.classList.remove('hidden');
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
}

function closeModalImportTranskripExcel() {
  const modal = document.getElementById('modal-import-transkrip-excel');
  if (modal) modal.classList.add('hidden');
}

function unduhTemplateTranskripExcel() {
  if (typeof XLSX === 'undefined') {
    Swal.fire('Error', 'Library SheetJS Excel belum siap.', 'error');
    return;
  }

  const jenjang = document.getElementById('import-template-jenjang')?.value || 'Paket C';
  const mapels = defaultMapelKurikulum[jenjang] || defaultKKMPreset[jenjang];

  // Susun Header Kolom Excel
  const headers = [
    'Nama Siswa',
    'NISN',
    'NIK',
    'Tempat Lahir',
    'Tanggal Lahir',
    'Program Kesetaraan',
    'Tahun Kelulusan',
    'Nomor Transkrip'
  ];

  mapels.forEach(m => {
    headers.push(m.nama);
  });

  // Contoh baris dummy panduan khusus PKBM Aura Anugerah
  const sampleRow1 = [
    'Contoh Siswa 1',
    '0061234567',
    '9103010101010001',
    'Sentani',
    '15 Mei 2005',
    jenjang,
    '2026',
    'PKBM-AA/TR/2026/001'
  ];
  mapels.forEach(m => sampleRow1.push(m.kkm || 75));

  const sampleRow2 = [
    'Contoh Siswa 2',
    '0067654321',
    '9103010202020002',
    'Jayapura',
    '20 Agustus 2004',
    jenjang,
    '2026',
    'PKBM-AA/TR/2026/002'
  ];
  mapels.forEach(m => sampleRow2.push(80));

  const wsData = [headers, sampleRow1, sampleRow2];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Format Transkrip");

  const fileName = `Template_Transkrip_Nilai_${jenjang.replace(' ', '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function eksekusiImportTranskripExcel() {
  const fileInput = document.getElementById('input-file-excel-transkrip');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    Swal.fire('Peringatan', 'Silakan pilih berkas Excel (.xlsx / .csv) terlebih dahulu!', 'warning');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!jsonData || jsonData.length === 0) {
        Swal.fire('Data Kosong', 'Berkas Excel tidak memiliki baris data untuk diimport.', 'warning');
        return;
      }

      let countImported = 0;
      let countUpdated = 0;

      jsonData.forEach((row, idx) => {
        // Normalisasi key object (case-insensitive & trim)
        const rowNorm = {};
        Object.keys(row).forEach(k => {
          rowNorm[k.trim().toLowerCase()] = row[k];
        });

        const nama = rowNorm['nama siswa'] || rowNorm['nama'] || rowNorm['nama lengkap'] || '';
        if (!nama) return;

        const nisn = String(rowNorm['nisn'] || '').trim();
        const nik = String(rowNorm['nik'] || '').trim();
        const tempatLahir = rowNorm['tempat lahir'] || 'Sentani';
        const tglLahir = rowNorm['tanggal lahir'] || rowNorm['tgl lahir'] || '-';
        const programRaw = rowNorm['program kesetaraan'] || rowNorm['program'] || 'Paket C';
        const program = normalisasiJenjang(programRaw);
        const asalSekolah = rowNorm['asal sekolah / lembaga'] || rowNorm['asal sekolah'] || rowNorm['nama sekolah'] || 'PKBM Aura Anugerah';
        const tahunLulus = String(rowNorm['tahun kelulusan'] || rowNorm['tahun'] || new Date().getFullYear()).trim();
        const nomorTranskrip = rowNorm['nomor transkrip'] || rowNorm['no transkrip'] || '';

        // Ambil mata pelajaran kurikulum untuk jenjang ini
        const listKurikulum = defaultMapelKurikulum[program] || defaultKKMPreset[program];
        const nilaiMapel = [];

        listKurikulum.forEach(m => {
          let nilaiFound = null;
          // Cari kolom di row yang namanya mirip nama mapel
          Object.keys(row).forEach(origKey => {
            const kLow = origKey.trim().toLowerCase();
            const mLow = m.nama.toLowerCase();
            if (kLow === mLow || (kLow.length > 5 && mLow.includes(kLow)) || (mLow.length > 5 && kLow.includes(mLow))) {
              const val = Number(row[origKey]);
              if (!isNaN(val) && row[origKey] !== '') {
                nilaiFound = val;
              }
            }
          });

          nilaiMapel.push({
            mapel: m.nama,
            nama: m.nama,
            kelompok: m.kelompok,
            kkm: m.kkm,
            nilai: nilaiFound !== null ? nilaiFound : m.kkm
          });
        });

        // Tentukan apakah masuk ke transkripLuarList atau siswa internal
        const transkripItem = {
          id: 'TR-IMP-' + (nisn || (Date.now() + '-' + idx)),
          isLuar: true,
          sekolahId: 'import',
          namaSekolah: asalSekolah,
          nama,
          nisn,
          nik,
          tempatLahir,
          tglLahir,
          tahunLulus,
          nomorTranskrip,
          program,
          nilaiMapel,
          updatedAt: new Date().toISOString()
        };

        const existIdx = transkripLuarList.findIndex(t => 
          (nisn && String(t.nisn) === String(nisn)) || 
          (t.nama && t.nama.toLowerCase() === nama.toLowerCase() && normalisasiJenjang(t.program) === program)
        );

        if (existIdx >= 0) {
          transkripLuarList[existIdx] = { ...transkripLuarList[existIdx], ...transkripItem };
          countUpdated++;
        } else {
          transkripLuarList.unshift(transkripItem);
          countImported++;
        }
      });

      saveTranskripLuarData(transkripLuarList, true);
      renderTranskripTable();
      closeModalImportTranskripExcel();

      Swal.fire({
        icon: 'success',
        title: 'Import Transkrip Berhasil!',
        html: `Berhasil menambahkan <b>${countImported}</b> transkrip baru dan memperbarui <b>${countUpdated}</b> data transkrip yang sudah ada.`,
        confirmButtonColor: '#10b981'
      });
    } catch (err) {
      console.error("Gagal import excel:", err);
      Swal.fire('Gagal Import', 'Terjadi kesalahan saat memproses file Excel: ' + err.message, 'error');
    }
  };

  reader.readAsArrayBuffer(file);
}

// Window exports untuk fitur KKM & Import Excel
window.bukaModalSettingKKM = bukaModalSettingKKM;
window.closeModalSettingKKM = closeModalSettingKKM;
window.switchKKMTab = switchKKMTab;
window.simpanPengaturanKKM = simpanPengaturanKKM;
window.resetKKMToDefault = resetKKMToDefault;

window.bukaModalImportTranskripExcel = bukaModalImportTranskripExcel;
window.closeModalImportTranskripExcel = closeModalImportTranskripExcel;
window.unduhTemplateTranskripExcel = unduhTemplateTranskripExcel;
window.eksekusiImportTranskripExcel = eksekusiImportTranskripExcel;



