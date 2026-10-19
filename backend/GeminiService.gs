/**
 * Helper untuk mendapatkan daftar API Key (mendukung rotasi multi-key dari database API_Keys atau client)
 */
function getApiKeysList(clientApiKey) {
  let keys = [];

  // 1. Ambil dari database sheet 'API_Keys' jika ada
  try {
    if (typeof getApiKeysListFromDB === "function") {
      const dbKeys = getApiKeysListFromDB();
      if (dbKeys && dbKeys.length > 0) {
        dbKeys.forEach(k => {
          if (k.apiKey && k.apiKey.length > 10 && k.status === 'Aktif') {
            keys.push(k.apiKey);
          }
        });
      }
    }
  } catch (e) {
    Logger.log("Gagal membaca API_Keys dari DB: " + e.toString());
  }

  // 2. Jika ada clientApiKey yang dikirim dari browser
  if (clientApiKey && typeof clientApiKey === 'string' && clientApiKey.trim() !== '') {
    const fromClient = clientApiKey.split(',').map(k => k.trim()).filter(k => k.length > 10);
    fromClient.forEach(k => {
      if (!keys.includes(k)) keys.push(k);
    });
  }

  // 3. Script Properties
  if (keys.length === 0) {
    const propKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (propKey && propKey.trim() !== '' && propKey !== 'TARUH_API_KEY_DISINI') {
      keys = propKey.split(',').map(k => k.trim()).filter(k => k.length > 10);
    }
  }

  return keys;
}

/**
 * Pengecekan data menggunakan Gemini AI
 */
function cekKesesuaianDenganAI(dataSiswa, urlGambar, clientApiKey) {
  const apiKeys = getApiKeysList(clientApiKey);

  if (!apiKeys || apiKeys.length === 0) {
    return {
      status: "ERROR",
      koreksi: "GEMINI_API_KEY belum dikonfigurasi. Silakan tambahkan GEMINI_API_KEY di Project Settings > Script Properties."
    };
  }

  if (!urlGambar || urlGambar.trim() === "" || urlGambar.includes("Data Terlampir")) {
    return {
      status: "ERROR",
      koreksi: "Dokumen belum memiliki berkas gambar yang tersimpan untuk dianalisis oleh AI."
    };
  }

  let imageBase64 = "";
  let contentType = "image/jpeg";

  try {
    // 1. Jika berupa Data URI (data:image/...;base64,...)
    if (urlGambar.startsWith("data:")) {
      const parts = urlGambar.split(";base64,");
      const match = parts[0].match(/data:(.*)/);
      if (match && match[1]) contentType = match[1];
      imageBase64 = parts[1];
    } 
    // 2. Jika berupa Link Google Drive, ambil langsung dari DriveApp
    else if (urlGambar.includes("drive.google.com")) {
      let fileId = "";
      if (urlGambar.includes("id=")) {
        const match = urlGambar.match(/id=([a-zA-Z0-9_-]+)/);
        if (match) fileId = match[1];
      } else if (urlGambar.includes("/d/")) {
        const match = urlGambar.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) fileId = match[1];
      }

      if (fileId) {
        const file = DriveApp.getFileById(fileId);
        const blob = file.getBlob();
        contentType = blob.getContentType() || "image/jpeg";
        imageBase64 = Utilities.base64Encode(blob.getBytes());
      } else {
        throw new Error("ID File Google Drive tidak dapat dikenali dari URL: " + urlGambar);
      }
    } 
    // 3. Jika URL eksternal biasa
    else if (urlGambar.startsWith("http://") || urlGambar.startsWith("https://")) {
      const imageResponse = UrlFetchApp.fetch(urlGambar, { muteHttpExceptions: true });
      if (imageResponse.getResponseCode() !== 200) {
        return { status: "ERROR", koreksi: "Gagal mengambil gambar dokumen dari URL (HTTP " + imageResponse.getResponseCode() + ")." };
      }
      const imageBlob = imageResponse.getBlob();
      contentType = imageBlob.getContentType() || "image/jpeg";
      imageBase64 = Utilities.base64Encode(imageBlob.getBytes());
    } else {
      return { status: "ERROR", koreksi: "Format URL berkas tidak valid atau tidak didukung." };
    }

    if (contentType.includes("application/pdf")) {
      contentType = "application/pdf";
    } else if (!contentType.startsWith("image/")) {
      contentType = "image/jpeg";
    }
  } catch (e) {
    return { status: "ERROR", koreksi: "Gagal memproses file dokumen untuk AI: " + e.message };
  }


  const promptText = `Berikut adalah data pendaftaran calon siswa Kejar Paket (Sekolah Non-Formal):\n` +
                     `- NIK: ${dataSiswa.nik || '-'}\n` +
                     `- Nama Lengkap: ${dataSiswa.nama || '-'}\n` +
                     `- Tempat Lahir: ${dataSiswa.tempatLahir || '-'}\n` +
                     `- Tanggal Lahir: ${dataSiswa.tglLahir || '-'}\n` +
                     `- Nama Ibu Kandung: ${dataSiswa.namaIbu || '-'}\n\n` +
                     `Dan terlampir adalah gambar foto dokumen pendukung resmi (KK atau Ijazah).\n` +
                     `Tugasmu:\n` +
                     `1. Periksa kelima data di atas (NIK, Nama Lengkap, Tempat Lahir, Tanggal Lahir, Nama Ibu Kandung) terhadap dokumen yang terlampir secara SANGAT TELITI.\n` +
                     `2. Catatan khusus:\n` +
                     `   - Jika dokumen adalah Ijazah dan NIK memang tidak dicantumkan di format ijazah, catat sebagai poin informasi jika relevan.\n` +
                     `   - Format tanggal lahir: perhatikan tanggal, bulan, dan tahunnya (abaikan perbedaan format jam ISO string seperti T17:00:00Z).\n` +
                     `3. Tentukan status pemeriksaan secara tegas HANYA ada 2 pilihan:\n` +
                     `   - "Sesuai" (jika semua data cocok)\n` +
                     `   - "Tidak Sesuai" (jika terdapat ketidakcocokan / perbedaan data)\n` +
                     `4. Jika status "Tidak Sesuai":\n` +
                     `   a. Deskripsikan permasalahan dalam bentuk poin-poin bernomor (1. ..., 2. ...).\n` +
                     `   b. KATEGORIKAN apakah kesalahan tersebut merupakan:\n` +
                     `      - "KOREKSI_DATA": Data salah input / typo / belum lengkap yang nilainya jelas tertera benar di dokumen fisik yang terlampir. Berikan nilai yang benar pada properti 'suggestedFix'.\n` +
                     `      - "REKOMENDASI_RESMI": Perbedaan data antar-dokumen resmi (misal ejaan nama atau tgl lahir di Ijazah berbeda dengan di KK). Berikan petunjuk pada properti 'rekomendasiResmi' (misal: "Disarankan meminta Surat Keterangan Beda Nama dari instansi terkait").\n` +
                     `5. Jika status "Sesuai", WAJIB buatkan rincian bukti verifikasi (evidence checklist) dalam bentuk poin-poin bernomor 1. ..., 2. ..., 3. ... yang merinci setiap data yang berhasil diverifikasi dan cocok dengan dokumen. Contoh:\n` +
                     `   1. Nama Lengkap: Cocok (Tertulis '${dataSiswa.nama || '-'}' pada dokumen).\n` +
                     `   2. NIK: Cocok (Tertera 16 digit sesuai pada dokumen).\n` +
                     `   3. Tempat Lahir: Cocok (Tertulis '${dataSiswa.tempatLahir || '-'}' pada dokumen).\n` +
                     `   4. Tanggal Lahir: Cocok (Tertulis sesuai pada dokumen).\n` +
                     `   5. Nama Ibu Kandung: Cocok (Tertera sesuai pada dokumen).\n\n` +
                     `Kembalikan respons murni dalam format JSON (tanpa markdown), dengan struktur:\n` +
                     `{\n` +
                     `  "status": "Sesuai" | "Tidak Sesuai",\n` +
                     `  "koreksi": "Poin-poin bernomor 1. 2. 3. berisi rincian bukti jika Sesuai, atau temuan perbedaan jika Tidak Sesuai",\n` +
                     `  "tipeMasalah": "KOREKSI_DATA" | "REKOMENDASI_RESMI" | null,\n` +
                     `  "rekomendasiResmi": "Catatan rekomendasi jika ada perbedaan dokumen resmi, atau kosong jika tidak ada",\n` +
                     `  "suggestedFix": {\n` +
                     `    "nama": "Nilai benar dari dokumen fisik jika nama perlu dikoreksi, atau null",\n` +
                     `    "nik": "Nilai NIK 16 digit benar dari dokumen jika perlu dikoreksi, atau null",\n` +
                     `    "tempatLahir": "Tempat lahir benar dari dokumen jika perlu dikoreksi, atau null",\n` +
                     `    "tglLahir": "Tanggal lahir benar format YYYY-MM-DD dari dokumen jika perlu dikoreksi, atau null",\n` +
                     `    "namaIbu": "Nama ibu kandung benar dari dokumen jika perlu dikoreksi, atau null"\n` +
                     `  }\n` +
                     `}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: contentType,
              data: imageBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  // Daftar model resmi aktif yang didukung
  const candidateModels = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];

  let lastError = "";

  // Rotasi multi-key dan candidate model
  for (let k = 0; k < apiKeys.length; k++) {
    const currentApiKey = apiKeys[k];

    for (let m = 0; m < candidateModels.length; m++) {
      const modelName = candidateModels[m];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${currentApiKey}`;

      try {
        const response = UrlFetchApp.fetch(url, options);
        const statusCode = response.getResponseCode();
        const responseText = response.getContentText();

        if (statusCode === 200) {
          const resultJson = JSON.parse(responseText);
          if (resultJson.candidates && resultJson.candidates.length > 0) {
            // Catat pemakaian key ke database
            if (typeof incrementKeyUsageInDB === "function") {
              incrementKeyUsageInDB(currentApiKey);
            }
            const aiContent = resultJson.candidates[0].content.parts[0].text;
            const cleaned = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
          }
        } else if (statusCode === 503 || statusCode === 429) {
          // Jika limit per menit tercapai atau server sibuk, coba model/key berikutnya
          lastError = `Google Gemini (${modelName}) limit/sibuk (HTTP ${statusCode}).`;
          Utilities.sleep(800);
          continue;
        } else if (statusCode === 401) {
          lastError = `Kunci API ke-${k+1} tidak valid (HTTP 401).`;
          break; // Pindah ke API key berikutnya
        } else {
          lastError = `Google Gemini (${modelName}) HTTP ${statusCode}: ${responseText.substring(0, 150)}`;
        }
      } catch (e) {
        lastError = e.toString();
      }
    }
  }

  return { status: "ERROR", koreksi: lastError || "Gagal menghubungi layanan AI." };
}

/**
 * Ekstraksi Data Otomatis dari Kartu Keluarga & Ijazah menggunakan Gemini AI
 */
function ekstrakDataDenganAI(nikTarget, kkBase64, ijazahBase64, clientApiKey) {
  const apiKeys = getApiKeysList(clientApiKey);

  if (!apiKeys || apiKeys.length === 0) {
    return {
      status: "ERROR",
      message: "GEMINI_API_KEY belum dikonfigurasi."
    };
  }

  if (!kkBase64 && !ijazahBase64) {
    return {
      status: "ERROR",
      message: "Mohon unggah minimal foto Kartu Keluarga (KK)."
    };
  }

  const parts = [];

  const promptText = `Anda adalah asisten AI cerdas untuk pendaftaran peserta didik baru (PPDB).\n` +
    (nikTarget ? `NIK Target Siswa: "${nikTarget}"\n` : `NIK Target Siswa: (Cari data siswa utama pada dokumen)\n`) +
    `Instruksi:\n` +
    `1. Analisis gambar dokumen yang terlampir (Kartu Keluarga dan/atau Ijazah).\n` +
    `2. Jika ada Kartu Keluarga: Temukan baris anggota keluarga yang memiliki NIK sesuai "NIK Target Siswa" (atau anggota anak jika NIK tidak spesifik).\n` +
    `3. Ekstrak data berikut secara teliti:\n` +
    `   - nama: Nama lengkap calon siswa\n` +
    `   - nik: NIK calon siswa (16 digit)\n` +
    `   - noKk: Nomor Kartu Keluarga (16 digit di bagian atas KK)\n` +
    `   - urutKk: Nomor urut siswa di dalam tabel Kartu Keluarga (misal: 1, 2, 3, dst)\n` +
    `   - jk: Jenis Kelamin ('Laki-laki' atau 'Perempuan')\n` +
    `   - tempatLahir: Tempat lahir siswa\n` +
    `   - tglLahir: Tanggal lahir format YYYY-MM-DD\n` +
    `   - namaAyah: Nama ayah kandung\n` +
    `   - nikAyah: NIK ayah kandung jika terbaca\n` +
    `   - tahunLahirAyah: Tahun lahir ayah jika ada\n` +
    `   - namaIbu: Nama ibu kandung\n` +
    `   - nikIbu: NIK ibu kandung jika terbaca\n` +
    `   - tahunLahirIbu: Tahun lahir ibu jika ada\n` +
    `   - kabKota: Kabupaten / Kota domisili di KK\n` +
    `   - kecamatan: Kecamatan di KK\n` +
    `   - desaKelurahan: Desa / Kelurahan di KK\n` +
    `4. Jika terlampir Ijazah: Ekstrak NISN (10 digit nomor induk siswa nasional) dan tahun kelulusan asal (tahunLulus).\n` +
    `5. PERIKSA KESESUAIAN ANTARA KK DAN IJAZAH (Jika kedua dokumen terlampir):\n` +
    `   - Bandingkan Nama Lengkap, Tempat Lahir, dan Tanggal Lahir antara yang tertulis di Kartu Keluarga dan Ijazah.\n` +
    `   - Jika sama persis (atau hanya ada 1 dokumen tanpa konflik): tetapkan validationStatus = "Sesuai", dan WAJIB buatkan validationDetails dalam bentuk poin-poin bernomor (1. ..., 2. ...) sebagai bukti pencocokan (evidence audit), contoh: 1. Nama Lengkap: Cocok antara KK dan Ijazah. 2. Tempat & Tanggal Lahir: Cocok antara KK dan Ijazah. 3. Identitas siswa terverifikasi sah.\n` +
    `   - Jika ada perbedaan (misal nama di Ijazah berbeda ejaan dengan nama di KK, atau tanggal lahir berbeda): tetapkan validationStatus = "Tidak Sesuai", dan buatkan validationDetails dalam bentuk poin bernomor (1. ..., 2. ...) yang merinci letak perbedaannya.\n` +
    `Kembalikan respon murni JSON (tanpa markdown), contoh format:\n` +
    `{\n` +
    `  "status": "SUCCESS",\n` +
    `  "validationStatus": "Sesuai" | "Tidak Sesuai",\n` +
    `  "validationDetails": "Poin-poin bernomor 1. 2. 3. berisi rincian bukti verifikasi jika Sesuai, atau rincian perbedaan jika Tidak Sesuai",\n` +
    `  "data": {\n` +
    `    "nama": "...",\n` +
    `    "nik": "...",\n` +
    `    "noKk": "...",\n` +
    `    "urutKk": "...",\n` +
    `    "jk": "...",\n` +
    `    "tempatLahir": "...",\n` +
    `    "tglLahir": "YYYY-MM-DD",\n` +
    `    "namaAyah": "...",\n` +
    `    "nikAyah": "...",\n` +
    `    "tahunLahirAyah": "...",\n` +
    `    "namaIbu": "...",\n` +
    `    "nikIbu": "...",\n` +
    `    "tahunLahirIbu": "...",\n` +
    `    "kabKota": "...",\n` +
    `    "kecamatan": "...",\n` +
    `    "desaKelurahan": "...",\n` +
    `    "nisn": "...",\n` +
    `    "tahunLulus": "..."\n` +
    `  }\n` +
    `}`;

  parts.push({ text: promptText });

  // Helper untuk membersihkan base64 data URL
  function cleanB64(raw) {
    if (!raw) return null;
    let mime = "image/jpeg";
    let data = raw;
    if (raw.includes(";base64,")) {
      const sp = raw.split(";base64,");
      const m = sp[0].match(/data:(.*)/);
      if (m && m[1]) mime = m[1];
      data = sp[1];
    }
    return { mimeType: mime, data: data };
  }

  if (kkBase64) {
    const cleanKk = cleanB64(kkBase64);
    if (cleanKk) parts.push({ inline_data: { mime_type: cleanKk.mimeType, data: cleanKk.data } });
  }

  if (ijazahBase64) {
    const cleanIjazah = cleanB64(ijazahBase64);
    if (cleanIjazah) parts.push({ inline_data: { mime_type: cleanIjazah.mimeType, data: cleanIjazah.data } });
  }

  const payload = {
    contents: [{ parts: parts }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const candidateModels = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  let lastError = "";

  for (let k = 0; k < apiKeys.length; k++) {
    const currentApiKey = apiKeys[k];

    for (let m = 0; m < candidateModels.length; m++) {
      const modelName = candidateModels[m];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${currentApiKey}`;

      try {
        const response = UrlFetchApp.fetch(url, options);
        const statusCode = response.getResponseCode();
        const responseText = response.getContentText();

        if (statusCode === 200) {
          const resultJson = JSON.parse(responseText);
          if (resultJson.candidates && resultJson.candidates.length > 0) {
            // Catat pemakaian key ke database
            if (typeof incrementKeyUsageInDB === "function") {
              incrementKeyUsageInDB(currentApiKey);
            }
            const aiContent = resultJson.candidates[0].content.parts[0].text;
            const cleaned = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
          }
        } else if (statusCode === 503 || statusCode === 429) {
          lastError = `Google Gemini (${modelName}) limit/sibuk (HTTP ${statusCode}).`;
          Utilities.sleep(800);
          continue;
        } else if (statusCode === 401) {
          lastError = `Kunci API ke-${k+1} tidak valid (HTTP 401).`;
          break;
        } else {
          lastError = `Google Gemini (${modelName}) Error (${statusCode}): ${responseText.substring(0, 150)}`;
        }
      } catch (err) {
        lastError = err.toString();
      }
    }
  }

  return { status: "ERROR", message: lastError || "Gagal memproses AI." };
}

