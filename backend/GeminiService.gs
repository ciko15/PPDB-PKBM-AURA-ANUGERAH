/**
 * Pengecekan data menggunakan Gemini AI
 */
function cekKesesuaianDenganAI(dataSiswa, urlGambar) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  
  if (!apiKey || apiKey === 'TARUH_API_KEY_DISINI' || apiKey.trim() === '') {
    return {
      status: "ERROR",
      koreksi: "GEMINI_API_KEY belum dikonfigurasi di Script Properties Google Apps Script. Silakan buka Project Settings > Script Properties dan tambahkan GEMINI_API_KEY dengan API key Google AI Studio Anda."
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

  // Gunakan Gemini 1.5 Flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const promptText = `Berikut adalah data pendaftaran calon siswa Kejar Paket (Sekolah Non-Formal):\n` +
                     `1. NIK: ${dataSiswa.nik || '-'}\n` +
                     `2. Nama Lengkap: ${dataSiswa.nama || '-'}\n` +
                     `3. Tempat Lahir: ${dataSiswa.tempatLahir || '-'}\n` +
                     `4. Tanggal Lahir: ${dataSiswa.tglLahir || '-'}\n` +
                     `5. Nama Ibu Kandung: ${dataSiswa.namaIbu || '-'}\n\n` +
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

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (statusCode !== 200) {
      return { 
        status: "ERROR", 
        koreksi: `Google Gemini API mengembalikan kode ${statusCode}: ${responseText.substring(0, 200)}` 
      };
    }

    const resultJson = JSON.parse(responseText);
    
    if (resultJson.candidates && resultJson.candidates.length > 0) {
      const aiContent = resultJson.candidates[0].content.parts[0].text;
      try {
        return JSON.parse(aiContent);
      } catch (pe) {
        // Jika response dibungkus markdown ```json
        const cleaned = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned);
      }
    } else {
      return { status: "ERROR", koreksi: "Gemini AI tidak mengembalikan analisis yang valid." };
    }
  } catch (e) {
    return { status: "ERROR", koreksi: "Terjadi kesalahan saat memanggil API Gemini: " + e.toString() };
  }
}
