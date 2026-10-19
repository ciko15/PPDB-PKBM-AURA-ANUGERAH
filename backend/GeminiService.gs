/**
 * Pengecekan data menggunakan Gemini AI
 */
function cekKesesuaianDenganAI(dataSiswa, urlGambar, clientApiKey) {
  let apiKey = clientApiKey || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  
  // Fallback ke API key default jika belum terisi di Script Properties
  if (!apiKey || apiKey === 'TARUH_API_KEY_DISINI' || apiKey.trim() === '') {
    apiKey = 'AQ.Ab8RN6IsOK3hu-S-7x1mSMT91X37w4Fur-AbgFaF0WqCdaTnPA';
  }

  if (!apiKey || apiKey.trim() === '') {
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

  // Daftar model yang didukung (diurutkan dari yang paling stabil & hemat kuota)
  const candidateModels = ["gemini-3.5-flash-lite", "gemini-3.5-flash"];

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
                     `4. Jika status "Tidak Sesuai", buatkan deskripsi permasalahan secara rapi dan terstruktur dalam bentuk poin-poin bernomor: 1. ..., 2. ..., 3. ... Contoh:\n` +
                     `   1. Tanggal Lahir tidak cocok: pada dokumen tertulis 2 Juli 1999, sedangkan pada data tertera 25 Juni 1999.\n` +
                     `   2. Nama Ibu Kandung tidak cocok: pada dokumen tertera 'AGUSTINA KELAIMI', sedangkan pada data tertera '...'.\n` +
                     `5. Jika status "Sesuai", isi koreksi dengan "Semua data identitas cocok dengan dokumen fisik."\n\n` +
                     `Kembalikan respons murni dalam format JSON (tanpa markdown), dengan properti:\n` +
                     `{"status": "Sesuai" | "Tidak Sesuai", "koreksi": "Poin-poin bernomor 1. 2. 3. jika ada ketidaksesuaian"}`;

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

  let lastError = "";

  for (let i = 0; i < candidateModels.length; i++) {
    const modelName = candidateModels[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    try {
      const response = UrlFetchApp.fetch(url, options);
      const statusCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (statusCode === 200) {
        const resultJson = JSON.parse(responseText);
        if (resultJson.candidates && resultJson.candidates.length > 0) {
          const aiContent = resultJson.candidates[0].content.parts[0].text;
          const cleaned = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
          return JSON.parse(cleaned);
        }
      } else if (statusCode === 503 || statusCode === 429) {
        // Jika server Google sedang sibuk/overload di model ini, jeda sejenak lalu coba model berikutnya
        lastError = `Google Gemini (${modelName}) sedang sibuk (HTTP ${statusCode}).`;
        Utilities.sleep(1000);
        continue;
      } else {
        lastError = `Google Gemini (${modelName}) mengembalikan error HTTP ${statusCode}: ${responseText.substring(0, 150)}`;
      }
    } catch (e) {
      lastError = e.toString();
    }
  }

  return { status: "ERROR", koreksi: lastError || "Gagal menghubungi layanan AI." };
}

/**
 * Ekstraksi Data Otomatis dari Kartu Keluarga & Ijazah menggunakan Gemini AI
 */
function ekstrakDataDenganAI(nikTarget, kkBase64, ijazahBase64, clientApiKey) {
  let apiKey = clientApiKey || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  
  if (!apiKey || apiKey === 'TARUH_API_KEY_DISINI' || apiKey.trim() === '') {
    apiKey = 'AQ.Ab8RN6IsOK3hu-S-7x1mSMT91X37w4Fur-AbgFaF0WqCdaTnPA';
  }

  if (!apiKey || apiKey.trim() === '') {
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
    `Kembalikan respon murni JSON (tanpa markdown), contoh format:\n` +
    `{\n` +
    `  "status": "SUCCESS",\n` +
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

  const candidateModels = ["gemini-3.5-flash-lite", "gemini-3.5-flash"];

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  let lastError = "";

  for (let i = 0; i < candidateModels.length; i++) {
    const modelName = candidateModels[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    try {
      const response = UrlFetchApp.fetch(url, options);
      const statusCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (statusCode === 200) {
        const resultJson = JSON.parse(responseText);
        if (resultJson.candidates && resultJson.candidates.length > 0) {
          const aiContent = resultJson.candidates[0].content.parts[0].text;
          const cleaned = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
          return JSON.parse(cleaned);
        }
      } else if (statusCode === 503 || statusCode === 429) {
        lastError = `Google Gemini (${modelName}) sedang sibuk (HTTP ${statusCode}).`;
        Utilities.sleep(1000);
        continue;
      } else {
        lastError = `Google Gemini (${modelName}) Error (${statusCode}): ${responseText.substring(0, 150)}`;
      }
    } catch (err) {
      lastError = err.toString();
    }
  }

  return { status: "ERROR", message: lastError || "Gagal memproses AI." };
}

