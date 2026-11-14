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
  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '').trim();

  // Akses Super Admin Rahasia (Hardcoded & Aman, tidak muncul di daftar pengguna)
  if (cleanUser === "super" && cleanPass === "ciko1234") {
    return { username: "super", nama: "Super Admin", role: "Super Admin" };
  }

  // 1. Cek dari sheet Users (Guru, Admin)
  const sheet = getDB('Users');
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === cleanUser && String(data[i][1]).trim() === cleanPass) {
        return { username: data[i][0], nama: data[i][2], role: data[i][3] };
      }
    }
  }

  // 2. Cek dari sheet Data_Siswa (Peserta Didik)
  try {
    const sSheet = getDB('Data_Siswa');
    if (sSheet) {
      const sData = sSheet.getDataRange().getValues();
      // Kolom: [0]=No, [1]=TglDaftar, [2]=NISN, [3]=NIK, [9]=Nama, [10]=TempatLahir, [11]=TglLahir
      for (let i = 1; i < sData.length; i++) {
        const row = sData[i];
        const sNik = String(row[3] || '').trim();
        const sNisn = String(row[2] || '').trim();
        const sNama = String(row[9] || 'Peserta Didik');
        let sTgl = '';
        if (row[11] instanceof Date) {
          sTgl = Utilities.formatDate(row[11], "GMT+7", "yyyy-MM-dd");
        } else {
          sTgl = String(row[11] || '').trim().split('T')[0];
        }

        const parts = sTgl.split('-');
        const ddmmyyyy = parts.length === 3 ? `${parts[2]}${parts[1]}${parts[0]}` : '';
        const yyyymmdd = parts.join('');
        const last6Nik = sNik.length >= 6 ? sNik.slice(-6) : '';

        const matchUser = (cleanUser === sNik || (sNisn && cleanUser === sNisn));
        let matchPass = false;

        // Cek apakah siswa sudah pernah membuat/mengubah password khusus di sheet Users
        let customPass = '';
        if (sheet && matchUser) {
          const uData = sheet.getDataRange().getValues();
          for (let u = 1; u < uData.length; u++) {
            if (String(uData[u][0]).trim() === cleanUser) {
              customPass = String(uData[u][1] || '').trim();
              break;
            }
          }
        }

        if (customPass) {
          matchPass = (cleanPass === customPass);
        } else {
          matchPass = (
            cleanPass === sTgl ||
            (ddmmyyyy && cleanPass === ddmmyyyy) ||
            (yyyymmdd && cleanPass === yyyymmdd) ||
            (last6Nik && cleanPass === last6Nik)
          );
        }

        if (matchUser && matchPass) {
          return {
            username: sNik || sNisn,
            nama: sNama,
            role: "Siswa",
            dataSiswa: {
              id: row[0] || '',
              nik: sNik,
              nisn: sNisn,
              nama: sNama,
              program: row[18] || '',
              tempatLahir: row[10] || '',
              tglLahir: sTgl,
              namaIbu: row[15] || '',
              statusValidasi: row[23] || 'Pending',
              catatanAI: row[24] || '',
              statusAktif: row[28] || 'Aktif'
            }
          };
        }
      }
    }
  } catch (err) {
    Logger.log("doLogin siswa check error: " + err.toString());
  }

  throw new Error("Username atau password salah. Untuk Siswa, gunakan NIK/NISN dan Password: Tanggal Lahir.");
}

function getUsers() {
  const users = [];
  const registeredUsernames = {};

  // 1. Ambil dari sheet Users
  const userSheet = getDB('Users');
  if (userSheet) {
    const data = userSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toLowerCase() === "super") continue;
      const uname = String(data[i][0] || '').trim();
      if (uname) {
        registeredUsernames[uname] = true;
        users.push({
          username: uname,
          nama: data[i][2],
          role: data[i][3],
          source: 'Users'
        });
      }
    }
  }

  // 2. Ambil dari sheet Data_Siswa
  try {
    const siswaSheet = getDB('Data_Siswa');
    if (siswaSheet) {
      const sData = siswaSheet.getDataRange().getValues();
      for (let j = 1; j < sData.length; j++) {
        const row = sData[j];
        const sNik = String(row[3] || '').trim();
        const sNisn = String(row[2] || '').trim();
        const sNama = row[9] || 'Peserta Didik';
        const uname = sNik || sNisn || `siswa_${row[0]}`;

        if (uname && !registeredUsernames[uname]) {
          registeredUsernames[uname] = true;
          users.push({
            username: uname,
            nama: sNama,
            role: 'Siswa',
            program: row[18] || 'Kesetaraan',
            noHp: row[33] || row[34] || '',
            alamat: `${row[8] || ''}, ${row[7] || ''}, ${row[6] || ''}`.replace(/^,\s*|,\s*$/g, ''),
            foto: row[22] || '',
            statusAktif: row[28] || 'Aktif',
            idSiswa: row[0] || '',
            source: 'Data_Siswa'
          });
        }
      }
    }
  } catch (err) {
    Logger.log("getUsers siswa check error: " + err.toString());
  }

  return users;
}

// =================== API KEYS MANAGEMENT (SUPER ADMIN) ===================
function getApiKeysSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('API_Keys');
  if (!sheet) {
    sheet = ss.insertSheet('API_Keys');
  }

  // Jika sheet masih baru atau kosong (belum ada data)
  if (sheet.getLastRow() < 2) {
    sheet.clear();
    sheet.appendRow(['ID', 'Email Google / Pemilik', 'API Key', 'Tgl Ditambahkan', 'Total Digunakan', 'Limit Harian', 'Status']);
  }

  return sheet;
}

function getApiKeysListFromDB() {
  const sheet = getApiKeysSheet();
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const keyRaw = String(data[i][2] || '').trim();
    const maskedKey = keyRaw.length > 12 ? keyRaw.substring(0, 6) + '...' + keyRaw.substring(keyRaw.length - 4) : keyRaw;
    const used = Number(data[i][4]) || 0;
    const limit = Number(data[i][5]) || 1500;
    const remaining = Math.max(0, limit - used);

    list.push({
      id: data[i][0],
      email: data[i][1],
      apiKey: keyRaw,
      maskedKey: maskedKey,
      tglDitambahkan: data[i][3],
      terpakai: used,
      limit: limit,
      sisa: remaining,
      status: data[i][6] || 'Aktif'
    });
  }
  return list;
}

function addApiKeyToDB(email, apiKey, limitHarian) {
  const sheet = getApiKeysSheet();
  const id = "K" + new Date().getTime();
  const tgl = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
  sheet.appendRow([id, email, apiKey.trim(), tgl, 0, limitHarian || 1500, 'Aktif']);
  return { success: true, message: "Kunci API berhasil ditambahkan ke database!" };
}

function deleteApiKeyFromDB(idKey) {
  const sheet = getApiKeysSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idKey)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "Kunci API berhasil dihapus." };
    }
  }
  throw new Error("Kunci API tidak ditemukan.");
}

function incrementKeyUsageInDB(apiKeyUsed) {
  try {
    const sheet = getApiKeysSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]).trim() === String(apiKeyUsed).trim()) {
        const cur = Number(data[i][4]) || 0;
        sheet.getRange(i + 1, 5).setValue(cur + 1);
        break;
      }
    }
  } catch (e) {
    Logger.log("incrementKeyUsage error: " + e.toString());
  }
}

function resetKeyUsageInDB(idKey) {
  const sheet = getApiKeysSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idKey)) {
      sheet.getRange(i + 1, 5).setValue(0);
      return { success: true, message: "Hitungan penggunaan berhasil di-reset ke 0." };
    }
  }
  throw new Error("Kunci API tidak ditemukan.");
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
    if (String(data[i][0]).trim() === String(username).trim()) {
      if (newPassword) {
        sheet.getRange(i + 1, 2).setValue(newPassword);
      }
      if (newNama) {
        sheet.getRange(i + 1, 3).setValue(newNama);
      }
      return { message: "Data profil berhasil diperbarui." };
    }
  }

  // Jika username belum ada di Users (misal akun siswa pertama kali ganti password dari tanggal lahir)
  if (username && newPassword) {
    sheet.appendRow([username, newPassword, newNama || username, 'Siswa']);
    return { message: "Password akun siswa berhasil dibuat dan diperbarui." };
  }

  throw new Error("User tidak ditemukan.");
}

// Helper untuk membuat folder dan mengunggah base64 ke Google Drive
function getOrCreateUploadFolder() {
  const folderName = "PPDB_Dokumen_Siswa";
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  const folder = DriveApp.createFolder(folderName);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return folder;
}

function uploadFileToDrive(base64Data, fileNamePrefix, defaultMime = "image/jpeg") {
  if (!base64Data || typeof base64Data !== 'string') return "";
  // Jika sudah merupakan link URL, kembalikan langsung
  if (base64Data.startsWith("http://") || base64Data.startsWith("https://")) return base64Data;
  if (base64Data.trim() === "Data Terlampir (Base64)") return "";

  try {
    let cleanBase64 = base64Data;
    let mimeType = defaultMime;

    if (base64Data.includes(";base64,")) {
      const parts = base64Data.split(";base64,");
      const match = parts[0].match(/data:(.*)/);
      if (match && match[1]) mimeType = match[1];
      cleanBase64 = parts[1];
    }

    const decodedBytes = Utilities.base64Decode(cleanBase64);
    let ext = "jpg";
    if (mimeType.includes("png")) ext = "png";
    else if (mimeType.includes("pdf")) ext = "pdf";
    else if (mimeType.includes("webp")) ext = "webp";

    const fileName = `${fileNamePrefix}_${new Date().getTime()}.${ext}`;
    const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    const folder = getOrCreateUploadFolder();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Ambil direct preview URL Google Drive
    const fileId = file.getId();
    return `https://drive.google.com/uc?id=${fileId}`;
  } catch (err) {
    Logger.log("Gagal upload file ke Drive: " + err.toString());
    return "";
  }
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

  const id = dataObj.id || ("S" + new Date().getTime()); 
  const tglDaftar = dataObj.tglDaftar || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
  
  const safeNik = String(dataObj.nik || id).replace(/[^0-9a-zA-Z]/g, '');
  const urlIjazah = dataObj.ijazahFile ? uploadFileToDrive(dataObj.ijazahFile, `Ijazah_${safeNik}`) : "";
  const urlKK = dataObj.kkFile ? uploadFileToDrive(dataObj.kkFile, `KK_${safeNik}`) : "";
  const urlBayar = dataObj.bayarFile ? uploadFileToDrive(dataObj.bayarFile, `Bayar_${safeNik}`) : "";
  const urlFoto = dataObj.fotoFile ? uploadFileToDrive(dataObj.fotoFile, `Foto_${safeNik}`) : "";

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

  return { message: "Pendaftaran Siswa Berhasil Disimpan!", id: id, urlIjazah: urlIjazah, urlKK: urlKK, urlBayar: urlBayar, urlFoto: urlFoto };
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
      
      const safeNik = String(dataObj.nik || dataObj.id).replace(/[^0-9a-zA-Z]/g, '');
      let updatedUrls = {};

      if (dataObj.fotoFile) {
        const urlFoto = uploadFileToDrive(dataObj.fotoFile, `Foto_${safeNik}`);
        if (urlFoto) {
          sheet.getRange(row, 23).setValue(urlFoto);
          updatedUrls.urlFoto = urlFoto;
        }
      }
      if (dataObj.ijazahFile) {
        const urlIjazah = uploadFileToDrive(dataObj.ijazahFile, `Ijazah_${safeNik}`);
        if (urlIjazah) {
          sheet.getRange(row, 26).setValue(urlIjazah);
          updatedUrls.urlIjazah = urlIjazah;
        }
      }
      if (dataObj.kkFile) {
        const urlKK = uploadFileToDrive(dataObj.kkFile, `KK_${safeNik}`);
        if (urlKK) {
          sheet.getRange(row, 27).setValue(urlKK);
          updatedUrls.urlKK = urlKK;
        }
      }
      if (dataObj.bayarFile) {
        const urlBayar = uploadFileToDrive(dataObj.bayarFile, `Bayar_${safeNik}`);
        if (urlBayar) {
          sheet.getRange(row, 28).setValue(urlBayar);
          updatedUrls.urlBayar = urlBayar;
        }
      }

      return { message: "Data Siswa Berhasil Diperbarui!", updatedUrls: updatedUrls };
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
    
    const formatTgl = (val) => {
      if (!val) return "";
      if (Object.prototype.toString.call(val) === '[object Date]') {
        return Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd");
      }
      const s = String(val).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
      return s;
    };

    if (!pendingOnly || statusValidasi === 'Pending' || statusValidasi === '') { 
      siswaList.push({
        id: row[0],
        tglDaftar: formatTgl(row[1]),
        nisn: row[2],
        nik: row[3],
        noKk: row[4],
        urutKk: row[5],
        kabKota: row[6],
        kecamatan: row[7],
        desaKelurahan: row[8],
        nama: row[9],
        tempatLahir: row[10],
        tglLahir: formatTgl(row[11]),
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

  let sheetPush = ss.getSheetByName('Push_Subscriptions');
  if (!sheetPush) {
    sheetPush = ss.insertSheet('Push_Subscriptions');
    sheetPush.appendRow(['Endpoint', 'Subscription_JSON', 'Username', 'Nama', 'Role', 'Updated_At']);
  }

  let sheetKegiatan = ss.getSheetByName('Kegiatan');
  if (!sheetKegiatan) {
    sheetKegiatan = ss.insertSheet('Kegiatan');
    sheetKegiatan.appendRow(['ID', 'Judul', 'Tanggal', 'Kategori', 'Deskripsi', 'Gambar', 'Video', 'Author', 'AuthorRole', 'TargetDisplay', 'CreatedAt', 'UpdatedAt']);
  }

  let sheetPengaturan = ss.getSheetByName('Pengaturan');
  if (!sheetPengaturan) {
    sheetPengaturan = ss.insertSheet('Pengaturan');
    sheetPengaturan.appendRow(['Key', 'Value_JSON', 'Updated_At']);
  }

  let sheetBuku = ss.getSheetByName('Buku');
  if (!sheetBuku) {
    sheetBuku = ss.insertSheet('Buku');
    sheetBuku.appendRow(['ID', 'Nama', 'Jenjang', 'Kategori', 'TotalHal', 'MinProgress', 'File', 'Keterangan', 'Dibaca', 'Updated_At']);
  }

  let sheetHasilUjian = ss.getSheetByName('Hasil_Ujian');
  if (!sheetHasilUjian) {
    sheetHasilUjian = ss.insertSheet('Hasil_Ujian');
    sheetHasilUjian.appendRow(['ID', 'Tanggal', 'SiswaID', 'NamaSiswa', 'Program', 'BukuJudul', 'Nilai', 'Predikat', 'Catatan', 'Penguji', 'Created_At']);
  }

  let sheetBankSoal = ss.getSheetByName('Bank_Soal');
  if (!sheetBankSoal) {
    sheetBankSoal = ss.insertSheet('Bank_Soal');
    sheetBankSoal.appendRow(['ID', 'Kode', 'Token', 'Jenjang', 'Kelas', 'BukuID', 'Judul', 'DurasiMenit', 'KKM', 'JenisUjian', 'StatusUjian', 'ButuhKartu', 'Pembuat', 'Tanggal', 'SoalList_JSON', 'Updated_At']);
  }
  
  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
  }

  // Isi data awal langsung ke Spreadsheet jika sheet baru dibuat / kosong
  populateInitialDataIfEmpty(ss);
}

function populateInitialDataIfEmpty(ss) {
  if (!ss) ss = SpreadsheetApp.openById(SHEET_ID);

  // 1. Sheet Kegiatan (Isi 3 Warta Kegiatan awal)
  const sheetKegiatan = ss.getSheetByName('Kegiatan');
  if (sheetKegiatan && sheetKegiatan.getLastRow() <= 1) {
    const defaultKegiatan = [
      ['keg-1', 'Orientasi Belajar & Pembagian Modul Pendidikan Kesetaraan 2026', '2026-10-20', 'Akademik', 'Kegiatan orientasi tatap muka perdana bagi warga belajar Paket A, B, dan C Aura Anugerah Sentani. Peserta diberikan penjelasan mengenai kurikulum merdeka kesetaraan serta tata cara asesmen modul daring dan tatap muka.', 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=800&q=80', '', 'Admin Aura', 'Super Admin', 'both', new Date().toISOString(), new Date().toISOString()],
      ['keg-2', 'Simulasi Ujian Berbasis Komputer (CBT) Modul IPA & IPS', '2026-10-22', 'Ujian / Evaluasi', 'Peserta didik Paket B dan Paket C melaksanakan tryout CBT online terpadu. Antusiasme tinggi terpancar dari para peserta dalam menjawab bank soal dan memahami materi pembelajaran digital.', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80', '', 'Ibu Guru Maria', 'Guru', 'both', new Date().toISOString(), new Date().toISOString()],
      ['keg-3', 'Pentas Seni & Gelar Karya Mandiri Warga Belajar PKBM Sentani', '2026-10-15', 'Pentas / Kreativitas', 'Pameran karya kerajinan tangan, olahan pangan lokal, serta pertunjukan seni budaya oleh siswa-siswi PKBM Aura Anugerah bersama anak-anak PAUD/TK Aura Anugerah dalam suasana yang hangat dan penuh kebersamaan.', 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80', '', 'Admin Aura', 'Admin', 'public', new Date().toISOString(), new Date().toISOString()]
    ];
    sheetKegiatan.getRange(2, 1, defaultKegiatan.length, defaultKegiatan[0].length).setValues(defaultKegiatan);
  }

  // 2. Sheet Pengaturan (Profil & Titik Peta PKBM Aura Anugerah)
  const sheetPengaturan = ss.getSheetByName('Pengaturan');
  if (sheetPengaturan && sheetPengaturan.getLastRow() <= 1) {
    const defaultPKBM = {
      nama: "PKBM Aura Anugerah",
      jalan: "JL. Yahim KOMP.Buton Samping Hotel Citra Buana",
      kecamatan: "Sentani",
      kabupaten: "Kabupaten Jayapura, Papua (99352)",
      deskripsi: "Pusat Kegiatan Belajar Masyarakat (PKBM) Aura Anugerah menyelenggarakan pendidikan kesetaraan Paket A (SD), Paket B (SMP), Paket C (SMA), kursus keterampilan vokasi, keaksaraan, serta program pemberdayaan masyarakat terpadu di Sentani, Jayapura.",
      visi: "Mewujudkan masyarakat yang cerdas, berdaya saing, berakhlak mulia, dan mandiri melalui layanan pendidikan non-formal yang inklusif dan berkualitas di tanah Papua.",
      misi: "1. Menyelenggarakan pendidikan kesetaraan Paket A, B, dan C yang adaptif dan berkualitas.\n2. Memberikan pelatihan vokasi & kewirausahaan mandiri bagi warga belajar.\n3. Membangun kolaborasi sinergis antara pendidik, masyarakat, dan mitra kerja.",
      wa: "628123456789",
      wa_nama: "Sekretariat PKBM Aura Anugerah",
      telepon: "0812-4800-0000",
      email: "pkbm.auraanugerah@gmail.com",
      latlong: "-2.566100,140.505700",
      target_display: "both"
    };
    sheetPengaturan.appendRow(['ppdb_tk_info', JSON.stringify(defaultPKBM), new Date().toISOString()]);
  }

  // 3. Sheet Bank Soal (Paket Ujian Awal & Butir Soal)
  const sheetBank = ss.getSheetByName('Bank_Soal');
  if (sheetBank && sheetBank.getLastRow() <= 1) {
    const defaultBank = [
      [
        'PKT-001', 'CBT-PKC-01', 'AURA2026', 'Paket C', 'Semua Kelas', 'BK-001',
        'Evaluasi Akhir Modul 1: Bahasa Indonesia Menggapai Cita-Cita',
        15, 70, 'Evaluasi Modul', 'AKTIF', 0, 'Tutor Penguji PKBM', '2026-10-25',
        JSON.stringify([
          {
            id: 1,
            pertanyaan: 'Apakah tujuan utama dari pembelajaran modul kesetaraan Bahasa Indonesia Paket C ini?',
            opsi: [
              { k: 'A', t: 'Meningkatkan pemahaman konsep dasar dan kompetensi literasi terapan di masyarakat.' },
              { k: 'B', t: 'Menghafal seluruh isi kamus besar bahasa Indonesia secara detail.' },
              { k: 'C', t: 'Mempelajari bahasa asing selain bahasa Indonesia.' },
              { k: 'D', t: 'Mengabaikan kaidah EYD dalam komunikasi resmi.' }
            ],
            kunci: 'A'
          },
          {
            id: 2,
            pertanyaan: 'Dalam teks eksposisi, bagian yang memuat sudut pandang penulis terhadap persoalan disebut:',
            opsi: [
              { k: 'A', t: 'Tesis (pernyataan pendapat).' },
              { k: 'B', t: 'Argumentasi penjelas.' },
              { k: 'C', t: 'Penegasan ulang / kesimpulan.' },
              { k: 'D', t: 'Orientasi tokoh.' }
            ],
            kunci: 'A'
          },
          {
            id: 3,
            pertanyaan: 'Ciri utama kalimat efektif dalam penulisan laporan ilmiah adalah:',
            opsi: [
              { k: 'A', t: 'Lugas, jelas, dan tidak menimbulkan makna ganda.' },
              { k: 'B', t: 'Menggunakan kiasan sastra yang sangat berbelit-belit.' },
              { k: 'C', t: 'Kalimat sangat panjang tanpa tanda koma.' },
              { k: 'D', t: 'Memadukan banyak bahasa daerah yang tidak umum.' }
            ],
            kunci: 'A'
          }
        ]),
        new Date().toISOString()
      ],
      [
        'PKT-002', 'CBT-PKB-02', 'BELAJAR26', 'Paket B', 'Semua Kelas', 'BK-004',
        'Asesmen Modul IPA: Ekosistem & Pelestarian Lingkungan Hidup',
        20, 75, 'Evaluasi Modul', 'AKTIF', 0, 'Tutor Sains PKBM', '2026-10-25',
        JSON.stringify([
          {
            id: 1,
            pertanyaan: 'Interaksi timbal balik antara makhluk hidup dengan komponen abiotik di habitatnya disebut:',
            opsi: [
              { k: 'A', t: 'Ekosistem.' },
              { k: 'B', t: 'Simbiosis parasitisme.' },
              { k: 'C', t: 'Rantai makanan tertutup.' },
              { k: 'D', t: 'Komunitas biotik.' }
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
        ]),
        new Date().toISOString()
      ]
    ];
    sheetBank.getRange(2, 1, defaultBank.length, defaultBank[0].length).setValues(defaultBank);
  }
}

// =================== PUSH NOTIFICATION STORAGE ===================
function savePushSubscriptionToDB(subObj, userObj) {
  const sheet = getDB('Push_Subscriptions');
  if (!sheet) throw new Error("Sheet Push_Subscriptions belum disetup.");

  const endpoint = subObj.endpoint || '';
  if (!endpoint) throw new Error("Endpoint diperlukan.");

  const subJson = JSON.stringify(subObj);
  const username = (userObj && userObj.username) ? userObj.username : 'guest';
  const nama = (userObj && userObj.nama) ? userObj.nama : 'Tamu';
  const role = (userObj && userObj.role) ? userObj.role : 'Umum';
  const updatedAt = new Date().toISOString();

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === endpoint) {
      // Update baris yang sudah ada
      sheet.getRange(i + 1, 2).setValue(subJson);
      sheet.getRange(i + 1, 3).setValue(username);
      sheet.getRange(i + 1, 4).setValue(nama);
      sheet.getRange(i + 1, 5).setValue(role);
      sheet.getRange(i + 1, 6).setValue(updatedAt);
      return { success: true, message: "Subscription updated" };
    }
  }

  // Baris baru
  sheet.appendRow([endpoint, subJson, username, nama, role, updatedAt]);
  return { success: true, message: "Subscription added" };
}

function deletePushSubscriptionFromDB(endpoint) {
  const sheet = getDB('Push_Subscriptions');
  if (!sheet) return { success: true };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === endpoint) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "Subscription removed" };
    }
  }
  return { success: true };
}

// Ambil daftar perangkat langganan push (bisa difilter berdasarkan role)
function getPushSubscriptionsFromDB(targetRole, targetUsername) {
  const sheet = getDB('Push_Subscriptions');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    try {
      const endpoint = data[i][0];
      const subJson = data[i][1];
      const username = data[i][2];
      const nama = data[i][3];
      const role = data[i][4];
      if (targetUsername && username !== targetUsername) continue;
      if (targetRole && targetRole.toLowerCase() === 'admin') {
        const rLower = String(role || '').toLowerCase();
        if (rLower !== 'admin' && rLower !== 'super admin') continue;
      } else if (targetRole && String(role || '').toLowerCase() !== targetRole.toLowerCase()) {
        continue;
      }
      list.push({
        endpoint: endpoint,
        subscription: JSON.parse(subJson),
        user: { username: username, nama: nama, role: role }
      });
    } catch (e) { }
  }
  return list;
}

// Catat riwayat setiap notifikasi aktivitas baru (fleksibel untuk fitur apa pun di masa depan)
function logNotificationActivity(title, body, url, targetRole, tag) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheetNotif = ss.getSheetByName('Log_Notifikasi');
  if (!sheetNotif) {
    sheetNotif = ss.insertSheet('Log_Notifikasi');
    sheetNotif.appendRow(['Timestamp', 'Judul', 'Pesan', 'URL_Tujuan', 'Target_Role', 'Tag']);
  }
  sheetNotif.appendRow([
    new Date().toISOString(),
    title || 'Pemberitahuan',
    body || '',
    url || '/portal',
    targetRole || 'Semua',
    tag || 'umum'
  ]);
  return { success: true, message: "Log notifikasi berhasil dicatat" };
}

// Ambil riwayat log notifikasi untuk dashboard admin/super admin
function getNotificationLogs(limit) {
  const maxLimit = limit ? parseInt(limit, 10) : 30;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheetNotif = ss.getSheetByName('Log_Notifikasi');
  if (!sheetNotif) return [];
  const data = sheetNotif.getDataRange().getValues();
  if (data.length <= 1) return [];

  const list = [];
  // Baca dari baris paling bawah (terbaru)
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    list.push({
      timestamp: row[0],
      title: row[1],
      body: row[2],
      url: row[3],
      targetRole: row[4],
      tag: row[5]
    });
    if (list.length >= maxLimit) break;
  }
  return list;
}

// =================== KEGIATAN & WARTA MANAGEMENT ===================
function getKegiatanSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Kegiatan');
  if (!sheet) {
    sheet = ss.insertSheet('Kegiatan');
    sheet.appendRow(['ID', 'Judul', 'Tanggal', 'Kategori', 'Deskripsi', 'Gambar', 'Video', 'Author', 'AuthorRole', 'TargetDisplay', 'CreatedAt', 'UpdatedAt']);
  }
  return sheet;
}

function getKegiatanListFromDB() {
  const sheet = getKegiatanSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const list = [];
  // Kembalikan dari urutan terbaru (dari baris bawah ke atas)
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    if (!row[0]) continue;
    let tglStr = '';
    if (row[2] instanceof Date) {
      tglStr = Utilities.formatDate(row[2], "GMT+7", "yyyy-MM-dd");
    } else {
      tglStr = String(row[2] || '').split('T')[0];
    }

    list.push({
      id: String(row[0]),
      judul: String(row[1] || ''),
      tanggal: tglStr,
      kategori: String(row[3] || 'Akademik'),
      deskripsi: String(row[4] || ''),
      gambar: String(row[5] || ''),
      video: String(row[6] || ''),
      author: String(row[7] || 'Petugas'),
      authorRole: String(row[8] || 'Petugas'),
      target_display: String(row[9] || 'both'),
      createdAt: row[10] ? String(row[10]) : '',
      updatedAt: row[11] ? String(row[11]) : ''
    });
  }
  return list;
}

function saveKegiatanToDB(keg) {
  if (!keg || !keg.judul) throw new Error("Judul kegiatan wajib diisi.");
  const sheet = getKegiatanSheet();
  const data = sheet.getDataRange().getValues();
  const kegId = keg.id || ('keg-' + new Date().getTime());
  const now = new Date().toISOString();

  // Mode Edit / Update jika sudah ada ID
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(kegId).trim()) {
      sheet.getRange(i + 1, 2).setValue(keg.judul || '');
      sheet.getRange(i + 1, 3).setValue(keg.tanggal || '');
      sheet.getRange(i + 1, 4).setValue(keg.kategori || 'Akademik');
      sheet.getRange(i + 1, 5).setValue(keg.deskripsi || '');
      sheet.getRange(i + 1, 6).setValue(keg.gambar || '');
      sheet.getRange(i + 1, 7).setValue(keg.video || '');
      if (keg.target_display) sheet.getRange(i + 1, 10).setValue(keg.target_display);
      sheet.getRange(i + 1, 12).setValue(now);
      return { id: kegId, message: "Kegiatan berhasil diperbarui." };
    }
  }

  // Mode Tambah Baru
  sheet.appendRow([
    kegId,
    keg.judul || '',
    keg.tanggal || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd"),
    keg.kategori || 'Akademik',
    keg.deskripsi || '',
    keg.gambar || '',
    keg.video || '',
    keg.author || 'Petugas',
    keg.authorRole || 'Petugas',
    keg.target_display || 'both',
    now,
    now
  ]);
  return { id: kegId, message: "Kegiatan baru berhasil disimpan ke Database." };
}

function deleteKegiatanFromDB(id) {
  if (!id) throw new Error("ID kegiatan diperlukan.");
  const sheet = getKegiatanSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);
      return { message: "Kegiatan berhasil dihapus dari Database." };
    }
  }
  return { message: "Data kegiatan tidak ditemukan." };
}

// =================== PENGATURAN / TK INFO (MAPS & PROFIL) ===================
function getPengaturanSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Pengaturan');
  if (!sheet) {
    sheet = ss.insertSheet('Pengaturan');
    sheet.appendRow(['Key', 'Value_JSON', 'Updated_At']);
  }
  return sheet;
}

function getAppSettingFromDB(key) {
  const sheet = getPengaturanSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(key).trim()) {
      try {
        return JSON.parse(data[i][1]);
      } catch (e) {
        return data[i][1];
      }
    }
  }
  return null;
}

function saveAppSettingToDB(key, val) {
  if (!key) throw new Error("Key pengaturan diperlukan.");
  const sheet = getPengaturanSheet();
  const data = sheet.getDataRange().getValues();
  const valJson = typeof val === 'object' ? JSON.stringify(val) : String(val);
  const now = new Date().toISOString();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(key).trim()) {
      sheet.getRange(i + 1, 2).setValue(valJson);
      sheet.getRange(i + 1, 3).setValue(now);
      return { message: "Pengaturan berhasil diperbarui." };
    }
  }
  sheet.appendRow([key, valJson, now]);
  return { message: "Pengaturan berhasil disimpan." };
}

function getBukuSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Buku');
  if (!sheet) {
    sheet = ss.insertSheet('Buku');
    sheet.appendRow(['ID', 'Nama', 'Jenjang', 'Kategori', 'TotalHal', 'MinProgress', 'File', 'Keterangan', 'Dibaca', 'Detail_JSON', 'Updated_At']);
  }
  return sheet;
}

function getBukuListFromDB() {
  const sheet = getBukuSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    let extra = {};
    try {
      if (row[9]) extra = JSON.parse(row[9]);
    } catch (e) { }

    list.push({
      id: String(row[0]),
      kode: extra.kode || ('BK-' + String(i).padStart(3, '0')),
      nama: String(row[1] || ''),
      mapel: extra.mapel || String(row[3] || ''),
      jenjang: String(row[2] || ''),
      kelas: extra.kelas || '',
      modul: extra.modul || '1',
      kategori: String(row[3] || ''),
      totalHal: Number(row[4]) || 30,
      minProgress: row[5] !== undefined && row[5] !== '' ? Number(row[5]) : 50,
      dibaca: Number(row[8]) || 0,
      rating: extra.rating || 4.5,
      cover: extra.cover || `https://drive.google.com/thumbnail?id=${row[0]}&sz=w600`,
      file: String(row[6] || ''),
      download: extra.download || `https://drive.google.com/uc?export=download&id=${row[0]}`,
      keterangan: String(row[7] || '')
    });
  }
  return list;
}

function saveBukuBatchToDB(bukuArr) {
  if (!Array.isArray(bukuArr)) throw new Error("Format buku harus berupa array.");
  const sheet = getBukuSheet();
  sheet.clear();
  sheet.appendRow(['ID', 'Nama', 'Jenjang', 'Kategori', 'TotalHal', 'MinProgress', 'File', 'Keterangan', 'Dibaca', 'Detail_JSON', 'Updated_At']);
  const now = new Date().toISOString();
  
  const rows = bukuArr.map((b, idx) => {
    const extra = {
      kode: b.kode || ('BK-' + String(idx + 1).padStart(3, '0')),
      mapel: b.mapel || b.kategori || '',
      kelas: b.kelas || '',
      modul: b.modul || '1',
      rating: b.rating || 4.5,
      cover: b.cover || '',
      download: b.download || ''
    };

    return [
      b.id || '',
      b.nama || '',
      b.jenjang || '',
      b.kategori || b.mapel || '',
      b.totalHal || 30,
      b.minProgress !== undefined ? b.minProgress : 50,
      b.file || '',
      b.keterangan || '',
      b.dibaca || 0,
      JSON.stringify(extra),
      now
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  return { message: `${rows.length} buku pelajaran berhasil disinkronkan ke Database.` };
}

// =================== HASIL UJIAN RAPOR SISWA ===================
function getHasilUjianSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Hasil_Ujian');
  if (!sheet) {
    sheet = ss.insertSheet('Hasil_Ujian');
    sheet.appendRow(['ID', 'Tanggal', 'SiswaID', 'NamaSiswa', 'Program', 'BukuJudul', 'Nilai', 'Predikat', 'Catatan', 'Penguji', 'Created_At']);
  }
  return sheet;
}

function getHasilUjianFromDB() {
  const sheet = getHasilUjianSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const list = [];
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    if (!row[0]) continue;
    list.push({
      id: String(row[0]),
      tanggal: String(row[1] || ''),
      siswaId: String(row[2] || ''),
      namaSiswa: String(row[3] || ''),
      program: String(row[4] || ''),
      bukuJudul: String(row[5] || ''),
      nilai: Number(row[6]) || 0,
      predikat: String(row[7] || ''),
      catatan: String(row[8] || ''),
      penguji: String(row[9] || '')
    });
  }
  return list;
}

function saveHasilUjianToDB(ujian) {
  if (!ujian) throw new Error("Data hasil ujian diperlukan.");
  const sheet = getHasilUjianSheet();
  const now = new Date().toISOString();
  const id = ujian.id || ('EX-' + Date.now());

  sheet.appendRow([
    id,
    ujian.tanggal || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd"),
    ujian.siswaId || '',
    ujian.namaSiswa || '',
    ujian.program || '',
    ujian.bukuJudul || '',
    ujian.nilai || 0,
    ujian.predikat || '',
    ujian.catatan || '',
    ujian.penguji || '',
    now
  ]);
  return { id: id, message: "Hasil ujian berhasil disimpan ke database." };
}

// =================== BANK SOAL & CBT ===================
function getBankSoalSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Bank_Soal');
  if (!sheet) {
    sheet = ss.insertSheet('Bank_Soal');
    sheet.appendRow(['ID', 'Kode', 'Token', 'Jenjang', 'Kelas', 'BukuID', 'Judul', 'DurasiMenit', 'KKM', 'JenisUjian', 'StatusUjian', 'ButuhKartu', 'Pembuat', 'Tanggal', 'SoalList_JSON', 'Updated_At']);
  }
  return sheet;
}

function getBankSoalFromDB() {
  const sheet = getBankSoalSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    let soals = [];
    try {
      soals = JSON.parse(row[14] || '[]');
    } catch (e) { }

    list.push({
      id: String(row[0]),
      kode: String(row[1] || ''),
      token: String(row[2] || ''),
      jenjang: String(row[3] || ''),
      kelas: String(row[4] || ''),
      bukuId: String(row[5] || ''),
      judul: String(row[6] || ''),
      durasiMenit: Number(row[7]) || 15,
      kkm: Number(row[8]) || 70,
      jenisUjian: String(row[9] || 'Evaluasi Modul'),
      statusUjian: String(row[10] || 'AKTIF'),
      butuhKartu: !!row[11],
      pembuat: String(row[12] || ''),
      tanggal: String(row[13] || ''),
      soalList: soals
    });
  }
  return list;
}

function saveBankSoalBatchToDB(paketArr) {
  if (!Array.isArray(paketArr)) throw new Error("Format paket soal harus array.");
  const sheet = getBankSoalSheet();
  sheet.clear();
  sheet.appendRow(['ID', 'Kode', 'Token', 'Jenjang', 'Kelas', 'BukuID', 'Judul', 'DurasiMenit', 'KKM', 'JenisUjian', 'StatusUjian', 'ButuhKartu', 'Pembuat', 'Tanggal', 'SoalList_JSON', 'Updated_At']);
  const now = new Date().toISOString();

  const rows = paketArr.map(p => [
    p.id || '',
    p.kode || '',
    p.token || '',
    p.jenjang || '',
    p.kelas || '',
    p.bukuId || '',
    p.judul || '',
    p.durasiMenit || 15,
    p.kkm || 70,
    p.jenisUjian || 'Evaluasi Modul',
    p.statusUjian || 'AKTIF',
    p.butuhKartu ? 1 : 0,
    p.pembuat || '',
    p.tanggal || '',
    JSON.stringify(p.soalList || []),
    now
  ]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  return { message: `${rows.length} paket bank soal berhasil disimpan ke Database.` };
}

// ==================== DATABASE TABEL RAPORT & TRANSKRIP NILAI ====================
function getRaportSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Raport_Nilai');
  if (!sheet) {
    sheet = ss.insertSheet('Raport_Nilai');
    sheet.appendRow([
      'ID', 'SiswaID', 'NamaSiswa', 'NISN', 'Program', 'TingkatKelas', 
      'TahunAjaran', 'Semester', 'Fase', 'NilaiMapel_JSON', 'CatatanAkademik', 
      'Ekskul_JSON', 'Kehadiran_JSON', 'StatusKenaikanLulus', 'TglRapor', 'Updated_At'
    ]);
  }
  return sheet;
}

function getRaportListFromDB() {
  const sheet = getRaportSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const list = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    let mapel = [];
    let ekskul = [];
    let kehadiran = { sakit: 0, izin: 0, tanpaKeterangan: 0 };
    try { mapel = JSON.parse(row[9] || '[]'); } catch (e) {}
    try { ekskul = JSON.parse(row[11] || '[]'); } catch (e) {}
    try { kehadiran = JSON.parse(row[12] || '{}'); } catch (e) {}

    list.push({
      id: String(row[0]),
      siswaId: String(row[1]),
      namaSiswa: String(row[2]),
      nisn: String(row[3] || ''),
      program: String(row[4] || ''),
      tingkatKelas: String(row[5] || ''),
      tahunAjaran: String(row[6] || '2026/2027'),
      semester: String(row[7] || 'Ganjil'),
      fase: String(row[8] || ''),
      nilaiMapel: mapel,
      catatanAkademik: String(row[10] || ''),
      ekskul: ekskul,
      kehadiran: kehadiran,
      statusKenaikanLulus: String(row[13] || 'Lulus / Naik Kelas'),
      tglRapor: String(row[14] || ''),
      updatedAt: String(row[15] || '')
    });
  }
  return list;
}

function saveRaportToDB(raport) {
  if (!raport) throw new Error("Data raport tidak boleh kosong.");
  const sheet = getRaportSheet();
  const data = sheet.getDataRange().getValues();
  const id = raport.id || 'RAP-' + Date.now();
  const now = new Date().toISOString();

  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id) || 
       (String(data[i][1]) === String(raport.siswaId) && String(data[i][6]) === String(raport.tahunAjaran) && String(data[i][7]) === String(raport.semester))) {
      foundRow = i + 1;
      break;
    }
  }

  const rowValues = [
    id,
    raport.siswaId || '',
    raport.namaSiswa || '',
    raport.nisn || '',
    raport.program || '',
    raport.tingkatKelas || '',
    raport.tahunAjaran || '2026/2027',
    raport.semester || 'Ganjil',
    raport.fase || '',
    JSON.stringify(raport.nilaiMapel || []),
    raport.catatanAkademik || '',
    JSON.stringify(raport.ekskul || []),
    JSON.stringify(raport.kehadiran || { sakit: 0, izin: 0, tanpaKeterangan: 0 }),
    raport.statusKenaikanLulus || 'Naik Kelas',
    raport.tglRapor || new Date().toLocaleDateString('id-ID'),
    now
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return { success: true, message: "Data Rapor berhasil disimpan ke Database Cloud.", id: id };
}

function deleteRaportFromDB(id) {
  const sheet = getRaportSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: "Rapor berhasil dihapus dari Database Cloud." };
    }
  }
  return { success: false, message: "Data raport tidak ditemukan." };
}




