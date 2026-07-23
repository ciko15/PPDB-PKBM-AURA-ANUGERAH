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
  if (!sheet) throw new Error("Database belum disetup.");
  
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
  if (!sheet) throw new Error("Database belum disetup.");
  sheet.appendRow([username, password, nama, role]);
  return { message: "Pengguna berhasil ditambahkan." };
}

function deleteUser(username) {
  const sheet = getDB('Users');
  if (!sheet) throw new Error("Database belum disetup.");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      sheet.deleteRow(i + 1);
      return { message: "Pengguna berhasil dihapus." };
    }
  }
  throw new Error("User tidak ditemukan.");
}

function updateUser(username, newNama, newPassword) {
  const sheet = getDB('Users');
  if (!sheet) throw new Error("Database belum disetup.");
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      if (newPassword) {
        sheet.getRange(i + 1, 2).setValue(newPassword);
      }
      if (newNama) {
        sheet.getRange(i + 1, 3).setValue(newNama);
      }
      return { message: "Data profil berhasil diperbarui." };
    }
  }
  throw new Error("User tidak ditemukan.");
}

// =================== SISWA MANAGEMENT ===================
function registerSiswa(dataObj) {
  const sheet = getDB('Data_Siswa');
  if (!sheet) throw new Error("Database belum disetup.");

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const existingNisn = String(data[i][2]).trim();
    const existingNik = String(data[i][3]).trim();
    const inputNik = String(dataObj.nik || "").trim();
    const inputNisn = String(dataObj.nisn || "").trim();

    if (inputNik && inputNik === existingNik) {
      throw new Error(`Data kembar: NIK sudah terdaftar atas nama ${data[i][9]}.`);
    }
    if (inputNisn && inputNisn === existingNisn) {
      throw new Error(`Data kembar: NISN sudah terdaftar atas nama ${data[i][9]}.`);
    }
  }

  const id = "S" + new Date().getTime(); 
  const tglDaftar = dataObj.tglDaftar || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
  
  const urlIjazah = dataObj.ijazahFile ? "Data Terlampir (Base64)" : "";
  const urlKK = dataObj.kkFile ? "Data Terlampir (Base64)" : "";
  const urlBayar = dataObj.bayarFile ? "Data Terlampir (Base64)" : "";
  const urlFoto = dataObj.fotoFile ? "Data Terlampir (Base64)" : "";

  sheet.appendRow([
    id,
    tglDaftar,
    dataObj.nisn || "",
    dataObj.nik || "",
    dataObj.noKk || "",
    dataObj.urutKk || "",
    dataObj.kabKota || "",
    dataObj.kecamatan || "",
    dataObj.desaKelurahan || "",
    dataObj.nama || "",
    dataObj.tempatLahir || "",
    dataObj.tglLahir || "",
    dataObj.namaAyah || "",
    dataObj.tahunLahirAyah || "",
    dataObj.nikAyah || "",
    dataObj.namaIbu || "",
    dataObj.tahunLahirIbu || "",
    dataObj.nikIbu || "",
    dataObj.jenjang || dataObj.program || "",
    dataObj.syarat || "",
    dataObj.dokBerkas || "",
    dataObj.kelas || "",
    urlFoto,
    "Pending",
    "",
    urlIjazah,
    urlKK,
    urlBayar,
    "Tidak Aktif",
    dataObj.createdBy || "",
    dataObj.jk || "",
    dataObj.tahunLulus || "",
    dataObj.namaWali || ""
  ]);

  return { message: "Pendaftaran Siswa Berhasil Disimpan!" };
}

function importSiswaBatch(dataList) {
  const sheet = getDB('Data_Siswa');
  if (!sheet) throw new Error("Database belum disetup.");

  const data = sheet.getDataRange().getValues();
  const existingMap = new Map();
  for (let i = 1; i < data.length; i++) {
    const existingNisn = String(data[i][2]).trim();
    const existingNik = String(data[i][3]).trim();
    if (existingNik) existingMap.set("NIK:" + existingNik, i);
    if (existingNisn) existingMap.set("NISN:" + existingNisn, i);
  }

  const rowsToAppend = [];
  let appendCount = 0;
  let updateCount = 0;
  let hasUpdates = false;

  dataList.forEach((dataObj, index) => {
    const inputNik = String(dataObj.nik || "").trim();
    const inputNisn = String(dataObj.nisn || "").trim();

    let targetRowIndex = -1;
    if (inputNik && existingMap.has("NIK:" + inputNik)) {
      targetRowIndex = existingMap.get("NIK:" + inputNik);
    } else if (inputNisn && existingMap.has("NISN:" + inputNisn)) {
      targetRowIndex = existingMap.get("NISN:" + inputNisn);
    }

    const tglDaftar = dataObj.tglDaftar || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");

    if (targetRowIndex !== -1) {
      if (targetRowIndex === -2) return; // Lewati duplikat di dalam satu file batch yang sama
      const row = data[targetRowIndex];
      row[1] = dataObj.tglDaftar || row[1];
      row[2] = dataObj.nisn || row[2];
      row[3] = dataObj.nik || row[3];
      row[4] = dataObj.noKk || row[4];
      row[5] = dataObj.urutKk || row[5];
      row[6] = dataObj.kabKota || row[6];
      row[7] = dataObj.kecamatan || row[7];
      row[8] = dataObj.desaKelurahan || row[8];
      row[9] = dataObj.nama || row[9];
      row[10] = dataObj.tempatLahir || row[10];
      row[11] = dataObj.tglLahir || row[11];
      row[12] = dataObj.namaAyah || row[12];
      row[13] = dataObj.tahunLahirAyah || row[13];
      row[14] = dataObj.nikAyah || row[14];
      row[15] = dataObj.namaIbu || row[15];
      row[16] = dataObj.tahunLahirIbu || row[16];
      row[17] = dataObj.nikIbu || row[17];
      row[18] = dataObj.jenjang || dataObj.program || row[18];
      row[19] = dataObj.syarat || row[19];
      row[20] = dataObj.dokBerkas || row[20];
      row[21] = dataObj.kelas || row[21];
      row[30] = dataObj.jk || row[30];
      row[31] = dataObj.tahunLulus || row[31];
      row[32] = dataObj.namaWali || row[32];
      
      hasUpdates = true;
      updateCount++;
    } else {
      const id = dataObj.id ? dataObj.id : "S" + new Date().getTime() + "_" + appendCount; 
      rowsToAppend.push([
        id,
        tglDaftar,
        dataObj.nisn || "",
        dataObj.nik || "",
        dataObj.noKk || "",
        dataObj.urutKk || "",
        dataObj.kabKota || "",
        dataObj.kecamatan || "",
        dataObj.desaKelurahan || "",
        dataObj.nama || "",
        dataObj.tempatLahir || "",
        dataObj.tglLahir || "",
        dataObj.namaAyah || "",
        dataObj.tahunLahirAyah || "",
        dataObj.nikAyah || "",
        dataObj.namaIbu || "",
        dataObj.tahunLahirIbu || "",
        dataObj.nikIbu || "",
        dataObj.jenjang || dataObj.program || "",
        dataObj.syarat || "",
        dataObj.dokBerkas || "",
        dataObj.kelas || "",
        "", 
        "Pending",
        "", 
        "", 
        "", 
        "", 
        "Tidak Aktif",
        dataObj.createdBy || "",
        dataObj.jk || "",
        dataObj.tahunLulus || "",
        dataObj.namaWali || ""
      ]);
      
      if (inputNik) existingMap.set("NIK:" + inputNik, -2);
      if (inputNisn) existingMap.set("NISN:" + inputNisn, -2);
      
      appendCount++;
    }
  });

  if (hasUpdates) {
    sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  }

  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  }

  return { message: `Berhasil memproses data: ${appendCount} data baru ditambahkan, ${updateCount} data diperbarui.` };
}

function updateSiswa(dataObj) {
  const sheet = getDB('Data_Siswa');
  if (!sheet) throw new Error("Database belum disetup.");

  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == dataObj.id) continue;
    const existingNisn = String(data[i][2]).trim();
    const existingNik = String(data[i][3]).trim();
    const inputNik = String(dataObj.nik || "").trim();
    const inputNisn = String(dataObj.nisn || "").trim();

    if (inputNik && inputNik === existingNik) {
      throw new Error(`Data kembar: NIK sudah terdaftar atas nama ${data[i][9]}.`);
    }
    if (inputNisn && inputNisn === existingNisn) {
      throw new Error(`Data kembar: NISN sudah terdaftar atas nama ${data[i][9]}.`);
    }
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == dataObj.id) {
      const row = i + 1;
      
      if(dataObj.tglDaftar !== undefined) sheet.getRange(row, 2).setValue(dataObj.tglDaftar);
      if(dataObj.nisn !== undefined) sheet.getRange(row, 3).setValue(dataObj.nisn);
      if(dataObj.nik !== undefined) sheet.getRange(row, 4).setValue(dataObj.nik);
      if(dataObj.noKk !== undefined) sheet.getRange(row, 5).setValue(dataObj.noKk);
      if(dataObj.urutKk !== undefined) sheet.getRange(row, 6).setValue(dataObj.urutKk);
      if(dataObj.kabKota !== undefined) sheet.getRange(row, 7).setValue(dataObj.kabKota);
      if(dataObj.kecamatan !== undefined) sheet.getRange(row, 8).setValue(dataObj.kecamatan);
      if(dataObj.desaKelurahan !== undefined) sheet.getRange(row, 9).setValue(dataObj.desaKelurahan);
      if(dataObj.nama !== undefined) sheet.getRange(row, 10).setValue(dataObj.nama);
      if(dataObj.tempatLahir !== undefined) sheet.getRange(row, 11).setValue(dataObj.tempatLahir);
      if(dataObj.tglLahir !== undefined) sheet.getRange(row, 12).setValue(dataObj.tglLahir);
      if(dataObj.namaAyah !== undefined) sheet.getRange(row, 13).setValue(dataObj.namaAyah);
      if(dataObj.tahunLahirAyah !== undefined) sheet.getRange(row, 14).setValue(dataObj.tahunLahirAyah);
      if(dataObj.nikAyah !== undefined) sheet.getRange(row, 15).setValue(dataObj.nikAyah);
      if(dataObj.namaIbu !== undefined) sheet.getRange(row, 16).setValue(dataObj.namaIbu);
      if(dataObj.tahunLahirIbu !== undefined) sheet.getRange(row, 17).setValue(dataObj.tahunLahirIbu);
      if(dataObj.nikIbu !== undefined) sheet.getRange(row, 18).setValue(dataObj.nikIbu);
      if(dataObj.jenjang !== undefined) sheet.getRange(row, 19).setValue(dataObj.jenjang || dataObj.program);
      if(dataObj.syarat !== undefined) sheet.getRange(row, 20).setValue(dataObj.syarat);
      if(dataObj.dokBerkas !== undefined) sheet.getRange(row, 21).setValue(dataObj.dokBerkas);
      if(dataObj.kelas !== undefined) sheet.getRange(row, 22).setValue(dataObj.kelas);
      
      if(dataObj.jk !== undefined) sheet.getRange(row, 31).setValue(dataObj.jk);
      if(dataObj.tahunLulus !== undefined) sheet.getRange(row, 32).setValue(dataObj.tahunLulus);
      if(dataObj.namaWali !== undefined) sheet.getRange(row, 33).setValue(dataObj.namaWali);
      
      if (dataObj.fotoFile) sheet.getRange(row, 23).setValue("Data Terlampir (Base64)");
      if (dataObj.ijazahFile) sheet.getRange(row, 26).setValue("Data Terlampir (Base64)");
      if (dataObj.kkFile) sheet.getRange(row, 27).setValue("Data Terlampir (Base64)");
      if (dataObj.bayarFile) sheet.getRange(row, 28).setValue("Data Terlampir (Base64)");

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
    const statusValidasi = row[23];
    
    if (!pendingOnly || statusValidasi === 'Pending' || statusValidasi === '') { 
      siswaList.push({
        id: row[0],
        tglDaftar: row[1],
        nisn: row[2],
        nik: row[3],
        noKk: row[4],
        urutKk: row[5],
        kabKota: row[6],
        kecamatan: row[7],
        desaKelurahan: row[8],
        nama: row[9],
        tempatLahir: row[10],
        tglLahir: row[11],
        namaAyah: row[12],
        tahunLahirAyah: row[13],
        nikAyah: row[14],
        namaIbu: row[15],
        tahunLahirIbu: row[16],
        nikIbu: row[17],
        jenjang: row[18],
        program: row[18],
        syarat: row[19],
        dokBerkas: row[20],
        kelas: row[21],
        urlFoto: row[22],
        status: row[23],
        koreksiAI: row[24],
        urlIjazah: row[25],
        urlKK: row[26],
        urlBayar: row[27],
        statusAktif: row[28],
        createdBy: row[29],
        jk: row[30],
        tahunLulus: row[31],
        namaWali: row[32],
        rowIndex: i + 1 
      });
    }
  }
  return siswaList;
}

function updateStatusSiswa(idSiswa, status, koreksiAI) {
  const sheet = getDB('Data_Siswa');
  if (!sheet) throw new Error("Database belum disetup.");

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == idSiswa) {
      sheet.getRange(i + 1, 24).setValue(status);
      if (koreksiAI) {
        sheet.getRange(i + 1, 25).setValue(koreksiAI);
      }
      return { success: true, message: "Status Validasi berhasil diupdate!" };
    }
  }
  throw new Error("Data siswa tidak ditemukan.");
}

function updateStatusAktif(idSiswa, statusAktif) {
  const sheet = getDB('Data_Siswa');
  if (!sheet) throw new Error("Database belum disetup.");

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == idSiswa) {
      sheet.getRange(i + 1, 29).setValue(statusAktif);
      return { success: true, message: "Status Aktif berhasil diupdate!" };
    }
  }
  throw new Error("Data siswa tidak ditemukan.");
}

function deleteSiswa(idSiswa) {
  const sheet = getDB('Data_Siswa');
  if (!sheet) throw new Error("Database belum disetup.");

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == idSiswa) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "Data Siswa berhasil dihapus!" };
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
    sheetUsers.appendRow(['super', 'ciko1234', 'Super Admin', 'Super Admin']);
    sheetUsers.appendRow(['admin', 'admin', 'Administrator', 'Admin']); 
  }
  
  let sheetSiswa = ss.getSheetByName('Data_Siswa');
  if (!sheetSiswa) {
    sheetSiswa = ss.insertSheet('Data_Siswa');
    sheetSiswa.appendRow([
      'No.', 'Tanggal Daftar', 'NISN', 'NIK', 'No. Kartu Keluarga', 'Urut KK', 
      'Kabupaten/Kota', 'Kecamatan', 'Desa Kelurahan', 'Nama Lengkap', 
      'Tempat Lahir', 'Tanggal Lahir', 'Nama Ayah Kandung', 'Tahun Lahir Ayah', 
      'NIK Ayah', 'Nama Ibu Kandung', 'Tahun Lahir Ibu', 'NIK Ibu', 
      'Jenjang', 'Syarat', 'Dok Berkas', 'Kelas', 'Foto',
      'Status Validasi', 'Catatan AI', 'URL Ijazah', 'URL KK',
      'Bukti Pembayaran', 'Status Aktif', 'Didaftarkan Oleh', 
      'Jenis Kelamin', 'Tahun Lulus', 'Nama Wali'
    ]);
  }
  
  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
  }
}
