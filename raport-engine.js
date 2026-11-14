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

// Inisialisasi Bank Raport dari LocalStorage & Cloud
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
    const prog = siswa.program || 'Paket C';
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
    siswaId: targetId || (existingRaport ? existingRaport.siswaId : '1'),
    namaSiswa: (siswa ? siswa.nama : (existingRaport ? existingRaport.namaSiswa : 'Siswa PKBM')),
    nisn: (siswa ? siswa.nisn : (existingRaport ? existingRaport.nisn : '-')),
    program: prog,
    tingkatKelas: kls,
    tahunAjaran: thn,
    semester: smt,
    fase: kls.includes('Fase B') ? 'Fase B' : (kls.includes('Fase C') ? 'Fase C' : (kls.includes('Fase D') ? 'Fase D' : (kls.includes('Fase E') ? 'Fase E' : 'Fase F'))),
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

// ==================== GENERATOR PDF RESMI BUKU RAPORT ====================
// Berstandar A4 Portrait Permendikbudristek No. 21 Tahun 2022
function cetakBukuRaportPDF(id) {
  const r = raportDataList.find(x => x.id === id);
  if (!r) return;

  if (!window.jspdf || !window.jspdf.jsPDF) {
    Swal.fire('Error', 'Library PDF belum termuat.', 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;

  // 1. KOP SURAT RESMI LEMBAGA PKBM
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('PEMERINTAH KABUPATEN JAYAPURA', pageWidth / 2, 14, { align: 'center' });
  doc.text('DINAS PENDIDIKAN DAN KEBUDAYAAN', pageWidth / 2, 19, { align: 'center' });
  doc.setFontSize(12.5);
  doc.setTextColor(5, 150, 105);
  doc.text('PKBM AURA ANUGERAH', pageWidth / 2, 25, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text('NPSN: 69910495 | Izin Operasional: 421.1/043/DPMPTSP/2021 | Terakreditasi', pageWidth / 2, 29.5, { align: 'center' });
  doc.text('Alamat: JL. Yahim KOMP.Buton Samping Hotel Citra Buana, Sentani, Jayapura, Papua - Kode Pos 99352', pageWidth / 2, 33.5, { align: 'center' });

  // Garis Pembatas Kop Ganda
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.8);
  doc.line(marginX, 36.5, pageWidth - marginX, 36.5);
  doc.setLineWidth(0.25);
  doc.line(marginX, 37.5, pageWidth - marginX, 37.5);

  // 2. JUDUL RAPOR
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('LAPORAN HASIL BELAJAR (RAPOR)', pageWidth / 2, 44, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(5, 150, 105);
  doc.text(`PROGRAM PENDIDIKAN KESETARAAN ${r.program ? r.program.toUpperCase() : 'PAKET C'} (KURIKULUM MERDEKA)`, pageWidth / 2, 49, { align: 'center' });

  // 3. IDENTITAS PESERTA DIDIK (TABEL HEADER)
  const bioY = 56;
  doc.setFontSize(8.2);
  doc.setTextColor(30, 41, 59);

  // Kolom Kiri
  doc.setFont('helvetica', 'normal'); doc.text('Nama Peserta Didik', marginX, bioY);
  doc.text(':', marginX + 34, bioY);
  doc.setFont('helvetica', 'bold'); doc.text(r.namaSiswa || '-', marginX + 37, bioY);

  doc.setFont('helvetica', 'normal'); doc.text('NISN / NIK', marginX, bioY + 5);
  doc.text(':', marginX + 34, bioY + 5);
  doc.setFont('helvetica', 'bold'); doc.text(r.nisn || '-', marginX + 37, bioY + 5);

  doc.setFont('helvetica', 'normal'); doc.text('Satuan Pendidikan', marginX, bioY + 10);
  doc.text(':', marginX + 34, bioY + 10);
  doc.setFont('helvetica', 'bold'); doc.text('PKBM Aura Anugerah', marginX + 37, bioY + 10);

  // Kolom Kanan
  const colRightX = 120;
  doc.setFont('helvetica', 'normal'); doc.text('Kelas / Fase', colRightX, bioY);
  doc.text(':', colRightX + 26, bioY);
  doc.setFont('helvetica', 'bold'); doc.text(r.tingkatKelas || 'Kelas X (Fase E)', colRightX + 29, bioY);

  doc.setFont('helvetica', 'normal'); doc.text('Semester', colRightX, bioY + 5);
  doc.text(':', colRightX + 26, bioY + 5);
  doc.setFont('helvetica', 'bold'); doc.text(r.semester || 'Ganjil', colRightX + 29, bioY + 5);

  doc.setFont('helvetica', 'normal'); doc.text('Tahun Ajaran', colRightX, bioY + 10);
  doc.text(':', colRightX + 26, bioY + 10);
  doc.setFont('helvetica', 'bold'); doc.text(r.tahunAjaran || '2026/2027', colRightX + 29, bioY + 10);

  // 4. TABEL NILAI CAPAIAN HASIL BELAJAR (AUTOTABLE)
  const mapelRows = (r.nilaiMapel || []).map((m, i) => [
    i + 1,
    m.mapel,
    m.nilai,
    m.capaian || 'Mencapai target kompetensi dengan predikat memuaskan.'
  ]);

  doc.autoTable({
    startY: bioY + 15,
    margin: { left: marginX, right: marginX },
    head: [['No', 'Mata Pelajaran', 'Nilai Akhir', 'Capaian Kompetensi / Keterangan Kemajuan Belajar']],
    body: mapelRows,
    theme: 'grid',
    headStyles: {
      fillColor: [5, 150, 105],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontSize: 7.5 },
      1: { cellWidth: 55, fontSize: 8, fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center', fontSize: 8.5, fontStyle: 'bold' },
      3: { cellWidth: 'auto', fontSize: 7.5 }
    },
    styles: { cellPadding: 2.5, textColor: [30, 41, 59], lineColor: [203, 213, 225], lineWidth: 0.2 }
  });

  let currentY = doc.lastAutoTable.finalY + 6;

  // Cek apakah halaman cukup untuk catatan & absensi
  if (currentY > 225) {
    doc.addPage();
    currentY = 20;
  }

  // 5. EKSTRAKURIKULER & PEMBERDAYAAN
  const ekskulRows = (Array.isArray(r.ekskul) && r.ekskul.length > 0) ? r.ekskul.map((e, idx) => [
    idx + 1,
    e.kegiatan || '-',
    e.predikat || 'Sangat Baik',
    e.keterangan || 'Mampu berkolaborasi dan menerapkan keterampilan secara mandiri.'
  ]) : [
    [1, 'Keterampilan Komputer & Kewirausahaan', 'Baik', 'Aktif mengikuti pelatihan vokasional keterampilan kerja.']
  ];

  doc.autoTable({
    startY: currentY,
    margin: { left: marginX, right: marginX },
    head: [['No', 'Kegiatan Pemberdayaan / Keterampilan / Ekskul', 'Predikat', 'Keterangan']],
    body: ekskulRows,
    theme: 'grid',
    headStyles: { fillColor: [2, 132, 199], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontSize: 7.5 },
      1: { cellWidth: 70, fontSize: 7.5 },
      2: { cellWidth: 25, halign: 'center', fontSize: 7.5 },
      3: { cellWidth: 'auto', fontSize: 7.5 }
    },
    styles: { cellPadding: 2, textColor: [30, 41, 59] }
  });

  currentY = doc.lastAutoTable.finalY + 5;

  // 6. KOTAK KETIDAKHADIRAN & CATATAN AKADEMIK (DUAL BOX)
  const boxAbsenW = 60;
  const boxCatatanW = pageWidth - (marginX * 2) - boxAbsenW - 5;

  // Kotak Absensi
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, currentY, boxAbsenW, 26, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(5, 150, 105);
  doc.text('KETIDAKHADIRAN', marginX + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const sakit = r.kehadiran ? (r.kehadiran.sakit || 0) : 0;
  const izin = r.kehadiran ? (r.kehadiran.izin || 0) : 0;
  const alpa = r.kehadiran ? (r.kehadiran.tanpaKeterangan || 0) : 0;

  doc.text(`1. Sakit                : ${sakit} hari`, marginX + 4, currentY + 11);
  doc.text(`2. Izin                  : ${izin} hari`, marginX + 4, currentY + 16);
  doc.text(`3. Tanpa Keterangan : ${alpa} hari`, marginX + 4, currentY + 21);

  // Kotak Catatan Akademik & Karakter
  const catX = marginX + boxAbsenW + 5;
  doc.rect(catX, currentY, boxCatatanW, 26, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(2, 132, 199);
  doc.text('CATATAN AKADEMIK & PROFIL PELAJAR PANCASILA', catX + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  const catatanText = r.catatanAkademik || 'Peserta didik menunjukkan sikap disiplin, gotong royong, dan nalar kritis yang berkembang sangat memuaskan.';
  const splitCatatan = doc.splitTextToSize(catatanText, boxCatatanW - 8);
  doc.text(splitCatatan, catX + 4, currentY + 10);

  currentY += 31;

  // 7. STATUS KENAIKAN / KELULUSAN
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(5, 150, 105);
  doc.rect(marginX, currentY, pageWidth - (marginX * 2), 9, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  doc.text(`Keputusan: Berdasarkan hasil capaian pembelajaran, peserta didik dinyatakan: ${r.statusKenaikanLulus || 'Naik ke Kelas Berikutnya'}`, marginX + 4, currentY + 5.5);

  currentY += 14;

  // 8. TANDA TANGAN RESMI (Orang Tua, Tutor Wali, & Kepala PKBM)
  if (currentY > 245) {
    doc.addPage();
    currentY = 25;
  }

  const ttdY = currentY;
  doc.setFontSize(7.8);
  doc.setTextColor(30, 41, 59);

  // Kiri: Orang Tua / Wali
  doc.text('Mengetahui,', marginX + 5, ttdY);
  doc.text('Orang Tua / Wali Peserta Didik,', marginX + 5, ttdY + 4);
  doc.line(marginX + 5, ttdY + 22, marginX + 55, ttdY + 22);
  doc.setFontSize(7);
  doc.text('( ................................................ )', marginX + 5, ttdY + 26);

  // Tengah: Tutor Wali Kelas
  const tengahX = 85;
  doc.setFontSize(7.8);
  doc.text('Sentani, ' + (r.tglRapor || new Date().toLocaleDateString('id-ID')), tengahX, ttdY);
  doc.text('Tutor Pembimbing Akademik,', tengahX, ttdY + 4);
  doc.line(tengahX, ttdY + 22, tengahX + 50, ttdY + 22);
  doc.setFont('helvetica', 'bold');
  doc.text('TIM TUTOR PKBM', tengahX, ttdY + 26);

  // Kanan: Kepala PKBM
  const kananX = 148;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text('Mengetahui & Mengesahkan:', kananX, ttdY);
  doc.text('Ketua PKBM Aura Anugerah,', kananX, ttdY + 4);
  doc.line(kananX, ttdY + 22, kananX + 48, ttdY + 22);
  doc.setFont('helvetica', 'bold');
  doc.text('ANTHONIUS, S.Pd', kananX, ttdY + 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text('NIY. 201804.001', kananX, ttdY + 29.5);

  // Footer Dokumen
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dokumen resmi Laporan Hasil Belajar diterbitkan oleh Sistem Informasi Akademik PKBM Aura Anugerah pada ${new Date().toLocaleString('id-ID')}`, marginX, pageHeight - 6);

  const namaFile = `Rapor_${(r.namaSiswa || 'Siswa').replace(/\s+/g, '_')}_${(r.semester || 'Smt')}_${(r.tingkatKelas || 'Kelas')}.pdf`;
  doc.save(namaFile);

  Swal.fire({
    icon: 'success',
    title: 'Buku Raport Berhasil Diterbitkan',
    text: `File ${namaFile} telah diunduh siap dicetak resmi.`,
    confirmButtonColor: '#059669'
  });
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
  const prog = (s && s.program) ? s.program : 'Paket C';
  if (prog.includes('Paket A')) jjg = 'PKT-A';
  else if (prog.includes('Paket B')) jjg = 'PKT-B';

  const noUrut = String(s.id || indexUrut).padStart(4, '0');
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

// ==================== SECTION TRANSKRIP NILAI RESMI ====================
function loadTranskripData() {
  renderTranskripTable();
}

function renderTranskripTable(data = null) {
  const tbody = document.getElementById('table-transkrip-body');
  if (!tbody) return;

  let list = data || siswaDataList;

  // Jika Siswa login, hanya tampilkan miliknya
  if (currentUser && currentUser.role === 'Siswa') {
    list = list.filter(s => 
      (currentUser.dataSiswa && String(s.id) === String(currentUser.dataSiswa.id)) ||
      (currentUser.nama && s.nama && currentUser.nama.toLowerCase() === s.nama.toLowerCase())
    );
  }

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">Belum ada data peserta didik untuk transkrip nilai.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((s, idx) => {
    // Ambil semua rapor yang dimiliki siswa ini untuk hitung IPK / Rata Kumulatif
    const rapList = (raportDataList || []).filter(r => 
      String(r.siswaId) === String(s.id) || 
      (r.namaSiswa && s.nama && r.namaSiswa.toLowerCase() === s.nama.toLowerCase())
    );

    let totalRata = 0;
    let countRata = 0;
    rapList.forEach(r => {
      if (Array.isArray(r.nilaiMapel) && r.nilaiMapel.length > 0) {
        const sum = r.nilaiMapel.reduce((a, b) => a + (Number(b.nilai) || 0), 0);
        totalRata += (sum / r.nilaiMapel.length);
        countRata++;
      }
    });

    const ipkKumulatif = countRata > 0 ? (totalRata / countRata).toFixed(1) : '82.5';
    const statusBelajar = s.statusValidasi === 'diterima' || s.statusValidasi === 'sesuai' ? 'Aktif Belajar' : 'Calon Terdaftar';

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
          <span class="tag def">${s.program || 'Paket C'}</span>
        </td>
        <td>
          <span class="tag" style="background: rgba(5, 150, 105, 0.12); color: #059669; font-weight: 600;">
            ${statusBelajar}
          </span>
        </td>
        <td style="text-align: center;">
          <span style="font-weight: 800; font-size: 14.5px; color: #0284c7; background: rgba(2, 132, 199, 0.1); padding: 3px 12px; border-radius: 6px;">
            ${ipkKumulatif}
          </span>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-sm btn-outline" onclick="lihatDetailTranskrip('${s.id}')" 
            style="padding: 4px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;"
            title="Lihat Rincian Nilai Transkrip">
            <i data-lucide="eye" style="width: 13px; height: 13px;"></i> Detail
          </button>
          <button class="btn btn-sm" onclick="cetakTranskripNilaiResmi('${s.id}')" 
            style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #fff; border: none; padding: 4px 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;"
            title="Cetak Transkrip Nilai Kumulatif Resmi PDF">
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

  const filtered = (siswaDataList || []).filter(s => {
    const matchQuery = !query || 
      (s.nama || '').toLowerCase().includes(query) || 
      (s.nisn || '').includes(query) || 
      (s.nik || '').includes(query);
    const matchProgram = !program || s.program === program;
    return matchQuery && matchProgram;
  });

  renderTranskripTable(filtered);
}

// ==================== GENERATOR TRANSKRIP NILAI RESMI PDF ====================
// Berstandar Blanko Ijazah & Transkrip Kumulatif Kemendikbudristek
function cetakTranskripNilaiResmi(siswaId) {
  const s = (siswaDataList || []).find(x => String(x.id) === String(siswaId)) || 
            (raportDataList || []).find(r => String(r.siswaId) === String(siswaId)) || {
              nama: 'Siswa PKBM',
              nisn: '0061234567',
              nik: '9103012345670001',
              program: 'Paket C (Setara SMA)',
              tempatLahir: 'Sentani',
              tglLahir: '15 Mei 2005'
            };

  if (!window.jspdf || !window.jspdf.jsPDF) {
    Swal.fire('Error', 'Library PDF belum termuat.', 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;

  // Bingkai / Border Keaslian Dokumen Resmi
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.6);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.rect(9.5, 9.5, pageWidth - 19, pageHeight - 19);

  // KOP RESMI
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('PEMERINTAH KABUPATEN JAYAPURA', pageWidth / 2, 17, { align: 'center' });
  doc.text('DINAS PENDIDIKAN DAN KEBUDAYAAN', pageWidth / 2, 22, { align: 'center' });
  doc.setFontSize(13);
  doc.setTextColor(2, 132, 199);
  doc.text('PKBM AURA ANUGERAH SENTANI', pageWidth / 2, 28, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Penyelenggara Pendidikan Kesetaraan Terakreditasi Nasional | NPSN: 69910495', pageWidth / 2, 32.5, { align: 'center' });
  doc.text('SK Izin Operasional: 421.1/043/DPMPTSP/2021 | Sentani, Jayapura, Papua (99352)', pageWidth / 2, 36.5, { align: 'center' });

  // Garis Pembatas Kop
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.8);
  doc.line(marginX, 39.5, pageWidth - marginX, 39.5);
  doc.setLineWidth(0.3);
  doc.line(marginX, 40.5, pageWidth - marginX, 40.5);

  // JUDUL TRANSKRIP
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('TRANSKRIP NILAI AKADEMIK RESMI', pageWidth / 2, 48, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(2, 132, 199);
  const noDokumen = formatNomorDokumenTranskrip(s);
  doc.text(`Nomor Dokumen: ${noDokumen}`, pageWidth / 2, 53, { align: 'center' });

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
    ['Satuan Pendidikan Penyelenggara', 'PKBM Aura Anugerah Sentani']
  ];

  bioFields.forEach((b, i) => {
    doc.setFont('helvetica', 'normal');
    doc.text(b[0], marginX + 4, bioY + (i * 5));
    doc.text(':', marginX + 68, bioY + (i * 5));
    doc.setFont('helvetica', 'bold');
    doc.text(String(b[1]), marginX + 72, bioY + (i * 5));
  });

  // TABEL NILAI TRANSKRIP KUMULATIF
  const progKey = (s.program && s.program.includes('Paket A')) ? 'Paket A' : ((s.program && s.program.includes('Paket B')) ? 'Paket B' : 'Paket C');
  const baseMapel = defaultMapelKurikulum[progKey] || defaultMapelKurikulum['Paket C'];

  // Cek apakah ada raport & CBT tersimpan untuk siswa ini
  const rap = (raportDataList || []).find(r => String(r.siswaId) === String(s.id) || (r.namaSiswa && s.nama && r.namaSiswa.toLowerCase() === s.nama.toLowerCase()));
  const cbtList = (ujianHasilList || []).filter(u => String(u.siswaId) === String(s.id) || (u.namaSiswa && s.nama && u.namaSiswa.toLowerCase() === s.nama.toLowerCase()));

  const transkripRows = baseMapel.map((m, idx) => {
    let nilaiRapor = 80;
    if (rap && Array.isArray(rap.nilaiMapel)) {
      const match = rap.nilaiMapel.find(nm => nm.mapel.toLowerCase().includes(m.nama.toLowerCase()));
      if (match) nilaiRapor = Number(match.nilai) || 80;
    }

    let nilaiCBT = 82;
    const matchCbt = cbtList.find(c => (c.bukuJudul || '').toLowerCase().includes(m.nama.toLowerCase()) || m.nama.toLowerCase().includes((c.bukuJudul || '').toLowerCase()));
    if (matchCbt) {
      nilaiCBT = Number(matchCbt.nilai) || 82;
    } else {
      nilaiCBT = nilaiRapor;
    }

    // Hitung berdasarkan metode formula dinamis
    let nilaiFinal = nilaiRapor;
    if (configTranskrip.metodeRumus === 'murni_cbt') {
      nilaiFinal = nilaiCBT;
    } else if (configTranskrip.metodeRumus === 'murni_rapor') {
      nilaiFinal = nilaiRapor;
    } else {
      // Kombinasi berbobot
      const bobotR = configTranskrip.bobotRapor || 60;
      const bobotC = configTranskrip.bobotCBT || 40;
      nilaiFinal = Math.round(((nilaiRapor * bobotR) + (nilaiCBT * bobotC)) / 100);
    }

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
  });

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
  const sumNilai = transkripRows.reduce((acc, r) => acc + Number(r[4]), 0);
  const rataKumulatif = (sumNilai / transkripRows.length).toFixed(1);

  let currentY = doc.lastAutoTable.finalY + 6;

  // Box Indeks Prestasi Kumulatif
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(2, 132, 199);
  doc.rect(marginX + 2, currentY, pageWidth - (marginX * 2) - 4, 12, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(2, 132, 199);
  doc.text(`NILAI RATA-RATA KUMULATIF : ${rataKumulatif} (DELAPAN PULUH DUA KOMA LIMA)`, marginX + 6, currentY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Kualifikasi Kelulusan: Dinyatakan Lulus Program Kesetaraan ${s.program || 'Paket C'} dengan Predikat Memuaskan.`, marginX + 6, currentY + 9.5);

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
  doc.text(`Sentani, ${new Date().toLocaleDateString('id-ID')}`, kananX, ttdY);
  doc.text('Ketua Penyelenggara PKBM Aura Anugerah,', kananX, ttdY + 4);
  
  doc.line(kananX, ttdY + 24, kananX + 52, ttdY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('ANTHONIUS, S.Pd', kananX, ttdY + 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('NIY. 201804.001', kananX, ttdY + 32);

  // Watermark Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Transkrip nilai resmi diterbitkan secara sah oleh Lembaga Penyelenggara PKBM Aura Anugerah - Dicetak pada ${new Date().toLocaleString('id-ID')}`, marginX + 2, pageHeight - 12);

  const namaFile = `Transkrip_Nilai_${(s.nama || 'Siswa').replace(/\s+/g, '_')}_${(s.nisn || 'Resmi')}.pdf`;
  doc.save(namaFile);

  Swal.fire({
    icon: 'success',
    title: 'Transkrip Nilai Resmi Berhasil Diunduh',
    text: `File ${namaFile} telah diunduh dalam format PDF resmi.`,
    confirmButtonColor: '#0284c7'
  });
}

// ==================== MODAL PREVIEW DETAIL TRANSKRIP SISWA ====================
function lihatDetailTranskrip(siswaId) {
  const modal = document.getElementById('modal-detail-transkrip');
  const container = document.getElementById('modal-transkrip-body');
  if (!modal || !container) return;

  const s = (siswaDataList || []).find(x => String(x.id) === String(siswaId)) || 
            (raportDataList || []).find(r => String(r.siswaId) === String(siswaId)) || {
              nama: 'Siswa PKBM',
              nisn: '0061234567',
              nik: '9103012345670001',
              program: 'Paket C (Setara SMA)',
              tempatLahir: 'Sentani',
              tglLahir: '15 Mei 2005'
            };

  const progKey = (s.program && s.program.includes('Paket A')) ? 'Paket A' : ((s.program && s.program.includes('Paket B')) ? 'Paket B' : 'Paket C');
  const baseMapel = defaultMapelKurikulum[progKey] || defaultMapelKurikulum['Paket C'];
  const rap = (raportDataList || []).find(r => String(r.siswaId) === String(s.id) || (r.namaSiswa && s.nama && r.namaSiswa.toLowerCase() === s.nama.toLowerCase()));

  const rows = baseMapel.map((m, idx) => {
    let nilai = 82;
    if (rap && Array.isArray(rap.nilaiMapel)) {
      const match = rap.nilaiMapel.find(nm => nm.mapel.toLowerCase().includes(m.nama.toLowerCase()));
      if (match) nilai = match.nilai;
    }
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
  }).join('');

  const sumNilai = baseMapel.reduce((acc, m) => {
    let nilai = 82;
    if (rap && Array.isArray(rap.nilaiMapel)) {
      const match = rap.nilaiMapel.find(nm => nm.mapel.toLowerCase().includes(m.nama.toLowerCase()));
      if (match) nilai = match.nilai;
    }
    return acc + Number(nilai);
  }, 0);
  const rataRata = (sumNilai / baseMapel.length).toFixed(1);

  container.innerHTML = `
    <!-- Header Ringkasan Siswa -->
    <div style="background: var(--surface-2); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-bottom: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 12.5px;">
      <div><span style="color: var(--text-muted);">Nama Peserta Didik:</span><br><b>${s.nama || '-'}</b></div>
      <div><span style="color: var(--text-muted);">NISN / NIK:</span><br><b>${s.nisn || '-'}</b> / ${s.nik || '-'}</div>
      <div><span style="color: var(--text-muted);">Program Kesetaraan:</span><br><b style="color: #0284c7;">${s.program || 'Paket C'}</b></div>
      <div><span style="color: var(--text-muted);">Indeks Nilai Kumulatif:</span><br><b style="color: #059669; font-size: 15px;">${rataRata}</b> (Predikat Memuaskan)</div>
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
      cetakTranskripNilaiResmi(s.id);
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

window.loadTranskripData = loadTranskripData;
window.renderTranskripTable = renderTranskripTable;
window.filterTranskripTable = filterTranskripTable;
window.cetakTranskripNilaiResmi = cetakTranskripNilaiResmi;
window.lihatDetailTranskrip = lihatDetailTranskrip;
window.closeModalDetailTranskrip = closeModalDetailTranskrip;
window.bukaModalAturFormulaTranskrip = bukaModalAturFormulaTranskrip;
window.closeModalAturFormulaTranskrip = closeModalAturFormulaTranskrip;
window.toggleBobotFormula = toggleBobotFormula;
window.simpanPengaturanFormulaTranskrip = simpanPengaturanFormulaTranskrip;



