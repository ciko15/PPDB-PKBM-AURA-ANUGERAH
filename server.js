import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1MGmf21rJRhLw29cxMEm2vLz2ogfLI0ebxjlOj_OfE-g';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// Google Sheets Auth setup
const credsPath = path.join(__dirname, 'server', 'config', 'credentials.json');
let serviceAccountAuth = null;
let doc = null;

if (fs.existsSync(credsPath)) {
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
} else {
  console.warn('⚠️ File credentials.json tidak ditemukan di server/config/credentials.json');
}

async function getSheet(sheetTitle) {
  if (!doc) throw new Error('Google Spreadsheet belum terkonfigurasi atau credentials.json tidak ditemukan.');
  await doc.loadInfo();
  let sheet = doc.sheetsByTitle[sheetTitle];
  if (!sheet) {
    if (sheetTitle === 'Users') {
      sheet = await doc.addSheet({
        title: 'Users',
        headerValues: ['Username', 'Password', 'Nama Lengkap', 'Role']
      });
      await sheet.addRow({
        'Username': 'admin',
        'Password': 'admin',
        'Nama Lengkap': 'Administrator',
        'Role': 'Admin'
      });
    } else if (sheetTitle === 'Data_Siswa') {
      sheet = await doc.addSheet({
        title: 'Data_Siswa',
        headerValues: [
          'No.', 'Tanggal Daftar', 'NISN', 'NIK', 'No. Kartu Keluarga', 'Urut KK',
          'Kabupaten/Kota', 'Kecamatan', 'Desa Kelurahan', 'Nama Lengkap',
          'Tempat Lahir', 'Tanggal Lahir', 'Nama Ayah Kandung', 'Tahun Lahir Ayah',
          'NIK Ayah', 'Nama Ibu Kandung', 'Tahun Lahir Ibu', 'NIK Ibu',
          'Jenjang', 'Syarat', 'Dok Berkas', 'Kelas', 'Foto',
          'Status Validasi', 'Catatan AI', 'URL Ijazah', 'URL KK',
          'Bukti Pembayaran', 'Status Aktif', 'Didaftarkan Oleh',
          'Jenis Kelamin', 'Tahun Lulus', 'Nama Wali'
        ]
      });
    } else {
      throw new Error(`Sheet ${sheetTitle} tidak ditemukan di Spreadsheet.`);
    }
  }
  return sheet;
}

async function handleLogin(username, password) {
  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '').trim();

  // 1. Cek dari sheet Users (Guru, Admin, Super Admin)
  const userSheet = await getSheet('Users');
  const userRows = await userSheet.getRows();
  for (const row of userRows) {
    const raw = row.toObject();
    if (String(raw['Username'] || '').trim() === cleanUser && String(raw['Password'] || '').trim() === cleanPass) {
      return {
        username: raw['Username'],
        nama: raw['Nama Lengkap'],
        role: raw['Role']
      };
    }
  }

  // 2. Cek dari sheet Data_Siswa (Login Peserta Didik)
  // Username: NIK atau NISN
  // Password: Tanggal Lahir (YYYY-MM-DD atau DDMMYYYY) atau 6 digit NIK terakhir
  try {
    const siswaSheet = await getSheet('Data_Siswa');
    const siswaRows = await siswaSheet.getRows();

    for (const r of siswaRows) {
      const raw = r.toObject();
      const sNik = String(raw['NIK'] || '').trim();
      const sNisn = String(raw['NISN'] || '').trim();
      const sNama = raw['Nama Lengkap'] || 'Peserta Didik';
      const sTglLahir = String(raw['Tanggal Lahir'] || '').trim().split('T')[0]; // e.g. 2003-09-21

      // Format password yang valid untuk siswa:
      // a. Persis sama dengan tanggal lahir di database (e.g. 2003-09-21)
      // b. Tanpa tanda hubung (e.g. 20030921 atau 21092003)
      // c. 6 digit NIK terakhir
      const parts = sTglLahir.split('-');
      const ddmmyyyy = parts.length === 3 ? `${parts[2]}${parts[1]}${parts[0]}` : '';
      const yyyymmdd = parts.join('');
      const last6Nik = sNik.length >= 6 ? sNik.slice(-6) : '';

      const matchUser = (cleanUser === sNik || (sNisn && cleanUser === sNisn));
      const matchPass = (
        cleanPass === sTglLahir ||
        (ddmmyyyy && cleanPass === ddmmyyyy) ||
        (yyyymmdd && cleanPass === yyyymmdd) ||
        (last6Nik && cleanPass === last6Nik)
      );

      if (matchUser && matchPass) {
        return {
          username: sNik || sNisn,
          nama: sNama,
          role: 'Siswa',
          dataSiswa: {
            id: raw['No.'] || '',
            nik: sNik,
            nisn: sNisn,
            nama: sNama,
            program: raw['Jenjang'] || '',
            tempatLahir: raw['Tempat Lahir'] || '',
            tglLahir: sTglLahir,
            namaIbu: raw['Nama Ibu Kandung'] || '',
            alamat: `${raw['Desa Kelurahan'] || ''}, ${raw['Kecamatan'] || ''}, ${raw['Kabupaten/Kota'] || ''}`.replace(/^,\s*|,\s*$/g, ''),
            statusValidasi: raw['Status Validasi'] || 'Pending',
            catatanAI: raw['Catatan AI'] || '',
            statusAktif: raw['Status Aktif'] || 'Aktif'
          }
        };
      }
    }
  } catch (err) {
    console.error('Error saat verifikasi login siswa:', err.message);
  }

  throw new Error('Username atau password salah. Untuk Siswa, masukkan Username: NIK/NISN dan Password: Tanggal Lahir (contoh: 21092003 atau YYYY-MM-DD).');
}

async function handleGetUsers() {
  const sheet = await getSheet('Users');
  const rows = await sheet.getRows();
  return rows.map(r => {
    const raw = r.toObject();
    return {
      username: raw['Username'],
      nama: raw['Nama Lengkap'],
      role: raw['Role']
    };
  });
}

async function handleAddUser(username, password, nama, role) {
  const sheet = await getSheet('Users');
  const rows = await sheet.getRows();
  if (rows.some(r => r.get('Username') === username)) {
    throw new Error('Username sudah terdaftar.');
  }
  await sheet.addRow({
    'Username': username,
    'Password': password,
    'Nama Lengkap': nama,
    'Role': role
  });
  return { message: 'Pengguna berhasil ditambahkan.' };
}

async function handleUpdateUser(username, nama, password) {
  const sheet = await getSheet('Users');
  const rows = await sheet.getRows();
  const target = rows.find(r => r.get('Username') === username);
  if (!target) throw new Error('User tidak ditemukan.');

  if (nama) target.set('Nama Lengkap', nama);
  if (password) target.set('Password', password);
  await target.save();
  return { message: 'Data profil berhasil diperbarui.' };
}

async function handleDeleteUser(username) {
  const sheet = await getSheet('Users');
  const rows = await sheet.getRows();
  const target = rows.find(r => r.get('Username') === username);
  if (!target) throw new Error('User tidak ditemukan.');
  await target.delete();
  return { message: 'Pengguna berhasil dihapus.' };
}

async function handleGetSiswa(pendingOnly) {
  const sheet = await getSheet('Data_Siswa');
  const rows = await sheet.getRows();
  const list = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const statusValidasi = row.get('Status Validasi') || '';

    if (!pendingOnly || statusValidasi === 'Pending' || statusValidasi === '') {
      list.push({
        id: row.get('No.') || '',
        tglDaftar: row.get('Tanggal Daftar') || '',
        nisn: row.get('NISN') || '',
        nik: row.get('NIK') || '',
        noKk: row.get('No. Kartu Keluarga') || '',
        urutKk: row.get('Urut KK') || '',
        kabKota: row.get('Kabupaten/Kota') || '',
        kecamatan: row.get('Kecamatan') || '',
        desaKelurahan: row.get('Desa Kelurahan') || '',
        nama: row.get('Nama Lengkap') || '',
        tempatLahir: row.get('Tempat Lahir') || '',
        tglLahir: row.get('Tanggal Lahir') || '',
        namaAyah: row.get('Nama Ayah Kandung') || '',
        tahunLahirAyah: row.get('Tahun Lahir Ayah') || '',
        nikAyah: row.get('NIK Ayah') || '',
        namaIbu: row.get('Nama Ibu Kandung') || '',
        tahunLahirIbu: row.get('Tahun Lahir Ibu') || '',
        nikIbu: row.get('NIK Ibu') || '',
        jenjang: row.get('Jenjang') || '',
        program: row.get('Jenjang') || '',
        syarat: row.get('Syarat') || '',
        dokBerkas: row.get('Dok Berkas') || '',
        kelas: row.get('Kelas') || '',
        urlFoto: row.get('Foto') || '',
        status: statusValidasi,
        koreksiAI: row.get('Catatan AI') || '',
        urlIjazah: row.get('URL Ijazah') || '',
        urlKK: row.get('URL KK') || '',
        urlBayar: row.get('Bukti Pembayaran') || '',
        statusAktif: row.get('Status Aktif') || 'Tidak Aktif',
        createdBy: row.get('Didaftarkan Oleh') || '',
        jk: row.get('Jenis Kelamin') || '',
        tahunLulus: row.get('Tahun Lulus') || '',
        namaWali: row.get('Nama Wali') || '',
        rowIndex: i + 2
      });
    }
  }
  return list;
}

async function handleRegisterSiswa(dataObj) {
  const sheet = await getSheet('Data_Siswa');
  const rows = await sheet.getRows();

  const inputNik = String(dataObj.nik || '').trim();
  const inputNisn = String(dataObj.nisn || '').trim();

  for (const r of rows) {
    const existingNik = String(r.get('NIK') || '').trim();
    const existingNisn = String(r.get('NISN') || '').trim();
    if (inputNik && inputNik === existingNik) {
      throw new Error(`Data kembar: NIK sudah terdaftar atas nama ${r.get('Nama Lengkap')}.`);
    }
    if (inputNisn && inputNisn === existingNisn) {
      throw new Error(`Data kembar: NISN sudah terdaftar atas nama ${r.get('Nama Lengkap')}.`);
    }
  }

  const id = 'S' + Date.now();
  const tglDaftar = dataObj.tglDaftar || new Date().toISOString().split('T')[0];

  await sheet.addRow({
    'No.': id,
    'Tanggal Daftar': tglDaftar,
    'NISN': dataObj.nisn || '',
    'NIK': dataObj.nik || '',
    'No. Kartu Keluarga': dataObj.noKk || '',
    'Urut KK': dataObj.urutKk || '',
    'Kabupaten/Kota': dataObj.kabKota || '',
    'Kecamatan': dataObj.kecamatan || '',
    'Desa Kelurahan': dataObj.desaKelurahan || '',
    'Nama Lengkap': dataObj.nama || '',
    'Tempat Lahir': dataObj.tempatLahir || '',
    'Tanggal Lahir': dataObj.tglLahir || '',
    'Nama Ayah Kandung': dataObj.namaAyah || '',
    'Tahun Lahir Ayah': dataObj.tahunLahirAyah || '',
    'NIK Ayah': dataObj.nikAyah || '',
    'Nama Ibu Kandung': dataObj.namaIbu || '',
    'Tahun Lahir Ibu': dataObj.tahunLahirIbu || '',
    'NIK Ibu': dataObj.nikIbu || '',
    'Jenjang': dataObj.jenjang || dataObj.program || '',
    'Syarat': dataObj.syarat || '',
    'Dok Berkas': dataObj.dokBerkas || '',
    'Kelas': dataObj.kelas || '',
    'Foto': dataObj.fotoFile ? 'Data Terlampir (Base64)' : '',
    'Status Validasi': 'Pending',
    'Catatan AI': '',
    'URL Ijazah': dataObj.ijazahFile ? 'Data Terlampir (Base64)' : '',
    'URL KK': dataObj.kkFile ? 'Data Terlampir (Base64)' : '',
    'Bukti Pembayaran': dataObj.bayarFile ? 'Data Terlampir (Base64)' : '',
    'Status Aktif': 'Tidak Aktif',
    'Didaftarkan Oleh': dataObj.createdBy || '',
    'Jenis Kelamin': dataObj.jk || '',
    'Tahun Lulus': dataObj.tahunLulus || '',
    'Nama Wali': dataObj.namaWali || ''
  });

  return { message: 'Pendaftaran Siswa Berhasil Disimpan!' };
}

async function handleUpdateSiswa(dataObj) {
  const sheet = await getSheet('Data_Siswa');
  const rows = await sheet.getRows();

  const target = rows.find(r => String(r.get('No.')) === String(dataObj.id));
  if (!target) throw new Error('Data siswa tidak ditemukan.');

  const inputNik = String(dataObj.nik || '').trim();
  const inputNisn = String(dataObj.nisn || '').trim();

  for (const r of rows) {
    if (String(r.get('No.')) === String(dataObj.id)) continue;
    const existingNik = String(r.get('NIK') || '').trim();
    const existingNisn = String(r.get('NISN') || '').trim();
    if (inputNik && inputNik === existingNik) {
      throw new Error(`Data kembar: NIK sudah terdaftar atas nama ${r.get('Nama Lengkap')}.`);
    }
    if (inputNisn && inputNisn === existingNisn) {
      throw new Error(`Data kembar: NISN sudah terdaftar atas nama ${r.get('Nama Lengkap')}.`);
    }
  }

  if (dataObj.tglDaftar !== undefined) target.set('Tanggal Daftar', dataObj.tglDaftar);
  if (dataObj.nisn !== undefined) target.set('NISN', dataObj.nisn);
  if (dataObj.nik !== undefined) target.set('NIK', dataObj.nik);
  if (dataObj.noKk !== undefined) target.set('No. Kartu Keluarga', dataObj.noKk);
  if (dataObj.urutKk !== undefined) target.set('Urut KK', dataObj.urutKk);
  if (dataObj.kabKota !== undefined) target.set('Kabupaten/Kota', dataObj.kabKota);
  if (dataObj.kecamatan !== undefined) target.set('Kecamatan', dataObj.kecamatan);
  if (dataObj.desaKelurahan !== undefined) target.set('Desa Kelurahan', dataObj.desaKelurahan);
  if (dataObj.nama !== undefined) target.set('Nama Lengkap', dataObj.nama);
  if (dataObj.tempatLahir !== undefined) target.set('Tempat Lahir', dataObj.tempatLahir);
  if (dataObj.tglLahir !== undefined) target.set('Tanggal Lahir', dataObj.tglLahir);
  if (dataObj.namaAyah !== undefined) target.set('Nama Ayah Kandung', dataObj.namaAyah);
  if (dataObj.tahunLahirAyah !== undefined) target.set('Tahun Lahir Ayah', dataObj.tahunLahirAyah);
  if (dataObj.nikAyah !== undefined) target.set('NIK Ayah', dataObj.nikAyah);
  if (dataObj.namaIbu !== undefined) target.set('Nama Ibu Kandung', dataObj.namaIbu);
  if (dataObj.tahunLahirIbu !== undefined) target.set('Tahun Lahir Ibu', dataObj.tahunLahirIbu);
  if (dataObj.nikIbu !== undefined) target.set('NIK Ibu', dataObj.nikIbu);
  if (dataObj.jenjang !== undefined || dataObj.program !== undefined) {
    target.set('Jenjang', dataObj.jenjang || dataObj.program);
  }
  if (dataObj.syarat !== undefined) target.set('Syarat', dataObj.syarat);
  if (dataObj.dokBerkas !== undefined) target.set('Dok Berkas', dataObj.dokBerkas);
  if (dataObj.kelas !== undefined) target.set('Kelas', dataObj.kelas);
  if (dataObj.jk !== undefined) target.set('Jenis Kelamin', dataObj.jk);
  if (dataObj.tahunLulus !== undefined) target.set('Tahun Lulus', dataObj.tahunLulus);
  if (dataObj.namaWali !== undefined) target.set('Nama Wali', dataObj.namaWali);

  if (dataObj.fotoFile) target.set('Foto', 'Data Terlampir (Base64)');
  if (dataObj.ijazahFile) target.set('URL Ijazah', 'Data Terlampir (Base64)');
  if (dataObj.kkFile) target.set('URL KK', 'Data Terlampir (Base64)');
  if (dataObj.bayarFile) target.set('Bukti Pembayaran', 'Data Terlampir (Base64)');

  await target.save();
  return { message: 'Data Siswa Berhasil Diperbarui!' };
}

async function handleUpdateStatus(idSiswa, status, koreksiAI) {
  const sheet = await getSheet('Data_Siswa');
  const rows = await sheet.getRows();
  const target = rows.find(r => String(r.get('No.')) === String(idSiswa));
  if (!target) throw new Error('Data siswa tidak ditemukan.');

  target.set('Status Validasi', status);
  if (koreksiAI !== undefined) target.set('Catatan AI', koreksiAI || '');
  await target.save();
  return { success: true, message: 'Status Validasi berhasil diupdate!' };
}

async function handleUpdateStatusAktif(idSiswa, statusAktif) {
  const sheet = await getSheet('Data_Siswa');
  const rows = await sheet.getRows();
  const target = rows.find(r => String(r.get('No.')) === String(idSiswa));
  if (!target) throw new Error('Data siswa tidak ditemukan.');

  target.set('Status Aktif', statusAktif);
  await target.save();
  return { success: true, message: 'Status Aktif berhasil diupdate!' };
}

async function handleDeleteSiswa(idSiswa) {
  const sheet = await getSheet('Data_Siswa');
  const rows = await sheet.getRows();
  const target = rows.find(r => String(r.get('No.')) === String(idSiswa));
  if (!target) throw new Error('Data siswa tidak ditemukan.');

  await target.delete();
  return { success: true, message: 'Data Siswa berhasil dihapus!' };
}

async function handleImportSiswaBatch(dataList) {
  const sheet = await getSheet('Data_Siswa');
  const rows = await sheet.getRows();
  const existingMap = new Map();

  for (const r of rows) {
    const nik = String(r.get('NIK') || '').trim();
    const nisn = String(r.get('NISN') || '').trim();
    if (nik) existingMap.set('NIK:' + nik, r);
    if (nisn) existingMap.set('NISN:' + nisn, r);
  }

  let appendCount = 0;
  let updateCount = 0;
  const newRows = [];

  for (const item of dataList) {
    const inputNik = String(item.nik || '').trim();
    const inputNisn = String(item.nisn || '').trim();

    let existingRow = null;
    if (inputNik && existingMap.has('NIK:' + inputNik)) {
      existingRow = existingMap.get('NIK:' + inputNik);
    } else if (inputNisn && existingMap.has('NISN:' + inputNisn)) {
      existingRow = existingMap.get('NISN:' + inputNisn);
    }

    const tglDaftar = item.tglDaftar || new Date().toISOString().split('T')[0];

    if (existingRow) {
      if (item.tglDaftar) existingRow.set('Tanggal Daftar', item.tglDaftar);
      if (item.nisn) existingRow.set('NISN', item.nisn);
      if (item.nik) existingRow.set('NIK', item.nik);
      if (item.noKk) existingRow.set('No. Kartu Keluarga', item.noKk);
      if (item.urutKk) existingRow.set('Urut KK', item.urutKk);
      if (item.kabKota) existingRow.set('Kabupaten/Kota', item.kabKota);
      if (item.kecamatan) existingRow.set('Kecamatan', item.kecamatan);
      if (item.desaKelurahan) existingRow.set('Desa Kelurahan', item.desaKelurahan);
      if (item.nama) existingRow.set('Nama Lengkap', item.nama);
      if (item.tempatLahir) existingRow.set('Tempat Lahir', item.tempatLahir);
      if (item.tglLahir) existingRow.set('Tanggal Lahir', item.tglLahir);
      if (item.namaAyah) existingRow.set('Nama Ayah Kandung', item.namaAyah);
      if (item.tahunLahirAyah) existingRow.set('Tahun Lahir Ayah', item.tahunLahirAyah);
      if (item.nikAyah) existingRow.set('NIK Ayah', item.nikAyah);
      if (item.namaIbu) existingRow.set('Nama Ibu Kandung', item.namaIbu);
      if (item.tahunLahirIbu) existingRow.set('Tahun Lahir Ibu', item.tahunLahirIbu);
      if (item.nikIbu) existingRow.set('NIK Ibu', item.nikIbu);
      if (item.jenjang || item.program) existingRow.set('Jenjang', item.jenjang || item.program);
      if (item.syarat) existingRow.set('Syarat', item.syarat);
      if (item.dokBerkas) existingRow.set('Dok Berkas', item.dokBerkas);
      if (item.kelas) existingRow.set('Kelas', item.kelas);
      if (item.jk) existingRow.set('Jenis Kelamin', item.jk);
      if (item.tahunLulus) existingRow.set('Tahun Lulus', item.tahunLulus);
      if (item.namaWali) existingRow.set('Nama Wali', item.namaWali);
      await existingRow.save();
      updateCount++;
    } else {
      const id = item.id || ('S' + Date.now() + '_' + appendCount);
      newRows.push({
        'No.': id,
        'Tanggal Daftar': tglDaftar,
        'NISN': item.nisn || '',
        'NIK': item.nik || '',
        'No. Kartu Keluarga': item.noKk || '',
        'Urut KK': item.urutKk || '',
        'Kabupaten/Kota': item.kabKota || '',
        'Kecamatan': item.kecamatan || '',
        'Desa Kelurahan': item.desaKelurahan || '',
        'Nama Lengkap': item.nama || '',
        'Tempat Lahir': item.tempatLahir || '',
        'Tanggal Lahir': item.tglLahir || '',
        'Nama Ayah Kandung': item.namaAyah || '',
        'Tahun Lahir Ayah': item.tahunLahirAyah || '',
        'NIK Ayah': item.nikAyah || '',
        'Nama Ibu Kandung': item.namaIbu || '',
        'Tahun Lahir Ibu': item.tahunLahirIbu || '',
        'NIK Ibu': item.nikIbu || '',
        'Jenjang': item.jenjang || item.program || '',
        'Syarat': item.syarat || '',
        'Dok Berkas': item.dokBerkas || '',
        'Kelas': item.kelas || '',
        'Foto': '',
        'Status Validasi': 'Pending',
        'Catatan AI': '',
        'URL Ijazah': '',
        'URL KK': '',
        'Bukti Pembayaran': '',
        'Status Aktif': 'Tidak Aktif',
        'Didaftarkan Oleh': item.createdBy || '',
        'Jenis Kelamin': item.jk || '',
        'Tahun Lulus': item.tahunLulus || '',
        'Nama Wali': item.namaWali || ''
      });
      appendCount++;
    }
  }

  if (newRows.length > 0) {
    await sheet.addRows(newRows);
  }

  return { message: `Berhasil memproses data: ${appendCount} data baru ditambahkan, ${updateCount} data diperbarui.` };
}

async function handleAICheck(dataSiswa, jenisDokumen) {
  if (!GEMINI_API_KEY) {
    await new Promise(r => setTimeout(r, 1200));
    return {
      status: 'TIDAK_COCOK',
      koreksi: 'Simulasi AI (Node backend): NIK pada dokumen tidak sesuai dengan inputan. Pastikan penulisan NIK sudah benar.'
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const urlGambar = jenisDokumen === 'ijazah' ? dataSiswa.urlIjazah : dataSiswa.urlKK;

  let base64Data = '';
  let mimeType = 'image/jpeg';

  if (urlGambar && urlGambar.startsWith('data:')) {
    const parts = urlGambar.split(',');
    mimeType = parts[0].match(/:(.*?);/)[1];
    base64Data = parts[1];
  } else if (urlGambar && (urlGambar.startsWith('http://') || urlGambar.startsWith('https://'))) {
    const res = await fetch(urlGambar);
    const buf = await res.arrayBuffer();
    base64Data = Buffer.from(buf).toString('base64');
    mimeType = res.headers.get('content-type') || 'image/jpeg';
  } else {
    return { status: 'ERROR', koreksi: 'Format gambar atau URL tidak valid.' };
  }

  const promptText = `Berikut adalah data pendaftaran calon siswa Kejar Paket (Sekolah Non-Formal):\n` +
    `1. NIK: ${dataSiswa.nik}\n` +
    `2. Nama Lengkap: ${dataSiswa.nama}\n` +
    `3. Tempat Lahir: ${dataSiswa.tempatLahir}\n` +
    `4. Tanggal Lahir: ${dataSiswa.tglLahir}\n` +
    `5. Nama Ibu Kandung: ${dataSiswa.namaIbu}\n\n` +
    `Dan terlampir adalah gambar foto dokumen pendukungnya (KK atau Ijazah).\n` +
    `Tugasmu:\n` +
    `1. Ekstrak 5 data spesifik di atas (NIK, Nama Lengkap, Tempat Lahir, Tanggal Lahir, Nama Ibu Kandung) dari dokumen yang terlampir.\n` +
    `2. Bandingkan kelima data tersebut dengan input data teks di atas secara SANGAT TELITI dan KETAT.\n` +
    `3. Kelima data tersebut HARUS sama persis dengan data di dokumen pendukung.\n` +
    `4. Jika ada ketidaksesuaian ejaan, salah ketik, atau perbedaan angka/huruf sekecil apapun, jelaskan secara spesifik field mana yang salah dan sebutkan data yang benar berdasarkan gambar dokumen.\n` +
    `Kembalikan respons murni dalam format JSON (tanpa markdown), dengan properti:\n` +
    `{"status": "COCOK" | "TIDAK_COCOK", "koreksi": "Penjelasan detail jika tidak cocok (kosongkan jika cocok)"}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json'
    }
  };

  const geminiRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resJson = await geminiRes.json();
  if (resJson.candidates && resJson.candidates.length > 0) {
    const text = resJson.candidates[0].content.parts[0].text;
    return JSON.parse(text);
  }
  return { status: 'ERROR', koreksi: 'Gemini AI tidak mengembalikan respons yang valid.' };
}

// =================== MAIN API ROUTE ===================

app.post('/api', async (req, res) => {
  try {
    const { action } = req.body;
    let result = {};

    switch (action) {
      case 'login':
        result = await handleLogin(req.body.username, req.body.password);
        break;
      case 'getUsers':
        result = await handleGetUsers();
        break;
      case 'addUser':
        result = await handleAddUser(req.body.username, req.body.password, req.body.nama, req.body.role);
        break;
      case 'updateUser':
        result = await handleUpdateUser(req.body.username, req.body.nama, req.body.password);
        break;
      case 'deleteUser':
        result = await handleDeleteUser(req.body.username);
        break;
      case 'registerSiswa':
        result = await handleRegisterSiswa(req.body.data);
        break;
      case 'importSiswaBatch':
        result = await handleImportSiswaBatch(req.body.dataList);
        break;
      case 'updateSiswa':
        result = await handleUpdateSiswa(req.body.data);
        break;
      case 'getSiswa':
        result = await handleGetSiswa(req.body.pendingOnly);
        break;
      case 'runAICheck':
        result = await handleAICheck(req.body.dataSiswa, req.body.jenisDokumen);
        break;
      case 'updateStatus':
        result = await handleUpdateStatus(req.body.idSiswa, req.body.status, req.body.koreksiAI);
        break;
      case 'updateStatusAktif':
        result = await handleUpdateStatusAktif(req.body.idSiswa, req.body.statusAktif);
        break;
      case 'deleteSiswa':
        result = await handleDeleteSiswa(req.body.idSiswa);
        break;
      default:
        return res.status(400).json({ success: false, error: 'Action not found' });
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('API Error:', error.message);
    return res.json({ success: false, error: error.message });
  }
});

// Proxy PDF dari Google Drive untuk Native PDF.js Reader (Bebas iframe & full kontrol UI)
app.get('/api/proxy-pdf/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    if (!fileId) return res.status(400).send('File ID required');

    const gdriveUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
    const response = await fetch(gdriveUrl);
    
    if (!response.ok) {
      return res.status(response.status).send('Gagal mengambil PDF dari Google Drive');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err) {
    console.error('Proxy PDF Error:', err.message);
    res.status(500).send('Internal Server Error streaming PDF');
  }
});

// Rute frontend
app.get(['/', '/pkbm', '/portal-pkbm', '/login'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server Google Sheets API v4 berjalan di http://localhost:${PORT}`);
});
