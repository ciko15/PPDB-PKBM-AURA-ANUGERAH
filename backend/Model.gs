const SHEET_ID = '1MGmf21rJRhLw29cxMEm2vLz2ogfLI0ebxjlOj_OfE-g'; 

function getDB(sheetName) {
  let sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
  if (!sheet) {
    setupDatabase(); // Auto-setup jika belum ada
    sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
  }
  return sheet;
}

// =================== USER MANAGEMENT ===================
function doLogin(username, password) {
  const sheet = getDB('Users');
  if (!sheet) throw new Error("Mode Dummy: Harap login menggunakan admin/admin atau guru/guru.");
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] === password) {
      return { username: data[i][0], nama: data[i][2], role: data[i][3] };
    }
  }
  throw new Error("Username atau password salah.");
}

function getUsers() {
  const sheet = getDB('Users');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const users = [];
  for (let i = 1; i < data.length; i++) {
    users.push({ username: data[i][0], nama: data[i][2], role: data[i][3] });
  }
  return users;
}

function addUser(username, password, nama, role) {
  const sheet = getDB('Users');
  if (!sheet) return { message: "Dummy: User ditambahkan." };
  sheet.appendRow([username, password, nama, role]);
  return { message: "Pengguna berhasil ditambahkan." };
}

function deleteUser(username) {
  const sheet = getDB('Users');
  if (!sheet) return { message: "Dummy: User dihapus." };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      sheet.deleteRow(i + 1);
      return { message: "Pengguna berhasil dihapus." };
    }
  }
  throw new Error("User tidak ditemukan.");
}

// =================== SISWA MANAGEMENT ===================
function registerSiswa(dataObj) {
  const sheet = getDB('Data_Siswa');
  if (!sheet) return { message: "Dummy: Pendaftaran Berhasil." };

  const id = "S" + new Date().getTime(); 
  const urlIjazah = dataObj.ijazahFile ? "Data Terlampir (Base64)" : "";
  const urlKK = dataObj.kkFile ? "Data Terlampir (Base64)" : "";
  const urlBayar = dataObj.bayarFile ? "Data Terlampir (Base64)" : "";

  sheet.appendRow([
    id, dataObj.nama, dataObj.nik, dataObj.nisn, dataObj.tempatLahir, dataObj.tglLahir, 
    dataObj.namaIbu, dataObj.namaAyah, dataObj.namaWali, dataObj.jk, dataObj.program, dataObj.tahunLulus,
    urlIjazah, urlKK, "Pending", "", urlBayar, "Tidak Aktif", dataObj.createdBy
  ]);

  return { message: "Pendaftaran Siswa Berhasil Disimpan!" };
}

function updateSiswa(dataObj) {
  const sheet = getDB('Data_Siswa');
  if (!sheet) return { message: "Dummy: Update Berhasil." };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == dataObj.id) {
      const row = i + 1;
      // Perbarui kolom 2 - 12 sesuai dengan index
      sheet.getRange(row, 2).setValue(dataObj.nama);
      sheet.getRange(row, 3).setValue(dataObj.nik);
      sheet.getRange(row, 4).setValue(dataObj.nisn);
      sheet.getRange(row, 5).setValue(dataObj.tempatLahir);
      sheet.getRange(row, 6).setValue(dataObj.tglLahir);
      sheet.getRange(row, 7).setValue(dataObj.namaIbu);
      sheet.getRange(row, 8).setValue(dataObj.namaAyah);
      sheet.getRange(row, 9).setValue(dataObj.namaWali);
      sheet.getRange(row, 10).setValue(dataObj.jk);
      sheet.getRange(row, 11).setValue(dataObj.program);
      sheet.getRange(row, 12).setValue(dataObj.tahunLulus);
      
      // Update dokumen jika ada upload baru
      if (dataObj.ijazahFile) sheet.getRange(row, 13).setValue("Data Terlampir (Base64)");
      if (dataObj.kkFile) sheet.getRange(row, 14).setValue("Data Terlampir (Base64)");
      if (dataObj.bayarFile) sheet.getRange(row, 17).setValue("Data Terlampir (Base64)");

      return { message: "Data Siswa Berhasil Diperbarui!" };
    }
  }
  throw new Error("Data siswa tidak ditemukan.");
}

function getSiswaToValidate(pendingOnly) {
  const sheet = getDB('Data_Siswa');
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const siswaList = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const statusValidasi = row[14]; // Indeks berubah karena tambahan Ayah(7), Wali(8)
    
    if (!pendingOnly || statusValidasi === 'Pending' || statusValidasi === '') { 
      siswaList.push({
        id: row[0],
        nama: row[1],
        nik: row[2],
        nisn: row[3],
        tempatLahir: row[4],
        tglLahir: row[5],
        namaIbu: row[6],
        namaAyah: row[7],
        namaWali: row[8],
        jk: row[9],
        program: row[10],
        tahunLulus: row[11],
        urlIjazah: row[12],
        urlKK: row[13],
        status: row[14],
        koreksiAI: row[15],
        urlBayar: row[16],
        statusAktif: row[17],
        createdBy: row[18],
        rowIndex: i + 1 
      });
    }
  }
  return siswaList;
}

function updateStatusSiswa(idSiswa, status, koreksiAI) {
  const sheet = getDB('Data_Siswa');
  if (!sheet) return { success: true, message: `Mode dummy: Status ${status} disimpan!` };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == idSiswa) {
      sheet.getRange(i + 1, 15).setValue(status); 
      if (koreksiAI) {
        sheet.getRange(i + 1, 16).setValue(koreksiAI); 
      }
      return { success: true, message: "Status Validasi berhasil diupdate!" };
    }
  }
  throw new Error("Data siswa tidak ditemukan.");
}

function updateStatusAktif(idSiswa, statusAktif) {
  const sheet = getDB('Data_Siswa');
  if (!sheet) return { success: true, message: `Mode dummy: Status aktif diubah.` };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == idSiswa) {
      sheet.getRange(i + 1, 18).setValue(statusAktif); 
      return { success: true, message: "Status Aktif berhasil diupdate!" };
    }
  }
  throw new Error("Data siswa tidak ditemukan.");
}

// =================== INIT DATABASE ===================
function setupDatabase() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  let sheetUsers = ss.getSheetByName('Users');
  if (!sheetUsers) {
    sheetUsers = ss.insertSheet('Users');
    sheetUsers.appendRow(['Username', 'Password', 'Nama Lengkap', 'Role']);
    sheetUsers.appendRow(['admin', 'admin', 'Administrator', 'Admin']); 
  }
  
  let sheetSiswa = ss.getSheetByName('Data_Siswa');
  if (!sheetSiswa) {
    sheetSiswa = ss.insertSheet('Data_Siswa');
    sheetSiswa.appendRow([
      'ID', 'Nama Lengkap', 'NIK', 'NISN', 'Tempat Lahir', 'Tanggal Lahir', 
      'Nama Ibu Kandung', 'Nama Ayah', 'Nama Wali', 'Jenis Kelamin', 'Program', 'Tahun Lulus', 
      'URL Ijazah', 'URL KK', 'Status Validasi', 'Catatan AI', 
      'Bukti Pembayaran', 'Status Aktif', 'Didaftarkan Oleh'
    ]);
  }
  
  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
  }
}
